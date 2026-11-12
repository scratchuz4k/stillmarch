// Everything a player can do, as plain data. The server checks and applies them here.

import type { BuildingKey, Effect, Notice, Order, UnitKey, Units, World } from '../types.ts'
import { redirectArmy, sendArmy } from './armies.ts'
import { advance } from './engine.ts'
import {
  acceptAlliance,
  breakAlliance,
  createHouse,
  declineAlliance,
  joinHouse,
  leaveHouse,
  proposeAlliance,
  setOfficer,
} from './houses.ts'
import {
  assignCard,
  claimTask,
  hireCard,
  queueBuild,
  queueTraining,
  releaseCard,
  updateTasks,
} from './village.ts'
import { declareSiege } from './war.ts'
import { type Ctx, GameError, fail, foundVillage, newCtx, player } from './world.ts'
import { RES_KEYS, newId, worldNow } from './util.ts'

export type Action =
  | { type: 'found' }
  | { type: 'build'; building: BuildingKey }
  | { type: 'train'; unit: UnitKey; count: number }
  | { type: 'send'; units: Units; rations: number; commander: string | null; order: Order; target: number; mission: 'move' | 'claim' | 'raid' | 'siege'; warId?: string }
  | { type: 'redirect'; armyId: string; target: number; mission: 'move' | 'claim' | 'raid' | 'siege' | 'return'; warId?: string }
  | { type: 'setOrder'; armyId: string | 'home'; order: Order }
  | { type: 'assignCard'; cardId: string; building: BuildingKey | null }
  | { type: 'hireCard' }
  | { type: 'releaseCard'; cardId: string }
  | { type: 'createHouse'; name: string; tag: string }
  | { type: 'joinHouse'; houseId: string }
  | { type: 'leaveHouse' }
  | { type: 'setOfficer'; memberId: string; officer: boolean }
  | { type: 'proposeAlliance'; houseId: string }
  | { type: 'acceptAlliance'; houseId: string }
  | { type: 'declineAlliance'; houseId: string }
  | { type: 'breakAlliance'; houseId: string }
  | { type: 'declareSiege'; regionId: number }
  | { type: 'dropProtection' }
  | { type: 'claimTask'; taskId: string }
  | { type: 'readReports' }
  | { type: 'chat'; channel: string; text: string }
  | { type: 'cheat'; cheat: 'finish' | 'resources' | 'skip'; minutes?: number }

export interface ActionResult {
  ok: boolean
  error?: string
  notices: Notice[]
  effects: Effect[]
  /** Something the client may want, like the id of a new army or card. */
  value?: string
}

const ORDERS: Order[] = ['hold', 'charge', 'volley', 'fallback']

function perform(ctx: Ctx, world: World, playerId: string, a: Action, t: number): string | undefined {
  const p = player(world, playerId)
  const alive = () => {
    if (p.eliminated) fail('You are out of this world.')
  }
  switch (a.type) {
    case 'found':
      alive()
      foundVillage(world, p, t)
      return
    case 'build':
      alive()
      queueBuild(world, p, a.building, t)
      return
    case 'train':
      alive()
      queueTraining(world, p, a.unit, a.count, t)
      return
    case 'send': {
      alive()
      if (!ORDERS.includes(a.order)) fail('Unknown order.')
      return sendArmy(ctx, world, playerId, a, t).id
    }
    case 'redirect': {
      alive()
      const army = world.armies[a.armyId]
      if (!army || army.ownerId !== playerId) fail('That army isn’t yours.')
      redirectArmy(ctx, world, army, a.target, a.mission, a.warId, t)
      return
    }
    case 'setOrder': {
      alive()
      if (!ORDERS.includes(a.order)) fail('Unknown order.')
      if (a.armyId === 'home') {
        p.homeOrder = a.order
        return
      }
      const army = world.armies[a.armyId]
      if (!army || army.ownerId !== playerId) fail('That army isn’t yours.')
      army.order = a.order
      return
    }
    case 'assignCard':
      alive()
      assignCard(world, p, a.cardId, a.building, t)
      return
    case 'hireCard':
      alive()
      return hireCard(ctx, world, p, t)
    case 'releaseCard':
      alive()
      releaseCard(world, p, a.cardId, t)
      return
    case 'createHouse':
      alive()
      return createHouse(world, playerId, a.name, a.tag, t).id
    case 'joinHouse':
      alive()
      joinHouse(ctx, world, playerId, a.houseId, t)
      return
    case 'leaveHouse':
      alive()
      leaveHouse(world, playerId, t)
      return
    case 'setOfficer':
      alive()
      setOfficer(world, playerId, a.memberId, a.officer)
      return
    case 'proposeAlliance':
      alive()
      proposeAlliance(ctx, world, playerId, a.houseId, t)
      return
    case 'acceptAlliance':
      alive()
      acceptAlliance(ctx, world, playerId, a.houseId, t)
      return
    case 'declineAlliance':
      alive()
      declineAlliance(world, playerId, a.houseId)
      return
    case 'breakAlliance':
      alive()
      breakAlliance(ctx, world, playerId, a.houseId, t)
      return
    case 'declareSiege':
      alive()
      return declareSiege(ctx, world, playerId, a.regionId, t).id
    case 'dropProtection':
      alive()
      if (p.protectionUntil > t) p.protectionUntil = t
      return
    case 'claimTask':
      alive()
      claimTask(world, p, a.taskId)
      return
    case 'readReports':
      for (const r of p.reports) r.read = true
      return
    case 'chat': {
      const text = a.text.trim().slice(0, 300)
      if (!text) fail('Say something.')
      if (a.channel !== 'world' && a.channel !== p.houseId) fail('You can only talk in world chat or your own House.')
      world.chat.push({ id: newId(world, 'm'), at: t, fromId: p.id, fromName: p.name, channel: a.channel, text })
      if (world.chat.length > 300) world.chat.splice(0, world.chat.length - 300)
      return
    }
    case 'cheat': {
      if (!world.config.dev) fail('Cheats are only on in test worlds.')
      if (a.cheat === 'resources') {
        for (const k of RES_KEYS) p.res[k] += k === 'gold' ? 500 : 3000
      } else if (a.cheat === 'finish') {
        for (const j of p.buildQueue) j.endsAt = Math.min(j.endsAt, t)
        for (const j of p.trainQueue) j.endsAt = Math.min(j.endsAt, t)
        advance(world, t, ctx)
      } else if (a.cheat === 'skip') {
        const minutes = Math.min(Math.max(1, Math.floor(a.minutes ?? 60)), 60 * 24 * 7)
        world.clockOffset += minutes * 60000
        advance(world, t + minutes * 60000, ctx)
      }
      return
    }
    default:
      fail('Unknown action.')
  }
}

/** Apply one action at real time `realNow`. The world is brought up to date first. */
export function applyAction(world: World, playerId: string, action: Action, realNow: number): ActionResult {
  const ctx = newCtx()
  const t = worldNow(world, realNow)
  advance(world, t, ctx)
  const keepNotices = ctx.notices.length
  const keepEffects = ctx.effects.length
  // Keep a copy so a failed action can't leave the world half-changed.
  const backup = structuredClone(world)
  try {
    const value = perform(ctx, world, playerId, action, t)
    const p = world.players[playerId]
    if (p) updateTasks(world, p)
    const result: ActionResult = { ok: true, notices: ctx.notices, effects: ctx.effects }
    if (value !== undefined) result.value = value
    return result
  } catch (e) {
    if (!(e instanceof GameError)) throw e
    Object.assign(world, backup)
    return { ok: false, error: e.message, notices: ctx.notices.slice(0, keepNotices), effects: ctx.effects.slice(0, keepEffects) }
  }
}
