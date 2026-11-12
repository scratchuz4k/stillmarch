// App state: the account, the world being played, and a ticking clock for timers.

import { reactive, computed } from 'vue'
import type { Action, PlayerView, Res } from '@stillmarch/shared'
import { api, connect, setToken, type Account, type WorldSummary } from './api.ts'

export type Tab = 'village' | 'map' | 'armies' | 'cards' | 'house' | 'log'

export const state = reactive({
  account: null as Account | null,
  worlds: [] as WorldSummary[],
  worldId: null as string | null,
  view: null as PlayerView | null,
  /** World time minus Date.now(), from the last view. */
  skew: 0,
  now: Date.now(),
  live: false,
  busy: false,
  tab: 'village' as Tab,
  toast: null as { text: string; error: boolean } | null,
  /** A region the map should focus and open, set from other screens. */
  focusRegion: null as number | null,
  booting: true,
})

let toastTimer: ReturnType<typeof setTimeout> | null = null
export function toast(text: string, error = false): void {
  state.toast = { text, error }
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (state.toast = null), error ? 5000 : 2500)
}

setInterval(() => {
  state.now = Date.now()
}, 500)

/** The current world time, ticking. */
export const worldTime = computed(() => state.now + state.skew)

function setView(v: PlayerView): void {
  state.view = v
  state.skew = v.now - Date.now()
}

let disconnect: (() => void) | null = null

export async function boot(): Promise<void> {
  try {
    if (api.hasToken()) {
      state.account = await api.me()
      await refreshWorlds()
      let last: string | null = null
      try {
        last = localStorage.getItem('sm-world')
      } catch {
        last = null
      }
      if (last && state.worlds.some((w) => w.id === last && w.joined)) await openWorld(last)
    }
  } catch {
    setToken(null)
    state.account = null
  } finally {
    state.booting = false
  }
}

export async function login(username: string, password: string, register: boolean): Promise<void> {
  const r = register ? await api.register(username, password) : await api.login(username, password)
  setToken(r.token)
  state.account = r.account
  await refreshWorlds()
}

export async function logout(): Promise<void> {
  try {
    await api.logout()
  } catch {
    // Already gone.
  }
  setToken(null)
  leaveWorld()
  state.account = null
}

export async function refreshWorlds(): Promise<void> {
  state.worlds = (await api.worlds()).worlds
}

export async function openWorld(id: string): Promise<void> {
  const summary = state.worlds.find((w) => w.id === id)
  const r = summary?.joined ? await api.view(id) : await api.join(id)
  setView(r.view)
  state.worldId = id
  state.tab = 'village'
  try {
    localStorage.setItem('sm-world', id)
  } catch {
    // Fine without it.
  }
  disconnect?.()
  disconnect = connect(id, setView, (live) => (state.live = live))
}

export function leaveWorld(): void {
  disconnect?.()
  disconnect = null
  state.worldId = null
  state.view = null
  try {
    localStorage.removeItem('sm-world')
  } catch {
    // Fine without it.
  }
  void refreshWorlds().catch(() => undefined)
}

/** Send an action. Returns the action's value on success, or null after showing the error. */
export async function act(action: Action, success?: string): Promise<string | null | undefined> {
  if (!state.worldId) return null
  state.busy = true
  try {
    const r = await api.act(state.worldId, action)
    setView(r.view)
    if (!r.ok) {
      toast(r.error ?? 'That didn’t work.', true)
      return null
    }
    if (success) toast(success)
    return r.value
  } catch (e) {
    toast((e as Error).message, true)
    return null
  } finally {
    state.busy = false
  }
}

/** Stock right now, counting production since the last view (capped at the storehouse). */
export const liveRes = computed<Res>(() => {
  const v = state.view
  if (!v) return { wood: 0, stone: 0, iron: 0, food: 0, gold: 0 }
  const me = v.me
  const hours = Math.max(0, ((worldTime.value - v.now) * v.speed) / 3_600_000)
  const out = { ...me.res }
  for (const k of ['wood', 'stone', 'iron', 'food'] as const) {
    if (out[k] < me.storage) out[k] = Math.min(me.storage, out[k] + me.rates[k] * hours)
  }
  return out
})
