import { SELF } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";

interface StateMessage {
  type: "state";
  board: (string | null)[];
  turn: "X" | "O";
  winner: string | null;
  line: number[] | null;
  draw: boolean;
  over: boolean;
  ready: boolean;
  round: number;
  scores: { X: number; O: number; draws: number };
  seats: Record<"X" | "O", { name: string; connected: boolean } | null>;
  watchers: { name: string; seat: string | null }[];
  chat: { id: number; name: string; text: string }[];
  you: { name: string; seat: "X" | "O" | null };
}

type Predicate = (state: StateMessage) => boolean;

/**
 * A connected player. The server pushes whole states, and broadcasts caused by
 * the other player can interleave with your own, so tests wait for a *condition*
 * rather than for "the next message".
 */
class Client {
  private latest: StateMessage | null = null;
  private listeners: ((state: StateMessage) => void)[] = [];
  readonly notices: string[] = [];

  private constructor(private readonly ws: WebSocket) {}

  static async join(room: string, playerId: string, name: string): Promise<Client> {
    const response = await SELF.fetch(
      `https://example.com/api/room/${room}?playerId=${playerId}&name=${encodeURIComponent(name)}`,
      { headers: { Upgrade: "websocket" } },
    );
    expect(response.status).toBe(101);
    const ws = response.webSocket;
    if (!ws) throw new Error("no websocket on the response");

    const client = new Client(ws);
    // Attach before accept(): messages delivered before a listener exists are lost.
    ws.addEventListener("message", (event: MessageEvent) => client.receive(event.data));
    ws.accept();
    return client;
  }

  private receive(data: unknown): void {
    if (typeof data !== "string" || data === "pong") return;
    const msg = JSON.parse(data);
    if (msg.type === "notice") {
      this.notices.push(msg.message);
      return;
    }
    this.latest = msg;
    for (const listener of this.listeners.splice(0)) listener(msg);
  }

  /** Resolves once a broadcast satisfies `predicate` (including the current one). */
  waitFor(predicate: Predicate, label = "condition"): Promise<StateMessage> {
    if (this.latest && predicate(this.latest)) return Promise.resolve(this.latest);

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`timed out waiting for ${label}; last state: ${JSON.stringify(this.latest)}`));
      }, 3000);

      const check = (state: StateMessage) => {
        if (predicate(state)) {
          clearTimeout(timer);
          resolve(state);
        } else {
          this.listeners.push(check);
        }
      };
      this.listeners.push(check);
    });
  }

  waitForNotice(pattern: RegExp): Promise<string> {
    return new Promise((resolve, reject) => {
      const started = Date.now();
      const poll = () => {
        const hit = this.notices.find((notice) => pattern.test(notice));
        if (hit) return resolve(hit);
        if (Date.now() - started > 3000) {
          return reject(new Error(`no notice matching ${pattern}; saw ${JSON.stringify(this.notices)}`));
        }
        setTimeout(poll, 20);
      };
      poll();
    });
  }

  send(message: unknown): void {
    this.ws.send(JSON.stringify(message));
  }

  close(): void {
    this.ws.close();
  }
}

/** Plays a move and waits until that square is confirmed by the server. */
async function move(client: Client, index: number, mark: "X" | "O"): Promise<StateMessage> {
  client.send({ type: "move", index });
  return client.waitFor((state) => state.board[index] === mark, `${mark} at ${index}`);
}

/** Runs the five moves that let X take the top row. */
async function xWinsTopRow(alice: Client, bob: Client): Promise<StateMessage> {
  await move(alice, 0, "X");
  await move(bob, 3, "O");
  await move(alice, 1, "X");
  await move(bob, 4, "O");
  return move(alice, 2, "X");
}

async function seatedPair(room: string): Promise<[Client, Client]> {
  const alice = await Client.join(room, "p-alice", "Alice");
  await alice.waitFor((state) => state.you.seat === "X", "Alice seated");
  const bob = await Client.join(room, "p-bob", "Bob");
  await bob.waitFor((state) => state.ready, "both seated");
  await alice.waitFor((state) => state.ready, "Alice sees both seated");
  return [alice, bob];
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

let room = "";
let counter = 0;

beforeEach(() => {
  // A fresh code per test keeps Durable Object state from leaking between them.
  counter += 1;
  const pick = (n: number) => CODE_ALPHABET[n % CODE_ALPHABET.length];
  room = "T" + pick(counter) + pick(counter >> 5) + pick(counter >> 10);
});

describe("room codes", () => {
  it("hands out a usable code", async () => {
    const response = await SELF.fetch("https://example.com/api/create", { method: "POST" });
    expect(response.status).toBe(200);
    const { code } = await response.json<{ code: string }>();
    expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/);
  });

  it("rejects a malformed code", async () => {
    const response = await SELF.fetch("https://example.com/api/room/NOPE!!", {
      headers: { Upgrade: "websocket" },
    });
    expect(response.status).toBe(400);
  });

  it("rejects a plain GET on a room", async () => {
    const response = await SELF.fetch("https://example.com/api/room/ABCD");
    expect(response.status).toBe(426);
  });
});

describe("seating", () => {
  it("seats the first two arrivals as X and O", async () => {
    const [, bob] = await seatedPair(room);
    const state = await bob.waitFor((s) => s.ready);
    expect(state.you.seat).toBe("O");
    expect(state.seats.X?.name).toBe("Alice");
    expect(state.seats.O?.name).toBe("Bob");
  });

  it("makes a third arrival a watcher", async () => {
    await seatedPair(room);
    const carol = await Client.join(room, "p-carol", "Carol");

    const state = await carol.waitFor((s) => s.watchers.some((w) => w.name === "Carol"), "Carol listed");
    expect(state.you.seat).toBeNull();
    expect(state.watchers).toContainEqual({ name: "Carol", seat: null });
  });

  it("gives a returning player their seat back after a drop", async () => {
    const alice = await Client.join(room, "p-alice", "Alice");
    await alice.waitFor((state) => state.you.seat === "X", "Alice seated");
    alice.close();

    const backAgain = await Client.join(room, "p-alice", "Alice");
    const state = await backAgain.waitFor((s) => s.you.seat !== null, "seat reclaimed");
    expect(state.you.seat).toBe("X");
  });

  it("lets a watcher take a seat that opens up", async () => {
    const [alice] = await seatedPair(room);
    const carol = await Client.join(room, "p-carol", "Carol");
    await carol.waitFor((s) => s.you.seat === null, "Carol watching");

    alice.send({ type: "stand" });
    await carol.waitFor((s) => s.seats.X === null, "X seat opens");

    carol.send({ type: "sit", seat: "X" });
    const state = await carol.waitFor((s) => s.you.seat === "X", "Carol seated");
    expect(state.seats.X?.name).toBe("Carol");
  });
});

describe("playing a round", () => {
  it("rejects a move from the player who is not on turn", async () => {
    const [, bob] = await seatedPair(room);
    bob.send({ type: "move", index: 0 });
    await expect(bob.waitForNotice(/not your turn/i)).resolves.toBeTruthy();
  });

  it("rejects a move from a watcher", async () => {
    await seatedPair(room);
    const carol = await Client.join(room, "p-carol", "Carol");
    await carol.waitFor((s) => s.you.seat === null, "Carol watching");

    carol.send({ type: "move", index: 4 });
    await expect(carol.waitForNotice(/watching/i)).resolves.toBeTruthy();
  });

  it("rejects a move onto an occupied square", async () => {
    const [alice, bob] = await seatedPair(room);
    await move(alice, 4, "X");

    bob.send({ type: "move", index: 4 });
    await expect(bob.waitForNotice(/taken/i)).resolves.toBeTruthy();
  });

  it("plays a full game, scores the win, and reports the winning line", async () => {
    const [alice, bob] = await seatedPair(room);
    const final = await xWinsTopRow(alice, bob);

    expect(final.winner).toBe("X");
    expect(final.over).toBe(true);
    expect(final.line).toEqual([0, 1, 2]);
    expect(final.scores).toEqual({ X: 1, O: 0, draws: 0 });
  });

  it("refuses moves once the round is decided", async () => {
    const [alice, bob] = await seatedPair(room);
    await xWinsTopRow(alice, bob);

    bob.send({ type: "move", index: 5 });
    await expect(bob.waitForNotice(/finished/i)).resolves.toBeTruthy();
  });

  it("clears the board on a rematch and alternates the opening move", async () => {
    const [alice, bob] = await seatedPair(room);
    await xWinsTopRow(alice, bob);

    alice.send({ type: "rematch" });
    const fresh = await alice.waitFor((state) => state.round === 2, "round 2");

    expect(fresh.board.every((cell) => cell === null)).toBe(true);
    expect(fresh.turn).toBe("O");
    expect(fresh.over).toBe(false);
    // The running scoreboard survives the rematch.
    expect(fresh.scores.X).toBe(1);

    // O now opens, so X moving first is refused.
    alice.send({ type: "move", index: 8 });
    await expect(alice.waitForNotice(/not your turn/i)).resolves.toBeTruthy();
    await move(bob, 8, "O");
  });

  it("records a draw without awarding either side", async () => {
    const [alice, bob] = await seatedPair(room);
    // X O X / X O O / O X X — full board, no line.
    await move(alice, 0, "X");
    await move(bob, 1, "O");
    await move(alice, 2, "X");
    await move(bob, 5, "O");
    await move(alice, 3, "X");
    await move(bob, 4, "O");
    await move(alice, 7, "X");
    await move(bob, 6, "O");
    const final = await move(alice, 8, "X");

    expect(final.draw).toBe(true);
    expect(final.winner).toBeNull();
    expect(final.scores).toEqual({ X: 0, O: 0, draws: 1 });
  });
});

describe("chat", () => {
  it("delivers a message to everyone in the room", async () => {
    const [alice, bob] = await seatedPair(room);

    alice.send({ type: "chat", text: "good luck!" });
    const state = await bob.waitFor(
      (s) => s.chat.some((m) => m.text === "good luck!"),
      "chat delivered",
    );
    expect(state.chat.at(-1)).toMatchObject({ name: "Alice", text: "good luck!" });
  });

  it("ignores an empty message", async () => {
    const [alice, bob] = await seatedPair(room);
    const before = (await bob.waitFor((s) => s.ready)).chat.length;

    alice.send({ type: "chat", text: "   " });
    alice.send({ type: "chat", text: "real one" });

    const state = await bob.waitFor((s) => s.chat.some((m) => m.text === "real one"));
    expect(state.chat.length).toBe(before + 1);
  });
});
