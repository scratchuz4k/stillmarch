# Stillmarch: browser strategy game — plan

A real-time, phone-first, multiplayer browser strategy game set in Stillmarch's world, in the
spirit of village-builder / map-conquest games (Tribal Wars, Travian), but built from Stillmarch's
own systems: Houses, Obelisks, Wayfarers, the Forgotten, the Blight and the Invasion. It
deliberately drops the parts of the genre that reward millisecond timing and 3 a.m. alarms.

The lore and systems come from `dev/data/game-data.json`. Treat it as the source of truth for
names and flavour, and adapt its mechanics rather than inventing new ones where it already has an
answer.

> Stillmarch is Sethan's game. Before this goes public, check that using the name, lore and art
> is OK.

## Decisions so far

| Question | Decision |
|---|---|
| Pace | **Real time.** Builds and marches run on wall-clock timers and keep going while you're offline. Short at first, growing to hours. |
| Main loop | **A balance of building/economy and conquest/war.** |
| Players | **Multiplayer from the start**, on a server that decides everything. A few simple AI Houses fill empty spots on the map. Testing happens locally with several browser profiles. |
| Length of a world | **One world, one game.** The world ends when a House finishes a Great Project. |
| Houses | **Teams of players** with a leader. The member limit depends on the world size. Houses can ally, and players can leave or switch Houses. |
| Villages and regions | **One village per player**, in their home region. Other regions are territory: an Obelisk that gives bonuses, with nothing to micromanage. |
| Losing | **Mayhem.** If your village is destroyed you're out of that world for good: no respawn, no vassal status, no safety net beyond beginner protection. |
| Joining late | **Open for the first 7 world-days**, then the world is closed. |
| Wayfarer cards | **Belong to the account.** One simple collection that carries over between worlds; all of it is available in every world, and slots limit how many cards are active. |
| World speed | **A speed setting per world** (×1, ×10, ×100) that scales every timer. |
| Accounts | **Simple:** username and password. |
| Notifications | **Web Push** from the game server. |
| Troop upkeep | **None at home** for the MVP. Food matters only for armies in the field. |
| AI Houses | **Simple** for now. |
| Art | **Icon-driven menus plus a visual region map.** |
| Platform | Browser, **designed for touch on a phone first**, installable as a PWA. |
| World size | **Small for the first playtests:** up to about 20 players, 40–60 regions, a few Forgotten fortresses and 1–2 AI Houses, so players meet within the first day. |
| Hosting | **Local first.** The server runs on the developer's machine until v0.1 works; the host gets picked when others are ready to play. |

## Resources

| Resource | Comes from | Used for |
|---|---|---|
| **Wood** | Lumber camp | Buildings, troops and siege engines: everyone needs it |
| **Stone** | Quarry | Buildings |
| **Iron** | Mine | Troops and siege engines |
| **Food** | Farm | Farm level sets the **troop cap**; food in the storehouse is the **rations** armies take into the field |
| **Gold** | **Raiding Forgotten fortresses** (PvE) | Hiring Wayfarer cards, trading |

So buildings cost wood + stone, armies cost wood + iron, and wood is what everyone fights over.
Gold doesn't grow in your village: you have to go out and take it from the Forgotten.

## The opening

**Fiction.** You are one of the descendants of those who fled the Stillness, coming back to Valdris
with nothing: no books, no records. Your village grows from that, not from a preset town.

**Minute 0: you arrive**
- A few followers, a small stock of resources, and your **Wayfarer collection**. A new account
  starts with 2 cards (the real game's default is 2 Wayfarers per player).
- You stand at a **dormant Obelisk**, region level 1: a bare shaft with its capstone at its foot.
- First action: **claim it**. That is your home region, your village appears on the map, and it
  is the only village you will ever have in this world.

**Starting camp**
- **The Obelisk** (level 1): the "town hall". Raising the region level is the main progression,
  and the Obelisk's look grows with it, following the record's 4 stages:
  1. Bare shaft, capstone at its foot
  2. Graduated ring; capstone floats
  3. Meander and gold fittings; capstone floats higher
  4. Four pylons, armillary sphere, halo
- **Lumber camp, quarry, mine, farm**: produce on their own, no workers needed.
- **Small storehouse**: caps how much you can hold.
- Empty plots to build on.

**First hour**
- First builds take 30 s to a few minutes; timers then grow into hours.
- No main quest (Stillmarch has none). Instead, a short list of **"Unfinished business"** tasks
  teaches the basics and pays small resource rewards.

**Then it opens up**
- **Region level 2** unlocks walls, a barracks and more Wayfarer slots.
- The map holds neighbouring dormant Obelisks, other players, a few AI Houses, Forgotten fortresses
  and Blight biomes.
- Claim more **regions** around you. They're territory, not extra villages: each one's Obelisk
  gives a bonus (more production, a bigger troop cap, faster marches), and that's all there is to
  manage.
- Hold **3 regions → barony**. Later: kingdom, then the race for a Great Project.

## Houses

- A House is a **team of players** with a leader. The leader can name officers who can declare
  war and manage the House.
- **Member limit depends on the world size**: for example 5 in a 20-player world.
- **Alliances:** Houses can ally. Allies can't attack each other and can join each other's
  battles.
- **Leaving and switching:** any player can leave a House or join another one, with two limits so
  nobody can hop sides to spy or dodge a siege:
  - **Blocked during a war:** you can't leave while your House is in a declared war.
  - **Cooldown:** after joining a House, you can't switch again for 3 world-days.
- **Winning:** when a House finishes a Great Project, every member of that House **and its allies**
  wins.

**Keeping everyone from allying**

If allies share the win, the easy move is for the whole world to ally and build a Great Project in
peace. Two limits stop that:
- **Alliance size cap:** a House and all its allies together can have at most about a third of
  the world's players (for example 7 in a 20-player world).
- **Only long-standing allies share the win:** the alliance must have existed for at least 3
  world-days when the Great Project finishes. Jumping onto the winning side at the last minute
  earns nothing.

**Betrayal is instant.** A House can break an alliance at any moment, with no notice, and attack
its former ally straight away: raids at once, while a siege still needs the usual declaration.

## Losing your village

- A **siege on a plain region** only changes who holds it.
- A **siege on a player's village** destroys it, and that player is **out of the world**:
  - Troops, resources and everything else in that world are lost.
  - The regions they held go **dormant**, and anyone can claim them.
  - They lose their place in their House.
  - Their Wayfarer cards go back to their account collection when the world ends.
  - They can still **watch the map**: they see villages and who holds what, but not armies.
  - They can still **use chat**.
- There's no respawn. Raids never destroy a village; only a declared siege can.

## Joining late

- A world is **open to new players for the first 7 world-days** (shorter at higher world
  speeds). After that it's closed.
- Late joiners start in free regions at the edge of the map, with beginner protection and a small
  catch-up boost.

## Beginner protection

- Protection is counted in **world time**, so it shrinks with the speed setting: "3 days" at ×1
  is about 7 hours at ×10.
- It ends early if **you attack another player**, and you can drop it yourself.
- It only blocks attacks from other players. Forgotten raids and AI Houses can still hit you, so
  new players learn defence early.

## Wayfarer cards

Wayfarers are collectible cards: each one is a named character with a portrait, a rarity, three
stats and one trait. There are **2 rarities for now: Common and Uncommon** (more can come
later). You place them in **slots**, and the Obelisk level raises how many slots you have.

**Collection.** Cards belong to your **account**, not to a world, and the collection carries over
from world to world. Your whole collection is available in every world; your slots decide how many
cards are active at once.

**Stats**, one per slot type. Most cards are strong in one stat, so placing them is a real choice.

| Stat | Slot | What the Wayfarer does there |
|---|---|---|
| **Might** | **Combat** | Leads an army as its commander and boosts its troops. Can be captured if the battle is lost (see below). |
| **Craft** | **Crafting** | Runs a building: faster builds or more production there. |
| **Wits** | **Adventure** | Goes on a timed expedition (Forgotten ruins, Blight biomes) and comes back with loot, map information or sometimes a new card. Can come back injured and be out for a while. |

**Traits** add flavour with a small edge, for example "Hates the Blight: +20% on Blight
adventures".

**Captured Wayfarers:** a commander whose army loses goes to prison for **3 world-days**. There's
no way to get them out early. After that, the owner **pays gold to get the card back** and can use
it again. Until they pay, the card stays unavailable in that world; it's never lost from the
collection.

**Starting pool: 16 cards**, 12 Common and 4 Uncommon.

**Getting cards:** a new account starts with 2. More come from hiring with gold at the Wayfarer
Village, from adventures, and from trading with other players. Cards you get during a world are
added to your account collection and stay after the world ends.

**Rules of thumb**
- Keep the bonuses small (around +10–25%): better cards make you stronger, not unbeatable. This
  matters more because collections carry over: a veteran's collection shouldn't beat a newcomer
  by itself. The slot limit helps: a big collection gives you more choice, not more active cards.
- **No buying cards with real money**, ever.
- Lore: Wayfarers are people like you, coming back to the continent, just without a House.

## Armies on the map

Armies aren't fire-and-forget attacks. They are **tokens on the map** that you move between
regions, and they can stay out as long as their food lasts.

- **Leaving home:** an army takes **rations** from your storehouse. How much it can carry depends
  on its size (later: supply wagons).
- **At home and in your own regions** troops eat nothing (no upkeep in the MVP).
- **In the field** every troop eats rations per hour.
- **When the rations run out**, the army starts losing troops every hour (attrition) until it
  gets home or finds food.
- **Finding food:** loot a village or a Forgotten fortress, or forage slowly in neutral land.
- **Skirmishes:** when two hostile armies meet on the map outside a siege, they fight a short
  automatic battle (2–3 rounds, standing orders) at any time. That lets you intercept raiders and
  hold roads. A skirmish can never take a region, so it doesn't bring back 3 a.m. sieges.
- This feeds into war: an army waiting at enemy walls for the battle window is eating the whole
  time, so attackers have to plan, and defenders fighting at home have an edge.
- Later: quartermasters and supply lines from the real game's siege design.

## War and battles

The genre's worst habits (sniping by the millisecond, backtiming, surprise armies, attacks that
land at 3 a.m.) all come from battles that are **decided in a single instant on arrival**. This
game avoids that with five rules.

**1. Raids and sieges are different things.**
- **Raids** take loot (resources and rations). They can happen at any time but
  never take a village or region.
- **Sieges** take a region, or destroy a player's village (see Losing your village). They need a
  war declaration and only happen in a battle window.

**2. Declare sieges in advance.**
Like the real game's Siege Banner and build freeze: you declare the siege at least a day ahead,
then march, and the battle happens in the next window. The defender always gets warning and time
to call allies.

**3. Fixed battle windows.**
Sieges only resolve during **one fixed daily window: 16:30–22:30 CET**, the same for everyone and
the same as the real game's claim hours. An army that arrives outside the window camps at the
walls and waits, eating rations.

**4. Everyone can see who's coming.**
- Once war is declared, every army heading to the battle shows on the map with its House and a
  rough size ("~400 troops"). Scouts reveal the exact composition.
- **Muster, then lock:** armies must reach the battlefield before the battle starts. When the
  first round begins, the rosters lock and nothing new can join.
- **Declared reserves:** a second wave has to be named before the start, is visible too, and
  enters at a fixed round.

**5. A battle runs in rounds.**
- Up to 5 rounds, each on a timer (for example 10 minutes at ×1, scaled by world speed).
- Each round, both sides secretly pick an order: **Hold**, **Charge**, **Volley** or
  **Fall back**. Both are revealed and resolved together.
- **Standing orders:** you set your default response in advance, and the game plays it if you
  aren't online. Being there helps but isn't required.
- **Units:** infantry, archers, cavalry, plus a ram. Walls multiply defence; the ram lowers the
  wall level round by round. Combat-slot Wayfarers lead and boost their army.
- Every battle produces a **round-by-round battle log**, which later feeds the Chronicles.

Build order: first a round resolver with automatic orders, so battles work and can be tested;
then the order choices and the live round timer on top.

## The endgame: Great Projects

- One world, one game: **the first House to finish a Great Project wins**, and the world ends.
- A Great Project takes several days to build, in stages, and **can be attacked while it's going
  up** (in the real game Great Projects can be destroyed). Everyone has a reason to gang up on
  whoever is building one, which gives the world a final war.

## How Stillmarch maps onto the genre

| Genre staple | Stillmarch version |
|---|---|
| Village and buildings | Settlement: plots, storehouses, walls, workshops |
| Resource fields | Lumber camp, quarry, mine, farm |
| Population / farm cap | Farm level sets the troop cap |
| Heroes | **Wayfarer cards** in combat, crafting and adventure slots |
| Town hall | **The Obelisk**, levels 1–4 |
| Tribes | **Houses**: teams of players, with alliances |
| Conquering villages | Sieging **Obelisks** after a war declaration; a player's village is **destroyed**, not captured; 3 regions makes a **barony**, then a **kingdom** |
| Barbarian villages | **Forgotten fortresses** (Northreach, Heartland, Eastwood, Southmere): PvE targets with garrisons, and the only source of gold |
| Rare loot | **Blight biomes**: dangerous, reached by adventures |
| Endgame / Wonder | **Great Projects**, recorded in **the Chronicles** |

What sets it apart from a reskin:
- **No sniping, no 3 a.m. alarms:** declared sieges, battle windows, visible marches, locked
  rosters and battles in rounds.
- **Armies live on the map** and run on food.
- **Wayfarer cards** to collect, place and trade.
- **The Invasion** (later): periodic AI armies that go after the strongest House, built-in
  protection against snowballing.
- **Flavour:** every building icon keeps one small detail deliberately unfinished, as the lore
  says.

## v0.1: first playable version

Goal: a small world that a few people can play on phones for a few days, to check whether the
loop is fun.

**Server and accounts**
- [ ] Game server that decides everything; clients only display
- [ ] Username and password accounts
- [ ] Joining a world, open for the first 7 world-days; edge start for late joiners
- [ ] World speed setting, plus dev cheats (finish builds, add resources, skip time)
- [ ] Web Push notifications (build finished, army arrived, war declared, battle starting)

**Village**
- [ ] One settlement: Obelisk, lumber camp, quarry, mine, farm, storehouse, walls, barracks
- [ ] Real-time build queue
- [ ] Resource production and storage caps; farm level as the troop cap
- [ ] "Unfinished business" starter tasks
- [ ] Beginner protection

**Wayfarer cards**
- [ ] Cards with Might, Craft and Wits, a rarity (Common or Uncommon) and a trait
- [ ] Account collection, available in every world
- [ ] Crafting and combat slots
- [ ] Hiring with gold
- [ ] Captured commanders: 3 world-days in prison, then pay gold to get them back
- [ ] Starting pool of 16 cards (12 Common, 4 Uncommon)

**Map and armies**
- [ ] Visual region map: player regions, dormant Obelisks, Forgotten fortresses, a Blight biome,
      1–2 simple AI Houses
- [ ] Basic troops: infantry, archers, cavalry, ram
- [ ] Armies as map tokens with rations, attrition and looting for food
- [ ] Skirmishes when hostile armies meet on the map
- [ ] Raids on Forgotten fortresses for gold

**Houses**
- [ ] Create, join, leave and switch Houses; leader and officers
- [ ] Switching blocked during a war, 3 world-day cooldown
- [ ] Alliances between Houses, with the size cap; breaking one is instant
- [ ] Chat (still open to players who are out)

**War**
- [ ] War declaration and daily battle window
- [ ] Sieges that take regions or destroy villages; elimination, with a map view for players
      who are out
- [ ] Visible marches, muster and roster lock
- [ ] Battles in rounds with automatic orders and a battle log

**Client**
- [ ] Phone-first touch layout; PWA manifest so it can go on the home screen

Out of scope for v0.1: the adventure slot, order choices and live round timers in battles
(automatic orders first), declared reserves, Great Projects and the end of a world, barony and
kingdom, the Invasion, card trading, scouts.

## Tech

- **Monorepo in `game/`** with three packages:
  - `shared/`: the game rules as pure TypeScript (build queue, production, marches, rations,
    battles). Used by the server to decide and by the client to preview. Unit-tested.
  - `server/`: Node + TypeScript. Holds the world, runs the rules, serves the API.
  - `client/`: Vue 3 + Vite + TypeScript, the same stack as `web/`.
- **Database:** SQLite to start, Postgres if it outgrows it. Accounts and card collections live
  outside any world; each world has its own state, so several worlds can run side by side.
- **Time model:** store *timestamps*, never countdowns. The server keeps a queue of timed events
  (build done, army arrives, rations run out, battle window opens, round ends) and processes each
  one when it's due, in order. The world speed is a multiplier on every duration.
- **Live updates:** WebSockets for the map, incoming armies and battle rounds.
- **Notifications:** Web Push (VAPID) from the same server. On iPhone, push only works once the
  game is installed to the home screen.
- **Balance data in one file** (`shared/src/data/balance.ts`): costs, timers, production, rations
  and battle numbers. Every number is a placeholder until playtested.
- **Local testing:** run the server locally and open several browser profiles as different
  players.
- **Deploy:** the client builds with `base: '/game/'` and is copied into `_site/game/` by
  `.github/workflows/deploy-pages.yml`, the same way `web/` goes to `/preview/`. The server needs
  its own host (a small VPS, Fly.io or Railway).

Suggested layout:

```
game/
  PLAN.md
  shared/
    src/
      rules/      # build queue, production, marches, rations, battles
      data/       # balance numbers, buildings, units, Wayfarer cards
  server/
    src/
      world/      # world state, event queue, AI Houses
      api/        # HTTP + WebSocket
      db/         # storage, migrations
      push/       # Web Push
  client/
    index.html
    vite.config.ts
    src/
      components/ # settlement view, map, build menu, cards, battle view
      assets/icons/
```

## Later (after v0.1)

1. Order choices and live round timers in battles; declared reserves; scouts
2. Great Projects and the end of a world
3. The adventure slot and Blight biomes
4. Card trading between players
5. Barony at 3 regions; kingdom
6. The Invasion event
7. Quartermasters and supply lines
8. The Chronicles: a log of everything that happened in the world

## Open questions

None blocking. Decided later:

- Which host runs the server once v0.1 is ready for other players.
- All the balance numbers (costs, timers, production, rations, battle maths, the gold price to
  get a captured card back). They're placeholders in `balance.ts` until playtested.
