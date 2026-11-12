// Declared sieges: declared a day ahead, fought in the battle window, rosters lock at the start.

import { SIEGE_LEAD, SIEGE_ROUNDS, SIEGE_ROUND_TIME } from '../data/balance.ts'
import type { Battle, BattleLog, Units, War, World } from '../types.ts'
import { armyForce, captureCommander, homeForce, removeArmy, sendHome } from './armies.ts'
import { type Side, decide, fightRound } from './battle.ts'
import { settlePlayer } from './economy.ts'
import { leaveHouseForced } from './houses.ts'
import {
  type Ctx,
  endProtection,
  fail,
  isProtected,
  notify,
  report,
  sameSide,
  sideMembers,
} from './world.ts'
import { UNIT_KEYS, dur, emptyUnits, newId, nextWindowOpen, totalUnits } from './util.ts'

export function activeWars(world: World): War[] {
  return Object.values(world.wars).filter((w) => w.state !== 'done')
}

/** Is this House a side in a war that hasn't ended? */
export function houseAtWar(world: World, houseId: string): boolean {
  return activeWars(world).some((w) => w.attackerHouseId === houseId || w.defenderHouseId === houseId)
}

export function declareSiege(ctx: Ctx, world: World, attackerId: string, regionId: number, t: number): War {
  const p = world.players[attackerId]!
  if (!p.founded) fail('Found your village first.')
  const region = world.regions[regionId]
  if (!region) fail('That region does not exist.')
  const defenderId = region.ownerId
  if (!defenderId) fail('Nobody holds that region. Claim it instead.')
  if (sameSide(world, attackerId, defenderId)) fail('You can’t besiege your own side.')
  if (isProtected(world, defenderId, t)) fail('That player is under beginner protection.')
  if (p.houseId) {
    const house = world.houses[p.houseId]!
    if (house.leaderId !== attackerId && !house.officers.includes(attackerId)) fail('Only your House leader or officers can declare a siege.')
  }
  if (activeWars(world).some((w) => w.regionId === regionId)) fail('A siege is already declared there.')
  endProtection(p, t)
  const defender = world.players[defenderId]!
  const startsAt = nextWindowOpen(world.config.battleWindow, t + dur(world, SIEGE_LEAD))
  const war: War = {
    id: newId(world, 'w'),
    attackerId,
    attackerHouseId: p.houseId,
    defenderId,
    defenderHouseId: defender.houseId,
    regionId,
    village: region.villageOf === defenderId,
    declaredAt: t,
    startsAt,
    state: 'declared',
    battleId: null,
    result: null,
  }
  world.wars[war.id] = war
  const what = war.village ? `${defender.name}’s village at ${region.name}` : region.name
  for (const id of sideMembers(world, attackerId)) {
    report(world, id, t, `Siege declared on ${region.name}`, `${p.name} declared a siege on ${what}. Muster your armies there before it starts.`)
  }
  for (const id of sideMembers(world, defenderId)) {
    report(world, id, t, `${p.name} declared a siege on ${region.name}`, `${p.name} will besiege ${what}. Station your armies there before it starts.`)
  }
  notify(ctx, world, sideMembers(world, defenderId), 'War declared', `${p.name} declared a siege on ${what}.`)
  notify(ctx, world, sideMembers(world, attackerId).filter((id) => id !== attackerId), 'Siege declared', `${p.name} declared a siege on ${what}.`)
  return war
}

function sideName(world: World, ids: string[]): string[] {
  return [...new Set(ids.map((id) => world.players[id]?.name ?? 'Unknown'))]
}

/** The moment a siege starts: the rosters lock and the first round is fought. */
export function startSiege(ctx: Ctx, world: World, war: War, t: number): void {
  const region = world.regions[war.regionId]!
  const defender = world.players[war.defenderId]
  if (!defender || defender.eliminated || region.ownerId !== war.defenderId) {
    endWar(world, war, 'fizzled', t, 'The region changed hands before the siege started.')
    return
  }
  const here = Object.values(world.armies).filter((a) => a.at === region.id && a.arriveAt === null && !a.battleId)
  const attackers = here.filter((a) => a.mission.kind === 'siege' && a.mission.warId === war.id)
  const defenders = here.filter((a) => sameSide(world, a.ownerId, war.defenderId) && !(a.mission.kind === 'siege'))
  if (!attackers.length) {
    endWar(world, war, 'fizzled', t, 'No attacking army mustered in time, so the siege never started.')
    return
  }
  const homeDefends = war.village
  const start = (list: Units[]) => {
    const u = emptyUnits()
    for (const x of list) for (const k of UNIT_KEYS) u[k] += x[k]
    return u
  }
  const battle: Battle = {
    id: newId(world, 'b'),
    warId: war.id,
    regionId: region.id,
    startedAt: t,
    round: 0,
    nextRoundAt: t,
    attackerArmies: attackers.map((a) => a.id),
    defenderArmies: defenders.map((a) => a.id),
    homeDefends,
    wallLevel: homeDefends ? defender.buildings.walls : 0,
    log: [],
    attackerStart: start(attackers.map((a) => a.units)),
    defenderStart: start([...defenders.map((a) => a.units), ...(homeDefends ? [defender.home] : [])]),
  }
  for (const a of [...attackers, ...defenders]) a.battleId = battle.id
  world.battles[battle.id] = battle
  war.state = 'fighting'
  war.battleId = battle.id
  const all = [...sideMembers(world, war.attackerId), ...sideMembers(world, war.defenderId)]
  notify(ctx, world, all, `The siege of ${region.name} has begun`, 'Rosters are locked. Rounds are being fought.')
}

function sides(world: World, battle: Battle, war: War): { attacker: Side; defender: Side } {
  const attacker: Side = {
    forces: battle.attackerArmies.map((id) => world.armies[id]).filter((a) => !!a).map((a) => armyForce(world, a)),
    wallLevel: 0,
  }
  const defender: Side = {
    forces: battle.defenderArmies.map((id) => world.armies[id]).filter((a) => !!a).map((a) => armyForce(world, a)),
    wallLevel: battle.wallLevel,
  }
  if (battle.homeDefends && world.players[war.defenderId]) defender.forces.unshift(homeForce(world, war.defenderId))
  return { attacker, defender }
}

export function siegeRound(ctx: Ctx, world: World, battle: Battle, t: number): void {
  const war = world.wars[battle.warId]!
  const defender = world.players[war.defenderId]
  if (defender) settlePlayer(world, defender, t)
  const { attacker, defender: dSide } = sides(world, battle, war)
  battle.round += 1
  const res = fightRound(battle.round, attacker, dSide)
  battle.wallLevel = dSide.wallLevel
  battle.log.push(res.log)
  if (res.over || battle.round >= SIEGE_ROUNDS) {
    finishSiege(ctx, world, battle, war, decide(attacker, dSide, res.withdrew), t)
  } else {
    battle.nextRoundAt = t + dur(world, SIEGE_ROUND_TIME)
  }
}

function unitsOf(world: World, ids: string[], extra?: Units): Units {
  const u = emptyUnits()
  for (const id of ids) {
    const a = world.armies[id]
    if (a) for (const k of UNIT_KEYS) u[k] += a.units[k]
  }
  if (extra) for (const k of UNIT_KEYS) u[k] += extra[k]
  return u
}

function finishSiege(ctx: Ctx, world: World, battle: Battle, war: War, winner: 'attacker' | 'defender', t: number): void {
  const region = world.regions[war.regionId]!
  const defender = world.players[war.defenderId]!
  if (battle.homeDefends) defender.buildings.walls = Math.floor(battle.wallLevel + 1e-9)
  const attackerArmies = battle.attackerArmies.map((id) => world.armies[id]).filter((a) => !!a)
  const defenderArmies = battle.defenderArmies.map((id) => world.armies[id]).filter((a) => !!a)
  const log: BattleLog = {
    kind: 'siege',
    regionId: region.id,
    attackerNames: sideName(world, attackerArmies.map((a) => a.ownerId).concat(war.attackerId)),
    defenderNames: sideName(world, defenderArmies.map((a) => a.ownerId).concat(war.defenderId)),
    attackerStart: battle.attackerStart,
    defenderStart: battle.defenderStart,
    attackerEnd: unitsOf(world, battle.attackerArmies),
    defenderEnd: unitsOf(world, battle.defenderArmies, battle.homeDefends ? defender.home : undefined),
    rounds: battle.log,
    winner,
  }
  const captured: string[] = []
  const losers = winner === 'attacker' ? defenderArmies : attackerArmies
  for (const a of losers) {
    const c = captureCommander(world, a, t)
    if (c) captured.push(c)
  }
  if (captured.length) log.captured = captured
  for (const a of [...attackerArmies, ...defenderArmies]) {
    a.battleId = null
    if (totalUnits(a.units) === 0) removeArmy(world, a)
  }
  delete world.battles[battle.id]
  war.battleId = null

  const attackerP = world.players[war.attackerId]
  const title = winner === 'attacker' ? `${region.name} has fallen` : `The siege of ${region.name} was broken`
  const text = winner === 'attacker'
    ? war.village
      ? `${attackerP?.name ?? 'The attackers'} destroyed ${defender.name}’s village. ${defender.name} is out of this world.`
      : `${attackerP?.name ?? 'The attackers'} took ${region.name}.`
    : `${defender.name}’s side held ${region.name}.`
  const everyone = [...new Set([...sideMembers(world, war.attackerId), ...sideMembers(world, war.defenderId)])]
  for (const id of everyone) report(world, id, t, title, text, log)
  notify(ctx, world, everyone, title, text)

  if (winner === 'attacker') {
    // Surviving defenders head home; the winners hold the field.
    for (const a of defenderArmies) if (world.armies[a.id]) sendHome(ctx, world, a, t)
    for (const a of attackerArmies) if (world.armies[a.id]) a.mission = { kind: 'move' }
    if (war.village) eliminate(ctx, world, defender.id, t)
    else changeOwner(world, region.id, war.attackerId, t)
  } else {
    for (const a of attackerArmies) if (world.armies[a.id]) sendHome(ctx, world, a, t)
  }
  war.state = 'done'
  war.result = winner
}

function endWar(world: World, war: War, result: War['result'], t: number, text: string): void {
  war.state = 'done'
  war.result = result
  const region = world.regions[war.regionId]!
  for (const id of new Set([...sideMembers(world, war.attackerId), ...sideMembers(world, war.defenderId)])) {
    report(world, id, t, `No siege at ${region.name}`, text)
  }
  for (const a of Object.values(world.armies)) {
    if (a.mission.kind === 'siege' && a.mission.warId === war.id) a.mission = { kind: 'move' }
  }
}

/** A region changes hands; sieges on it against the old holder are called off. */
export function changeOwner(world: World, regionId: number, newOwner: string | null, t: number): void {
  for (const p of Object.values(world.players)) settlePlayer(world, p, t)
  const region = world.regions[regionId]!
  const old = region.ownerId
  region.ownerId = newOwner
  for (const w of activeWars(world)) {
    if (w.regionId === regionId && w.defenderId === old && w.state === 'declared') {
      endWar(world, w, 'fizzled', t, `${region.name} changed hands before the siege started.`)
    }
  }
}

/** A player's village is destroyed: they're out of this world for good. */
export function eliminate(ctx: Ctx, world: World, playerId: string, t: number): void {
  const p = world.players[playerId]
  if (!p || p.eliminated) return
  for (const q of Object.values(world.players)) settlePlayer(world, q, t)
  p.eliminated = true
  p.buildQueue = []
  p.trainQueue = []
  p.home = emptyUnits()
  for (const r of world.regions) {
    if (r.villageOf === playerId) r.villageOf = null
    if (r.ownerId === playerId) changeOwner(world, r.id, null, t)
  }
  for (const a of Object.values(world.armies)) {
    if (a.ownerId !== playerId) continue
    for (const b of Object.values(world.battles)) {
      b.attackerArmies = b.attackerArmies.filter((id) => id !== a.id)
      b.defenderArmies = b.defenderArmies.filter((id) => id !== a.id)
    }
    removeArmy(world, a)
  }
  for (const w of activeWars(world)) {
    if (w.attackerId === playerId && w.state === 'declared') endWar(world, w, 'fizzled', t, `${p.name} is out of the world, so the siege is off.`)
  }
  for (const c of Object.values(p.cards)) {
    c.building = null
    c.armyId = null
  }
  if (p.houseId) leaveHouseForced(world, playerId, t)
  report(world, playerId, t, 'Your village has fallen', 'You are out of this world. You can still watch the map and use chat.')
  notify(ctx, world, [playerId], 'Your village has fallen', 'You are out of this world.')
}
