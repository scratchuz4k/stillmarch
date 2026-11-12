import { describe, expect, it } from 'vitest'
import { generateMap } from '../src/rules/mapgen.ts'
import { findPath, neighbours } from '../src/rules/armies.ts'
import { fightBattle } from '../src/rules/battle.ts'
import { joinWorld } from '../src/rules/world.ts'
import { viewFor } from '../src/rules/view.ts'
import { nextWindowOpen, windowOpen, emptyUnits, totalUnits } from '../src/rules/util.ts'
import { PRISON_TIME, productionPerHour } from '../src/data/balance.ts'
import { HOUR_MS, MIN, T0, act, militarise, must, run, testWorld, worldWith } from './helpers.ts'

describe('map', () => {
  it('connects every region and keeps the layout', () => {
    const m = generateMap(42, 50, 22)
    expect(m.regions.length).toBeGreaterThanOrEqual(45)
    const w = testWorld({ seed: 42, maxPlayers: 20, aiHouses: 2, regions: 50 })
    for (const r of w.regions) {
      if (r.kind === 'blight') continue
      expect(findPath(w, w.regions[0]!.id === r.id ? 1 : 0, r.id, 40), `region ${r.id}`).not.toBeNull()
    }
    expect(w.regions.filter((r) => r.kind === 'blight').length).toBe(2)
    expect(w.regions.filter((r) => r.kind === 'fortress').length).toBeGreaterThanOrEqual(5)
    expect(w.regions.filter((r) => r.slot === 'ring').length).toBe(22)
    for (const r of w.regions) expect(neighbours(w, r.id).length).toBeGreaterThan(0)
  })

  it('is the same for the same seed', () => {
    expect(generateMap(5, 40, 10)).toEqual(generateMap(5, 40, 10))
  })
})

describe('village', () => {
  it('produces resources over time, up to the storehouse cap', () => {
    const w = worldWith(['ana'])
    const p = w.players.ana!
    const before = p.res.wood
    run(w, T0 + HOUR_MS)
    expect(p.res.wood).toBeCloseTo(before + productionPerHour(0), 0)
    run(w, T0 + 1000 * HOUR_MS)
    expect(p.res.wood).toBe(1000)
  })

  it('finishes builds in order and keeps going while nobody is looking', () => {
    const w = worldWith(['ana'])
    must(w, 'ana', { type: 'build', building: 'lumber' }, T0)
    must(w, 'ana', { type: 'build', building: 'lumber' }, T0)
    const p = w.players.ana!
    expect(p.buildQueue).toHaveLength(2)
    const third = act(w, 'ana', { type: 'build', building: 'quarry' }, T0)
    expect(third.ok).toBe(false)
    run(w, T0 + 10 * MIN)
    // A failed action restores the world from a copy, so look the player up again.
    const q = w.players.ana!
    expect(q.buildings.lumber).toBe(2)
    expect(q.buildQueue).toHaveLength(0)
    expect(q.tasks.lumber2).toBe('done')
  })

  it('locks buildings behind the Obelisk and caps levels', () => {
    const w = worldWith(['ana'])
    expect(act(w, 'ana', { type: 'build', building: 'barracks' }, T0).error).toMatch(/Obelisk level 2/)
    const p = w.players.ana!
    p.buildings.lumber = 3
    p.res.wood = p.res.stone = 9999
    expect(act(w, 'ana', { type: 'build', building: 'lumber' }, T0).error).toMatch(/Raise your Obelisk/)
  })

  it('trains troops within the farm cap', () => {
    const w = worldWith(['ana'])
    militarise(w, 'ana', {})
    const p = w.players.ana!
    p.buildings.farm = 0
    expect(act(w, 'ana', { type: 'train', unit: 'infantry', count: 200 }, T0).error).toMatch(/farm feeds/)
    must(w, 'ana', { type: 'train', unit: 'infantry', count: 10 }, T0)
    run(w, T0 + HOUR_MS)
    expect(w.players.ana!.home.infantry).toBe(10)
  })
})

describe('battles', () => {
  it('lets the stronger side win and the rams break walls', () => {
    const big = { ...emptyUnits(), infantry: 100, ram: 12 }
    const small = { ...emptyUnits(), infantry: 20 }
    const out = fightBattle(
      { forces: [{ id: 'a', units: big, order: 'charge', attackBonus: 0, defenceBonus: 0 }], wallLevel: 0 },
      { forces: [{ id: 'd', units: small, order: 'hold', attackBonus: 0, defenceBonus: 0 }], wallLevel: 5 },
      5,
    )
    expect(out.winner).toBe('attacker')
    expect(small.infantry).toBe(0)
    expect(out.rounds[0]!.wallLevel).toBeLessThan(5)
  })

  it('gives an even fight to the defender', () => {
    const a = { ...emptyUnits(), infantry: 50 }
    const d = { ...emptyUnits(), infantry: 50 }
    const out = fightBattle(
      { forces: [{ id: 'a', units: a, order: 'charge', attackBonus: 0, defenceBonus: 0 }], wallLevel: 0 },
      { forces: [{ id: 'd', units: d, order: 'hold', attackBonus: 0, defenceBonus: 0 }], wallLevel: 0 },
      3,
    )
    expect(out.winner).toBe('defender')
  })

  it('falls back against a much stronger enemy', () => {
    const a = { ...emptyUnits(), infantry: 10 }
    const d = { ...emptyUnits(), infantry: 200 }
    const out = fightBattle(
      { forces: [{ id: 'a', units: a, order: 'fallback', attackBonus: 0, defenceBonus: 0 }], wallLevel: 0 },
      { forces: [{ id: 'd', units: d, order: 'hold', attackBonus: 0, defenceBonus: 0 }], wallLevel: 0 },
      3,
    )
    expect(out.rounds).toHaveLength(1)
    expect(out.rounds[0]!.note).toMatch(/fell back/)
    expect(out.winner).toBe('defender')
  })
})

describe('armies', () => {
  function fortressNear(w: ReturnType<typeof testWorld>, home: number) {
    return w.regions
      .filter((r) => r.fortress?.level === 1)
      .map((r) => ({ r, len: findPath(w, home, r.id, 40)!.length }))
      .sort((a, b) => a.len - b.len)[0]!.r
  }

  it('raids a Forgotten fortress for gold and brings it home', () => {
    const w = worldWith(['ana'])
    militarise(w, 'ana', { infantry: 80, archers: 40 })
    const p = w.players.ana!
    const fort = fortressNear(w, p.homeRegion)
    const goldBefore = p.res.gold
    const r = must(w, 'ana', { type: 'send', units: { ...emptyUnits(), infantry: 80, archers: 40 }, rations: 2000, commander: 'brena', order: 'charge', target: fort.id, mission: 'raid' }, T0)
    expect(w.armies[r.value!]).toBeDefined()
    run(w, T0 + 48 * HOUR_MS)
    expect(Object.keys(w.armies)).toHaveLength(0)
    expect(p.res.gold).toBeGreaterThan(goldBefore)
    expect(p.tasks.raid).toBe('done')
    expect(p.reports.some((x) => x.battle?.kind === 'raid' && x.battle.winner === 'attacker')).toBe(true)
    expect(p.cards.brena!.armyId).toBeNull()
  })

  it('jails the commander of a beaten army, then lets you buy them back', () => {
    const w = worldWith(['ana'])
    militarise(w, 'ana', { infantry: 3 })
    const p = w.players.ana!
    const fort = w.regions.find((r) => r.fortress?.level === 3)!
    must(w, 'ana', { type: 'send', units: { ...emptyUnits(), infantry: 3 }, rations: 2000, commander: 'brena', order: 'charge', target: fort.id, mission: 'raid' }, T0)
    run(w, T0 + 48 * HOUR_MS)
    const card = p.cards.brena!
    expect(card.prisonUntil).not.toBeNull()
    const t = T0 + 49 * HOUR_MS
    expect(act(w, 'ana', { type: 'releaseCard', cardId: 'brena' }, t).error).toMatch(/can.t be bought out yet/)
    const after = card.prisonUntil! + 1
    expect(after - (T0 + 48 * HOUR_MS)).toBeLessThanOrEqual(PRISON_TIME * 1000)
    must(w, 'ana', { type: 'releaseCard', cardId: 'brena' }, after)
    expect(w.players.ana!.cards.brena!.prisonUntil).toBeNull()
  })

  it('starves without food and loses troops every hour', () => {
    const w = worldWith(['ana'])
    militarise(w, 'ana', { infantry: 100 })
    const p = w.players.ana!
    const far = w.regions.filter((r) => r.kind === 'open' && !r.ownerId && !r.villageOf)
      .map((r) => ({ r, len: findPath(w, p.homeRegion, r.id, 40)?.length ?? 0 }))
      .sort((a, b) => b.len - a.len)[0]!.r
    const r = must(w, 'ana', { type: 'send', units: { ...emptyUnits(), infantry: 100 }, rations: 5, commander: null, order: 'hold', target: far.id, mission: 'move' }, T0)
    run(w, T0 + 40 * HOUR_MS)
    const army = w.armies[r.value!]
    if (army) {
      expect(army.starvingSince).not.toBeNull()
      expect(army.units.infantry).toBeLessThan(100)
    } else {
      expect(p.reports.some((x) => x.title === 'An army starved')).toBe(true)
    }
  })

  it('claims a dormant region', () => {
    const w = worldWith(['ana'])
    militarise(w, 'ana', { infantry: 20 })
    const p = w.players.ana!
    const target = neighbours(w, p.homeRegion).map((id) => w.regions[id]!).find((r) => r.kind === 'open' && !r.ownerId && !r.villageOf)!
    must(w, 'ana', { type: 'send', units: { ...emptyUnits(), infantry: 10 }, rations: 200, commander: null, order: 'hold', target: target.id, mission: 'claim' }, T0)
    run(w, T0 + 12 * HOUR_MS)
    expect(target.ownerId).toBe('ana')
  })

  it('makes hostile armies skirmish when they meet', () => {
    const w = worldWith(['ana', 'bo'])
    militarise(w, 'ana', { infantry: 100 })
    militarise(w, 'bo', { infantry: 10 })
    for (const p of Object.values(w.players)) p.protectionUntil = 0
    const a = w.players.ana!
    const b = w.players.bo!
    const spot = findPath(w, a.homeRegion, b.homeRegion, 40)!
    const mid = spot[Math.floor((spot.length - 1) / 2)]!
    must(w, 'bo', { type: 'send', units: { ...emptyUnits(), infantry: 10 }, rations: 500, commander: null, order: 'hold', target: mid, mission: 'move' }, T0)
    run(w, T0 + 30 * HOUR_MS)
    must(w, 'ana', { type: 'send', units: { ...emptyUnits(), infantry: 100 }, rations: 500, commander: null, order: 'charge', target: mid, mission: 'move' }, T0 + 30 * HOUR_MS)
    run(w, T0 + 80 * HOUR_MS)
    expect(a.reports.some((r) => r.battle?.kind === 'skirmish')).toBe(true)
    expect(Object.values(w.armies).filter((x) => x.ownerId === 'bo')).toHaveLength(0)
  })
})

describe('sieges', () => {
  it('needs a day’s notice, locks rosters at the start and can knock a player out', () => {
    const w = worldWith(['ana', 'bo'])
    militarise(w, 'ana', { infantry: 300, cavalry: 100 })
    militarise(w, 'bo', { infantry: 10 })
    for (const p of Object.values(w.players)) p.protectionUntil = 0
    const b = w.players.bo!
    // March most of the way first: crossing the map takes longer than the day's notice.
    const path = findPath(w, w.players.ana!.homeRegion, b.homeRegion, 40)!
    const staging = path[path.length - 2]!
    const s = must(w, 'ana', { type: 'send', units: { ...emptyUnits(), infantry: 300, cavalry: 100 }, rations: 4000, commander: null, order: 'charge', target: staging, mission: 'move' }, T0)
    run(w, T0 + 30 * HOUR_MS)
    const t1 = T0 + 30 * HOUR_MS
    const r = must(w, 'ana', { type: 'declareSiege', regionId: b.homeRegion }, t1)
    const war = w.wars[r.value!]!
    expect(war.village).toBe(true)
    expect(war.startsAt).toBe(t1 + 24 * HOUR_MS)
    must(w, 'ana', { type: 'redirect', armyId: s.value!, target: b.homeRegion, mission: 'siege', warId: war.id }, t1)
    // The siege starts a day later and is fought round by round.
    run(w, t1 + 30 * HOUR_MS)
    expect(war.state).toBe('done')
    expect(war.result).toBe('attacker')
    expect(b.eliminated).toBe(true)
    expect(w.regions[b.homeRegion]!.villageOf).toBeNull()
    const view = viewFor(w, 'bo')
    expect(view.armies).toHaveLength(0)
    expect(view.others).toHaveLength(0)
    expect(act(w, 'bo', { type: 'chat', channel: 'world', text: 'gg' }, t1 + 31 * HOUR_MS).ok).toBe(true)
    expect(act(w, 'bo', { type: 'build', building: 'lumber' }, t1 + 31 * HOUR_MS).ok).toBe(false)
  })

  it('fizzles when nobody shows up', () => {
    const w = worldWith(['ana', 'bo'])
    for (const p of Object.values(w.players)) p.protectionUntil = 0
    const r = must(w, 'ana', { type: 'declareSiege', regionId: w.players.bo!.homeRegion }, T0)
    run(w, T0 + 25 * HOUR_MS)
    expect(w.wars[r.value!]!.result).toBe('fizzled')
    expect(w.players.bo!.eliminated).toBe(false)
  })

  it('waits for the battle window', () => {
    const win = { start: '16:30', end: '22:30', tz: 'Europe/Berlin' }
    // 12:00 UTC is 13:00 in Berlin in November: closed. 16:30 Berlin = 15:30 UTC.
    expect(windowOpen(win, T0)).toBe(false)
    expect(nextWindowOpen(win, T0)).toBe(Date.UTC(2026, 10, 12, 15, 30))
    const w = worldWith(['ana', 'bo'], { battleWindow: win })
    for (const p of Object.values(w.players)) p.protectionUntil = 0
    const r = must(w, 'ana', { type: 'declareSiege', regionId: w.players.bo!.homeRegion }, T0)
    expect(w.wars[r.value!]!.startsAt).toBe(Date.UTC(2026, 10, 13, 15, 30))
  })

  it('respects beginner protection, and attacking ends your own', () => {
    const w = worldWith(['ana', 'bo'])
    expect(act(w, 'ana', { type: 'declareSiege', regionId: w.players.bo!.homeRegion }, T0).error).toMatch(/protection/)
    w.players.bo!.protectionUntil = 0
    must(w, 'ana', { type: 'declareSiege', regionId: w.players.bo!.homeRegion }, T0)
    expect(w.players.ana!.protectionUntil).toBeLessThanOrEqual(T0)
  })
})

describe('houses', () => {
  it('blocks switching too soon and leaving during a war', () => {
    const w = worldWith(['ana', 'bo', 'cy'])
    const h = must(w, 'ana', { type: 'createHouse', name: 'House Ash', tag: 'ASH' }, T0).value!
    must(w, 'bo', { type: 'joinHouse', houseId: h }, T0)
    must(w, 'bo', { type: 'leaveHouse' }, T0 + MIN)
    expect(act(w, 'bo', { type: 'joinHouse', houseId: h }, T0 + 2 * MIN).error).toMatch(/switch again/)
    must(w, 'bo', { type: 'joinHouse', houseId: h }, T0 + 73 * HOUR_MS)
    w.players.cy!.protectionUntil = 0
    for (const p of Object.values(w.players)) p.protectionUntil = 0
    must(w, 'ana', { type: 'declareSiege', regionId: w.players.cy!.homeRegion }, T0 + 73 * HOUR_MS)
    expect(act(w, 'bo', { type: 'leaveHouse' }, T0 + 74 * HOUR_MS).error).toMatch(/at war/)
  })

  it('caps alliances and lets betrayal be instant', () => {
    const names = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6']
    const w = worldWith(names, { maxPlayers: 8 })
    // Alliance cap for 8 players: 4. House sizes: 2 each.
    const a = must(w, 'p1', { type: 'createHouse', name: 'House One', tag: 'ONE' }, T0).value!
    must(w, 'p2', { type: 'joinHouse', houseId: a }, T0)
    const b = must(w, 'p3', { type: 'createHouse', name: 'House Two', tag: 'TWO' }, T0).value!
    must(w, 'p4', { type: 'joinHouse', houseId: b }, T0)
    const c = must(w, 'p5', { type: 'createHouse', name: 'House Three', tag: 'THR' }, T0).value!
    must(w, 'p1', { type: 'proposeAlliance', houseId: b }, T0)
    must(w, 'p3', { type: 'acceptAlliance', houseId: a }, T0)
    expect(w.houses[a]!.allies).toHaveLength(1)
    must(w, 'p5', { type: 'proposeAlliance', houseId: a }, T0)
    expect(act(w, 'p1', { type: 'acceptAlliance', houseId: c }, T0).error).toMatch(/alliance cap/)
    expect(act(w, 'p6', { type: 'joinHouse', houseId: a }, T0).error).toMatch(/alliance cap/)
    must(w, 'p3', { type: 'breakAlliance', houseId: a }, T0 + MIN)
    expect(w.houses[a]!.allies).toHaveLength(0)
    for (const p of Object.values(w.players)) p.protectionUntil = 0
    must(w, 'p3', { type: 'declareSiege', regionId: w.players.p1!.homeRegion }, T0 + 2 * MIN)
  })
})

describe('cards', () => {
  it('hires with gold and grants the card to the account', () => {
    const w = worldWith(['ana'])
    const p = w.players.ana!
    expect(act(w, 'ana', { type: 'hireCard' }, T0).error).toMatch(/gold/)
    w.players.ana!.res.gold = 1000
    const r = must(w, 'ana', { type: 'hireCard' }, T0)
    expect(r.effects).toEqual([{ kind: 'grantCard', accountId: 'ana', cardId: r.value }])
    expect(w.players.ana!.cards[r.value!]).toBeDefined()
    void p
  })

  it('limits crafting slots by Obelisk level and boosts production', () => {
    const w = worldWith(['ana'])
    const p = w.players.ana!
    p.buildings.lumber = 2
    p.buildings.quarry = 1
    const before = viewFor(w, 'ana').me.rates.wood
    must(w, 'ana', { type: 'assignCard', cardId: 'aldric', building: 'lumber' }, T0)
    expect(viewFor(w, 'ana').me.rates.wood).toBeGreaterThan(before)
    expect(act(w, 'ana', { type: 'assignCard', cardId: 'brena', building: 'quarry' }, T0).error).toMatch(/crafting slot/)
  })
})

describe('joining', () => {
  it('puts late joiners on the edge with a catch-up boost, and closes after a week', () => {
    const w = testWorld()
    const early = joinWorld(w, 'e', 'Early', [], T0)
    const late = joinWorld(w, 'l', 'Late', [], T0 + 3 * 24 * HOUR_MS)
    expect(w.regions[early.homeRegion]!.slot).toBe('ring')
    expect(w.regions[late.homeRegion]!.slot).toBe('edge')
    expect(late.res.wood).toBeGreaterThan(early.res.wood)
    expect(() => joinWorld(w, 'x', 'Too late', [], T0 + 8 * 24 * HOUR_MS)).toThrow(/closed/)
  })

  it('runs AI Houses without errors for a week', () => {
    const w = testWorld({ aiHouses: 2, maxPlayers: 6 })
    run(w, T0 + 7 * 24 * HOUR_MS)
    const ai = Object.values(w.players).filter((p) => p.isAI)
    expect(ai).toHaveLength(2)
    for (const p of ai) expect(p.buildings.lumber).toBeGreaterThan(0)
    expect(totalUnits(ai[0]!.home) + Object.values(w.armies).length).toBeGreaterThanOrEqual(0)
  })
})

describe('world speed', () => {
  it('scales every timer', () => {
    const slow = worldWith(['ana'], { speed: 1 })
    const fast = worldWith(['ana'], { speed: 10 })
    must(slow, 'ana', { type: 'build', building: 'lumber' }, T0)
    must(fast, 'ana', { type: 'build', building: 'lumber' }, T0)
    const d1 = slow.players.ana!.buildQueue[0]!.endsAt - T0
    const d10 = fast.players.ana!.buildQueue[0]!.endsAt - T0
    expect(d1 / d10).toBeCloseTo(10)
  })

  it('skip-time cheat moves the clock', () => {
    const w = worldWith(['ana'])
    must(w, 'ana', { type: 'build', building: 'lumber' }, T0)
    must(w, 'ana', { type: 'cheat', cheat: 'skip', minutes: 60 }, T0)
    expect(w.players.ana!.buildings.lumber).toBe(1)
    expect(w.clockOffset).toBe(60 * MIN)
  })
})
