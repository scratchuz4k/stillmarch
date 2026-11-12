// Creating a world, joining it, and the helpers every other rule uses.

import {
  CATCH_UP_PER_DAY,
  DAY,
  JOIN_WINDOW,
  LATE_JOIN_AFTER,
  PROTECTION,
  START_RES,
  houseMemberLimit,
} from '../data/balance.ts'
import type { BuildingKey, Notice, Effect, Player, Report, BattleLog, World, WorldConfig } from '../types.ts'
import { generateMap } from './mapgen.ts'
import { dur, emptyUnits, newId } from './util.ts'

export class GameError extends Error {}

export function fail(message: string): never {
  throw new GameError(message)
}

export interface Ctx {
  notices: Notice[]
  effects: Effect[]
  /** How many timed events were handled (0 means nothing happened). */
  events: number
}

export function newCtx(): Ctx {
  return { notices: [], effects: [], events: 0 }
}

export const DEFAULT_CONFIG: WorldConfig = {
  name: 'Valdris',
  seed: 1,
  speed: 1,
  maxPlayers: 20,
  regions: 50,
  aiHouses: 2,
  battleWindow: { start: '16:30', end: '22:30', tz: 'Europe/Berlin' },
  dev: false,
}

const AI_NAMES = [
  { name: 'Varn', house: 'House Varn', tag: 'VRN' },
  { name: 'Odile', house: 'House Odile', tag: 'ODL' },
  { name: 'Mortain', house: 'House Mortain', tag: 'MRT' },
]

export function createWorld(id: string, config: Partial<WorldConfig>, t: number): World {
  const cfg: WorldConfig = { ...DEFAULT_CONFIG, ...config }
  const slots = cfg.maxPlayers + cfg.aiHouses
  const map = generateMap(cfg.seed, Math.max(cfg.regions, slots + 16), slots)
  const world: World = {
    version: 1,
    id,
    config: cfg,
    createdAt: t,
    clockOffset: 0,
    time: t,
    nextId: 0,
    rng: cfg.seed ^ 0x5eed,
    regions: map.regions,
    roads: map.roads,
    river: map.river,
    players: {},
    armies: {},
    houses: {},
    wars: {},
    battles: {},
    chat: [],
    aiNextAt: t,
  }
  for (const r of world.regions) if (r.fortress) r.fortress.garrisonAt = t
  for (let i = 0; i < cfg.aiHouses && i < AI_NAMES.length; i++) {
    const ai = AI_NAMES[i]!
    const p = addPlayer(world, `ai-${i + 1}`, ai.name, true, [], t)
    foundVillage(world, p, t)
    p.protectionUntil = 0
    const houseId = newId(world, 'h')
    world.houses[houseId] = {
      id: houseId,
      name: ai.house,
      tag: ai.tag,
      leaderId: p.id,
      officers: [],
      members: [p.id],
      createdAt: t,
      allies: [],
      allyOffers: [],
    }
    p.houseId = houseId
    p.houseJoinedAt = t
  }
  return world
}

function freshBuildings(): Record<BuildingKey, number> {
  return { obelisk: 0, lumber: 0, quarry: 0, mine: 0, farm: 0, storehouse: 0, walls: 0, barracks: 0 }
}

function pickSlot(world: World, late: boolean): number {
  const villages = world.regions.filter((r) => r.villageOf)
  const free = (kind: 'ring' | 'edge') => world.regions.filter((r) => r.slot === kind && !r.villageOf && !r.ownerId)
  let options = free(late ? 'edge' : 'ring')
  if (!options.length) options = free(late ? 'ring' : 'edge')
  if (!options.length) options = world.regions.filter((r) => r.kind === 'open' && !r.villageOf && !r.ownerId)
  if (!options.length) fail('There is no free land left in this world.')
  // The spot furthest from every existing village.
  let best = options[0]!
  let bestD = -1
  for (const r of options) {
    const d = villages.length ? Math.min(...villages.map((v) => Math.hypot(v.x - r.x, v.y - r.y))) : 0
    if (d > bestD) {
      bestD = d
      best = r
    }
  }
  return best.id
}

export function joinOpenUntil(world: World): number {
  return world.createdAt + dur(world, JOIN_WINDOW)
}

function addPlayer(world: World, id: string, name: string, isAI: boolean, cardIds: string[], t: number): Player {
  const late = t > world.createdAt + dur(world, LATE_JOIN_AFTER)
  const home = pickSlot(world, late)
  const res = { ...START_RES }
  if (late) {
    const days = (t - world.createdAt) / dur(world, DAY)
    for (const [k, v] of Object.entries(CATCH_UP_PER_DAY) as [keyof typeof res, number][]) res[k] += Math.round(v * days)
  }
  const player: Player = {
    id,
    name,
    isAI,
    joinedAt: t,
    homeRegion: home,
    founded: false,
    eliminated: false,
    houseId: null,
    houseJoinedAt: null,
    protectionUntil: 0,
    res,
    resAt: t,
    buildings: freshBuildings(),
    buildQueue: [],
    trainQueue: [],
    home: emptyUnits(),
    homeOrder: 'hold',
    cards: {},
    tasks: {},
    reports: [],
  }
  for (const c of cardIds) player.cards[c] = { cardId: c, building: null, armyId: null, prisonUntil: null }
  world.players[id] = player
  world.regions[home]!.villageOf = id
  return player
}

export function joinWorld(world: World, accountId: string, name: string, cardIds: string[], t: number): Player {
  if (world.players[accountId]) fail('You are already in this world.')
  if (t > joinOpenUntil(world)) fail('This world is closed to new players.')
  const humans = Object.values(world.players).filter((p) => !p.isAI).length
  if (humans >= world.config.maxPlayers) fail('This world is full.')
  const p = addPlayer(world, accountId, name, false, cardIds, t)
  report(world, p.id, t, 'You have arrived', `You stand at a dormant Obelisk in ${world.regions[p.homeRegion]!.name}. Claim it to found your village.`)
  return p
}

export function foundVillage(world: World, p: Player, t: number): void {
  if (p.founded) fail('Your village already stands.')
  const region = world.regions[p.homeRegion]!
  region.ownerId = p.id
  region.villageOf = p.id
  p.founded = true
  p.buildings.obelisk = 1
  p.resAt = t
  p.protectionUntil = t + dur(world, PROTECTION)
}

export function player(world: World, id: string): Player {
  const p = world.players[id]
  if (!p) fail('You are not in this world.')
  return p
}

export function alliedHouses(world: World, a: string | null, b: string | null): boolean {
  if (!a || !b) return false
  if (a === b) return true
  return world.houses[a]?.allies.some((x) => x.houseId === b) ?? false
}

/** Same player, same House, or allied Houses. */
export function sameSide(world: World, a: string, b: string): boolean {
  if (a === b) return true
  const pa = world.players[a]
  const pb = world.players[b]
  if (!pa || !pb) return false
  return alliedHouses(world, pa.houseId, pb.houseId)
}

export function isProtected(world: World, playerId: string, t: number): boolean {
  const p = world.players[playerId]
  return !!p && t < p.protectionUntil
}

/** Can armies of these two players fight each other? */
export function hostile(world: World, a: string, b: string, t: number): boolean {
  if (sameSide(world, a, b)) return false
  if (world.players[a]?.eliminated || world.players[b]?.eliminated) return false
  return !isProtected(world, a, t) && !isProtected(world, b, t)
}

/** Attacking another player ends your own beginner protection. */
export function endProtection(p: Player, t: number): void {
  if (p.protectionUntil > t) p.protectionUntil = t
}

export function report(world: World, playerId: string, t: number, title: string, text: string, battle?: BattleLog): void {
  const p = world.players[playerId]
  if (!p || p.isAI) return
  const r: Report = { id: newId(world, 'r'), at: t, title, text, read: false }
  if (battle) r.battle = battle
  p.reports.unshift(r)
  if (p.reports.length > 60) p.reports.length = 60
}

export function notify(ctx: Ctx, world: World, to: string[], title: string, body: string): void {
  const humans = to.filter((id) => world.players[id] && !world.players[id]!.isAI)
  if (humans.length) ctx.notices.push({ to: humans, title, body })
}

export function memberLimit(world: World): number {
  return houseMemberLimit(world.config.maxPlayers)
}

/** Everyone on a player's side: their House members and allied Houses' members. */
export function sideMembers(world: World, playerId: string): string[] {
  const p = world.players[playerId]
  if (!p) return []
  if (!p.houseId) return [playerId]
  const house = world.houses[p.houseId]
  if (!house) return [playerId]
  const ids = new Set(house.members)
  for (const a of house.allies) for (const m of world.houses[a.houseId]?.members ?? []) ids.add(m)
  return [...ids]
}
