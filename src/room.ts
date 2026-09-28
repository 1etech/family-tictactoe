import { DurableObject } from "cloudflare:workers";
import {
  emptyBoard,
  evaluate,
  isLegalMove,
  turnFor,
  type Board,
  type Mark,
} from "./game.ts";

/** A seat is reserved for a playerId so a refresh or dropped connection can reclaim it. */
export interface Seat {
  playerId: string;
  name: string;
  connected: boolean;
  /** When this seat last had a live socket; used to expire abandoned seats. */
  lastSeen: number;
}

export interface ChatMessage {
  id: number;
  name: string;
  text: string;
  at: number;
}

export interface RoomState {
  board: Board;
  /** Which mark opens the current round. Alternates each rematch. */
  startingMark: Mark;
  winner: Mark | null;
  line: number[] | null;
  draw: boolean;
  round: number;
  seats: { X: Seat | null; O: Seat | null };
  scores: { X: number; O: number; draws: number };
  chat: ChatMessage[];
  nextChatId: number;
  createdAt: number;
}

interface Attachment {
  playerId: string;
  name: string;
}

/** Seats go stale this long after their socket drops, then anyone may take them. */
const SEAT_GRACE_MS = 2 * 60_000;
const SWEEP_INTERVAL_MS = 30_000;
const MAX_CHAT = 60;
const MAX_NAME = 20;
const MAX_CHAT_TEXT = 200;

const CONTROL_CHARS = /[\p{Cc}\p{Cf}]/gu;

function clean(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  // Drop control characters and collapse whitespace before anything is stored.
  return value.replace(CONTROL_CHARS, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

function freshState(): RoomState {
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
    createdAt: Date.now(),
  };
}

export class GameRoom extends DurableObject<Env> {
  private state!: RoomState;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.state = (await ctx.storage.get<RoomState>("state")) ?? freshState();
    });
  }

  /** True when this room has never been used — lets the Worker avoid handing out a busy code. */
  async isUnused(): Promise<boolean> {
    return (
      this.state.seats.X === null &&
      this.state.seats.O === null &&
      this.state.round === 1 &&
      this.state.board.every((cell) => cell === null)
    );
  }

  override async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected a WebSocket upgrade", { status: 426 });
    }

    const url = new URL(request.url);
    const playerId = clean(url.searchParams.get("playerId"), 40);
    const name = clean(url.searchParams.get("name"), MAX_NAME) || "Player";
    if (!playerId) return new Response("Missing playerId", { status: 400 });

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];

    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ playerId, name } satisfies Attachment);
    // Answered by the runtime without waking the object, so idle rooms stay cheap.
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));

    await this.seatArrival(playerId, name);
    this.broadcast();

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    if (typeof raw !== "string") return;

    let msg: { type?: string; [key: string]: unknown };
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    const who = ws.deserializeAttachment() as Attachment | null;
    if (!who) return;

    switch (msg.type) {
      case "move":
        await this.handleMove(who.playerId, msg.index as number, ws);
        break;
      case "rematch":
        await this.handleRematch(who.playerId, ws);
        break;
      case "resetScores":
        await this.handleResetScores(who.playerId, ws);
        break;
      case "sit":
        await this.handleSit(who, msg.seat as string, ws);
        break;
      case "stand":
        await this.handleStand(who.playerId);
        break;
      case "rename":
        await this.handleRename(ws, who, msg.name as string);
        break;
      case "chat":
        await this.handleChat(who, msg.text as string);
        break;
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    await this.markDeparture(ws);
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    await this.markDeparture(ws);
  }

  /** Releases seats whose player dropped and never came back. */
  async alarm(): Promise<void> {
    const now = Date.now();
    let changed = false;

    for (const mark of ["X", "O"] as const) {
      const seat = this.state.seats[mark];
      if (seat && !seat.connected && now - seat.lastSeen > SEAT_GRACE_MS) {
        this.state.seats[mark] = null;
        this.systemMessage(`${seat.name} left the game.`);
        changed = true;
      }
    }

    if (changed) {
      await this.save();
      this.broadcast();
    }
    await this.scheduleSweepIfNeeded();
  }

  // --- actions -------------------------------------------------------------

  private async handleMove(playerId: string, index: number, ws: WebSocket): Promise<void> {
    const mark = this.seatOf(playerId);
    if (!mark) return this.reject(ws, "You are watching this game, not playing it.");
    if (!this.bothSeated()) return this.reject(ws, "Waiting for a second player.");
    if (this.isOver()) return this.reject(ws, "That round is finished — start a rematch.");
    if (turnFor(this.state.board, this.state.startingMark) !== mark) {
      return this.reject(ws, "It is not your turn.");
    }
    if (!isLegalMove(this.state.board, index)) return this.reject(ws, "That square is taken.");

    this.state.board[index] = mark;

    const outcome = evaluate(this.state.board);
    this.state.winner = outcome.winner;
    this.state.line = outcome.line ? [...outcome.line] : null;
    this.state.draw = outcome.draw;

    if (outcome.winner) this.state.scores[outcome.winner] += 1;
    else if (outcome.draw) this.state.scores.draws += 1;

    await this.save();
    this.broadcast();
  }

  private async handleRematch(playerId: string, ws: WebSocket): Promise<void> {
    if (!this.seatOf(playerId)) return this.reject(ws, "Only players can start a rematch.");
    if (!this.isOver()) return this.reject(ws, "This round is still in play.");

    this.state.board = emptyBoard();
    this.state.winner = null;
    this.state.line = null;
    this.state.draw = false;
    this.state.round += 1;
    // Alternate the opening move so neither seat keeps the first-move advantage.
    this.state.startingMark = this.state.startingMark === "X" ? "O" : "X";

    await this.save();
    this.broadcast();
  }

  private async handleResetScores(playerId: string, ws: WebSocket): Promise<void> {
    if (!this.seatOf(playerId)) return this.reject(ws, "Only players can reset the score.");
    this.state.scores = { X: 0, O: 0, draws: 0 };
    this.systemMessage("Scoreboard cleared.");
    await this.save();
    this.broadcast();
  }

  private async handleSit(who: Attachment, seat: string, ws: WebSocket): Promise<void> {
    if (seat !== "X" && seat !== "O") return;
    if (this.seatOf(who.playerId)) return this.reject(ws, "You already have a seat.");
    if (this.state.seats[seat]) return this.reject(ws, "That seat was just taken.");

    this.state.seats[seat] = {
      playerId: who.playerId,
      name: who.name,
      connected: true,
      lastSeen: Date.now(),
    };
    this.systemMessage(`${who.name} joined as ${seat}.`);
    await this.save();
    this.broadcast();
  }

  private async handleStand(playerId: string): Promise<void> {
    const mark = this.seatOf(playerId);
    if (!mark) return;
    const name = this.state.seats[mark]!.name;
    this.state.seats[mark] = null;
    this.systemMessage(`${name} gave up the ${mark} seat.`);
    await this.save();
    this.broadcast();
  }

  private async handleRename(ws: WebSocket, who: Attachment, raw: string): Promise<void> {
    const name = clean(raw, MAX_NAME);
    if (!name || name === who.name) return;

    ws.serializeAttachment({ playerId: who.playerId, name } satisfies Attachment);
    const mark = this.seatOf(who.playerId);
    if (mark) this.state.seats[mark]!.name = name;

    await this.save();
    this.broadcast();
  }

  private async handleChat(who: Attachment, raw: string): Promise<void> {
    const text = clean(raw, MAX_CHAT_TEXT);
    if (!text) return;
    this.pushChat({ id: this.state.nextChatId++, name: who.name, text, at: Date.now() });
    await this.save();
    this.broadcast();
  }

  // --- seating & presence --------------------------------------------------

  private async seatArrival(playerId: string, name: string): Promise<void> {
    const now = Date.now();
    const existing = this.seatOf(playerId);

    if (existing) {
      // Reclaim after a refresh or a dropped connection.
      this.state.seats[existing] = { playerId, name, connected: true, lastSeen: now };
    } else {
      const free = (["X", "O"] as const).find((mark) => this.state.seats[mark] === null);
      if (free) {
        this.state.seats[free] = { playerId, name, connected: true, lastSeen: now };
        this.systemMessage(`${name} joined as ${free}.`);
      }
      // No free seat: this connection watches until someone stands up.
    }

    await this.save();
    await this.scheduleSweepIfNeeded();
  }

  private async markDeparture(ws: WebSocket): Promise<void> {
    const who = ws.deserializeAttachment() as Attachment | null;
    if (!who) return;

    // Another tab from the same person may still be open — only mark away if none remain.
    const stillHere = this.ctx.getWebSockets().some((sock) => {
      if (sock === ws) return false;
      const other = sock.deserializeAttachment() as Attachment | null;
      return other?.playerId === who.playerId;
    });
    if (stillHere) return;

    const mark = this.seatOf(who.playerId);
    if (mark) {
      this.state.seats[mark]!.connected = false;
      this.state.seats[mark]!.lastSeen = Date.now();
      await this.save();
      await this.scheduleSweepIfNeeded();
    }
    this.broadcast();
  }

  private seatOf(playerId: string): Mark | null {
    if (this.state.seats.X?.playerId === playerId) return "X";
    if (this.state.seats.O?.playerId === playerId) return "O";
    return null;
  }

  private bothSeated(): boolean {
    return this.state.seats.X !== null && this.state.seats.O !== null;
  }

  private isOver(): boolean {
    return this.state.winner !== null || this.state.draw;
  }

  private async scheduleSweepIfNeeded(): Promise<void> {
    const pending = (["X", "O"] as const).some((mark) => {
      const seat = this.state.seats[mark];
      return seat !== null && !seat.connected;
    });
    if (!pending) return;
    if ((await this.ctx.storage.getAlarm()) !== null) return;
    await this.ctx.storage.setAlarm(Date.now() + SWEEP_INTERVAL_MS);
  }

  // --- plumbing ------------------------------------------------------------

  private systemMessage(text: string): void {
    this.pushChat({ id: this.state.nextChatId++, name: "", text, at: Date.now() });
  }

  private pushChat(message: ChatMessage): void {
    this.state.chat.push(message);
    if (this.state.chat.length > MAX_CHAT) {
      this.state.chat = this.state.chat.slice(-MAX_CHAT);
    }
  }

  private async save(): Promise<void> {
    await this.ctx.storage.put("state", this.state);
  }

  private reject(ws: WebSocket, message: string): void {
    ws.send(JSON.stringify({ type: "notice", message }));
  }

  /** Each socket gets the same game plus its own seat, so the UI knows what it may do. */
  private broadcast(): void {
    const watchers: { name: string; seat: Mark | null }[] = [];
    const seen = new Set<string>();

    for (const sock of this.ctx.getWebSockets()) {
      const who = sock.deserializeAttachment() as Attachment | null;
      if (!who || seen.has(who.playerId)) continue;
      seen.add(who.playerId);
      watchers.push({ name: who.name, seat: this.seatOf(who.playerId) });
    }

    const shared = {
      type: "state" as const,
      board: this.state.board,
      turn: turnFor(this.state.board, this.state.startingMark),
      winner: this.state.winner,
      line: this.state.line,
      draw: this.state.draw,
      round: this.state.round,
      scores: this.state.scores,
      ready: this.bothSeated(),
      over: this.isOver(),
      seats: {
        X: this.state.seats.X && {
          name: this.state.seats.X.name,
          connected: this.state.seats.X.connected,
        },
        O: this.state.seats.O && {
          name: this.state.seats.O.name,
          connected: this.state.seats.O.connected,
        },
      },
      watchers,
      chat: this.state.chat,
    };

    for (const sock of this.ctx.getWebSockets()) {
      const who = sock.deserializeAttachment() as Attachment | null;
      if (!who) continue;
      try {
        sock.send(
          JSON.stringify({
            ...shared,
            you: { name: who.name, seat: this.seatOf(who.playerId) },
          }),
        );
      } catch {
        // Socket died mid-broadcast; the close handler will tidy up.
      }
    }
  }
}
