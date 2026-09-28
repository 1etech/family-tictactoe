import { GameRoom } from "./room.ts";

export { GameRoom };

/** No 0/O or 1/I — codes get read aloud over the phone. */
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 4;

function randomCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH));
  let code = "";
  for (const byte of bytes) code += CODE_ALPHABET[byte % CODE_ALPHABET.length];
  return code;
}

function normalizeCode(raw: string): string | null {
  const code = raw.trim().toUpperCase();
  if (code.length !== CODE_LENGTH) return null;
  for (const char of code) {
    if (!CODE_ALPHABET.includes(char)) return null;
  }
  return code;
}

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Hand out a room code that nobody is already using.
    if (url.pathname === "/api/create" && request.method === "POST") {
      for (let attempt = 0; attempt < 8; attempt++) {
        const code = randomCode();
        const stub = env.GAME_ROOM.getByName(code);
        if (await stub.isUnused()) return json({ code });
      }
      return json({ error: "Could not find a free room code. Try again." }, 503);
    }

    // WebSocket for a single room: /api/room/ABCD
    const roomMatch = url.pathname.match(/^\/api\/room\/([^/]+)$/);
    if (roomMatch) {
      const code = normalizeCode(decodeURIComponent(roomMatch[1]));
      if (!code) return json({ error: "That room code is not valid." }, 400);
      if (request.headers.get("Upgrade") !== "websocket") {
        return json({ error: "This endpoint expects a WebSocket." }, 426);
      }
      return env.GAME_ROOM.getByName(code).fetch(request);
    }

    // Anything else that reached the Worker had no matching static asset.
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
