// The whole state of one world, as plain serialisable data.
// Every timestamp is a world-clock time in milliseconds (real time plus the world's dev offset).

export type ResKey = 'wood' | 'stone' | 'iron' | 'food' | 'gold'
export type Res = Record<ResKey, number>

export type BuildingKey =
  | 'obelisk'
  | 'lumber'
  | 'quarry'
  | 'mine'
  | 'farm'
  | 'storehouse'
  | 'walls'
  | 'barracks'

export type UnitKey = 'infantry' | 'archers' | 'cavalry' | 'ram'
export type Units = Record<UnitKey, number>

/** A standing order: what an army does every battle round. */
export type Order = 'hold' | 'charge' | 'volley' | 'fallback'

export type Terrain = 'plains' | 'forest' | 'hills' | 'mountains'
export type RegionKind = 'open' | 'fortress' | 'blight'
export type Quarter = 'Northreach' | 'Heartland' | 'Eastwood' | 'Southmere'

export type RegionBonus =
  | { kind: 'production'; res: 'wood' | 'stone' | 'iron' | 'food'; pct: number }
  | { kind: 'troopCap'; amount: number }
  | { kind: 'march'; pct: number }

export interface Fortress {
  level: 1 | 2 | 3
  garrison: Units
  maxGarrison: Units
  /** When the garrison was last brought up to date (it regrows over time). */
  garrisonAt: number
}

export interface Region {
  id: number
  name: string
  x: number
  y: number
  kind: RegionKind
  terrain: Terrain
  quarter: Quarter
  /** A starting spot for a village (ring slots first, edge slots for late joiners). */
  slot: 'ring' | 'edge' | null
  bonus: RegionBonus | null
  ownerId: string | null
  /** Set when a player's village stands here. */
  villageOf: string | null
  fortress: Fortress | null
}

export interface Road {
  a: number
  b: number
  length: number
  river: boolean
}

export interface BuildJob {
  building: BuildingKey
  toLevel: number
  startedAt: number
  endsAt: number
}

export interface TrainJob {
  unit: UnitKey
  count: number
  startedAt: number
  endsAt: number
}

/** A Wayfarer card as it stands in one world. */
export interface CardState {
  cardId: string
  /** Crafting slot: the building this Wayfarer runs. */
  building: BuildingKey | null
  /** Combat slot: the army this Wayfarer leads. */
  armyId: string | null
  /** Set while captured: the card is in prison until this time, then needs gold to come back. */
  prisonUntil: number | null
}

export type TaskState = 'open' | 'done' | 'claimed'

export interface RoundLog {
  round: number
  attackerOrder: Order
  defenderOrder: Order
  attackerLosses: Units
  defenderLosses: Units
  wallLevel?: number
  note?: string
}

export interface BattleLog {
  kind: 'skirmish' | 'raid' | 'siege'
  regionId: number
  attackerNames: string[]
  defenderNames: string[]
  attackerStart: Units
  defenderStart: Units
  attackerEnd: Units
  defenderEnd: Units
  rounds: RoundLog[]
  winner: 'attacker' | 'defender'
  loot?: Partial<Res>
  captured?: string[]
}

export interface Report {
  id: string
  at: number
  title: string
  text: string
  battle?: BattleLog
  read: boolean
}

export interface Player {
  id: string
  name: string
  isAI: boolean
  joinedAt: number
  homeRegion: number
  /** False until the player claims the dormant Obelisk they start at. */
  founded: boolean
  eliminated: boolean
  houseId: string | null
  /** When the player last joined a House: switching again has a cooldown. */
  houseJoinedAt: number | null
  protectionUntil: number
  res: Res
  resAt: number
  buildings: Record<BuildingKey, number>
  buildQueue: BuildJob[]
  trainQueue: TrainJob[]
  /** Troops at home in the village. */
  home: Units
  /** The order the village's home troops follow when defending. */
  homeOrder: Order
  cards: Record<string, CardState>
  tasks: Record<string, TaskState>
  reports: Report[]
}

export type Mission =
  | { kind: 'move' }
  | { kind: 'claim'; endsAt: number | null }
  | { kind: 'raid' }
  | { kind: 'siege'; warId: string }
  | { kind: 'return' }

export interface Army {
  id: string
  ownerId: string
  units: Units
  commander: string | null
  /** The region the army is at, or is leaving if it's on a road. */
  at: number
  /** Regions still to go through; the first one is the one it's marching to. */
  path: number[]
  departedAt: number | null
  arriveAt: number | null
  /** The final destination and what to do there. */
  target: number
  mission: Mission
  order: Order
  rations: number
  /** When the rations were last brought up to date. */
  rationsAt: number
  /** Set once the rations run out; the army loses troops every world-hour after this. */
  starvingSince: number | null
  nextStarveAt: number | null
  loot: Res
  /** Locked into a battle: can't move until it ends. */
  battleId: string | null
}

export interface House {
  id: string
  name: string
  tag: string
  leaderId: string
  officers: string[]
  members: string[]
  createdAt: number
  allies: { houseId: string; since: number }[]
  /** Houses that have proposed an alliance to this one. */
  allyOffers: string[]
}

export interface Battle {
  id: string
  warId: string
  regionId: number
  startedAt: number
  round: number
  nextRoundAt: number
  attackerArmies: string[]
  defenderArmies: string[]
  /** Whether the defending village's home troops fight. */
  homeDefends: boolean
  wallLevel: number
  log: RoundLog[]
  attackerStart: Units
  defenderStart: Units
}

export interface War {
  id: string
  attackerId: string
  attackerHouseId: string | null
  defenderId: string
  defenderHouseId: string | null
  regionId: number
  /** Whether the target is the defender's village (losing it knocks them out). */
  village: boolean
  declaredAt: number
  startsAt: number
  state: 'declared' | 'fighting' | 'done'
  battleId: string | null
  result: 'attacker' | 'defender' | 'fizzled' | null
}

export interface ChatMessage {
  id: string
  at: number
  fromId: string
  fromName: string
  /** 'world', or a House id for House chat. */
  channel: string
  text: string
}

export type BattleWindow = 'always' | { start: string; end: string; tz: string }

export interface WorldConfig {
  name: string
  seed: number
  speed: number
  maxPlayers: number
  regions: number
  aiHouses: number
  battleWindow: BattleWindow
  /** Dev cheats (finish builds, add resources, skip time) allowed. */
  dev: boolean
}

export interface World {
  version: 1
  id: string
  config: WorldConfig
  createdAt: number
  /** Added to real time to get world time; the "skip time" cheat moves it forward. */
  clockOffset: number
  /** The world time the rules were last brought up to. */
  time: number
  nextId: number
  rng: number
  regions: Region[]
  roads: Road[]
  river: { x: number; y: number }[]
  players: Record<string, Player>
  armies: Record<string, Army>
  houses: Record<string, House>
  wars: Record<string, War>
  battles: Record<string, Battle>
  chat: ChatMessage[]
  aiNextAt: number
}

/** Something worth telling players about, outside the game (push notifications). */
export interface Notice {
  to: string[]
  title: string
  body: string
}

/** Something that has to happen outside the world state (on the account). */
export interface Effect {
  kind: 'grantCard'
  accountId: string
  cardId: string
}
