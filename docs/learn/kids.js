// Learners, saved tests and Claw Point rewards for the Learn tab.
//
// Everything lives in this browser's localStorage under one key. When family
// sync is on (sync.js), every change is also queued in an outbox and sent to
// the family's online store, and what other devices sent is merged back in.
// Export/import still moves results by file.
(() => {
  "use strict";

  const KEY = "learn:v1";
  const MAX_ATTEMPTS = 400;
  const MAX_LOG = 40;

  const AVATARS = ["🐱", "😺", "😸", "😻", "🐈", "🐈‍⬛", "🐯", "🦁"];

  // Grown-ups get a male or female animal; the pictures are in avatars.js.
  const PARENT_AVATARS = [
    { id: "lion-m", name: "Lion" }, { id: "lion-f", name: "Lioness" },
    { id: "tiger-m", name: "Tiger" }, { id: "tiger-f", name: "Tigress" },
    { id: "elephant-m", name: "Papa Elephant" }, { id: "elephant-f", name: "Mama Elephant" },
    { id: "wolf-m", name: "Papa Wolf" }, { id: "wolf-f", name: "Mama Wolf" },
    { id: "bear-m", name: "Papa Bear" }, { id: "bear-f", name: "Mama Bear" },
  ];
  const PARENT_IDS = PARENT_AVATARS.map((a) => a.id);

  const RANKS = [
    { min: 0, name: "Tiny Kitten", icon: "🐱" },
    { min: 50, name: "Curious Kitten", icon: "😺" },
    { min: 150, name: "Alley Cat", icon: "🐈" },
    { min: 300, name: "Clever Cat", icon: "😼" },
    { min: 600, name: "Jungle Cat", icon: "🐆" },
    { min: 1000, name: "Tiger", icon: "🐯" },
    { min: 1600, name: "Lion", icon: "🦁" },
  ];

  const skill = (k, s) => k.stats.skillRight[s] || 0;

  // Test ids are "easy", "medium", "hard", "mixed" for mass (the first topic,
  // kept as they were) and "<topic>-easy" and so on for later topics.
  const LEVELS = ["easy", "medium", "hard", "mixed"];
  const levelOf = (testId) => String(testId).split("-").pop();
  const topicOfId = (testId) => (String(testId).includes("-") ? String(testId).split("-")[0] : "mass");
  /** Finished all four tests of any one topic. */
  const allFour = (k) => {
    const done = {};
    for (const id of Object.keys(k.stats.tests)) (done[topicOfId(id)] ||= new Set()).add(levelOf(id));
    return Object.values(done).some((set) => LEVELS.every((l) => set.has(l)));
  };
  const BADGES = [
    { id: "first-pounce", icon: "🐾", name: "First Pounce", how: "Finish your first test", earned: (k) => Object.keys(k.stats.tests).length > 0 },
    { id: "curious", icon: "😺", name: "Curious Kitten", how: "Answer 10 practice questions", earned: (k) => k.stats.practiceAnswered >= 10 },
    { id: "yarn", icon: "🧶", name: "Yarn Ball Streak", how: "Get 5 practice answers right in a row", earned: (k) => k.stats.bestStreak >= 5 },
    { id: "nine-lives", icon: "🐈", name: "Nine Lives", how: "Get 9 practice answers right in a row", earned: (k) => k.stats.bestStreak >= 9 },
    { id: "whiskers", icon: "⚖️", name: "Scale Whiskers", how: "Read 5 scales or rulers correctly", earned: (k) => skill(k, "scale") >= 5 },
    { id: "mouse", icon: "🐭", name: "Mouse Catcher", how: "Get 10 unit changes right", earned: (k) => skill(k, "convert") >= 10 },
    { id: "purrfect", icon: "😻", name: "Purrfect Score", how: "Get 100% on any test", earned: (k) => Object.values(k.stats.best).some((p) => p === 100) },
    { id: "lion-heart", icon: "🦁", name: "Lion Heart", how: "Score 70% or more on a Hard test", earned: (k) => Object.entries(k.stats.best).some(([id, p]) => levelOf(id) === "hard" && p >= 70) },
    { id: "tiger", icon: "🐯", name: "Tiger Tester", how: "Finish all four tests in one topic", earned: allFour },
    { id: "fish", icon: "🐟", name: "Fish Feast", how: "Earn 100 Claw Points", earned: (k) => k.points >= 100 },
    { id: "crown", icon: "👑", name: "Cat Royalty", how: "Earn 500 Claw Points", earned: (k) => k.points >= 500 },
  ];

  const POINTS = {
    practice: { easy: 1, medium: 2, hard: 3 },
    test: { easy: 2, medium: 3, hard: 5 },
    streakEvery: 5,
    streakBonus: 5,
    testDone: 10,
    purrfect: 25,
    newBest: 10,
  };

  // --- storage -------------------------------------------------------------
  let canSave = true;
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const blank = () => ({ kids: {}, parents: {}, attempts: [], current: null, nextNo: 1, outbox: {}, seq: 0 });

  /**
   * Gives every saved test a permanent number (#1, #2, …) in date order. Tests
   * saved before numbering existed, or imported with a clashing number, get the
   * next free one; numbers already given never change. With family sync the
   * online store numbers each test, and its numbers win over this device's.
   */
  function numberAttempts(data) {
    const used = new Set();
    const byDate = [...data.attempts].sort((x, y) => x.at - y.at);
    for (const a of [...byDate.filter((x) => x.synced), ...byDate.filter((x) => !x.synced)]) {
      if (Number.isInteger(a.no) && a.no > 0 && !used.has(a.no)) used.add(a.no);
      else a.no = 0;
    }
    let next = Math.max(Number(data.nextNo) || 1, ...[...used].map((n) => n + 1));
    for (const a of byDate) {
      if (a.no) continue;
      a.no = next++;
      used.add(a.no);
    }
    data.nextNo = next;
  }

  /** Keeps only well-formed "seen by grown-up" stamps. */
  const fixSeen = (seen) => Object.fromEntries(Object.entries(seen && typeof seen === "object" ? seen : {})
    .filter(([id, at]) => typeof id === "string" && Number(at) > 0).map(([id, at]) => [id, Number(at)]));

  function fixKid(k) {
    k.points = Number(k.points) || 0;
    k.badges = k.badges && typeof k.badges === "object" ? k.badges : {};
    k.log = Array.isArray(k.log) ? k.log : [];
    const s = (k.stats = k.stats && typeof k.stats === "object" ? k.stats : {});
    s.practiceAnswered = Number(s.practiceAnswered) || 0;
    s.practiceRight = Number(s.practiceRight) || 0;
    s.bestStreak = Number(s.bestStreak) || 0;
    for (const field of ["skillRight", "tests", "best"]) if (!s[field] || typeof s[field] !== "object") s[field] = {};
    return k;
  }

  function load() {
    try {
      const raw = globalThis.localStorage?.getItem(KEY);
      if (!globalThis.localStorage) canSave = false;
      const data = raw ? JSON.parse(raw) : blank();
      data.kids = data.kids && typeof data.kids === "object" ? data.kids : {};
      data.attempts = Array.isArray(data.attempts) ? data.attempts : [];
      data.parents = data.parents && typeof data.parents === "object" ? data.parents : {};
      data.outbox = data.outbox && typeof data.outbox === "object" ? data.outbox : {};
      data.seq = Number(data.seq) || 0;
      Object.values(data.kids).forEach(fixKid);
      for (const a of data.attempts) a.seenBy = fixSeen(a.seenBy);
      numberAttempts(data);
      return data;
    } catch {
      canSave = false;
      return blank();
    }
  }

  let db = load();

  function save() {
    if (db.attempts.length > MAX_ATTEMPTS) db.attempts = db.attempts.slice(-MAX_ATTEMPTS);
    try {
      globalThis.localStorage.setItem(KEY, JSON.stringify(db));
      canSave = true;
    } catch {
      canSave = false;
    }
  }

  const clean = (value, max) => String(value ?? "")
    .replace(/[\p{Cc}\p{Cf}]/gu, " ").replace(/\s+/g, " ").trim().slice(0, max);

  // --- family sync outbox --------------------------------------------------
  // Every local change queues "kind:id" with a rising number, so a change made
  // while a sync is in flight is not lost when that sync is acknowledged.
  const keyOf = (kind, id) => `${kind}:${id}`;
  function touch(kind, id, deleted = 0) {
    db.outbox[keyOf(kind, id)] = deleted ? { n: ++db.seq, deleted } : { n: ++db.seq };
    Kids.onLocalChange?.();
  }

  // Backups and synced records come from outside, so each is cleaned the same way.
  const normKid = (incoming) => fixKid({
    ...incoming,
    name: clean(incoming.name, 20) || "Learner",
    avatar: AVATARS.includes(incoming.avatar) ? incoming.avatar : AVATARS[0],
    log: (Array.isArray(incoming.log) ? incoming.log : []).map((l) => ({ at: Number(l?.at) || 0, pts: Number(l?.pts) || 0, why: clean(l?.why, 60) })),
  });
  const normParent = (p) => ({ id: p.id, name: clean(p.name, 20) || "Grown-up", avatar: PARENT_IDS.includes(p.avatar) ? p.avatar : PARENT_IDS[0], created: Number(p.created) || 0 });
  const normAttempt = (a, sanitize) => ({
    seenBy: fixSeen(a.seenBy), no: Number(a.no) || 0,
    id: a.id, kidId: a.kidId, kidName: clean(a.kidName, 20), avatar: AVATARS.includes(a.avatar) ? a.avatar : AVATARS[0],
    topic: clean(a.topic, 30), testId: clean(a.testId, 20), testName: clean(a.testName, 40),
    at: Number(a.at) || 0, durationSec: Number(a.durationSec) || 0, points: Number(a.points) || 0,
    right: Number(a.right) || 0, total: Number(a.total) || 0, pct: Number(a.pct) || 0,
    items: a.items.map((i) => ({
      prompt: sanitize(String(i?.prompt ?? "")), visual: i?.visual ? sanitize(String(i.visual)) : "",
      given: clean(i?.given, 80), answer: clean(i?.answer, 80), ok: !!i?.ok,
      why: i?.why ? sanitize(String(i.why)) : "", steps: (Array.isArray(i?.steps) ? i.steps : []).map((s) => sanitize(String(s))),
      skill: clean(i?.skill, 20), level: clean(i?.level, 10),
    })),
  });

  /** Adds another device's progress for a learner: the furthest along of each counter wins. */
  function mergeKidInto(mine, k) {
    mine.points = Math.max(mine.points, k.points);
    for (const [id, at] of Object.entries(k.badges)) mine.badges[id] ||= at;
    for (const f of ["practiceAnswered", "practiceRight", "bestStreak"]) mine.stats[f] = Math.max(mine.stats[f], k.stats[f]);
    for (const f of ["skillRight", "tests", "best"]) {
      for (const [key, v] of Object.entries(k.stats[f])) mine.stats[f][key] = Math.max(mine.stats[f][key] || 0, Number(v) || 0);
    }
    const seen = new Set(mine.log.map((l) => `${l.at}|${l.why}|${l.pts}`));
    mine.log = [...mine.log, ...k.log.filter((l) => !seen.has(`${l.at}|${l.why}|${l.pts}`))]
      .sort((x, y) => y.at - x.at).slice(0, MAX_LOG);
  }

  function dropKid(id) {
    delete db.kids[id];
    db.attempts = db.attempts.filter((a) => a.kidId !== id);
    if (db.current === id) db.current = null;
  }

  // --- ranks & rewards -----------------------------------------------------
  function rankFor(points) {
    let i = 0;
    while (i + 1 < RANKS.length && points >= RANKS[i + 1].min) i++;
    const rank = RANKS[i], next = RANKS[i + 1] || null;
    const progress = next ? (points - rank.min) / (next.min - rank.min) : 1;
    return { rank, next, progress, toNext: next ? next.min - points : 0 };
  }

  /** Adds points, records why, and hands back anything newly unlocked. */
  function grant(kid, lines) {
    const before = rankFor(kid.points).rank;
    const points = lines.reduce((sum, [p]) => sum + p, 0);
    kid.points += points;
    for (const [p, why] of lines) if (p) kid.log.unshift({ at: Date.now(), pts: p, why });
    kid.log = kid.log.slice(0, MAX_LOG);
    const newBadges = BADGES.filter((b) => !kid.badges[b.id] && b.earned(kid));
    for (const b of newBadges) kid.badges[b.id] = Date.now();
    const after = rankFor(kid.points).rank;
    touch("kid", kid.id);
    save();
    return { points, lines: lines.filter(([p]) => p), newBadges, rankUp: after !== before ? after : null };
  }

  // --- public API ----------------------------------------------------------
  const Kids = {
    AVATARS, PARENT_AVATARS, RANKS, BADGES, POINTS, rankFor,
    canSave: () => canSave,

    list: () => Object.values(db.kids).sort((a, b) => a.name.localeCompare(b.name)),
    get: (id) => db.kids[id] || null,
    current: () => db.kids[db.current] || null,
    setCurrent(id) { db.current = db.kids[id] ? id : null; save(); },

    /** Adds a learner, or picks the existing one with the same name. */
    add(name, avatar) {
      const n = clean(name, 20);
      if (!n) return null;
      let kid = Object.values(db.kids).find((k) => k.name.toLowerCase() === n.toLowerCase());
      if (!kid) {
        kid = fixKid({ id: uid(), name: n, avatar: AVATARS.includes(avatar) ? avatar : AVATARS[0], created: Date.now() });
        db.kids[kid.id] = kid;
        touch("kid", kid.id);
      }
      db.current = kid.id;
      save();
      return kid;
    },

    remove(id) {
      for (const a of db.attempts) if (a.kidId === id) touch("attempt", a.id, Date.now());
      touch("kid", id, Date.now());
      dropKid(id);
      save();
    },

    /** One practice answer. `streak` is the run of correct answers including this one. */
    practiceAnswer(id, { ok, level, skill: s, streak }) {
      const kid = db.kids[id];
      if (!kid) return null;
      kid.stats.practiceAnswered += 1;
      const lines = [];
      if (ok) {
        kid.stats.practiceRight += 1;
        kid.stats.skillRight[s] = (kid.stats.skillRight[s] || 0) + 1;
        kid.stats.bestStreak = Math.max(kid.stats.bestStreak, streak);
        lines.push([POINTS.practice[level] || 1, "Correct practice answer"]);
        if (streak > 0 && streak % POINTS.streakEvery === 0) lines.push([POINTS.streakBonus, `${streak} in a row!`]);
      }
      return grant(kid, lines);
    },

    /** Saves a finished test for the parent page and pays out its points. */
    finishTest(id, attempt) {
      const kid = db.kids[id];
      if (!kid) return null;
      const prevBest = kid.stats.best[attempt.testId];
      Object.assign(attempt, { id: uid(), kidId: kid.id, kidName: kid.name, avatar: kid.avatar, seenBy: {} });

      kid.stats.tests[attempt.testId] = (kid.stats.tests[attempt.testId] || 0) + 1;
      kid.stats.best[attempt.testId] = Math.max(prevBest ?? 0, attempt.pct);
      const rightByLevel = {};
      for (const item of attempt.items) {
        if (!item.ok) continue;
        kid.stats.skillRight[item.skill] = (kid.stats.skillRight[item.skill] || 0) + 1;
        rightByLevel[item.level] = (rightByLevel[item.level] || 0) + 1;
      }

      const lines = Object.entries(rightByLevel).map(([level, n]) =>
        [n * (POINTS.test[level] || 2), `${n} correct ${level} answer${n === 1 ? "" : "s"}`]);
      lines.push([POINTS.testDone, "Finished the test"]);
      if (attempt.pct === 100) lines.push([POINTS.purrfect, "Purrfect score!"]);
      const newBest = prevBest !== undefined && attempt.pct > prevBest;
      if (newBest) lines.push([POINTS.newBest, "Beat your best score"]);

      const result = grant(kid, lines);
      attempt.points = result.points;
      attempt.no = db.nextNo++;
      db.attempts.push(attempt);
      touch("attempt", attempt.id);
      save();
      return { ...result, newBest };
    },

    /** Saved tests, newest first. */
    attempts: (kidId) => db.attempts.filter((a) => !kidId || a.kidId === kidId).slice().reverse(),
    attempt: (id) => db.attempts.find((a) => a.id === id) || null,

    /**
     * Saved tests for the parent page. Filters: kidId, topic, testId, from/to
     * (ms, inclusive), no (test number), unseenBy (a grown-up's id). Sorts:
     * newest, oldest, number, child, test (by topicOrder, then level),
     * score-high, score-low. Tests saved before topics existed are mass.
     */
    findAttempts({ kidId, topic, testId, from, to, no, unseenBy, sort = "newest", topicOrder = [] } = {}) {
      const topicOf = (a) => a.topic || "mass";
      const testRank = (a) => topicOrder.indexOf(topicOf(a)) * 10 + LEVELS.indexOf(levelOf(a.testId));
      const list = db.attempts.filter((a) =>
        (!kidId || a.kidId === kidId)
        && (!topic || topicOf(a) === topic)
        && (!testId || a.testId === testId)
        && (!from || a.at >= from)
        && (!to || a.at <= to)
        && (!no || a.no === no)
        && (!unseenBy || !a.seenBy[unseenBy]));
      const newest = (x, y) => y.at - x.at || y.no - x.no;
      const sorts = {
        newest,
        oldest: (x, y) => -newest(x, y),
        number: (x, y) => y.no - x.no,
        child: (x, y) => x.kidName.localeCompare(y.kidName) || newest(x, y),
        test: (x, y) => testRank(x) - testRank(y) || newest(x, y),
        "score-high": (x, y) => y.pct - x.pct || newest(x, y),
        "score-low": (x, y) => x.pct - y.pct || newest(x, y),
      };
      return list.sort(sorts[sort] || newest);
    },
    deleteAttempt(id) { db.attempts = db.attempts.filter((a) => a.id !== id); touch("attempt", id, Date.now()); save(); },

    // Grown-ups review tests. They are not linked to particular children —
    // any grown-up can see every child's tests — and they earn no points.
    parents: () => Object.values(db.parents).sort((a, b) => a.name.localeCompare(b.name)),
    getParent: (id) => db.parents[id] || null,

    /** Adds a grown-up, or returns the existing one with the same name. */
    addParent(name, avatar) {
      const n = clean(name, 20);
      if (!n) return null;
      let parent = Object.values(db.parents).find((p) => p.name.toLowerCase() === n.toLowerCase());
      if (!parent) {
        parent = { id: uid(), name: n, avatar: PARENT_IDS.includes(avatar) ? avatar : PARENT_IDS[0], created: Date.now() };
        db.parents[parent.id] = parent;
        touch("parent", parent.id);
        save();
      }
      return parent;
    },

    removeParent(id) {
      delete db.parents[id];
      for (const a of db.attempts) delete a.seenBy[id];
      touch("parent", id, Date.now());
      save();
    },

    /** Records that a grown-up has looked at a test. */
    markSeen(attemptId, parentId) {
      const a = db.attempts.find((x) => x.id === attemptId);
      if (!a || !db.parents[parentId] || a.seenBy[parentId]) return;
      a.seenBy[parentId] = Date.now();
      touch("attempt", a.id);
      save();
    },

    exportData: () => JSON.stringify({ app: "family-tictactoe-learn", version: 1, exported: new Date().toISOString(), kids: db.kids, parents: db.parents, attempts: db.attempts }, null, 1),

    /**
     * Merges a backup into this device. `sanitize` cleans stored HTML, since a
     * file is outside input. Returns what was added.
     */
    importData(text, sanitize = (s) => s) {
      const data = JSON.parse(text);
      if (!data || data.app !== "family-tictactoe-learn" || typeof data.kids !== "object" || !Array.isArray(data.attempts)) {
        throw new Error("That file is not a learning backup.");
      }
      let kidsAdded = 0, attemptsAdded = 0;
      for (const incoming of Object.values(data.kids)) {
        if (!incoming || typeof incoming.id !== "string") continue;
        const k = normKid(incoming);
        const mine = db.kids[k.id];
        if (!mine) { db.kids[k.id] = k; kidsAdded++; } else mergeKidInto(mine, k);
        touch("kid", k.id);
      }
      let parentsAdded = 0;
      for (const p of Object.values(data.parents && typeof data.parents === "object" ? data.parents : {})) {
        if (!p || typeof p.id !== "string" || db.parents[p.id]) continue;
        db.parents[p.id] = normParent(p);
        touch("parent", p.id);
        parentsAdded++;
      }
      const have = new Map(db.attempts.map((a) => [a.id, a]));
      // Numbers already used on this device win; a clashing import gets a new one.
      const takenNos = new Set(db.attempts.map((a) => a.no));
      for (const a of data.attempts) {
        if (a && have.has(a.id)) { Object.assign(have.get(a.id).seenBy, fixSeen(a.seenBy)); touch("attempt", a.id); }
        if (!a || typeof a.id !== "string" || have.has(a.id) || !db.kids[a.kidId] || !Array.isArray(a.items)) continue;
        const copy = normAttempt(a, sanitize);
        copy.no = takenNos.has(copy.no) ? 0 : (takenNos.add(copy.no), copy.no);
        db.attempts.push(copy);
        touch("attempt", a.id);
        attemptsAdded++;
      }
      db.attempts.sort((x, y) => x.at - y.at);
      numberAttempts(db);
      save();
      return { kidsAdded, parentsAdded, attemptsAdded };
    },

    // --- family sync (used by sync.js) ---------------------------------------

    /** Queues everything on this device, e.g. when it joins a family. */
    queueAll() {
      for (const id of Object.keys(db.kids)) touch("kid", id);
      for (const id of Object.keys(db.parents)) touch("parent", id);
      for (const a of db.attempts) touch("attempt", a.id);
      save();
    },

    /** Up to `limit` queued changes to send: the current record, or a deletion. */
    outbox(limit = 200) {
      const out = [];
      for (const [key, entry] of Object.entries(db.outbox)) {
        if (out.length >= limit) break;
        const [kind, id] = [key.slice(0, key.indexOf(":")), key.slice(key.indexOf(":") + 1)];
        if (entry.deleted) { out.push({ key, n: entry.n, kind, id, deleted: entry.deleted }); continue; }
        const data = kind === "kid" ? db.kids[id] : kind === "parent" ? db.parents[id] : db.attempts.find((a) => a.id === id);
        if (data) out.push({ key, n: entry.n, kind, id, data });
        else delete db.outbox[key]; // trimmed away; nothing left to send
      }
      return out;
    },
    pending: () => Object.keys(db.outbox).length,

    /** The store has these; forget them unless they changed again meanwhile. */
    acked(sent) {
      for (const c of sent) if (db.outbox[c.key]?.n === c.n) delete db.outbox[c.key];
      save();
    },

    /**
     * Merges records from the family store. Its test numbers win. Returns true
     * if anything here changed. Records still queued here are merged too (the
     * store already has this device's copy, or will on the next send).
     */
    applyRemote(records, sanitize = (s) => s, nextNo = 0) {
      let changed = false;
      const ok = (r) => r && typeof r.id === "string" && r.data && typeof r.data === "object";
      const order = { parent: 0, kid: 1, attempt: 2 };
      for (const { kind, id, data } of [...records].filter(ok).sort((x, y) => order[x.kind] - order[y.kind])) {
        if (db.outbox[keyOf(kind, id)]?.deleted) continue;
        if (data.deleted) {
          if (kind === "kid" && db.kids[id]) { dropKid(id); changed = true; }
          if (kind === "parent" && db.parents[id]) { delete db.parents[id]; changed = true; }
          if (kind === "attempt" && db.attempts.some((a) => a.id === id)) { db.attempts = db.attempts.filter((a) => a.id !== id); changed = true; }
          continue;
        }
        if (kind === "kid") {
          const k = normKid({ ...data, id });
          if (db.kids[id]) mergeKidInto(db.kids[id], k); else db.kids[id] = k;
          changed = true;
        } else if (kind === "parent") {
          if (!db.parents[id]) { db.parents[id] = normParent({ ...data, id }); changed = true; }
        } else if (kind === "attempt") {
          if (!db.kids[data.kidId] || !Array.isArray(data.items)) continue;
          const mine = db.attempts.find((a) => a.id === id);
          if (mine) {
            Object.assign(mine.seenBy, fixSeen(data.seenBy));
            mine.no = Number(data.no) || mine.no;
            mine.synced = true;
          } else {
            db.attempts.push({ ...normAttempt({ ...data, id }, sanitize), synced: true });
          }
          changed = true;
        }
      }
      db.nextNo = Math.max(Number(db.nextNo) || 1, Number(nextNo) || 1);
      if (changed) {
        db.attempts.sort((x, y) => x.at - y.at);
        numberAttempts(db);
      }
      save();
      return changed;
    },

    /** Re-reads storage, e.g. after another tab changed it. */
    reload() { db = load(); },
  };

  if (typeof module !== "undefined") module.exports = Kids;
  if (typeof window !== "undefined") {
    window.LearnKids = Kids;
    window.addEventListener("storage", (event) => {
      if (event.key !== KEY) return;
      Kids.reload();
      window.dispatchEvent(new CustomEvent("learnkids:change"));
    });
  }
})();
