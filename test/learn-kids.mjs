// Checks docs/learn/kids.js: learners, Claw Points, badges, saved tests and
// backup import, against an in-memory stand-in for localStorage.
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import { join } from "node:path";
import assert from "node:assert/strict";

const source = await readFile(join(import.meta.dirname, "..", "docs", "learn", "kids.js"), "utf8");

function fresh(seed = {}) {
  const data = { ...seed };
  const localStorage = {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
  };
  const module = { exports: {} };
  runInNewContext(source, { module, localStorage, globalThis: { localStorage }, JSON, Math, Date, Object, Array, Number, String, Set, Error });
  return { Kids: module.exports, data };
}

const item = (ok, level = "medium", skill = "convert") =>
  ({ prompt: "Q", visual: "", given: "1 g", answer: "2 g", ok, why: "", steps: ["s"], skill, level });
const attempt = (testId, items) => ({
  topic: "mass", testId, testName: testId, at: Date.now(), durationSec: 60,
  right: items.filter((i) => i.ok).length, total: items.length,
  pct: Math.round((100 * items.filter((i) => i.ok).length) / items.length), items,
});

let { Kids, data } = fresh();

// Learners: adding, same-name reuse, current learner.
const mia = Kids.add("  Mia  ", "😺");
assert.equal(mia.name, "Mia");
assert.equal(Kids.add("mia", "🐯").id, mia.id, "same name picks the existing learner");
const leo = Kids.add("Leo", "🐯");
assert.equal(Kids.current().id, leo.id);
assert.equal(Kids.add("   "), null, "blank names are refused");
assert.equal(Kids.add("Zed", "💣").avatar, Kids.AVATARS[0], "unknown avatars fall back to a cat");

// Practice: points per level, streak bonus every 5, badges.
let streak = 0, last;
for (let i = 0; i < 5; i++) last = Kids.practiceAnswer(mia.id, { ok: true, level: "hard", skill: "scale", streak: ++streak });
assert.equal(last.points, 3 + 5, "5th in a row pays the streak bonus");
assert.equal(Kids.get(mia.id).points, 5 * 3 + 5);
assert.deepEqual(Array.from(last.newBadges, (b) => b.id).sort(), ["whiskers", "yarn"]);
const wrong = Kids.practiceAnswer(mia.id, { ok: false, level: "hard", skill: "scale", streak: 0 });
assert.equal(wrong.points, 0);
assert.equal(Kids.get(mia.id).stats.practiceAnswered, 6);

// Tests: per-level points, finish bonus, purrfect, new best, saved attempt.
const t1 = Kids.finishTest(mia.id, attempt("easy", [item(true, "easy"), item(true, "easy"), item(false, "easy")]));
assert.equal(t1.points, 2 * 2 + 10);
assert.equal(t1.newBest, false, "first try is not a 'new best'");
assert.ok(t1.newBadges.some((b) => b.id === "first-pounce"));
const t2 = Kids.finishTest(mia.id, attempt("easy", [item(true, "easy"), item(true, "easy"), item(true, "easy")]));
assert.equal(t2.points, 3 * 2 + 10 + 25 + 10, "purrfect and new best both pay");
assert.ok(t2.newBadges.some((b) => b.id === "purrfect"));
assert.equal(Kids.get(mia.id).stats.best.easy, 100);
assert.equal(Kids.attempts(mia.id).length, 2);
assert.equal(Kids.attempts(mia.id)[0].pct, 100, "newest first");
assert.equal(Kids.attempts(leo.id).length, 0);
const saved = Kids.attempts(mia.id)[0];
assert.equal(saved.kidName, "Mia");
assert.equal(saved.points, t2.points);

// Ranks.
assert.equal(Kids.rankFor(0).rank.name, "Tiny Kitten");
assert.equal(Kids.rankFor(49).next.name, "Curious Kitten");
assert.equal(Kids.rankFor(50).rank.name, "Curious Kitten");
assert.equal(Kids.rankFor(99999).next, null);

// Everything survives a reload from storage.
const reloaded = fresh(data).Kids;
assert.equal(reloaded.get(mia.id).points, Kids.get(mia.id).points);
assert.equal(reloaded.attempts().length, 2);
assert.equal(reloaded.current().id, Kids.current().id, "the current learner is remembered");

// Export / import: merges, does not duplicate, and runs the sanitizer.
const backup = Kids.exportData();
const other = fresh().Kids;
const seen = [];
const r1 = other.importData(backup, (html) => { seen.push(html); return html.replace(/<script.*?<\/script>/g, ""); });
assert.equal(r1.attemptsAdded, 2);
assert.equal(r1.kidsAdded, 3);
assert.ok(seen.includes("Q"), "stored HTML passes through the sanitizer");
const r2 = other.importData(backup);
assert.equal(r2.attemptsAdded, 0, "importing twice adds nothing");
assert.throws(() => other.importData('{"hello":1}'), /not a learning backup/);

// Grown-ups: separate from learners, no points, can mark any child's test seen.
const mum = Kids.addParent("Mum", "lion-f");
const dad = Kids.addParent("Dad", "bear-m");
assert.equal(Kids.addParent("mum", "wolf-m").id, mum.id, "same name picks the existing grown-up");
assert.equal(Kids.addParent("Nana", "dragon").avatar, "lion-m", "unknown animals fall back");
assert.equal(Kids.addParent(" "), null);
assert.equal(Kids.parents().length, 3);
assert.equal(Kids.list().some((k) => k.name === "Mum"), false, "grown-ups are not learners");
const leoTest = Kids.finishTest(leo.id, attempt("hard", [item(true, "hard")]));
assert.ok(leoTest);
const leoAttempt = Kids.attempts(leo.id)[0];
assert.deepEqual(Object.keys(leoAttempt.seenBy), []);
Kids.markSeen(leoAttempt.id, mum.id);
Kids.markSeen(saved.id, dad.id);
assert.ok(Kids.attempt(leoAttempt.id).seenBy[mum.id] > 0, "any grown-up can review any child");
assert.ok(Kids.attempt(saved.id).seenBy[dad.id] > 0);
Kids.markSeen(leoAttempt.id, "nobody");
assert.equal(Object.keys(Kids.attempt(leoAttempt.id).seenBy).length, 1, "unknown grown-ups are ignored");
const withParents = Kids.exportData();
const third = fresh().Kids;
const r3 = third.importData(withParents);
assert.equal(r3.parentsAdded, 3);
assert.ok(third.attempt(leoAttempt.id).seenBy[mum.id] > 0, "seen marks travel in backups");
Kids.removeParent(mum.id);
assert.equal(Kids.getParent(mum.id), null);
assert.equal(Kids.attempt(leoAttempt.id).seenBy[mum.id], undefined, "removing a grown-up clears their marks");

// Test numbers, filtering and sorting.
{
  const { Kids: K, data: store } = fresh();
  const a = K.add("Amy", "😺"), b = K.add("Ben", "🐯");
  const day = (d, h = 10) => new Date(2026, 9, d, h).getTime();
  const save = (kid, testId, at, pctRight) => {
    const items = Array.from({ length: 4 }, (_, i) => item(i < pctRight, testId === "mixed" ? "hard" : testId));
    const t = attempt(testId, items);
    t.at = at;
    K.finishTest(kid.id, t);
  };
  save(a, "easy", day(1), 4);   // #1
  save(b, "hard", day(2), 1);   // #2
  save(a, "medium", day(3), 2); // #3
  save(b, "easy", day(3, 15), 3); // #4
  const nos = (list) => Array.from(list, (x) => x.no);
  assert.deepEqual(nos(K.findAttempts()), [4, 3, 2, 1], "newest first by default");
  assert.deepEqual(nos(K.findAttempts({ sort: "oldest" })), [1, 2, 3, 4]);
  assert.deepEqual(nos(K.findAttempts({ sort: "number" })), [4, 3, 2, 1]);
  assert.deepEqual(nos(K.findAttempts({ sort: "child" })), [3, 1, 4, 2], "Amy then Ben, newest first within");
  assert.deepEqual(nos(K.findAttempts({ sort: "test" })), [4, 1, 3, 2], "easy, medium, hard");
  assert.deepEqual(nos(K.findAttempts({ sort: "score-high" })), [1, 4, 3, 2]);
  assert.deepEqual(nos(K.findAttempts({ sort: "score-low" })), [2, 3, 4, 1]);
  assert.deepEqual(nos(K.findAttempts({ kidId: a.id })), [3, 1]);
  assert.deepEqual(nos(K.findAttempts({ testId: "easy" })), [4, 1]);
  assert.deepEqual(nos(K.findAttempts({ from: day(2, 0), to: day(3, 12) })), [3, 2], "date range is inclusive");
  assert.deepEqual(nos(K.findAttempts({ no: 2 })), [2]);
  const mumP = K.addParent("Mum", "lion-f");
  K.markSeen(K.findAttempts({ no: 3 })[0].id, mumP.id);
  assert.deepEqual(nos(K.findAttempts({ unseenBy: mumP.id })), [4, 2, 1]);

  // Numbers survive deletion and reloads, and are never reused.
  K.deleteAttempt(K.findAttempts({ no: 4 })[0].id);
  save(a, "hard", day(5), 2);
  assert.deepEqual(nos(K.findAttempts({ sort: "number" })), [5, 3, 2, 1], "a deleted number is not reused");
  const again = fresh(store).Kids;
  assert.deepEqual(nos(again.findAttempts({ sort: "number" })), [5, 3, 2, 1]);

  // Old saves without numbers get them in date order.
  const old = JSON.parse(store["learn:v1"]);
  for (const t of old.attempts) delete t.no;
  delete old.nextNo;
  const migrated = fresh({ "learn:v1": JSON.stringify(old) }).Kids;
  assert.deepEqual(nos(migrated.findAttempts({ sort: "oldest" })), [1, 2, 3, 4]);

  // Importing keeps local numbers; clashing imported ones get new numbers.
  const other = fresh().Kids;
  const c = other.add("Cat", "😸");
  const ct = attempt("easy", [item(true, "easy")]);
  ct.at = day(9);
  other.finishTest(c.id, ct); // #1 on the other device
  K.importData(other.exportData());
  const imported = K.findAttempts({ kidId: c.id })[0];
  assert.equal(imported.no, 6, "clashing #1 becomes the next free number");
  assert.equal(K.findAttempts({ no: 1 })[0].kidName, "Amy", "local #1 is untouched");
}

// Deleting.
Kids.deleteAttempt(saved.id);
assert.equal(Kids.attempts(mia.id).length, 1);
Kids.remove(mia.id);
assert.equal(Kids.get(mia.id), null);
assert.equal(Kids.attempts(mia.id).length, 0, "removing a learner removes their tests");
assert.equal(Kids.attempts().length, 1, "other children's tests stay");

console.log("All learner and reward checks passed.");
