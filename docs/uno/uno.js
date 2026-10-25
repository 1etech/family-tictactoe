// The UNO tab: room list, rooms of 2 to 10 players, and the table itself.
// Like tic tac toe there is no server: every browser in a room holds the
// whole game (rules.js) and swaps it through a public MQTT broker. A change
// bumps `v` and is republished retained; when two land at the same version
// the lower publisher id wins, and the client that lost redoes its move on
// top of the winner's, so a chat line or a join is never silently dropped.
(() => {
  "use strict";

  const R = globalThis.UnoRules;
  const root = document.getElementById("uno-root");
  if (!R || !root) return;

  const DEFAULT_ROOM = "CARD";
  const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const store = {
    get(key, fallback) { try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; } },
    set(key, value) { try { localStorage.setItem(key, value); } catch {} },
  };
  // localStorage "uno:broker" points the tab at another broker, for testing.
  const BROKERS = store.get("uno:broker", "") ? [store.get("uno:broker", "")] : [
    "wss://broker.emqx.io:8084/mqtt",
    "wss://test.mosquitto.org:8081/mqtt",
    "wss://broker.hivemq.com:8884/mqtt",
  ];

  const PRESENCE_EVERY_MS = 8000;
  const PEER_STALE_MS = 22000;   // no heartbeat for this long => shown as away
  const SEAT_GRACE_MS = 120000;  // away this long => taken off the table
  const ADVERT_EVERY_MS = 15000;
  const ADVERT_STALE_MS = 90000;
  const ADVERT_FORGET_MS = 30 * 60000;
  const PENDING_MS = 15000;      // how long a move is retried after losing a clash
  const MAX_CHAT = 40;
  const RECENT = 40;

  // The same identity and name as the tic tac toe tab, so nobody types twice.
  let playerId = store.get("ttt:playerId", "");
  if (!playerId) {
    playerId = crypto.randomUUID?.() ?? String(Math.random()).slice(2) + Date.now();
    store.set("ttt:playerId", playerId);
  }
  let playerName = store.get("ttt:name", "");

  const CONTROL_CHARS = /[\p{Cc}\p{Cf}]/gu;
  const clean = (value, max) =>
    typeof value !== "string" ? "" :
    value.replace(CONTROL_CHARS, " ").replace(/\s+/g, " ").trim().slice(0, max);

  // --- page ---------------------------------------------------------------------
  root.innerHTML = `
    <h1>Family UNO<small>2 to 10 players. One link, any device.</small></h1>

    <section id="uno-lobby" class="panel">
      <div class="stack">
        <div>
          <label for="uno-name">Your name</label>
          <input id="uno-name" type="text" maxlength="20" placeholder="Grandpa" autocomplete="nickname" />
        </div>
        <p id="uno-lobby-error" class="lobby-error" role="alert" hidden></p>
        <div>
          <div class="rooms-head">
            <h2>UNO tables</h2>
            <span class="conn" id="uno-lobby-conn"><span class="dot"></span><span>connecting…</span></span>
          </div>
          <ul id="uno-room-list" class="room-list"></ul>
        </div>
        <div class="divider">or</div>
        <form id="uno-create" class="stack">
          <button type="submit" class="primary">➕ Start a new table</button>
          <details class="room-opts">
            <summary>Table options</summary>
            <div class="stack" style="margin-top:10px">
              <div>
                <label for="uno-room-name">Table name (optional)</label>
                <input id="uno-room-name" type="text" maxlength="24" placeholder="Sunday cards" autocomplete="off" />
              </div>
              <label class="lobby-check"><input type="checkbox" id="uno-room-listed" checked />
                Show it in the list so anyone here can join</label>
            </div>
          </details>
          <p class="hint">You get a new code nobody else is using. Invite up to 9 others.</p>
        </form>
        <form id="uno-join" class="stack">
          <label for="uno-code" style="margin:0">Have a table code?</label>
          <div class="row">
            <input id="uno-code" class="code-input" type="text" maxlength="4" placeholder="CODE"
                   autocomplete="off" autocapitalize="characters" />
            <button type="submit">Join</button>
          </div>
        </form>
      </div>
    </section>

    <section id="uno-room" class="uno-room" hidden>
      <div class="roombar">
        <div style="min-width:0">
          <div class="code-label" id="uno-room-title">Table code</div>
          <div class="code" id="uno-room-code">----</div>
        </div>
        <div class="row" style="flex:0 0 auto">
          <button type="button" id="uno-share">📨 Invite</button>
          <button type="button" id="uno-leave">← Tables</button>
        </div>
      </div>

      <div class="uno-players-head">
        <h2>Players <span id="uno-count"></span></h2>
        <span id="uno-dir" class="uno-dir"></span>
      </div>
      <ul id="uno-players" class="uno-players"></ul>

      <div id="uno-table" class="uno-table" hidden>
        <button type="button" id="uno-deck" class="uno-pile" aria-label="Draw a card">
          <span class="uno-card back"><span class="uno-oval"><b>UNO</b></span></span>
          <span class="uno-pile-label" id="uno-deck-label">Draw</span>
        </button>
        <div class="uno-pile">
          <span id="uno-top"></span>
          <span class="uno-pile-label" id="uno-color-label"></span>
        </div>
      </div>

      <div id="uno-status" class="uno-status" role="status" aria-live="polite">Connecting…</div>
      <div id="uno-notice" class="uno-notice" role="alert"></div>

      <div id="uno-picker" class="uno-picker" hidden>
        <span>Choose a colour</span>
        <div class="uno-picker-row">
          <button type="button" data-color="R" class="pick-R">Red</button>
          <button type="button" data-color="Y" class="pick-Y">Yellow</button>
          <button type="button" data-color="G" class="pick-G">Green</button>
          <button type="button" data-color="B" class="pick-B">Blue</button>
        </div>
        <button type="button" id="uno-pick-cancel" class="uno-link">Cancel</button>
      </div>

      <div id="uno-actions" class="uno-actions"></div>
      <div id="uno-hand" class="uno-hand" aria-label="Your cards"></div>

      <div id="uno-panel" class="uno-panel" hidden></div>

      <ol id="uno-log" class="uno-log" aria-label="What happened"></ol>
      <div id="uno-watchers" class="uno-watchers"></div>

      <details class="chat">
        <summary>Chat</summary>
        <div id="uno-messages" class="uno-messages" aria-live="polite"></div>
        <form class="chat-form" id="uno-chat">
          <input id="uno-chat-input" type="text" maxlength="200" placeholder="Say something…" autocomplete="off" />
          <button type="submit">Send</button>
        </form>
      </details>
      <div class="conn" id="uno-conn"><span class="dot"></span><span>connecting…</span></div>
    </section>`;

  const $ = (id) => document.getElementById(id);
  const onUnoTab = () => !$("tab-uno").hidden;
  const lobbyEl = $("uno-lobby"), roomEl = $("uno-room");
  const nameInput = $("uno-name"), codeInput = $("uno-code");
  nameInput.value = playerName;

  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  /**
   * Replaces a container's children only when they would look different, so a
   * heartbeat arriving mid-tap doesn't swap the button out from under a finger.
   */
  const drawn = new WeakMap();
  function swap(node, children) {
    const sig = children.map((c) => c.outerHTML).join("");
    if (drawn.get(node) === sig) return;
    drawn.set(node, sig);
    node.replaceChildren(...children);
  }

  const SYMBOL = { S: "⊘", R: "⇄", D: "+2" };
  /** One card face. Wilds show the four colours; the chosen colour rings it. */
  function cardEl(card, tag = "span") {
    const node = el(tag, `uno-card c-${card[0]}`);
    const sym = card === "WW" ? "" : card === "W4" ? "+4" : SYMBOL[card[1]] ?? card[1];
    const oval = el("span", "uno-oval");
    oval.append(el("b", "", sym));
    node.append(el("i", "uno-corner", sym || "W"), oval, el("i", "uno-corner end", sym || "W"));
    node.setAttribute("aria-label", R.cardName(card));
    node.title = R.cardName(card);
    return node;
  }

  const ORDER = "RYGBW", VALUES = "0123456789SRDW4";
  const sortKey = (c) => ORDER.indexOf(c[0]) * 100 + VALUES.indexOf(c[1]);

  // --- shared state -----------------------------------------------------------
  let state = null;
  let client = null;
  let brokerIndex = 0;
  let roomCode = null, roomKey = null, topicState = null, topicWho = null;
  let peers = new Map();         // playerId -> { name, at }
  let heartbeat = null, sweeper = null;
  let joinedAt = 0, stateAtArrival = 0;
  let pending = [];              // my moves not yet confirmed: { id, fn, at }
  let pendingRoom = null;        // options for a table this client is creating
  let picking = null;            // a wild waiting for its colour: { index, card }
  let lastHand = [];

  const clone = (s) => JSON.parse(JSON.stringify(s));
  const me = () => state?.players.find((p) => p.id === playerId) ?? null;
  // Someone not heard from yet counts as here until their heartbeat is overdue.
  const peerOnline = (id) => id === playerId || Date.now() - (peers.get(id)?.at ?? joinedAt) < PEER_STALE_MS;
  const onlineIds = () => [...peers.entries()]
    .filter(([, p]) => Date.now() - p.at < PEER_STALE_MS).map(([id]) => id).sort();
  const actionId = () => playerId.slice(0, 8) + Math.random().toString(36).slice(2, 8);

  /** Enough shape to render and play without throwing; anything else is ignored. */
  function looksValid(s) {
    return s && typeof s === "object" && typeof s.v === "number" && Array.isArray(s.players)
      && Array.isArray(s.order) && s.hands && typeof s.hands === "object"
      && Array.isArray(s.draw) && Array.isArray(s.discard) && Array.isArray(s.log)
      && Array.isArray(s.chat) && s.scores && typeof s.scores === "object"
      && s.order.every((id) => Array.isArray(s.hands[id]) || s.phase !== "playing");
  }

  function send(next, ids) {
    next.recent = [...(next.recent || []), ...ids].slice(-RECENT);
    next.v = (state?.v ?? 0) + 1;
    next.by = playerId;
    next.at = Date.now();
    state = next;
    client?.publish(topicState, JSON.stringify(state), { retain: true, qos: 1 });
    render();
  }

  /** Applies a rules move to a copy of the state and, if allowed, publishes it. */
  function act(fn) {
    if (!state || !client?.connected) { flash("Not connected yet."); return false; }
    const draft = clone(state);
    const result = fn(draft);
    if (!result?.ok) { if (result?.error) flash(result.error); return false; }
    const id = actionId();
    pending.push({ id, fn, at: Date.now() });
    send(draft, [id]);
    return true;
  }

  function adopt(incoming) {
    if (!looksValid(incoming)) return;
    if (state) {
      if (incoming.v < state.v) return;
      if (incoming.v === state.v && incoming.by >= state.by) return;
    }
    // Mine lost a clash at the same version. The broker may be keeping my
    // copy as the retained one, so republish either way.
    const lostClash = !!state && state.by === playerId && incoming.v === state.v;
    state = incoming;
    const seen = new Set(incoming.recent || []);
    pending = pending.filter((p) => !seen.has(p.id) && Date.now() - p.at < PENDING_MS);
    if (pending.length || lostClash) {
      const draft = clone(state);
      const redone = pending.filter((p) => draft && p.fn(draft)?.ok);
      pending = redone;
      if (redone.length || lostClash) return send(draft, redone.map((p) => p.id));
    }
    render();
  }

  // --- moves --------------------------------------------------------------------
  const say = (s, name, text) => {
    s.chat.push({ id: s.nextChatId++, name, text, at: Date.now() });
    if (s.chat.length > MAX_CHAT) s.chat = s.chat.slice(-MAX_CHAT);
    return { ok: true };
  };

  /** Plays a card by what it is, so a move redone after a clash still finds it. */
  function playCard(index, card, color) {
    act((s) => {
      const hand = s.hands[playerId] || [];
      const i = hand[index] === card ? index : s.drew ? hand.length - 1 : hand.indexOf(card);
      return R.play(s, playerId, i, color);
    });
  }

  function tapCard(index, card) {
    picking = null;
    const problem = whyNotNow(index);
    if (problem) {
      flash(problem);
      return render();
    }
    if (R.isWild(card)) { picking = { index, card }; return render(); }
    playCard(index, card);
  }

  function whyNotNow(index) {
    if (state.phase !== "playing") return "The round hasn't started.";
    if (R.current(state) !== playerId) return "It's not your turn.";
    const hand = state.hands[playerId];
    if (state.drew && index !== hand.length - 1) return "After drawing you can only play the card you drew.";
    return R.whyNot(state, hand, hand[index]);
  }

  let noticeTimer = null;
  function flash(text) {
    $("uno-notice").textContent = text;
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => { $("uno-notice").textContent = ""; }, 3500);
  }

  // --- connection ---------------------------------------------------------------
  async function topicFor(code) {
    const bytes = new TextEncoder().encode("family-uno-v1:" + code);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return [...new Uint8Array(digest)].slice(0, 10).map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  const lobbyReady = topicFor("lobby").then((key) => `uno/${key}/rooms`);
  let lobbyTopic = null;

  function setConn(id, kind, text) {
    $(id).className = "conn " + kind;
    $(id).lastElementChild.textContent = text;
  }
  const setBoth = (kind, text) => { setConn("uno-conn", kind, text); setConn("uno-lobby-conn", kind, text); };

  async function ensureClient() {
    if (client) return;
    lobbyTopic = await lobbyReady;
    if (!client) openBroker();
  }

  function openBroker() {
    if (!globalThis.mqtt) return setBoth("down", "cannot load the connection library");
    client = mqtt.connect(BROKERS[brokerIndex % BROKERS.length], {
      clientId: "uno_" + Math.random().toString(16).slice(2, 10),
      clean: true,
      connectTimeout: 8000,
      reconnectPeriod: 4000,
    });
    client.on("connect", () => {
      setConn("uno-lobby-conn", "live", "live");
      client.subscribe(`${lobbyTopic}/+`, { qos: 0 });
      startRoom();
    });
    client.on("message", (topic, payload) => {
      if (topic.startsWith(lobbyTopic + "/")) return onAdvert(topic, payload);
      let msg;
      try { msg = JSON.parse(payload.toString()); } catch { return; }
      if (topic === topicWho) {
        if (typeof msg.id === "string") peers.set(msg.id, { name: clean(msg.name, 20), at: Date.now() });
        return render();
      }
      if (topic === topicState) adopt(msg);
    });
    client.on("reconnect", () => setBoth("down", "reconnecting…"));
    client.on("offline", () => setBoth("down", "offline"));
    client.on("error", () => {
      // A broker can be busy or blocked on some networks; try the next one.
      setBoth("down", "switching server…");
      try { client.end(true); } catch {}
      client = null;
      brokerIndex += 1;
      if (brokerIndex < BROKERS.length * 2) setTimeout(openBroker, 500);
      else setBoth("down", "cannot reach any server");
    });
  }

  async function connect(code) {
    if (roomCode) leaveRoomNow();
    roomCode = code;
    $("uno-room-code").textContent = code;
    $("uno-room-title").textContent = "Table code";
    $("uno-status").textContent = "Connecting…";
    lobbyEl.hidden = true;
    roomEl.hidden = false;
    lastAdvert = "";
    setConn("uno-conn", "", "connecting…");
    const key = await topicFor(code);
    if (roomCode !== code) return;
    roomKey = key;
    topicState = `uno/${key}/state`;
    topicWho = `uno/${key}/who`;
    if (client?.connected) startRoom();
    else await ensureClient();
  }

  function startRoom() {
    if (!roomCode || !topicState || !client?.connected) return;
    const code = roomCode;
    joinedAt = Date.now();
    setConn("uno-conn", "live", "connected");
    // Give the retained game a moment to arrive before deciding the table is
    // new. A table the list shows people at certainly has one, so keep waiting.
    let waits = 0;
    const settle = () => {
      if (roomCode !== code) return;
      if (!state && isLive(code) && ++waits < 6) return setTimeout(settle, 1000);
      settleIn();
    };
    client.subscribe([topicState, topicWho], { qos: 1 }, () => setTimeout(settle, 1200));
    announce();
    clearInterval(heartbeat);
    heartbeat = setInterval(announce, PRESENCE_EVERY_MS);
    clearInterval(sweeper);
    sweeper = setInterval(sweep, 5000);
  }

  function announce() {
    if (!client?.connected || !topicWho) return;
    peers.set(playerId, { name: playerName, at: Date.now() });
    client.publish(topicWho, JSON.stringify({ id: playerId, name: playerName || "Player" }), { qos: 0 });
  }

  /** First look at the table: set it up, or sit down if there's a seat. */
  function settleIn() {
    stateAtArrival = state?.at ?? 0;
    if (!state) {
      const options = pendingRoom?.code === roomCode ? pendingRoom : null;
      state = R.newRoom({
        name: options?.name || (roomCode === DEFAULT_ROOM ? "Family table" : ""),
        listed: options ? options.listed : true,
      });
      pendingRoom = null;
    }
    const seat = me();
    if (seat) {
      if (seat.name !== (playerName || "Player")) act((s) => R.addPlayer(s, playerId, playerName || "Player"));
    } else if (state.players.length < R.MAX_PLAYERS) {
      act((s) => R.addPlayer(s, playerId, playerName || "Player"));
    }
    render();
  }

  /** The table leader (lowest id online) keeps the list entry fresh and clears empty seats. */
  function sweep() {
    if (!state) return;
    if (onlineIds()[0] !== playerId) return render();
    advertise();
    for (const p of state.players) {
      if (p.id === playerId) continue;
      // Someone not heard from yet counts from when we arrived, so a newcomer
      // doesn't clear seats whose heartbeat is on its way, unless the game had
      // been sitting untouched long before that.
      const unheard = Math.max(Math.min(stateAtArrival, joinedAt), joinedAt - SEAT_GRACE_MS + PEER_STALE_MS);
      const lastSeen = peers.get(p.id)?.at ?? unheard;
      if (Date.now() - lastSeen > SEAT_GRACE_MS) {
        act((s) => R.removePlayer(s, p.id, "was away too long and left the table"));
        return;
      }
    }
    render();
  }

  function leaveRoomNow() {
    clearInterval(heartbeat);
    clearInterval(sweeper);
    if (client?.connected && topicState) {
      const others = onlineIds().filter((id) => id !== playerId);
      if (!others.length && roomKey) client.publish(`${lobbyTopic}/${roomKey}`, "", { retain: true, qos: 0 });
      client.unsubscribe([topicState, topicWho]);
    }
    roomCode = roomKey = topicState = topicWho = null;
    state = null;
    peers = new Map();
    pending = [];
    picking = null;
    lastHand = [];
    lastChatId = 0;
    if (onUnoTab()) document.title = "Family UNO";
  }

  // --- table list ---------------------------------------------------------------
  const rooms = new Map();
  let lastAdvert = "", lastAdvertAt = 0;

  function onAdvert(topic, payload) {
    const text = payload.toString();
    if (!text) { rooms.delete(topic); return renderLobby(); }
    let ad;
    try { ad = JSON.parse(text); } catch { return; }
    if (!ad || typeof ad.code !== "string" || !/^[A-Z0-9]{4}$/.test(ad.code) || typeof ad.at !== "number") return;
    if (Date.now() - ad.at > ADVERT_FORGET_MS) {
      // Left behind by a table everyone closed without saying goodbye.
      client?.publish(topic, "", { retain: true, qos: 0 });
      rooms.delete(topic);
      return renderLobby();
    }
    rooms.set(topic, {
      code: ad.code,
      name: clean(ad.name, 24),
      players: (Array.isArray(ad.players) ? ad.players : []).slice(0, R.MAX_PLAYERS).map((n) => clean(n, 20) || "Player"),
      playing: ad.playing === true,
      watchers: Number.isInteger(ad.watchers) && ad.watchers > 0 ? Math.min(ad.watchers, 99) : 0,
      at: ad.at,
    });
    renderLobby();
  }

  function advertise() {
    if (!state || !roomKey || !client?.connected) return;
    const topic = `${lobbyTopic}/${roomKey}`;
    if (state.listed === false) {
      if (lastAdvert !== "hidden") client.publish(topic, "", { retain: true, qos: 0 });
      lastAdvert = "hidden";
      return;
    }
    const seated = new Set(state.players.map((p) => p.id));
    const ad = {
      code: roomCode,
      name: state.name,
      players: state.players.map((p) => p.name),
      playing: state.phase === "playing",
      watchers: onlineIds().filter((id) => !seated.has(id)).length,
    };
    const key = JSON.stringify(ad);
    if (key === lastAdvert && Date.now() - lastAdvertAt < ADVERT_EVERY_MS) return;
    lastAdvert = key;
    lastAdvertAt = Date.now();
    client.publish(topic, JSON.stringify({ ...ad, at: Date.now() }), { retain: true, qos: 0 });
  }

  const isLive = (code) => [...rooms.values()]
    .some((ad) => ad.code === code && ad.players.length && Date.now() - ad.at < ADVERT_STALE_MS);

  async function freshCode() {
    const randomCode = () => Array.from({ length: 4 },
      () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join("");
    const listed = new Set([DEFAULT_ROOM, ...[...rooms.values()].map((r) => r.code)]);
    for (let tries = 0; tries < 8; tries++) {
      const code = randomCode();
      if (!listed.has(code) && await tableIsFree(code)) return code;
    }
    return randomCode();
  }

  /** Peeks at a table's retained game without joining it. */
  async function tableIsFree(code) {
    if (!client?.connected) return true;
    const topic = `uno/${await topicFor(code)}/state`;
    return new Promise((resolve) => {
      let done = false;
      const finish = (free) => {
        if (done) return;
        done = true;
        client?.removeListener("message", peek);
        client?.unsubscribe(topic);
        resolve(free);
      };
      const peek = (t, payload) => {
        if (t !== topic) return;
        try { finish(!JSON.parse(payload.toString())?.players?.length); } catch { finish(true); }
      };
      client.on("message", peek);
      client.subscribe(topic, { qos: 1 });
      setTimeout(() => finish(true), 1200);
    });
  }

  const roomList = $("uno-room-list");
  function renderLobby() {
    if (lobbyEl.hidden) return;
    const live = new Map();
    for (const ad of rooms.values()) {
      if (Date.now() - ad.at > ADVERT_STALE_MS) continue;
      if (!live.has(ad.code) || live.get(ad.code).at < ad.at) live.set(ad.code, ad);
    }
    const hasSeat = (ad) => (ad.players.length < R.MAX_PLAYERS ? 1 : 0);
    const pinned = [...new Set([invited, DEFAULT_ROOM].filter(Boolean))];
    const others = [...live.values()]
      .filter((ad) => !pinned.includes(ad.code))
      .sort((a, b) => hasSeat(b) - hasSeat(a) || b.at - a.at);
    const items = pinned.map((code) => roomItem(code, live.get(code), code === invited && code !== DEFAULT_ROOM));
    items.push(...others.map((ad) => roomItem(ad.code, ad, false)));
    if (!others.length) {
      items.push(el("li", "room-empty", "No other tables open right now. Start one below and invite people."));
    }
    roomList.replaceChildren(...items);
  }

  function roomItem(code, ad, isInvite) {
    const li = el("li", "room-item" + (isInvite ? " invited" : ""));
    const main = el("div", "ri-main");
    const name = el("div", "ri-name", code === DEFAULT_ROOM ? `🏠 ${ad?.name || "Family table"}`
      : isInvite ? `📨 ${ad?.name || "You're invited"}` : `🃏 ${ad?.name || "Table"}`);
    name.append(" ", el("span", "ri-code", code));
    const who = el("div", "ri-who");
    let full = false;
    if (!ad || !ad.players.length) {
      who.textContent = isInvite ? "Tap Join to play." : "Nobody here yet.";
      who.classList.add("open");
    } else {
      const n = ad.players.length;
      full = n >= R.MAX_PLAYERS;
      const names = ad.players.slice(0, 4).join(", ") + (n > 4 ? ` +${n - 4}` : "");
      let text = `${names} · ${n}/${R.MAX_PLAYERS}`;
      text += ad.playing ? " · playing" : n < 2 ? " · waiting for players" : " · about to start";
      if (ad.watchers) text += ` · ${ad.watchers} watching`;
      who.textContent = text;
      who.classList.toggle("open", !full);
    }
    main.append(name, who);
    const button = el("button", full ? "" : "primary", full ? "Watch" : "Join");
    button.type = "button";
    button.setAttribute("aria-label", `${button.textContent} table ${code}`);
    button.addEventListener("click", () => enterRoom(code));
    li.append(main, button);
    return li;
  }
  setInterval(renderLobby, 10000);

  // --- rendering ----------------------------------------------------------------
  function render() {
    if (!state || roomEl.hidden) return;
    const s = state;
    const seated = !!me();
    const dealtIn = s.order.includes(playerId) && s.phase !== "lobby";
    const playing = s.phase === "playing";
    const turnId = playing ? R.current(s) : null;
    const myTurn = turnId === playerId;

    $("uno-room-title").textContent = s.name ? `${s.name} · code` : "Table code";
    $("uno-count").textContent = `${s.players.length}/${R.MAX_PLAYERS}`;
    $("uno-dir").textContent = playing && s.order.length > 2 ? (s.dir === 1 ? "↻ clockwise" : "↺ anticlockwise") : "";

    // Players: this round's order first, then anyone waiting for the next deal.
    const list = [...s.order.filter((id) => s.players.some((p) => p.id === id)),
      ...s.players.map((p) => p.id).filter((id) => !s.order.includes(id))];
    const nextId = playing ? s.order[R.step(s, 1)] : null;
    swap($("uno-players"), list.map((id) => {
      const p = s.players.find((x) => x.id === id);
      const li = el("li", "uno-player"
        + (id === turnId ? " turn" : "")
        + (id === playerId ? " me" : "")
        + (s.winner === id && s.phase === "over" ? " won" : ""));
      const top = el("div", "up-name", p.name);
      const info = el("div", "up-info");
      const inHand = s.hands[id];
      if (inHand && s.phase !== "lobby") info.append(el("span", "up-cards", `🂠 ${inHand.length}`));
      else if (playing) info.append(el("span", "up-wait", "next round"));
      info.append(el("span", "up-score", `${s.scores[id] ?? 0} pts`));
      li.append(top, info);
      if (playing && s.saidUno[id] && inHand?.length <= 2) li.append(el("span", "up-badge", "UNO!"));
      if (!peerOnline(id)) li.append(el("span", "up-away", "away…"));
      if (id === nextId && s.order.length > 2) li.title = "Next up";
      return li;
    }));

    // The table.
    $("uno-table").hidden = s.phase === "lobby" || !s.discard.length;
    if (s.discard.length) {
      const topCard = R.top(s);
      const face = cardEl(topCard);
      face.classList.add("big", "ring-" + s.color);
      swap($("uno-top"), [face]);
      $("uno-color-label").textContent = R.COLOR_NAME[s.color] ?? "";
      $("uno-color-label").className = "uno-pile-label tint-" + s.color;
    }
    $("uno-deck").disabled = !(myTurn && !s.drew);
    $("uno-deck").classList.toggle("ready", myTurn && !s.drew);
    $("uno-deck-label").textContent = myTurn && !s.drew ? "Draw" : `${s.draw.length} left`;

    // Status line.
    let text;
    const nameOf = (id) => R.nameOf(s, id);
    if (s.phase === "lobby") {
      text = s.players.length < 2
        ? "Waiting for at least one more player. Send the invite link."
        : `${s.players.length} players here. Anyone at the table can deal.`;
      if (!seated) text = s.players.length >= R.MAX_PLAYERS ? "The table is full, so you're watching." : "You're watching.";
    } else if (s.phase === "over") {
      text = s.champion
        ? `🏆 ${s.champion === playerId ? "You win" : nameOf(s.champion) + " wins"} the game with ${s.scores[s.champion]} points!`
        : `${s.winner === playerId ? "You win" : nameOf(s.winner) + " wins"} the round: +${s.lastPoints} points.`;
    } else if (myTurn) {
      const t = R.top(s);
      text = s.drew
        ? `You drew ${R.cardName(s.hands[playerId].at(-1))}. Play it or keep it.`
        : `Your turn. Match ${R.COLOR_NAME[s.color]}${R.isWild(t) ? "" : " or " + R.cardName(t).split(" ").slice(1).join(" ")}, or draw.`;
    } else if (!dealtIn) {
      text = seated ? `${nameOf(turnId)}'s turn. You'll be dealt in next round.` : `Watching. ${nameOf(turnId)}'s turn.`;
    } else {
      text = `${nameOf(turnId)}'s turn${peerOnline(turnId) ? "" : " (away)"}.`;
    }
    $("uno-status").textContent = text;
    $("uno-status").classList.toggle("mine", myTurn);
    if (onUnoTab()) document.title = myTurn ? "🟢 Your turn · Family UNO" : "Family UNO";

    renderActions(s, { seated, dealtIn, playing, turnId, myTurn });
    renderHand(s, { dealtIn, myTurn });
    renderPanel(s, { seated });

    swap($("uno-log"), s.log.slice(-5).reverse().map((entry) => el("li", "", entry.text)));
    const seatedIds = new Set(s.players.map((p) => p.id));
    const onlookers = onlineIds().filter((id) => !seatedIds.has(id)).map((id) => peers.get(id)?.name || "Someone");
    $("uno-watchers").textContent = onlookers.length ? `Watching: ${onlookers.join(", ")}` : "";
    renderChat(s.chat);
  }

  function renderActions(s, { seated, dealtIn, playing, turnId, myTurn }) {
    const buttons = [];
    const add = (label, className, onClick) => {
      const b = el("button", className, label);
      b.type = "button";
      b.addEventListener("click", onClick);
      buttons.push(b);
    };
    if (playing && dealtIn) {
      const hand = s.hands[playerId];
      if (hand.length <= 2 && !s.saidUno[playerId]) {
        add("📣 UNO!", "uno-shout", () => act((d) => R.callUno(d, playerId)));
      }
      if (myTurn && s.drew) add("Keep it", "", () => act((d) => R.keep(d, playerId)));
      if (s.unoPending && s.unoPending !== playerId) {
        add(`🫵 Catch ${R.nameOf(s, s.unoPending)}!`, "uno-catch", () => act((d) => R.catchUno(d, playerId)));
      }
      if (turnId && !myTurn && !peerOnline(turnId)) {
        add(`Skip ${R.nameOf(s, turnId)}`, "", () => act((d) => R.skipTurn(d, playerId)));
      }
    }
    if (!seated && s.players.length < R.MAX_PLAYERS) {
      add("Sit down", "primary", () => act((d) => R.addPlayer(d, playerId, playerName || "Player")));
    }
    swap($("uno-actions"), buttons);
  }

  function renderHand(s, { dealtIn, myTurn }) {
    const handEl = $("uno-hand");
    const hand = dealtIn ? s.hands[playerId] || [] : [];
    handEl.hidden = !hand.length;
    const ok = new Set(myTurn ? R.playable(s, playerId) : []);
    // Newly arrived cards get a short highlight.
    const before = {};
    for (const c of lastHand) before[c] = (before[c] || 0) + 1;
    const fresh = new Set();
    hand.forEach((c, i) => { if (before[c] > 0) before[c] -= 1; else fresh.add(i); });
    if (lastHand.length === 0) fresh.clear();
    lastHand = [...hand];

    const shown = hand.map((card, index) => ({ card, index })).sort((a, b) => sortKey(a.card) - sortKey(b.card));
    swap(handEl, shown.map(({ card, index }) => {
      const button = cardEl(card, "button");
      button.type = "button";
      button.classList.toggle("playable", ok.has(index));
      button.classList.toggle("dim", myTurn && !ok.has(index));
      button.classList.toggle("fresh", fresh.has(index));
      button.classList.toggle("picked", picking?.index === index);
      button.setAttribute("aria-label", R.cardName(card) + (ok.has(index) ? ", playable" : ""));
      button.addEventListener("click", () => tapCard(index, card));
      return button;
    }));
    if (picking && (!myTurn || hand[picking.index] !== picking.card)) picking = null;
    $("uno-picker").hidden = !picking;
  }

  /** Before a round: who's here and the deal button. After: the scores. */
  function renderPanel(s, { seated }) {
    const panel = $("uno-panel");
    if (s.phase === "playing") { panel.hidden = true; return; }
    panel.hidden = false;
    const nodes = [];
    if (s.phase === "over" || s.round > 0) {
      const scores = s.players.map((p) => ({ p, pts: s.scores[p.id] ?? 0 })).sort((a, b) => b.pts - a.pts);
      const table = el("table", "uno-scores");
      const cap = el("caption", "", s.champion ? "Final scores" : `Scores · first to ${s.target}`);
      table.append(cap);
      for (const { p, pts } of scores) {
        const tr = el("tr", p.id === s.winner && s.phase === "over" ? "won" : "");
        tr.append(el("td", "", p.name + (p.id === playerId ? " (you)" : "")), el("td", "num", String(pts)));
        table.append(tr);
      }
      nodes.push(table);
      if (s.phase === "over") {
        const left = s.order.filter((id) => id !== s.winner && s.hands[id]?.length);
        if (left.length) {
          const reveal = el("div", "uno-reveal");
          for (const id of left) {
            const row = el("div", "uno-reveal-row");
            row.append(el("span", "uno-reveal-name", R.nameOf(s, id)));
            const cards = el("span", "uno-reveal-cards");
            for (const c of s.hands[id]) cards.append(cardEl(c));
            row.append(cards);
            reveal.append(row);
          }
          nodes.push(el("p", "hint", "Cards left in hands:"), reveal);
        }
      }
    } else {
      nodes.push(el("p", "hint",
        "Everyone gets 7 cards. Match the colour, number or symbol. Down to two cards? Tap UNO! before you play, or anyone can catch you. First to go out scores what's left in everyone's hands; first to 500 wins."));
    }
    if (seated) {
      const deal = el("button", "primary", s.phase === "lobby" && s.round === 0 ? "🃏 Deal the cards"
        : s.champion ? "🃏 New game" : "🃏 Next round");
      deal.type = "button";
      deal.disabled = s.players.length < R.MIN_PLAYERS;
      deal.addEventListener("click", () => act((d) => R.startRound(d, playerId)));
      nodes.push(deal);
    }
    swap(panel, nodes);
  }

  let lastChatId = 0;
  function renderChat(chat) {
    const newest = chat.length ? chat[chat.length - 1].id : 0;
    if (newest === lastChatId) return;
    lastChatId = newest;
    $("uno-messages").replaceChildren(...chat.map((m) => {
      const line = el("div", "msg");
      line.append(el("b", "", clean(m.name, 20) + ": "), document.createTextNode(clean(m.text, 200)));
      return line;
    }));
    $("uno-messages").scrollTop = $("uno-messages").scrollHeight;
  }

  // --- controls -----------------------------------------------------------------
  function currentName() {
    const name = clean(nameInput.value, 20);
    if (name && name !== playerName) {
      playerName = name;
      store.set("ttt:name", name);
    }
    return playerName || "Player";
  }

  let errorTimer = null;
  function lobbyMessage(text) {
    $("uno-lobby-error").textContent = text;
    $("uno-lobby-error").hidden = !text;
    clearTimeout(errorTimer);
    if (text) errorTimer = setTimeout(() => lobbyMessage(""), 5000);
  }

  function haveName() {
    if (clean(nameInput.value, 20)) return true;
    lobbyMessage("Type your name first.");
    nameInput.focus();
    return false;
  }

  function enterRoom(code) {
    if (!haveName()) return;
    lobbyMessage("");
    currentName();
    const url = new URL(location.href);
    url.searchParams.set("uno", code);
    url.hash = "uno";
    history.replaceState(null, "", url);
    connect(code);
  }

  async function createRoom(options) {
    if (!haveName()) return;
    const button = $("uno-create").querySelector("button[type=submit]");
    button.disabled = true;
    button.textContent = "Finding a free code…";
    try {
      await ensureClient();
      const code = await freshCode();
      pendingRoom = { code, ...options };
      enterRoom(code);
    } finally {
      button.disabled = false;
      button.textContent = "➕ Start a new table";
    }
  }

  function showLobby() {
    roomEl.hidden = true;
    lobbyEl.hidden = false;
    ensureClient();
    renderLobby();
  }

  $("uno-create").addEventListener("submit", (event) => {
    event.preventDefault();
    createRoom({ name: clean($("uno-room-name").value, 24), listed: $("uno-room-listed").checked });
  });
  $("uno-join").addEventListener("submit", (event) => {
    event.preventDefault();
    const code = clean(codeInput.value, 4).toUpperCase();
    if (!/^[A-Z0-9]{4}$/.test(code)) return lobbyMessage("Table codes are 4 letters or numbers.");
    enterRoom(code);
  });
  $("uno-deck").addEventListener("click", () => { picking = null; act((s) => R.draw(s, playerId)); });
  $("uno-picker").addEventListener("click", (event) => {
    const color = event.target.closest("[data-color]")?.dataset.color;
    if (!color || !picking) return;
    const { index, card } = picking;
    picking = null;
    playCard(index, card, color);
  });
  $("uno-pick-cancel").addEventListener("click", () => { picking = null; render(); });

  $("uno-share").addEventListener("click", async (event) => {
    const button = event.currentTarget;
    const link = `${location.origin}${location.pathname}?uno=${roomCode}#uno`;
    const text = `Come and play UNO with me! Table ${roomCode}`;
    try {
      if (navigator.share && matchMedia("(pointer: coarse)").matches) {
        await navigator.share({ title: "Family UNO", text, url: link });
        return;
      }
      await navigator.clipboard.writeText(`${text}: ${link}`);
      button.textContent = "Link copied!";
    } catch {
      button.textContent = link;
    }
    setTimeout(() => { button.textContent = "📨 Invite"; }, 1800);
  });

  $("uno-leave").addEventListener("click", () => {
    if (me()) act((s) => R.removePlayer(s, playerId, "left the table"));
    setTimeout(() => {
      leaveRoomNow();
      const url = new URL(location.href);
      url.searchParams.delete("uno");
      history.replaceState(null, "", url);
      showLobby();
    }, 250);
  });

  $("uno-chat").addEventListener("submit", (event) => {
    event.preventDefault();
    const input = $("uno-chat-input");
    const text = clean(input.value, 200);
    if (!text || !state) return;
    if (act((s) => say(s, playerName || "Player", text))) input.value = "";
  });

  nameInput.addEventListener("change", () => {
    const name = currentName();
    if (me()) act((s) => R.addPlayer(s, playerId, name));
    announce();
  });

  window.addEventListener("beforeunload", () => { try { leaveRoomNow(); client?.end(true); } catch {} });
  setInterval(() => { if (state) render(); }, 5000);

  // --- start --------------------------------------------------------------------
  // A link with ?uno= is an invitation straight to that table.
  const fromLink = new URLSearchParams(location.search).get("uno");
  const invited = fromLink && /^[A-Za-z0-9]{4}$/.test(fromLink) ? fromLink.toUpperCase() : null;
  if (invited) codeInput.value = invited;

  // Nothing connects until the UNO tab is actually showing, so opening the
  // other tabs never takes a seat here.
  let autoJoined = false;
  function onTab() {
    playerName = store.get("ttt:name", playerName);
    if (!nameInput.value) nameInput.value = playerName;
    if (invited && playerName && !roomCode && !autoJoined) {
      autoJoined = true;
      return enterRoom(invited);
    }
    if (!roomCode) showLobby();
    else document.title = "Family UNO";
    if (!playerName) nameInput.focus();
  }
  document.addEventListener("tabchange", (event) => { if (event.detail === "uno") onTab(); });
  if (onUnoTab()) onTab();
  nameInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && invited && !roomCode) enterRoom(invited);
  });
})();
