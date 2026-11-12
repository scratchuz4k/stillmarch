// The HTTP API and the WebSocket for live updates.

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { extname, join, normalize } from 'node:path'
import { WebSocketServer } from 'ws'
import { type Action, CARD_BY_ID, GameError, STARTER_CARDS } from '@stillmarch/shared'
import type { Store } from './db.ts'
import type { Game } from './game.ts'

export interface AppOptions {
  store: Store
  game: Game
  pushKey: string
  /** Built client files to serve, if any. */
  staticDir?: string
  /** Let any player create test worlds (local testing). */
  openWorldCreation: boolean
}

class HttpError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

function hash(password: string, salt: string): string {
  return scryptSync(password, salt, 64).toString('hex')
}

async function body(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    size += (chunk as Buffer).length
    if (size > 64 * 1024) throw new HttpError(413, 'Request too large.')
    chunks.push(chunk as Buffer)
  }
  if (!chunks.length) return {}
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>
  } catch {
    throw new HttpError(400, 'Bad JSON.')
  }
}

function send(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' })
  res.end(JSON.stringify(data))
}

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.ico': 'image/x-icon',
}

export function createApp(opts: AppOptions) {
  const { store, game } = opts

  function account(req: IncomingMessage): { id: string; username: string } {
    const header = req.headers.authorization ?? ''
    const token = header.startsWith('Bearer ') ? header.slice(7) : ''
    const id = token ? store.sessionAccount(token) : undefined
    const acc = id ? store.accountById(id) : undefined
    if (!acc) throw new HttpError(401, 'Please log in.')
    return { id: acc.id, username: acc.username }
  }

  function me(id: string) {
    const acc = store.accountById(id)!
    return { id: acc.id, username: acc.username, cards: store.cards(id) }
  }

  function credentials(b: Record<string, unknown>) {
    const username = String(b.username ?? '').trim()
    const password = String(b.password ?? '')
    if (!/^[A-Za-z0-9_\- ]{3,20}$/.test(username)) throw new HttpError(400, 'Usernames are 3 to 20 letters, numbers, spaces, - or _.')
    if (password.length < 6 || password.length > 200) throw new HttpError(400, 'Passwords need at least 6 characters.')
    return { username, password }
  }

  async function route(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '/', 'http://localhost')
    const path = url.pathname
    const method = req.method ?? 'GET'

    if (path === '/api/register' && method === 'POST') {
      const { username, password } = credentials(await body(req))
      if (store.accountByName(username)) throw new HttpError(409, 'That username is taken.')
      const id = `u${randomUUID().replace(/-/g, '').slice(0, 12)}`
      const salt = randomBytes(16).toString('hex')
      store.createAccount({ id, username, pass_hash: hash(password, salt), salt, created_at: Date.now() })
      for (const c of STARTER_CARDS) store.grantCard(id, c)
      const token = randomBytes(24).toString('hex')
      store.createSession(token, id)
      return send(res, 200, { token, account: me(id) })
    }
    if (path === '/api/login' && method === 'POST') {
      const { username, password } = credentials(await body(req))
      const acc = store.accountByName(username)
      const ok = acc && timingSafeEqual(Buffer.from(hash(password, acc.salt), 'hex'), Buffer.from(acc.pass_hash, 'hex'))
      if (!acc || !ok) throw new HttpError(401, 'Wrong username or password.')
      const token = randomBytes(24).toString('hex')
      store.createSession(token, acc.id)
      return send(res, 200, { token, account: me(acc.id) })
    }
    if (path === '/api/logout' && method === 'POST') {
      const header = req.headers.authorization ?? ''
      if (header.startsWith('Bearer ')) store.deleteSession(header.slice(7))
      return send(res, 200, { ok: true })
    }
    if (path === '/api/me' && method === 'GET') {
      return send(res, 200, me(account(req).id))
    }
    if (path === '/api/cards' && method === 'GET') {
      return send(res, 200, { cards: Object.values(CARD_BY_ID) })
    }
    if (path === '/api/push/key' && method === 'GET') {
      return send(res, 200, { publicKey: opts.pushKey })
    }
    if (path === '/api/push/subscribe' && method === 'POST') {
      const acc = account(req)
      const b = await body(req)
      const sub = b.subscription as { endpoint?: unknown } | undefined
      if (!sub || typeof sub.endpoint !== 'string' || !sub.endpoint.startsWith('https://')) throw new HttpError(400, 'Bad subscription.')
      store.savePushSub(acc.id, sub.endpoint, JSON.stringify(sub))
      return send(res, 200, { ok: true })
    }
    if (path === '/api/worlds' && method === 'GET') {
      return send(res, 200, { worlds: game.list(account(req).id) })
    }
    if (path === '/api/worlds' && method === 'POST') {
      account(req)
      if (!opts.openWorldCreation) throw new HttpError(403, 'Creating worlds is turned off on this server.')
      const b = await body(req)
      const speed = Math.min(1000, Math.max(1, Number(b.speed) || 1))
      const world = game.createWorld({
        name: String(b.name ?? 'Valdris').slice(0, 40) || 'Valdris',
        speed,
        dev: b.dev !== false,
        maxPlayers: Math.min(40, Math.max(2, Number(b.maxPlayers) || 20)),
        aiHouses: Math.min(3, Math.max(0, Number(b.aiHouses ?? 2))),
        battleWindow: b.alwaysOpen ? 'always' : { start: '16:30', end: '22:30', tz: 'Europe/Berlin' },
      })
      return send(res, 200, { id: world.id })
    }
    const m = path.match(/^\/api\/worlds\/([A-Za-z0-9]+)\/(join|view|action)$/)
    if (m) {
      const acc = account(req)
      const worldId = m[1]!
      if (m[2] === 'join' && method === 'POST') {
        game.join(worldId, acc.id, acc.username)
        return send(res, 200, { view: game.view(worldId, acc.id) })
      }
      if (m[2] === 'view' && method === 'GET') {
        return send(res, 200, { view: game.view(worldId, acc.id) })
      }
      if (m[2] === 'action' && method === 'POST') {
        const b = await body(req)
        const action = b.action as Action | undefined
        if (!action || typeof action !== 'object' || typeof action.type !== 'string') throw new HttpError(400, 'Bad action.')
        const result = game.act(worldId, acc.id, action)
        return send(res, 200, { ok: result.ok, error: result.error, value: result.value, view: game.view(worldId, acc.id) })
      }
    }
    if (path.startsWith('/api/')) throw new HttpError(404, 'Not found.')
    return serveStatic(path, res)
  }

  function serveStatic(path: string, res: ServerResponse): void {
    const dir = opts.staticDir
    if (!dir || !existsSync(dir)) {
      res.writeHead(404, { 'content-type': 'text/plain' })
      res.end('The client is not built. Run the Vite dev server, or npm run build.')
      return
    }
    const rel = normalize(decodeURIComponent(path)).replace(/^(\.\.[/\\])+/, '').replace(/^[/\\]+/, '')
    let file = join(dir, rel)
    if (!file.startsWith(dir) || !existsSync(file) || statSync(file).isDirectory()) file = join(dir, 'index.html')
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' })
    res.end(readFileSync(file))
  }

  const server = createServer((req, res) => {
    route(req, res).catch((err: unknown) => {
      if (err instanceof HttpError) return send(res, err.status, { error: err.message })
      if (err instanceof GameError) return send(res, 400, { error: err.message })
      console.error(err)
      send(res, 500, { error: 'Something went wrong on the server.' })
    })
  })

  const wss = new WebSocketServer({ noServer: true })
  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    if (url.pathname !== '/ws') return socket.destroy()
    const accountId = store.sessionAccount(url.searchParams.get('token') ?? '')
    const worldId = url.searchParams.get('world') ?? ''
    if (!accountId || !game.worlds.has(worldId)) return socket.destroy()
    wss.handleUpgrade(req, socket, head, (ws) => {
      const stop = game.listen(worldId, { accountId, send: (d) => ws.send(d) })
      ws.on('close', stop)
      ws.on('message', (raw) => {
        if (raw.toString() === 'ping') ws.send(JSON.stringify({ type: 'pong' }))
      })
      try {
        ws.send(JSON.stringify({ type: 'view', view: game.view(worldId, accountId) }))
      } catch {
        // Not in that world yet.
      }
    })
  })

  return server
}
