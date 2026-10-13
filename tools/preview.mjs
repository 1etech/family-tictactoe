// Throwaway static file server, purely so the page can be opened over http
// for testing. The deployed site needs nothing like this.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join, extname } from "node:path";

const DIR = join(import.meta.dirname, "..", "docs");
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
};
createServer(async (req, res) => {
  const path = (req.url.split("?")[0] === "/" ? "/index.html" : req.url.split("?")[0]).slice(1);
  try {
    const body = await readFile(join(DIR, path));
    res.writeHead(200, { "Content-Type": TYPES[extname(path)] ?? "application/octet-stream", "Cache-Control": "no-store" });
    res.end(body);
  } catch {
    res.writeHead(404).end("not found");
  }
}).listen(8790, "127.0.0.1", () => console.log("static on http://127.0.0.1:8790"));
