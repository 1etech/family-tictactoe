// Family sync for the Learn tab. Every device that knows a family code sends
// its new learners, grown-ups and finished tests here, and gets back whatever
// the other devices sent. One Durable Object (with its own SQLite database)
// holds each family; it is found by a hash of the code, so the code itself is
// never stored.
//
// The page is static (GitHub Pages), so this is a separate Worker called from
// the browser. Knowing the family code is the only access check.
import { DurableObject } from "cloudflare:workers";

export interface SyncEnv {
  FAMILY: DurableObjectNamespace<FamilyStore>;
}

type Kind = "kid" | "parent" | "attempt";
type Rec = Record<string, unknown> & { id: string };
interface Change { kind: Kind; id: string; data?: Rec; deleted?: number }
interface SyncResult { rev: number; more: boolean; nextNo: number; records: { kind: Kind; id: string; data: Rec }[] }

const KINDS = new Set<string>(["kid", "parent", "attempt"]);
const CODE = /^[A-Z2-9]{16,64}$/;
const ID = /^[a-z0-9]{1,40}$/i;
const MAX_BODY = 2_000_000;
const MAX_CHANGES = 300;
const MAX_RECORD = 120_000;
const MAX_RECORDS = 20_000;
const PAGE = 150;
const MAX_LOG = 40;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { ...CORS, "Cache-Control": "no-store" } });
}

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export default {
  async fetch(request: Request, env: SyncEnv): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
    if (url.pathname !== "/sync") return json({ error: "Not found." }, 404);
    if (request.method !== "POST") return json({ error: "Use POST." }, 405);
    if (Number(request.headers.get("Content-Length") || 0) > MAX_BODY) return json({ error: "Too much at once." }, 413);

    const text = await request.text();
    if (text.length > MAX_BODY) return json({ error: "Too much at once." }, 413);
    let body: { family?: unknown; since?: unknown; changes?: unknown };
    try {
      body = JSON.parse(text);
    } catch {
      return json({ error: "Not JSON." }, 400);
    }
    const code = typeof body?.family === "string" ? body.family.trim().toUpperCase() : "";
    if (!CODE.test(code)) return json({ error: "That family code is not valid." }, 400);
    const changes = Array.isArray(body.changes) ? body.changes : [];
    if (changes.length > MAX_CHANGES) return json({ error: "Too many changes at once." }, 413);

    const stub = env.FAMILY.getByName(await sha256(code));
    const result = await stub.sync(Math.max(0, Number(body.since) || 0), changes);
    return "error" in result ? json(result, 400) : json(result);
  },
} satisfies ExportedHandler<SyncEnv>;

/** Checks one incoming change; anything malformed is dropped. */
function validChange(c: unknown): Change | null {
  if (!c || typeof c !== "object") return null;
  const { kind, id, data, deleted } = c as Record<string, unknown>;
  if (typeof kind !== "string" || !KINDS.has(kind) || typeof id !== "string" || !ID.test(id)) return null;
  if (Number(deleted) > 0) return { kind: kind as Kind, id, deleted: Number(deleted) };
  if (!data || typeof data !== "object" || Array.isArray(data) || (data as Rec).id !== id) return null;
  if (JSON.stringify(data).length > MAX_RECORD) return null;
  return { kind: kind as Kind, id, data: data as Rec };
}

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const num = (v: unknown) => Number(v) || 0;

/** Max of every counter. Points and stats only ever grow, so the larger one is newer. */
function maxMap(a: unknown, b: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of [...Object.entries(obj(a)), ...Object.entries(obj(b))]) out[k] = Math.max(out[k] ?? 0, num(v));
  return out;
}

/** The same learner changed on two devices: keep the furthest along of each. */
function mergeKid(mine: Rec, theirs: Rec): Rec {
  const ms = obj(mine.stats), ts = obj(theirs.stats);
  const log = new Map<string, unknown>();
  for (const l of [...(Array.isArray(mine.log) ? mine.log : []), ...(Array.isArray(theirs.log) ? theirs.log : [])]) {
    const e = obj(l);
    log.set(`${num(e.at)}|${e.why}|${num(e.pts)}`, e);
  }
  const badges: Record<string, number> = { ...maxMap(theirs.badges, {}) };
  for (const [k, v] of Object.entries(obj(mine.badges))) badges[k] = badges[k] ? Math.min(badges[k], num(v)) : num(v);
  return {
    ...mine,
    points: Math.max(num(mine.points), num(theirs.points)),
    badges,
    log: [...log.values()].sort((x, y) => num(obj(y).at) - num(obj(x).at)).slice(0, MAX_LOG),
    stats: {
      ...ms,
      practiceAnswered: Math.max(num(ms.practiceAnswered), num(ts.practiceAnswered)),
      practiceRight: Math.max(num(ms.practiceRight), num(ts.practiceRight)),
      bestStreak: Math.max(num(ms.bestStreak), num(ts.bestStreak)),
      skillRight: maxMap(ms.skillRight, ts.skillRight),
      tests: maxMap(ms.tests, ts.tests),
      best: maxMap(ms.best, ts.best),
    },
  };
}

/**
 * One family's learners, grown-ups and tests. Each record carries the revision
 * it last changed at, so a device asks for "everything after revision N".
 * Deleting leaves a tombstone so the record can't come back from a device that
 * hasn't heard yet. Tests are numbered here (#1, #2, …) so every device shows
 * the same number.
 */
export class FamilyStore extends DurableObject<SyncEnv> {
  private sql: SqlStorage;

  constructor(ctx: DurableObjectState, env: SyncEnv) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS records (kind TEXT NOT NULL, id TEXT NOT NULL, rev INTEGER NOT NULL, data TEXT NOT NULL, PRIMARY KEY (kind, id));
      CREATE INDEX IF NOT EXISTS records_rev ON records (rev);
      CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v INTEGER NOT NULL);`);
  }

  private meta(k: string, fallback: number): number {
    const row = this.sql.exec<{ v: number }>("SELECT v FROM meta WHERE k = ?", k).toArray()[0];
    return row ? row.v : fallback;
  }

  private get(kind: Kind, id: string): Rec | null {
    const row = this.sql.exec<{ data: string }>("SELECT data FROM records WHERE kind = ? AND id = ?", kind, id).toArray()[0];
    return row ? (JSON.parse(row.data) as Rec) : null;
  }

  async sync(since: number, raw: unknown[]): Promise<SyncResult | { error: string }> {
    const changes = raw.map(validChange).filter((c): c is Change => c !== null);
    // New tests are numbered in the order they were taken.
    changes.sort((x, y) => num(x.data?.at) - num(y.data?.at));

    let rev = this.meta("rev", 0);
    let nextNo = this.meta("nextNo", 1);
    let count = this.sql.exec<{ n: number }>("SELECT COUNT(*) AS n FROM records").one().n;
    const put = (kind: Kind, id: string, data: Rec, isNew: boolean) => {
      if (isNew && count >= MAX_RECORDS) return;
      if (isNew) count++;
      this.sql.exec("INSERT OR REPLACE INTO records (kind, id, rev, data) VALUES (?, ?, ?, ?)", kind, id, ++rev, JSON.stringify(data));
    };

    this.ctx.storage.transactionSync(() => {
      for (const c of changes) {
        const have = this.get(c.kind, c.id);
        if (have?.deleted) continue; // deleted for good
        if (c.deleted) {
          put(c.kind, c.id, { id: c.id, deleted: c.deleted }, !have);
          // A removed learner takes their tests along.
          if (c.kind === "kid") {
            const theirs = this.sql.exec<{ id: string }>(
              "SELECT id FROM records WHERE kind = 'attempt' AND json_extract(data, '$.kidId') = ?", c.id).toArray();
            for (const { id } of theirs) put("attempt", id, { id, deleted: c.deleted }, false);
          }
          continue;
        }
        const data = c.data!;
        let next: Rec;
        if (!have && c.kind === "attempt" && this.get("kid", String(data.kidId))?.deleted) {
          // A test saved offline by a learner who has since been removed.
          put(c.kind, c.id, { id: c.id, deleted: Date.now() }, true);
          continue;
        }
        if (!have) {
          next = c.kind === "attempt" ? { ...data, no: nextNo++ } : data;
        } else if (c.kind === "kid") {
          next = mergeKid(have, data);
        } else if (c.kind === "attempt") {
          // A finished test never changes, except who has seen it.
          const seen = { ...obj(data.seenBy), ...obj(have.seenBy) };
          next = { ...have, seenBy: seen };
        } else {
          continue; // grown-ups never change once added
        }
        if (have && JSON.stringify(next) === JSON.stringify(have)) continue;
        put(c.kind, c.id, next, !have);
      }
      this.sql.exec("INSERT OR REPLACE INTO meta (k, v) VALUES ('rev', ?), ('nextNo', ?)", rev, nextNo);
    });

    const rows = this.sql.exec<{ kind: Kind; id: string; rev: number; data: string }>(
      "SELECT kind, id, rev, data FROM records WHERE rev > ? ORDER BY rev LIMIT ?", since, PAGE + 1).toArray();
    const more = rows.length > PAGE;
    const page = rows.slice(0, PAGE);
    return {
      rev: more ? page[page.length - 1].rev : rev,
      more,
      nextNo,
      records: page.map((r) => ({ kind: r.kind, id: r.id, data: JSON.parse(r.data) as Rec })),
    };
  }
}
