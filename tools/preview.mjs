// Throwaway static file server, purely so the page can be opened over http
// for testing. The deployed site needs nothing like this.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const DIR = join(import.meta.dirname, "..", "docs");
createServer(async (req, res) => {
  const path = (req.url.split("?")[0] === "/" ? "/index.html" : req.url.split("?")[0]).slice(1);
  try {
    const body = await readFile(join(DIR, path));
    res.writeHead(200, { "Content-Type": path.endsWith(".html") ? "text/html; charset=utf-8" : "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404).end("not found");
  }
}).listen(8790, "127.0.0.1", () => console.log("static on http://127.0.0.1:8790"));
