// Family sync for the Learn tab: keeps every device that shares a family code
// up to date with the same learners, grown-ups and tests, through the small
// Worker in sync/index.ts. A grown-up turns it on in the Parents tab and sends
// the invite link (…/?family=CODE#learn) to each child's device; opening the
// link once joins that device. Without a code nothing leaves the device.
(() => {
  "use strict";

  // Where the family store lives (the deployed sync/index.ts Worker). For
  // testing, localStorage "learn:sync-url" points a single browser elsewhere.
  let SYNC_URL = "https://family-learn-sync.keerti-gottam.workers.dev/sync";
  try { SYNC_URL = localStorage.getItem("learn:sync-url") || SYNC_URL; } catch {}

  const KEY = "learn:sync";
  const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O or 1/I
  const CODE = /^[A-Z2-9]{16,64}$/;
  const EVERY_MS = 30_000;
  const Kids = window.LearnKids;
  const sanitize = (html) => window.LearnCommon.sanitizeHTML(html);

  const readState = () => {
    try { return { code: "", rev: 0, last: 0, ...JSON.parse(localStorage.getItem(KEY) || "{}") }; } catch { return { code: "", rev: 0, last: 0 }; }
  };
  const writeState = (s) => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {} };

  let state = readState();
  let busy = null, again = false, error = "", timer = 0;

  const normalize = (code) => String(code || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  function newCode() {
    const bytes = crypto.getRandomValues(new Uint8Array(20));
    return [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join("");
  }

  const notify = () => window.dispatchEvent(new CustomEvent("learnsync:status"));

  /** Sends what this device has queued and merges in what the others sent, a page at a time. */
  async function run() {
    state = readState(); // another tab may have moved on
    if (!state.code || !SYNC_URL) return;
    let changed = false;
    try {
      for (let round = 0; round < 40; round++) {
        const changes = Kids.outbox(200);
        const response = await fetch(SYNC_URL, {
          method: "POST",
          // text/plain keeps this a "simple" request, so there's no CORS preflight.
          headers: { "Content-Type": "text/plain;charset=UTF-8" },
          body: JSON.stringify({ family: state.code, since: state.rev, changes: changes.map(({ kind, id, data, deleted }) => ({ kind, id, data, deleted })) }),
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok || !Array.isArray(body.records)) throw new Error(body.error || `The family store answered ${response.status}.`);
        if (readState().code !== state.code) return; // turned off or switched meanwhile
        Kids.acked(changes);
        if (Kids.applyRemote(body.records, sanitize, body.nextNo)) changed = true;
        state.rev = Number(body.rev) || state.rev;
        if (!body.more && !Kids.pending()) break;
      }
      state.last = Date.now();
      error = "";
    } catch (err) {
      error = navigator.onLine === false ? "This device is offline. Results will be sent when it's back online." : `Couldn't reach the family store: ${err.message}`;
    }
    writeState(state);
    if (changed) window.dispatchEvent(new CustomEvent("learnkids:change"));
  }

  /** Syncs now; if a sync is already running, runs once more after it. */
  function syncNow() {
    if (busy) { again = true; return busy; }
    busy = run().finally(() => {
      busy = null;
      notify();
      if (again) { again = false; syncNow(); }
    });
    notify();
    return busy;
  }

  /** Local changes go out a moment later, so a burst of answers is one request. */
  Kids.onLocalChange = () => {
    if (!state.code) return;
    clearTimeout(timer);
    timer = setTimeout(syncNow, 1500);
  };

  function join(code) {
    const c = normalize(code);
    if (!CODE.test(c)) return false;
    state = { code: c, rev: 0, last: 0 };
    writeState(state);
    Kids.queueAll(); // everything already on this device goes up too
    syncNow();
    return true;
  }

  const LearnSync = {
    available: () => !!SYNC_URL,
    status: () => ({ on: !!state.code, code: state.code, last: state.last, error, busy: !!busy, pending: Kids.pending() }),
    /** Starts a new family with this device's results in it. */
    start: () => join(newCode()),
    join,
    leave() { state = { code: "", rev: 0, last: 0 }; error = ""; writeState(state); notify(); },
    inviteLink() {
      const url = new URL(location.href);
      url.search = "";
      url.searchParams.set("family", state.code);
      url.hash = "learn";
      return url.toString();
    },
    syncNow,
  };
  window.LearnSync = LearnSync;

  // Opening an invite link joins this device, then tidies the address bar so
  // the code isn't left on screen or in a bookmark by accident.
  const params = new URLSearchParams(location.search);
  if (params.has("family")) {
    const code = normalize(params.get("family"));
    if (CODE.test(code) && code !== state.code) join(code);
    params.delete("family");
    const url = new URL(location.href);
    url.search = params.toString();
    history.replaceState(null, "", url);
  }

  // Catch up on start, now and then while the page is open, and on coming back.
  if (state.code) syncNow();
  setInterval(() => { if (state.code && document.visibilityState === "visible") syncNow(); }, EVERY_MS);
  document.addEventListener("visibilitychange", () => { if (state.code && document.visibilityState === "visible") syncNow(); });
  window.addEventListener("online", () => { if (state.code) syncNow(); });
  window.addEventListener("storage", (event) => { if (event.key === KEY) { state = readState(); notify(); } });
})();
