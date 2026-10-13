# Family Tic Tac Toe

**Play: https://1etech.github.io/family-tictactoe/**

Send that link to anyone. It is permanent, free, and nothing needs to be running
on anybody's computer.

A real-time tic tac toe game you share with a link. Two people play, anyone else
who opens the link watches. No accounts, no app, no code to type — everyone who
opens the bare URL lands in the same room.

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
  The topic is hashed, not secret. Do not treat the chat as private.
- **Rooms are not owned.** Anyone who opens the link joins the same room and can
  take a free seat.
- **State lives in the last message**, not a database. If every player closes the
  tab and the broker drops the retained message, the scoreboard restarts.

## How to play

Send the plain URL. That is the whole setup.

1. First visit asks for a name; after that it goes straight to the board.
2. The first two people in get X and O. Everyone after that watches and can chat.
3. **Play again** keeps the running score and alternates who opens.
4. **Start a separate game** gets a fresh code for a side game.

Refreshing or losing signal does not lose your seat — you get it back. After two
minutes away the seat opens so a watcher can step in; **Leave** gives it up
immediately.

To move the household to a different default room, change `DEFAULT_ROOM` near
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

Questions are generated, so no two rounds are the same. It lives in
`docs/learn/mass.js` and `docs/learn/mass.css`. Opening the Learn tab does not
take a seat in the family game.

## Working on it

```bash
npm run preview     # serve docs/ at http://127.0.0.1:8790
npm run test:sync   # two clients, real broker, full protocol
npm run opponent ABCD "Cousin"   # a bot that joins room ABCD and plays
npm run test:learn  # generates thousands of mass questions and checks each one
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
