// Checks the UNO rules in docs/uno/rules.js: the deck, each card's effect,
// calling and catching UNO, scoring, players leaving mid-round, then plays
// thousands of random games with 2 to 10 players and checks no card is ever
// lost or duplicated and every game can finish.
import { readFile } from "node:fs/promises";
import { createContext, runInContext } from "node:vm";
import { join } from "node:path";

const context = createContext({ Math, Number, String, Array, Object, Set, JSON, Uint32Array });
context.globalThis = context;
runInContext(await readFile(join(import.meta.dirname, "..", "docs", "uno", "rules.js"), "utf8"), context, { filename: "rules.js" });
const R = context.UnoRules;

let failures = 0;
const check = (cond, msg) => {
  if (!cond) { failures += 1; console.error("  ✗", msg); } else console.log("  ✓", msg);
};

// A small seeded generator so a failing game can be replayed.
function seeded(seed) {
  let x = seed >>> 0 || 1;
  return (n) => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x % n; };
}

const room = (n) => {
  const s = R.newRoom();
  for (let i = 0; i < n; i++) R.addPlayer(s, `p${i}`, `Player ${i}`);
  return s;
};
/** A round with chosen hands and top card, so each rule can be checked exactly. */
const rigged = (hands, onTop, extra = {}) => {
  const s = room(hands.length);
  R.startRound(s, "p0");
  hands.forEach((h, i) => { s.hands[`p${i}`] = [...h]; });
  s.discard = [onTop];
  s.color = onTop[0];
  s.turn = 0;
  s.dir = 1;
  s.draw = ["R1", "R2", "R3", "R4", "R5", "R6", "R7", "R8"];
  Object.assign(s, extra);
  return s;
};
const count = (s) => s.draw.length + s.discard.length + Object.values(s.hands).reduce((a, h) => a + h.length, 0);

console.log("deck:");
{
  const deck = R.newDeck();
  const tally = (pred) => deck.filter(pred).length;
  check(deck.length === 108, "108 cards");
  check(tally((c) => c === "WW") === 4 && tally((c) => c === "W4") === 4, "4 wilds and 4 wild draw fours");
  check(R.COLORS.every((c) => tally((x) => x === c + "0") === 1), "one 0 per colour");
  check(R.COLORS.every((c) => [..."123456789SRD"].every((v) => tally((x) => x === c + v) === 2)), "two of 1-9, skip, reverse, draw two per colour");
}

console.log("\ndealing:");
for (const n of [2, 5, 10]) {
  const s = room(n);
  check(R.startRound(s, "p0").ok, `${n} players can start`);
  check(s.order.length === n && s.order.every((id) => s.hands[id].length >= 7), `${n} players get 7 cards each`);
  check(count(s) === 108 && !R.isWild(s.discard[0]), `${n} players: all 108 cards accounted for, first card not wild`);
}
{
  const s = room(1);
  check(!R.startRound(s, "p0").ok, "one player cannot start");
  const full = room(10);
  check(!R.addPlayer(full, "p10", "Eleven").ok && full.players.length === 10, "an 11th player is turned away");
}

console.log("\nmatching:");
{
  const s = rigged([["R5", "B5", "G7", "WW", "W4"], ["Y1"]], "R9");
  check(JSON.stringify(R.playable(s, "p0")) === "[0,3]", "same colour or a wild; wild draw four not while holding red");
  check(!R.play(s, "p0", 2).ok, "a green 7 does not go on a red 9");
  check(!R.play(s, "p0", 3).ok, "a wild needs a colour");
  check(!R.play(s, "p1", 0).ok, "nobody plays out of turn");
  const t = rigged([["B9", "G2"], ["Y1"]], "R9");
  check(R.play(t, "p0", 0).ok && t.color === "B", "same number changes the colour");
  const u = rigged([["B1", "W4", "G2"], ["Y1", "Y2"]], "R9");
  check(R.play(u, "p0", 1, "G").ok && u.color === "G", "wild draw four allowed with no red, colour chosen");
  check(u.hands.p1.length === 6 && R.current(u) === "p0", "next player draws 4 and is skipped");
  const v = rigged([["G4", "B2"], ["Y1"]], "W4", { color: "Y" });
  check(!R.play(v, "p0", 0).ok, "a 4 does not match a wild draw four's number");
}

console.log("\naction cards:");
{
  const s = rigged([["RS", "R1"], ["Y1"], ["Y2"]], "R9");
  R.play(s, "p0", 0);
  check(R.current(s) === "p2", "skip jumps the next player");
  const r = rigged([["RR", "R1"], ["Y1"], ["Y2"]], "R9");
  R.play(r, "p0", 0);
  check(r.dir === -1 && R.current(r) === "p2", "reverse turns play around");
  const r2 = rigged([["RR", "R1"], ["Y1"]], "R9");
  R.play(r2, "p0", 0);
  check(R.current(r2) === "p0", "with two players reverse is a skip");
  const d = rigged([["RD", "R1"], ["Y1"], ["Y2"]], "R9");
  R.play(d, "p0", 0);
  check(d.hands.p1.length === 3 && R.current(d) === "p2", "draw two: next draws 2 and is skipped");
  const w = rigged([["WW", "R1"], ["Y1"]], "G9");
  R.play(w, "p0", 0, "Y");
  check(w.color === "Y" && R.matches("Y1", R.top(w), w.color), "wild sets the colour");
}

console.log("\ndrawing:");
{
  const s = rigged([["G1"], ["Y1"]], "R9");
  s.draw = ["R5"];
  R.draw(s, "p0");
  check(s.drew && R.current(s) === "p0", "a playable draw can be played straight away");
  check(!R.play(s, "p0", 0).ok, "only the drawn card, not another");
  check(R.keep(s, "p0").ok && R.current(s) === "p1", "or kept, ending the turn");
  const t = rigged([["G1"], ["Y1"]], "R9");
  t.draw = ["B5"];
  R.draw(t, "p0");
  check(!t.drew && R.current(t) === "p1", "an unplayable draw passes the turn");
  const e = rigged([["G1"], ["Y1"]], "R9");
  e.draw = [];
  e.discard = ["B2", "B3", "R9"];
  R.draw(e, "p0");
  check(e.discard.length === 1 && e.discard[0] === "R9" && e.hands.p0.length === 2, "an empty pile is refilled from the played cards");
}

console.log("\nUNO:");
{
  const s = rigged([["R1", "R2"], ["Y1", "Y2"], ["G1"]], "R9");
  R.play(s, "p0", 0);
  check(s.unoPending === "p0", "down to one card without calling: catchable");
  check(!R.catchUno(s, "p0").ok, "you cannot catch yourself");
  check(R.catchUno(s, "p2").ok && s.hands.p0.length === 3 && !s.unoPending, "caught: draws 2");
  const t = rigged([["R1", "R2"], ["Y1", "Y2"]], "R9");
  check(R.callUno(t, "p0").ok, "UNO can be called with two cards");
  R.play(t, "p0", 0);
  check(!t.unoPending, "called in time: safe");
  const u = rigged([["R1", "R2"], ["R3", "Y2"]], "R9");
  R.play(u, "p0", 0);
  check(R.callUno(u, "p0").ok && !u.unoPending, "calling just after playing still counts");
  const late = rigged([["R1", "R2"], ["R3", "Y2", "Y3"]], "R9");
  R.play(late, "p0", 0);
  R.play(late, "p1", 0);
  check(!late.unoPending && !R.catchUno(late, "p1").ok, "once the next player moves it's too late to catch");
  check(!R.callUno(rigged([["R1", "R2", "R3"], ["Y1"]], "R9"), "p0").ok, "not with three cards");
}

console.log("\nscoring:");
{
  const s = rigged([["R1"], ["Y7", "GS", "WW"], ["B9"]], "R9", { scores: { p0: 480, p1: 0, p2: 0 } });
  R.play(s, "p0", 0);
  check(s.phase === "over" && s.winner === "p0", "playing the last card wins the round");
  check(s.lastPoints === 7 + 20 + 50 + 9, "points: face value, 20 for actions, 50 for wilds");
  check(s.champion === "p0", "reaching 500 wins the game");
  R.startRound(s, "p1");
  check(s.round === 2 && s.scores.p0 === 0 && !s.champion, "a new game starts everyone at zero");
  const d = rigged([["RD"], ["Y7"]], "R9");
  R.play(d, "p0", 0);
  check(d.hands.p1.length === 3 && d.lastPoints === d.hands.p1.reduce((a, c) => a + R.points(c), 0), "a final draw two still makes the next player draw, and those count");
}

console.log("\njoining and leaving:");
{
  const s = rigged([["R1", "R2"], ["Y1"], ["Y2"], ["Y3"], ["Y4"]], "R9");
  R.addPlayer(s, "late", "Late");
  check(!s.order.includes("late") && s.players.length === 6, "joining mid-round waits for the next deal");
  s.turn = 2;
  const before = count(s);
  R.removePlayer(s, "p2");
  check(R.current(s) === "p3", "leaving on your turn passes it to the next player");
  check(count(s) === before && s.draw[0] === "Y2", "their cards go to the bottom of the draw pile");
  R.removePlayer(s, "p0");
  check(R.current(s) === "p3", "someone earlier leaving doesn't move the turn");
  s.turn = s.order.indexOf("p4");
  R.removePlayer(s, "p4");
  check(s.phase === "playing" && R.current(s) === "p1", "turn wraps round when the last seat leaves");
  R.removePlayer(s, "p3");
  check(s.phase === "lobby", "one player left: the round is called off");
  check(R.startRound(s, "late").ok && s.order.includes("late"), "the next deal includes whoever joined mid-round");
}

console.log("\nrandom games:");
const GAMES = 3000;
let finished = 0, rounds = 0, broken = 0, longest = 0;
for (let g = 0; g < GAMES; g++) {
  const seed = 1000 + g;
  const rand = seeded(seed);
  R.setRandom(rand);
  const n = 2 + (g % 9);
  const s = room(n);
  let joined = n;
  const fault = (msg) => { if (broken++ < 10) console.error(`  ✗ game seed ${seed} (${n} players): ${msg}`); };
  for (let round = 0; round < 3; round++) {
    if (!R.startRound(s, s.players[0].id).ok) { fault("could not start"); break; }
    let moves = 0;
    while (s.phase === "playing" && moves < 5000) {
      moves += 1;
      const who = R.current(s);
      if (!s.order.includes(who)) { fault("current player not in the round"); break; }
      const roll = rand(1000);
      if (roll < 3 && s.order.length > 2) {
        R.removePlayer(s, s.order[rand(s.order.length)]);
      } else if (roll < 6 && s.players.length < R.MAX_PLAYERS) {
        R.addPlayer(s, `j${joined}`, `Joiner ${joined++}`);
      } else if (roll < 20 && s.unoPending) {
        const catcher = s.order.find((id) => id !== s.unoPending);
        if (!R.catchUno(s, catcher).ok) fault("catch refused while pending");
      } else if (roll < 25) {
        const other = s.order.find((id) => id !== who);
        R.skipTurn(s, other);
      } else {
        if (s.hands[who].length <= 2 && rand(2)) R.callUno(s, who);
        const options = R.playable(s, who);
        if (options.length && rand(10)) {
          const i = options[rand(options.length)];
          const r = R.play(s, who, i, R.COLORS[rand(4)]);
          if (!r.ok) fault(`playable card refused: ${r.error}`);
        } else if (s.drew) {
          R.keep(s, who);
        } else if (!R.draw(s, who).ok) fault("draw refused");
      }
      if (s.phase === "playing") {
        const total = count(s);
        const left = Object.keys(s.hands).filter((id) => !s.order.includes(id));
        if (left.length) fault("hand kept for someone not in the round");
        if (total !== 108) { fault(`card count ${total}`); break; }
        if (!(s.turn >= 0 && s.turn < s.order.length)) { fault(`turn index ${s.turn}`); break; }
        if (!R.COLORS.includes(s.color)) { fault(`colour ${s.color}`); break; }
      }
    }
    longest = Math.max(longest, moves);
    if (s.phase === "playing") { fault("round never ended"); break; }
    if (s.phase === "over") rounds += 1;
    if (s.phase === "lobby") break;
    const sum = Object.values(s.scores).reduce((a, b) => a + b, 0);
    if (!Number.isFinite(sum)) fault("score is not a number");
  }
  finished += 1;
}
check(broken === 0, `${finished} games, ${rounds} rounds won, longest round ${longest} moves, no faults`);

console.log(failures ? `\n${failures} UNO CHECK(S) FAILED` : "\nALL UNO RULE CHECKS PASSED");
process.exit(failures ? 1 : 0);
