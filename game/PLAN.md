# Stillmarch: browser strategy game — plan

A real-time, phone-first browser strategy game set in Stillmarch's world, in the spirit of
village-builder / map-conquest games (Tribal Wars, Travian), but built from Stillmarch's own
systems: Houses, Obelisks, Wayfarers, the Forgotten, the Blight and the Invasion.

The lore and systems come from `dev/data/game-data.json`. Treat it as the source of truth for
names and flavour, and adapt its mechanics rather than inventing new ones where it already has an
answer.

> Stillmarch is Sethan's game. Before this goes public, check that using the name, lore and art
> is OK.

## Decisions so far

| Question | Decision |
|---|---|
| Pace | **Real time.** Builds and marches run on wall-clock timers and keep going while the game is closed. Short at first, growing to hours. |
| Main loop | **A balance of building/economy and conquest/war.** |
| Art | **Icon-driven menus plus a visual region map.** |
| Players | **Single-player first**, with AI-controlled rival Houses. Real multiplayer is a later, separate step (swap AI Houses for a backend). |
| Platform | Browser, **designed for touch on a phone first**, installable as a PWA. No server: progress saves on the device. |
| Hosting | Static build deployed alongside the reference site at `/game/` on the existing GitHub Pages setup. |

## The opening

**Fiction.** You are one of the descendants of those who fled the Stillness, coming back to Valdris
with nothing: no books, no records. Your village grows from that, not from a preset town.

**Minute 0: you arrive**
- A few followers, a small stock of resources, and **2 Wayfarers** (the real game's default).
- You stand at a **dormant Obelisk**, region level 1: a bare shaft with its capstone at its foot.
- First action: **claim it**. That region is yours and your camp appears on the map.

**Starting camp**
- **The Obelisk** (level 1): the "town hall". Raising the region level is the main progression,
  and the Obelisk's look grows with it, following the record's 4 stages:
  1. Bare shaft, capstone at its foot
  2. Graduated ring; capstone floats
  3. Meander and gold fittings; capstone floats higher
  4. Four pylons, armillary sphere, halo
- **3 gathering sites**: wood, stone, ore. A site produces nothing without a Wayfarer.
- **Small storehouse**: caps how much you can hold.
- Empty plots to build on.

**First hour**
- First builds take 30 s to a few minutes; timers then grow into hours.
- No main quest (Stillmarch has none). Instead, a short list of **"Unfinished business"** tasks
  teaches the basics and pays small resource rewards.
- **Beginner protection**: AI Houses can't attack you for the first few days.

**Then it opens up**
- **Region level 2** unlocks Tier 2 workshops (matching the real game), walls and a barracks.
- The map holds neighbouring dormant Obelisks, AI Houses expanding, Forgotten strongholds and
  Blight biomes.
- Hold **3 regions → barony**. Later: kingdom, Great Projects, the Chronicles.
- **The Invasion** hits every few days and targets whoever is strongest.

## How Stillmarch maps onto the genre

| Genre staple | Stillmarch version |
|---|---|
| Village and buildings | Settlement: plots, storehouses, walls, workshops |
| Resource fields | Wood, stone, ore, hide, across the 4 material tiers |
| Workers | **Wayfarers**: limited slots; a station does nothing without one |
| Town hall | **The Obelisk**, levels 1–4 |
| Conquering villages | Claiming **Obelisks**; 3 regions makes a **barony**, then a **kingdom** |
| Barbarian villages | **Forgotten strongholds** (Northreach, Heartland, Eastwood, Southmere): PvE targets with garrisons |
| Rare loot | **Blight biomes**: dangerous, but the only source of Tier 4 (Mithral, Ancient Wood, Blight Fibre) |
| Endgame | **Great Projects**, recorded in **the Chronicles** |

What sets it apart from a reskin:
- **The Invasion.** Periodic AI armies that go after the strongest player or House: built-in
  protection against snowballing.
- **Emergent House identity.** No class at the start. You become a Feudal, Banking, Trading,
  Mercenary or Bandit House by what you actually do, and that unlocks bonuses.
- **Flavour.** Every building icon keeps one small detail deliberately unfinished, as the lore says.

## v0.1: first playable version

Goal: something to play on a phone for a few days, to check whether the loop is fun.

- [ ] One settlement: Obelisk, 3 gathering sites, storehouse, walls, barracks
- [ ] Wayfarer assignment (2 slots) to gathering sites
- [ ] Real-time build queue that keeps running while the game is closed
- [ ] Resource production and storage caps
- [ ] "Unfinished business" starter tasks
- [ ] Visual region map: your region, 3–4 dormant Obelisks, 1 Forgotten stronghold,
      1 Blight biome, 1 AI House
- [ ] Basic troops from the barracks
- [ ] Timed marches: claim an Obelisk, raid the stronghold, march back with loot
- [ ] Simple AI House that builds and expands on its own timers
- [ ] Save on the device, plus an export/import save string as a backup
- [ ] Phone-first touch layout; PWA manifest so it can go on the home screen

Out of scope for v0.1: the Invasion, Tier 3/4 crafting chains, barony/kingdom, Great Projects,
House archetypes, multiplayer.

## Tech

- **Stack:** Vue 3 + Vite + TypeScript, the same as `web/`. Lives in `game/`.
- **Map:** SVG (or canvas) region map with pan/zoom by touch. No 3D needed.
- **Icons:** inline SVG icon set, so the art stays consistent and light.
- **State:** one plain, serialisable game-state object, saved to `localStorage`
  (or IndexedDB if it outgrows it), with a version number for save migrations.
- **Time model:** store *timestamps*, never countdowns. A build is
  `{ building, level, startedAt, endsAt }`. On every load and tick, simulate from the last saved
  time to now: finish due builds and marches in order, add production for the elapsed time,
  clamp to storage caps. That way the game progresses correctly while closed, and the same code
  runs the AI Houses.
- **Game rules separate from UI:** pure TypeScript modules for the rules (`src/sim/`) so they can
  be unit-tested and later moved to a server for multiplayer.
- **Balance data in one file** (`src/data/balance.ts`): costs, timers and production rates.
  Every number is a placeholder until playtested.
- **Deploy:** add a step to `.github/workflows/deploy-pages.yml` that builds `game/` with
  `base: '/game/'` and copies `game/dist` into `_site/game/`, the same way `web/` goes to
  `/preview/`.

Suggested layout:

```
game/
  PLAN.md
  index.html
  vite.config.ts
  src/
    main.ts
    App.vue
    sim/          # pure game rules: tick, build queue, production, marches, AI
    data/         # balance numbers, building and unit definitions
    state/        # save/load, migrations
    components/   # UI: settlement view, map, build menu, timers
    assets/icons/
```

## Later (after v0.1)

1. The Invasion event
2. Tier 2 workshops and the Blight / Tier 4 materials chain
3. Barony at 3 regions; kingdom
4. Emergent House archetypes and their bonuses
5. More AI Houses with distinct personalities (trader, bandit, mercenary)
6. Great Projects and a Chronicles log of what happened in your world
7. Multiplayer: shared world on a backend; AI Houses become real players

## Open questions

- Length of a "world": endless, or seasons that reset (fits the Invasion's mini-wipe idea)?
- Food/upkeep for troops: add it, or keep troop cost one-off?
- How visible the AI Houses' actions should be (scouting, a news feed, the Chronicles)?
