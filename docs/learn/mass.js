// Topic 1 for the Learn tab (Year 4, Victorian Curriculum, Measurement):
// mass in mg, g, kg and t. Questions are generated, so every practice round
// and every test is different. Masses are worked in whole numbers of the
// smaller unit (grams, mostly) so there is no floating-point drift.
(() => {
  "use strict";

  const C = globalThis.LearnCommon;
  const { rand, pick, shuffle, cap, fmt, esc, plural, fractionBar, parseNum } = C;

  /** 2450 -> "2 kg 450 g" (or any big/small pair that differs by 1000). */
  function mixed(n, big = "kg", small = "g") {
    const a = Math.floor(n / 1000), b = n % 1000;
    if (a && b) return `${a} ${big} ${b} ${small}`;
    return a ? `${a} ${big}` : `${b} ${small}`;
  }
  const kgg = (grams) => mixed(grams, "kg", "g");

  const UNITS = ["mg", "g", "kg", "t"];
  const UNIT_NAME = { mg: "milligrams (mg)", g: "grams (g)", kg: "kilograms (kg)", t: "tonnes (t)" };
  const UNIT_WORD = { mg: "milligrams", g: "grams", kg: "kilograms", t: "tonnes" };
  const UNIT_ONE = { mg: "milligram", g: "gram", kg: "kilogram", t: "tonne" };
  const UNIT_WHY = {
    mg: "Things lighter than a paperclip (about 1 g) are measured in milligrams.",
    g: "Things you can hold in one hand, lighter than a 1 litre bottle of water (1 kg), are measured in grams.",
    kg: "Things heavier than a 1 litre bottle of water, that a person could still lift or carry, are measured in kilograms.",
    t: "Things far too heavy for people to lift, like trucks and very big animals, are measured in tonnes.",
  };

  const THINGS = [
    { e: "🐜", name: "an ant", num: 3, unit: "mg" },
    { e: "🦟", name: "a mosquito", num: 2, unit: "mg" },
    { e: "🍚", name: "one grain of rice", num: 25, unit: "mg" },
    { e: "🪶", name: "a small feather", num: 50, unit: "mg" },
    { e: "📎", name: "a paperclip", num: 1, unit: "g" },
    { e: "✏️", name: "a pencil", num: 6, unit: "g" },
    { e: "🪙", name: "a $1 coin", num: 9, unit: "g" },
    { e: "🐭", name: "a mouse", num: 20, unit: "g" },
    { e: "🥚", name: "an egg", num: 60, unit: "g" },
    { e: "🍌", name: "a banana", num: 120, unit: "g" },
    { e: "🍎", name: "an apple", num: 150, unit: "g" },
    { e: "🐈", name: "a cat", num: 4, unit: "kg" },
    { e: "🍉", name: "a watermelon", num: 5, unit: "kg" },
    { e: "🚲", name: "a bike", num: 12, unit: "kg" },
    { e: "🐕", name: "a dog", num: 20, unit: "kg" },
    { e: "🧒", name: "a Year 4 student", num: 30, unit: "kg" },
    { e: "🦘", name: "a kangaroo", num: 60, unit: "kg" },
    { e: "🦛", name: "a hippo", num: 2, unit: "t" },
    { e: "🐘", name: "an elephant", num: 5, unit: "t" },
    { e: "🚚", name: "a truck", num: 10, unit: "t" },
    { e: "🚌", name: "a bus", num: 12, unit: "t" },
    { e: "🐋", name: "a blue whale", num: 150, unit: "t" },
  ];

  // --- pictures ------------------------------------------------------------
  /**
   * A round kitchen-scale dial. All values are in grams; `label` turns a value
   * into the number printed on the face (grams, or kilograms on big scales).
   */
  function dialSVG({ max, major, minor, value, unitWord, label }) {
    const cx = 120, cy = 136, R = 92;
    const ang = (v) => ((-135 + (270 * v) / max) * Math.PI) / 180;
    const pt = (v, r) => [cx + r * Math.sin(ang(v)), cy - r * Math.cos(ang(v))].map((n) => n.toFixed(1));
    let marks = "";
    for (let v = 0; v <= max; v += minor) {
      const big = v % major === 0;
      const [x1, y1] = pt(v, R - 5), [x2, y2] = pt(v, R - (big ? 20 : 12));
      marks += `<line class="dial-tick" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke-width="${big ? 3 : 1.6}"/>`;
      if (big) {
        const [lx, ly] = pt(v, R - 40);
        marks += `<text class="svg-ink" x="${lx}" y="${ly}" font-size="14" font-weight="700" text-anchor="middle" dominant-baseline="central">${label(v)}</text>`;
      }
    }
    const [nx, ny] = pt(value, R - 14);
    return `<svg viewBox="0 0 240 252" role="img" aria-label="Kitchen scale dial marked from 0 to ${label(max)} ${unitWord}">
      <rect class="dial-pan" x="44" y="2" width="152" height="12" rx="6"/>
      <rect class="dial-pan" x="112" y="12" width="16" height="18"/>
      <rect class="dial-body" x="8" y="28" width="224" height="220" rx="30"/>
      <circle class="dial-face" cx="${cx}" cy="${cy}" r="${R}"/>
      ${marks}
      <text class="svg-muted" x="${cx}" y="${cy + 48}" font-size="13" text-anchor="middle">${unitWord}</text>
      <line class="dial-needle" x1="${cx}" y1="${cy}" x2="${nx}" y2="${ny}"/>
      <circle class="dial-cap" cx="${cx}" cy="${cy}" r="7"/>
    </svg>`;
  }

  /** A pan balance; a negative tilt drops the left pan (left is heavier). */
  function balanceSVG(left, right, tilt, caption) {
    const cx = 190, cy = 62, L = 135, t = (Math.abs(tilt) * Math.PI) / 180;
    const dx = L * Math.cos(t), drop = L * Math.sin(t) * Math.sign(-tilt);
    const ends = [[cx - dx, cy + drop, left], [cx + dx, cy - drop, right]];
    const pans = ends.map(([x, y, e]) => `
      <line class="beam-thin" x1="${x}" y1="${y}" x2="${x - 30}" y2="${y + 42}"/>
      <line class="beam-thin" x1="${x}" y1="${y}" x2="${x + 30}" y2="${y + 42}"/>
      <path class="dial-pan" d="M${x - 40} ${y + 42} Q${x} ${y + 64} ${x + 40} ${y + 42} Z"/>
      <text x="${x}" y="${y + 38}" font-size="38" text-anchor="middle">${e}</text>`).join("");
    return `<svg class="balance" viewBox="0 0 380 200" role="img" aria-label="${esc(caption)}">
      <rect class="stand" x="${cx - 50}" y="182" width="100" height="10" rx="5"/>
      <rect class="stand" x="${cx - 4}" y="${cy}" width="8" height="122"/>
      <line class="beam" x1="${ends[0][0]}" y1="${ends[0][1]}" x2="${ends[1][0]}" y2="${ends[1][1]}"/>
      <circle class="dial-cap" cx="${cx}" cy="${cy}" r="7"/>
      ${pans}
    </svg>`;
  }

  /** Place-value chart showing where the big unit ends and the small unit starts. */
  function pvChart(n, big = "kg", small = "g") {
    const digits = String(n).padStart(4, "0").split("");
    return `<div class="pv" role="img" aria-label="${n} ${small} is ${mixed(n, big, small)}">
      <div class="h kg">1000s</div><div class="h g">100s</div><div class="h g">10s</div><div class="h g">1s</div>
      ${digits.map((d, i) => `<div class="d ${i === 0 ? "kg" : "g"}">${d}</div>`).join("")}
      <div class="lab kgl">${big}</div><div class="lab gl">${small}</div>
    </div>`;
  }

  // --- question building blocks -------------------------------------------
  /** Spots the classic conversion slips: ×100, ×10, wrong direction, no change. */
  function convDiag(given, start, dir, from, to) {
    const small = dir === "down" ? to : from, big = dir === "down" ? from : to;
    if (given === start) return "You wrote the same number. The unit changed, so the number has to change too.";
    if (dir === "down") {
      if (given === start * 100) return `You multiplied by 100. There are <b>1000</b> ${small} in 1 ${big}, so multiply by 1000.`;
      if (given === start * 10) return `You multiplied by 10. There are <b>1000</b> ${small} in 1 ${big}, so multiply by 1000.`;
      if (given === start * 10000) return "Too many zeros. Multiply by 1000 — that is three zeros, not four.";
      if (given * 1000 === start || given === start / 1000) return `You divided, but ${UNIT_WORD[small]} are a smaller unit, so the number should get <b>bigger</b>. Multiply by 1000.`;
    } else {
      if (given === start / 100) return `You divided by 100. There are <b>1000</b> ${small} in 1 ${big}, so divide by 1000.`;
      if (given === start / 10) return `You divided by 10. There are <b>1000</b> ${small} in 1 ${big}, so divide by 1000.`;
      if (given === start * 1000) return `You multiplied, but ${UNIT_WORD[big]} are a bigger unit, so the number should get <b>smaller</b>. Divide by 1000.`;
    }
    return null;
  }

  /** One-step change between neighbouring units, e.g. kg -> g or g -> kg. */
  function simpleConv(n, from, to) {
    const dir = UNITS.indexOf(to) < UNITS.indexOf(from) ? "down" : "up";
    const answer = dir === "down" ? n * 1000 : n / 1000;
    const steps = dir === "down"
      ? [
          `1 ${from} = 1000 ${to}.`,
          `${cap(UNIT_WORD[to])} are a <b>smaller</b> unit, so the number gets <b>bigger</b>: multiply by 1000.`,
          `${fmt(n)} × 1000 = ${fmt(answer)}`,
          `So ${fmt(n)} ${from} = <b>${fmt(answer)} ${to}</b>.`,
        ]
      : [
          `1000 ${from} = 1 ${to}.`,
          `${cap(UNIT_WORD[to])} are a <b>bigger</b> unit, so the number gets <b>smaller</b>: divide by 1000.`,
          `${fmt(n)} ÷ 1000 = ${fmt(answer)}`,
          `So ${fmt(n)} ${from} = <b>${fmt(answer)} ${to}</b>.`,
        ];
    return {
      skill: "convert",
      prompt: `Change <b>${fmt(n)} ${from}</b> into ${UNIT_WORD[to]}.`,
      kind: "num", unit: to, answer, steps,
      diagnose: (g) => convDiag(g, n, dir, from, to),
    };
  }

  /** "2 kg 450 g = ? g" */
  function mixToSmall(a, b, big, small) {
    const answer = a * 1000 + b;
    const concat = Number(`${a}${b}`);
    const steps = [
      `Change the ${UNIT_WORD[big]} first: ${a} ${big} = ${a} × 1000 = ${a * 1000} ${small}.`,
      `Now add the ${UNIT_WORD[small]}: ${a * 1000} + ${b} = ${answer}.`,
    ];
    if (b < 100) {
      steps.push(`Watch the zero${b < 10 ? "s" : ""}! ${b} ${small} only fills the ${b < 10 ? "ones place, so the hundreds and tens places need zeros" : "tens and ones places, so the hundreds place needs a 0"}.`);
    }
    steps.push(`Check with place value: ${pvChart(answer, big, small)}`, `So ${a} ${big} ${b} ${small} = <b>${answer} ${small}</b>.`);
    return {
      skill: "convert",
      prompt: `Change <b>${a} ${big} ${b} ${small}</b> into ${UNIT_WORD[small]}.`,
      kind: "num", unit: small, answer, steps,
      diagnose: (g) => {
        if (b < 100 && g === concat) return `Watch the zeros! You wrote ${a} and ${b} side by side. ${a} ${big} is ${a * 1000} ${small}, then add ${b} to get ${answer}.`;
        if (g === a * 100 + b) return `You changed ${a} ${big} into ${a * 100} ${small}. Remember 1 ${big} = 1000 ${small}, so ${a} ${big} = ${a * 1000} ${small}.`;
        if (g === a + b) return `You added ${a} and ${b} straight away. Change ${a} ${big} into ${UNIT_WORD[small]} (${a * 1000} ${small}) first, then add.`;
        if (g === a * 1000) return `You changed the ${UNIT_WORD[big]} correctly but forgot to add the ${b} ${small}.`;
        if (g === b) return `You forgot the ${a} ${big}. That is another ${a * 1000} ${small} to add on.`;
        if (b < 100 && g === a * 1000 + b * 10) return `The ${b} ${small} slipped one place to the left. ${b} sits in the ${b < 10 ? "ones" : "tens and ones"}: ${answer}.`;
        return null;
      },
    };
  }

  /** "2450 g = ? kg ? g" */
  function smallToPair(a, b, big, small) {
    const n = a * 1000 + b;
    return {
      skill: "convert",
      prompt: `Write <b>${n} ${small}</b> in ${UNIT_WORD[big]} and ${UNIT_WORD[small]}.`,
      kind: "pair", labels: [big, small], answer: { big: a, small: b },
      steps: [
        `1000 ${small} = 1 ${big}, so the <b>thousands</b> digit tells you the ${UNIT_WORD[big]}.`,
        `${n} has ${a} thousand${a > 1 ? "s" : ""} → <b>${a} ${big}</b>.`,
        `The last three digits are the ${UNIT_WORD[small]} left over: ${String(b).padStart(3, "0")} → <b>${b} ${small}</b>.`,
        pvChart(n, big, small),
        `So ${n} ${small} = <b>${a} ${big} ${b} ${small}</b>.`,
      ],
      diagnose: ({ big: gb, small: gs }) => {
        if (gb === a && gs !== b) return `The ${UNIT_WORD[big]} are right. The ${UNIT_WORD[small]} are the last three digits: ${String(b).padStart(3, "0")}, which is ${b} ${small}.`;
        if (gb === Math.floor(n / 100)) return `You split the number in the wrong place. Only the thousands digit is ${UNIT_WORD[big]}: ${a} ${big}, and the rest is ${b} ${small}.`;
        if (gs === b && gb !== a) return `The ${UNIT_WORD[small]} are right. The ${UNIT_WORD[big]} are the thousands digit: ${a}.`;
        return null;
      },
    };
  }

  /** A dial question. Values in grams; `kgLabels` prints kilograms on the face. */
  function scaleQ({ max, major, minor, value, kgLabels, answerUnit }) {
    const label = kgLabels ? (v) => String(v / 1000) : (v) => String(v);
    const show = (g) => (kgLabels ? kgg(g) : `${g} g`);
    const last = Math.floor(value / major) * major;
    const k = (value - last) / minor, spaces = major / minor;
    const answer = answerUnit === "kg" ? value / 1000 : value;
    const steps = [];
    if (k === 0) {
      steps.push("Look at where the needle points.", `It points exactly at the big number <b>${label(value)}</b>${kgLabels ? " (kilograms)" : " (grams)"}.`);
    } else {
      steps.push(
        `The big numbers go up by ${show(major)}.`,
        `Between two big numbers there are ${spaces} spaces, so each small mark is ${show(major)} ÷ ${spaces} = <b>${show(minor)}</b>.`,
        `The needle is ${plural(k, "small mark")} past ${show(last)}: ${k} × ${show(minor)} = ${show(k * minor)}.`,
        `${show(last)} + ${show(k * minor)} = ${show(value)}.`,
      );
    }
    steps.push(`So the scale shows <b>${fmt(answer)} ${answerUnit}</b>${answerUnit === "g" && value >= 1000 ? ` (that is ${kgg(value)})` : ""}.`);
    return {
      skill: "scale",
      key: `scale-${max}-${major}-${minor}-${value}-${answerUnit}`,
      prompt: `What mass does the scale show? Answer in ${answerUnit === "kg" ? "kilograms" : "grams"}.`,
      visual: dialSVG({ max, major, minor, value, unitWord: kgLabels ? "kilograms" : "grams", label }),
      kind: "num", unit: answerUnit, answer, steps,
      diagnose: (g) => {
        if (answerUnit === "g" && kgLabels && g === value / 1000) return `The numbers on this scale are kilograms, but the question asks for grams. ${kgg(value)} = ${value} g.`;
        const grams = answerUnit === "kg" ? g * 1000 : g;
        if (k && grams === last) return `You read the big number before the needle (${show(last)}) but forgot the ${plural(k, "small mark")} after it.`;
        if (k && grams === last + major) return `The needle has not reached ${show(last + major)} yet. It is ${plural(k, "small mark")} past ${show(last)}.`;
        for (const wrong of [10, 50, 100, 200, 250, 500]) {
          if (k && wrong !== minor && grams === last + k * wrong) return `You counted each small mark as ${show(wrong)}. On this scale each small mark is worth ${show(minor)}.`;
        }
        return null;
      },
    };
  }

  // --- the question generators ---------------------------------------------
  const unitChoices = UNITS.map((u) => ({ v: u, label: UNIT_NAME[u] }));

  const GENS = [
    // ---------------- easy
    {
      id: "unit-choice", level: "easy", skill: "unit",
      make() {
        const t = pick(THINGS);
        return {
          prompt: `Which unit is best for measuring the mass of ${t.name}?`,
          visual: `<span class="emoji" aria-hidden="true">${t.e}</span>`,
          kind: "mc", choices: unitChoices, answer: t.unit,
          steps: [
            `${cap(t.name)} has a mass of about ${t.num} ${t.unit}.`,
            UNIT_WHY[t.unit],
            `So the best unit is <b>${UNIT_NAME[t.unit]}</b>.`,
          ],
          diagnose: (g) => (UNITS.indexOf(g) > UNITS.indexOf(t.unit)
            ? `${cap(UNIT_WORD[g])} are too big for ${t.name} — you would only need a tiny part of one.`
            : `${cap(UNIT_WORD[g])} are too small for ${t.name} — you would need a huge number of them.`),
        };
      },
    },
    { id: "kg-to-g", level: "easy", skill: "convert", make: () => simpleConv(rand(1, 9), "kg", "g") },
    { id: "g-to-kg", level: "easy", skill: "convert", make: () => simpleConv(rand(2, 9) * 1000, "g", "kg") },
    {
      id: "other-conv", level: "easy", skill: "convert",
      make() {
        const n = rand(1, 9);
        return pick([
          () => simpleConv(n, "t", "kg"),
          () => simpleConv(n, "g", "mg"),
          () => simpleConv(n * 1000, "kg", "t"),
          () => simpleConv(n * 1000, "mg", "g"),
        ])();
      },
    },
    {
      id: "same-number", level: "easy", skill: "compare",
      make() {
        const n = rand(2, 9);
        const [a, b] = shuffle(UNITS).slice(0, 2);
        const heavy = UNITS.indexOf(a) > UNITS.indexOf(b) ? a : b;
        const light = heavy === a ? b : a;
        return {
          prompt: "Which is heavier?",
          kind: "mc", choices: [a, b].map((u) => ({ v: u, label: `${n} ${u}` })), answer: heavy,
          steps: [
            `Both masses have the number ${n}, so the <b>unit</b> decides.`,
            "From smallest to biggest the units go: mg → g → kg → t.",
            `${cap(UNIT_WORD[heavy])} are bigger than ${UNIT_WORD[light]}, so <b>${n} ${heavy}</b> is heavier.`,
          ],
          diagnose: () => `Same number, but ${n} ${light} uses a smaller unit. A bigger unit means more mass.`,
        };
      },
    },
    {
      id: "scale-easy", level: "easy", skill: "scale",
      make() {
        return Math.random() < 0.5
          ? scaleQ({ max: 5000, major: 1000, minor: 1000, value: rand(1, 5) * 1000, kgLabels: true, answerUnit: "kg" })
          : scaleQ({ max: 1000, major: 200, minor: 200, value: rand(1, 4) * 200, answerUnit: "g" });
      },
    },

    // ---------------- medium
    {
      id: "mix-to-small", level: "medium", skill: "convert",
      make() {
        const [big, small] = pick([["kg", "g"], ["kg", "g"], ["kg", "g"], ["t", "kg"], ["g", "mg"]]);
        return mixToSmall(rand(1, 8), rand(1, 9) * 100 + pick([0, 0, 50, 25, 75]), big, small);
      },
    },
    {
      id: "small-to-pair", level: "medium", skill: "convert",
      make() {
        const [big, small] = pick([["kg", "g"], ["kg", "g"], ["kg", "g"], ["t", "kg"], ["g", "mg"]]);
        return smallToPair(rand(1, 8), rand(1, 9) * 100 + pick([0, 0, 50, 25, 75]), big, small);
      },
    },
    {
      id: "fraction", level: "medium", skill: "convert",
      make() {
        const f = pick([
          { w: "half", s: "½", d: 2, n: 1 },
          { w: "a quarter", s: "¼", d: 4, n: 1 },
          { w: "three quarters", s: "¾", d: 4, n: 3 },
          { w: "one tenth", s: "1/10", d: 10, n: 1 },
        ]);
        const tonne = Math.random() < 0.25;
        const big = tonne ? "t" : "kg", small = tonne ? "kg" : "g";
        const part = 1000 / f.d, answer = part * f.n;
        const steps = [`1 ${big} = 1000 ${small}.`];
        if (f.n === 1) {
          steps.push(`${cap(f.w)} means split it into ${f.d} equal parts: 1000 ÷ ${f.d} = ${part}.`);
        } else {
          steps.push(`One quarter: 1000 ÷ 4 = ${part}.`, `Three quarters: 3 × ${part} = ${answer}.`);
        }
        steps.push(`So ${f.s} ${big} = <b>${answer} ${small}</b>.`);
        return {
          skill: "convert",
          prompt: `How many ${UNIT_WORD[small]} are in <b>${f.s} ${big}</b> (${f.w} of a ${UNIT_ONE[big]})?`,
          visual: `<div style="width:min(100%,320px)">${fractionBar(f.d, f.n, `${part} ${small}`)}<div class="flabel" style="text-align:center">1 ${big} split into ${f.d} equal parts</div></div>`,
          kind: "num", unit: small, answer, steps,
          diagnose: (g) => {
            if (g === answer / 10) return `You used 100 instead of 1000. 1 ${big} = 1000 ${small}, so ${f.s} ${big} = ${answer} ${small}.`;
            if (f.n === 3 && g === part) return `That is one quarter. Three quarters is three of those parts: 3 × ${part} = ${answer}.`;
            return null;
          },
        };
      },
    },
    {
      id: "compare-mixed", level: "medium", skill: "compare",
      make() {
        const a = rand(1, 4), b = rand(2, 9) * 100, A = a * 1000 + b;
        const r = Math.random();
        let B;
        if (r < 0.15) B = A;
        else if (r < 0.6) B = a * 1000 + rand(1, b / 100 - 1) * 100 + pick([0, 50]);
        else B = A + pick([50, 100, 300]);
        const answer = A > B ? "A" : B > A ? "B" : "same";
        const verdict = answer === "same"
          ? `${A} g = ${B} g, so they are <b>the same</b>.`
          : `${Math.max(A, B)} g is more than ${Math.min(A, B)} g, so <b>${answer === "A" ? `${a} kg ${b} g` : `${B} g`}</b> is heavier.`;
        return {
          key: `cmp-${A}-${B}`,
          prompt: "Which is heavier?",
          kind: "mc",
          choices: [{ v: "A", label: `${a} kg ${b} g` }, { v: "B", label: `${B} g` }, { v: "same", label: "They are the same" }],
          answer,
          steps: [
            "Change both masses into the same unit — grams.",
            `${a} kg ${b} g = ${a * 1000} + ${b} = ${A} g.`,
            `The other one is already in grams: ${B} g.`,
            verdict,
          ],
          diagnose: (g) => {
            if (answer === "A" && g === "B") return `${B} looks like a big number, but it is all in grams. ${a} kg ${b} g is ${A} g, which is more.`;
            if (answer === "same") return `Change ${a} kg ${b} g into grams: it is exactly ${A} g — the same as the other mass.`;
            if (g === "same") return `They are not the same: one is ${A} g and the other is ${B} g.`;
            return `${a} kg ${b} g is ${A} g, which is less than ${B} g.`;
          },
        };
      },
    },
    {
      id: "add-grams", level: "medium", skill: "problem",
      make() {
        const [p1, p2] = pick([
          ["a bag of flour", "a bag of sugar"], ["a loaf of bread", "a block of cheese"],
          ["a pumpkin", "a bag of carrots"], ["a library book", "a pencil case"], ["a tin of beans", "a box of cereal"],
        ]);
        const x = rand(3, 16) * 50, y = rand(3, 16) * 50, sum = x + y;
        return {
          prompt: `${cap(p1)} has a mass of ${x} g and ${p2} has a mass of ${y} g. What is their <b>total</b> mass in grams?`,
          kind: "num", unit: "g", answer: sum,
          steps: [
            "'Total' means add the masses together.",
            `${x} + ${y} = ${sum}`,
            sum >= 1000 ? `That is more than 1 kg: ${sum} g = ${kgg(sum)}.` : "That is less than 1 kg (1000 g).",
            `Answer: <b>${sum} g</b>.`,
          ],
          diagnose: (g) => (g === Math.abs(x - y) ? "You took away. 'Total' means add the two masses together." : null),
        };
      },
    },
    {
      id: "scale-medium", level: "medium", skill: "scale",
      make() {
        const kind = rand(0, 2);
        if (kind === 0) {
          let v; do v = rand(1, 19) * 100; while (v % 500 === 0);
          return scaleQ({ max: 2000, major: 500, minor: 100, value: v, answerUnit: "g" });
        }
        if (kind === 1) {
          let v; do v = rand(1, 19) * 50; while (v % 200 === 0);
          return scaleQ({ max: 1000, major: 200, minor: 50, value: v, answerUnit: "g" });
        }
        return scaleQ({ max: 5000, major: 1000, minor: 500, value: (rand(0, 4) * 2 + 1) * 500, kgLabels: true, answerUnit: "g" });
      },
    },
    {
      id: "sensible", level: "medium", skill: "unit",
      make() {
        const t = pick(THINGS);
        return {
          prompt: `${cap(t.name)} has a mass of about ${t.num} ___. Which one makes sense?`,
          visual: `<span class="emoji" aria-hidden="true">${t.e}</span>`,
          kind: "mc", choices: UNITS.map((u) => ({ v: u, label: `${t.num} ${u}` })), answer: t.unit,
          steps: [
            "Use benchmarks: a paperclip is about 1 g, a 1 litre bottle of water is 1 kg, a small car is about 1 t.",
            UNIT_WHY[t.unit],
            `So ${t.name} is about <b>${t.num} ${t.unit}</b>.`,
          ],
          diagnose: (g) => (UNITS.indexOf(g) > UNITS.indexOf(t.unit)
            ? `${t.num} ${g} is far too heavy for ${t.name}.`
            : `${t.num} ${g} is far too light for ${t.name}.`),
        };
      },
    },

    // ---------------- hard
    {
      id: "zero-to-small", level: "hard", skill: "convert",
      make() {
        const [big, small] = Math.random() < 0.7 ? ["kg", "g"] : ["t", "kg"];
        return mixToSmall(rand(1, 9), pick([rand(1, 9), rand(1, 9) * 10, rand(11, 99)]), big, small);
      },
    },
    {
      id: "zero-to-pair", level: "hard", skill: "convert",
      make() {
        const [big, small] = Math.random() < 0.7 ? ["kg", "g"] : ["t", "kg"];
        return smallToPair(rand(1, 9), pick([rand(1, 9), rand(1, 9) * 10, rand(11, 99)]), big, small);
      },
    },
    {
      id: "left-over", level: "hard", skill: "problem",
      make() {
        const [thing, who] = pick([["rice", "Mum"], ["flour", "Dad"], ["dog food", "Mia"], ["potatoes", "Grandpa"], ["sugar", "Leo"]]);
        const A = rand(1, 3);
        let U; do U = rand(3, (A * 1000) / 50 - 1) * 50; while (U % 1000 === 0);
        const answer = A * 1000 - U;
        return {
          prompt: `A bag holds <b>${A} kg</b> of ${thing}. ${who} uses <b>${U} g</b>. How many grams are left?`,
          kind: "num", unit: "g", answer,
          steps: [
            `The units are different, so change kilograms into grams first: ${A} kg = ${A * 1000} g.`,
            `'Left' means take away: ${A * 1000} − ${U} = ${answer}.`,
            `So <b>${answer} g</b> is left${answer >= 1000 ? ` (${kgg(answer)})` : ""}.`,
          ],
          diagnose: (g) => {
            if (g === A * 1000 + U) return "You added. 'How much is left' means take away.";
            if (g === U - A || g === A - U) return `You took away without changing units. Change ${A} kg into ${A * 1000} g first.`;
            if (g === A * 100 - U) return `1 kg is 1000 g, not 100 g, so ${A} kg = ${A * 1000} g.`;
            return null;
          },
        };
      },
    },
    {
      id: "groups", level: "hard", skill: "problem",
      make() {
        const variant = rand(0, 2);
        if (variant === 0) {
          const [item, e] = pick([["apple", "🍎"], ["orange", "🍊"], ["potato", "🥔"], ["muffin", "🧁"]]);
          const w = pick([120, 150, 200, 250]), n = rand(3, 8), answer = w * n;
          return {
            prompt: `Each ${item} has a mass of ${w} g. What is the mass of <b>${n} ${item}s</b> in grams?`,
            visual: `<span class="emoji" aria-hidden="true">${e.repeat(Math.min(n, 8))}</span>`,
            kind: "num", unit: "g", answer,
            steps: [
              `'Each' tells you every ${item} is the same, so multiply: ${n} × ${w} g.`,
              `${n} × ${w} = ${answer}.`,
              `So ${n} ${item}s have a mass of <b>${answer} g</b>${answer >= 1000 ? ` (${kgg(answer)})` : ""}.`,
            ],
            diagnose: (g) => (g === w + n ? "You added the numbers. 'Each' means equal groups, so multiply." : null),
          };
        }
        if (variant === 1) {
          const p = pick([100, 200, 250, 500]), k = rand(1, 3), answer = (k * 1000) / p;
          return {
            prompt: `How many <b>${p} g</b> packets are needed to make <b>${k} kg</b>?`,
            kind: "num", unit: "packets", answer,
            steps: [
              `Change to the same unit: ${k} kg = ${k * 1000} g.`,
              `How many ${p}s fit into ${k * 1000}? ${k * 1000} ÷ ${p} = ${answer}.`,
              p === 250 ? "Tip: 4 lots of 250 g make 1 kg." : p === 500 ? "Tip: 2 lots of 500 g make 1 kg." : p === 200 ? "Tip: 5 lots of 200 g make 1 kg." : "Tip: 10 lots of 100 g make 1 kg.",
              `So you need <b>${answer} packets</b>.`,
            ],
            diagnose: (g) => {
              if (g === (k * 1000) / p / 10 || g === (k * 100) / p) return `1 kg is 1000 g, so ${k} kg = ${k * 1000} g. Then ${k * 1000} ÷ ${p} = ${answer}.`;
              if (g === 1000 / p && k > 1) return `That is how many make 1 kg. You need ${k} kg, so ${k} × ${1000 / p} = ${answer}.`;
              return null;
            },
          };
        }
        const w = pick([150, 200, 250, 300]), n = rand(3, 6), total = w * n;
        const answer = total > 1000 ? "more" : total < 1000 ? "less" : "same";
        return {
          prompt: `${n} bananas each have a mass of ${w} g. Altogether, is that more or less than <b>1 kg</b>?`,
          visual: `<span class="emoji" aria-hidden="true">${"🍌".repeat(n)}</span>`,
          kind: "mc",
          choices: [{ v: "more", label: "More than 1 kg" }, { v: "less", label: "Less than 1 kg" }, { v: "same", label: "Exactly 1 kg" }],
          answer, key: `bananas-${n}-${w}`,
          steps: [
            `Total mass: ${n} × ${w} g = ${total} g.`,
            "1 kg = 1000 g.",
            `${total} g is ${answer === "same" ? "exactly" : answer + " than"} 1000 g, so the answer is <b>${answer === "same" ? "exactly 1 kg" : answer + " than 1 kg"}</b>.`,
          ],
          diagnose: () => `Work out the total first: ${n} × ${w} = ${total} g. Then compare with 1 kg = 1000 g.`,
        };
      },
    },
    {
      id: "heaviest", level: "hard", skill: "compare",
      make() {
        const a = rand(1, 4);
        const offsets = shuffle([5, 50, 500, 55, 505, 550, 250, 25, 205]).slice(0, 4);
        const forms = shuffle(["mix", "mix", "g", "g"]);
        const items = offsets.map((o, i) => {
          const g = a * 1000 + o;
          return { g, label: forms[i] === "mix" ? `${a} kg ${o} g` : `${g} g` };
        });
        const heaviest = Math.random() < 0.6;
        const sorted = [...items].sort((x, y) => x.g - y.g);
        const target = heaviest ? sorted[3] : sorted[0];
        const word = heaviest ? "heaviest" : "lightest";
        return {
          key: `order-${word}-${items.map((i) => i.label).sort().join("|")}`,
          prompt: `Which mass is the <b>${word}</b>?`,
          kind: "mc", choices: items.map((i) => ({ v: i.label, label: i.label })), answer: target.label,
          steps: [
            "Change every mass into grams so you can compare them:",
            items.map((i) => `${i.label} = ${i.g} g`).join("<br>"),
            `Lightest to heaviest: ${sorted.map((i) => i.label).join(" → ")}`,
            `So the ${word} is <b>${target.label}</b>.`,
          ],
          diagnose: (g) => {
            const chosen = items.find((i) => i.label === g);
            return `${g} is ${chosen ? chosen.g : "?"} g. Change them all to grams and watch the zeros — for example ${a} kg 50 g is ${a * 1000 + 50} g, not ${a * 1000 + 500} g.`;
          },
        };
      },
    },
    {
      id: "scale-hard", level: "hard", skill: "scale",
      make() {
        const kind = rand(0, 2);
        if (kind === 0) {
          let v; do v = rand(1, 15) * 250; while (v % 1000 === 0);
          return scaleQ({ max: 4000, major: 1000, minor: 250, value: v, kgLabels: true, answerUnit: "g" });
        }
        if (kind === 1) {
          let v; do v = rand(1, 19) * 500; while (v % 2000 === 0);
          return scaleQ({ max: 10000, major: 2000, minor: 500, value: v, kgLabels: true, answerUnit: "g" });
        }
        let v; do v = rand(1, 9) * 200; while (v % 1000 === 0);
        return scaleQ({ max: 2000, major: 1000, minor: 200, value: v, kgLabels: true, answerUnit: "g" });
      },
    },
    {
      id: "truck", level: "hard", skill: "problem",
      make() {
        const C = rand(4, 9), a = rand(1, C - 1), b = rand(2, 18) * 50, load = a * 1000 + b, answer = C * 1000 - load;
        return {
          prompt: `A truck can carry <b>${C} t</b>. It already has <b>${a} t ${b} kg</b> on it. How many more kilograms can it carry?`,
          visual: '<span class="emoji" aria-hidden="true">🚚</span>',
          kind: "num", unit: "kg", answer,
          steps: [
            "Change both to kilograms (1 t = 1000 kg).",
            `It can carry ${C} t = ${C * 1000} kg. It has ${a} t ${b} kg = ${load} kg.`,
            `'How many more' means take away: ${C * 1000} − ${load} = ${answer}.`,
            `So it can carry <b>${answer} kg</b> more.`,
          ],
          diagnose: (g) => {
            if (g === (C - a) * 1000 + b) return `You added the ${b} kg. The truck already has those on board, so take them away too.`;
            if (g === C * 1000 + load) return "You added. 'How many more' means take away.";
            if (g === C - a) return `That is in tonnes. The question asks for kilograms: change everything to kg first.`;
            return null;
          },
        };
      },
    },
  ];

  const SKILLS = {
    convert: "Converting units",
    unit: "Choosing units",
    scale: "Reading scales",
    compare: "Comparing masses",
    problem: "Word problems",
  };

  const GENERIC = {
    convert: "Check the direction. Going to a <b>smaller</b> unit (kg → g) multiply by 1000. Going to a <b>bigger</b> unit (g → kg) divide by 1000.",
    unit: "Think about how heavy the thing really is, then compare it with a benchmark: paperclip ≈ 1 g, 1 litre of water = 1 kg, small car ≈ 1 t.",
    scale: "Before reading the needle, work out what one small mark is worth: the gap between two big numbers ÷ the number of spaces.",
    compare: "Change every mass into the same unit before you compare them.",
    problem: "Find the key word: 'total' → add, 'left' or 'how many more' → take away, 'each' → multiply, 'how many … make' → divide. Make the units match first.",
  };

  const TESTS = {
    easy: { name: "Easy test", icon: "🌱", plan: [["easy", 10]], blurb: "10 questions · units and simple changes" },
    medium: { name: "Medium test", icon: "🌿", plan: [["medium", 10]], blurb: "10 questions · kg and g, fractions, scales" },
    hard: { name: "Hard test", icon: "🌳", plan: [["hard", 10]], blurb: "10 questions · zeros, tricky scales, problems" },
    mixed: { name: "Mixed test", icon: "🏆", plan: [["easy", 4], ["medium", 4], ["hard", 4]], blurb: "12 questions · a bit of everything" },
  };

  // --- lesson --------------------------------------------------------------
  function lessonHTML() {
    const unitCard = (u, title, items, tag) => `
      <div class="unit u-${u}">
        <div class="sym">${u}</div>
        <div class="name">${title}</div>
        <ul>${items.map(([e, t]) => `<li><span class="e" aria-hidden="true">${e}</span><span>${t.replace(/(\d) (mg|g|kg|t)\b/g, "$1&nbsp;$2")}</span></li>`).join("")}</ul>
        <div class="tag">${tag}</div>
      </div>`;
    const example = (q, steps, a) => `
      <div class="example"><div class="q">${q}</div><ol>${steps.map((s) => `<li>${s}</li>`).join("")}</ol><div class="a">${a}</div></div>`;
    const sections = [
      ["m-what", "What is mass?"], ["m-units", "The 4 units"], ["m-ladder", "The 1000 rule"],
      ["m-convert", "Converting"], ["m-fractions", "Parts of a kg"], ["m-scales", "Reading scales"],
      ["m-choose", "Best unit"], ["m-compare", "Comparing"], ["m-explore", "Converter"],
    ];
    return `
    <div class="card">
      <div class="topic-head"><div class="big" aria-hidden="true">⚖️</div>
        <div><h2>Topic 1 · Mass</h2><div class="lead">Milligrams, grams, kilograms and tonnes</div></div></div>
      <div class="chips"><span class="chip">Year 4</span><span class="chip">Victorian Curriculum · Mathematics</span><span class="chip">Measurement</span></div>
      <p>By the end of this topic you will be able to:</p>
      <ul>
        <li>choose the best unit to measure something</li>
        <li>change between mg, g, kg and t</li>
        <li>read a kitchen scale, even when not every mark has a number</li>
        <li>compare and order masses</li>
        <li>solve word problems about mass</li>
      </ul>
      <div class="toc">${sections.map(([id, t], i) => `<button type="button" data-goto="${id}">${i + 1}. ${t}</button>`).join("")}</div>
    </div>

    <div class="card" id="m-what">
      <h2><span class="step-no">1</span>What is mass?</h2>
      <p><b>Mass</b> is how much "stuff" is in something — how heavy it is. We can compare masses with a <b>pan balance</b>: the heavier side goes <b>down</b>.</p>
      ${balanceSVG("🍉", "🍓", -10, "A balance with a watermelon on the left and a strawberry on the right. The watermelon side is lower.")}
      <p style="text-align:center;color:var(--muted);font-size:14px">The watermelon side goes down, so the watermelon has more mass.</p>
      <div class="tip">💡 Bigger does not always mean heavier! A balloon 🎈 is big but very light. A small rock 🪨 can be heavy.</div>
      ${balanceSVG("🪨", "🎈", -10, "A balance with a small rock on the left and a balloon on the right. The rock side is lower.")}
    </div>

    <div class="card" id="m-units">
      <h2><span class="step-no">2</span>Meet the four units</h2>
      <p class="lead">From tiny to huge. Look at the examples to get a feel for each one.</p>
      <div class="units">
        ${unitCard("mg", "milligram", [["🐜", "an ant ≈ 3 mg"], ["🍚", "a grain of rice ≈ 25 mg"], ["💊", "medicine: 500 mg tablet"]], "For tiny things")}
        ${unitCard("g", "gram", [["📎", "a paperclip ≈ 1 g"], ["🪙", "a $1 coin ≈ 9 g"], ["🍎", "an apple ≈ 150 g"]], "For small things")}
        ${unitCard("kg", "kilogram", [["💧", "1 litre of water = 1 kg"], ["🐈", "a cat ≈ 4 kg"], ["🧒", "a Year 4 student ≈ 30 kg"]], "For people, pets, shopping")}
        ${unitCard("t", "tonne", [["🚗", "a small car ≈ 1 t"], ["🐘", "an elephant ≈ 5 t"], ["🐋", "a blue whale ≈ 150 t"]], "For very heavy things")}
      </div>
      <div class="tip">💡 In Australia we use the metric <b>tonne</b> (t), which is exactly 1000 kg. You might hear people say "ton" — it means about the same thing in everyday talk.</div>
    </div>

    <div class="card" id="m-ladder">
      <h2><span class="step-no">3</span>The magic number is 1000</h2>
      <p>Each unit is <b>1000 times</b> the next smaller one.</p>
      <div class="ladder">
        <div class="rung u-t"><div class="box">1 tonne (t) <small>= 1000 kg</small></div><div class="arrow">× 1000 ↓</div></div>
        <div class="rung u-kg"><div class="box">1 kilogram (kg) <small>= 1000 g</small></div><div class="arrow">× 1000 ↓</div></div>
        <div class="rung u-g"><div class="box">1 gram (g) <small>= 1000 mg</small></div><div class="arrow">× 1000 ↓</div></div>
        <div class="rung u-mg"><div class="box">1 milligram (mg)</div><div class="arrow"></div></div>
      </div>
      <div class="arrows">
        <div><b>⬇️ To a smaller unit: × 1000</b>The number gets <b>bigger</b>.<br>2 kg → 2 × 1000 = <b>2000 g</b></div>
        <div><b>⬆️ To a bigger unit: ÷ 1000</b>The number gets <b>smaller</b>.<br>3000 g → 3000 ÷ 1000 = <b>3 kg</b></div>
      </div>
      <div class="tip">💡 <b>1 kg and 1000 g are the same mass</b> — just written in different units. Smaller unit, bigger number. Bigger unit, smaller number.</div>
    </div>

    <div class="card" id="m-convert">
      <h2><span class="step-no">4</span>Converting — worked examples</h2>
      <p>A place value chart helps. In a number of grams, the <b>thousands</b> digit is the kilograms:</p>
      ${pvChart(2450)}
      <p>So <b>2450 g = 2 kg 450 g</b>.</p>
      <div class="examples">
        ${example("3 kg = ? g", ["Going to a smaller unit → × 1000", "3 × 1000 = 3000"], "3 kg = 3000 g")}
        ${example("5000 g = ? kg", ["Going to a bigger unit → ÷ 1000", "5000 ÷ 1000 = 5"], "5000 g = 5 kg")}
        ${example("2 kg 450 g = ? g", ["2 kg = 2000 g", "2000 + 450 = 2450"], "2 kg 450 g = 2450 g")}
        ${example("3075 g = ? kg ? g", ["Thousands digit: 3 → 3 kg", "Last three digits: 075 → 75 g"], "3075 g = 3 kg 75 g")}
        ${example("2 t = ? kg", ["1 t = 1000 kg", "2 × 1000 = 2000"], "2 t = 2000 kg")}
        ${example("4 g = ? mg", ["1 g = 1000 mg", "4 × 1000 = 4000"], "4 g = 4000 mg")}
      </div>
      <div class="tip">⚠️ <b>Watch the zeros!</b> 3 kg 75 g is <b>3075 g</b>, not 375 g. The 75 only fills the tens and ones, so the hundreds place needs a 0.</div>
      ${pvChart(3075)}
    </div>

    <div class="card" id="m-fractions">
      <h2><span class="step-no">5</span>Parts of a kilogram</h2>
      <p>1 kg = 1000 g. Split it into equal parts:</p>
      <div class="flabel">½ kg = 1000 ÷ 2 = <b>500 g</b></div>${fractionBar(2, 1, "500 g")}
      <div class="flabel">¼ kg = 1000 ÷ 4 = <b>250 g</b></div>${fractionBar(4, 1, "250 g")}
      <div class="flabel">¾ kg = 3 × 250 = <b>750 g</b></div>${fractionBar(4, 3, "250 g")}
      <div class="flabel">1/10 kg = 1000 ÷ 10 = <b>100 g</b></div>${fractionBar(10, 1, "")}
      <div class="tip">🧈 A block of butter is often 250 g — that is ¼ kg. Four blocks make 1 kg.</div>
    </div>

    <div class="card" id="m-scales">
      <h2><span class="step-no">6</span>Reading a scale</h2>
      <p>Not every mark on a scale has a number. Move the slider and watch how to read the needle.</p>
      <div class="scale-demo">
        <div id="demo-dial"></div>
        <div>
          <label for="demo-range" style="font-size:13px;font-weight:600;color:var(--muted)">Put something on the scale</label>
          <input id="demo-range" type="range" min="0" max="2000" step="100" value="1300">
          <div class="readout" id="demo-readout" aria-live="polite"></div>
        </div>
      </div>
      <h3>How to read any scale</h3>
      <ol class="how-read">
        <li>Find what the <b>big numbers</b> go up by.</li>
        <li>Count the <b>spaces</b> between two big numbers.</li>
        <li>Work out <b>one small mark</b>: big gap ÷ spaces.</li>
        <li>Start at the big number before the needle and <b>count on</b>.</li>
      </ol>
    </div>

    <div class="card" id="m-choose">
      <h2><span class="step-no">7</span>Choosing the best unit</h2>
      <table class="guide">
        <thead><tr><th>Unit</th><th>Use it for</th><th>Benchmark</th></tr></thead>
        <tbody>
          <tr><td><b style="color:var(--u-mg)">mg</b></td><td>Tiny things: insects, grains, medicine</td><td>Much lighter than a paperclip</td></tr>
          <tr><td><b style="color:var(--u-g)">g</b></td><td>Things you hold in one hand: fruit, pencils, coins</td><td>📎 a paperclip ≈ 1 g</td></tr>
          <tr><td><b style="color:var(--u-kg)">kg</b></td><td>People, pets, bags of shopping</td><td>💧 1 litre of water = 1 kg</td></tr>
          <tr><td><b style="color:var(--u-t)">t</b></td><td>Cars, trucks, huge animals</td><td>🚗 a small car ≈ 1 t</td></tr>
        </tbody>
      </table>
      <div class="tip">💡 Ask yourself: "Could I lift it? Could I hold it in one hand? Would it blow away?"</div>
    </div>

    <div class="card" id="m-compare">
      <h2><span class="step-no">8</span>Comparing and ordering</h2>
      <p><b>Always change to the same unit first.</b> Order these from lightest to heaviest:</p>
      <p style="font-weight:700">2 kg 50 g · 2500 g · 2 kg 5 g · 2 kg 250 g</p>
      <table class="guide">
        <thead><tr><th>Mass</th><th>In grams</th></tr></thead>
        <tbody>
          <tr><td>2 kg 5 g</td><td><b>2005 g</b></td></tr>
          <tr><td>2 kg 50 g</td><td><b>2050 g</b></td></tr>
          <tr><td>2 kg 250 g</td><td><b>2250 g</b></td></tr>
          <tr><td>2500 g</td><td><b>2500 g</b></td></tr>
        </tbody>
      </table>
      <p>Lightest → heaviest: <b>2 kg 5 g, 2 kg 50 g, 2 kg 250 g, 2500 g</b>.</p>
      <div class="tip">⚠️ 1050 g looks like a big number, but 1 kg 200 g (= 1200 g) is heavier!</div>
    </div>

    <div class="card" id="m-explore">
      <h2><span class="step-no">9</span>Try the converter</h2>
      <p class="lead">Type any mass and see it in every unit.</p>
      <div class="explorer">
        <input id="ex-n" type="text" inputmode="decimal" value="2.5" aria-label="Amount">
        <select id="ex-u" aria-label="Unit">
          <option value="mg">mg</option><option value="g">g</option><option value="kg" selected>kg</option><option value="t">t</option>
        </select>
      </div>
      <div class="conv" id="ex-out"></div>
    </div>

    <div class="card" style="text-align:center">
      <h2>Ready to try?</h2>
      <p class="lead">Practise with instant help, or take a test and see your results.</p>
      <div class="qactions"><button class="primary" data-view-go="practice">✏️ Start practice</button><button data-view-go="test">📝 Take a test</button></div>
    </div>`;
  }

  function demoReadout(v) {
    const last = Math.floor(v / 500) * 500, k = (v - last) / 100;
    const lines = [`<div class="big">${v} g</div><div>${v >= 1000 ? `= ${kgg(v)}` : "&nbsp;"}</div>`];
    if (k === 0) {
      lines.push(`<p>The needle points exactly at a big number: <b>${v}</b>.</p>`);
    } else {
      lines.push(`<p>Big numbers go up by 500 g with <b>5 spaces</b> between them, so each small mark is 500 ÷ 5 = <b>100 g</b>.</p>`,
        `<p>The needle is ${plural(k, "small mark")} past <b>${last}</b>: ${last} + ${k} × 100 = <b>${v} g</b>.</p>`);
    }
    return lines.join("");
  }

  /** The kitchen-scale demo and the converter, once the lesson is on the page. */
  function wireLesson() {
    // Scale demo.
    const demoRange = document.getElementById("demo-range");
    const drawDemo = () => {
      const v = Number(demoRange.value);
      document.getElementById("demo-dial").innerHTML =
        dialSVG({ max: 2000, major: 500, minor: 100, value: v, unitWord: "grams", label: String });
      document.getElementById("demo-readout").innerHTML = demoReadout(v);
    };
    demoRange.addEventListener("input", drawDemo);
    drawDemo();

    // Converter.
    const FACTOR = { mg: 1, g: 1e3, kg: 1e6, t: 1e9 };
    const nice = (x) => (Math.round(x * 1e6) / 1e6).toLocaleString("en-AU", { maximumFractionDigits: 6 });
    const drawConverter = () => {
      const n = parseNum(document.getElementById("ex-n").value);
      const out = document.getElementById("ex-out");
      if (n === null) {
        out.innerHTML = '<div class="u-g" style="grid-column:1/-1">Type a number, like 2.5 or 750.</div>';
        return;
      }
      const mg = n * FACTOR[document.getElementById("ex-u").value];
      const grams = Math.round(mg / 1000 * 1e6) / 1e6;
      out.innerHTML = UNITS.map((u) => {
        const extra = u === "kg" && Number.isInteger(grams) && grams % 1000 && grams > 1000 ? `<small>= ${kgg(grams)}</small>` : "";
        return `<div class="u-${u}"><b>${nice(mg / FACTOR[u])} ${u}</b><small>${UNIT_WORD[u]}</small>${extra ? "<br>" + extra : ""}</div>`;
      }).join("");
    };
    document.getElementById("ex-n").addEventListener("input", drawConverter);
    document.getElementById("ex-u").addEventListener("change", drawConverter);
    drawConverter();
  }

  C.register({
    id: "mass", number: 1, icon: "⚖️", name: "Mass", subtitle: "Milligrams, grams, kilograms and tonnes",
    noun: "masses", unitWords: UNIT_WORD, GENS, SKILLS, GENERIC, TESTS, lessonHTML, wireLesson,
    levelBlurb: { easy: "Units · simple changes", medium: "kg + g · fractions · scales", hard: "Zeros · problems" },
  });
})();
