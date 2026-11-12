// Houses: teams of players with a leader and officers, alliances with a size cap.

import { HOUSE_SWITCH_COOLDOWN, allianceLimit } from '../data/balance.ts'
import type { House, World } from '../types.ts'
import { type Ctx, fail, memberLimit, notify, report } from './world.ts'
import { dur, newId } from './util.ts'
import { houseAtWar } from './war.ts'

function house(world: World, id: string): House {
  const h = world.houses[id]
  if (!h) fail('That House does not exist.')
  return h
}

/** Members of a House plus all of its allies. */
export function allianceSize(world: World, h: House, extra = 0): number {
  let n = h.members.length + extra
  for (const a of h.allies) n += world.houses[a.houseId]?.members.length ?? 0
  return n
}

function checkCanJoin(world: World, playerId: string, t: number): void {
  const p = world.players[playerId]!
  if (p.eliminated) fail('You are out of this world.')
  if (p.houseId) fail('Leave your House first.')
  if (p.houseJoinedAt !== null && t < p.houseJoinedAt + dur(world, HOUSE_SWITCH_COOLDOWN)) {
    fail('You joined a House recently. You can switch again 3 world-days after joining.')
  }
}

export function createHouse(world: World, playerId: string, name: string, tag: string, t: number): House {
  checkCanJoin(world, playerId, t)
  const clean = name.trim().slice(0, 32)
  const cleanTag = tag.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4)
  if (clean.length < 3) fail('A House name needs at least 3 letters.')
  if (cleanTag.length < 2) fail('A tag needs 2 to 4 letters or numbers.')
  if (Object.values(world.houses).some((h) => h.name.toLowerCase() === clean.toLowerCase() || h.tag === cleanTag)) {
    fail('That name or tag is taken.')
  }
  const h: House = {
    id: newId(world, 'h'),
    name: clean,
    tag: cleanTag,
    leaderId: playerId,
    officers: [],
    members: [playerId],
    createdAt: t,
    allies: [],
    allyOffers: [],
  }
  world.houses[h.id] = h
  const p = world.players[playerId]!
  p.houseId = h.id
  p.houseJoinedAt = t
  if (p.tasks.house !== 'claimed') p.tasks.house = 'done'
  return h
}

export function joinHouse(ctx: Ctx, world: World, playerId: string, houseId: string, t: number): void {
  checkCanJoin(world, playerId, t)
  const h = house(world, houseId)
  if (world.players[h.leaderId]?.isAI) fail('AI Houses don’t take members.')
  if (h.members.length >= memberLimit(world)) fail(`That House is full (${memberLimit(world)} members).`)
  const cap = allianceLimit(world.config.maxPlayers)
  if (allianceSize(world, h, 1) > cap) fail(`That House and its allies are at the alliance cap (${cap} players).`)
  for (const a of h.allies) {
    const ally = world.houses[a.houseId]
    if (ally && allianceSize(world, ally, 1) > cap) fail(`An ally of that House is at the alliance cap (${cap} players).`)
  }
  h.members.push(playerId)
  const p = world.players[playerId]!
  p.houseId = h.id
  p.houseJoinedAt = t
  if (p.tasks.house !== 'claimed') p.tasks.house = 'done'
  for (const m of h.members) if (m !== playerId) report(world, m, t, `${p.name} joined ${h.name}`, 'A new member stands with your House.')
  notify(ctx, world, h.members.filter((m) => m !== playerId), `${p.name} joined your House`, h.name)
}

/** Remove a player from their House, no questions asked (used when they're knocked out). */
export function leaveHouseForced(world: World, playerId: string, t: number): void {
  const p = world.players[playerId]!
  const h = p.houseId ? world.houses[p.houseId] : undefined
  p.houseId = null
  if (!h) return
  h.members = h.members.filter((m) => m !== playerId)
  h.officers = h.officers.filter((m) => m !== playerId)
  if (!h.members.length) {
    for (const a of h.allies) {
      const other = world.houses[a.houseId]
      if (other) other.allies = other.allies.filter((x) => x.houseId !== h.id)
    }
    for (const other of Object.values(world.houses)) other.allyOffers = other.allyOffers.filter((x) => x !== h.id)
    delete world.houses[h.id]
    return
  }
  if (h.leaderId === playerId) {
    const next = h.officers[0] ?? h.members[0]!
    h.leaderId = next
    h.officers = h.officers.filter((m) => m !== next)
    report(world, next, t, `You lead ${h.name}`, `${p.name} left, and the House is yours to lead.`)
  }
}

export function leaveHouse(world: World, playerId: string, t: number): void {
  const p = world.players[playerId]!
  if (!p.houseId) fail('You are not in a House.')
  if (houseAtWar(world, p.houseId)) fail('You can’t leave your House while it is at war.')
  leaveHouseForced(world, playerId, t)
}

function myLedHouse(world: World, playerId: string, officersToo: boolean): House {
  const p = world.players[playerId]!
  if (!p.houseId) fail('You are not in a House.')
  const h = house(world, p.houseId)
  if (h.leaderId !== playerId && !(officersToo && h.officers.includes(playerId))) {
    fail(officersToo ? 'Only the leader or officers can do that.' : 'Only the House leader can do that.')
  }
  return h
}

export function setOfficer(world: World, playerId: string, memberId: string, officer: boolean): void {
  const h = myLedHouse(world, playerId, false)
  if (!h.members.includes(memberId) || memberId === playerId) fail('Pick another member of your House.')
  h.officers = h.officers.filter((m) => m !== memberId)
  if (officer) h.officers.push(memberId)
}

export function proposeAlliance(ctx: Ctx, world: World, playerId: string, otherId: string, t: number): void {
  const h = myLedHouse(world, playerId, true)
  const other = house(world, otherId)
  if (other.id === h.id) fail('That is your own House.')
  if (world.players[other.leaderId]?.isAI) fail('AI Houses don’t make alliances.')
  if (h.allies.some((a) => a.houseId === other.id)) fail('You are already allied.')
  if (h.allyOffers.includes(other.id)) {
    acceptAlliance(ctx, world, playerId, other.id, t)
    return
  }
  if (!other.allyOffers.includes(h.id)) other.allyOffers.push(h.id)
  report(world, other.leaderId, t, `${h.name} offers an alliance`, 'Accept it from the House screen.')
  notify(ctx, world, [other.leaderId, ...other.officers], 'Alliance offered', `${h.name} wants to ally with ${other.name}.`)
}

export function acceptAlliance(ctx: Ctx, world: World, playerId: string, otherId: string, t: number): void {
  const h = myLedHouse(world, playerId, true)
  const other = house(world, otherId)
  if (!h.allyOffers.includes(other.id)) fail('That House hasn’t offered an alliance.')
  const cap = allianceLimit(world.config.maxPlayers)
  if (allianceSize(world, h, other.members.length) > cap || allianceSize(world, other, h.members.length) > cap) {
    fail(`Together you'd be over the alliance cap of ${cap} players.`)
  }
  h.allyOffers = h.allyOffers.filter((x) => x !== other.id)
  other.allyOffers = other.allyOffers.filter((x) => x !== h.id)
  h.allies.push({ houseId: other.id, since: t })
  other.allies.push({ houseId: h.id, since: t })
  const all = [...h.members, ...other.members]
  for (const m of all) report(world, m, t, `${h.name} and ${other.name} are allies`, 'Allies can’t attack each other and can join each other’s battles.')
  notify(ctx, world, all, 'New alliance', `${h.name} and ${other.name} are allies.`)
}

/** Betrayal is instant. */
export function breakAlliance(ctx: Ctx, world: World, playerId: string, otherId: string, t: number): void {
  const h = myLedHouse(world, playerId, true)
  const other = house(world, otherId)
  if (!h.allies.some((a) => a.houseId === other.id)) fail('You are not allied with that House.')
  h.allies = h.allies.filter((a) => a.houseId !== other.id)
  other.allies = other.allies.filter((a) => a.houseId !== h.id)
  for (const m of [...h.members, ...other.members]) report(world, m, t, `${h.name} broke with ${other.name}`, 'The alliance is over.')
  notify(ctx, world, other.members, 'Alliance broken', `${h.name} broke the alliance with ${other.name}.`)
}

export function declineAlliance(world: World, playerId: string, otherId: string): void {
  const h = myLedHouse(world, playerId, true)
  h.allyOffers = h.allyOffers.filter((x) => x !== otherId)
}
