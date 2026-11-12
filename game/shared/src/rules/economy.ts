// Resources, production, storage, troop cap and Wayfarer bonuses.

import {
  BUILDINGS,
  PRODUCTION,
  STAT_BONUS,
  UNITS,
  farmTroopCap,
  productionPerHour,
  storageCap,
} from '../data/balance.ts'
import { CARD_BY_ID } from '../data/cards.ts'
import type { BuildingKey, Player, Res, ResKey, World } from '../types.ts'
import { UNIT_KEYS, totalUnits, worldHours } from './util.ts'

/** Extra share from the Wayfarer running a building (Craft stat plus a matching trait). */
export function craftBonus(player: Player, building: BuildingKey, trait?: string): number {
  for (const c of Object.values(player.cards)) {
    if (c.building !== building || c.prisonUntil !== null) continue
    const def = CARD_BY_ID[c.cardId]
    if (!def) continue
    let bonus = def.craft * STAT_BONUS
    if (trait && def.trait.kind === trait) bonus += def.trait.pct / 100
    return bonus
  }
  return 0
}

export function ownedRegions(world: World, playerId: string) {
  return world.regions.filter((r) => r.ownerId === playerId)
}

/** Production per world-hour of each resource (gold isn't produced). */
export function productionRates(world: World, player: Player): Res {
  const rates: Res = { wood: 0, stone: 0, iron: 0, food: 0, gold: 0 }
  if (!player.founded || player.eliminated) return rates
  const regions = ownedRegions(world, player.id)
  for (const [building, res] of Object.entries(PRODUCTION) as [keyof typeof PRODUCTION, ResKey][]) {
    let rate = productionPerHour(player.buildings[building])
    let pct = craftBonus(player, building, 'production')
    for (const r of regions) {
      if (r.bonus?.kind === 'production' && r.bonus.res === res) pct += r.bonus.pct / 100
    }
    rate *= 1 + pct
    rates[res] = rate
  }
  return rates
}

export function storageOf(player: Player): number {
  return Math.round(storageCap(player.buildings.storehouse) * (1 + craftBonus(player, 'storehouse')))
}

export function troopCap(world: World, player: Player): number {
  let cap = farmTroopCap(player.buildings.farm)
  for (const r of ownedRegions(world, player.id)) {
    if (r.bonus?.kind === 'troopCap') cap += r.bonus.amount
  }
  return cap
}

/** Food points used by all of a player's troops: at home, in armies and in training. */
export function troopsUsed(world: World, player: Player): number {
  let used = 0
  const add = (unit: keyof typeof UNITS, n: number) => {
    used += UNITS[unit].food * n
  }
  for (const k of UNIT_KEYS) add(k, player.home[k])
  for (const a of Object.values(world.armies)) {
    if (a.ownerId !== player.id) continue
    for (const k of UNIT_KEYS) add(k, a.units[k])
  }
  for (const job of player.trainQueue) add(job.unit, job.count)
  return used
}

/** Bring a player's stock up to time t. */
export function settlePlayer(world: World, player: Player, t: number): void {
  if (t <= player.resAt) return
  const hours = worldHours(world, t - player.resAt)
  const rates = productionRates(world, player)
  const cap = storageOf(player)
  for (const k of ['wood', 'stone', 'iron', 'food'] as const) {
    if (player.res[k] >= cap) continue
    player.res[k] = Math.min(cap, player.res[k] + rates[k] * hours)
  }
  player.resAt = t
}

export function addRes(world: World, player: Player, gain: Partial<Res>): void {
  const cap = storageOf(player)
  for (const k of ['wood', 'stone', 'iron', 'food'] as const) {
    const v = gain[k]
    if (v) player.res[k] = Math.min(Math.max(cap, player.res[k]), player.res[k] + v)
  }
  if (gain.gold) player.res.gold += gain.gold
  void world
}

export function homeUnitsTotal(player: Player): number {
  return totalUnits(player.home)
}

export function buildingName(b: BuildingKey): string {
  return BUILDINGS[b].name
}
