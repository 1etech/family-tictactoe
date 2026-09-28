// Exercises the serverless protocol the page uses: two clients, a public
// broker, retained state, version+publisher tiebreak. No server of ours.
import mqtt from "mqtt";
import { createHash, randomUUID } from "node:crypto";

const BROKER = "wss://broker.emqx.io:8084/mqtt";
const room = "T" + Math.random().toString(36).slice(2, 5).toUpperCase();
const key = createHash("sha256").update("family-tictactoe-v1:" + room).digest("hex").slice(0, 20);
const topicState = `ttt/${key}/state`;
const topicWho = `ttt/${key}/who`;

const LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
const emptyBoard = () => Array(9).fill(null);
function evaluate(board) {
  for (const line of LINES) {
    const [a,b,c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return { winner: board[a], line, draw: false };
  }
  return { winner: null, line: null, draw: board.every((c) => c !== null) };
}
const turnFor = (board, start) =>
  board.filter((c) => c !== null).length % 2 === 0 ? start : (start === "X" ? "O" : "X");

function makeClient(name) {
  const id = randomUUID();
  const c = mqtt.connect(BROKER, { clientId: "t_" + id.slice(0, 8), clean: true, reconnectPeriod: 0 });
  const self = {
    id, name, mqtt: c, state: null,
    seat() { return this.state?.seats.X?.id === id ? "X" : this.state?.seats.O?.id === id ? "O" : null; },
    commit(mutate) {
      mutate(this.state);
      this.state.v += 1;
      this.state.by = id;
      c.publish(topicState, JSON.stringify(this.state), { retain: true, qos: 1 });
    },
    waitFor(pred, label, ms = 8000) {
      return new Promise((resolve, reject) => {
        const t = setInterval(() => {
          if (this.state && pred(this.state)) { clearInterval(t); clearTimeout(f); resolve(this.state); }
        }, 50);
        const f = setTimeout(() => { clearInterval(t); reject(new Error("timeout: " + label)); }, ms);
      });
    },
  };
  c.on("message", (topic, payload) => {
    if (topic !== topicState) return;
    let msg;
    // An empty payload is how a retained message gets cleared.
    try { msg = JSON.parse(payload.toString()); } catch { return; }
    if (self.state) {
      if (msg.v < self.state.v) return;
      if (msg.v === self.state.v && msg.by >= self.state.by) return;
    }
    self.state = msg;
  });
  return new Promise((resolve) => {
    c.on("connect", () => { c.subscribe([topicState, topicWho], { qos: 1 }, () => resolve(self)); });
  });
}

const assert = (cond, msg) => {
  if (!cond) { console.log("  FAILED -", msg); process.exitCode = 1; }
  else console.log("  ok -", msg);
};

const a = await makeClient("Auntie");
const b = await makeClient("Nephew");
await new Promise((r) => setTimeout(r, 800));

console.log(`room ${room} -> topic ttt/${key.slice(0, 8)}…`);

// A arrives first and creates the room.
console.log("\nseating:");
a.state = {
  v: 1, by: a.id, board: emptyBoard(), startingMark: "X",
  winner: null, line: null, draw: false, round: 1,
  scores: { X: 0, O: 0, draws: 0 },
  seats: { X: { id: a.id, name: a.name }, O: null },
  chat: [], nextChatId: 1,
};
a.mqtt.publish(topicState, JSON.stringify(a.state), { retain: true, qos: 1 });

await b.waitFor((s) => s.seats.X?.id === a.id, "B receives retained state");
assert(true, "late joiner is handed the board via retained message");

b.commit((s) => { s.seats.O = { id: b.id, name: b.name }; });
await a.waitFor((s) => s.seats.O?.id === b.id, "A sees B seated");
assert(a.state.seats.O.name === "Nephew", "second player takes the O seat");

// Play a full round: X takes the top row.
console.log("\ngameplay:");
const move = async (who, i, other) => {
  who.commit((s) => {
    s.board[i] = who.seat();
    const o = evaluate(s.board);
    s.winner = o.winner; s.line = o.line ? [...o.line] : null; s.draw = o.draw;
    if (o.winner) s.scores[o.winner] += 1; else if (o.draw) s.scores.draws += 1;
  });
  await other.waitFor((s) => s.board[i] !== null, `move at ${i} reaches peer`);
};
await move(a, 0, b); await move(b, 3, a);
await move(a, 1, b); await move(b, 4, a);
await move(a, 2, b);

assert(b.state.winner === "X", "win detected on the other client");
assert(JSON.stringify(b.state.line) === "[0,1,2]", "winning line agreed");
assert(b.state.scores.X === 1, "score agreed");

console.log("\nrematch:");
a.commit((s) => {
  s.board = emptyBoard(); s.winner = null; s.line = null; s.draw = false;
  s.round += 1; s.startingMark = s.startingMark === "X" ? "O" : "X";
});
await b.waitFor((s) => s.round === 2, "rematch reaches peer");
assert(b.state.board.every((c) => c === null), "board cleared for both");
assert(turnFor(b.state.board, b.state.startingMark) === "O", "O opens round 2");
assert(b.state.scores.X === 1, "running score survives the rematch");

console.log("\nconflict handling:");
// Both publish at the same version; the lower publisher id must win everywhere.
const base = JSON.parse(JSON.stringify(a.state));
const mk = (who, text) => ({ ...JSON.parse(JSON.stringify(base)), v: base.v + 1, by: who.id, note: text });
a.mqtt.publish(topicState, JSON.stringify(mk(a, "from-a")), { retain: true, qos: 1 });
b.mqtt.publish(topicState, JSON.stringify(mk(b, "from-b")), { retain: true, qos: 1 });
await new Promise((r) => setTimeout(r, 2500));
const expected = a.id < b.id ? "from-a" : "from-b";
assert(a.state.note === b.state.note, "both clients converge on the same state");
assert(a.state.note === expected, `lower publisher id wins deterministically (${expected})`);

console.log("\nlate spectator:");
const c = await makeClient("Cousin");
await c.waitFor((s) => s.round === 2, "third client gets current board");
assert(c.seat() === null, "third arrival is a spectator");
assert(c.state.scores.X === 1, "spectator sees the running score");

// Leave the broker clean.
a.mqtt.publish(topicState, "", { retain: true, qos: 1 });
await new Promise((r) => setTimeout(r, 500));
for (const cl of [a, b, c]) cl.mqtt.end(true);
console.log(process.exitCode ? "\nSOME CHECKS FAILED" : "\nALL SERVERLESS SYNC CHECKS PASSED");
process.exit(process.exitCode ?? 0);
