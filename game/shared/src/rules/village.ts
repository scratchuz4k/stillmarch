// The village: the build queue, training troops, Wayfarer cards and starter tasks.

import {
  BUILDINGS,
  BUILD_QUEUE_LENGTH,
  HIRE_COST,
  RELEASE_COST,
  UNCOMMON_HIRE_CHANCE,
  UNITS,
  cardSlots,
  levelCap,
  trainSpeedFactor,
} from '../data/balance.ts'
import { CARDS, CARD_BY_ID } from '../data/cards.ts'
import { TASKS } from '../data/tasks.ts'
import type { BuildingKey, Player, Res, UnitKey, World } from '../types.ts'
import { addRes, craftBonus, ownedRegions, troopCap, troopsUsed } from './economy.ts'
import { type Ctx, fail, notify, report } from './world.ts'
import { canAfford, dur, pay, random, scaleCost, totalUnits } from './util.ts'

export function buildCost(building: BuildingKey, toLevel: number): Partial<Res> {
  const def = BUILDINGS[building]
  return scaleCost(def.baseCost, Math.pow(def.costGrowth, toLevel - 1))
}

/** Build time in ms, with the Obelisk Wayfarer's bonus. */
export function buildTime(world: World, p: Player, building: BuildingKey, toLevel: number): number {
  const def = BUILDINGS[building]
  const base = def.baseTime * Math.pow(def.timeGrowth, toLevel - 1)
  return dur(world, base / (1 + craftBonus(p, 'obelisk', 'build')))
}

/** The level a building will reach once everything in the queue is done. */
export function plannedLevel(p: Player, building: BuildingKey): number {
  let lvl = p.buildings[building]
  for (const j of p.buildQueue) if (j.building === building) lvl = Math.max(lvl, j.toLevel)
  return lvl
}

export function queueBuild(world: World, p: Player, building: BuildingKey, t: number): void {
  if (!p.founded) fail('Found your village first.')
  if (!BUILDINGS[building]) fail('Unknown building.')
  if (p.buildQueue.length >= BUILD_QUEUE_LENGTH) fail(`The build queue holds ${BUILD_QUEUE_LENGTH} jobs.`)
  const toLevel = plannedLevel(p, building) + 1
  const def = BUILDINGS[building]
  const obelisk = plannedLevel(p, 'obelisk')
  if (toLevel > def.maxLevel) fail(`${def.name} is at its highest level.`)
  if (building !== 'obelisk') {
    if (p.buildings.obelisk < def.unlockObelisk) fail(`${def.name} needs Obelisk level ${def.unlockObelisk}.`)
    if (toLevel > levelCap(building, p.buildings.obelisk)) fail(`Raise your Obelisk to build ${def.name} higher.`)
  } else if (toLevel > obelisk + 1) {
    fail('One Obelisk level at a time.')
  }
  const cost = buildCost(building, toLevel)
  if (!canAfford(p.res, cost)) fail('Not enough resources.')
  pay(p.res, cost)
  const startsAt = Math.max(t, p.buildQueue.at(-1)?.endsAt ?? t)
  p.buildQueue.push({ building, toLevel, startedAt: startsAt, endsAt: startsAt + buildTime(world, p, building, toLevel) })
}

export function finishBuild(ctx: Ctx, world: World, p: Player, t: number): void {
  const job = p.buildQueue.shift()
  if (!job) return
  p.buildings[job.building] = Math.max(p.buildings[job.building], job.toLevel)
  const name = BUILDINGS[job.building].name
  report(world, p.id, t, `${name} level ${job.toLevel}`, `${name} has reached level ${job.toLevel}.`)
  notify(ctx, world, [p.id], 'Build finished', `${name} is now level ${job.toLevel}.`)
  // The next job can't start before this one ends.
  const next = p.buildQueue[0]
  if (next && next.startedAt < t) {
    const length = next.endsAt - next.startedAt
    next.startedAt = t
    next.endsAt = t + length
  }
}

export function trainTime(world: World, p: Player, unit: UnitKey, count: number): number {
  const base = UNITS[unit].trainTime * count * trainSpeedFactor(p.buildings.barracks)
  return dur(world, base / (1 + craftBonus(p, 'barracks', 'training')))
}

export function queueTraining(world: World, p: Player, unit: UnitKey, count: number, t: number): void {
  if (!p.founded) fail('Found your village first.')
  if (p.buildings.barracks < 1) fail('Build a barracks first.')
  const def = UNITS[unit]
  if (!def) fail('Unknown troop type.')
  const n = Math.floor(count)
  if (n < 1 || n > 500) fail('Train between 1 and 500 at a time.')
  if (p.trainQueue.length >= 3) fail('The barracks queue holds 3 batches.')
  const cap = troopCap(world, p)
  if (troopsUsed(world, p) + n * def.food > cap) fail(`Your farm feeds ${cap} troops. Raise it to train more.`)
  const cost = scaleCost(def.cost, n)
  if (!canAfford(p.res, cost)) fail('Not enough resources.')
  pay(p.res, cost)
  const startsAt = Math.max(t, p.trainQueue.at(-1)?.endsAt ?? t)
  p.trainQueue.push({ unit, count: n, startedAt: startsAt, endsAt: startsAt + trainTime(world, p, unit, n) })
}

export function finishTraining(ctx: Ctx, world: World, p: Player, t: number): void {
  const job = p.trainQueue.shift()
  if (!job) return
  p.home[job.unit] += job.count
  report(world, p.id, t, 'Troops trained', `${job.count} ${UNITS[job.unit].plural} joined your village.`)
  notify(ctx, world, [p.id], 'Troops trained', `${job.count} ${UNITS[job.unit].plural} are ready.`)
  const next = p.trainQueue[0]
  if (next && next.startedAt < t) {
    const length = next.endsAt - next.startedAt
    next.startedAt = t
    next.endsAt = t + length
  }
  if (totalUnits(p.home) >= 10 && p.tasks.train !== 'claimed') p.tasks.train = 'done'
}

// ---------- Wayfarer cards ----------

export function craftingSlots(p: Player): number {
  return cardSlots(p.buildings.obelisk)
}

export function assignCard(world: World, p: Player, cardId: string, building: BuildingKey | null, t: number): void {
  const card = p.cards[cardId]
  if (!card) fail('You don’t have that Wayfarer.')
  if (card.prisonUntil !== null) fail('That Wayfarer is in prison.')
  if (card.armyId) fail('That Wayfarer is leading an army.')
  if (building === null) {
    card.building = null
    return
  }
  if (!BUILDINGS[building]) fail('Unknown building.')
  if (p.buildings[building] < 1) fail('Build it first.')
  const others = Object.values(p.cards).filter((c) => c.cardId !== cardId && c.building)
  if (others.some((c) => c.building === building)) fail('Another Wayfarer already runs that building.')
  if (!card.building && others.length >= craftingSlots(p)) fail('No free crafting slot. Raise your Obelisk for more.')
  card.building = building
  if (p.tasks.assign !== 'claimed') p.tasks.assign = 'done'
  void world
  void t
}

export function hireCard(ctx: Ctx, world: World, p: Player, t: number): string {
  if (!p.founded) fail('Found your village first.')
  if (p.res.gold < HIRE_COST) fail(`Hiring costs ${HIRE_COST} gold. Raid the Forgotten for gold.`)
  const missing = CARDS.filter((c) => !p.cards[c.id])
  if (!missing.length) fail('You already have every Wayfarer.')
  const uncommon = missing.filter((c) => c.rarity === 'uncommon')
  const common = missing.filter((c) => c.rarity === 'common')
  const wantUncommon = uncommon.length > 0 && (common.length === 0 || random(world) < UNCOMMON_HIRE_CHANCE)
  const pool = wantUncommon ? uncommon : common
  const card = pool[Math.floor(random(world) * pool.length)]!
  p.res.gold -= HIRE_COST
  p.cards[card.id] = { cardId: card.id, building: null, armyId: null, prisonUntil: null }
  ctx.effects.push({ kind: 'grantCard', accountId: p.id, cardId: card.id })
  report(world, p.id, t, `${card.name} ${card.epithet} joins you`, `A ${card.rarity} Wayfarer answered your call. They stay in your collection for every world.`)
  return card.id
}

export function releaseCard(world: World, p: Player, cardId: string, t: number): void {
  const card = p.cards[cardId]
  if (!card || card.prisonUntil === null) fail('That Wayfarer isn’t in prison.')
  if (t < card.prisonUntil) fail('They can’t be bought out yet.')
  const def = CARD_BY_ID[cardId]!
  const cost = RELEASE_COST[def.rarity]
  if (p.res.gold < cost) fail(`Getting ${def.name} back costs ${cost} gold.`)
  p.res.gold -= cost
  card.prisonUntil = null
  void world
}

/** Add cards the account has collected elsewhere. */
export function syncCards(p: Player, cardIds: string[]): void {
  for (const id of cardIds) {
    if (!p.cards[id] && CARD_BY_ID[id]) p.cards[id] = { cardId: id, building: null, armyId: null, prisonUntil: null }
  }
}

// ---------- Starter tasks: "Unfinished business" ----------

export function updateTasks(world: World, p: Player): void {
  if (p.isAI) return
  const done = (id: string) => {
    if (p.tasks[id] !== 'claimed') p.tasks[id] = 'done'
  }
  if (p.founded) done('claim')
  if (p.buildings.lumber >= 2) done('lumber2')
  if (p.buildings.farm >= 2) done('farm2')
  if (p.buildings.obelisk >= 2) done('obelisk2')
  if (p.buildings.barracks >= 1) done('barracks')
  if (ownedRegions(world, p.id).length >= 2) done('region')
  if (p.houseId) done('house')
  for (const t of TASKS) if (!p.tasks[t.id]) p.tasks[t.id] = 'open'
}

export function claimTask(world: World, p: Player, taskId: string): void {
  const task = TASKS.find((x) => x.id === taskId)
  if (!task) fail('Unknown task.')
  if (p.tasks[taskId] !== 'done') fail(p.tasks[taskId] === 'claimed' ? 'Already claimed.' : 'Not done yet.')
  p.tasks[taskId] = 'claimed'
  addRes(world, p, task.reward)
}
