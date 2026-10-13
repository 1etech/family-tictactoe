// Year 4 maths (Victorian Curriculum, Measurement): mass in mg, g, kg and t.
// Everything happens in the browser. Questions are generated, so every practice
// round and every test is different. Masses are worked in whole numbers of the
// smaller unit (grams, mostly) so there is no floating-point drift.
(() => {
  "use strict";

  // --- small helpers -------------------------------------------------------
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

  function fractionBar(parts, on, labelEach) {
    const cells = Array.from({ length: parts }, (_, i) =>
      `<div class="${i < on ? "on" : ""}">${parts <= 4 ? labelEach : ""}</div>`).join("");
    return `<div class="fbar" aria-hidden="true">${cells}</div>`;
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

  // --- answer handling -----------------------------------------------------
  const parseNum = (text) => {
    const t = String(text ?? "").replace(/[\s,]/g, "");
    return /^\d+(\.\d+)?$/.test(t) ? Number(t) : null;
  };

  function make(gen) {
    const q = gen.make();
    q.level = gen.level;
    q.gen = gen.id;
    q.skill = q.skill || gen.skill;
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
    return (q.diagnose && q.diagnose(given)) || GENERIC[q.skill];
  }

  /** A test: `plan` is [[level, count], ...]. Uses every generator before repeating one. */
  function buildSet(plan) {
    const out = [], seen = new Set();
    for (const [level, count] of plan) {
      const gens = GENS.filter((g) => g.level === level);
      let order = [];
      for (let i = 0; i < count; i++) {
        if (!order.length) order = shuffle(gens);
        const gen = order.pop();
        let q, tries = 0;
        do q = make(gen); while (seen.has(q.key) && ++tries < 25);
        seen.add(q.key);
        out.push(q);
      }
    }
    return out;
  }

  const TESTS = {
    easy: { name: "Easy test", icon: "🌱", plan: [["easy", 10]], blurb: "10 questions · units and simple changes" },
    medium: { name: "Medium test", icon: "🌿", plan: [["medium", 10]], blurb: "10 questions · kg and g, fractions, scales" },
    hard: { name: "Hard test", icon: "🌳", plan: [["hard", 10]], blurb: "10 questions · zeros, tricky scales, problems" },
    mixed: { name: "Mixed test", icon: "🏆", plan: [["easy", 4], ["medium", 4], ["hard", 4]], blurb: "12 questions · a bit of everything" },
  };
  const LEVEL_NAME = { easy: "Easy", medium: "Medium", hard: "Hard" };
  const PRAISE = ["Correct!", "Well done!", "Spot on!", "Great work!", "You got it!", "Brilliant!"];

  // Exposed for the node check in test/mass-questions.mjs.
  if (typeof module !== "undefined") {
    module.exports = { GENS, make, isCorrect, answerText, givenText, whatWentWrong, buildSet, parseNum, TESTS, SKILLS };
  }
  if (typeof document === "undefined") return;

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

  // --- page wiring ---------------------------------------------------------
  const root = document.getElementById("learn-root");
  if (!root) return;
  const Kids = window.LearnKids;

  const VIEWS = [
    ["learn", "📖", "Learn"], ["practice", "✏️", "Practice"], ["test", "📝", "Test"],
    ["rewards", "🐾", "Rewards"], ["parents", "👪", "Parents"],
  ];
  root.innerHTML = `
    <nav class="subtabs" role="tablist" aria-label="Learning sections">
      ${VIEWS.map(([v, icon, text]) => `<button type="button" role="tab" data-view="${v}" aria-selected="${v === "learn"}"><span class="i" aria-hidden="true">${icon}</span><span>${text}</span></button>`).join("")}
    </nav>
    <div class="learner-bar" id="learner-bar"></div>
    <div data-panel="learn">${lessonHTML()}</div>
    ${VIEWS.slice(1).map(([v]) => `<div data-panel="${v}" hidden></div>`).join("")}
    <div data-panel="who" hidden></div>
    <div class="toasts" id="toasts" aria-live="polite"></div>`;

  const panels = Object.fromEntries([...root.querySelectorAll("[data-panel]")].map((el) => [el.dataset.panel, el]));
  const bar = root.querySelector("#learner-bar");

  // Practice, tests and rewards belong to a named learner; ask first.
  const NEEDS_KID = new Set(["practice", "test", "rewards"]);
  let view = "learn";

  function showView(next, scroll = true) {
    let shown = next;
    if (NEEDS_KID.has(next) && !Kids.current()) {
      drawWho(next);
      shown = "who";
    }
    view = next;
    for (const [name, el] of Object.entries(panels)) el.hidden = name !== shown;
    root.querySelectorAll(".subtabs [data-view]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.view === next)));
    if (shown === "rewards") drawRewards();
    if (shown === "parents") drawParents();
    if (scroll) root.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  root.addEventListener("click", (event) => {
    const tab = event.target.closest(".subtabs [data-view]");
    if (tab) return showView(tab.dataset.view);
    const go = event.target.closest("[data-view-go]");
    if (go) return showView(go.dataset.viewGo);
    if (event.target.closest('[data-kid="switch"]')) return askWho();
    const jump = event.target.closest("[data-goto]");
    if (jump) return document.getElementById(jump.dataset.goto)?.scrollIntoView({ behavior: "smooth", block: "start" });
    // Review lists everywhere filter with CSS, so no per-page listeners are needed.
    const filter = event.target.closest(".review-card [data-filter]");
    if (filter) {
      filter.closest(".review-card").dataset.show = filter.dataset.filter;
      filter.parentElement.querySelectorAll("[data-filter]").forEach((b) => b.setAttribute("aria-pressed", String(b === filter)));
    }
  });

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

  // --- one question on screen ----------------------------------------------
  function questionView(q) {
    const el = document.createElement("div");
    el.innerHTML = `<div class="prompt">${q.prompt}</div>${q.visual ? `<div class="visual">${q.visual}</div>` : ""}<div class="answer"></div>`;
    const area = el.querySelector(".answer");
    const inputs = [];
    let selected = null;

    if (q.kind === "mc") {
      const wrap = document.createElement("div");
      wrap.className = "choices";
      for (const c of q.choices) {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = c.label;
        b.dataset.v = c.v;
        b.setAttribute("aria-pressed", "false");
        b.addEventListener("click", () => {
          selected = c.v;
          wrap.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
        });
        wrap.appendChild(b);
      }
      area.appendChild(wrap);
    } else {
      const fields = q.kind === "pair" ? q.labels : [q.unit];
      fields.forEach((label, i) => {
        const input = document.createElement("input");
        input.type = "text";
        input.inputMode = "numeric";
        input.autocomplete = "off";
        input.setAttribute("aria-label", q.kind === "pair" ? `Number of ${UNIT_WORD[label] || label}` : `Your answer in ${UNIT_WORD[label] || label}`);
        const unit = document.createElement("span");
        unit.className = "unit-label";
        unit.textContent = label;
        if (q.kind === "pair") input.style.width = "100px";
        area.append(input, unit);
        inputs.push(input);
        if (i === 0 && q.kind === "pair") unit.style.marginRight = "8px";
      });
    }

    return {
      el,
      /** null means "no usable answer yet". */
      read() {
        if (q.kind === "mc") return selected;
        if (q.kind === "num") return parseNum(inputs[0].value);
        const raw = inputs.map((i) => i.value.trim());
        if (!raw[0] && !raw[1]) return null;
        const big = raw[0] ? parseNum(raw[0]) : 0, small = raw[1] ? parseNum(raw[1]) : 0;
        return big === null || small === null ? null : { big, small };
      },
      lock(markChoices) {
        inputs.forEach((i) => { i.disabled = true; });
        el.querySelectorAll(".choices button").forEach((b) => {
          b.disabled = true;
          if (!markChoices) return;
          if (b.dataset.v === q.answer) b.classList.add("right");
          else if (b.dataset.v === selected) b.classList.add("wrong");
        });
      },
      focus() { inputs[0]?.focus({ preventScroll: true }); },
      onEnter(fn) { inputs.forEach((i) => i.addEventListener("keydown", (e) => { if (e.key === "Enter") fn(); })); },
    };
  }

  const stepsHTML = (q) => `<ol>${q.steps.map((s) => `<li>${s}</li>`).join("")}</ol>`;

  function feedbackHTML(q, given, ok) {
    if (ok) {
      return `<div class="feedback ok" role="status"><div class="verdict">✅ ${pick(PRAISE)}</div>
        <div class="why">${esc(answerText(q))} is right.</div>
        <details><summary>See how to do it</summary>${stepsHTML(q)}</details></div>`;
    }
    return `<div class="feedback no" role="status"><div class="verdict">❌ Not quite</div>
      <div class="why">Your answer: <b>${esc(givenText(q, given))}</b><br>Right answer: <b>${esc(answerText(q))}</b></div>
      <div class="label">What went wrong</div><div>${whatWentWrong(q, given)}</div>
      <div class="label">How to do it</div>${stepsHTML(q)}</div>`;
  }

  // --- shared bits ---------------------------------------------------------
  const when = (at) => new Date(at).toLocaleString("en-AU",
    { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
  const duration = (sec) => (sec >= 60 ? `${Math.floor(sec / 60)}m ${sec % 60}s` : `${sec}s`);
  const pctClass = (p) => (p >= 80 ? "good" : p >= 50 ? "mid" : "low");

  function toast(html) {
    const el = document.createElement("div");
    el.className = "toast";
    el.innerHTML = html;
    root.querySelector("#toasts").appendChild(el);
    setTimeout(() => el.remove(), 4200);
  }

  /** Shows what a reward unlocked and refreshes the points in the learner bar. */
  function celebrate(reward) {
    if (!reward) return;
    drawLearnerBar();
    for (const b of reward.newBadges) toast(`<span class="t-icon">${b.icon}</span><span>New badge!<b>${b.name}</b></span>`);
    if (reward.rankUp) toast(`<span class="t-icon">${reward.rankUp.icon}</span><span>You're now a<b>${reward.rankUp.name}</b></span>`);
  }

  /** Two taps for anything destructive; no browser pop-ups. */
  function confirmed(button, prompt) {
    if (button.dataset.armed) return true;
    const original = button.textContent;
    button.dataset.armed = "1";
    button.textContent = prompt;
    setTimeout(() => {
      if (!button.isConnected) return;
      delete button.dataset.armed;
      button.textContent = original;
    }, 4000);
    return false;
  }

  /**
   * Imported backups are outside input, so their stored question HTML is cut
   * down to the few tags and attributes the questions actually use.
   */
  const SAFE_TAGS = new Set(["b", "br", "div", "span", "ol", "li", "p", "small", "svg", "rect", "circle", "line", "text", "path", "g"]);
  const SAFE_ATTRS = new Set(["class", "x", "y", "x1", "y1", "x2", "y2", "cx", "cy", "r", "rx", "width", "height", "d",
    "viewbox", "font-size", "font-weight", "text-anchor", "dominant-baseline", "stroke-width", "role", "aria-label", "aria-hidden"]);
  function sanitizeHTML(html) {
    const tpl = document.createElement("template");
    tpl.innerHTML = html;
    const walk = (node) => {
      for (const el of [...node.children]) {
        if (!SAFE_TAGS.has(el.localName)) { el.remove(); continue; }
        for (const a of [...el.attributes]) if (!SAFE_ATTRS.has(a.name.toLowerCase())) el.removeAttribute(a.name);
        walk(el);
      }
    };
    walk(tpl.content);
    return tpl.innerHTML;
  }

  // --- who is learning -----------------------------------------------------
  function drawLearnerBar() {
    const kid = Kids.current();
    if (!kid) {
      bar.innerHTML = '<span class="lb-hello">👋 Who\'s learning today?</span><button type="button" class="primary" data-kid="switch">Choose your cat</button>';
      return;
    }
    const { rank } = Kids.rankFor(kid.points);
    bar.innerHTML = `<span class="lb-av" aria-hidden="true">${kid.avatar}</span>
      <span class="lb-name">${esc(kid.name)}<small>${rank.icon} ${rank.name}</small></span>
      <button type="button" class="lb-claws" data-view-go="rewards" aria-label="${kid.points} Claw Points — see rewards">🐾 <b>${kid.points}</b><small>Claw Points</small></button>
      <button type="button" data-kid="switch">Switch</button>`;
  }

  function askWho() {
    drawWho(view);
    for (const [name, el] of Object.entries(panels)) el.hidden = name !== "who";
    root.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function drawWho(after) {
    const kids = Kids.list();
    const used = new Set(kids.map((k) => k.avatar));
    let avatar = Kids.AVATARS.find((a) => !used.has(a)) || Kids.AVATARS[0];
    const current = Kids.current();
    panels.who.innerHTML = `<div class="card">
      <h2>Who's learning? 🐾</h2>
      <p class="lead">Pick your name so your Claw Points and tests are saved for you.</p>
      ${kids.length ? `<div class="kid-grid">${kids.map((k) => `
        <button type="button" class="kid-btn" data-pick="${k.id}" aria-pressed="${k === current}">
          <span class="av" aria-hidden="true">${k.avatar}</span><b>${esc(k.name)}</b><small>🐾 ${k.points}</small></button>`).join("")}
      </div><h3>Someone new?</h3>` : ""}
      <form class="new-kid" autocomplete="off">
        <label for="kid-name">Your name</label>
        <input id="kid-name" type="text" maxlength="20" placeholder="e.g. Mia">
        <div class="pick-label">Pick your cat</div>
        <div class="avatar-pick">${Kids.AVATARS.map((a) => `<button type="button" data-av="${a}" aria-pressed="${a === avatar}" aria-label="Cat ${a}">${a}</button>`).join("")}</div>
        <p class="form-error" role="alert"></p>
        <div class="qactions">
          ${current ? '<button type="button" data-who="cancel">Cancel</button>' : ""}
          <button type="submit" class="primary">Start learning 🐾</button>
        </div>
      </form>
      <p class="note">${Kids.canSave() ? "Names, points and tests are saved on this device only." : "⚠️ This browser is not letting the page save, so points and tests will be lost when the page closes."}</p>
    </div>`;

    const done = (kid) => {
      if (!kid) return;
      onKidChange();
      showView(after);
    };
    panels.who.querySelectorAll("[data-pick]").forEach((b) => b.addEventListener("click", () => {
      Kids.setCurrent(b.dataset.pick);
      done(Kids.current());
    }));
    panels.who.querySelectorAll("[data-av]").forEach((b) => b.addEventListener("click", () => {
      avatar = b.dataset.av;
      panels.who.querySelectorAll("[data-av]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    }));
    panels.who.querySelector('[data-who="cancel"]')?.addEventListener("click", () => showView(after));
    panels.who.querySelector("form").addEventListener("submit", (event) => {
      event.preventDefault();
      const kid = Kids.add(panels.who.querySelector("#kid-name").value, avatar);
      if (!kid) panels.who.querySelector(".form-error").textContent = "Type your name first.";
      done(kid);
    });
  }

  /** A different child is now learning: their practice and tests start fresh. */
  function onKidChange() {
    drawLearnerBar();
    resetPractice();
    T.active = false;
    drawTestMenu();
  }

  // --- practice ------------------------------------------------------------
  const P = { levels: null, skills: null, q: null, lastGen: null, count: 0, right: 0, streak: 0 };

  panels.practice.innerHTML = `
    <div class="card">
      <h2>Practice</h2>
      <p class="lead">Pick a level. Every right answer earns 🐾 Claw Points — Easy +1, Medium +2, Hard +3, and a bonus for every 5 in a row.</p>
      <div class="levels">
        <button type="button" data-level="easy" aria-pressed="false"><span class="e" aria-hidden="true">🌱</span>Easy<small>Units · simple changes</small></button>
        <button type="button" data-level="medium" aria-pressed="false"><span class="e" aria-hidden="true">🌿</span>Medium<small>kg + g · fractions · scales</small></button>
        <button type="button" data-level="hard" aria-pressed="false"><span class="e" aria-hidden="true">🌳</span>Hard<small>Zeros · problems</small></button>
      </div>
      <p id="p-focus" class="tip" hidden></p>
    </div>
    <div class="card" id="p-card" hidden></div>`;

  const pCard = panels.practice.querySelector("#p-card");
  const pFocus = panels.practice.querySelector("#p-focus");

  function resetPractice() {
    Object.assign(P, { levels: null, skills: null, q: null, lastGen: null, count: 0, right: 0, streak: 0 });
    pCard.hidden = true;
    pFocus.hidden = true;
    panels.practice.querySelectorAll("[data-level]").forEach((b) => b.setAttribute("aria-pressed", "false"));
  }

  function startPractice(levels, skills = null) {
    Object.assign(P, { levels: new Set(levels), skills: skills && new Set(skills), count: 0, right: 0, streak: 0, lastGen: null });
    panels.practice.querySelectorAll("[data-level]").forEach((b) =>
      b.setAttribute("aria-pressed", String(levels.length === 1 && b.dataset.level === levels[0])));
    pFocus.hidden = !skills;
    if (skills) pFocus.innerHTML = `🎯 Practising what you missed: <b>${skills.map((s) => SKILLS[s]).join(", ")}</b>. Pick a level above to go back to normal practice.`;
    nextPractice();
  }

  function nextPractice() {
    let pool = GENS.filter((g) => P.levels.has(g.level) && (!P.skills || P.skills.has(g.skill)));
    if (!pool.length) pool = GENS.filter((g) => P.levels.has(g.level));
    const choices = pool.length > 1 ? pool.filter((g) => g.id !== P.lastGen) : pool;
    const gen = pick(choices);
    P.lastGen = gen.id;
    P.q = make(gen);
    drawPractice();
  }

  const scoreLine = () => `✅ <b>${P.right}</b> / ${P.count}${P.streak >= 2 ? ` · 🔥 ${P.streak} in a row` : ""}`;

  function drawPractice() {
    const q = P.q;
    const levelText = P.levels.size === 1 ? LEVEL_NAME[[...P.levels][0]] : "Mixed";
    pCard.hidden = false;
    pCard.innerHTML = `<div class="qhead"><span>${levelText} · Question <b>${P.count + 1}</b></span><span data-score>${scoreLine()}</span></div>`;
    const view = questionView(q);
    pCard.appendChild(view.el);
    const hint = document.createElement("p");
    hint.className = "hint";
    const actions = document.createElement("div");
    actions.className = "qactions";
    actions.innerHTML = '<button type="button" class="primary" data-act="check">Check answer</button>';
    const feedback = document.createElement("div");
    pCard.append(hint, actions, feedback);

    let checked = false;
    const check = () => {
      if (checked) return next();
      const given = view.read();
      if (given === null) {
        hint.textContent = q.kind === "mc" ? "Tap an answer first." : "Type a number first.";
        return;
      }
      checked = true;
      hint.textContent = "";
      const ok = isCorrect(q, given);
      P.count += 1;
      if (ok) { P.right += 1; P.streak += 1; } else P.streak = 0;
      view.lock(true);
      const kid = Kids.current();
      const reward = kid ? Kids.practiceAnswer(kid.id, { ok, level: q.level, skill: q.skill, streak: P.streak }) : null;
      feedback.innerHTML = feedbackHTML(q, given, ok)
        + (reward?.points ? `<div class="claw-gain">+${reward.points} 🐾 <span>${reward.lines.map(([, why]) => why).join(" · ")}</span></div>` : "");
      celebrate(reward);
      actions.innerHTML = '<button type="button" class="primary" data-act="next">Next question →</button>';
      actions.querySelector("button").focus({ preventScroll: true });
      pCard.querySelector("[data-score]").innerHTML = scoreLine();
      feedback.scrollIntoView({ behavior: "smooth", block: "nearest" });
    };
    const next = () => { nextPractice(); pCard.scrollIntoView({ behavior: "smooth", block: "nearest" }); };
    actions.addEventListener("click", (e) => {
      const act = e.target.closest("[data-act]")?.dataset.act;
      if (act === "check") check();
      if (act === "next") next();
    });
    view.onEnter(check);
    view.focus();
  }

  panels.practice.querySelectorAll("[data-level]").forEach((b) =>
    b.addEventListener("click", () => startPractice([b.dataset.level])));

  // --- results, shared by the test and the parent page ----------------------
  function scoreBlock(a, heading, newBest = false) {
    const stars = a.pct >= 90 ? 3 : a.pct >= 70 ? 2 : a.pct >= 50 ? 1 : 0;
    return `<div class="lead">${heading}</div>
      <div class="stars" aria-label="${stars} out of 3 stars">${"⭐".repeat(stars)}${"☆".repeat(3 - stars)}</div>
      <div class="score">${a.right} / ${a.total}</div>
      <div class="pct">${a.pct}%${newBest ? " · New best! 🏅" : ""}</div>`;
  }

  function skillTally(items) {
    const by = {};
    for (const it of items) {
      const s = (by[it.skill] ||= { right: 0, total: 0 });
      s.total += 1;
      if (it.ok) s.right += 1;
    }
    return by;
  }

  const skillBars = (by) => `<div class="skills">${Object.entries(by).map(([s, v]) => {
    const p = v.right / v.total;
    const colour = p >= 0.8 ? "var(--good)" : p >= 0.5 ? "var(--u-kg)" : "var(--bad)";
    return `<div class="skill"><span>${SKILLS[s] || esc(s)}</span><div class="bar"><div style="width:${Math.max(p * 100, 3)}%;background:${colour}"></div></div><span class="n">${v.right}/${v.total}</span></div>`;
  }).join("")}</div>`;

  const reviewItem = (it, i, yours) => `
    <div class="ritem ${it.ok ? "ok" : ""}">
      <div class="rq">${it.ok ? "✅" : "❌"} ${i + 1}. ${it.prompt}</div>
      ${it.visual ? `<div class="visual">${it.visual}</div>` : ""}
      <div class="rrow"><span>${yours}: <span class="mine">${esc(it.given)}</span></span>
        ${it.ok ? "" : `<span>Right answer: <span class="right">${esc(it.answer)}</span></span>`}</div>
      ${it.ok ? "" : `<div class="rwhy"><b>What went wrong:</b> ${it.why}</div>`}
      <details ${it.ok ? "" : "open"}><summary>How to do it</summary>${stepsHTML(it)}</details>
    </div>`;

  function reviewCard(items, yours = "Your answer") {
    const wrong = items.filter((it) => !it.ok).length;
    return `<div class="card review-card" data-show="all">
      <div class="review-head">
        <h2>Review the answers</h2>
        <div class="filter">
          <button type="button" data-filter="all" aria-pressed="true">All (${items.length})</button>
          <button type="button" data-filter="wrong" aria-pressed="false">Mistakes (${wrong})</button>
        </div>
      </div>
      <div class="review">${items.map((it, i) => reviewItem(it, i, yours)).join("")}
        ${wrong ? "" : '<p class="lead only-wrong">No mistakes to show — every answer was right! 🎉</p>'}</div>
    </div>`;
  }

  // --- tests ---------------------------------------------------------------
  const T = { id: null, list: [], answers: [], i: 0, active: false, started: 0, kidId: null };

  function drawTestMenu() {
    const kid = Kids.current();
    const best = (id) => kid?.stats.best[id];
    panels.test.innerHTML = `
      <div class="card">
        <h2>Tests</h2>
        <p class="lead">No hints during a test. At the end you get your score, Claw Points 🐾, and a review of every question. Every test is saved so a grown-up can look at it later.</p>
        <div class="tests">${Object.entries(TESTS).map(([id, t]) => `
          <button type="button" data-test="${id}"><span style="font-size:24px" aria-hidden="true">${t.icon}</span>${t.name}
            <small>${t.blurb}</small>${best(id) !== undefined ? `<span class="best">Your best: ${best(id)}%</span>` : ""}</button>`).join("")}</div>
      </div>`;
    panels.test.querySelectorAll("[data-test]").forEach((b) => b.addEventListener("click", () => startTest(b.dataset.test)));
  }

  function startTest(id) {
    const kid = Kids.current();
    if (!kid) return showView("test");
    Object.assign(T, { id, list: buildSet(TESTS[id].plan), answers: [], i: 0, active: true, started: Date.now(), kidId: kid.id });
    drawTestQuestion();
    root.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function drawTestQuestion() {
    const q = T.list[T.i], n = T.list.length, last = T.i === n - 1;
    const kid = Kids.get(T.kidId);
    panels.test.innerHTML = `<div class="card">
      <div class="qhead"><span>${kid ? `${kid.avatar} ${esc(kid.name)} · ` : ""}${TESTS[T.id].name} · Question <b>${T.i + 1}</b> of ${n}</span>
        <button type="button" data-act="quit" class="small">Stop test</button></div>
      <div class="progress" aria-hidden="true"><div style="width:${(T.i / n) * 100}%"></div></div>
      <div data-q></div>
      <p data-hint class="hint"></p>
      <div class="qactions">
        <button type="button" data-act="skip">Skip</button>
        <button type="button" class="primary" data-act="next">${last ? "Finish ✓" : "Next →"}</button>
      </div></div>`;
    const view = questionView(q);
    panels.test.querySelector("[data-q]").appendChild(view.el);
    const hint = panels.test.querySelector("[data-hint]");

    const advance = (given) => {
      T.answers[T.i] = given;
      if (last) return finishTest();
      T.i += 1;
      drawTestQuestion();
    };
    const next = () => {
      const given = view.read();
      if (given === null) {
        hint.textContent = q.kind === "mc" ? "Tap an answer, or press Skip." : "Type a number, or press Skip.";
        return;
      }
      advance(given);
    };
    panels.test.querySelector(".card").addEventListener("click", (e) => {
      const act = e.target.closest("[data-act]")?.dataset.act;
      if (act === "next") next();
      if (act === "skip") advance(null);
      if (act === "quit") { T.active = false; drawTestMenu(); }
    });
    view.onEnter(next);
    view.focus();
  }

  function finishTest() {
    // Questions are stored as the text and pictures shown, so a parent sees
    // exactly what the child saw even after the question code changes.
    const items = T.list.map((q, i) => {
      const given = T.answers[i] ?? null;
      const ok = isCorrect(q, given);
      return {
        prompt: q.prompt, visual: q.visual || "", given: givenText(q, given), answer: answerText(q), ok,
        why: ok ? "" : whatWentWrong(q, given), steps: q.steps, skill: q.skill, level: q.level,
      };
    });
    const right = items.filter((it) => it.ok).length;
    const attempt = {
      topic: "mass", testId: T.id, testName: TESTS[T.id].name, at: Date.now(),
      durationSec: Math.round((Date.now() - T.started) / 1000),
      right, total: items.length, pct: Math.round((right / items.length) * 100), items,
    };
    const reward = Kids.finishTest(T.kidId, attempt);
    T.active = false;
    celebrate(reward);
    drawResults(attempt, reward);
  }

  function drawResults(attempt, reward) {
    const pct = attempt.pct;
    const message = pct === 100 ? "Purrfect score! You really know your masses. 😻"
      : pct >= 80 ? "Great work! Check the few you missed below."
      : pct >= 60 ? "Good effort. Read through the mistakes below — they show exactly how to fix them."
      : "Keep going! Read the review below, have another look at the Learn tab, then try some practice.";
    const wrong = attempt.items.filter((it) => !it.ok);
    const missedSkills = [...new Set(wrong.map((it) => it.skill))];
    const kid = Kids.get(T.kidId);
    const rewardBox = reward ? `
      <div class="reward-box">
        <div class="reward-total">+${reward.points} 🐾 Claw Points</div>
        <ul>${reward.lines.map(([p, why]) => `<li><span>${why}</span><b>+${p}</b></li>`).join("")}</ul>
        ${reward.newBadges.map((b) => `<div class="badge-new">${b.icon} New badge: <b>${b.name}</b></div>`).join("")}
        ${reward.rankUp ? `<div class="badge-new">${reward.rankUp.icon} You're now a <b>${reward.rankUp.name}</b>!</div>` : ""}
      </div>` : "";

    panels.test.innerHTML = `
      <div class="card result-top">
        ${scoreBlock(attempt, `${kid ? `${kid.avatar} ${esc(kid.name)} · ` : ""}${attempt.testName} — results`, reward?.newBest)}
        <p>${message}</p>
        ${rewardBox}
        <p class="note">${reward ? "✓ Saved for a grown-up to review." : "This result could not be saved."}</p>
        <div class="qactions">
          ${missedSkills.length ? '<button type="button" class="primary" data-res="weak">🎯 Practise what I missed</button>' : ""}
          <button type="button" data-res="again">Try this test again</button>
          <button type="button" data-res="menu">Choose another test</button>
        </div>
      </div>
      <div class="card"><h2>How you did on each skill</h2>${skillBars(skillTally(attempt.items))}</div>
      ${reviewCard(attempt.items)}`;

    panels.test.querySelector(".result-top .qactions").addEventListener("click", (e) => {
      const act = e.target.closest("[data-res]")?.dataset.res;
      if (act === "again") startTest(T.id);
      if (act === "menu") drawTestMenu();
      if (act === "weak") {
        drawTestMenu();
        showView("practice");
        startPractice([...new Set(wrong.map((it) => it.level))], missedSkills);
      }
    });
  }

  // --- rewards -------------------------------------------------------------
  function drawRewards() {
    const kid = Kids.current();
    if (!kid) return;
    const { rank, next, progress, toNext } = Kids.rankFor(kid.points);
    const earned = Kids.BADGES.filter((b) => kid.badges[b.id]).length;
    const pack = Kids.list().sort((a, b) => b.points - a.points);
    const P$ = Kids.POINTS;
    panels.rewards.innerHTML = `
      <div class="card hero">
        <div class="hero-av" aria-hidden="true">${kid.avatar}</div>
        <h2>${esc(kid.name)}</h2>
        <div class="claw-big">🐾 ${kid.points} <small>Claw Points</small></div>
        <div class="rank-line">${rank.icon} ${rank.name}</div>
        <div class="rank-bar" aria-hidden="true"><div style="width:${Math.round(progress * 100)}%"></div></div>
        <div class="note">${next ? `${toNext} more 🐾 to become a <b>${next.icon} ${next.name}</b>` : "You are the top cat! 🦁👑"}</div>
      </div>

      <div class="card">
        <h2>Badges <small class="muted">${earned} of ${Kids.BADGES.length}</small></h2>
        <div class="badges">${Kids.BADGES.map((b) => `
          <div class="badge ${kid.badges[b.id] ? "" : "locked"}">
            <div class="b-icon" aria-hidden="true">${kid.badges[b.id] ? b.icon : "🔒"}</div>
            <b>${b.name}</b><small>${kid.badges[b.id] ? `Earned ${new Date(kid.badges[b.id]).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}` : b.how}</small>
          </div>`).join("")}</div>
      </div>

      <div class="card">
        <h2>How to earn Claw Points 🐾</h2>
        <table class="guide">
          <tbody>
            <tr><td>Right answer in practice</td><td><b>Easy +${P$.practice.easy} · Medium +${P$.practice.medium} · Hard +${P$.practice.hard}</b></td></tr>
            <tr><td>Every ${P$.streakEvery} right in a row</td><td><b>+${P$.streakBonus} bonus</b></td></tr>
            <tr><td>Right answer in a test</td><td><b>Easy +${P$.test.easy} · Medium +${P$.test.medium} · Hard +${P$.test.hard}</b></td></tr>
            <tr><td>Finish a test</td><td><b>+${P$.testDone}</b></td></tr>
            <tr><td>100% on a test — Purrfect!</td><td><b>+${P$.purrfect}</b></td></tr>
            <tr><td>Beat your best score</td><td><b>+${P$.newBest}</b></td></tr>
          </tbody>
        </table>
      </div>

      <div class="card">
        <h2>Cat ranks</h2>
        <div class="ranks">${Kids.RANKS.map((r) => `
          <div class="rank ${r === rank ? "here" : kid.points >= r.min ? "done" : ""}"><span aria-hidden="true">${r.icon}</span><b>${r.name}</b><small>${r.min} 🐾</small></div>`).join("")}</div>
      </div>

      ${pack.length > 1 ? `<div class="card">
        <h2>The family cat pack</h2>
        <div class="pack">${pack.map((k, i) => `
          <div class="pack-row ${k === kid ? "me" : ""}"><span class="pos">${i + 1}</span><span class="av" aria-hidden="true">${k.avatar}</span>
            <span class="nm">${esc(k.name)}<small>${Kids.rankFor(k.points).rank.name}</small></span><b>🐾 ${k.points}</b></div>`).join("")}</div>
      </div>` : ""}

      <div class="card">
        <h2>Recent Claw Points</h2>
        ${kid.log.length ? `<div class="log">${kid.log.slice(0, 15).map((l) => `
          <div class="log-row"><span>${esc(l.why)}<small>${when(l.at)}</small></span><b>+${l.pts} 🐾</b></div>`).join("")}</div>`
          : '<p class="lead">Nothing yet — go and earn some in Practice or a Test!</p>'}
      </div>`;
  }

  // --- parents -------------------------------------------------------------
  const PV = { kid: "all", open: null, status: "" };

  function kidSummary(k) {
    const atts = Kids.attempts(k.id);
    const avg = atts.length ? Math.round(atts.reduce((s, a) => s + a.pct, 0) / atts.length) : null;
    const { rank } = Kids.rankFor(k.points);
    const bySkill = skillTally(atts.flatMap((a) => a.items));
    const weakest = Object.entries(bySkill).filter(([, v]) => v.total >= 3)
      .sort((a, b) => a[1].right / a[1].total - b[1].right / b[1].total)[0];
    const pr = k.stats.practiceAnswered ? Math.round((100 * k.stats.practiceRight) / k.stats.practiceAnswered) : null;
    const badges = Kids.BADGES.filter((b) => k.badges[b.id]).length;
    return `<div class="card kid-sum">
      <div class="ks-head"><span class="av" aria-hidden="true">${k.avatar}</span>
        <div><h2>${esc(k.name)}</h2><div class="lead">${rank.icon} ${rank.name} · 🐾 ${k.points} Claw Points · ${badges}/${Kids.BADGES.length} badges</div></div></div>
      <div class="stat-grid">
        <div><b>${atts.length}</b><small>tests taken</small></div>
        <div><b>${avg === null ? "–" : `${avg}%`}</b><small>average test score</small></div>
        <div><b>${k.stats.practiceAnswered}</b><small>practice questions${pr === null ? "" : ` · ${pr}% right`}</small></div>
        <div><b>${atts[0] ? when(atts[0].at) : "–"}</b><small>last test</small></div>
      </div>
      <div class="chips">${Object.entries(TESTS).map(([id, t]) => {
        const b = k.stats.best[id];
        return `<span class="chip">${t.icon} ${t.name.replace(" test", "")} best: <b>${b === undefined ? "–" : `${b}%`}</b></span>`;
      }).join("")}</div>
      ${Object.keys(bySkill).length ? `<h3>Skills across all tests</h3>${skillBars(bySkill)}` : ""}
      ${weakest && weakest[1].right < weakest[1].total ? `<div class="tip">🎯 Needs the most work: <b>${SKILLS[weakest[0]] || esc(weakest[0])}</b> — ${weakest[1].right} of ${weakest[1].total} right in tests.</div>` : ""}
    </div>`;
  }

  function drawParents() {
    if (PV.open) return drawParentAttempt(PV.open);
    const kids = Kids.list();
    if (PV.kid !== "all" && !Kids.get(PV.kid)) PV.kid = "all";
    const shown = PV.kid === "all" ? kids : kids.filter((k) => k.id === PV.kid);
    const attempts = Kids.attempts(PV.kid === "all" ? null : PV.kid);
    const chips = [["all", "Everyone"], ...kids.map((k) => [k.id, `${k.avatar} ${esc(k.name)}`])];
    panels.parents.innerHTML = `
      <div class="card">
        <h2>👪 Parent review</h2>
        <p class="lead">Every finished test is saved here with each answer, what went wrong and the right method. Results are kept in this browser, on this device.</p>
        ${kids.length
          ? `<div class="filter">${chips.map(([id, label]) => `<button type="button" data-par="filter" data-id="${id}" aria-pressed="${PV.kid === id}">${label}</button>`).join("")}</div>`
          : "<p>No learners yet. Children add their name when they open Practice, Test or Rewards.</p>"}
      </div>
      ${shown.map(kidSummary).join("")}
      <div class="card">
        <h2>Saved tests <small class="muted">${attempts.length}</small></h2>
        ${attempts.length ? `<div class="att-list">${attempts.map((a) => `
          <button type="button" class="att-row" data-par="open" data-id="${a.id}">
            <span class="av" aria-hidden="true">${a.avatar}</span>
            <span class="att-main"><b>${esc(a.kidName)}</b> · ${esc(a.testName)}<small>${when(a.at)} · took ${duration(a.durationSec)}</small></span>
            <span class="att-score ${pctClass(a.pct)}">${a.right}/${a.total}<small>${a.pct}%</small></span>
          </button>`).join("")}</div>` : '<p class="lead">No tests taken yet.</p>'}
      </div>
      <div class="card">
        <h2>Backup and other devices</h2>
        <p>To look at results on a different phone or computer, export a backup here and import it there. Importing adds to what is already saved — nothing is overwritten.</p>
        <div class="qactions">
          <button type="button" data-par="export">⬇️ Export backup</button>
          <button type="button" data-par="import">⬆️ Import backup</button>
        </div>
        <input type="file" id="import-file" accept=".json,application/json" hidden>
        <p class="note" role="status">${esc(PV.status)}</p>
        ${kids.length ? `<h3>Learners</h3><div class="manage">${kids.map((k) => `
          <div class="manage-row"><span>${k.avatar} ${esc(k.name)} <small>${plural(Kids.attempts(k.id).length, "test")}</small></span>
            <button type="button" class="danger small" data-par="remove" data-id="${k.id}">Remove</button></div>`).join("")}</div>` : ""}
      </div>`;
    PV.status = "";
  }

  function drawParentAttempt(id) {
    const a = Kids.attempt(id);
    if (!a) { PV.open = null; return drawParents(); }
    panels.parents.innerHTML = `
      <div class="card"><div class="qactions" style="margin-top:0">
        <button type="button" data-par="back">← All results</button>
        <button type="button" class="danger" data-par="delete" data-id="${a.id}">Delete this result</button>
      </div></div>
      <div class="card result-top">
        ${scoreBlock(a, `${a.avatar} ${esc(a.kidName)} · ${esc(a.testName)}`)}
        <p class="note">${when(a.at)} · took ${duration(a.durationSec)} · earned 🐾 ${a.points}</p>
      </div>
      <div class="card"><h2>Skills</h2>${skillBars(skillTally(a.items))}</div>
      ${reviewCard(a.items, "Answer given")}`;
  }

  function exportBackup() {
    const blob = new Blob([Kids.exportData()], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `learning-results-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 2000);
  }

  panels.parents.addEventListener("click", (event) => {
    const b = event.target.closest("[data-par]");
    if (!b) return;
    const { par, id } = b.dataset;
    if (par === "filter") { PV.kid = id; drawParents(); }
    if (par === "open") { PV.open = id; drawParents(); root.scrollIntoView({ behavior: "smooth", block: "start" }); }
    if (par === "back") { PV.open = null; drawParents(); }
    if (par === "delete" && confirmed(b, "Tap again to delete")) { Kids.deleteAttempt(id); PV.open = null; drawParents(); }
    if (par === "remove" && confirmed(b, "Tap again: removes their points and tests")) { Kids.remove(id); onKidChange(); drawParents(); }
    if (par === "export") exportBackup();
    if (par === "import") panels.parents.querySelector("#import-file").click();
  });

  panels.parents.addEventListener("change", async (event) => {
    const input = event.target;
    if (input.id !== "import-file" || !input.files[0]) return;
    try {
      const result = Kids.importData(await input.files[0].text(), sanitizeHTML);
      PV.status = `Imported ${plural(result.attemptsAdded, "test")} and ${plural(result.kidsAdded, "new learner")}.`;
    } catch (err) {
      PV.status = err instanceof SyntaxError ? "That file is not a learning backup." : err.message;
    }
    drawLearnerBar();
    drawParents();
  });

  // Another tab on this device changed the saved data.
  window.addEventListener("learnkids:change", () => {
    drawLearnerBar();
    if (!panels.rewards.hidden) drawRewards();
    if (!panels.parents.hidden) drawParents();
  });

  drawLearnerBar();
  drawTestMenu();
})();
