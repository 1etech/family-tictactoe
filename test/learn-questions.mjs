// Generates thousands of questions from every topic in docs/learn/ and checks
// each one is self-consistent: the stored answer marks itself correct, choices
// contain it, no text renders "undefined"/"NaN", and wrong answers get an
// explanation.
import { readFile } from "node:fs/promises";
import { createContext, runInContext } from "node:vm";
import { join } from "node:path";

const context = createContext({ Math, Number, String, Array, Object, Set, JSON });
context.globalThis = context;
for (const file of ["common.js", "mass.js", "length.js"]) {
  runInContext(await readFile(join(import.meta.dirname, "..", "docs", "learn", file), "utf8"), context, { filename: file });
}
const { make, isCorrect, answerText, givenText, whatWentWrong, buildSet, parseNum, topics } = context.LearnCommon;

const ROUNDS = 400;
let failures = 0;
const fail = (gen, msg, q) => {
  failures += 1;
  if (failures <= 20) console.error(`✗ ${gen}: ${msg}\n   ${q?.prompt ?? ""}`);
};
const bad = (text) => /undefined|NaN|\[object/.test(text);

const ids = Array.from(topics, (t) => t.id).join(",");
if (ids !== "mass,length") fail("topics", `registered ${ids}`);

for (const topic of topics) {
console.log(`
${topic.icon} ${topic.name}`);
const testIds = new Set();
for (const gen of topic.GENS) {
  const keys = new Set();
  for (let i = 0; i < ROUNDS; i++) {
    const q = make(gen, topic);
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
for (const level of ["easy", "medium", "hard"]) {
  if (!topic.GENS.some((g) => g.level === level)) fail(topic.id, `no ${level} questions`);
}
for (const field of ["id", "number", "icon", "name", "noun", "unitWords", "levelBlurb", "lessonHTML", "wireLesson"]) {
  if (!topic[field]) fail(topic.id, `missing ${field}`);
}
for (const skill of new Set(topic.GENS.map((g) => g.skill))) {
  if (!topic.SKILLS[skill] || !topic.GENERIC[skill]) fail(topic.id, `skill ${skill} has no name or advice`);
}

for (const [id, t] of Object.entries(topic.TESTS)) {
  // Test ids are saved with results: mass keeps its original ids, later topics are prefixed.
  if (topic.id !== "mass" && !id.startsWith(`${topic.id}-`)) fail(topic.id, `test id ${id} is not prefixed`);
  if (testIds.has(id)) fail(topic.id, `duplicate test id ${id}`);
  testIds.add(id);
  for (let i = 0; i < 200; i++) {
    const set = buildSet(topic, t.plan);
    const want = t.plan.reduce((n, [, c]) => n + c, 0);
    if (set.length !== want) fail(`test:${id}`, `has ${set.length} questions, wanted ${want}`);
    if (new Set(set.map((q) => q.key)).size !== set.length) fail(`test:${id}`, "repeated a question");
  }
}
}

// Length's classic mistakes get the specific explanation, not the generic one.
{
  const length = topics.find((t) => t.id === "length");
  const find = (genId, test) => {
    const gen = length.GENS.find((g) => g.id === genId);
    for (let i = 0; i < 2000; i++) { const q = make(gen, length); const m = test(q); if (m) return [q, m]; }
    fail(genId, "could not find a matching question");
    return [null, null];
  };
  const expect = (label, q, given, pattern) => {
    if (q && !pattern.test(whatWentWrong(q, given))) fail(label, `expected ${pattern} for ${JSON.stringify(given)}, got: ${whatWentWrong(q, given)}`, q);
  };
  let [q, m] = find("zero-to-small", (q) => q.prompt.match(/<b>(\d) m (\d) cm<\/b>/));
  if (q) expect("3 m 5 cm -> 35", q, Number(m[1] + m[2]), /Watch the zeros/);
  [q, m] = find("m-cm", (q) => q.prompt.match(/<b>(\d) m<\/b>/));
  if (q) expect("m -> cm x1000", q, Number(m[1]) * 1000, /multiplied by 1000.*<b>100<\/b>/);
  [q, m] = find("ruler-hard", (q) => q.unit === "mm" && q.key.match(/-(\d+)-(\d+)-mm$/));
  if (q) expect("ruler read the end", q, Number(m[2]), /starts at/);
  [q, m] = find("big-jump", (q) => q.prompt.match(/<b>(\d)\.5 m<\/b>/));
  if (q) expect("2.5 m -> 25", q, Number(m[1] + "5"), /decimal point/);
  [q, m] = find("cm-mm", (q) => q.prompt.match(/<b>(\d+) cm<\/b>/));
  if (q) expect("cm -> mm x100", q, Number(m[1]) * 100, /multiplied by 100.*<b>10<\/b>/);
}

// Spot checks on the parser children will hit.
const parses = [["2450", 2450], [" 2 450 ", 2450], ["2,450", 2450], ["abc", null], ["", null], ["-5", null]];
for (const [input, want] of parses) if (parseNum(input) !== want) fail("parseNum", `${JSON.stringify(input)} -> ${parseNum(input)}`);

if (failures) {
  console.error(`\n${failures} problem(s).`);
  process.exit(1);
}
console.log("\nAll question checks passed.");
