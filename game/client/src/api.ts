// Talking to the game server: a small fetch wrapper and the live WebSocket.

import type { Action, PlayerView } from '@stillmarch/shared'

const SERVER = (import.meta.env.VITE_SERVER as string | undefined) ?? ''

export interface Account {
  id: string
  username: string
  cards: string[]
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

function token(): string {
  try {
    return localStorage.getItem('sm-token') ?? ''
  } catch {
    return ''
  }
}

export function setToken(t: string | null): void {
  try {
    if (t) localStorage.setItem('sm-token', t)
    else localStorage.removeItem('sm-token')
  } catch {
    // Private mode: the session lasts until the tab closes.
  }
  memoryToken = t ?? ''
}

let memoryToken = ''
const currentToken = () => token() || memoryToken

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${SERVER}/api${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(currentToken() ? { authorization: `Bearer ${currentToken()}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  let data: unknown = null
  try {
    data = await res.json()
  } catch {
    // No body.
  }
  if (!res.ok) {
    const message = (data as { error?: string } | null)?.error ?? `The server answered ${res.status}.`
    throw Object.assign(new Error(message), { status: res.status })
  }
  return data as T
}

export const api = {
  hasToken: () => !!currentToken(),
  register: (username: string, password: string) => call<{ token: string; account: Account }>('POST', '/register', { username, password }),
  login: (username: string, password: string) => call<{ token: string; account: Account }>('POST', '/login', { username, password }),
  logout: () => call('POST', '/logout'),
  me: () => call<Account>('GET', '/me'),
  worlds: () => call<{ worlds: WorldSummary[] }>('GET', '/worlds'),
  createWorld: (opts: { name: string; speed: number; alwaysOpen: boolean; aiHouses: number }) => call<{ id: string }>('POST', '/worlds', { ...opts, dev: true }),
  join: (id: string) => call<{ view: PlayerView }>('POST', `/worlds/${id}/join`),
  view: (id: string) => call<{ view: PlayerView }>('GET', `/worlds/${id}/view`),
  act: (id: string, action: Action) => call<{ ok: boolean; error?: string; value?: string; view: PlayerView }>('POST', `/worlds/${id}/action`, { action }),
  pushKey: () => call<{ publicKey: string }>('GET', '/push/key'),
  subscribe: (subscription: PushSubscriptionJSON) => call('POST', '/push/subscribe', { subscription }),
}

/** Live updates for one world. Reconnects on its own. */
export function connect(worldId: string, onView: (v: PlayerView) => void, onState: (live: boolean) => void): () => void {
  let ws: WebSocket | null = null
  let stopped = false
  let retry = 1000
  let ping: ReturnType<typeof setInterval> | null = null

  const open = () => {
    const base = SERVER ? SERVER.replace(/^http/, 'ws') : `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}`
    ws = new WebSocket(`${base}/ws?token=${encodeURIComponent(currentToken())}&world=${encodeURIComponent(worldId)}`)
    ws.onopen = () => {
      retry = 1000
      onState(true)
      ping = setInterval(() => ws?.readyState === 1 && ws.send('ping'), 25000)
    }
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(String(e.data)) as { type: string; view?: PlayerView }
        if (msg.type === 'view' && msg.view) onView(msg.view)
      } catch {
        // Ignore anything we don't understand.
      }
    }
    ws.onclose = () => {
      onState(false)
      if (ping) clearInterval(ping)
      if (!stopped) setTimeout(open, retry)
      retry = Math.min(retry * 2, 15000)
    }
  }
  open()
  return () => {
    stopped = true
    ws?.close()
  }
}

/** Ask for notification permission and register this device for Web Push. */
export async function enablePush(): Promise<string> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return 'This browser can’t do push notifications. On iPhone, add the game to your home screen first.'
  }
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') return 'Notifications are blocked for this site.'
  const reg = await navigator.serviceWorker.ready
  const { publicKey } = await api.pushKey()
  const pad = '='.repeat((4 - (publicKey.length % 4)) % 4)
  const raw = atob((publicKey + pad).replace(/-/g, '+').replace(/_/g, '/'))
  const key = Uint8Array.from(raw, (c) => c.charCodeAt(0))
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key }))
  await api.subscribe(sub.toJSON())
  return 'Notifications are on for this device.'
}
