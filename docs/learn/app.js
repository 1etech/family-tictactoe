// The Learn tab: topic picker, lessons, practice, tests, Claw Point rewards
// and the parent page. Topic content comes from mass.js, length.js, … via
// LearnCommon; learners and saved tests come from kids.js.
(() => {
  "use strict";

  const C = globalThis.LearnCommon;
  const { pick, esc, plural, parseNum, make, isCorrect, answerText, givenText, whatWentWrong, buildSet, sanitizeHTML, LEVEL_NAME, PRAISE } = C;

  // --- page wiring ---------------------------------------------------------
  const root = document.getElementById("learn-root");
  if (!root) return;
  const Kids = window.LearnKids;
  const Sync = window.LearnSync;

  const VIEWS = [
    ["learn", "📖", "Learn"], ["practice", "✏️", "Practice"], ["test", "📝", "Test"],
    ["rewards", "🐾", "Rewards"], ["parents", "👪", "Parents"],
  ];
  root.innerHTML = `
    <nav class="topic-bar" id="topic-bar" aria-label="Topics"></nav>
    <nav class="subtabs" role="tablist" aria-label="Learning sections">
      ${VIEWS.map(([v, icon, text]) => `<button type="button" role="tab" data-view="${v}" aria-selected="${v === "learn"}"><span class="i" aria-hidden="true">${icon}</span><span>${text}</span></button>`).join("")}
    </nav>
    <div class="learner-bar" id="learner-bar"></div>
    ${VIEWS.map(([v]) => `<div data-panel="${v}"${v === "learn" ? "" : " hidden"}></div>`).join("")}
    <div data-panel="who" hidden></div>
    <div class="toasts" id="toasts" aria-live="polite"></div>`;

  const panels = Object.fromEntries([...root.querySelectorAll("[data-panel]")].map((el) => [el.dataset.panel, el]));
  const bar = root.querySelector("#learner-bar");
  const topicBar = root.querySelector("#topic-bar");

  // --- topics --------------------------------------------------------------
  // Learn, Practice and Test follow the chosen topic. Rewards and the parent
  // page cover every topic. The choice is remembered on this device.
  const TOPIC_KEY = "learn:topic";
  let topic = C.topics[0];
  try { topic = C.topic(localStorage.getItem(TOPIC_KEY)) || topic; } catch {}

  function drawTopicBar() {
    topicBar.innerHTML = C.topics.map((t) => `
      <button type="button" data-topic="${t.id}" aria-pressed="${t === topic}">
        <span class="ti" aria-hidden="true">${t.icon}</span><span><small>Topic ${t.number}</small>${t.name}</span></button>`).join("");
  }

  function setTopic(id) {
    topic = C.topic(id) || C.topics[0];
    try { localStorage.setItem(TOPIC_KEY, topic.id); } catch {}
    drawTopicBar();
    panels.learn.innerHTML = topic.lessonHTML();
    topic.wireLesson();
    drawPracticeMenu();
    T.active = false;
    drawTestMenu();
  }

  /** A skill's name in a topic ("Reading rulers"), or one that fits every topic. */
  const skillName = (s, t = null) => (t ? t.SKILLS[s] : SKILL_ANY[s]) || esc(s);
  const SKILL_ANY = {
    convert: "Converting units", unit: "Choosing units", scale: "Reading scales & rulers",
    compare: "Comparing & ordering", problem: "Word problems",
  };

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
    // The child's points bar does not belong on the grown-ups' page, and
    // rewards and the parent page cover every topic.
    bar.hidden = shown === "parents";
    topicBar.hidden = shown === "parents" || shown === "rewards";
    root.querySelectorAll(".subtabs [data-view]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.view === next)));
    if (shown === "rewards") drawRewards();
    if (shown === "parents") { drawParents(); Sync?.syncNow(); }
    if (scroll) root.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  root.addEventListener("click", (event) => {
    const tab = event.target.closest(".subtabs [data-view]");
    if (tab) return showView(tab.dataset.view);
    const pickTopic = event.target.closest("[data-topic]");
    if (pickTopic) {
      if (pickTopic.dataset.topic === topic.id) return;
      // Changing topic in the middle of a test would throw the test away.
      if (T.active && view === "test" && !pickTopic.dataset.armed) {
        pickTopic.dataset.armed = "1";
        setTimeout(() => { delete pickTopic.dataset.armed; }, 4000);
        const name = C.topic(pickTopic.dataset.topic).name;
        return toast(`<span class="t-icon">⚠️</span><span>Stop this test?<b>Tap ${esc(name)} again</b></span>`);
      }
      setTopic(pickTopic.dataset.topic);
      // Rewards and the parent page don't change with the topic; the rest do.
      return showView(view === "rewards" || view === "parents" ? "learn" : view, false);
    }
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
        const word = C.topic(q.topic)?.unitWords[label] || label;
        input.setAttribute("aria-label", q.kind === "pair" ? `Number of ${word}` : `Your answer in ${word}`);
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

  let pCard = null, pFocus = null;

  /** The level buttons for the current topic; starts with no question showing. */
  function drawPracticeMenu() {
    const level = (id, icon) => `<button type="button" data-level="${id}" aria-pressed="false"><span class="e" aria-hidden="true">${icon}</span>${LEVEL_NAME[id]}<small>${topic.levelBlurb[id]}</small></button>`;
    panels.practice.innerHTML = `
      <div class="card">
        <h2>${topic.icon} ${topic.name} practice</h2>
        <p class="lead">Pick a level. Every right answer earns 🐾 Claw Points — Easy +1, Medium +2, Hard +3, and a bonus for every 5 in a row.</p>
        <div class="levels">${level("easy", "🌱")}${level("medium", "🌿")}${level("hard", "🌳")}</div>
        <p id="p-focus" class="tip" hidden></p>
      </div>
      <div class="card" id="p-card" hidden></div>`;
    pCard = panels.practice.querySelector("#p-card");
    pFocus = panels.practice.querySelector("#p-focus");
    panels.practice.querySelectorAll("[data-level]").forEach((b) =>
      b.addEventListener("click", () => startPractice([b.dataset.level])));
    Object.assign(P, { levels: null, skills: null, q: null, lastGen: null, count: 0, right: 0, streak: 0 });
  }

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
    if (skills) pFocus.innerHTML = `🎯 Practising what you missed: <b>${skills.map((s) => skillName(s, topic)).join(", ")}</b>. Pick a level above to go back to normal practice.`;
    nextPractice();
  }

  function nextPractice() {
    let pool = topic.GENS.filter((g) => P.levels.has(g.level) && (!P.skills || P.skills.has(g.skill)));
    if (!pool.length) pool = topic.GENS.filter((g) => P.levels.has(g.level));
    const choices = pool.length > 1 ? pool.filter((g) => g.id !== P.lastGen) : pool;
    const gen = pick(choices);
    P.lastGen = gen.id;
    P.q = make(gen, topic);
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

  const skillBars = (by, t = null) => `<div class="skills">${Object.entries(by).map(([s, v]) => {
    const p = v.right / v.total;
    const colour = p >= 0.8 ? "var(--good)" : p >= 0.5 ? "var(--u-kg)" : "var(--bad)";
    return `<div class="skill"><span>${skillName(s, t)}</span><div class="bar"><div style="width:${Math.max(p * 100, 3)}%;background:${colour}"></div></div><span class="n">${v.right}/${v.total}</span></div>`;
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
  const T = { id: null, topic: null, list: [], answers: [], i: 0, active: false, started: 0, kidId: null };

  function drawTestMenu() {
    const kid = Kids.current();
    const best = (id) => kid?.stats.best[id];
    panels.test.innerHTML = `
      <div class="card">
        <h2>${topic.icon} ${topic.name} tests</h2>
        <p class="lead">No hints during a test. At the end you get your score, Claw Points 🐾, and a review of every question. Every test is saved so a grown-up can look at it later.</p>
        <div class="tests">${Object.entries(topic.TESTS).map(([id, t]) => `
          <button type="button" data-test="${id}"><span style="font-size:24px" aria-hidden="true">${t.icon}</span>${t.name}
            <small>${t.blurb}</small>${best(id) !== undefined ? `<span class="best">Your best: ${best(id)}%</span>` : ""}</button>`).join("")}</div>
      </div>`;
    panels.test.querySelectorAll("[data-test]").forEach((b) => b.addEventListener("click", () => startTest(b.dataset.test)));
  }

  function startTest(id) {
    const kid = Kids.current();
    if (!kid) return showView("test");
    Object.assign(T, { id, topic, list: buildSet(topic, topic.TESTS[id].plan), answers: [], i: 0, active: true, started: Date.now(), kidId: kid.id });
    drawTestQuestion();
    root.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function drawTestQuestion() {
    const q = T.list[T.i], n = T.list.length, last = T.i === n - 1;
    const kid = Kids.get(T.kidId);
    panels.test.innerHTML = `<div class="card">
      <div class="qhead"><span>${kid ? `${kid.avatar} ${esc(kid.name)} · ` : ""}${T.topic.icon} ${T.topic.TESTS[T.id].name} · Question <b>${T.i + 1}</b> of ${n}</span>
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
      topic: T.topic.id, testId: T.id, testName: T.topic.TESTS[T.id].name, at: Date.now(),
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
    const message = pct === 100 ? `Purrfect score! You really know your ${T.topic.noun}. 😻`
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
        ${scoreBlock(attempt, `${kid ? `${kid.avatar} ${esc(kid.name)} · ` : ""}${T.topic.icon} ${T.topic.name} · ${attempt.testName} — results`, reward?.newBest)}
        ${attempt.no ? `<p class="note">Test #${attempt.no} · 📅 ${stamp(attempt.at)} · took ${duration(attempt.durationSec)}</p>` : ""}
        <p>${message}</p>
        ${rewardBox}
        <p class="note">${reward ? "✓ Saved for a grown-up to review." : "This result could not be saved."}</p>
        <div class="qactions">
          ${missedSkills.length ? '<button type="button" class="primary" data-res="weak">🎯 Practise what I missed</button>' : ""}
          <button type="button" data-res="again">Try this test again</button>
          <button type="button" data-res="menu">Choose another test</button>
        </div>
      </div>
      <div class="card"><h2>How you did on each skill</h2>${skillBars(skillTally(attempt.items), T.topic)}</div>
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
  // The grown-up reviewing is remembered only while the page is open, so a
  // child who opens the Parents tab later is asked who they are.
  const PV = { open: null, status: "", parentId: null, f: null };
  const pav = (id, size, label) => window.LearnAvatars.svg(id, size, label);
  const parentName = (id) => Kids.PARENT_AVATARS.find((a) => a.id === id)?.name || "";

  function drawParentWho() {
    const parents = Kids.parents();
    const taken = new Set(parents.map((p) => p.avatar));
    let avatar = (Kids.PARENT_AVATARS.find((a) => !taken.has(a.id)) || Kids.PARENT_AVATARS[0]).id;
    panels.parents.innerHTML = `<div class="card">
      <h2>👪 Which grown-up are you?</h2>
      <p class="lead">Grown-ups can review every child's tests. Grown-ups don't take tests or earn Claw Points.</p>
      ${parents.length ? `<div class="kid-grid">${parents.map((p) => `
        <button type="button" class="kid-btn" data-parent="${p.id}">${pav(p.avatar, 64)}<b>${esc(p.name)}</b><small>${parentName(p.avatar)}</small></button>`).join("")}
      </div><h3>Someone new?</h3>` : ""}
      <form class="new-kid" autocomplete="off">
        <label for="parent-name">Your name</label>
        <input id="parent-name" type="text" maxlength="20" placeholder="e.g. Mum, Dad, Nana">
        <div class="pick-label">Pick your animal</div>
        <div class="animal-pick">${Kids.PARENT_AVATARS.map((a) => `
          <button type="button" data-pav="${a.id}" aria-pressed="${a.id === avatar}">${pav(a.id, 56)}<small>${a.name}</small></button>`).join("")}</div>
        <p class="form-error" role="alert"></p>
        <div class="qactions"><button type="submit" class="primary">Continue to parent review</button></div>
      </form>
    </div>`;

    const enter = (parent) => {
      if (!parent) return;
      PV.parentId = parent.id;
      drawParents();
      root.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    panels.parents.querySelectorAll("[data-parent]").forEach((b) =>
      b.addEventListener("click", () => enter(Kids.getParent(b.dataset.parent))));
    panels.parents.querySelectorAll("[data-pav]").forEach((b) => b.addEventListener("click", () => {
      avatar = b.dataset.pav;
      panels.parents.querySelectorAll("[data-pav]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    }));
    panels.parents.querySelector("form").addEventListener("submit", (event) => {
      event.preventDefault();
      const parent = Kids.addParent(panels.parents.querySelector("#parent-name").value, avatar);
      if (!parent) panels.parents.querySelector(".form-error").textContent = "Type your name first.";
      enter(parent);
    });
  }

  /** "Seen by Mum, Dad" for a saved test. */
  function seenLine(a) {
    const names = Object.keys(a.seenBy || {}).map((id) => Kids.getParent(id)).filter(Boolean)
      .map((p) => `${pav(p.avatar, 20)} ${esc(p.name)}`);
    return names.length ? `<span class="seen">Seen by ${names.join(", ")}</span>` : "";
  }

  function kidSummary(k) {
    const atts = Kids.attempts(k.id);
    const avg = atts.length ? Math.round(atts.reduce((s, a) => s + a.pct, 0) / atts.length) : null;
    const { rank } = Kids.rankFor(k.points);
    const pr = k.stats.practiceAnswered ? Math.round((100 * k.stats.practiceRight) / k.stats.practiceAnswered) : null;
    const badges = Kids.BADGES.filter((b) => k.badges[b.id]).length;
    // Each topic gets its own best scores and skills: "reading scales" in mass
    // and "reading rulers" in length are different things to practise.
    const topics = C.topics.map((t) => {
      const mine = atts.filter((a) => C.topicOf(a) === t);
      const bySkill = skillTally(mine.flatMap((a) => a.items));
      const weakest = Object.entries(bySkill).filter(([, v]) => v.total >= 3)
        .sort((a, b) => a[1].right / a[1].total - b[1].right / b[1].total)[0];
      return `<div class="ks-topic">
        <h3>${t.icon} ${t.name} <small class="muted">${plural(mine.length, "test")}</small></h3>
        <div class="chips">${Object.entries(t.TESTS).map(([id, test]) => {
          const b = k.stats.best[id];
          return `<span class="chip">${test.icon} ${test.name.replace(" test", "")} best: <b>${b === undefined ? "–" : `${b}%`}</b></span>`;
        }).join("")}</div>
        ${Object.keys(bySkill).length ? skillBars(bySkill, t) : ""}
        ${weakest && weakest[1].right < weakest[1].total ? `<div class="tip">🎯 Needs the most work: <b>${skillName(weakest[0], t)}</b> — ${weakest[1].right} of ${weakest[1].total} right in tests.</div>` : ""}
      </div>`;
    }).join("");
    return `<div class="card kid-sum">
      <div class="ks-head"><span class="av" aria-hidden="true">${k.avatar}</span>
        <div><h2>${esc(k.name)}</h2><div class="lead">${rank.icon} ${rank.name} · 🐾 ${k.points} Claw Points · ${badges}/${Kids.BADGES.length} badges</div></div></div>
      <div class="stat-grid">
        <div><b>${atts.length}</b><small>tests taken</small></div>
        <div><b>${avg === null ? "–" : `${avg}%`}</b><small>average test score</small></div>
        <div><b>${k.stats.practiceAnswered}</b><small>practice questions${pr === null ? "" : ` · ${pr}% right`}</small></div>
        <div><b>${atts[0] ? when(atts[0].at) : "–"}</b><small>last test</small></div>
      </div>
      ${topics}
    </div>`;
  }

  const dateStr = (at) => new Date(at).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  const timeStr = (at) => new Date(at).toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" });
  const stamp = (at) => `${dateStr(at)}, ${timeStr(at)}`;
  const dayStart = (iso) => { const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d).getTime(); };

  const SORTS = [
    ["newest", "Newest first"], ["oldest", "Oldest first"], ["number", "Test number"],
    ["child", "Child's name (A–Z)"], ["test", "Topic, then test (Easy → Mixed)"],
    ["score-high", "Score (highest first)"], ["score-low", "Score (lowest first)"],
  ];
  const blankFilters = () => ({ kid: "all", test: "all", from: "", to: "", no: "", newOnly: false, sort: "newest" });
  PV.f = blankFilters();

  /** The saved tests matching the parent page's filters, sorted. */
  function filteredAttempts() {
    const f = PV.f;
    const no = parseNum(String(f.no).replace(/^#/, ""));
    return Kids.findAttempts({
      kidId: f.kid === "all" ? null : f.kid,
      // "topic:length" means every length test; anything else is one test.
      topic: f.test.startsWith("topic:") ? f.test.slice(6) : null,
      testId: f.test === "all" || f.test.startsWith("topic:") ? null : f.test,
      topicOrder: C.topics.map((t) => t.id),
      from: f.from ? dayStart(f.from) : null,
      to: f.to ? dayStart(f.to) + 86399999 : null,
      no: no || null,
      unseenBy: f.newOnly ? PV.parentId : null,
      sort: f.sort,
    });
  }

  function drawParents() {
    const me = Kids.getParent(PV.parentId);
    if (!me) { PV.parentId = null; PV.open = null; return drawParentWho(); }
    if (PV.open) return drawParentAttempt(PV.open);
    const kids = Kids.list();
    const parents = Kids.parents();
    if (PV.f.kid !== "all" && !Kids.get(PV.f.kid)) PV.f.kid = "all";
    const f = PV.f;
    const opt = (value, label, current) => `<option value="${value}"${value === current ? " selected" : ""}>${label}</option>`;
    panels.parents.innerHTML = `
      <div class="card">
        <div class="reviewer">
          ${pav(me.avatar, 52)}
          <span class="rv-name">Reviewing as <b>${esc(me.name)}</b><small>${parentName(me.avatar)}</small></span>
          <button type="button" class="small" data-par="switch-parent">Switch</button>
          <button type="button" class="small" data-par="done">Done</button>
        </div>
        <h2>👪 Parent review</h2>
        <p class="lead">Every finished test is saved with a test number, the date and time, and the child's name, plus each answer, what went wrong and the right method. Any grown-up can review any child. ${Sync?.status().on ? "Family sync is on, so tests taken on any of the family's devices show up here." : "Results are kept in this browser, on this device, unless family sync is on."}</p>
        ${kids.length ? "" : "<p>No learners yet. Children add their name when they open Practice, Test or Rewards.</p>"}
      </div>
      <div class="card">
        <h2>Find and sort tests</h2>
        <div class="filters">
          <label>Child<select data-f="kid">${opt("all", "Everyone", f.kid)}${kids.map((k) => opt(k.id, `${k.avatar} ${esc(k.name)}`, f.kid)).join("")}</select></label>
          <label>Topic &amp; test<select data-f="test">${opt("all", "All topics and tests", f.test)}${C.topics.map((t) => `
            <optgroup label="${t.icon} ${t.name}">${opt(`topic:${t.id}`, `All ${t.name.toLowerCase()} tests`, f.test)}${Object.entries(t.TESTS).map(([id, test]) => opt(id, `${test.icon} ${t.name} · ${test.name}`, f.test)).join("")}</optgroup>`).join("")}</select></label>
          <label>From date<input type="date" data-f="from" value="${esc(f.from)}"></label>
          <label>To date<input type="date" data-f="to" value="${esc(f.to)}"></label>
          <label>Test #<input type="text" inputmode="numeric" data-f="no" value="${esc(f.no)}" placeholder="e.g. 12" autocomplete="off"></label>
          <label>Sort by<select data-f="sort">${SORTS.map(([v, label]) => opt(v, label, f.sort)).join("")}</select></label>
        </div>
        <div class="filter-foot">
          <label class="check"><input type="checkbox" data-f="newOnly"${f.newOnly ? " checked" : ""}> Only tests I haven't seen</label>
          <span class="spacer"></span>
          <button type="button" class="small" data-par="clear">Clear filters</button>
          <button type="button" class="small" data-par="csv">⬇️ Download as spreadsheet</button>
        </div>
      </div>
      <div id="par-results"></div>
      ${Sync?.available() ? '<div class="card" id="par-sync"></div>' : ""}
      <div class="card">
        <h2>Backup and other devices</h2>
        <p>${Sync?.available() ? "Without family sync, you can still move results by file: export" : "To look at results on a different phone or computer, export"} a backup here and import it there. Importing adds to what is already saved — nothing is overwritten, and test numbers already used here stay the same.</p>
        <div class="qactions">
          <button type="button" data-par="export">⬇️ Export backup</button>
          <button type="button" data-par="import">⬆️ Import backup</button>
        </div>
        <input type="file" id="import-file" accept=".json,application/json" hidden>
        <p class="note" role="status">${esc(PV.status)}</p>
        ${kids.length ? `<h3>Learners</h3><div class="manage">${kids.map((k) => `
          <div class="manage-row"><span>${k.avatar} ${esc(k.name)} <small>${plural(Kids.attempts(k.id).length, "test")}</small></span>
            <button type="button" class="danger small" data-par="remove" data-id="${k.id}">Remove</button></div>`).join("")}</div>` : ""}
        <h3>Grown-ups</h3><div class="manage">${parents.map((p) => `
          <div class="manage-row">${pav(p.avatar, 32)}<span>${esc(p.name)}${p.id === me.id ? " (you)" : ""} <small>${parentName(p.avatar)}</small></span>
            <button type="button" class="danger small" data-par="remove-parent" data-id="${p.id}">Remove</button></div>`).join("")}</div>
      </div>`;
    PV.status = "";
    drawParentResults();
    drawSync();
  }

  // --- family sync card ----------------------------------------------------
  const SY = { message: "" };
  const ago = (at) => {
    const s = Math.round((Date.now() - at) / 1000);
    return s < 60 ? "just now" : s < 3600 ? `${Math.round(s / 60)} min ago` : when(at);
  };

  /** The family sync card; redrawn alone when sync's status changes. */
  function drawSync() {
    const box = panels.parents.querySelector("#par-sync");
    if (!box) return;
    const st = Sync.status();
    const msg = SY.message ? `<p class="note" role="status">${esc(SY.message)}</p>` : "";
    SY.message = "";
    if (!st.on) {
      box.innerHTML = `
        <h2>🔄 Family sync</h2>
        <p>See every child's tests on every grown-up's phone or computer, wherever they are. Turn it on here, then open the invite link once on each child's device and each grown-up's device. Tests already on this device are included.</p>
        <div class="qactions"><button type="button" class="primary" data-sync="start">Turn on family sync</button></div>
        <form class="sync-join" autocomplete="off">
          <label for="sync-code">Already have a family invite link or code? Paste it here.</label>
          <div class="sync-row"><input id="sync-code" type="text" placeholder="Invite link or family code" spellcheck="false">
            <button type="submit">Join</button></div>
        </form>
        ${msg}`;
      return;
    }
    const line = st.busy ? "Syncing…"
      : st.error ? `⚠️ ${esc(st.error)}`
      : st.last ? `✅ Up to date · last synced ${ago(st.last)}` : "Waiting to sync…";
    box.innerHTML = `
      <h2>🔄 Family sync is on</h2>
      <p class="note" role="status">${line}${st.pending && !st.busy ? ` · ${plural(st.pending, "change")} waiting to send` : ""}</p>
      <p>Open this invite link once on each child's device and each grown-up's device. Anyone with the link can see and add results, so only send it to family.</p>
      <input class="sync-link" type="text" readonly value="${esc(Sync.inviteLink())}" aria-label="Family invite link">
      <div class="qactions">
        <button type="button" class="primary" data-sync="share">📨 Share invite link</button>
        <button type="button" data-sync="now">🔄 Sync now</button>
        <button type="button" class="danger" data-sync="leave">Turn off on this device</button>
      </div>
      ${msg}`;
  }

  window.addEventListener("learnsync:status", drawSync);

  panels.parents.addEventListener("click", async (event) => {
    const b = event.target.closest("[data-sync]");
    if (!b) return;
    const what = b.dataset.sync;
    if (what === "start") Sync.start();
    if (what === "now") Sync.syncNow();
    if (what === "leave" && confirmed(b, "Tap again: this device stops syncing")) {
      Sync.leave();
      SY.message = "Family sync is off on this device. Results already here stay here.";
    }
    if (what === "share") {
      const link = Sync.inviteLink();
      const text = "Open this to join our family's maths results";
      try {
        if (navigator.share && matchMedia("(pointer: coarse)").matches) await navigator.share({ title: "Year 4 Maths", text, url: link });
        else { await navigator.clipboard.writeText(link); SY.message = "Invite link copied. Paste it into a message to send it."; }
      } catch {
        panels.parents.querySelector(".sync-link")?.select();
      }
    }
    // Turning sync on or off changes the page's wording, not just this card.
    if (what === "start" || what === "leave") drawParents(); else drawSync();
  });

  panels.parents.addEventListener("submit", (event) => {
    if (!event.target.classList.contains("sync-join")) return;
    event.preventDefault();
    const raw = event.target.querySelector("#sync-code").value.trim();
    let code = raw;
    try { code = new URL(raw).searchParams.get("family") || raw; } catch {}
    if (Sync.join(code)) return drawParents();
    SY.message = "That doesn't look like a family invite link or code.";
    drawSync();
  });

  /** Child summaries and the test table; redrawn alone so typing in a filter keeps focus. */
  function drawParentResults() {
    const box = panels.parents.querySelector("#par-results");
    if (!box) return;
    const me = Kids.getParent(PV.parentId);
    const kids = Kids.list();
    const shownKids = PV.f.kid === "all" ? kids : kids.filter((k) => k.id === PV.f.kid);
    const list = filteredAttempts();
    const total = Kids.attempts().length;
    const rows = list.map((a) => {
      const isNew = !a.seenBy?.[me.id];
      const seen = Object.keys(a.seenBy || {}).map((id) => Kids.getParent(id)).filter(Boolean);
      return `<tr data-par="open" data-id="${a.id}" class="${isNew ? "is-new" : ""}">
        <td data-label="Test #" class="c-no"><b>#${a.no}</b>${isNew ? ' <span class="new-chip">New</span>' : ""}</td>
        <td data-label="Date & time" class="c-when">${dateStr(a.at)}<small>${timeStr(a.at)}</small></td>
        <td data-label="Child" class="c-kid"><span aria-hidden="true">${a.avatar}</span> ${esc(a.kidName)}</td>
        <td data-label="Test" class="c-test">${C.topicOf(a).icon} ${C.topicOf(a).name}<small>${C.topicOf(a).TESTS[a.testId]?.icon || ""} ${esc(a.testName)}</small></td>
        <td data-label="Score" class="c-score"><b class="${pctClass(a.pct)}">${a.right}/${a.total} · ${a.pct}%</b><small>took ${duration(a.durationSec)}</small></td>
        <td data-label="Seen by" class="c-seen">${seen.length ? seen.map((p) => `<span title="${esc(p.name)}">${pav(p.avatar, 22, esc(p.name))}</span>`).join("") : '<small class="muted">—</small>'}</td>
        <td class="c-view"><button type="button" class="small" data-par="open" data-id="${a.id}">View</button></td>
      </tr>`;
    }).join("");
    box.innerHTML = `
      ${shownKids.map(kidSummary).join("")}
      <div class="card">
        <h2>Saved tests <small class="muted">showing ${list.length} of ${total}</small></h2>
        ${list.length ? `<div class="table-wrap"><table class="att-table">
          <thead><tr><th>Test #</th><th>Date &amp; time</th><th>Child</th><th>Topic &amp; test</th><th>Score</th><th>Seen by</th><th><span class="sr-only">Open</span></th></tr></thead>
          <tbody>${rows}</tbody></table></div>`
          : `<p class="lead">${total ? "No tests match these filters." : "No tests taken yet."}</p>`}
      </div>`;
  }

  function drawParentAttempt(id) {
    const a = Kids.attempt(id);
    if (!a) { PV.open = null; return drawParents(); }
    Kids.markSeen(a.id, PV.parentId);
    panels.parents.innerHTML = `
      <div class="card"><div class="qactions" style="margin-top:0">
        <button type="button" data-par="back">← All results</button>
        <button type="button" class="danger" data-par="delete" data-id="${a.id}">Delete this result</button>
      </div></div>
      <div class="card result-top">
        ${scoreBlock(a, `<b>Test #${a.no}</b> · ${a.avatar} ${esc(a.kidName)} · ${C.topicOf(a).icon} ${C.topicOf(a).name} · ${esc(a.testName)}`)}
        <p class="note">📅 ${stamp(a.at)} · took ${duration(a.durationSec)} · earned 🐾 ${a.points}</p>
        <p class="note">${seenLine(a)}</p>
      </div>
      <div class="card"><h2>Skills</h2>${skillBars(skillTally(a.items), C.topicOf(a))}</div>
      ${reviewCard(a.items, "Answer given")}`;
  }

  /** The filtered list as a CSV file for a spreadsheet. */
  function exportCSV() {
    // Quote every cell; a leading = + - @ would make a spreadsheet run it as a formula.
    const cell = (v) => {
      let s = String(v ?? "");
      if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
      return `"${s.replace(/"/g, '""')}"`;
    };
    const head = ["Test #", "Date", "Time", "Child", "Topic", "Test", "Right", "Questions", "Percent", "Time taken (s)", "Claw Points", "Seen by"];
    const lines = filteredAttempts().map((a) => [
      a.no, new Date(a.at).toLocaleDateString("en-AU"), timeStr(a.at), a.kidName, C.topicOf(a).name, a.testName, a.right, a.total, a.pct,
      a.durationSec, a.points, Object.keys(a.seenBy || {}).map((id) => Kids.getParent(id)?.name).filter(Boolean).join("; "),
    ]);
    const csv = "﻿" + [head, ...lines].map((row) => row.map(cell).join(",")).join("\r\n");
    download(csv, "text/csv", `test-results-${new Date().toISOString().slice(0, 10)}.csv`);
  }

  function download(text, type, filename) {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([text], { type }));
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 2000);
  }

  function exportBackup() {
    download(Kids.exportData(), "application/json", `learning-results-${new Date().toISOString().slice(0, 10)}.json`);
  }

  // Filters: selects, dates and the checkbox redraw on change; the number box as you type.
  const onFilter = (event) => {
    const field = event.target.dataset?.f;
    if (!field) return;
    if (event.type === "input" && field !== "no") return;
    PV.f[field] = event.target.type === "checkbox" ? event.target.checked : event.target.value;
    drawParentResults();
  };
  panels.parents.addEventListener("change", onFilter);
  panels.parents.addEventListener("input", onFilter);

  panels.parents.addEventListener("click", (event) => {
    const b = event.target.closest("[data-par]");
    if (!b) return;
    const { par, id } = b.dataset;
    if (par === "clear") { PV.f = blankFilters(); drawParents(); }
    if (par === "csv") exportCSV();
    if (par === "open") { PV.open = id; drawParents(); root.scrollIntoView({ behavior: "smooth", block: "start" }); }
    if (par === "back") { PV.open = null; drawParents(); }
    if (par === "delete" && confirmed(b, "Tap again to delete")) { Kids.deleteAttempt(id); PV.open = null; drawParents(); }
    if (par === "remove" && confirmed(b, "Tap again: removes their points and tests")) { Kids.remove(id); onKidChange(); drawParents(); }
    if (par === "remove-parent" && confirmed(b, "Tap again to remove")) { Kids.removeParent(id); drawParents(); }
    if (par === "switch-parent") { PV.parentId = null; PV.open = null; drawParents(); }
    if (par === "done") { PV.parentId = null; PV.open = null; showView("learn"); }
    if (par === "export") exportBackup();
    if (par === "import") panels.parents.querySelector("#import-file").click();
  });

  panels.parents.addEventListener("change", async (event) => {
    const input = event.target;
    if (input.id !== "import-file" || !input.files[0]) return;
    try {
      const result = Kids.importData(await input.files[0].text(), sanitizeHTML);
      PV.status = `Imported ${plural(result.attemptsAdded, "test")}, ${plural(result.kidsAdded, "new learner")} and ${plural(result.parentsAdded, "new grown-up")}.`;
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
  setTopic(topic.id);
})();