# Stillmarch: the browser game

A real-time, phone-first strategy game set in Stillmarch's world. The design is in
[PLAN.md](PLAN.md).

## Run it locally

You need Node 24.12 or newer.

```bash
cd game
npm install
npm run dev
```

This starts two things:

- the **game server** on <http://localhost:8787> (API, WebSocket and push), and
- the **client** on <http://localhost:5180>, with Vite passing `/api` and `/ws` through to the
  server.

Open <http://localhost:5180>, create an account and join the test world. On first start the
server makes a test world at speed ×50 (a game day takes about half an hour), where sieges can
happen at any time and the cheats are on.

To play as several people, open the client in different browser profiles (or one normal window
and one private window) and make an account in each.

To try it on a phone on the same network, open `http://<your computer's IP>:5180`. Push
notifications need HTTPS (or localhost), so they won't work that way; everything else will.

## The parts

| Folder | What's in it |
|---|---|
| `shared/` | The game rules as plain TypeScript: map generation, economy, build queue, armies and rations, battles, sieges, Houses, Wayfarer cards, AI Houses, and the world clock. No server or browser code, so it's easy to test. |
| `server/` | Node server: accounts, worlds, the HTTP API, the WebSocket for live updates, Web Push. Stores everything in SQLite (Node's built-in one) under `server/data/`. |
| `client/` | Vue 3 app: village, map, armies, Wayfarer cards, House, reports and chat. Installable as a PWA. |

All balance numbers live in `shared/src/data/balance.ts`. They're guesses until playtested.

## Commands

```bash
npm test            # rules tests (vitest)
npm run type-check  # TypeScript across all three packages
npm run build       # build the client into client/dist
```

After `npm run build`, the server also serves the built client itself, so
`npm run start -w server` alone is enough: open <http://localhost:8787>.

## Server settings

| Variable | Default | What it does |
|---|---|---|
| `PORT` | `8787` | Port to listen on |
| `DATA_DIR` | `server/data` | Where the database lives |
| `OPEN_WORLDS` | on | Set to `0` to stop players from creating test worlds |
| `VAPID_CONTACT` | a placeholder | `mailto:` or `https:` contact sent with push messages |

## Test world cheats

In test worlds the Village screen has three buttons at the bottom: finish all queues, add
resources, and skip time. Skipping moves the whole world's clock forward for everyone in it.
