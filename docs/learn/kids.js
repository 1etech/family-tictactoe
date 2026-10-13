// Learners, saved tests and Claw Point rewards for the Learn tab.
//
// Everything lives in this browser's localStorage under one key. Nothing is
// sent anywhere, which also means results stay on the device the children use;
// export/import moves them to another device.
(() => {
  "use strict";

  const KEY = "learn:v1";
  const MAX_ATTEMPTS = 400;
  const MAX_LOG = 40;

  const AVATARS = ["🐱", "😺", "😸", "😻", "🐈", "🐈‍⬛", "🐯", "🦁"];

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
  const BADGES = [
    { id: "first-pounce", icon: "🐾", name: "First Pounce", how: "Finish your first test", earned: (k) => Object.keys(k.stats.tests).length > 0 },
    { id: "curious", icon: "😺", name: "Curious Kitten", how: "Answer 10 practice questions", earned: (k) => k.stats.practiceAnswered >= 10 },
    { id: "yarn", icon: "🧶", name: "Yarn Ball Streak", how: "Get 5 practice answers right in a row", earned: (k) => k.stats.bestStreak >= 5 },
    { id: "nine-lives", icon: "🐈", name: "Nine Lives", how: "Get 9 practice answers right in a row", earned: (k) => k.stats.bestStreak >= 9 },
    { id: "whiskers", icon: "⚖️", name: "Scale Whiskers", how: "Read 5 scales correctly", earned: (k) => skill(k, "scale") >= 5 },
    { id: "mouse", icon: "🐭", name: "Mouse Catcher", how: "Get 10 unit changes right", earned: (k) => skill(k, "convert") >= 10 },
    { id: "purrfect", icon: "😻", name: "Purrfect Score", how: "Get 100% on any test", earned: (k) => Object.values(k.stats.best).some((p) => p === 100) },
    { id: "lion-heart", icon: "🦁", name: "Lion Heart", how: "Score 70% or more on the Hard test", earned: (k) => (k.stats.best.hard || 0) >= 70 },
    { id: "tiger", icon: "🐯", name: "Tiger Tester", how: "Finish all four tests", earned: (k) => ["easy", "medium", "hard", "mixed"].every((t) => k.stats.tests[t]) },
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
  const blank = () => ({ kids: {}, attempts: [], current: null });

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
      Object.values(data.kids).forEach(fixKid);
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
    save();
    return { points, lines: lines.filter(([p]) => p), newBadges, rankUp: after !== before ? after : null };
  }

  // --- public API ----------------------------------------------------------
  const Kids = {
    AVATARS, RANKS, BADGES, POINTS, rankFor,
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
      }
      db.current = kid.id;
      save();
      return kid;
    },

    remove(id) {
      delete db.kids[id];
      db.attempts = db.attempts.filter((a) => a.kidId !== id);
      if (db.current === id) db.current = null;
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
      Object.assign(attempt, { id: uid(), kidId: kid.id, kidName: kid.name, avatar: kid.avatar });

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
      db.attempts.push(attempt);
      save();
      return { ...result, newBest };
    },

    /** Saved tests, newest first. */
    attempts: (kidId) => db.attempts.filter((a) => !kidId || a.kidId === kidId).slice().reverse(),
    attempt: (id) => db.attempts.find((a) => a.id === id) || null,
    deleteAttempt(id) { db.attempts = db.attempts.filter((a) => a.id !== id); save(); },

    exportData: () => JSON.stringify({ app: "family-tictactoe-learn", version: 1, exported: new Date().toISOString(), kids: db.kids, attempts: db.attempts }, null, 1),

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
        const k = fixKid({
          ...incoming,
          name: clean(incoming.name, 20) || "Learner",
          avatar: AVATARS.includes(incoming.avatar) ? incoming.avatar : AVATARS[0],
          log: (Array.isArray(incoming.log) ? incoming.log : []).map((l) => ({ at: Number(l.at) || 0, pts: Number(l.pts) || 0, why: clean(l.why, 60) })),
        });
        const mine = db.kids[k.id];
        if (!mine) { db.kids[k.id] = k; kidsAdded++; continue; }
        mine.points = Math.max(mine.points, k.points);
        Object.assign(mine.badges, k.badges);
        for (const f of ["practiceAnswered", "practiceRight", "bestStreak"]) mine.stats[f] = Math.max(mine.stats[f], k.stats[f]);
        for (const f of ["skillRight", "tests", "best"]) {
          for (const [key, v] of Object.entries(k.stats[f])) mine.stats[f][key] = Math.max(mine.stats[f][key] || 0, Number(v) || 0);
        }
      }
      const have = new Set(db.attempts.map((a) => a.id));
      for (const a of data.attempts) {
        if (!a || typeof a.id !== "string" || have.has(a.id) || !db.kids[a.kidId] || !Array.isArray(a.items)) continue;
        db.attempts.push({
          id: a.id, kidId: a.kidId, kidName: clean(a.kidName, 20), avatar: AVATARS.includes(a.avatar) ? a.avatar : AVATARS[0],
          topic: clean(a.topic, 30), testId: clean(a.testId, 20), testName: clean(a.testName, 40),
          at: Number(a.at) || 0, durationSec: Number(a.durationSec) || 0, points: Number(a.points) || 0,
          right: Number(a.right) || 0, total: Number(a.total) || 0, pct: Number(a.pct) || 0,
          items: a.items.map((i) => ({
            prompt: sanitize(String(i.prompt ?? "")), visual: i.visual ? sanitize(String(i.visual)) : "",
            given: clean(i.given, 80), answer: clean(i.answer, 80), ok: !!i.ok,
            why: i.why ? sanitize(String(i.why)) : "", steps: (Array.isArray(i.steps) ? i.steps : []).map((s) => sanitize(String(s))),
            skill: clean(i.skill, 20), level: clean(i.level, 10),
          })),
        });
        attemptsAdded++;
      }
      db.attempts.sort((x, y) => x.at - y.at);
      save();
      return { kidsAdded, attemptsAdded };
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
