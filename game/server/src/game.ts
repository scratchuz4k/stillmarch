// Runs the worlds: advances each one every second, applies actions, saves, and tells
// connected players (WebSocket) and offline players (Web Push) what happened.

import {
  type Action,
  type ActionResult,
  type Effect,
  type Notice,
  type World,
  type WorldConfig,
  advance,
  applyAction,
  createWorld,
  joinOpenUntil,
  joinWorld,
  syncCards,
  viewFor,
  worldNow,
  GameError,
} from '@stillmarch/shared'
import type { Store } from './db.ts'

export interface Listener {
  accountId: string
  send(data: string): void
}

export interface WorldSummary {
  id: string
  name: string
  speed: number
  dev: boolean
  players: number
  maxPlayers: number
  joinOpen: boolean
  joined: boolean
  window: string
}

export class Game {
  worlds = new Map<string, World>()
  listeners = new Map<string, Set<Listener>>()
  private dirty = new Set<string>()
  private timer: ReturnType<typeof setInterval> | null = null

  private store: Store
  private push: (accountId: string, title: string, body: string) => void

  constructor(store: Store, push: (accountId: string, title: string, body: string) => void) {
    this.store = store
    this.push = push
    for (const w of store.loadWorlds()) this.worlds.set(w.id, w)
  }

  start(): void {
    this.timer = setInterval(() => this.tick(), 1000)
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.flush()
  }

  createWorld(config: Partial<WorldConfig>): World {
    const id = `w${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`
    const world = createWorld(id, { seed: Math.floor(Math.random() * 1e9), ...config }, Date.now())
    this.worlds.set(id, world)
    this.store.saveWorld(world)
    return world
  }

  list(accountId: string): WorldSummary[] {
    const now = Date.now()
    return [...this.worlds.values()].map((w) => ({
      id: w.id,
      name: w.config.name,
      speed: w.config.speed,
      dev: w.config.dev,
      players: Object.values(w.players).filter((p) => !p.isAI).length,
      maxPlayers: w.config.maxPlayers,
      joinOpen: worldNow(w, now) <= joinOpenUntil(w),
      joined: !!w.players[accountId],
      window: w.config.battleWindow === 'always' ? 'Always open' : `${w.config.battleWindow.start}–${w.config.battleWindow.end} CET`,
    }))
  }

  world(id: string): World {
    const w = this.worlds.get(id)
    if (!w) throw new GameError('That world does not exist.')
    return w
  }

  join(worldId: string, accountId: string, name: string): void {
    const w = this.world(worldId)
    advance(w, worldNow(w, Date.now()))
    joinWorld(w, accountId, name, this.store.cards(accountId), worldNow(w, Date.now()))
    this.changed(w)
  }

  view(worldId: string, accountId: string) {
    const w = this.world(worldId)
    const p = w.players[accountId]
    if (!p) throw new GameError('You are not in this world.')
    syncCards(p, this.store.cards(accountId))
    return viewFor(w, accountId)
  }

  act(worldId: string, accountId: string, action: Action): ActionResult {
    const w = this.world(worldId)
    const p = w.players[accountId]
    if (!p) throw new GameError('You are not in this world.')
    syncCards(p, this.store.cards(accountId))
    const result = applyAction(w, accountId, action, Date.now())
    this.handle(result.notices, result.effects)
    if (result.ok || result.notices.length) this.changed(w)
    return result
  }

  private handle(notices: Notice[], effects: Effect[]): void {
    for (const e of effects) if (e.kind === 'grantCard') this.store.grantCard(e.accountId, e.cardId)
    for (const n of notices) for (const id of n.to) this.push(id, n.title, n.body)
  }

  private tick(): void {
    for (const w of this.worlds.values()) {
      try {
        const ctx = advance(w, worldNow(w, Date.now()))
        this.handle(ctx.notices, ctx.effects)
        if (ctx.events > 0) this.changed(w)
      } catch (e) {
        console.error(`World ${w.id} failed to advance:`, e)
      }
    }
    this.flush()
  }

  /** Mark a world as changed: send fresh views to everyone watching, save it soon. */
  changed(w: World): void {
    this.dirty.add(w.id)
    for (const l of this.listeners.get(w.id) ?? []) {
      if (!w.players[l.accountId]) continue
      try {
        l.send(JSON.stringify({ type: 'view', view: viewFor(w, l.accountId) }))
      } catch {
        // A closed socket; it gets removed when it closes.
      }
    }
  }

  flush(): void {
    for (const id of this.dirty) {
      const w = this.worlds.get(id)
      if (w) this.store.saveWorld(w)
    }
    this.dirty.clear()
  }

  listen(worldId: string, l: Listener): () => void {
    let set = this.listeners.get(worldId)
    if (!set) {
      set = new Set()
      this.listeners.set(worldId, set)
    }
    set.add(l)
    return () => set.delete(l)
  }
}
