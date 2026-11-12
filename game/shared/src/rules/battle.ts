// The battle resolver. A battle is fought in rounds; each side follows its standing order.
// Deterministic: the same armies and orders always give the same result.

import {
  COUNTER_BONUS,
  ORDERS,
  RAMS_PER_WALL_LEVEL,
  ROUND_FACTOR,
  STAT_BONUS,
  UNITS,
  VOLLEY_ARCHERS,
  VOLLEY_MELEE,
  WALL_DEFENCE_PER_LEVEL,
} from '../data/balance.ts'
import type { Order, RoundLog, UnitKey, Units } from '../types.ts'
import { UNIT_KEYS, emptyUnits, totalUnits } from './util.ts'

/** One army (or a village's home troops) taking part in a battle. */
export interface Force {
  id: string
  units: Units
  order: Order
  /** Share added to attack (commander Might, traits). */
  attackBonus: number
  /** Share added to defence. */
  defenceBonus: number
}

export interface Side {
  forces: Force[]
  /** Only the defending side of a village fight has walls. */
  wallLevel: number
}

function sideUnits(side: Side): Units {
  const u = emptyUnits()
  for (const f of side.forces) for (const k of UNIT_KEYS) u[k] += f.units[k]
  return u
}

/** The order a whole side follows this round: the order of its biggest force. */
export function sideOrder(side: Side): Order {
  let best: Force | null = null
  for (const f of side.forces) if (!best || totalUnits(f.units) > totalUnits(best.units)) best = f
  return best?.order ?? 'hold'
}

function attackPower(side: Side, enemy: Units): number {
  const enemyTotal = totalUnits(enemy)
  if (enemyTotal <= 0) return 0
  let power = 0
  for (const f of side.forces) {
    const order = ORDERS[f.order]
    for (const k of UNIT_KEYS) {
      const n = f.units[k]
      if (n <= 0) continue
      const def = UNITS[k]
      let mult = order.attack
      if (f.order === 'volley') mult = k === 'archers' ? VOLLEY_ARCHERS : VOLLEY_MELEE
      const counter = def.strongVs ? 1 + (COUNTER_BONUS - 1) * (enemy[def.strongVs] / enemyTotal) : 1
      power += n * def.attack * mult * counter * (1 + f.attackBonus)
    }
  }
  return power * ROUND_FACTOR
}

/** Spread damage over a side's troops by head count; tougher troops lose fewer. Returns losses per force. */
function applyDamage(side: Side, damage: number): Units[] {
  const units = sideUnits(side)
  const total = totalUnits(units)
  const losses = side.forces.map(() => emptyUnits())
  if (total <= 0 || damage <= 0) return losses
  const wall = 1 + WALL_DEFENCE_PER_LEVEL * side.wallLevel
  side.forces.forEach((f, fi) => {
    const order = ORDERS[f.order]
    for (const k of UNIT_KEYS) {
      const n = f.units[k]
      if (n <= 0) continue
      const share = (damage * n) / total
      const toughness = UNITS[k].defence * order.defence * wall * (1 + f.defenceBonus)
      const dead = Math.min(n, Math.round(share / toughness))
      losses[fi]![k] = dead
    }
  })
  return losses
}

function subtractLosses(side: Side, losses: Units[]): Units {
  const sum = emptyUnits()
  side.forces.forEach((f, i) => {
    const l = losses[i]!
    for (const k of UNIT_KEYS) {
      f.units[k] = Math.max(0, f.units[k] - l[k])
      sum[k] += l[k]
    }
  })
  return sum
}

function strength(side: Side, enemy: Side): number {
  return attackPower(side, sideUnits(enemy)) + totalUnits(sideUnits(side))
}

export interface RoundResult {
  log: RoundLog
  /** The battle is over after this round. */
  over: boolean
  /** Who pulled out, if anyone did. */
  withdrew: 'attacker' | 'defender' | null
}

/** Fight one round. Mutates the forces' units and the defending side's wall level. */
export function fightRound(round: number, attacker: Side, defender: Side): RoundResult {
  const aOrder = sideOrder(attacker)
  const dOrder = sideOrder(defender)
  let withdrew: RoundResult['withdrew'] = null
  let note: string | undefined

  // "Fall back" pulls a side out at the start of a round if the enemy is more than twice as strong.
  if (aOrder === 'fallback' && strength(defender, attacker) > 2 * strength(attacker, defender)) withdrew = 'attacker'
  else if (dOrder === 'fallback' && strength(attacker, defender) > 2 * strength(defender, attacker)) withdrew = 'defender'

  const aUnits = sideUnits(attacker)
  const dUnits = sideUnits(defender)
  let aDamage = attackPower(attacker, dUnits)
  let dDamage = attackPower(defender, aUnits)
  if (withdrew === 'attacker') {
    aDamage = 0
    dDamage *= 0.5
    note = 'The attackers fell back.'
  } else if (withdrew === 'defender') {
    dDamage = 0
    aDamage *= 0.5
    note = 'The defenders fell back.'
  }

  const dLosses = subtractLosses(defender, applyDamage(defender, aDamage))
  const aLosses = subtractLosses(attacker, applyDamage(attacker, dDamage))

  // Rams knock the walls down round by round.
  let wallLevel: number | undefined
  if (defender.wallLevel > 0) {
    const rams = sideUnits(attacker).ram
    if (rams > 0) defender.wallLevel = Math.max(0, defender.wallLevel - rams / RAMS_PER_WALL_LEVEL)
    wallLevel = Math.floor(defender.wallLevel)
  }

  const aLeft = totalUnits(sideUnits(attacker))
  const dLeft = totalUnits(sideUnits(defender))
  const over = withdrew !== null || aLeft === 0 || dLeft === 0
  const log: RoundLog = {
    round,
    attackerOrder: aOrder,
    defenderOrder: dOrder,
    attackerLosses: aLosses,
    defenderLosses: dLosses,
  }
  if (wallLevel !== undefined) log.wallLevel = wallLevel
  if (note) log.note = note
  return { log, over, withdrew }
}

export interface BattleOutcome {
  rounds: RoundLog[]
  winner: 'attacker' | 'defender'
}

/**
 * Who won once the fighting stops. The attacker only wins by clearing the field;
 * a defender who falls back loses, an attacker who falls back or runs out of rounds loses.
 */
export function decide(attacker: Side, defender: Side, withdrew: RoundResult['withdrew']): 'attacker' | 'defender' {
  if (withdrew === 'defender') return 'attacker'
  if (withdrew === 'attacker') return 'defender'
  const aLeft = totalUnits(sideUnits(attacker))
  const dLeft = totalUnits(sideUnits(defender))
  if (aLeft > 0 && dLeft === 0) return 'attacker'
  return 'defender'
}

/** Fight a whole battle at once (skirmishes and raids). */
export function fightBattle(attacker: Side, defender: Side, maxRounds: number): BattleOutcome {
  const rounds: RoundLog[] = []
  let withdrew: RoundResult['withdrew'] = null
  if (totalUnits(sideUnits(defender)) === 0) return { rounds, winner: totalUnits(sideUnits(attacker)) > 0 ? 'attacker' : 'defender' }
  for (let r = 1; r <= maxRounds; r++) {
    const res = fightRound(r, attacker, defender)
    rounds.push(res.log)
    withdrew = res.withdrew
    if (res.over) break
  }
  return { rounds, winner: decide(attacker, defender, withdrew) }
}

export function mightBonus(might: number): number {
  return might * STAT_BONUS
}

export function sumUnits(side: Side): Units {
  return sideUnits(side)
}

export function unitKeysWithTroops(u: Units): UnitKey[] {
  return UNIT_KEYS.filter((k) => u[k] > 0)
}
