// The world clock. Everything is stored as timestamps; advancing the world finds the next thing
// that's due (a build, an arrival, a battle round...), brings every stock up to that moment,
// handles it, and repeats until it reaches now. The same code runs whether the world was left
// alone for a second or for a week.

import type { World } from '../types.ts'
import { aiTick } from './ai.ts'
import { arriveHop, finishClaim, rationsEmptyAt, settleArmy, starveTick } from './armies.ts'
import { settlePlayer } from './economy.ts'
import { finishBuild, finishTraining, updateTasks } from './village.ts'
import { siegeRound, startSiege } from './war.ts'
import { type Ctx, newCtx } from './world.ts'

function nextEventTime(world: World): number {
  let next = Infinity
  const consider = (t: number | null | undefined) => {
    if (t !== null && t !== undefined && t < next) next = t
  }
  for (const p of Object.values(world.players)) {
    if (p.eliminated) continue
    consider(p.buildQueue[0]?.endsAt)
    consider(p.trainQueue[0]?.endsAt)
  }
  for (const a of Object.values(world.armies)) {
    if (!a.battleId) consider(a.arriveAt)
    if (a.mission.kind === 'claim' && a.arriveAt === null) consider(a.mission.endsAt)
    consider(rationsEmptyAt(world, a))
    consider(a.nextStarveAt)
  }
  for (const w of Object.values(world.wars)) if (w.state === 'declared') consider(w.startsAt)
  for (const b of Object.values(world.battles)) consider(b.nextRoundAt)
  if (Object.values(world.players).some((p) => p.isAI && !p.eliminated)) consider(world.aiNextAt)
  return next
}

function settleAll(world: World, t: number): void {
  for (const p of Object.values(world.players)) if (!p.eliminated) settlePlayer(world, p, t)
  for (const a of Object.values(world.armies)) settleArmy(world, a, t)
}

function processDue(ctx: Ctx, world: World, t: number): void {
  for (const p of Object.values(world.players)) {
    if (p.eliminated) continue
    while (p.buildQueue[0] && p.buildQueue[0].endsAt <= t) finishBuild(ctx, world, p, t)
    while (p.trainQueue[0] && p.trainQueue[0].endsAt <= t) finishTraining(ctx, world, p, t)
  }
  for (const a of Object.values(world.armies)) {
    if (!world.armies[a.id]) continue
    if (a.nextStarveAt !== null && a.nextStarveAt <= t) starveTick(ctx, world, a, t)
  }
  for (const a of Object.values(world.armies)) {
    if (!world.armies[a.id] || a.battleId) continue
    if (a.arriveAt !== null && a.arriveAt <= t) arriveHop(ctx, world, a, t)
    else if (a.mission.kind === 'claim' && a.mission.endsAt !== null && a.mission.endsAt <= t && a.arriveAt === null) finishClaim(ctx, world, a, t)
  }
  for (const w of Object.values(world.wars)) {
    if (w.state === 'declared' && w.startsAt <= t) startSiege(ctx, world, w, t)
  }
  for (const b of Object.values(world.battles)) {
    if (world.battles[b.id] && b.nextRoundAt <= t) siegeRound(ctx, world, b, t)
  }
  if (world.aiNextAt <= t && Object.values(world.players).some((p) => p.isAI && !p.eliminated)) aiTick(ctx, world, t)
}

/** Run the world forward to world time `now`. */
export function advance(world: World, now: number, ctx: Ctx = newCtx()): Ctx {
  let guard = 0
  for (;;) {
    const t = Math.max(nextEventTime(world), world.time)
    if (t > now || !Number.isFinite(t)) break
    settleAll(world, t)
    world.time = t
    processDue(ctx, world, t)
    if (++guard > 200000) throw new Error('The world clock got stuck.')
  }
  if (now > world.time) world.time = now
  settleAll(world, world.time)
  for (const p of Object.values(world.players)) updateTasks(world, p)
  return ctx
}
