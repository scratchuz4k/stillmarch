// Every number in the game. All of them are placeholders until playtested.
// Durations are in world-seconds at world speed x1; the world speed divides them.

import type { BuildingKey, Order, Res, ResKey, Terrain, UnitKey } from '../types.ts'

export const HOUR = 3600
export const DAY = 24 * HOUR

export interface BuildingDef {
  name: string
  blurb: string
  maxLevel: number
  /** Obelisk level needed before the first level can be built. */
  unlockObelisk: number
  baseCost: Partial<Res>
  costGrowth: number
  baseTime: number
  timeGrowth: number
}

export const BUILDINGS: Record<BuildingKey, BuildingDef> = {
  obelisk: {
    name: 'Obelisk',
    blurb: 'The heart of the region. Its level unlocks buildings, Wayfarer slots and how many regions you can hold.',
    maxLevel: 4,
    unlockObelisk: 0,
    baseCost: { wood: 400, stone: 500 },
    costGrowth: 3,
    baseTime: 600,
    timeGrowth: 3.2,
  },
  lumber: {
    name: 'Lumber camp',
    blurb: 'Produces wood.',
    maxLevel: 10,
    unlockObelisk: 1,
    baseCost: { wood: 50, stone: 40 },
    costGrowth: 1.5,
    baseTime: 30,
    timeGrowth: 1.6,
  },
  quarry: {
    name: 'Quarry',
    blurb: 'Produces stone.',
    maxLevel: 10,
    unlockObelisk: 1,
    baseCost: { wood: 60, stone: 30 },
    costGrowth: 1.5,
    baseTime: 30,
    timeGrowth: 1.6,
  },
  mine: {
    name: 'Mine',
    blurb: 'Produces iron.',
    maxLevel: 10,
    unlockObelisk: 1,
    baseCost: { wood: 70, stone: 60 },
    costGrowth: 1.5,
    baseTime: 40,
    timeGrowth: 1.6,
  },
  farm: {
    name: 'Farm',
    blurb: 'Produces food for rations. Its level sets how many troops you can have.',
    maxLevel: 10,
    unlockObelisk: 1,
    baseCost: { wood: 60, stone: 50 },
    costGrowth: 1.5,
    baseTime: 40,
    timeGrowth: 1.6,
  },
  storehouse: {
    name: 'Storehouse',
    blurb: 'Raises how much wood, stone, iron and food you can hold.',
    maxLevel: 10,
    unlockObelisk: 1,
    baseCost: { wood: 80, stone: 80 },
    costGrowth: 1.5,
    baseTime: 45,
    timeGrowth: 1.6,
  },
  walls: {
    name: 'Walls',
    blurb: 'Every level makes your home troops stronger in defence. Rams wear them down.',
    maxLevel: 10,
    unlockObelisk: 2,
    baseCost: { wood: 100, stone: 200 },
    costGrowth: 1.55,
    baseTime: 120,
    timeGrowth: 1.6,
  },
  barracks: {
    name: 'Barracks',
    blurb: 'Trains troops. Higher levels train faster.',
    maxLevel: 5,
    unlockObelisk: 2,
    baseCost: { wood: 200, stone: 150, iron: 50 },
    costGrowth: 1.8,
    baseTime: 180,
    timeGrowth: 1.8,
  },
}

export const BUILDING_ORDER: BuildingKey[] = [
  'obelisk',
  'lumber',
  'quarry',
  'mine',
  'farm',
  'storehouse',
  'barracks',
  'walls',
]

/** A building can't go higher than this for a given Obelisk level. */
export function levelCap(building: BuildingKey, obelisk: number): number {
  const def = BUILDINGS[building]
  if (building === 'obelisk') return def.maxLevel
  return Math.min(def.maxLevel, obelisk * 3 - (obelisk === 4 ? 2 : 0))
}

export const BUILD_QUEUE_LENGTH = 2

export const PRODUCTION: Record<'lumber' | 'quarry' | 'mine' | 'farm', ResKey> = {
  lumber: 'wood',
  quarry: 'stone',
  mine: 'iron',
  farm: 'food',
}

/** Production per world-hour at a building level. Level 0 still gives a small trickle. */
export function productionPerHour(level: number): number {
  if (level <= 0) return 10
  return Math.round(30 * level * Math.pow(1.18, level - 1))
}

/** How much wood, stone, iron and food the storehouse holds. Gold has no cap. */
export function storageCap(level: number): number {
  return Math.round(1000 * Math.pow(1.35, level))
}

/** Troop cap from the farm level, before region bonuses. */
export function farmTroopCap(level: number): number {
  return 20 + 30 * level + 4 * level * level
}

export interface UnitDef {
  name: string
  plural: string
  attack: number
  defence: number
  /** Map units per world-hour. */
  speed: number
  carry: number
  food: number
  cost: Partial<Res>
  trainTime: number
  /** Deals extra damage against this unit type. */
  strongVs: UnitKey | null
}

export const UNITS: Record<UnitKey, UnitDef> = {
  infantry: {
    name: 'Infantry',
    plural: 'infantry',
    attack: 10,
    defence: 16,
    speed: 40,
    carry: 25,
    food: 1,
    cost: { wood: 30, iron: 20 },
    trainTime: 40,
    strongVs: 'cavalry',
  },
  archers: {
    name: 'Archers',
    plural: 'archers',
    attack: 13,
    defence: 9,
    speed: 40,
    carry: 15,
    food: 1,
    cost: { wood: 45, iron: 10 },
    trainTime: 45,
    strongVs: 'infantry',
  },
  cavalry: {
    name: 'Cavalry',
    plural: 'cavalry',
    attack: 16,
    defence: 11,
    speed: 70,
    carry: 60,
    food: 2,
    cost: { wood: 40, iron: 60 },
    trainTime: 80,
    strongVs: 'archers',
  },
  ram: {
    name: 'Ram',
    plural: 'rams',
    attack: 2,
    defence: 6,
    speed: 25,
    carry: 0,
    food: 3,
    cost: { wood: 150, iron: 40 },
    trainTime: 150,
    strongVs: null,
  },
}

export const UNIT_ORDER: UnitKey[] = ['infantry', 'archers', 'cavalry', 'ram']

export const COUNTER_BONUS = 1.5

/** Barracks level speeds up training. */
export function trainSpeedFactor(barracks: number): number {
  return Math.max(0.4, 1 - 0.12 * (barracks - 1))
}

export interface OrderDef {
  name: string
  blurb: string
  attack: number
  defence: number
}

export const ORDERS: Record<Order, OrderDef> = {
  hold: {
    name: 'Hold',
    blurb: 'Stand firm: take less damage, deal less.',
    attack: 0.8,
    defence: 1.25,
  },
  charge: {
    name: 'Charge',
    blurb: 'All in: deal more damage, take more.',
    attack: 1.3,
    defence: 0.85,
  },
  volley: {
    name: 'Volley',
    blurb: 'Archers fire at full strength; melee holds back.',
    attack: 1,
    defence: 1,
  },
  fallback: {
    name: 'Fall back',
    blurb: 'Fight carefully and pull out if the enemy is more than twice as strong.',
    attack: 0.9,
    defence: 1.1,
  },
}

export const VOLLEY_ARCHERS = 1.5
export const VOLLEY_MELEE = 0.8
/** Damage per round, as a share of attack. Lower means longer battles. */
export const ROUND_FACTOR = 0.35
export const WALL_DEFENCE_PER_LEVEL = 0.1
/** Rams needed to knock one wall level down per round. */
export const RAMS_PER_WALL_LEVEL = 6

export const SIEGE_ROUNDS = 5
export const SIEGE_ROUND_TIME = 10 * 60
export const SKIRMISH_ROUNDS = 3
export const RAID_ROUNDS = 3

/** A siege has to be declared at least this long before it starts. */
export const SIEGE_LEAD = DAY

export const TERRAIN_MARCH: Record<Terrain, number> = {
  plains: 1,
  forest: 1.25,
  hills: 1.25,
  mountains: 1.5,
}
export const RIVER_MARCH = 1.5

/** Food per troop food point per world-hour in the field. */
export const RATIONS_PER_HOUR = 0.25
/** Foraging in unclaimed land: the army eats this share of its normal rations. */
export const FORAGE_FACTOR = 0.5
/** When starving, the army loses this share of its troops every world-hour. */
export const STARVE_LOSS = 0.08

export const CLAIM_TIME = 30 * 60
export const CLAIM_COST: Partial<Res> = { wood: 200, stone: 200 }

export const PROTECTION = 3 * DAY
export const JOIN_WINDOW = 7 * DAY
/** Players joining after this get an edge spot and a catch-up boost. */
export const LATE_JOIN_AFTER = DAY

export const START_RES: Res = { wood: 500, stone: 500, iron: 300, food: 400, gold: 0 }
export const CATCH_UP_PER_DAY: Partial<Res> = { wood: 600, stone: 600, iron: 400, food: 400 }

export const HOUSE_SWITCH_COOLDOWN = 3 * DAY
export const ALLY_WIN_AGE = 3 * DAY

export function houseMemberLimit(maxPlayers: number): number {
  return Math.max(3, Math.ceil(maxPlayers / 4))
}

/** A House and all its allies together can't have more members than this. */
export function allianceLimit(maxPlayers: number): number {
  return Math.max(4, Math.ceil(maxPlayers / 3))
}

export const PRISON_TIME = 3 * DAY
export const RELEASE_COST = { common: 100, uncommon: 250 } as const
export const HIRE_COST = 200
export const UNCOMMON_HIRE_CHANCE = 0.25
/** Each stat point is worth this much, as a share (so 10 points = +25%). */
export const STAT_BONUS = 0.025

/** Wayfarer slots of each kind (crafting, combat) per Obelisk level. */
export function cardSlots(obelisk: number): number {
  return Math.max(1, obelisk)
}

/** How many regions you can hold besides your home region. */
export function regionCap(obelisk: number): number {
  return obelisk
}

export const FORTRESS: Record<1 | 2 | 3, { garrison: { infantry: number; archers: number; cavalry: number }; gold: number; food: number }> = {
  1: { garrison: { infantry: 18, archers: 10, cavalry: 0 }, gold: 150, food: 150 },
  2: { garrison: { infantry: 50, archers: 30, cavalry: 12 }, gold: 400, food: 350 },
  3: { garrison: { infantry: 110, archers: 70, cavalry: 35 }, gold: 900, food: 700 },
}
/** Share of a fortress's full garrison that grows back per world-hour. */
export const FORTRESS_REGEN = 0.1

export const AI_TICK = 10 * 60
