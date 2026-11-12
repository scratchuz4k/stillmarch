// Starts the game server. Settings come from environment variables:
//   PORT            (default 8787)
//   DATA_DIR        where the database lives (default server/data)
//   OPEN_WORLDS     "0" to stop players from creating test worlds (default on)
//   VAPID_CONTACT   mailto: or https: contact for Web Push (default a placeholder)

import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { createApp } from './app.ts'
import { Store } from './db.ts'
import { Game } from './game.ts'
import { setupPush } from './push.ts'

const here = fileURLToPath(new URL('.', import.meta.url))
const port = Number(process.env.PORT ?? 8787)
const dataDir = process.env.DATA_DIR ?? join(here, '..', 'data')

const store = new Store(join(dataDir, 'stillmarch.db'))
const push = setupPush(store, process.env.VAPID_CONTACT ?? 'mailto:stillmarch@example.invalid')
const game = new Game(store, push.send)

if (game.worlds.size === 0) {
  // A fast test world to play in straight away.
  const w = game.createWorld({ name: 'Valdris (test, ×50)', speed: 50, dev: true, battleWindow: 'always', maxPlayers: 20, aiHouses: 2 })
  console.log(`Created test world ${w.id}`)
}
game.start()

const server = createApp({
  store,
  game,
  pushKey: push.publicKey,
  staticDir: join(here, '..', '..', 'client', 'dist'),
  openWorldCreation: process.env.OPEN_WORLDS !== '0',
})
server.listen(port, () => console.log(`Stillmarch game server on http://localhost:${port}`))

function shutdown() {
  game.stop()
  server.close()
  process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
