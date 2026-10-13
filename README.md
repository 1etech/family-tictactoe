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

Topic 1 is **mass: milligrams, grams, kilograms and tonnes**, in three parts:

- **Learn** — the four units with everyday examples, the ×1000 / ÷1000 rule,
  worked conversions with a place-value chart, fractions of a kilogram, an
  interactive kitchen scale, choosing units, comparing, and a converter.
- **Practice** — Easy, Medium and Hard. Each answer is marked straight away
  with what went wrong and how to do it.
- **Test** — Easy, Medium, Hard (10 questions) or Mixed (12). Results show the
  score, a per-skill breakdown and a review of every question; "Practise what I
  missed" drills just the weak skills. Best scores are kept in the browser.

Questions are generated, so no two rounds are the same. Opening the Learn tab
does not take a seat in the family game.

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
  score, and downloads the filtered list as a spreadsheet (CSV).

Everything is stored in the browser's `localStorage` on the device the children
use — nothing goes to a server. **Export backup** / **Import backup** on the
Parents tab moves results to another device; importing merges and never
overwrites, and imported question text is cleaned before it is shown.

| File | What it does |
| --- | --- |
| `docs/learn/mass.js` | Lessons, question generators, practice, tests, rewards and parent pages. |
| `docs/learn/kids.js` | Learners, grown-ups, saved tests, Claw Points, ranks, badges, backup. |
| `docs/learn/avatars.js` | The ten grown-up animal pictures. |
| `docs/learn/mass.css` | Styles for the Learn tab. |

## Working on it

```bash
npm run preview     # serve docs/ at http://127.0.0.1:8790
npm run test:sync   # two clients, real broker, full protocol
npm run opponent ABCD "Cousin"   # a bot that joins room ABCD and plays
npm run test:learn  # checks thousands of generated questions, plus points/badges/backup
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
