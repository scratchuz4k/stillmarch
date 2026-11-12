// Armies on the map: marching road by road, eating rations, skirmishing, raiding and claiming.

import {
  CLAIM_COST,
  CLAIM_TIME,
  FORAGE_FACTOR,
  FORTRESS,
  FORTRESS_REGEN,
  HOUR,
  PRISON_TIME,
  RAID_ROUNDS,
  RATIONS_PER_HOUR,
  RIVER_MARCH,
  SKIRMISH_ROUNDS,
  STARVE_LOSS,
  TERRAIN_MARCH,
  UNITS,
  regionCap,
} from '../data/balance.ts'
import { CARD_BY_ID } from '../data/cards.ts'
import type { Army, BattleLog, Order, Region, Res, Units, World } from '../types.ts'
import { type Force, type Side, fightBattle, mightBonus } from './battle.ts'
import { addRes, craftBonus, ownedRegions, settlePlayer } from './economy.ts'
import {
  type Ctx,
  endProtection,
  fail,
  hostile,
  isProtected,
  notify,
  report,
  sameSide,
} from './world.ts'
import { RES_KEYS, UNIT_KEYS, canAfford, dur, emptyRes, emptyUnits, formatUnits, pay, totalUnits, worldHours } from './util.ts'

export function neighbours(world: World, id: number): number[] {
  const out: number[] = []
  for (const r of world.roads) {
    if (r.a === id) out.push(r.b)
    else if (r.b === id) out.push(r.a)
  }
  return out
}

export function road(world: World, a: number, b: number) {
  return world.roads.find((r) => (r.a === a && r.b === b) || (r.a === b && r.b === a))
}

function commanderDef(army: Army) {
  return army.commander ? CARD_BY_ID[army.commander] : undefined
}

function traitPct(army: Army, kind: string): number {
  const c = commanderDef(army)
  return c && c.trait.kind === kind ? c.trait.pct / 100 : 0
}

/** Map units per world-hour: the slowest troop type sets the pace. */
export function armySpeed(world: World, army: Pick<Army, 'units' | 'ownerId' | 'commander'>): number {
  let speed = Infinity
  for (const k of UNIT_KEYS) if (army.units[k] > 0) speed = Math.min(speed, UNITS[k].speed)
  if (!Number.isFinite(speed)) speed = UNITS.infantry.speed
  let pct = 0
  for (const r of ownedRegions(world, army.ownerId)) if (r.bonus?.kind === 'march') pct += r.bonus.pct / 100
  const c = army.commander ? CARD_BY_ID[army.commander] : undefined
  if (c && c.trait.kind === 'march') pct += c.trait.pct / 100
  return speed * (1 + pct)
}

/** World-hours at x1 to march one road. */
function hopHours(world: World, from: number, to: number, speed: number): number {
  const rd = road(world, from, to)
  if (!rd) return Infinity
  const dest = world.regions[to]!
  return (rd.length * TERRAIN_MARCH[dest.terrain] * (rd.river ? RIVER_MARCH : 1)) / speed
}

function passable(region: Region, target: number): boolean {
  return region.kind !== 'blight' || region.id === target
}

/** Fastest route by march time. Returns the regions after `from`, ending at `to`. */
export function findPath(world: World, from: number, to: number, speed: number): number[] | null {
  if (from === to) return []
  const n = world.regions.length
  const best = new Array<number>(n).fill(Infinity)
  const prev = new Array<number>(n).fill(-1)
  const done = new Array<boolean>(n).fill(false)
  best[from] = 0
  for (;;) {
    let u = -1
    for (let i = 0; i < n; i++) if (!done[i] && best[i]! < Infinity && (u < 0 || best[i]! < best[u]!)) u = i
    if (u < 0 || u === to) break
    done[u] = true
    for (const v of neighbours(world, u)) {
      if (!passable(world.regions[v]!, to)) continue
      const d = best[u]! + hopHours(world, u, v, speed)
      if (d < best[v]!) {
        best[v] = d
        prev[v] = u
      }
    }
  }
  if (best[to] === Infinity) return null
  const path: number[] = []
  for (let v = to; v !== from; v = prev[v]!) path.unshift(v)
  return path
}

/** Total march time in ms along a path (for previews). */
export function pathTime(world: World, from: number, path: number[], speed: number): number {
  let hours = 0
  let at = from
  for (const p of path) {
    hours += hopHours(world, at, p, speed)
    at = p
  }
  return dur(world, hours * HOUR)
}

function startHop(world: World, army: Army, t: number): void {
  const next = army.path[0]
  if (next === undefined) {
    army.departedAt = null
    army.arriveAt = null
    return
  }
  army.departedAt = t
  army.arriveAt = t + dur(world, hopHours(world, army.at, next, armySpeed(world, army)) * HOUR)
}

// ---------- Rations ----------

export function foodPoints(u: Units): number {
  let n = 0
  for (const k of UNIT_KEYS) n += UNITS[k].food * u[k]
  return n
}

/** The region the army counts as being in, for rations. */
function rationRegion(world: World, army: Army): Region {
  const id = army.arriveAt !== null && army.path[0] !== undefined ? army.path[0] : army.at
  return world.regions[id]!
}

/** Rations eaten per world-hour right now. */
export function rationRate(world: World, army: Army): number {
  const region = rationRegion(world, army)
  if (region.ownerId === army.ownerId) return 0
  let factor = 1
  if (army.arriveAt === null && !region.ownerId && region.kind === 'open') factor = FORAGE_FACTOR
  return foodPoints(army.units) * RATIONS_PER_HOUR * factor * (1 - traitPct(army, 'rations'))
}

export function settleArmy(world: World, army: Army, t: number): void {
  if (t <= army.rationsAt) return
  if (army.starvingSince === null) {
    const rate = rationRate(world, army)
    const hours = worldHours(world, t - army.rationsAt)
    const eaten = rate * hours
    if (eaten >= army.rations - 1e-6 && rate > 0) {
      const emptyAt = army.rationsAt + dur(world, (army.rations / rate) * HOUR)
      army.rations = 0
      army.starvingSince = Math.min(t, emptyAt)
      army.nextStarveAt = army.starvingSince + dur(world, HOUR)
    } else {
      army.rations = Math.max(0, army.rations - eaten)
    }
  } else if (rationRate(world, army) === 0) {
    // Back in its own land: it stops starving.
    army.starvingSince = null
    army.nextStarveAt = null
  }
  army.rationsAt = t
}

/** When the rations run out, if nothing changes. */
export function rationsEmptyAt(world: World, army: Army): number | null {
  if (army.starvingSince !== null) return null
  const rate = rationRate(world, army)
  if (rate <= 0) return null
  return army.rationsAt + dur(world, (army.rations / rate) * HOUR)
}

export function starveTick(ctx: Ctx, world: World, army: Army, t: number): void {
  const lost = emptyUnits()
  for (const k of UNIT_KEYS) {
    lost[k] = Math.min(army.units[k], Math.ceil(army.units[k] * STARVE_LOSS))
    army.units[k] -= lost[k]
  }
  army.nextStarveAt = t + dur(world, HOUR)
  if (totalUnits(army.units) === 0) {
    report(world, army.ownerId, t, 'An army starved', `Your army at ${world.regions[army.at]!.name} ran out of food and scattered.`)
    notify(ctx, world, [army.ownerId], 'An army starved', `Your army at ${world.regions[army.at]!.name} is gone.`)
    removeArmy(world, army)
  }
}

// ---------- Commanders and capture ----------

export function freeCommander(world: World, army: Army): void {
  if (!army.commander) return
  const card = world.players[army.ownerId]?.cards[army.commander]
  if (card) card.armyId = null
  army.commander = null
}

/** The commander of a beaten army goes to prison. Returns the commander's name, if any. */
export function captureCommander(world: World, army: Army, t: number): string | null {
  if (!army.commander) return null
  const card = world.players[army.ownerId]?.cards[army.commander]
  const name = CARD_BY_ID[army.commander]?.name ?? army.commander
  if (card) {
    card.armyId = null
    card.prisonUntil = t + dur(world, PRISON_TIME)
  }
  army.commander = null
  return name
}

export function removeArmy(world: World, army: Army): void {
  freeCommander(world, army)
  delete world.armies[army.id]
}

export function armyForce(world: World, army: Army, vsFortress = false): Force {
  const c = commanderDef(army)
  const might = c ? mightBonus(c.might) : 0
  return {
    id: army.id,
    units: army.units,
    order: army.order,
    attackBonus: might + (vsFortress ? traitPct(army, 'fortress') : 0),
    defenceBonus: might,
  }
}

export function homeForce(world: World, playerId: string): Force {
  const p = world.players[playerId]!
  return {
    id: `home:${playerId}`,
    units: p.home,
    order: p.homeOrder,
    attackBonus: 0,
    defenceBonus: craftBonus(p, 'walls', 'walls'),
  }
}

// ---------- Sending armies ----------

export interface SendArgs {
  units: Units
  rations: number
  commander: string | null
  order: Order
  target: number
  mission: 'move' | 'claim' | 'raid' | 'siege'
  warId?: string
}

function checkMission(world: World, ownerId: string, target: number, mission: SendArgs['mission'], warId: string | undefined, t: number): Army['mission'] {
  const region = world.regions[target]
  if (!region) fail('That region does not exist.')
  if (region.kind === 'blight') fail('The Blight is closed for now.')
  if (mission === 'claim') {
    if (region.kind !== 'open' || region.ownerId || region.villageOf) fail('Only a dormant Obelisk can be claimed.')
    const p = world.players[ownerId]!
    const held = ownedRegions(world, ownerId).filter((r) => r.id !== p.homeRegion).length
    if (held >= regionCap(p.buildings.obelisk)) fail('Raise your Obelisk to hold more regions.')
    return { kind: 'claim', endsAt: null }
  }
  if (mission === 'raid') {
    if (region.kind === 'fortress') return { kind: 'raid' }
    const defender = region.villageOf
    if (!defender || !world.players[defender]?.founded) fail('You can only raid a village or a Forgotten fortress.')
    if (sameSide(world, ownerId, defender)) fail('You can’t raid your own side.')
    if (isProtected(world, defender, t)) fail('That village is under beginner protection.')
    return { kind: 'raid' }
  }
  if (mission === 'siege') {
    const war = warId ? world.wars[warId] : undefined
    if (!war || war.state !== 'declared') fail('Pick a declared siege to join.')
    if (war.regionId !== target) fail('That siege is somewhere else.')
    if (!sameSide(world, ownerId, war.attackerId)) fail('That siege isn’t yours to join.')
    return { kind: 'siege', warId: war.id }
  }
  return { kind: 'move' }
}

export function sendArmy(ctx: Ctx, world: World, ownerId: string, args: SendArgs, t: number): Army {
  const p = world.players[ownerId]!
  if (!p.founded) fail('Found your village first.')
  const units = emptyUnits()
  for (const k of UNIT_KEYS) {
    const n = Math.floor(args.units[k] ?? 0)
    if (n < 0) fail('Troop counts can’t be negative.')
    if (n > p.home[k]) fail(`You only have ${p.home[k]} ${UNITS[k].plural} at home.`)
    units[k] = n
  }
  if (totalUnits(units) === 0) fail('Pick some troops to send.')
  const rations = Math.floor(args.rations)
  if (rations < 0 || rations > p.res.food) fail('Not enough food for those rations.')
  if (args.commander) {
    const card = p.cards[args.commander]
    if (!card) fail('You don’t have that Wayfarer.')
    if (card.prisonUntil !== null) fail('That Wayfarer is in prison.')
    if (card.armyId || card.building) fail('That Wayfarer is busy.')
    const used = Object.values(p.cards).filter((c) => c.armyId).length
    if (used >= combatSlots(p)) fail('No free combat slot. Raise your Obelisk for more.')
  }
  const mission = checkMission(world, ownerId, args.target, args.mission, args.warId, t)
  if (args.mission === 'claim' && !canAfford(p.res, CLAIM_COST)) fail('Claiming costs 200 wood and 200 stone.')
  const speed = armySpeed(world, { units, ownerId, commander: args.commander })
  const path = findPath(world, p.homeRegion, args.target, speed)
  if (!path) fail('There is no road there.')
  if (args.mission === 'raid' && world.regions[args.target]!.villageOf) endProtection(p, t)

  settlePlayer(world, p, t)
  for (const k of UNIT_KEYS) p.home[k] -= units[k]
  p.res.food -= rations
  const id = `a${++world.nextId}`
  const army: Army = {
    id,
    ownerId,
    units,
    commander: args.commander,
    at: p.homeRegion,
    path,
    departedAt: null,
    arriveAt: null,
    target: args.target,
    mission,
    order: args.order,
    rations,
    rationsAt: t,
    starvingSince: null,
    nextStarveAt: null,
    loot: emptyRes(),
    battleId: null,
  }
  if (args.commander) p.cards[args.commander]!.armyId = id
  world.armies[id] = army
  if (path.length === 0) arriveFinal(ctx, world, army, t)
  else startHop(world, army, t)
  return army
}

export function combatSlots(p: { buildings: { obelisk: number } }): number {
  return Math.max(1, p.buildings.obelisk)
}

/** Give an army in the field a new destination. */
export function redirectArmy(ctx: Ctx, world: World, army: Army, target: number, mission: SendArgs['mission'] | 'return', warId: string | undefined, t: number): void {
  if (army.battleId) fail('That army is locked in a battle.')
  const owner = world.players[army.ownerId]!
  if (mission === 'return') {
    target = owner.homeRegion
    army.mission = { kind: 'return' }
  } else {
    if (mission === 'claim' && !canAfford(owner.res, CLAIM_COST)) fail('Claiming costs 200 wood and 200 stone.')
    army.mission = checkMission(world, army.ownerId, target, mission, warId, t)
    if (mission === 'raid' && world.regions[target]!.villageOf) endProtection(owner, t)
  }
  // An army on a road finishes the road it's on, then heads for the new target.
  const from = army.arriveAt !== null && army.path[0] !== undefined ? army.path[0] : army.at
  const rest = findPath(world, from, target, armySpeed(world, army))
  if (!rest) fail('There is no road there.')
  army.target = target
  if (army.arriveAt !== null) {
    army.path = [from, ...rest]
  } else {
    army.path = rest
    if (rest.length === 0) {
      arriveFinal(ctx, world, army, t)
      return
    }
    startHop(world, army, t)
  }
}

export function sendHome(ctx: Ctx, world: World, army: Army, t: number): void {
  const owner = world.players[army.ownerId]
  if (!owner || owner.eliminated) {
    removeArmy(world, army)
    return
  }
  army.mission = { kind: 'return' }
  army.target = owner.homeRegion
  const path = findPath(world, army.at, owner.homeRegion, armySpeed(world, army))
  army.path = path ?? []
  if (!path || path.length === 0) arriveFinal(ctx, world, army, t)
  else startHop(world, army, t)
}

// ---------- Arrivals ----------

/** The army reaches the end of the road it's on. */
export function arriveHop(ctx: Ctx, world: World, army: Army, t: number): void {
  const next = army.path.shift()
  if (next === undefined) return
  army.at = next
  army.departedAt = null
  army.arriveAt = null
  // Meeting hostile armies on the way means a skirmish.
  if (!skirmish(ctx, world, army, t)) return
  if (army.path.length === 0) arriveFinal(ctx, world, army, t)
  else startHop(world, army, t)
}

/** Returns false if the arriving army lost (or is gone). */
function skirmish(ctx: Ctx, world: World, army: Army, t: number): boolean {
  const foes = Object.values(world.armies).filter((a) =>
    a.id !== army.id && a.at === army.at && a.arriveAt === null && !a.battleId &&
    hostile(world, army.ownerId, a.ownerId, t))
  if (!foes.length) return true
  const attacker: Side = { forces: [armyForce(world, army)], wallLevel: 0 }
  const defender: Side = { forces: foes.map((f) => armyForce(world, f)), wallLevel: 0 }
  const aStart = { ...army.units }
  const dStart = sumOf(foes.map((f) => f.units))
  const outcome = fightBattle(attacker, defender, SKIRMISH_ROUNDS)
  const captured: string[] = []
  const losers = outcome.winner === 'attacker' ? foes : [army]
  for (const l of losers) {
    const c = captureCommander(world, l, t)
    if (c) captured.push(c)
  }
  const region = world.regions[army.at]!
  const log: BattleLog = {
    kind: 'skirmish',
    regionId: region.id,
    attackerNames: [nameOf(world, army.ownerId)],
    defenderNames: [...new Set(foes.map((f) => nameOf(world, f.ownerId)))],
    attackerStart: aStart,
    defenderStart: dStart,
    attackerEnd: { ...army.units },
    defenderEnd: sumOf(foes.map((f) => f.units)),
    rounds: outcome.rounds,
    winner: outcome.winner,
  }
  if (captured.length) log.captured = captured
  const everyone = [...new Set([army.ownerId, ...foes.map((f) => f.ownerId)])]
  for (const id of everyone) {
    const won = (id === army.ownerId) === (outcome.winner === 'attacker')
    report(world, id, t, `Skirmish at ${region.name}: ${won ? 'won' : 'lost'}`, `Armies met on the road at ${region.name}.`, log)
  }
  notify(ctx, world, everyone, `Skirmish at ${region.name}`, 'Armies met on the road. See the battle report.')
  // Clean up: empty armies are gone, beaten survivors head home.
  for (const a of [army, ...foes]) {
    if (totalUnits(a.units) === 0) removeArmy(world, a)
  }
  for (const l of losers) {
    if (world.armies[l.id]) sendHome(ctx, world, l, t)
  }
  return outcome.winner === 'attacker' && !!world.armies[army.id]
}

function nameOf(world: World, id: string): string {
  return world.players[id]?.name ?? 'Unknown'
}

function sumOf(list: Units[]): Units {
  const u = emptyUnits()
  for (const x of list) for (const k of UNIT_KEYS) u[k] += x[k]
  return u
}

export function settleFortress(world: World, region: Region, t: number): void {
  const f = region.fortress
  if (!f || t <= f.garrisonAt) return
  const hours = worldHours(world, t - f.garrisonAt)
  for (const k of UNIT_KEYS) {
    const max = f.maxGarrison[k]
    if (f.garrison[k] < max) f.garrison[k] = Math.min(max, f.garrison[k] + Math.ceil(max * FORTRESS_REGEN * hours - 1e-9))
  }
  f.garrisonAt = t
}

export function arriveFinal(ctx: Ctx, world: World, army: Army, t: number): void {
  army.path = []
  army.departedAt = null
  army.arriveAt = null
  const region = world.regions[army.at]!
  const owner = world.players[army.ownerId]!
  const m = army.mission
  if (m.kind === 'return' && army.at === owner.homeRegion) {
    settlePlayer(world, owner, t)
    for (const k of UNIT_KEYS) owner.home[k] += army.units[k]
    addRes(world, owner, { ...army.loot, food: army.loot.food + Math.floor(army.rations) })
    const lootText = RES_KEYS.filter((k) => army.loot[k] > 0).map((k) => `${Math.floor(army.loot[k])} ${k}`).join(', ')
    report(world, owner.id, t, 'An army came home', `${formatUnits(army.units)} are back home${lootText ? ` with ${lootText}` : ''}.`)
    removeArmy(world, army)
    return
  }
  if (m.kind === 'claim') {
    if (region.kind !== 'open' || region.ownerId || region.villageOf) {
      report(world, owner.id, t, 'Claim failed', `${region.name} was already taken.`)
      army.mission = { kind: 'move' }
      return
    }
    m.endsAt = t + dur(world, CLAIM_TIME)
    return
  }
  if (m.kind === 'raid') {
    if (region.kind === 'fortress') raidFortress(ctx, world, army, region, t)
    else if (region.villageOf) raidVillage(ctx, world, army, region, t)
    else army.mission = { kind: 'move' }
    return
  }
  // Moving or waiting for a siege: just stay here.
}

export function finishClaim(ctx: Ctx, world: World, army: Army, t: number): void {
  const region = world.regions[army.at]!
  const owner = world.players[army.ownerId]!
  army.mission = { kind: 'move' }
  const held = ownedRegions(world, owner.id).filter((r) => r.id !== owner.homeRegion).length
  if (region.ownerId || region.villageOf || held >= regionCap(owner.buildings.obelisk)) {
    report(world, owner.id, t, 'Claim failed', `${region.name} could not be claimed.`)
    return
  }
  settlePlayer(world, owner, t)
  if (!canAfford(owner.res, CLAIM_COST)) {
    report(world, owner.id, t, 'Claim failed', `You couldn’t pay the 200 wood and 200 stone to claim ${region.name}.`)
    return
  }
  pay(owner.res, CLAIM_COST)
  for (const p of Object.values(world.players)) settlePlayer(world, p, t)
  region.ownerId = owner.id
  report(world, owner.id, t, `${region.name} is yours`, `Your army woke the Obelisk at ${region.name}.`)
  notify(ctx, world, [owner.id], `${region.name} claimed`, 'A new region is yours.')
  if (owner.tasks.region !== 'claimed') owner.tasks.region = 'done'
}

function lootCapacity(army: Army): number {
  let cap = 0
  for (const k of UNIT_KEYS) cap += UNITS[k].carry * army.units[k]
  cap *= 1 + traitPct(army, 'loot')
  return cap - RES_KEYS.reduce((s, k) => s + army.loot[k], 0)
}

function raidFortress(ctx: Ctx, world: World, army: Army, region: Region, t: number): void {
  settleFortress(world, region, t)
  const f = region.fortress!
  const aStart = { ...army.units }
  const dStart = { ...f.garrison }
  const attacker: Side = { forces: [armyForce(world, army, true)], wallLevel: 0 }
  const defender: Side = { forces: [{ id: 'fortress', units: f.garrison, order: 'hold', attackBonus: 0, defenceBonus: 0 }], wallLevel: 0 }
  const outcome = fightBattle(attacker, defender, RAID_ROUNDS)
  const log: BattleLog = {
    kind: 'raid',
    regionId: region.id,
    attackerNames: [nameOf(world, army.ownerId)],
    defenderNames: ['The Forgotten'],
    attackerStart: aStart,
    defenderStart: dStart,
    attackerEnd: { ...army.units },
    defenderEnd: { ...f.garrison },
    rounds: outcome.rounds,
    winner: outcome.winner,
  }
  const owner = world.players[army.ownerId]!
  if (outcome.winner === 'attacker') {
    const prize = FORTRESS[f.level]
    const room = Math.max(0, lootCapacity(army))
    const gold = Math.min(prize.gold, room)
    army.loot.gold += gold
    army.rations += prize.food
    log.loot = { gold, food: prize.food }
    report(world, owner.id, t, `Raid on ${region.name}: won`, `You broke the Forgotten at ${region.name} and took ${gold} gold and ${prize.food} food for the march home.`, log)
    if (owner.tasks.raid !== 'claimed') owner.tasks.raid = 'done'
  } else {
    const c = captureCommander(world, army, t)
    if (c) log.captured = [c]
    report(world, owner.id, t, `Raid on ${region.name}: lost`, `The Forgotten at ${region.name} held.${c ? ` ${c} was captured.` : ''}`, log)
  }
  notify(ctx, world, [owner.id], `Raid on ${region.name}`, outcome.winner === 'attacker' ? 'Won. Your army is heading home.' : 'Lost. See the battle report.')
  if (totalUnits(army.units) === 0) removeArmy(world, army)
  else sendHome(ctx, world, army, t)
}

function raidVillage(ctx: Ctx, world: World, army: Army, region: Region, t: number): void {
  const defenderId = region.villageOf!
  const def = world.players[defenderId]
  if (!def || def.eliminated || sameSide(world, army.ownerId, defenderId) || isProtected(world, defenderId, t)) {
    army.mission = { kind: 'move' }
    return
  }
  settlePlayer(world, def, t)
  const helpers = Object.values(world.armies).filter((a) =>
    a.at === region.id && a.arriveAt === null && !a.battleId && a.id !== army.id && sameSide(world, a.ownerId, defenderId))
  const attacker: Side = { forces: [armyForce(world, army)], wallLevel: 0 }
  const defender: Side = { forces: [homeForce(world, defenderId), ...helpers.map((h) => armyForce(world, h))], wallLevel: def.buildings.walls }
  const aStart = { ...army.units }
  const dStart = sumOf(defender.forces.map((f) => ({ ...f.units })))
  const outcome = fightBattle(attacker, defender, RAID_ROUNDS)
  def.buildings.walls = Math.floor(defender.wallLevel + 1e-9)
  const log: BattleLog = {
    kind: 'raid',
    regionId: region.id,
    attackerNames: [nameOf(world, army.ownerId)],
    defenderNames: [...new Set([def.name, ...helpers.map((h) => nameOf(world, h.ownerId))])],
    attackerStart: aStart,
    defenderStart: dStart,
    attackerEnd: { ...army.units },
    defenderEnd: sumOf(defender.forces.map((f) => f.units)),
    rounds: outcome.rounds,
    winner: outcome.winner,
  }
  const captured: string[] = []
  if (outcome.winner === 'attacker') {
    const room = Math.max(0, lootCapacity(army))
    const avail = RES_KEYS.reduce((s, k) => s + Math.floor(def.res[k]), 0)
    const take: Partial<Res> = {}
    if (avail > 0 && room > 0) {
      const share = Math.min(1, room / avail)
      for (const k of RES_KEYS) {
        const n = Math.floor(def.res[k] * share)
        if (n <= 0) continue
        take[k] = n
        def.res[k] -= n
        if (k === 'food') army.rations += n
        else army.loot[k] += n
      }
    }
    log.loot = take
    for (const h of helpers) {
      const c = captureCommander(world, h, t)
      if (c) captured.push(c)
    }
  } else {
    const c = captureCommander(world, army, t)
    if (c) captured.push(c)
  }
  if (captured.length) log.captured = captured
  const lootText = log.loot ? RES_KEYS.filter((k) => (log.loot![k] ?? 0) > 0).map((k) => `${log.loot![k]} ${k}`).join(', ') : ''
  const aWon = outcome.winner === 'attacker'
  report(world, army.ownerId, t, `Raid on ${def.name}: ${aWon ? 'won' : 'lost'}`, aWon ? `You raided ${region.name}${lootText ? ` and took ${lootText}` : ''}.` : `${def.name}’s village held.`, log)
  for (const id of new Set([defenderId, ...helpers.map((h) => h.ownerId)])) {
    report(world, id, t, `${nameOf(world, army.ownerId)} raided ${region.name}: ${aWon ? 'lost' : 'held'}`, aWon ? `Raiders broke through${lootText ? ` and took ${lootText}` : ''}.` : 'Your defenders drove the raiders off.', log)
  }
  notify(ctx, world, [army.ownerId, defenderId], `Raid at ${region.name}`, aWon ? 'The raiders won.' : 'The defenders held.')
  for (const h of helpers) {
    if (totalUnits(h.units) === 0) removeArmy(world, h)
    else if (aWon) sendHome(ctx, world, h, t)
  }
  if (totalUnits(army.units) === 0) removeArmy(world, army)
  else sendHome(ctx, world, army, t)
}
