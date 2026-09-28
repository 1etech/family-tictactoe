/**
 * Lightweight stand-in for the Cloudflare Worker, for machines that cannot
 * spare the memory Wrangler's runtime needs (~60MB here versus ~400MB there).
 *
 * It speaks the exact same WebSocket protocol as src/room.ts, so public/
 * index.html runs against either one with no changes, and it imports the same
 * rules from src/game.ts rather than restating them.
 *
 *   node server.mjs [port]
 */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";
import { emptyBoard, evaluate, isLegalMove, turnFor } from "./src/game.ts";

const ROOT = fileURLToPath(new URL(".", import.meta.url));
const PUBLIC = join(ROOT, "public");
const PORT = Number(process.argv[2] ?? 8787);

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const SEAT_GRACE_MS = 2 * 60_000;
const MAX_CHAT = 60;
const MAX_NAME = 20;
const MAX_CHAT_TEXT = 200;

const CONTROL_CHARS = /[\p{Cc}\p{Cf}]/gu;
const clean = (value, max) =>
  typeof value !== "string"
    ? ""
    : value.replace(CONTROL_CHARS, " ").replace(/\s+/g, " ").trim().slice(0, max);

// --- rooms -----------------------------------------------------------------

/** code -> room. Held in memory only; restarting the server clears the games. */
const rooms = new Map();

function freshRoom() {
  return {
    board: emptyBoard(),
    startingMark: "X",
    winner: null,
    line: null,
    draw: false,
    round: 1,
    seats: { X: null, O: null },
    scores: { X: 0, O: 0, draws: 0 },
    chat: [],
    nextChatId: 1,
    sockets: new Set(),
  };
}

const roomFor = (code) => {
  let room = rooms.get(code);
  if (!room) rooms.set(code, (room = freshRoom()));
  return room;
};

const seatOf = (room, playerId) => {
  if (room.seats.X?.playerId === playerId) return "X";
  if (room.seats.O?.playerId === playerId) return "O";
  return null;
};

const bothSeated = (room) => room.seats.X !== null && room.seats.O !== null;
const isOver = (room) => room.winner !== null || room.draw;

function pushChat(room, name, text) {
  room.chat.push({ id: room.nextChatId++, name, text, at: Date.now() });
  if (room.chat.length > MAX_CHAT) room.chat = room.chat.slice(-MAX_CHAT);
}

const systemMessage = (room, text) => pushChat(room, "", text);
const reject = (ws, message) => ws.send(JSON.stringify({ type: "notice", message }));

function broadcast(room) {
  const watchers = [];
  const seen = new Set();
  for (const sock of room.sockets) {
    const who = sock.player;
    if (!who || seen.has(who.playerId)) continue;
    seen.add(who.playerId);
    watchers.push({ name: who.name, seat: seatOf(room, who.playerId) });
  }

  const shared = {
    type: "state",
    board: room.board,
    turn: turnFor(room.board, room.startingMark),
    winner: room.winner,
    line: room.line,
    draw: room.draw,
    round: room.round,
    scores: room.scores,
    ready: bothSeated(room),
    over: isOver(room),
    seats: {
      X: room.seats.X && { name: room.seats.X.name, connected: room.seats.X.connected },
      O: room.seats.O && { name: room.seats.O.name, connected: room.seats.O.connected },
    },
    watchers,
    chat: room.chat,
  };

  for (const sock of room.sockets) {
    if (sock.readyState !== sock.OPEN || !sock.player) continue;
    try {
      sock.send(
        JSON.stringify({
          ...shared,
          you: { name: sock.player.name, seat: seatOf(room, sock.player.playerId) },
        }),
      );
    } catch {
      // Socket died mid-broadcast; its close handler will tidy up.
    }
  }
}

// --- actions ---------------------------------------------------------------

function handleMove(room, ws, index) {
  const mark = seatOf(room, ws.player.playerId);
  if (!mark) return reject(ws, "You are watching this game, not playing it.");
  if (!bothSeated(room)) return reject(ws, "Waiting for a second player.");
  if (isOver(room)) return reject(ws, "That round is finished — start a rematch.");
  if (turnFor(room.board, room.startingMark) !== mark) return reject(ws, "It is not your turn.");
  if (!isLegalMove(room.board, index)) return reject(ws, "That square is taken.");

  room.board[index] = mark;
  const outcome = evaluate(room.board);
  room.winner = outcome.winner;
  room.line = outcome.line ? [...outcome.line] : null;
  room.draw = outcome.draw;
  if (outcome.winner) room.scores[outcome.winner] += 1;
  else if (outcome.draw) room.scores.draws += 1;

  broadcast(room);
}

function handleRematch(room, ws) {
  if (!seatOf(room, ws.player.playerId)) return reject(ws, "Only players can start a rematch.");
  if (!isOver(room)) return reject(ws, "This round is still in play.");

  room.board = emptyBoard();
  room.winner = null;
  room.line = null;
  room.draw = false;
  room.round += 1;
  // Alternate the opening move so neither seat keeps the first-move advantage.
  room.startingMark = room.startingMark === "X" ? "O" : "X";
  broadcast(room);
}

function handleSit(room, ws, seat) {
  if (seat !== "X" && seat !== "O") return;
  if (seatOf(room, ws.player.playerId)) return reject(ws, "You already have a seat.");
  if (room.seats[seat]) return reject(ws, "That seat was just taken.");

  room.seats[seat] = {
    playerId: ws.player.playerId,
    name: ws.player.name,
    connected: true,
    lastSeen: Date.now(),
  };
  systemMessage(room, `${ws.player.name} joined as ${seat}.`);
  broadcast(room);
}

function handleStand(room, ws) {
  const mark = seatOf(room, ws.player.playerId);
  if (!mark) return;
  const { name } = room.seats[mark];
  room.seats[mark] = null;
  systemMessage(room, `${name} gave up the ${mark} seat.`);
  broadcast(room);
}

function handleRename(room, ws, raw) {
  const name = clean(raw, MAX_NAME);
  if (!name || name === ws.player.name) return;
  ws.player.name = name;
  const mark = seatOf(room, ws.player.playerId);
  if (mark) room.seats[mark].name = name;
  broadcast(room);
}

// --- connection lifecycle --------------------------------------------------

function seatArrival(room, ws) {
  const { playerId, name } = ws.player;
  const now = Date.now();
  const existing = seatOf(room, playerId);

  if (existing) {
    // Reclaim after a refresh or a dropped connection.
    room.seats[existing] = { playerId, name, connected: true, lastSeen: now };
    return;
  }
  const free = ["X", "O"].find((mark) => room.seats[mark] === null);
  if (free) {
    room.seats[free] = { playerId, name, connected: true, lastSeen: now };
    systemMessage(room, `${name} joined as ${free}.`);
  }
  // No free seat: this connection watches until someone stands up.
}

function markDeparture(room, ws) {
  room.sockets.delete(ws);
  if (!ws.player) return;

  // Another tab from the same person may still be open.
  for (const sock of room.sockets) {
    if (sock.player?.playerId === ws.player.playerId) return broadcast(room);
  }
  const mark = seatOf(room, ws.player.playerId);
  if (mark) {
    room.seats[mark].connected = false;
    room.seats[mark].lastSeen = Date.now();
  }
  broadcast(room);
}

/** Frees seats whose player dropped and never came back. */
setInterval(() => {
  const now = Date.now();
  for (const room of rooms.values()) {
    let changed = false;
    for (const mark of ["X", "O"]) {
      const seat = room.seats[mark];
      if (seat && !seat.connected && now - seat.lastSeen > SEAT_GRACE_MS) {
        room.seats[mark] = null;
        systemMessage(room, `${seat.name} left the game.`);
        changed = true;
      }
    }
    if (changed) broadcast(room);
  }
}, 30_000).unref();

// --- http ------------------------------------------------------------------

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

const randomCode = () =>
  Array.from({ length: 4 }, () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join("");

function normalizeCode(raw) {
  const code = raw.trim().toUpperCase();
  if (code.length !== 4) return null;
  for (const char of code) if (!CODE_ALPHABET.includes(char)) return null;
  return code;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);

  if (url.pathname === "/api/create" && req.method === "POST") {
    let code = randomCode();
    for (let i = 0; i < 8 && rooms.has(code); i++) code = randomCode();
    res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    return res.end(JSON.stringify({ code }));
  }

  // Everything else is a static file; unknown paths fall back to the page.
  const name = url.pathname === "/" ? "/index.html" : url.pathname;
  try {
    const body = await readFile(join(PUBLIC, name.replace(/^\/+/, "")));
    res.writeHead(200, { "Content-Type": MIME[extname(name)] ?? "application/octet-stream" });
    res.end(body);
  } catch {
    const body = await readFile(join(PUBLIC, "index.html"));
    res.writeHead(200, { "Content-Type": MIME[".html"] });
    res.end(body);
  }
});

const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (req, socket, head) => {
  const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);
  const match = url.pathname.match(/^\/api\/room\/([^/]+)$/);
  const code = match && normalizeCode(decodeURIComponent(match[1]));
  const playerId = clean(url.searchParams.get("playerId"), 40);

  if (!code || !playerId) {
    socket.write("HTTP/1.1 400 Bad Request\r\n\r\n");
    return socket.destroy();
  }

  wss.handleUpgrade(req, socket, head, (ws) => {
    const room = roomFor(code);
    ws.player = { playerId, name: clean(url.searchParams.get("name"), MAX_NAME) || "Player" };
    room.sockets.add(ws);

    seatArrival(room, ws);
    broadcast(room);

    ws.on("message", (raw) => {
      const text = raw.toString();
      // Matches the auto-response pair the Worker version registers.
      if (text === "ping") return ws.send("pong");

      let msg;
      try {
        msg = JSON.parse(text);
      } catch {
        return;
      }
      switch (msg.type) {
        case "move": return handleMove(room, ws, msg.index);
        case "rematch": return handleRematch(room, ws);
        case "resetScores":
          if (!seatOf(room, ws.player.playerId)) return reject(ws, "Only players can reset the score.");
          room.scores = { X: 0, O: 0, draws: 0 };
          systemMessage(room, "Scoreboard cleared.");
          return broadcast(room);
        case "sit": return handleSit(room, ws, msg.seat);
        case "stand": return handleStand(room, ws);
        case "rename": return handleRename(room, ws, msg.name);
        case "chat": {
          const text = clean(msg.text, MAX_CHAT_TEXT);
          if (!text) return;
          pushChat(room, ws.player.name, text);
          return broadcast(room);
        }
      }
    });

    ws.on("close", () => markDeparture(room, ws));
    ws.on("error", () => markDeparture(room, ws));
  });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`tic tac toe ready on http://127.0.0.1:${PORT}`);
});
