# Family Tic Tac Toe

**Play and learn: https://1etech.github.io/family-tictactoe/**

One link for everything: the page has a **🎮 Tic Tac Toe** tab and a **📚 Learn**
tab. Send it to anyone. It is permanent, free, and nothing needs to be running
on anybody's computer.

A real-time tic tac toe game with as many rooms as you like. Two people play in
each room and anyone else in it watches. No accounts and no app.

There are **two builds in here**. The serverless one is the one to deploy.

| | Serverless (`docs/`) | Server (`src/`, `server.mjs`) |
| --- | --- | --- |
| Needs a server running | no | yes |
| Hosting cost | free | Workers Paid, $5/mo |
| Rules enforced by | each browser | the server |
| Status | **what you deploy** | kept, working, unused |

## Deploy

The live site is GitHub Pages, served from `docs/` on `main`. Pushing to `main`
republishes it within about a minute:

```bash
git push
```

It can also go to Cloudflare Workers as static assets, on the free tier:

```bash
npx wrangler login
npm run deploy
```

Either way this is **static files only** — no Worker script, no Durable Object —
which is what keeps it free.

## How it works without a server

The page is a single static file. The two browsers exchange the whole game state
through a **public MQTT broker**, which is a free message relay that needs no
account. Each change bumps a version number and is republished as a *retained*
message, so whoever opens the link next is handed the current board immediately.

When two clients publish the same version at once, the one with the lower
publisher id wins — every client applies that rule independently and so they all
land on the same state without anyone being in charge.

Three public brokers are tried in order, so one being busy or blocked on a
family member's network is not fatal:

1. `broker.emqx.io`
2. `test.mosquitto.org`
3. `broker.hivemq.com`

The room code is hashed before it becomes a topic name, so the broker's topic
list does not advertise readable room codes.

### What this trades away

Be aware of these; they are the cost of having no server.

- **No referee.** Each browser enforces the rules on itself. Someone technical
  enough could craft a state that cheats. Fine for family, not for strangers.
- **Public relay.** The moves travel through a broker anyone can connect to.
  The topic is hashed, not secret. Do not treat the chat as private. Listed
  rooms publish their code, name and players' first names to the room list;
  untick "Show it in the room list" for a room that should stay invite-only.
- **Rooms are not owned.** Anyone who opens the link joins the same room and can
  take a free seat.
- **State lives in the last message**, not a database. If every player closes the
  tab and the broker drops the retained message, the scoreboard restarts.

## How to play

Send the plain URL. That is the whole setup.

1. Type your name. The **Rooms** list shows the family room plus every room
   that is open right now: who is playing, who is waiting for a partner, and
   how many are watching. **Join** a room with a free seat or **Watch** a full one.
2. **➕ Create a new room** gives you a code nobody else is using (it checks the
   list and peeks at the code before handing it out). Under **Room options**
   you can name it ("Cousins' table") and choose whether it shows in the list;
   unlisted rooms are invite-only.
3. **📨 Invite** shares or copies a link like `…/?room=K7QM`. Whoever opens it
   goes straight into that room. You can also type the code under
   **Have a room code?**
4. The first two people in a room get X and O. Everyone after that watches and
   can chat. If a room is full, the watcher is offered **Start a new room**.
5. **Play again** keeps the running score and alternates who opens.
   **← Rooms** goes back to the list.

Refreshing or losing signal does not lose your seat — you get it back. After two
minutes away the seat opens so a watcher can step in; **Leave** gives it up
immediately.

Each room's leader (the lowest player id online in it) republishes a small
retained summary to a shared lobby topic every 15 seconds. The list hides
summaries older than 90 seconds, and the last person to leave clears theirs.

To move the household to a different family room, change `DEFAULT_ROOM` near
the top of the script in `docs/index.html`. Codes are 4 characters from `A-Z`
(no `I` or `O`) and `2-9`.

## Learn tab

The page has a second tab, **📚 Learn**, for Year 4 maths (Victorian
Curriculum, Measurement). Link straight to it with
`https://1etech.github.io/family-tictactoe/#learn`.

Pick a topic at the top; the page remembers the last one on each device.

- **Topic 1 · ⚖️ Mass** — milligrams, grams, kilograms and tonnes. Every step is
  ×1000; the lesson has an interactive kitchen scale.
- **Topic 2 · 📏 Length** — millimetres, centimetres, metres and kilometres.
  The steps differ (×10, ×100, ×1000), and the lesson has an interactive ruler.
  Ruler questions include objects that don't start at 0 — the curriculum's
  "partial units".

Each topic has three parts:

- **Learn** — the four units with everyday benchmarks, the conversion rule,
  worked conversions with a place-value chart, fractions of a unit, reading
  the scale or ruler, choosing units, comparing, and a converter.
- **Practice** — Easy, Medium and Hard. Each answer is marked straight away
  with what went wrong and how to do it.
- **Test** — Easy, Medium, Hard (10 questions) or Mixed (12). Results show the
  score, a per-skill breakdown and a review of every question; "Practise what I
  missed" drills just the weak skills. Best scores are kept per topic.

Questions are generated, so no two rounds are the same. Opening the Learn tab
does not take a seat in a game.

### Learners, Claw Points and the parent page

- **Who's learning?** Practice, tests and rewards ask for a name and a cat
  avatar first, so each child's points and tests are kept apart. **Switch**
  changes child.
- **🐾 Claw Points.** Practice: Easy +1, Medium +2, Hard +3 per right answer,
  +5 for every 5 in a row. Tests: Easy +2, Medium +3, Hard +5 per right answer,
  +10 for finishing, +25 for 100%, +10 for beating your best.
- **Cat ranks** from Tiny Kitten to Lion, and 11 cat badges (Yarn Ball Streak,
  Nine Lives, Purrfect Score…). The Rewards tab shows them, plus the family
  "cat pack" when there is more than one child.
- **👪 Parents** first asks "Which grown-up are you?" — a name and a male or
  female animal (lion/lioness, tiger/tigress, and papa/mama elephant, wolf and
  bear, drawn in `docs/learn/avatars.js`). Grown-ups are not learners: they
  take no tests and earn no points, and any grown-up can review any child.
  The page lists every finished test with the child's answers, what went wrong
  and the method, marks tests **New** until you have opened them and shows who
  has **seen** each one, plus a summary per child (average, best per test,
  practice accuracy, weakest skill). Results can be deleted. The grown-up is
  forgotten when the page closes, so it asks again next time.
- **Test numbers, dates and filters.** Every finished test gets a permanent
  number (#1, #2, …) that is never reused, and is shown with its date, time and
  the child's name. The Parents tab filters by child, test, date range, test
  number and "only tests I haven't seen", sorts by date, number, child, test or
  score, and downloads the filtered list as a spreadsheet (CSV). The test
  filter can show one topic or one test, and each child's summary is split by
  topic.

Everything is stored in the browser's `localStorage` on the device it happened
on. To see results from other devices, turn on **family sync**, or move them by
file with **Export backup** / **Import backup** on the Parents tab (importing
merges and never overwrites, and imported question text is cleaned before it is
shown).

### Family sync

A grown-up taps **Turn on family sync** on the Parents tab. That makes a random
20-character family code and an invite link like
`…/?family=ABCD…#learn`. Opening the link once on each child's device and each
grown-up's device joins it; from then on every learner, grown-up and finished
test goes to the family's online store, and every device fetches what the
others sent: on opening, every 30 seconds while the page is showing, when it
comes back online, and a moment after anything changes. Tests already on a
device when it joins are sent too. Offline work waits in an outbox.

- **One numbering.** The store numbers tests (#1, #2, …) in the order they
  were taken, so every device shows the same number. A test taken offline gets
  a local number that can change once, when it is first sent.
- **Merging.** A learner's points and stats keep the highest value from any
  device; "seen by" ticks add up; deleting a test or removing a learner or
  grown-up reaches every device and can't be undone by a device that hadn't
  heard yet.
- **Privacy.** The code is the only key: anyone with the link can see and add
  results, so share it only with family. The store keeps the data under a hash
  of the code. Synced question text is cleaned like an imported backup.
- Each device shows its newest 400 tests; the store keeps them all.

The store is a separate Worker, `sync/index.ts`, with one SQLite-backed Durable
Object per family (Cloudflare's free tier covers this). The page talks to it at
the address in `SYNC_URL` near the top of `docs/learn/sync.js`; if that is
empty the sync card doesn't appear. Deploy it with:

```bash
npx wrangler login
npm run deploy:sync      # prints https://family-learn-sync.<you>.workers.dev
```

then put `<that address>/sync` in `SYNC_URL` and push.

| File | What it does |
| --- | --- |
| `docs/learn/common.js` | Shared helpers, answer marking, test building and the list of topics. |
| `docs/learn/mass.js` | Topic 1: the mass lesson, question generators and tests. |
| `docs/learn/length.js` | Topic 2: the length lesson, ruler pictures, question generators and tests. |
| `docs/learn/app.js` | The Learn tab itself: topic picker, practice, tests, rewards and parent pages. |
| `docs/learn/kids.js` | Learners, grown-ups, saved tests, Claw Points, ranks, badges, backup, sync outbox. |
| `docs/learn/sync.js` | Family sync: invite links and sending/fetching changes. |
| `sync/index.ts` | The family store Worker (`wrangler.sync.jsonc`). |
| `docs/learn/avatars.js` | The ten grown-up animal pictures. |
| `docs/learn/learn.css` | Styles for the Learn tab. |

**Adding a topic:** write `docs/learn/<topic>.js` that calls
`LearnCommon.register({...})` (copy `length.js` for the shape), give its tests
ids starting `<topic>-`, add a `<script>` line for it before `app.js` in
`docs/index.html`, and add the file to `test/learn-questions.mjs`. When any
Learn file changes, bump the `?v=` number on the Learn links in `index.html` so
browsers don't mix old and new copies.

## Working on it

```bash
npm run preview     # serve docs/ at http://127.0.0.1:8790
npm run test:sync   # two clients, real broker, full protocol
npm run opponent ABCD "Cousin"   # a bot that joins room ABCD and plays
npm run test:learn  # checks thousands of generated questions in every topic, plus points/badges/backup
npm run test:learn-sync  # several pretend devices syncing through the store under wrangler dev
npm run dev:sync    # the store at http://127.0.0.1:8791; set localStorage "learn:sync-url" to http://127.0.0.1:8791/sync to use it
```

`test:sync` covers retained-state handover, seating, a full round, the rematch,
the version/publisher tiebreak under a deliberate conflict, and a late spectator.

## The server build (kept, not deployed)

The original version is intact: a Cloudflare Worker with one Durable Object per
room holding the authoritative game, so moves are validated server-side and a
tampered client cannot cheat. It needs the Workers Paid plan because Durable
Objects are not on the free tier.

```bash
npm run dev:server      # node server.mjs  (light local host, ~65MB)
npm run test:server     # 27 vitest tests over real WebSockets
npm run deploy:server   # wrangler deploy  (needs the paid plan)
```

| File | What it does |
| --- | --- |
| `docs/index.html` | The serverless game — the whole thing, one file. |
| `src/game.ts` | Shared rules: win detection, whose turn, legal moves. |
| `src/room.ts` | `GameRoom` Durable Object: seating, moves, score, chat. |
| `src/index.ts` | Worker: issues room codes, routes WebSockets. |
| `server.mjs` | Node stand-in for the Worker, same protocol. |
| `public/index.html` | Front end for the server build. |
