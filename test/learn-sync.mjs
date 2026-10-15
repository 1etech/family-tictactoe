// Family sync, end to end: the real docs/learn/kids.js and sync.js on several
// pretend devices, talking to the sync Worker (sync/index.ts) under
// `wrangler dev` with a fresh, throwaway store.
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";
import assert from "node:assert/strict";

const ROOT = join(import.meta.dirname, "..");
const PORT = 8791;
const URL_SYNC = `http://127.0.0.1:${PORT}/sync`;
const kidsSrc = await readFile(join(ROOT, "docs", "learn", "kids.js"), "utf8");
const syncSrc = await readFile(join(ROOT, "docs", "learn", "sync.js"), "utf8");

// --- the Worker --------------------------------------------------------------
const store = await mkdtemp(join(tmpdir(), "learn-sync-"));
const wrangler = spawn(process.execPath, [join(ROOT, "node_modules", "wrangler", "bin", "wrangler.js"), "dev", "-c", "wrangler.sync.jsonc",
  "--port", String(PORT), "--ip", "127.0.0.1", "--persist-to", store], { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] });
let log = "";
await new Promise((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error(`wrangler dev did not start:\n${log}`)), 90_000);
  const onData = (chunk) => { log += chunk; if (/Ready on/.test(log)) { clearTimeout(timeout); resolve(); } };
  wrangler.stdout.on("data", onData);
  wrangler.stderr.on("data", onData);
  wrangler.on("exit", () => reject(new Error(`wrangler dev exited:\n${log}`)));
});
const stop = async () => {
  // wrangler starts workerd underneath it, so stop the whole process tree.
  if (process.platform === "win32") await new Promise((done) => spawn("taskkill", ["/pid", String(wrangler.pid), "/t", "/f"]).on("exit", done));
  else wrangler.kill();
  await rm(store, { recursive: true, force: true }).catch(() => {});
};

// --- pretend devices ----------------------------------------------------------
let sanitized = 0;
/** A browser: its own storage (or an existing one, reopened), at an address. */
function device(href = "http://127.0.0.1:8790/#learn", data = {}) {
  data["learn:sync-url"] = URL_SYNC;
  const events = [];
  const ctx = {
    localStorage: { getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v); } },
    location: new URL(href),
    history: { replaceState: (_s, _t, url) => { ctx.location = new URL(url); } },
    document: { visibilityState: "visible", addEventListener() {} },
    navigator: { onLine: true },
    CustomEvent: class { constructor(type) { this.type = type; } },
    addEventListener() {},
    dispatchEvent: (e) => events.push(e.type),
    LearnCommon: { sanitizeHTML: (s) => { sanitized++; return s.replace(/<script[\s\S]*?<\/script>/g, ""); } },
    setTimeout: () => 0, clearTimeout() {}, setInterval() {},
    fetch, crypto, URL, URLSearchParams, Promise, Error, JSON, Math, Date, Object, Array, Number, String, Set, Map,
    module: { exports: {} },
  };
  ctx.window = ctx;
  ctx.globalThis = ctx;
  runInNewContext(kidsSrc, ctx);
  runInNewContext(syncSrc, ctx);
  return { Kids: ctx.LearnKids, Sync: ctx.LearnSync, ctx, events, data };
}

const item = (ok, prompt = "Q") => ({ prompt, visual: "", given: "1 g", answer: "2 g", ok, why: "", steps: ["s"], skill: "convert", level: "easy" });
let clock = Date.UTC(2026, 9, 1);
const take = (Kids, kidId, ok = 2, prompt) => {
  const items = [item(true, prompt), item(true), item(false)].map((x, i) => ({ ...x, ok: i < ok }));
  return Kids.finishTest(kidId, { topic: "mass", testId: "easy", testName: "Easy test", at: clock += 60_000, durationSec: 30,
    right: ok, total: 3, pct: Math.round((100 * ok) / 3), items });
};
const nos = (Kids) => Array.from(Kids.attempts(), (a) => a.no).sort((a, b) => a - b);

try {
  // A grown-up's device with a practice learner already on it turns sync on.
  const mum = device();
  const mumId = mum.Kids.addParent("Mum", "lion-f").id;
  const tester = mum.Kids.add("Tester", "🐯");
  take(mum.Kids, tester.id);
  assert.equal(mum.Sync.status().on, false);
  mum.Sync.start();
  await mum.Sync.syncNow();
  assert.equal(mum.Sync.status().error, "", mum.Sync.status().error);
  assert.equal(mum.Kids.pending(), 0, "everything was sent");
  const link = mum.Sync.inviteLink();
  assert.match(link, /\?family=[A-Z2-9]{20}#learn$/);

  // The child's device already has two tests from before, then opens the link.
  const kid = device();
  const anya = kid.Kids.add("Anya", "😺");
  take(kid.Kids, anya.id, 3, "<b>Ok</b><script>alert(1)</script>");
  take(kid.Kids, anya.id, 1);
  kid.Kids.practiceAnswer(anya.id, { ok: true, level: "hard", skill: "scale", streak: 1 });
  // The same browser, opened again through the invite link.
  const anyaDevice = device(link, kid.data);
  assert.equal(anyaDevice.Sync.status().on, true, "opening the invite link joins");
  assert.equal(anyaDevice.ctx.location.search, "", "the code is taken out of the address bar");
  assert.equal(anyaDevice.ctx.location.hash, "#learn");
  await anyaDevice.Sync.syncNow();
  assert.equal(anyaDevice.Sync.status().error, "");

  // Mum now sees Anya and both of her tests, numbered without clashes.
  await mum.Sync.syncNow();
  assert.deepEqual(Array.from(mum.Kids.list(), (k) => k.name), ["Anya", "Tester"]);
  assert.equal(mum.Kids.attempts(anya.id).length, 2);
  assert.deepEqual(nos(mum.Kids), [1, 2, 3], "one numbering for the whole family");
  assert.deepEqual(nos(anyaDevice.Kids), [1, 2, 3], "the same numbers on every device");
  assert.equal(mum.Kids.get(anya.id).points, anyaDevice.Kids.get(anya.id).points, "points come across");
  assert.ok(mum.events.includes("learnkids:change"), "the page is told to redraw");
  assert.ok(sanitized > 0, "synced question HTML is cleaned");
  assert.ok(!mum.Kids.attempts(anya.id).some((a) => a.items[0].prompt.includes("<script")));

  // A new test on the child's device reaches Mum with the same number.
  const newTest = take(anyaDevice.Kids, anya.id, 3);
  assert.ok(newTest);
  await anyaDevice.Sync.syncNow();
  await mum.Sync.syncNow();
  const latest = mum.Kids.attempts(anya.id)[0];
  assert.equal(latest.pct, 100);
  assert.equal(latest.no, anyaDevice.Kids.attempts(anya.id)[0].no);
  assert.equal(latest.no, 4);
  assert.equal(mum.Kids.get(anya.id).stats.best.easy, 100);

  // Mum looks at it; the child's device (and so Dad) learns it was seen.
  mum.Kids.markSeen(latest.id, mumId);
  await mum.Sync.syncNow();
  await anyaDevice.Sync.syncNow();
  assert.ok(anyaDevice.Kids.attempt(latest.id).seenBy[mumId], "seen-by travels");

  // Deleting a test and removing a learner reach the other devices.
  const oldest = mum.Kids.attempts(anya.id).at(-1);
  mum.Kids.deleteAttempt(oldest.id);
  mum.Kids.remove(tester.id);
  await mum.Sync.syncNow();
  await anyaDevice.Sync.syncNow();
  assert.equal(anyaDevice.Kids.attempt(oldest.id), null);
  assert.equal(anyaDevice.Kids.get(tester.id), null);
  // …and a stale device can't bring them back.
  anyaDevice.Kids.queueAll();
  await anyaDevice.Sync.syncNow();
  await mum.Sync.syncNow();
  assert.equal(mum.Kids.attempt(oldest.id), null);

  // Lots of tests: a new device catches up a page at a time.
  for (let i = 0; i < 170; i++) take(anyaDevice.Kids, anya.id, i % 4);
  await anyaDevice.Sync.syncNow();
  assert.equal(anyaDevice.Kids.pending(), 0);
  const dad = device();
  assert.equal(dad.Sync.join("not a code"), false);
  assert.equal(dad.Sync.join(mum.Sync.status().code.toLowerCase()), true, "codes aren't case sensitive");
  await dad.Sync.syncNow();
  assert.equal(dad.Kids.attempts(anya.id).length, anyaDevice.Kids.attempts(anya.id).length);
  assert.equal(dad.Kids.parents()[0].name, "Mum");
  assert.deepEqual(nos(dad.Kids), nos(anyaDevice.Kids));
  assert.equal(new Set(nos(dad.Kids)).size, nos(dad.Kids).length, "no number is used twice");

  // A device that turns sync off keeps its results but stops sending.
  dad.Sync.leave();
  assert.equal(dad.Sync.status().on, false);
  assert.ok(dad.Kids.attempts().length > 0);

  // The Worker refuses bad requests.
  const post = (body) => fetch(URL_SYNC, { method: "POST", body: JSON.stringify(body) });
  assert.equal((await post({ family: "short" })).status, 400);
  assert.equal((await fetch(URL_SYNC)).status, 405);
  assert.equal((await post({ family: "A".repeat(20), changes: Array(301).fill({}) })).status, 413);
  const other = await (await post({ family: "B".repeat(20), since: 0, changes: [] })).json();
  assert.equal(other.records.length, 0, "another family's code sees nothing");
  const preflight = await fetch(URL_SYNC, { method: "OPTIONS" });
  assert.equal(preflight.headers.get("access-control-allow-origin"), "*");

  console.log("All family sync checks passed.");
} finally {
  await stop();
}
