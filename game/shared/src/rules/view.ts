// What one player is allowed to see of the world. The client only ever gets this.

import { BUILDINGS, HIRE_COST, RELEASE_COST, allianceLimit, regionCap } from '../data/balance.ts'
import { CARD_BY_ID } from '../data/cards.ts'
import type {
  Army,
  Battle,
  ChatMessage,
  House,
  Mission,
  Player,
  Region,
  Res,
  Road,
  War,
  World,
} from '../types.ts'
import { combatSlots, neighbours, rationRate, settleFortress } from './armies.ts'
import { ownedRegions, productionRates, storageOf, troopCap, troopsUsed } from './economy.ts'
import { craftingSlots } from './village.ts'
import { joinOpenUntil, memberLimit, sameSide } from './world.ts'
import { describeWindow, roughSize, totalUnits, windowOpen } from './util.ts'

export interface PublicPlayer {
  id: string
  name: string
  isAI: boolean
  houseId: string | null
  eliminated: boolean
  village: number | null
  regions: number
  protectedUntil: number
}

export interface OtherArmy {
  id: string
  ownerId: string
  at: number
  next: number | null
  departedAt: number | null
  arriveAt: number | null
  size: string
  /** Only shown for marches to a declared siege. */
  siegeWarId: string | null
}

export interface MyArmy extends Army {
  rationRate: number
  own: boolean
}

export interface RegionView extends Omit<Region, 'fortress'> {
  fortress: { level: number; size: string } | null
}

export interface PlayerView {
  now: number
  worldId: string
  worldName: string
  speed: number
  dev: boolean
  window: string
  windowOpen: boolean
  joinOpenUntil: number
  maxPlayers: number
  houseMemberLimit: number
  allianceLimit: number
  me: Player & {
    rates: Res
    storage: number
    troopCap: number
    troopsUsed: number
    craftingSlots: number
    combatSlots: number
    regionCap: number
    regionsHeld: number
  }
  regions: RegionView[]
  roads: Road[]
  river: { x: number; y: number }[]
  players: PublicPlayer[]
  houses: House[]
  armies: MyArmy[]
  others: OtherArmy[]
  wars: War[]
  battles: Battle[]
  chat: ChatMessage[]
  prices: { hire: number; release: typeof RELEASE_COST }
}

function visibleMission(m: Mission): string | null {
  return m.kind === 'siege' ? m.warId : null
}

export function viewFor(world: World, playerId: string): PlayerView {
  const t = world.time
  const me = world.players[playerId]!
  const out = me.eliminated
  const mine = new Set(ownedRegions(world, playerId).map((r) => r.id))
  const near = new Set<number>(mine)
  for (const id of mine) for (const n of neighbours(world, id)) near.add(n)

  const armies: MyArmy[] = []
  const others: OtherArmy[] = []
  if (!out) {
    const myWars = Object.values(world.wars).filter((w) =>
      w.state !== 'done' && (sameSide(world, playerId, w.attackerId) || sameSide(world, playerId, w.defenderId)))
    const warIds = new Set(myWars.map((w) => w.id))
    const warRegions = new Set(myWars.map((w) => w.regionId))
    for (const a of Object.values(world.armies)) {
      if (sameSide(world, playerId, a.ownerId)) {
        armies.push({ ...structuredClone(a), rationRate: rationRate(world, a), own: a.ownerId === playerId })
        continue
      }
      const next = a.arriveAt !== null ? (a.path[0] ?? null) : null
      const siegeWar = a.mission.kind === 'siege' && warIds.has(a.mission.warId)
      const seen = near.has(a.at) || (next !== null && near.has(next)) || siegeWar ||
        (warRegions.has(a.at) && a.arriveAt === null) || (a.battleId !== null && warRegions.has(a.at))
      if (!seen) continue
      others.push({
        id: a.id,
        ownerId: a.ownerId,
        at: a.at,
        next,
        departedAt: a.departedAt,
        arriveAt: a.arriveAt,
        size: roughSize(totalUnits(a.units)),
        siegeWarId: siegeWar ? visibleMission(a.mission) : null,
      })
    }
  }

  const regions: RegionView[] = world.regions.map((r) => {
    if (r.fortress) settleFortress(world, r, t)
    const { fortress, ...rest } = r
    return { ...rest, fortress: fortress ? { level: fortress.level, size: roughSize(totalUnits(fortress.garrison)) } : null }
  })

  const players: PublicPlayer[] = Object.values(world.players).map((p) => ({
    id: p.id,
    name: p.name,
    isAI: p.isAI,
    houseId: p.houseId,
    eliminated: p.eliminated,
    village: p.founded && !p.eliminated ? p.homeRegion : null,
    regions: ownedRegions(world, p.id).length,
    protectedUntil: p.protectionUntil,
  }))

  const chat = world.chat.filter((m) => m.channel === 'world' || (me.houseId && m.channel === me.houseId)).slice(-120)

  return {
    now: t,
    worldId: world.id,
    worldName: world.config.name,
    speed: world.config.speed,
    dev: world.config.dev,
    window: describeWindow(world.config.battleWindow),
    windowOpen: windowOpen(world.config.battleWindow, t),
    joinOpenUntil: joinOpenUntil(world),
    maxPlayers: world.config.maxPlayers,
    houseMemberLimit: memberLimit(world),
    allianceLimit: allianceLimit(world.config.maxPlayers),
    me: {
      ...structuredClone(me),
      rates: productionRates(world, me),
      storage: storageOf(me),
      troopCap: troopCap(world, me),
      troopsUsed: troopsUsed(world, me),
      craftingSlots: craftingSlots(me),
      combatSlots: combatSlots(me),
      regionCap: regionCap(me.buildings.obelisk),
      regionsHeld: Math.max(0, mine.size - (me.founded && !out ? 1 : 0)),
    },
    regions,
    roads: world.roads,
    river: world.river,
    players,
    houses: structuredClone(Object.values(world.houses)),
    armies,
    others,
    wars: Object.values(world.wars).filter((w) => w.state !== 'done' || t - w.declaredAt < 7 * 24 * 3600 * 1000),
    battles: Object.values(world.battles),
    chat,
    prices: { hire: HIRE_COST, release: RELEASE_COST },
  }
}

export function cardName(id: string): string {
  const c = CARD_BY_ID[id]
  return c ? `${c.name} ${c.epithet}` : id
}

export function buildingLabel(key: keyof typeof BUILDINGS): string {
  return BUILDINGS[key].name
}
