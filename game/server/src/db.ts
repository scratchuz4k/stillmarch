// Storage: accounts, sessions and card collections live outside any world; each world is one
// JSON document. Node's built-in SQLite, so there's nothing native to install.

import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import type { World } from '@stillmarch/shared'

export interface AccountRow {
  id: string
  username: string
  pass_hash: string
  salt: string
  created_at: number
}

export class Store {
  db: DatabaseSync

  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true })
    this.db = new DatabaseSync(path)
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL UNIQUE COLLATE NOCASE,
        pass_hash TEXT NOT NULL,
        salt TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS cards (
        account_id TEXT NOT NULL,
        card_id TEXT NOT NULL,
        acquired_at INTEGER NOT NULL,
        PRIMARY KEY (account_id, card_id)
      );
      CREATE TABLE IF NOT EXISTS worlds (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS push_subs (
        endpoint TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        data TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `)
  }

  createAccount(row: AccountRow): void {
    this.db.prepare('INSERT INTO accounts (id, username, pass_hash, salt, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(row.id, row.username, row.pass_hash, row.salt, row.created_at)
  }

  accountByName(username: string): AccountRow | undefined {
    return this.db.prepare('SELECT * FROM accounts WHERE username = ?').get(username) as AccountRow | undefined
  }

  accountById(id: string): AccountRow | undefined {
    return this.db.prepare('SELECT * FROM accounts WHERE id = ?').get(id) as AccountRow | undefined
  }

  createSession(token: string, accountId: string): void {
    this.db.prepare('INSERT INTO sessions (token, account_id, created_at) VALUES (?, ?, ?)').run(token, accountId, Date.now())
  }

  sessionAccount(token: string): string | undefined {
    const row = this.db.prepare('SELECT account_id FROM sessions WHERE token = ?').get(token) as { account_id: string } | undefined
    return row?.account_id
  }

  deleteSession(token: string): void {
    this.db.prepare('DELETE FROM sessions WHERE token = ?').run(token)
  }

  cards(accountId: string): string[] {
    const rows = this.db.prepare('SELECT card_id FROM cards WHERE account_id = ? ORDER BY acquired_at').all(accountId) as { card_id: string }[]
    return rows.map((r) => r.card_id)
  }

  grantCard(accountId: string, cardId: string): void {
    this.db.prepare('INSERT OR IGNORE INTO cards (account_id, card_id, acquired_at) VALUES (?, ?, ?)').run(accountId, cardId, Date.now())
  }

  saveWorld(world: World): void {
    this.db.prepare('INSERT INTO worlds (id, data, updated_at) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at')
      .run(world.id, JSON.stringify(world), Date.now())
  }

  loadWorlds(): World[] {
    const rows = this.db.prepare('SELECT data FROM worlds').all() as { data: string }[]
    return rows.map((r) => JSON.parse(r.data) as World)
  }

  savePushSub(accountId: string, endpoint: string, data: string): void {
    this.db.prepare('INSERT INTO push_subs (endpoint, account_id, data) VALUES (?, ?, ?) ON CONFLICT(endpoint) DO UPDATE SET account_id = excluded.account_id, data = excluded.data')
      .run(endpoint, accountId, data)
  }

  pushSubs(accountId: string): { endpoint: string; data: string }[] {
    return this.db.prepare('SELECT endpoint, data FROM push_subs WHERE account_id = ?').all(accountId) as { endpoint: string; data: string }[]
  }

  deletePushSub(endpoint: string): void {
    this.db.prepare('DELETE FROM push_subs WHERE endpoint = ?').run(endpoint)
  }

  getMeta(key: string): string | undefined {
    const row = this.db.prepare('SELECT value FROM meta WHERE key = ?').get(key) as { value: string } | undefined
    return row?.value
  }

  setMeta(key: string, value: string): void {
    this.db.prepare('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value)
  }
}
