// Joins a room as a second player and answers every move, so the browser can
// be checked against a genuinely separate client over the public broker.
import mqtt from "mqtt";
import { createHash, randomUUID } from "node:crypto";

const room = (process.argv[2] ?? "PLA4").toUpperCase();
const name = process.argv[3] ?? "Cousin Ravi";
const id = randomUUID();

const key = createHash("sha256").update("family-tictactoe-v1:" + room).digest("hex").slice(0, 20);
const topicState = `ttt/${key}/state`;
const topicWho = `ttt/${key}/who`;

const LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
function evaluate(board) {
  for (const line of LINES) {
    const [a,b,c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return { winner: board[a], line, draw: false };
  }
  return { winner: null, line: null, draw: board.every((c) => c !== null) };
}
const turnFor = (board, start) =>
  board.filter((c) => c !== null).length % 2 === 0 ? start : (start === "X" ? "O" : "X");

let state = null;
const client = mqtt.connect("wss://broker.emqx.io:8084/mqtt", {
  clientId: "bot_" + id.slice(0, 8), clean: true, reconnectPeriod: 4000,
});

const seat = () => state?.seats.X?.id === id ? "X" : state?.seats.O?.id === id ? "O" : null;

function commit(mutate) {
  mutate(state);
  state.v += 1;
  state.by = id;
  client.publish(topicState, JSON.stringify(state), { retain: true, qos: 1 });
}

client.on("connect", () => {
  console.log(`joined ${room} as ${name}`);
  client.subscribe([topicState, topicWho], { qos: 1 });
  const announce = () => client.publish(topicWho, JSON.stringify({ id, name }), { qos: 0 });
  announce();
  setInterval(announce, 8000);

  setTimeout(() => {
    if (!state) return console.log("no room found - is the browser in it?");
    if (!seat() && !state.seats.O) {
      commit((s) => {
        s.seats.O = { id, name };
        s.chat.push({ id: s.nextChatId++, name: "", text: `${name} joined as O.`, at: Date.now() });
      });
      console.log("took the O seat");
    }
  }, 2000);
});

client.on("message", (topic, payload) => {
  if (topic !== topicState) return;
  let msg;
  try { msg = JSON.parse(payload.toString()); } catch { return; }
  if (state) {
    if (msg.v < state.v) return;
    if (msg.v === state.v && msg.by >= state.by) return;
  }
  state = msg;

  const me = seat();
  console.log(
    `v${state.v} board=${state.board.map((c) => c ?? ".").join("")} turn=${turnFor(state.board, state.startingMark)}` +
    (state.winner ? ` WINNER=${state.winner}` : state.draw ? " DRAW" : ""),
  );

  if (!me) return;
  const over = state.winner || state.draw;
  if (over || !state.seats.X || !state.seats.O) return;
  if (turnFor(state.board, state.startingMark) !== me) return;

  const free = state.board.findIndex((c) => c === null);
  if (free < 0) return;
  setTimeout(() => {
    commit((s) => {
      s.board[free] = me;
      const o = evaluate(s.board);
      s.winner = o.winner; s.line = o.line ? [...o.line] : null; s.draw = o.draw;
      if (o.winner) s.scores[o.winner] += 1; else if (o.draw) s.scores.draws += 1;
    });
  }, 700);
});

setTimeout(() => { client.end(true); process.exit(0); }, 180000);
