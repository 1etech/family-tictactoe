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

// Deleting.
Kids.deleteAttempt(saved.id);
assert.equal(Kids.attempts(mia.id).length, 1);
Kids.remove(mia.id);
assert.equal(Kids.get(mia.id), null);
assert.equal(Kids.attempts().length, 0, "removing a learner removes their tests");

console.log("All learner and reward checks passed.");
