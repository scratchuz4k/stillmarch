import { applyAction, type Action } from '../src/rules/actions.ts'
import { advance } from '../src/rules/engine.ts'
import { createWorld, joinWorld } from '../src/rules/world.ts'
import { STARTER_CARDS } from '../src/data/cards.ts'
import type { World, WorldConfig } from '../src/types.ts'

export const T0 = Date.UTC(2026, 10, 12, 12, 0, 0)
export const MIN = 60_000
export const HOUR_MS = 60 * MIN

export function testWorld(config: Partial<WorldConfig> = {}): World {
  return createWorld('test', { seed: 7, speed: 1, maxPlayers: 8, regions: 40, aiHouses: 0, battleWindow: 'always', dev: true, ...config }, T0)
}

/** A world with players who have founded their villages. */
export function worldWith(names: string[], config: Partial<WorldConfig> = {}): World {
  const w = testWorld(config)
  for (const n of names) {
    joinWorld(w, n, n, [...STARTER_CARDS], T0)
    must(w, n, { type: 'found' }, T0)
  }
  return w
}

export function act(w: World, id: string, a: Action, t: number) {
  return applyAction(w, id, a, t - w.clockOffset)
}

export function must(w: World, id: string, a: Action, t: number) {
  const r = act(w, id, a, t)
  if (!r.ok) throw new Error(`${a.type} failed: ${r.error}`)
  return r
}

export function run(w: World, t: number) {
  return advance(w, t)
}

/** Give a player a ready village: buildings and troops at home. */
export function militarise(w: World, id: string, troops: Partial<Record<'infantry' | 'archers' | 'cavalry' | 'ram', number>>) {
  const p = w.players[id]!
  p.buildings = { ...p.buildings, obelisk: 2, barracks: 1, farm: 10, storehouse: 6, walls: 0 }
  p.home = { infantry: 0, archers: 0, cavalry: 0, ram: 0, ...troops }
  p.res = { wood: 5000, stone: 5000, iron: 5000, food: 5000, gold: 1000 }
}
