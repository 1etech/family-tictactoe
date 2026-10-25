// UNO rules with no page or network code, so they can be tested on their own
// (test/uno-rules.mjs). A room's whole game is one plain JSON object that
// travels between browsers; uno.js handles the travelling. Every function
// here checks first and changes the state only when the move is allowed.
(() => {
  "use strict";

  const COLORS = ["R", "Y", "G", "B"];
  const COLOR_NAME = { R: "Red", Y: "Yellow", G: "Green", B: "Blue" };
  const VALUE_NAME = { S: "Skip", R: "Reverse", D: "Draw Two" };
  const MIN_PLAYERS = 2;
  const MAX_PLAYERS = 10;
  const HAND_SIZE = 7;
  const TARGET = 500;
  const MAX_LOG = 8;

  // A card is two characters: colour then value. Values are 0-9, S (skip),
  // R (reverse) and D (draw two). The wilds are "WW" and "W4" (draw four).
  function newDeck() {
    const deck = [];
    for (const c of COLORS) {
      deck.push(c + "0");
      for (const v of "123456789SRD") deck.push(c + v, c + v);
    }
    for (let i = 0; i < 4; i++) deck.push("WW", "W4");
    return deck;
  }

  /** A whole number in [0, n), from the browser's crypto when it has one. */
  let randomInt = (n) => {
    const c = globalThis.crypto;
    if (!c?.getRandomValues) return Math.floor(Math.random() * n);
    const buf = new Uint32Array(1);
    // Rejection sampling keeps every card equally likely.
    const limit = Math.floor(0x100000000 / n) * n;
    do c.getRandomValues(buf); while (buf[0] >= limit);
    return buf[0] % n;
  };

  function shuffle(list) {
    const a = [...list];
    for (let i = a.length - 1; i > 0; i--) {
      const j = randomInt(i + 1);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  const isWild = (card) => card[0] === "W";
  const top = (s) => s.discard[s.discard.length - 1];

  function cardName(card) {
    if (card === "WW") return "Wild";
    if (card === "W4") return "Wild Draw Four";
    return `${COLOR_NAME[card[0]]} ${VALUE_NAME[card[1]] ?? card[1]}`;
  }

  /** Points a card is worth to whoever goes out while it is still in a hand. */
  const points = (card) => (isWild(card) ? 50 : /\d/.test(card[1]) ? Number(card[1]) : 20);

  /** Same colour, same number or symbol, or any wild. */
  const matches = (card, onTop, color) =>
    isWild(card) || card[0] === color || (!isWild(onTop) && card[1] === onTop[1]);

  /** Wild Draw Four is only allowed when you hold nothing of the colour in play. */
  const hasColor = (hand, color) => hand.some((c) => !isWild(c) && c[0] === color);

  function whyNot(s, hand, card) {
    if (!matches(card, top(s), s.color)) {
      const t = top(s);
      const or = isWild(t) ? "" : ` or a ${VALUE_NAME[t[1]] ?? t[1]}`;
      return `That doesn't match. Play something ${COLOR_NAME[s.color]}${or}, a wild, or draw.`;
    }
    if (card === "W4" && hasColor(hand, s.color)) {
      return `Wild Draw Four only works when you have no ${COLOR_NAME[s.color]} cards.`;
    }
    return null;
  }

  // --- the room ---------------------------------------------------------------
  const newRoom = ({ name = "", listed = true } = {}) => ({
    v: 0,
    by: "",
    name,
    listed,
    players: [],      // everyone at the table, in seat order: { id, name }
    phase: "lobby",   // lobby | playing | over
    round: 0,
    dealer: -1,
    order: [],        // who was dealt into this round, in seat order
    hands: {},
    draw: [],         // the end of the array is the top of the pile
    discard: [],
    color: null,      // the colour in play; differs from the top card after a wild
    turn: 0,          // index into order
    dir: 1,
    drew: false,      // the current player has drawn and may play only that card
    saidUno: {},
    unoPending: null, // down to one card without calling UNO: can be caught
    scores: {},
    winner: null,
    lastPoints: 0,
    champion: null,
    target: TARGET,
    log: [],
    logSeq: 0,
    chat: [],
    nextChatId: 1,
  });

  const ok = { ok: true };
  const fail = (error) => ({ ok: false, error });
  const nameOf = (s, id) => s.players.find((p) => p.id === id)?.name
    ?? s.leftNames?.[id] ?? "Someone";
  const current = (s) => s.order[s.turn] ?? null;
  const inRound = (s, id) => s.phase === "playing" && s.order.includes(id);
  const step = (s, k = 1) => {
    const n = s.order.length;
    return (((s.turn + k * s.dir) % n) + n) % n;
  };

  function log(s, text) {
    s.log.push({ n: ++s.logSeq, text });
    if (s.log.length > MAX_LOG) s.log = s.log.slice(-MAX_LOG);
  }

  /** Moves everything but the top card back into the draw pile. */
  function refill(s) {
    if (s.discard.length < 2) return;
    const onTop = s.discard.pop();
    s.draw = shuffle(s.discard);
    s.discard = [onTop];
    log(s, "The draw pile ran out, so the played cards were shuffled back in.");
  }

  function drawCards(s, id, count) {
    const got = [];
    for (let i = 0; i < count; i++) {
      if (!s.draw.length) refill(s);
      if (!s.draw.length) break;
      got.push(s.draw.pop());
    }
    s.hands[id].push(...got);
    if (got.length) delete s.saidUno[id];
    return got;
  }

  /** The next player starting their turn ends the chance to catch a missed UNO. */
  function closeUnoWindow(s, actor) {
    if (s.unoPending && s.unoPending !== actor) s.unoPending = null;
  }

  function addPlayer(s, id, name) {
    const seat = s.players.find((p) => p.id === id);
    if (seat) {
      if (seat.name === name) return fail("");
      seat.name = name;
      return ok;
    }
    if (s.players.length >= MAX_PLAYERS) return fail(`The table is full (${MAX_PLAYERS} players).`);
    s.players.push({ id, name });
    s.scores[id] ??= 0;
    log(s, s.phase === "playing"
      ? `${name} sat down and will be dealt in next round.`
      : `${name} sat down.`);
    return ok;
  }

  /** Takes someone off the table. Their cards go to the bottom of the draw pile. */
  function removePlayer(s, id, why = "left") {
    const seat = s.players.findIndex((p) => p.id === id);
    if (seat < 0) return fail("");
    const name = s.players[seat].name;
    s.players.splice(seat, 1);
    // Keep the name so the log still reads well after they have gone.
    s.leftNames = { ...(s.leftNames || {}), [id]: name };
    log(s, `${name} ${why}.`);

    const at = s.order.indexOf(id);
    if (at >= 0) {
      if (s.phase === "playing") s.draw.unshift(...(s.hands[id] || []));
      delete s.hands[id];
      delete s.saidUno[id];
      if (s.unoPending === id) s.unoPending = null;
      const wasTurn = at === s.turn;
      s.order.splice(at, 1);
      const n = s.order.length;
      if (s.phase === "playing") {
        if (n < MIN_PLAYERS) {
          s.phase = "lobby";
          s.order = [];
          s.hands = {};
          s.drew = false;
          log(s, "Not enough players left, so the round was called off.");
        } else {
          if (wasTurn) {
            s.drew = false;
            s.turn = s.dir === 1 ? at % n : (at - 1 + n) % n;
          } else if (at < s.turn) {
            s.turn -= 1;
          }
        }
      }
    }
    return ok;
  }

  function startRound(s, actor) {
    if (s.phase === "playing") return fail("A round is already being played.");
    if (!s.players.some((p) => p.id === actor)) return fail("Only players at the table can deal.");
    if (s.players.length < MIN_PLAYERS) return fail("You need at least 2 players.");
    if (s.champion) {
      for (const id of Object.keys(s.scores)) s.scores[id] = 0;
      s.champion = null;
    }

    s.order = s.players.map((p) => p.id);
    const n = s.order.length;
    s.round += 1;
    s.dealer = (s.dealer + 1) % n;
    s.dir = 1;
    s.turn = (s.dealer + 1) % n;
    s.drew = false;
    s.saidUno = {};
    s.unoPending = null;
    s.winner = null;
    s.lastPoints = 0;

    let deck = shuffle(newDeck());
    s.hands = {};
    for (const id of s.order) { s.hands[id] = []; s.scores[id] ??= 0; }
    for (let i = 0; i < HAND_SIZE; i++) for (const id of s.order) s.hands[id].push(deck.pop());
    // A wild is never the first card: it goes back and the deck is reshuffled.
    while (isWild(deck[deck.length - 1])) deck = shuffle(deck);
    const first = deck.pop();
    s.draw = deck;
    s.discard = [first];
    s.color = first[0];
    s.phase = "playing";
    log(s, `Round ${s.round}: ${nameOf(s, s.order[s.dealer])} dealt. First card: ${cardName(first)}.`);

    const opener = s.order[s.turn];
    if (first[1] === "S") {
      log(s, `${nameOf(s, opener)} is skipped.`);
      s.turn = step(s, 1);
    } else if (first[1] === "R") {
      // The dealer goes first and play runs the other way (with two players
      // a reverse is a skip, which comes to the same thing).
      if (n > 2) s.dir = -1;
      s.turn = s.dealer;
      log(s, `Reversed: ${nameOf(s, s.order[s.turn])} goes first.`);
    } else if (first[1] === "D") {
      drawCards(s, opener, 2);
      log(s, `${nameOf(s, opener)} draws 2 and is skipped.`);
      s.turn = step(s, 1);
    }
    return ok;
  }

  function play(s, id, index, chosen) {
    if (s.phase !== "playing") return fail("The round hasn't started.");
    if (current(s) !== id) return fail("It's not your turn.");
    const hand = s.hands[id];
    if (!Number.isInteger(index) || index < 0 || index >= hand.length) return fail("That card isn't in your hand.");
    if (s.drew && index !== hand.length - 1) return fail("After drawing you can only play the card you drew.");
    const card = hand[index];
    const problem = whyNot(s, hand, card);
    if (problem) return fail(problem);
    if (isWild(card) && !COLORS.includes(chosen)) return fail("Choose a colour for the wild.");

    closeUnoWindow(s, id);
    hand.splice(index, 1);
    s.discard.push(card);
    s.color = isWild(card) ? chosen : card[0];
    s.drew = false;
    if (hand.length === 1 && !s.saidUno[id]) s.unoPending = id;

    const name = nameOf(s, id);
    let text = `${name} played ${cardName(card)}`;
    if (isWild(card)) text += ` and chose ${COLOR_NAME[chosen]}`;
    let advance = 1;
    const next = s.order[step(s, 1)];
    if (card[1] === "S") {
      advance = 2;
      text += `. ${nameOf(s, next)} is skipped`;
    } else if (card[1] === "R") {
      if (s.order.length === 2) {
        advance = 2;
        text += `. ${nameOf(s, next)} is skipped`;
      } else {
        s.dir = -s.dir;
        text += ". Play turns around";
      }
    } else if (card[1] === "D" || card === "W4") {
      const count = card === "W4" ? 4 : 2;
      drawCards(s, next, count);
      advance = 2;
      text += `. ${nameOf(s, next)} draws ${count} and is skipped`;
    }
    s.turn = step(s, advance);
    log(s, text + ".");

    if (!hand.length) endRound(s, id);
    return ok;
  }

  function endRound(s, id) {
    let total = 0;
    for (const other of s.order) {
      if (other !== id) total += s.hands[other].reduce((sum, c) => sum + points(c), 0);
    }
    s.scores[id] = (s.scores[id] ?? 0) + total;
    s.phase = "over";
    s.winner = id;
    s.lastPoints = total;
    s.unoPending = null;
    s.drew = false;
    log(s, `${nameOf(s, id)} went out and scores ${total} points.`);
    if (s.scores[id] >= s.target) {
      s.champion = id;
      log(s, `${nameOf(s, id)} reached ${s.target} and wins the game!`);
    }
  }

  /** Draw one. A playable card may then be played; otherwise the turn passes. */
  function draw(s, id) {
    if (s.phase !== "playing") return fail("The round hasn't started.");
    if (current(s) !== id) return fail("It's not your turn.");
    if (s.drew) return fail("You've drawn already. Play that card or keep it.");
    closeUnoWindow(s, id);
    const [card] = drawCards(s, id, 1);
    const name = nameOf(s, id);
    if (card && !whyNot(s, s.hands[id], card)) {
      s.drew = true;
      log(s, `${name} drew a card.`);
    } else {
      s.turn = step(s, 1);
      log(s, card ? `${name} drew a card and passed.` : `${name} had nothing to draw and passed.`);
    }
    return ok;
  }

  /** Keep the card just drawn and end the turn. */
  function keep(s, id) {
    if (s.phase !== "playing" || current(s) !== id || !s.drew) return fail("");
    s.drew = false;
    s.turn = step(s, 1);
    log(s, `${nameOf(s, id)} kept it.`);
    return ok;
  }

  function callUno(s, id) {
    if (!inRound(s, id)) return fail("");
    if (s.hands[id].length > 2) return fail("Call UNO when you are down to your last two cards.");
    if (s.saidUno[id]) return fail("");
    s.saidUno[id] = true;
    if (s.unoPending === id) s.unoPending = null;
    log(s, `${nameOf(s, id)} shouted UNO!`);
    return ok;
  }

  function catchUno(s, catcher) {
    const victim = s.unoPending;
    if (!inRound(s, catcher) || !victim || victim === catcher) return fail("Too late, they got away with it.");
    drawCards(s, victim, 2);
    s.unoPending = null;
    log(s, `${nameOf(s, catcher)} caught ${nameOf(s, victim)} not saying UNO. ${nameOf(s, victim)} draws 2.`);
    return ok;
  }

  /** Moves past a player who has gone quiet. They draw one, as if they had drawn and kept it. */
  function skipTurn(s, actor) {
    const who = current(s);
    if (!inRound(s, actor) || !who || who === actor) return fail("");
    closeUnoWindow(s, who);
    if (!s.drew) drawCards(s, who, 1);
    s.drew = false;
    s.turn = step(s, 1);
    log(s, `${nameOf(s, actor)} skipped ${nameOf(s, who)}, who seems to be away.`);
    return ok;
  }

  /** Which cards in this player's hand can go down now (indexes). */
  function playable(s, id) {
    if (s.phase !== "playing" || current(s) !== id) return [];
    const hand = s.hands[id] || [];
    const all = hand.map((_, i) => i);
    return (s.drew ? [hand.length - 1] : all).filter((i) => !whyNot(s, hand, hand[i]));
  }

  globalThis.UnoRules = {
    COLORS, COLOR_NAME, MIN_PLAYERS, MAX_PLAYERS, HAND_SIZE, TARGET,
    newDeck, shuffle, isWild, cardName, points, matches, top, current, nameOf, step,
    newRoom, addPlayer, removePlayer, startRound, play, draw, keep, callUno, catchUno, skipTurn,
    playable, whyNot,
    /** Tests swap in a seeded generator so games can be replayed. */
    setRandom(fn) { randomInt = fn; },
  };
})();
