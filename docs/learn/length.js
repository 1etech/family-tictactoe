// Topic 2 for the Learn tab (Year 4, Victorian Curriculum, Measurement):
// length in mm, cm, m and km. Unlike mass, the steps between units differ
// (10, 100 and 1000), so every builder works from the factor between the two
// units. Lengths are whole numbers of the smaller unit, so there is no
// floating-point drift.
(() => {
  "use strict";

  const C = globalThis.LearnCommon;
  const { rand, pick, shuffle, cap, fmt, esc, plural, fractionBar, parseNum } = C;

  const UNITS = ["mm", "cm", "m", "km"];
  const IN_MM = { mm: 1, cm: 10, m: 1000, km: 1000000 };
  const UNIT_NAME = { mm: "millimetres (mm)", cm: "centimetres (cm)", m: "metres (m)", km: "kilometres (km)" };
  const UNIT_WORD = { mm: "millimetres", cm: "centimetres", m: "metres", km: "kilometres" };
  const UNIT_ONE = { mm: "millimetre", cm: "centimetre", m: "metre", km: "kilometre" };
  const UNIT_WHY = {
    mm: "Very small things — narrower than your little fingernail, which is about 1 cm — are measured in millimetres.",
    cm: "Things you can hold, or that fit on your desk, are measured in centimetres.",
    m: "People's height, rooms, buildings, pools and big animals are measured in metres. A big step is about 1 m.",
    km: "Long distances between places are measured in kilometres. Walking 1 km takes about 12 to 15 minutes.",
  };

  /** How many of the small unit make one of the big unit: factor("m", "cm") = 100. */
  const factor = (big, small) => IN_MM[big] / IN_MM[small];
  const digitsOf = (fac) => String(fac).length - 1;           // 10 -> 1, 100 -> 2, 1000 -> 3
  const ZEROS = { 10: "one zero", 100: "two zeros", 1000: "three zeros" };

  /** 245 cm -> "2 m 45 cm". */
  function mixed(n, big, small) {
    const fac = factor(big, small), a = Math.floor(n / fac), b = n % fac;
    if (a && b) return `${a} ${big} ${b} ${small}`;
    return a ? `${a} ${big}` : `${b} ${small}`;
  }
  /** A length in millimetres as it is read on a ruler: "4 cm 7 mm". */
  const cmmm = (mm) => (mm % 10 === 0 ? `${mm / 10} cm` : mm < 10 ? `${mm} mm` : `${Math.floor(mm / 10)} cm ${mm % 10} mm`);

  const THINGS = [
    { e: "🐜", what: "the length of an ant", say: "An ant is about # long", num: 4, unit: "mm" },
    { e: "🍚", what: "the length of a grain of rice", say: "A grain of rice is about # long", num: 6, unit: "mm" },
    { e: "🐞", what: "the length of a ladybird", say: "A ladybird is about # long", num: 7, unit: "mm" },
    { e: "🪙", what: "how thick a coin is", say: "A coin is about # thick", num: 2, unit: "mm" },
    { e: "✏️", what: "the length of a pencil", say: "A new pencil is about # long", num: 18, unit: "cm" },
    { e: "🍌", what: "the length of a banana", say: "A banana is about # long", num: 20, unit: "cm" },
    { e: "📱", what: "the length of a phone", say: "A phone is about # long", num: 15, unit: "cm" },
    { e: "📏", what: "the length of a school ruler", say: "A school ruler is # long", num: 30, unit: "cm" },
    { e: "👟", what: "the length of a shoe", say: "A Year 4 student's shoe is about # long", num: 22, unit: "cm" },
    { e: "🚪", what: "the height of a door", say: "A door is about # tall", num: 2, unit: "m" },
    { e: "🦒", what: "the height of a giraffe", say: "A giraffe is about # tall", num: 5, unit: "m" },
    { e: "🚌", what: "the length of a bus", say: "A bus is about # long", num: 12, unit: "m" },
    { e: "🏊", what: "the length of a big swimming pool", say: "A big swimming pool is # long", num: 50, unit: "m" },
    { e: "🐋", what: "the length of a blue whale", say: "A blue whale is about # long", num: 25, unit: "m" },
    { e: "🏃", what: "the length of a fun run", say: "A fun run is about # long", num: 5, unit: "km" },
    { e: "🚴", what: "how far you go on a long bike ride", say: "A long bike ride is about #", num: 30, unit: "km" },
    { e: "🚗", what: "the distance from Melbourne to Geelong", say: "Melbourne to Geelong is about # by road", num: 75, unit: "km" },
    { e: "✈️", what: "the distance from Melbourne to Sydney", say: "Melbourne to Sydney is about # by plane", num: 700, unit: "km" },
  ];

  const NAMES = ["Mia", "Leo", "Ava", "Noah", "Zara", "Ethan", "Ruby", "Kai"];

  // --- pictures ------------------------------------------------------------
  const PX = 3, X0 = 16, TOP = 62;   // 3 px per millimetre
  /**
   * A centimetre ruler with millimetre marks and something lying along it,
   * from startMm to endMm. Kept to the few SVG tags the review page allows.
   */
  function rulerSVG({ maxCm, startMm, endMm, thing = "pencil", label }) {
    const x = (mm) => X0 + mm * PX;
    const W = X0 * 2 + maxCm * 10 * PX;
    let ticks = "";
    for (let i = 0; i <= maxCm * 10; i++) {
      const len = i % 10 === 0 ? 22 : i % 5 === 0 ? 15 : 9;
      ticks += `<line class="r-tick" x1="${x(i)}" y1="${TOP}" x2="${x(i)}" y2="${TOP + len}"/>`;
      if (i % 10 === 0) ticks += `<text class="svg-ink" x="${x(i)}" y="${TOP + 38}" font-size="13" font-weight="700" text-anchor="middle">${i / 10}</text>`;
    }
    const a = x(startMm), b = x(endMm), y = 22, h = 22;
    let shape;
    if (thing === "ribbon") {
      shape = `<rect class="obj-ribbon" x="${a}" y="${y + 5}" width="${b - a}" height="${h - 10}" rx="2"/>`;
    } else {
      const tip = 15, back = thing === "pencil" ? 9 : 0;
      shape = (back ? `<rect class="obj-eraser" x="${a}" y="${y}" width="${back}" height="${h}" rx="3"/>` : "")
        + `<rect class="obj-${thing}" x="${a + back}" y="${y}" width="${b - a - back - tip}" height="${h}" rx="${back ? 0 : 3}"/>`
        + `<path class="${thing === "pencil" ? "obj-wood" : `obj-${thing}`}" d="M${b - tip} ${y} L${b} ${y + h / 2} L${b - tip} ${y + h} Z"/>`
        + (thing === "pencil" ? `<path class="obj-lead" d="M${b - 5} ${y + h / 2 - 3.5} L${b} ${y + h / 2} L${b - 5} ${y + h / 2 + 3.5} Z"/>` : "");
    }
    // Drawn 1.4× size, so a millimetre gets about 4 px before the page shrinks it to fit.
    return `<svg class="ruler" viewBox="0 0 ${W} ${TOP + 74}" width="${Math.round(W * 1.4)}" height="${Math.round((TOP + 74) * 1.4)}" role="img" aria-label="${esc(label)}">
      ${shape}
      <line class="r-guide" x1="${a}" y1="${y + h}" x2="${a}" y2="${TOP}"/>
      <line class="r-guide" x1="${b}" y1="${y + h}" x2="${b}" y2="${TOP}"/>
      <rect class="r-body" x="${X0 - 10}" y="${TOP}" width="${W - 2 * X0 + 20}" height="54" rx="4"/>
      ${ticks}
      <text class="svg-muted" x="${x(maxCm * 10)}" y="${TOP + 70}" font-size="11" text-anchor="end">cm</text>
    </svg>`;
  }

  /** Place value chart split where the big unit ends and the small unit starts. */
  function placeChart(n, big, small) {
    const fac = factor(big, small), k = digitsOf(fac);
    const digits = String(n).padStart(k + 1, "0").split("");
    const cols = digits.length, bigCols = cols - k;
    const PLACES = ["1s", "10s", "100s", "1000s", "10 000s"];
    const side = (i) => (i < bigCols ? "b" : "s");
    return `<div class="pvx pvx-c${cols}" role="img" aria-label="${n} ${small} is ${mixed(n, big, small)}">
      ${digits.map((_, i) => `<div class="h ${side(i)}">${PLACES[cols - 1 - i]}</div>`).join("")}
      ${digits.map((d, i) => `<div class="d ${side(i)}">${d}</div>`).join("")}
      <div class="lab b sp${bigCols}">${big}</div><div class="lab s sp${k}">${small}</div>
    </div>`;
  }

  // --- question building blocks -------------------------------------------
  /** Spots the classic slips: the wrong ×10/×100/×1000, wrong direction, no change. */
  function convDiag(given, start, dir, from, to) {
    const big = dir === "down" ? from : to, small = dir === "down" ? to : from, fac = factor(big, small);
    if (given === start) return "You wrote the same number. The unit changed, so the number has to change too.";
    for (const w of [10, 100, 1000, 10000]) {
      if (w === fac) continue;
      if (dir === "down" && given === start * w) return `You multiplied by ${w}. There are <b>${fac}</b> ${small} in 1 ${big}, so multiply by ${fac}.`;
      if (dir === "up" && given === start / w) return `You divided by ${w}. There are <b>${fac}</b> ${small} in 1 ${big}, so divide by ${fac}.`;
    }
    if (dir === "down" && given * fac === start) return `You divided, but ${UNIT_WORD[small]} are a smaller unit, so the number should get <b>bigger</b>. Multiply by ${fac}.`;
    if (dir === "up" && given === start * fac) return `You multiplied, but ${UNIT_WORD[big]} are a bigger unit, so the number should get <b>smaller</b>. Divide by ${fac}.`;
    return null;
  }

  /** One change of unit, e.g. m -> cm or mm -> cm. */
  function simpleConv(n, from, to) {
    const dir = UNITS.indexOf(to) < UNITS.indexOf(from) ? "down" : "up";
    const fac = dir === "down" ? factor(from, to) : factor(to, from);
    const answer = dir === "down" ? n * fac : n / fac;
    const steps = dir === "down"
      ? [
          `1 ${from} = ${fac} ${to}.`,
          `${cap(UNIT_WORD[to])} are a <b>smaller</b> unit, so the number gets <b>bigger</b>: multiply by ${fac}.`,
          `${fmt(n)} × ${fac} = ${fmt(answer)} (× ${fac} adds ${ZEROS[fac]} on the end).`,
          `So ${fmt(n)} ${from} = <b>${fmt(answer)} ${to}</b>.`,
        ]
      : [
          `${fac} ${from} = 1 ${to}.`,
          `${cap(UNIT_WORD[to])} are a <b>bigger</b> unit, so the number gets <b>smaller</b>: divide by ${fac}.`,
          `${fmt(n)} ÷ ${fac} = ${fmt(answer)} (÷ ${fac} takes ${ZEROS[fac]} off the end).`,
          `So ${fmt(n)} ${from} = <b>${fmt(answer)} ${to}</b>.`,
        ];
    return {
      skill: "convert",
      prompt: `Change <b>${fmt(n)} ${from}</b> into ${UNIT_WORD[to]}.`,
      kind: "num", unit: to, answer, steps,
      diagnose: (g) => convDiag(g, n, dir, from, to),
    };
  }

  /** "2 m 45 cm = ? cm" */
  function mixToSmall(a, b, big, small) {
    const fac = factor(big, small), k = digitsOf(fac);
    const answer = a * fac + b;
    const concat = Number(`${a}${b}`);
    const short = String(b).length < k;
    const steps = [
      `Change the ${UNIT_WORD[big]} first: ${a} ${big} = ${a} × ${fac} = ${a * fac} ${small}.`,
      `Now add the ${UNIT_WORD[small]}: ${a * fac} + ${b} = ${answer}.`,
    ];
    if (short) steps.push(`Watch the zeros! The ${UNIT_WORD[small]} take up ${k} places, so ${b} ${small} is written <b>${String(b).padStart(k, "0")}</b>.`);
    steps.push(`Check with place value: ${placeChart(answer, big, small)}`, `So ${a} ${big} ${b} ${small} = <b>${fmt(answer)} ${small}</b>.`);
    return {
      skill: "convert",
      prompt: `Change <b>${a} ${big} ${b} ${small}</b> into ${UNIT_WORD[small]}.`,
      kind: "num", unit: small, answer, steps,
      diagnose: (g) => {
        if (short && g === concat) return `Watch the zeros! You wrote ${a} and ${b} side by side. ${a} ${big} is ${a * fac} ${small}, then add ${b} to get ${answer}.`;
        for (const w of [10, 100, 1000]) {
          if (w !== fac && g === a * w + b) return `You changed ${a} ${big} into ${a * w} ${small}. Remember 1 ${big} = ${fac} ${small}, so ${a} ${big} = ${a * fac} ${small}.`;
        }
        if (g === a + b) return `You added ${a} and ${b} straight away. Change ${a} ${big} into ${UNIT_WORD[small]} (${a * fac} ${small}) first, then add.`;
        if (g === a * fac) return `You changed the ${UNIT_WORD[big]} correctly but forgot to add the ${b} ${small}.`;
        if (g === b) return `You forgot the ${a} ${big}. That is another ${a * fac} ${small} to add on.`;
        return null;
      },
    };
  }

  /** "245 cm = ? m ? cm" */
  function smallToPair(a, b, big, small) {
    const fac = factor(big, small), k = digitsOf(fac);
    const n = a * fac + b, pad = String(b).padStart(k, "0");
    const lastDigits = k === 1 ? "last digit" : `last ${k} digits`;
    return {
      skill: "convert",
      prompt: `Write <b>${fmt(n)} ${small}</b> in ${UNIT_WORD[big]} and ${UNIT_WORD[small]}.`,
      kind: "pair", labels: [big, small], answer: { big: a, small: b },
      steps: [
        `${fac} ${small} = 1 ${big}, so the ${lastDigits} are the ${UNIT_WORD[small]} and the digits in front are the ${UNIT_WORD[big]}.`,
        `${n} → <b>${a} ${big}</b> and ${pad} → <b>${b} ${small}</b>.`,
        placeChart(n, big, small),
        `So ${fmt(n)} ${small} = <b>${a} ${big} ${b} ${small}</b>.`,
      ],
      diagnose: ({ big: gb, small: gs }) => {
        if (gb === a && gs !== b) return `The ${UNIT_WORD[big]} are right. The ${UNIT_WORD[small]} are the ${lastDigits}: ${pad}, which is ${b} ${small}.`;
        for (const w of [10, 100, 1000]) {
          if (w !== fac && gb !== a && gb === Math.floor(n / w)) return `You split the number in the wrong place. 1 ${big} = ${fac} ${small}, so only the ${lastDigits} are ${UNIT_WORD[small]} (${b} ${small}) and the rest is ${a} ${big}.`;
        }
        if (gs === b && gb !== a) return `The ${UNIT_WORD[small]} are right. The ${UNIT_WORD[big]} are the digits in front: ${a}.`;
        return null;
      },
    };
  }

  /** Measuring something on a ruler, possibly not starting at 0. */
  function rulerQ({ startMm, endMm, unit }) {
    // Only as much ruler as is needed, so the millimetre marks stay readable on a phone.
    const maxCm = Math.max(6, Math.ceil(endMm / 10) + 1);
    const thing = pick(["pencil", "crayon", "ribbon"]);
    const len = endMm - startMm;
    const answer = unit === "cm" ? len / 10 : len;
    const steps = [startMm === 0
      ? `The ${thing} starts at <b>0</b>, so its length is the number where it ends.`
      : `Careful — the ${thing} does <b>not</b> start at 0. It starts at <b>${startMm / 10} cm</b>.`];
    steps.push(endMm % 10
      ? `The end is ${plural(endMm % 10, "small mark")} past the ${Math.floor(endMm / 10)}. Each small mark is 1 mm, so it ends at <b>${cmmm(endMm)}</b>.`
      : `It ends exactly at <b>${endMm / 10}</b>.`);
    if (startMm) {
      steps.push(unit === "cm"
        ? `Take away the start: ${endMm / 10} − ${startMm / 10} = ${answer} cm.`
        : `In millimetres it ends at ${endMm} mm and starts at ${startMm} mm: ${endMm} − ${startMm} = ${len} mm.`);
    } else if (unit === "mm" && len >= 10) {
      steps.push(`1 cm = 10 mm, so ${cmmm(len)} = ${Math.floor(len / 10)} × 10 + ${len % 10} = ${len} mm.`);
    }
    steps.push(`So the ${thing} is <b>${answer} ${unit}</b> long.`);
    return {
      skill: "scale",
      key: `ruler-${thing}-${startMm}-${endMm}-${unit}`,
      prompt: `How long is the ${thing}? Answer in ${UNIT_WORD[unit]}.`,
      visual: rulerSVG({ maxCm, startMm, endMm, thing, label: `A ${thing} lying along a ruler marked 0 to ${maxCm} cm` }),
      kind: "num", unit, answer, steps,
      diagnose: (g) => {
        const gmm = unit === "cm" ? g * 10 : g;
        if (startMm && gmm === endMm) return `You read the number where the ${thing} ends, but it starts at ${startMm / 10} cm, not 0. Take the start away from the end.`;
        if (startMm && gmm === endMm + startMm) return `You added the start. The ${thing} starts at ${startMm / 10} cm, so <b>take it away</b> from where it ends.`;
        if (unit === "mm" && len >= 10 && g === Math.floor(len / 10)) return `That is the number of whole centimetres. The question asks for millimetres, and 1 cm = 10 mm: ${cmmm(len)} = ${len} mm.`;
        if (unit === "mm" && len % 10 && g === Math.floor(len / 10) * 10) return `You forgot the small marks after the last centimetre. Each small mark is 1 mm.`;
        if (unit === "cm" && g === len) return `That number is in millimetres. The question asks for centimetres: ${len} mm = ${answer} cm.`;
        if (Math.abs(gmm - len) === 10) return "You're 1 cm out. Count the numbered marks again carefully, starting from where the object begins.";
        return null;
      },
    };
  }

  // --- the question generators ---------------------------------------------
  const unitChoices = UNITS.map((u) => ({ v: u, label: UNIT_NAME[u] }));
  const longer = (u, v) => UNITS.indexOf(u) > UNITS.indexOf(v);

  const GENS = [
    // ---------------- easy
    {
      id: "unit-choice", level: "easy", skill: "unit",
      make() {
        const t = pick(THINGS);
        return {
          prompt: `Which unit is best for measuring ${t.what}?`,
          visual: `<span class="emoji" aria-hidden="true">${t.e}</span>`,
          kind: "mc", choices: unitChoices, answer: t.unit,
          steps: [
            `${t.say.replace("#", `${t.num} ${t.unit}`)}.`,
            UNIT_WHY[t.unit],
            `So the best unit is <b>${UNIT_NAME[t.unit]}</b>.`,
          ],
          diagnose: (g) => (longer(g, t.unit)
            ? `${cap(UNIT_WORD[g])} are too big for ${t.what} — you would only need a tiny part of one.`
            : `${cap(UNIT_WORD[g])} are too small for ${t.what} — you would need a huge number of them.`),
        };
      },
    },
    {
      id: "m-cm", level: "easy", skill: "convert",
      make: () => (Math.random() < 0.6 ? simpleConv(rand(1, 9), "m", "cm") : simpleConv(rand(2, 9) * 100, "cm", "m")),
    },
    {
      id: "cm-mm", level: "easy", skill: "convert",
      make: () => (Math.random() < 0.5 ? simpleConv(rand(2, 15), "cm", "mm") : simpleConv(rand(2, 15) * 10, "mm", "cm")),
    },
    {
      id: "km-m", level: "easy", skill: "convert",
      make: () => (Math.random() < 0.5 ? simpleConv(rand(1, 9), "km", "m") : simpleConv(rand(2, 9) * 1000, "m", "km")),
    },
    {
      id: "same-number", level: "easy", skill: "compare",
      make() {
        const n = rand(2, 9);
        const [a, b] = shuffle(UNITS).slice(0, 2);
        const long = longer(a, b) ? a : b, short = long === a ? b : a;
        return {
          prompt: "Which is longer?",
          kind: "mc", choices: [a, b].map((u) => ({ v: u, label: `${n} ${u}` })), answer: long,
          steps: [
            `Both lengths have the number ${n}, so the <b>unit</b> decides.`,
            "From shortest to longest the units go: mm → cm → m → km.",
            `${cap(UNIT_WORD[long])} are longer than ${UNIT_WORD[short]}, so <b>${n} ${long}</b> is longer.`,
          ],
          diagnose: () => `Same number, but ${n} ${short} uses a smaller unit. A bigger unit means a longer length.`,
        };
      },
    },
    {
      id: "ruler-easy", level: "easy", skill: "scale",
      make: () => rulerQ({ startMm: 0, endMm: rand(3, 10) * 10, unit: "cm" }),
    },

    // ---------------- medium
    {
      id: "mix-to-small", level: "medium", skill: "convert",
      make() {
        const [big, small] = pick([["m", "cm"], ["m", "cm"], ["cm", "mm"], ["km", "m"]]);
        if (big === "m") return mixToSmall(rand(1, 8), rand(11, 99), big, small);
        if (big === "cm") return mixToSmall(rand(2, 15), rand(1, 9), big, small);
        return mixToSmall(rand(1, 8), rand(1, 9) * 100 + pick([0, 0, 50, 25, 75]), big, small);
      },
    },
    {
      id: "small-to-pair", level: "medium", skill: "convert",
      make() {
        const [big, small] = pick([["m", "cm"], ["m", "cm"], ["cm", "mm"], ["km", "m"]]);
        if (big === "m") return smallToPair(rand(1, 8), rand(11, 99), big, small);
        if (big === "cm") return smallToPair(rand(2, 15), rand(1, 9), big, small);
        return smallToPair(rand(1, 8), rand(1, 9) * 100 + pick([0, 0, 50, 25, 75]), big, small);
      },
    },
    {
      id: "fraction", level: "medium", skill: "convert",
      make() {
        const f = pick([
          { s: "½", w: "half", d: 2, n: 1, big: "m" },
          { s: "¼", w: "a quarter", d: 4, n: 1, big: "m" },
          { s: "¾", w: "three quarters", d: 4, n: 3, big: "m" },
          { s: "1/10", w: "one tenth", d: 10, n: 1, big: "m" },
          { s: "½", w: "half", d: 2, n: 1, big: "km" },
          { s: "¼", w: "a quarter", d: 4, n: 1, big: "km" },
          { s: "½", w: "half", d: 2, n: 1, big: "cm" },
        ]);
        const big = f.big, small = { m: "cm", km: "m", cm: "mm" }[big], fac = factor(big, small);
        const part = fac / f.d, answer = part * f.n;
        const steps = [`1 ${big} = ${fac} ${small}.`];
        if (f.n === 1) steps.push(`${cap(f.w)} means split it into ${f.d} equal parts: ${fac} ÷ ${f.d} = ${part}.`);
        else steps.push(`One quarter: ${fac} ÷ 4 = ${part}.`, `Three quarters: 3 × ${part} = ${answer}.`);
        steps.push(`So ${f.s} ${big} = <b>${answer} ${small}</b>.`);
        return {
          prompt: `How many ${UNIT_WORD[small]} are in <b>${f.s} ${big}</b> (${f.w} of a ${UNIT_ONE[big]})?`,
          visual: `<div style="width:min(100%,320px)">${fractionBar(f.d, f.n, `${part} ${small}`)}<div class="flabel" style="text-align:center">1 ${big} split into ${f.d} equal parts</div></div>`,
          kind: "num", unit: small, answer, steps,
          diagnose: (g) => {
            for (const w of [10, 100, 1000]) {
              if (w !== fac && g === (w / f.d) * f.n) return `You used ${w}. 1 ${big} = ${fac} ${small}, so ${f.s} ${big} = ${answer} ${small}.`;
            }
            if (f.n === 3 && g === part) return `That is one quarter. Three quarters is three of those parts: 3 × ${part} = ${answer}.`;
            return null;
          },
        };
      },
    },
    {
      id: "compare-mixed", level: "medium", skill: "compare",
      make() {
        const [big, small] = pick([["m", "cm"], ["m", "cm"], ["km", "m"]]);
        const fac = factor(big, small), step = fac / 10;
        const a = rand(1, 4), b = rand(2, 9) * step, A = a * fac + b;
        const r = Math.random();
        let B;
        if (r < 0.15) B = A;
        // A bigger-looking number that is really shorter, e.g. 145 cm against 1 m 50 cm.
        else if (r < 0.6) B = a * fac + rand(1, b / step - 1) * step + pick([0, step / 2]);
        else B = A + pick([step / 2, step, 3 * step]);
        const answer = A > B ? "A" : B > A ? "B" : "same";
        const labelA = `${a} ${big} ${b} ${small}`;
        const verdict = answer === "same"
          ? `${A} ${small} = ${B} ${small}, so they are <b>the same</b>.`
          : `${Math.max(A, B)} ${small} is more than ${Math.min(A, B)} ${small}, so <b>${answer === "A" ? labelA : `${B} ${small}`}</b> is longer.`;
        return {
          key: `cmp-${big}-${A}-${B}`,
          prompt: "Which is longer?",
          kind: "mc",
          choices: [{ v: "A", label: labelA }, { v: "B", label: `${B} ${small}` }, { v: "same", label: "They are the same" }],
          answer,
          steps: [
            `Change both lengths into the same unit — ${UNIT_WORD[small]}.`,
            `${labelA} = ${a * fac} + ${b} = ${A} ${small}.`,
            `The other one is already in ${UNIT_WORD[small]}: ${B} ${small}.`,
            verdict,
          ],
          diagnose: (g) => {
            if (answer === "A" && g === "B") return `${B} looks like a big number, but it is all in ${UNIT_WORD[small]}. ${labelA} is ${A} ${small}, which is more.`;
            if (answer === "same") return `Change ${labelA} into ${UNIT_WORD[small]}: it is exactly ${A} ${small} — the same as the other length.`;
            if (g === "same") return `They are not the same: one is ${A} ${small} and the other is ${B} ${small}.`;
            return `${labelA} is ${A} ${small}, which is less than ${B} ${small}.`;
          },
        };
      },
    },
    {
      id: "add-lengths", level: "medium", skill: "problem",
      make() {
        const who = pick(NAMES);
        if (Math.random() < 0.5) {
          const x = rand(12, 95), y = rand(12, 95), sum = x + y;
          return {
            prompt: `${who} has a red ribbon <b>${x} cm</b> long and a blue ribbon <b>${y} cm</b> long. What is their <b>total</b> length in centimetres?`,
            visual: '<span class="emoji" aria-hidden="true">🎀</span>',
            kind: "num", unit: "cm", answer: sum,
            steps: [
              "'Total' means add the lengths together.",
              `${x} + ${y} = ${sum}`,
              sum >= 100 ? `That is more than 1 m: ${sum} cm = ${mixed(sum, "m", "cm")}.` : "That is less than 1 m (100 cm).",
              `Answer: <b>${sum} cm</b>.`,
            ],
            diagnose: (g) => (g === Math.abs(x - y) ? "You took away. 'Total' means add the two lengths together." : null),
          };
        }
        const x = rand(3, 16) * 50, y = rand(3, 16) * 50, sum = x + y;
        return {
          prompt: `${who} walks <b>${x} m</b> to the park, then <b>${y} m</b> to the shop. How far is that <b>altogether</b>, in metres?`,
          visual: '<span class="emoji" aria-hidden="true">🚶</span>',
          kind: "num", unit: "m", answer: sum,
          steps: [
            "'Altogether' means add the distances.",
            `${x} + ${y} = ${sum}`,
            sum >= 1000 ? `That is more than 1 km: ${sum} m = ${mixed(sum, "km", "m")}.` : "That is less than 1 km (1000 m).",
            `Answer: <b>${sum} m</b>.`,
          ],
          diagnose: (g) => (g === Math.abs(x - y) ? "You took away. 'Altogether' means add the two distances." : null),
        };
      },
    },
    {
      id: "ruler-medium", level: "medium", skill: "scale",
      make() {
        let end; do end = rand(15, 115); while (end % 10 === 0);
        return rulerQ({ startMm: 0, endMm: end, unit: "mm" });
      },
    },
    {
      id: "sensible", level: "medium", skill: "unit",
      make() {
        const t = pick(THINGS);
        return {
          prompt: `${t.say.replace("#", "___")}. Which one makes sense?`,
          visual: `<span class="emoji" aria-hidden="true">${t.e}</span>`,
          kind: "mc", choices: UNITS.map((u) => ({ v: u, label: `${t.num} ${u}` })), answer: t.unit,
          steps: [
            "Use benchmarks: your little fingernail is about 1 cm wide, a big step is about 1 m, and a 12-minute walk is about 1 km.",
            UNIT_WHY[t.unit],
            `So: ${t.say.replace("#", `<b>${t.num} ${t.unit}</b>`)}.`,
          ],
          diagnose: (g) => (longer(g, t.unit)
            ? `${t.num} ${g} is far too long for ${t.what}.`
            : `${t.num} ${g} is far too short for ${t.what}.`),
        };
      },
    },

    // ---------------- hard
    {
      id: "zero-to-small", level: "hard", skill: "convert",
      make() {
        if (Math.random() < 0.4) return mixToSmall(rand(1, 9), rand(1, 9), "m", "cm");
        return mixToSmall(rand(1, 9), pick([rand(1, 9), rand(1, 9) * 10, rand(11, 99)]), "km", "m");
      },
    },
    {
      id: "zero-to-pair", level: "hard", skill: "convert",
      make() {
        if (Math.random() < 0.4) return smallToPair(rand(1, 9), rand(1, 9), "m", "cm");
        return smallToPair(rand(1, 9), pick([rand(1, 9), rand(1, 9) * 10, rand(11, 99)]), "km", "m");
      },
    },
    {
      id: "big-jump", level: "hard", skill: "convert",
      make() {
        const v = rand(0, 2);
        if (v === 0) return simpleConv(rand(1, 9), "m", "mm");
        if (v === 1) return simpleConv(rand(2, 9) * 1000, "mm", "m");
        // Halves written as decimals: 2.5 m, 1.5 km.
        const big = pick(["m", "km"]), small = big === "m" ? "cm" : "m", fac = factor(big, small);
        const a = rand(1, 9), answer = a * fac + fac / 2;
        return {
          prompt: `Change <b>${a}.5 ${big}</b> into ${UNIT_WORD[small]}.`,
          kind: "num", unit: small, answer,
          steps: [
            `${a}.5 ${big} means ${a} and a half ${UNIT_WORD[big]}.`,
            `${a} ${big} = ${a} × ${fac} = ${a * fac} ${small}.`,
            `Half a ${UNIT_ONE[big]} = ${fac} ÷ 2 = ${fac / 2} ${small}.`,
            `${a * fac} + ${fac / 2} = ${answer}.`,
            `So ${a}.5 ${big} = <b>${fmt(answer)} ${small}</b>.`,
          ],
          diagnose: (g) => {
            if (g === Number(`${a}5`)) return `You left out the decimal point. ${a}.5 ${big} is ${a} and a half ${UNIT_WORD[big]}, which is ${answer} ${small}.`;
            if (g === a * fac + 5) return `The .5 means <b>half</b> a ${UNIT_ONE[big]}, which is ${fac / 2} ${small}, not 5 ${small}.`;
            if (g === a * fac) return `You changed the ${a} ${UNIT_WORD[big]} but forgot the half: add ${fac / 2} ${small}.`;
            for (const w of [10, 100, 1000]) {
              if (w !== fac && g === a * w + w / 2) return `You used ${w}. 1 ${big} = ${fac} ${small}, so ${a}.5 ${big} = ${answer} ${small}.`;
            }
            return null;
          },
        };
      },
    },
    {
      id: "ruler-hard", level: "hard", skill: "scale",
      make() {
        const start = rand(1, 4) * 10;
        if (Math.random() < 0.4) return rulerQ({ startMm: start, endMm: start + rand(3, 7) * 10, unit: "cm" });
        let len; do len = rand(25, 79); while (len % 10 === 0);
        return rulerQ({ startMm: start, endMm: start + len, unit: "mm" });
      },
    },
    {
      id: "left-over", level: "hard", skill: "problem",
      make() {
        const who = pick(NAMES);
        const A = rand(2, 5);
        let U; do U = rand(3, A * 20 - 1) * 5; while (U % 100 === 0);
        const answer = A * 100 - U;
        return {
          prompt: `A roll holds <b>${A} m</b> of ribbon. ${who} cuts off <b>${U} cm</b>. How many centimetres of ribbon are left?`,
          visual: '<span class="emoji" aria-hidden="true">🎀✂️</span>',
          kind: "num", unit: "cm", answer,
          steps: [
            `The units are different, so change metres into centimetres first: ${A} m = ${A * 100} cm.`,
            `'Left' means take away: ${A * 100} − ${U} = ${answer}.`,
            `So <b>${answer} cm</b> is left${answer >= 100 ? ` (${mixed(answer, "m", "cm")})` : ""}.`,
          ],
          diagnose: (g) => {
            if (g === A * 100 + U) return "You added. 'How much is left' means take away.";
            if (g === U - A) return `You took away without changing units. Change ${A} m into ${A * 100} cm first.`;
            if (g === A * 1000 - U) return `1 m is 100 cm, not 1000 cm, so ${A} m = ${A * 100} cm.`;
            return null;
          },
        };
      },
    },
    {
      id: "groups", level: "hard", skill: "problem",
      make() {
        const v = rand(0, 2), who = pick(NAMES);
        if (v === 0) {
          const s = pick([20, 25, 50]), k = rand(2, 6), answer = (k * 100) / s;
          return {
            prompt: `Each of ${who}'s steps is <b>${s} cm</b> long. How many steps does it take to walk <b>${k} m</b>?`,
            visual: '<span class="emoji" aria-hidden="true">👣</span>',
            kind: "num", unit: "steps", answer,
            steps: [
              `Change to the same unit: ${k} m = ${k * 100} cm.`,
              `How many ${s}s fit into ${k * 100}? ${k * 100} ÷ ${s} = ${answer}.`,
              `Tip: ${100 / s} steps of ${s} cm make 1 m.`,
              `So it takes <b>${answer} steps</b>.`,
            ],
            diagnose: (g) => {
              if (g === (k * 1000) / s) return `1 m is 100 cm, not 1000 cm, so ${k} m = ${k * 100} cm. Then ${k * 100} ÷ ${s} = ${answer}.`;
              if (g === 100 / s) return `That is how many steps make 1 m. ${who} walks ${k} m, so ${k} × ${100 / s} = ${answer}.`;
              return null;
            },
          };
        }
        if (v === 1) {
          const [lap, k] = pick([[400, 2], [400, 4], [200, 1], [200, 2], [250, 1], [250, 2], [250, 3]]);
          const answer = (k * 1000) / lap;
          return {
            prompt: `One lap of the running track is <b>${lap} m</b>. How many laps make <b>${k} km</b>?`,
            visual: '<span class="emoji" aria-hidden="true">🏃‍♀️</span>',
            kind: "num", unit: "laps", answer,
            steps: [
              `Change to the same unit: ${k} km = ${k * 1000} m.`,
              `How many ${lap}s fit into ${k * 1000}? ${k * 1000} ÷ ${lap} = ${answer}.`,
              `So it takes <b>${answer} laps</b>.`,
            ],
            diagnose: (g) => {
              if (k > 1 && g === 1000 / lap) return `That is how many laps make 1 km. You need ${k} km, so ${k} × ${1000 / lap} = ${answer}.`;
              if (g === (k * 100) / lap || g === Math.round((k * 100) / lap)) return `1 km is 1000 m, so ${k} km = ${k * 1000} m. Then ${k * 1000} ÷ ${lap} = ${answer}.`;
              return null;
            },
          };
        }
        const w = pick([15, 20, 25, 30, 40]), n = rand(3, 8), answer = w * n;
        return {
          prompt: `${who} lays <b>${n} tiles</b> end to end in a row. Each tile is <b>${w} cm</b> long. How long is the row in centimetres?`,
          visual: `<span class="emoji" aria-hidden="true">${"🟧".repeat(n)}</span>`,
          kind: "num", unit: "cm", answer,
          steps: [
            `'Each' tells you every tile is the same, so multiply: ${n} × ${w} cm.`,
            `${n} × ${w} = ${answer}.`,
            `So the row is <b>${answer} cm</b> long${answer >= 100 ? ` (${mixed(answer, "m", "cm")})` : ""}.`,
          ],
          diagnose: (g) => (g === w + n ? "You added the numbers. 'Each' means equal groups, so multiply." : null),
        };
      },
    },
    {
      id: "longest", level: "hard", skill: "compare",
      make() {
        const a = rand(1, 4);
        const offsets = shuffle([5, 50, 15, 55, 25, 52, 9, 90, 45]).slice(0, 4);
        const forms = shuffle(["mix", "mix", "cm", "cm"]);
        const items = offsets.map((o, i) => {
          const cm = a * 100 + o;
          return { cm, label: forms[i] === "mix" ? `${a} m ${o} cm` : `${cm} cm` };
        });
        const longest = Math.random() < 0.6;
        const sorted = [...items].sort((x, y) => x.cm - y.cm);
        const target = longest ? sorted[3] : sorted[0];
        const word = longest ? "longest" : "shortest";
        return {
          key: `order-${word}-${items.map((i) => i.label).sort().join("|")}`,
          prompt: `Which length is the <b>${word}</b>?`,
          kind: "mc", choices: items.map((i) => ({ v: i.label, label: i.label })), answer: target.label,
          steps: [
            "Change every length into centimetres so you can compare them:",
            items.map((i) => `${i.label} = ${i.cm} cm`).join("<br>"),
            `Shortest to longest: ${sorted.map((i) => i.label).join(" → ")}`,
            `So the ${word} is <b>${target.label}</b>.`,
          ],
          diagnose: (g) => {
            const chosen = items.find((i) => i.label === g);
            return `${g} is ${chosen ? chosen.cm : "?"} cm. Change them all to centimetres and watch the zeros — for example ${a} m 5 cm is ${a * 100 + 5} cm, not ${a * 100 + 50} cm.`;
          },
        };
      },
    },
    {
      id: "race", level: "hard", skill: "problem",
      make() {
        const who = pick(NAMES);
        const R = rand(3, 9), a = rand(1, R - 1), b = rand(2, 18) * 50, done = a * 1000 + b, answer = R * 1000 - done;
        return {
          prompt: `A race is <b>${R} km</b> long. ${who} has run <b>${a} km ${b} m</b>. How many more metres to the finish?`,
          visual: '<span class="emoji" aria-hidden="true">🏁</span>',
          kind: "num", unit: "m", answer,
          steps: [
            "Change both to metres (1 km = 1000 m).",
            `The race is ${R} km = ${R * 1000} m. ${who} has run ${a} km ${b} m = ${done} m.`,
            `'How many more' means take away: ${R * 1000} − ${done} = ${answer}.`,
            `So there are <b>${answer} m</b> to go.`,
          ],
          diagnose: (g) => {
            if (g === (R - a) * 1000 + b) return `You added the ${b} m. Those metres are already run, so take them away too.`;
            if (g === R * 1000 + done) return "You added. 'How many more' means take away.";
            if (g === R - a) return "That is in kilometres. The question asks for metres: change everything to m first.";
            return null;
          },
        };
      },
    },
  ];

  const SKILLS = {
    convert: "Converting units",
    unit: "Choosing units",
    scale: "Reading rulers",
    compare: "Comparing lengths",
    problem: "Word problems",
  };

  const GENERIC = {
    convert: "Check the step: 1 cm = 10 mm, 1 m = 100 cm, 1 km = 1000 m. Going to a <b>smaller</b> unit, multiply; going to a <b>bigger</b> unit, divide.",
    unit: "Think about how long the thing really is, then compare it with a benchmark: a fingernail is about 1 cm wide, a big step is about 1 m, a 12-minute walk is about 1 km.",
    scale: "Find where the object starts and where it ends. If it doesn't start at 0, take the start away from the end. Each small mark on a ruler is 1 mm.",
    compare: "Change every length into the same unit before you compare them.",
    problem: "Find the key word: 'total' or 'altogether' → add, 'left' or 'how many more' → take away, 'each' → multiply, 'how many … make' → divide. Make the units match first.",
  };

  const TESTS = {
    "length-easy": { name: "Easy test", icon: "🌱", plan: [["easy", 10]], blurb: "10 questions · units, simple changes, rulers" },
    "length-medium": { name: "Medium test", icon: "🌿", plan: [["medium", 10]], blurb: "10 questions · m and cm, mm on rulers, fractions" },
    "length-hard": { name: "Hard test", icon: "🌳", plan: [["hard", 10]], blurb: "10 questions · zeros, decimals, problems" },
    "length-mixed": { name: "Mixed test", icon: "🏆", plan: [["easy", 4], ["medium", 4], ["hard", 4]], blurb: "12 questions · a bit of everything" },
  };

  // --- lesson --------------------------------------------------------------
  function lessonHTML() {
    const unitCard = (u, title, items, tag) => `
      <div class="unit u-${u}">
        <div class="sym">${u}</div>
        <div class="name">${title}</div>
        <ul>${items.map(([e, t]) => `<li><span class="e" aria-hidden="true">${e}</span><span>${t.replace(/(\d) (mm|cm|m|km)\b/g, "$1&nbsp;$2")}</span></li>`).join("")}</ul>
        <div class="tag">${tag}</div>
      </div>`;
    const example = (q, steps, a) => `
      <div class="example"><div class="q">${q}</div><ol>${steps.map((s) => `<li>${s}</li>`).join("")}</ol><div class="a">${a}</div></div>`;
    const sections = [
      ["l-what", "What is length?"], ["l-units", "The 4 units"], ["l-ladder", "10, 100, 1000"],
      ["l-convert", "Converting"], ["l-parts", "Parts of a metre"], ["l-ruler", "Using a ruler"],
      ["l-choose", "Best unit"], ["l-compare", "Comparing"], ["l-explore", "Converter"],
    ];
    return `
    <div class="card">
      <div class="topic-head"><div class="big" aria-hidden="true">📏</div>
        <div><h2>Topic 2 · Length</h2><div class="lead">Millimetres, centimetres, metres and kilometres</div></div></div>
      <div class="chips"><span class="chip">Year 4</span><span class="chip">Victorian Curriculum · Mathematics</span><span class="chip">Measurement</span></div>
      <p>By the end of this topic you will be able to:</p>
      <ul>
        <li>choose the best unit to measure a length or distance</li>
        <li>change between mm, cm, m and km</li>
        <li>measure with a ruler, even when the object doesn't start at 0</li>
        <li>compare and order lengths</li>
        <li>solve word problems about length</li>
      </ul>
      <div class="toc">${sections.map(([id, t], i) => `<button type="button" data-goto="${id}">${i + 1}. ${t}</button>`).join("")}</div>
    </div>

    <div class="card" id="l-what">
      <h2><span class="step-no">1</span>What is length?</h2>
      <p><b>Length</b> is how long something is from one end to the other. We measure it with a <b>ruler</b>, a <b>tape measure</b> or a <b>trundle wheel</b>.</p>
      <div class="visual">${rulerSVG({ maxCm: 12, startMm: 0, endMm: 90, thing: "pencil", label: "A pencil lying along a ruler from 0 to 9 cm" })}</div>
      <p style="text-align:center;color:var(--muted);font-size:14px">The pencil starts at 0 and ends at 9, so it is 9 cm long.</p>
      <div class="units">
        <div class="unit u-cm"><div class="name">↔️ Length · width</div><ul><li>How long or how wide something is</li></ul></div>
        <div class="unit u-m"><div class="name">↕️ Height</div><ul><li>How tall something is</li></ul></div>
        <div class="unit u-km"><div class="name">🗺️ Distance</div><ul><li>How far it is from one place to another</li></ul></div>
      </div>
    </div>

    <div class="card" id="l-units">
      <h2><span class="step-no">2</span>Meet the four units</h2>
      <p class="lead">From tiny to huge. Use the examples as <b>benchmarks</b> — things you can picture.</p>
      <div class="units">
        ${unitCard("mm", "millimetre", [["🐜", "an ant ≈ 4 mm long"], ["🍚", "a grain of rice ≈ 6 mm"], ["🪙", "a coin is about 2 mm thick"]], "For tiny things")}
        ${unitCard("cm", "centimetre", [["💅", "your little fingernail ≈ 1 cm wide"], ["✏️", "a new pencil ≈ 18 cm"], ["📏", "a school ruler = 30 cm"]], "For things on your desk")}
        ${unitCard("m", "metre", [["👣", "a big step ≈ 1 m"], ["🚪", "a door ≈ 2 m tall"], ["🏊", "a big pool = 50 m"]], "For people, rooms, buildings")}
        ${unitCard("km", "kilometre", [["🚶", "a 12–15 minute walk ≈ 1 km"], ["🏃", "a fun run = 5 km"], ["🚗", "Melbourne to Geelong ≈ 75 km"]], "For long distances")}
      </div>
      <div class="tip">💡 <b>milli</b> means one thousandth, <b>centi</b> means one hundredth and <b>kilo</b> means a thousand. You met kilo- and milli- in mass too!</div>
    </div>

    <div class="card" id="l-ladder">
      <h2><span class="step-no">3</span>Not always 1000!</h2>
      <p>In mass every step was × 1000. In length the steps are <b>different</b>:</p>
      <div class="ladder">
        <div class="rung u-km"><div class="box">1 kilometre (km) <small>= 1000 m</small></div><div class="arrow">× 1000 ↓</div></div>
        <div class="rung u-m"><div class="box">1 metre (m) <small>= 100 cm</small></div><div class="arrow">× 100 ↓</div></div>
        <div class="rung u-cm"><div class="box">1 centimetre (cm) <small>= 10 mm</small></div><div class="arrow">× 10 ↓</div></div>
        <div class="rung u-mm"><div class="box">1 millimetre (mm)</div><div class="arrow"></div></div>
      </div>
      <div class="arrows">
        <div><b>⬇️ To a smaller unit: multiply</b>The number gets <b>bigger</b>.<br>3 m → 3 × 100 = <b>300 cm</b></div>
        <div><b>⬆️ To a bigger unit: divide</b>The number gets <b>smaller</b>.<br>60 mm → 60 ÷ 10 = <b>6 cm</b></div>
      </div>
      <div class="tip">💡 Remember: <b>10</b> mm in a cm, <b>100</b> cm in a m, <b>1000</b> m in a km. And because 1 m = 100 cm = 100 × 10 mm, <b>1 m = 1000 mm</b>.</div>
    </div>

    <div class="card" id="l-convert">
      <h2><span class="step-no">4</span>Converting — worked examples</h2>
      <p>A place value chart helps. In a number of centimetres, the <b>last two digits</b> are the centimetres and the digits in front are the metres:</p>
      ${placeChart(245, "m", "cm")}
      <p>So <b>245 cm = 2 m 45 cm</b>.</p>
      <div class="examples">
        ${example("4 m = ? cm", ["Going to a smaller unit → × 100", "4 × 100 = 400"], "4 m = 400 cm")}
        ${example("70 mm = ? cm", ["Going to a bigger unit → ÷ 10", "70 ÷ 10 = 7"], "70 mm = 7 cm")}
        ${example("2 m 45 cm = ? cm", ["2 m = 200 cm", "200 + 45 = 245"], "2 m 45 cm = 245 cm")}
        ${example("6 cm 3 mm = ? mm", ["6 cm = 60 mm", "60 + 3 = 63"], "6 cm 3 mm = 63 mm")}
        ${example("3 km = ? m", ["1 km = 1000 m", "3 × 1000 = 3000"], "3 km = 3000 m")}
        ${example("2050 m = ? km ? m", ["Last three digits are metres: 050 → 50 m", "Thousands digit: 2 → 2 km"], "2050 m = 2 km 50 m")}
      </div>
      <div class="tip">⚠️ <b>Watch the zeros!</b> 3 m 5 cm is <b>305 cm</b>, not 35 cm. Centimetres take two places, so 5 cm is written 05.</div>
      ${placeChart(305, "m", "cm")}
    </div>

    <div class="card" id="l-parts">
      <h2><span class="step-no">5</span>Parts of a metre</h2>
      <p>1 m = 100 cm. Split it into equal parts:</p>
      <div class="flabel">½ m = 100 ÷ 2 = <b>50 cm</b></div>${fractionBar(2, 1, "50 cm")}
      <div class="flabel">¼ m = 100 ÷ 4 = <b>25 cm</b></div>${fractionBar(4, 1, "25 cm")}
      <div class="flabel">¾ m = 3 × 25 = <b>75 cm</b></div>${fractionBar(4, 3, "25 cm")}
      <div class="flabel">1/10 m = 100 ÷ 10 = <b>10 cm</b></div>${fractionBar(10, 1, "")}
      <p>It works for kilometres too: <b>½ km = 500 m</b> and <b>¼ km = 250 m</b>.</p>
      <div class="tip">💡 A decimal like <b>1.5 m</b> means one and a half metres: 100 + 50 = <b>150 cm</b>. And 2.5 km = 2000 + 500 = <b>2500 m</b>.</div>
    </div>

    <div class="card" id="l-ruler">
      <h2><span class="step-no">6</span>Measuring with a ruler</h2>
      <p>Each number on a ruler is a centimetre. The small marks between them are <b>millimetres</b> — 10 of them in every centimetre. Move the sliders to try it.</p>
      <div class="ruler-demo">
        <div id="lr-svg"></div>
        <div class="ruler-controls">
          <label>Where the pencil starts<input id="lr-start" type="range" min="0" max="40" step="10" value="0"></label>
          <label>Where the pencil ends<input id="lr-end" type="range" min="10" max="120" step="1" value="67"></label>
        </div>
        <div class="readout" id="lr-readout" aria-live="polite"></div>
      </div>
      <h3>How to measure</h3>
      <ol class="how-read">
        <li>Line up one end with the <b>0</b> — not the end of the ruler.</li>
        <li>Read the last <b>number</b> before the other end: that's the whole centimetres.</li>
        <li>Count the <b>small marks</b> after it: each one is 1 mm.</li>
        <li>If it doesn't start at 0, <b>take the start away</b> from the end.</li>
      </ol>
    </div>

    <div class="card" id="l-choose">
      <h2><span class="step-no">7</span>Choosing the best unit</h2>
      <table class="guide">
        <thead><tr><th>Unit</th><th>Use it for</th><th>Benchmark</th></tr></thead>
        <tbody>
          <tr><td><b style="color:var(--u-mg)">mm</b></td><td>Tiny things: insects, seeds, how thick something is</td><td>Much smaller than a fingernail</td></tr>
          <tr><td><b style="color:var(--u-g)">cm</b></td><td>Things you hold or that fit on a desk</td><td>💅 a fingernail ≈ 1 cm wide</td></tr>
          <tr><td><b style="color:var(--u-kg)">m</b></td><td>People, rooms, buildings, pools</td><td>👣 a big step ≈ 1 m</td></tr>
          <tr><td><b style="color:var(--u-t)">km</b></td><td>Distances between places</td><td>🚶 a 12–15 minute walk ≈ 1 km</td></tr>
        </tbody>
      </table>
      <div class="tip">💡 Ask yourself: "Would it fit on my fingernail? On my desk? In my classroom? Or would I need a car to get there?"</div>
    </div>

    <div class="card" id="l-compare">
      <h2><span class="step-no">8</span>Comparing and ordering</h2>
      <p><b>Always change to the same unit first.</b> Order these from shortest to longest:</p>
      <p style="font-weight:700">150 cm · 1 m 5 cm · 1 m 51 cm · 1 m 15 cm</p>
      <table class="guide">
        <thead><tr><th>Length</th><th>In centimetres</th></tr></thead>
        <tbody>
          <tr><td>1 m 5 cm</td><td><b>105 cm</b></td></tr>
          <tr><td>1 m 15 cm</td><td><b>115 cm</b></td></tr>
          <tr><td>150 cm</td><td><b>150 cm</b></td></tr>
          <tr><td>1 m 51 cm</td><td><b>151 cm</b></td></tr>
        </tbody>
      </table>
      <p>Shortest → longest: <b>1 m 5 cm, 1 m 15 cm, 150 cm, 1 m 51 cm</b>.</p>
      <div class="tip">⚠️ 1 m 5 cm is <b>105 cm</b>, not 150 cm. Watch the zero!</div>
    </div>

    <div class="card" id="l-explore">
      <h2><span class="step-no">9</span>Try the converter</h2>
      <p class="lead">Type any length and see it in every unit.</p>
      <div class="explorer">
        <input id="lx-n" type="text" inputmode="decimal" value="1.5" aria-label="Amount">
        <select id="lx-u" aria-label="Unit">
          <option value="mm">mm</option><option value="cm">cm</option><option value="m" selected>m</option><option value="km">km</option>
        </select>
      </div>
      <div class="conv" id="lx-out"></div>
    </div>

    <div class="card" style="text-align:center">
      <h2>Ready to try?</h2>
      <p class="lead">Practise with instant help, or take a test and see your results.</p>
      <div class="qactions"><button class="primary" data-view-go="practice">✏️ Start practice</button><button data-view-go="test">📝 Take a test</button></div>
    </div>`;
  }

  function rulerReadout(s, e) {
    const len = e - s;
    const lines = [`<div class="big">${len} mm</div><div>${len % 10 === 0 ? `= ${len / 10} cm` : len > 10 ? `= ${cmmm(len)}` : "&nbsp;"}</div>`];
    if (s === 0) {
      lines.push(`<p>The pencil starts at <b>0</b> and ends at <b>${cmmm(e)}</b>, so it is ${cmmm(e)} long.</p>`);
    } else {
      lines.push(`<p>The pencil starts at <b>${s / 10} cm</b>, not 0! It ends at <b>${cmmm(e)}</b>.</p>`,
        `<p>Take away the start: ${e} mm − ${s} mm = <b>${len} mm</b>.</p>`);
    }
    return lines.join("");
  }

  /** The ruler demo and the converter, once the lesson is on the page. */
  function wireLesson() {
    const start = document.getElementById("lr-start"), end = document.getElementById("lr-end");
    const draw = () => {
      // Keep the pencil at least 1 cm long.
      if (Number(end.value) < Number(start.value) + 10) end.value = Number(start.value) + 10;
      const s = Number(start.value), e = Number(end.value);
      document.getElementById("lr-svg").innerHTML = rulerSVG({ maxCm: 12, startMm: s, endMm: e, thing: "pencil", label: `A pencil from ${s / 10} cm to ${cmmm(e)} on a ruler` });
      document.getElementById("lr-readout").innerHTML = rulerReadout(s, e);
    };
    start.addEventListener("input", draw);
    end.addEventListener("input", draw);
    draw();

    const nice = (x) => (Math.round(x * 1e6) / 1e6).toLocaleString("en-AU", { maximumFractionDigits: 6 });
    const convert = () => {
      const n = parseNum(document.getElementById("lx-n").value);
      const out = document.getElementById("lx-out");
      if (n === null) {
        out.innerHTML = '<div class="u-cm" style="grid-column:1/-1">Type a number, like 1.5 or 750.</div>';
        return;
      }
      const mm = n * IN_MM[document.getElementById("lx-u").value];
      const cm = Math.round(mm / 10 * 1e6) / 1e6;
      out.innerHTML = UNITS.map((u) => {
        const extra = u === "m" && Number.isInteger(cm) && cm % 100 && cm > 100 ? `<small>= ${mixed(cm, "m", "cm")}</small>` : "";
        return `<div class="u-${u}"><b>${nice(mm / IN_MM[u])} ${u}</b><small>${UNIT_WORD[u]}</small>${extra ? "<br>" + extra : ""}</div>`;
      }).join("");
    };
    document.getElementById("lx-n").addEventListener("input", convert);
    document.getElementById("lx-u").addEventListener("change", convert);
    convert();
  }

  C.register({
    id: "length", number: 2, icon: "📏", name: "Length", subtitle: "Millimetres, centimetres, metres and kilometres",
    noun: "lengths", unitWords: UNIT_WORD, GENS, SKILLS, GENERIC, TESTS, lessonHTML, wireLesson,
    levelBlurb: { easy: "Units · simple changes · rulers", medium: "m + cm · mm on rulers · parts", hard: "Zeros · decimals · problems" },
  });
})();
