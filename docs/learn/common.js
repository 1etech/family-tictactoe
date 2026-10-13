// Shared pieces for the Learn tab: small helpers, answer marking, test
// building and the list of topics. Each topic file (mass.js, length.js, …)
// registers itself here; app.js draws whichever topic is chosen.
(() => {
  "use strict";

  const rand = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));
  const pick = (list) => list[Math.floor(Math.random() * list.length)];
  const shuffle = (list) => {
    const a = [...list];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const fmt = (n) => (Math.abs(n) >= 10000 ? n.toLocaleString("en-AU") : String(n));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

  /** A bar split into equal parts, some of them shaded. */
  function fractionBar(parts, on, labelEach) {
    const cells = Array.from({ length: parts }, (_, i) =>
      `<div class="${i < on ? "on" : ""}">${parts <= 4 ? labelEach : ""}</div>`).join("");
    return `<div class="fbar" aria-hidden="true">${cells}</div>`;
  }

  // --- answers -------------------------------------------------------------
  const parseNum = (text) => {
    const t = String(text ?? "").replace(/[\s,]/g, "");
    return /^\d+(\.\d+)?$/.test(t) ? Number(t) : null;
  };

  /** Builds one question from a generator; `topic` supplies the fallback advice. */
  function make(gen, topic) {
    const q = gen.make();
    q.level = gen.level;
    q.gen = gen.id;
    q.topic = topic.id;
    q.skill = q.skill || gen.skill;
    q.fallback = topic.GENERIC[q.skill];
    q.key = q.key || q.prompt + (q.visual || "") + (q.choices ? q.choices.map((c) => c.label).sort().join("|") : "");
    return q;
  }

  function isCorrect(q, given) {
    if (given == null) return false;
    if (q.kind === "pair") return given.big === q.answer.big && given.small === q.answer.small;
    return given === q.answer;
  }

  function answerText(q) {
    if (q.kind === "mc") return q.choices.find((c) => c.v === q.answer).label;
    if (q.kind === "pair") return `${q.answer.big} ${q.labels[0]} ${q.answer.small} ${q.labels[1]}`;
    return `${fmt(q.answer)} ${q.unit}`;
  }

  function givenText(q, given) {
    if (given == null) return "no answer";
    if (q.kind === "mc") return (q.choices.find((c) => c.v === given) || { label: given }).label;
    if (q.kind === "pair") return `${given.big} ${q.labels[0]} ${given.small} ${q.labels[1]}`;
    return `${fmt(given)} ${q.unit}`;
  }

  function whatWentWrong(q, given) {
    if (given == null) return "You didn't answer this one. Have a go next time — a guess is better than nothing!";
    return (q.diagnose && q.diagnose(given)) || q.fallback;
  }

  /** A test: `plan` is [[level, count], ...]. Uses every generator before repeating one. */
  function buildSet(topic, plan) {
    const out = [], seen = new Set();
    for (const [level, count] of plan) {
      const gens = topic.GENS.filter((g) => g.level === level);
      let order = [];
      for (let i = 0; i < count; i++) {
        if (!order.length) order = shuffle(gens);
        const gen = order.pop();
        let q, tries = 0;
        do q = make(gen, topic); while (seen.has(q.key) && ++tries < 25);
        seen.add(q.key);
        out.push(q);
      }
    }
    return out;
  }

  // --- topics --------------------------------------------------------------
  const topics = [];
  /** Topic fields: id, number, icon, name, subtitle, GENS, SKILLS, GENERIC, TESTS, levelBlurb, lessonHTML, wireLesson. */
  function register(topic) {
    topics.push(topic);
    topics.sort((a, b) => a.number - b.number);
  }
  const topic = (id) => topics.find((t) => t.id === id) || null;

  /** Which topic a saved test belongs to; tests saved before topics existed are mass. */
  const topicOf = (attempt) => topic(attempt.topic) || topic("mass");

  globalThis.LearnCommon = {
    rand, pick, shuffle, cap, fmt, esc, plural, fractionBar,
    parseNum, make, isCorrect, answerText, givenText, whatWentWrong, buildSet,
    LEVEL_NAME: { easy: "Easy", medium: "Medium", hard: "Hard" },
    PRAISE: ["Correct!", "Well done!", "Spot on!", "Great work!", "You got it!", "Brilliant!"],
    topics, register, topic, topicOf,
  };
})();
