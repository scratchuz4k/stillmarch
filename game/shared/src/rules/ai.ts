// Simple AI Houses: they build, train, raid the Forgotten for gold and claim land nearby.
// They don't attack players yet.

import { AI_TICK, BUILDINGS, CLAIM_COST, UNITS, levelCap, regionCap } from '../data/balance.ts'
import type { BuildingKey, Player, World } from '../types.ts'
import { armySpeed, findPath, neighbours, sendArmy, settleFortress } from './armies.ts'
import { ownedRegions, troopCap, troopsUsed } from './economy.ts'
import { buildCost, plannedLevel, queueBuild, queueTraining } from './village.ts'
import { type Ctx, GameError } from './world.ts'
import { canAfford, dur, emptyUnits, scaleCost, totalUnits } from './util.ts'

const PRIORITY: BuildingKey[] = ['lumber', 'quarry', 'farm', 'mine', 'storehouse', 'obelisk', 'barracks', 'walls']

function attempt(fn: () => void): boolean {
  try {
    fn()
    return true
  } catch (e) {
    if (e instanceof GameError) return false
    throw e
  }
}

function aiBuild(world: World, p: Player, t: number): void {
  if (p.buildQueue.length) return
  let best: BuildingKey | null = null
  let bestScore = Infinity
  for (const b of PRIORITY) {
    const def = BUILDINGS[b]
    const next = plannedLevel(p, b) + 1
    if (next > def.maxLevel) continue
    if (b !== 'obelisk' && (p.buildings.obelisk < def.unlockObelisk || next > levelCap(b, p.buildings.obelisk))) continue
    const cost = buildCost(b, next)
    if (!canAfford(p.res, cost)) continue
    // Prefer low levels, and the Obelisk once everything else has caught up.
    const score = next + (b === 'obelisk' ? -1 : 0) + PRIORITY.indexOf(b) * 0.1
    if (score < bestScore) {
      bestScore = score
      best = b
    }
  }
  if (best) attempt(() => queueBuild(world, p, best, t))
}

function aiTrain(world: World, p: Player, t: number): void {
  if (p.buildings.barracks < 1 || p.trainQueue.length) return
  const room = troopCap(world, p) - troopsUsed(world, p)
  const unit = totalUnits(p.home) % 3 === 0 ? 'archers' : 'infantry'
  const n = Math.min(8, Math.floor(room / UNITS[unit].food))
  if (n < 1 || !canAfford(p.res, scaleCost(UNITS[unit].cost, n))) return
  attempt(() => queueTraining(world, p, unit, n, t))
}

function strengthOf(u: ReturnType<typeof emptyUnits>): number {
  return u.infantry * 10 + u.archers * 13 + u.cavalry * 16
}

function aiRaid(ctx: Ctx, world: World, p: Player, t: number): void {
  if (Object.values(world.armies).some((a) => a.ownerId === p.id)) return
  const home = world.regions[p.homeRegion]!
  const power = strengthOf(p.home)
  if (power < 200) return
  const speed = armySpeed(world, { units: p.home, ownerId: p.id, commander: null })
  let target: number | null = null
  let bestLen = Infinity
  for (const r of world.regions) {
    if (!r.fortress) continue
    settleFortress(world, r, t)
    if (strengthOf(r.fortress.garrison) * 1.6 > power) continue
    const path = findPath(world, home.id, r.id, speed)
    if (path && path.length < bestLen) {
      bestLen = path.length
      target = r.id
    }
  }
  if (target === null) return
  const units = { ...p.home, ram: 0 }
  const rations = Math.min(Math.floor(p.res.food), 40 * bestLen + 20)
  attempt(() => sendArmy(ctx, world, p.id, { units, rations, commander: null, order: 'charge', target: target!, mission: 'raid' }, t))
}

function aiClaim(ctx: Ctx, world: World, p: Player, t: number): void {
  const held = ownedRegions(world, p.id)
  if (held.length - 1 >= regionCap(p.buildings.obelisk)) return
  if (!canAfford(p.res, CLAIM_COST) || p.home.infantry < 6) return
  if (Object.values(world.armies).some((a) => a.ownerId === p.id && a.mission.kind === 'claim')) return
  const near = new Set<number>()
  for (const r of held) for (const n of neighbours(world, r.id)) near.add(n)
  const target = [...near].map((id) => world.regions[id]!).find((r) => r.kind === 'open' && !r.ownerId && !r.villageOf)
  if (!target) return
  const units = { ...emptyUnits(), infantry: 5 }
  attempt(() => sendArmy(ctx, world, p.id, { units, rations: Math.min(Math.floor(p.res.food), 60), commander: null, order: 'hold', target: target.id, mission: 'claim' }, t))
}

export function aiTick(ctx: Ctx, world: World, t: number): void {
  for (const p of Object.values(world.players)) {
    if (!p.isAI || p.eliminated || !p.founded) continue
    aiBuild(world, p, t)
    aiTrain(world, p, t)
    aiClaim(ctx, world, p, t)
    aiRaid(ctx, world, p, t)
  }
  world.aiNextAt = t + dur(world, AI_TICK)
}
