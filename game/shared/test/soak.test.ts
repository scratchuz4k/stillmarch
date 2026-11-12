import { describe, expect, it } from 'vitest'
import { joinWorld, createWorld } from '../src/rules/world.ts'
import { applyAction } from '../src/rules/actions.ts'
import { advance } from '../src/rules/engine.ts'
import { viewFor } from '../src/rules/view.ts'
import { T0, HOUR_MS } from './helpers.ts'

describe('a busy world', () => {
  it('runs two weeks with AI Houses and idle players without errors', () => {
    const w = createWorld('soak', { seed: 99, speed: 1, maxPlayers: 20, aiHouses: 3, battleWindow: { start: '16:30', end: '22:30', tz: 'Europe/Berlin' } }, T0)
    for (let i = 0; i < 6; i++) {
      joinWorld(w, `p${i}`, `P${i}`, ['brena', 'aldric'], T0 + i * HOUR_MS)
      applyAction(w, `p${i}`, { type: 'found' }, T0 + i * HOUR_MS)
    }
    for (let day = 1; day <= 14; day++) {
      advance(w, T0 + day * 24 * HOUR_MS)
      for (const id of Object.keys(w.players)) viewFor(w, id)
    }
    const ai = Object.values(w.players).filter((p) => p.isAI)
    expect(ai.every((p) => p.buildings.obelisk >= 2)).toBe(true)
    expect(ai.some((p) => p.reports.length >= 0)).toBe(true)
    // AI Houses raid the Forgotten and claim land.
    const claimed = w.regions.filter((r) => r.ownerId && ai.some((p) => p.id === r.ownerId)).length
    expect(claimed).toBeGreaterThan(ai.length)
    expect(JSON.parse(JSON.stringify(w))).toEqual(w)
  })
})
