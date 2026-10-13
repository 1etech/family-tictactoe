// Generates thousands of questions from docs/learn/mass.js and checks each one
// is self-consistent: the stored answer marks itself correct, choices contain
// it, no text renders "undefined"/"NaN", and wrong answers get an explanation.
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import { join } from "node:path";

const source = await readFile(join(import.meta.dirname, "..", "docs", "learn", "mass.js"), "utf8");
const module = { exports: {} };
runInNewContext(source, { module, Math, Number, String, Array, Object, Set, JSON });
const { GENS, make, isCorrect, answerText, givenText, whatWentWrong, buildSet, parseNum, TESTS } = module.exports;

const ROUNDS = 400;
let failures = 0;
const fail = (gen, msg, q) => {
  failures += 1;
  if (failures <= 20) console.error(`✗ ${gen}: ${msg}\n   ${q?.prompt ?? ""}`);
};
const bad = (text) => /undefined|NaN|\[object/.test(text);

for (const gen of GENS) {
  const keys = new Set();
  for (let i = 0; i < ROUNDS; i++) {
    const q = make(gen);
    keys.add(q.key);
    const text = [q.prompt, q.visual ?? "", ...q.steps, answerText(q)].join(" ");
    if (bad(text)) fail(gen.id, `bad text: ${text.match(/.{0,40}(undefined|NaN|\[object).{0,20}/)?.[0]}`, q);
    if (!isCorrect(q, q.answer)) fail(gen.id, "answer does not mark itself correct", q);

    if (q.kind === "mc") {
      if (!q.choices.some((c) => c.v === q.answer)) fail(gen.id, "answer missing from choices", q);
      if (new Set(q.choices.map((c) => c.label)).size !== q.choices.length) fail(gen.id, "duplicate choice labels", q);
      for (const c of q.choices) {
        if (c.v === q.answer) continue;
        const why = whatWentWrong(q, c.v);
        if (!why || bad(why)) fail(gen.id, `no/bad explanation for wrong choice ${c.label}`, q);
      }
    } else if (q.kind === "num") {
      if (!Number.isInteger(q.answer) || q.answer <= 0) fail(gen.id, `answer not a positive whole number: ${q.answer}`, q);
      // What a child types must parse back to the stored answer.
      if (parseNum(String(q.answer)) !== q.answer) fail(gen.id, "typed answer does not parse", q);
      for (const wrong of [q.answer + 1, q.answer * 10, Math.round(q.answer / 10)]) {
        if (wrong === q.answer) continue;
        const why = whatWentWrong(q, wrong);
        if (!why || bad(why)) fail(gen.id, "no/bad explanation for a wrong number", q);
        if (isCorrect(q, wrong)) fail(gen.id, "wrong number marked correct", q);
      }
    } else if (q.kind === "pair") {
      const { big, small } = q.answer;
      if (!Number.isInteger(big) || !Number.isInteger(small) || small >= 1000 || small <= 0) fail(gen.id, "bad pair answer", q);
      const why = whatWentWrong(q, { big, small: small + 1 });
      if (!why || bad(why) || bad(givenText(q, { big, small: 3 }))) fail(gen.id, "bad pair explanation", q);
    }
    if (whatWentWrong(q, null).length < 10) fail(gen.id, "no message for a skipped question", q);
  }
  console.log(`${gen.level.padEnd(6)} ${gen.id.padEnd(15)} ${String(keys.size).padStart(4)} distinct questions`);
}

for (const [id, t] of Object.entries(TESTS)) {
  for (let i = 0; i < 200; i++) {
    const set = buildSet(t.plan);
    const want = t.plan.reduce((n, [, c]) => n + c, 0);
    if (set.length !== want) fail(`test:${id}`, `has ${set.length} questions, wanted ${want}`);
    if (new Set(set.map((q) => q.key)).size !== set.length) fail(`test:${id}`, "repeated a question");
  }
}

// Spot checks on the parser children will hit.
const parses = [["2450", 2450], [" 2 450 ", 2450], ["2,450", 2450], ["abc", null], ["", null], ["-5", null]];
for (const [input, want] of parses) if (parseNum(input) !== want) fail("parseNum", `${JSON.stringify(input)} -> ${parseNum(input)}`);

if (failures) {
  console.error(`\n${failures} problem(s).`);
  process.exit(1);
}
console.log("\nAll question checks passed.");
