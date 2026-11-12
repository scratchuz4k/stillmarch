import { HOUR } from '../data/balance.ts'
import type { BattleWindow, Res, ResKey, UnitKey, Units, World } from '../types.ts'

export const RES_KEYS: ResKey[] = ['wood', 'stone', 'iron', 'food', 'gold']
export const UNIT_KEYS: UnitKey[] = ['infantry', 'archers', 'cavalry', 'ram']

export function emptyRes(): Res {
  return { wood: 0, stone: 0, iron: 0, food: 0, gold: 0 }
}

export function emptyUnits(): Units {
  return { infantry: 0, archers: 0, cavalry: 0, ram: 0 }
}

export function addUnits(a: Units, b: Units): Units {
  return {
    infantry: a.infantry + b.infantry,
    archers: a.archers + b.archers,
    cavalry: a.cavalry + b.cavalry,
    ram: a.ram + b.ram,
  }
}

export function totalUnits(u: Units): number {
  return u.infantry + u.archers + u.cavalry + u.ram
}

export function canAfford(have: Res, cost: Partial<Res>): boolean {
  return RES_KEYS.every((k) => have[k] >= (cost[k] ?? 0))
}

export function pay(have: Res, cost: Partial<Res>): void {
  for (const k of RES_KEYS) have[k] -= cost[k] ?? 0
}

export function scaleCost(cost: Partial<Res>, factor: number): Partial<Res> {
  const out: Partial<Res> = {}
  for (const k of RES_KEYS) {
    const v = cost[k]
    if (v) out[k] = Math.round(v * factor)
  }
  return out
}

/** A world duration in ms for a number of world-seconds at speed x1. */
export function dur(world: World, seconds: number): number {
  return (seconds * 1000) / world.config.speed
}

/** World-hours that pass in a stretch of world time, scaled by the world speed. */
export function worldHours(world: World, ms: number): number {
  return (ms * world.config.speed) / (HOUR * 1000)
}

export function worldNow(world: World, realNow: number): number {
  return realNow + world.clockOffset
}

export function newId(world: World, prefix: string): string {
  world.nextId += 1
  return `${prefix}${world.nextId}`
}

/** mulberry32: a small seeded random number generator. */
export function rngNext(state: number): [number, number] {
  let t = (state + 0x6d2b79f5) | 0
  const next = t
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, next]
}

export function random(world: World): number {
  const [value, next] = rngNext(world.rng)
  world.rng = next
  return value
}

export function makeRng(seed: number): () => number {
  let state = seed | 0
  return () => {
    const [value, next] = rngNext(state)
    state = next
    return value
  }
}

/** Minutes past midnight in a time zone. */
function localMinutes(t: number, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(t))
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? 0)
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? 0)
  return h * 60 + m
}

function parseHm(s: string): number {
  const [h, m] = s.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

export function windowOpen(win: BattleWindow, t: number): boolean {
  if (win === 'always') return true
  const now = localMinutes(t, win.tz)
  return now >= parseHm(win.start) && now < parseHm(win.end)
}

/** The first moment at or after t when the battle window is open. */
export function nextWindowOpen(win: BattleWindow, t: number): number {
  if (windowOpen(win, t)) return t
  // Step to the next whole minute, then minute by minute (at most two days).
  let probe = Math.ceil(t / 60000) * 60000
  for (let i = 0; i < 2 * 24 * 60 + 2; i++) {
    if (windowOpen(win, probe)) return probe
    probe += 60000
  }
  return t
}

export function describeWindow(win: BattleWindow): string {
  if (win === 'always') return 'Always open (test world)'
  return `${win.start}–${win.end} ${win.tz === 'Europe/Berlin' ? 'CET' : win.tz}`
}

export function roughSize(n: number): string {
  if (n <= 0) return 'none'
  if (n < 10) return 'a handful'
  if (n < 100) return `~${Math.round(n / 10) * 10}`
  return `~${Math.round(n / 50) * 50}`
}

export function formatUnits(u: Units): string {
  const parts = UNIT_KEYS.filter((k) => u[k] > 0).map((k) => `${u[k]} ${k}`)
  return parts.length ? parts.join(', ') : 'no troops'
}
