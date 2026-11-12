// Builds a world map from a seed: regions joined by roads, like a board game.
// Layout: Heartland in the centre and west, Northreach, Eastwood and Southmere around it,
// player villages in a ring, the richest regions in the centre, Blight in two far corners.

import { FORTRESS } from '../data/balance.ts'
import type { Fortress, Quarter, Region, RegionBonus, Road, Terrain } from '../types.ts'
import { emptyUnits, makeRng } from './util.ts'

export const MAP_SIZE = 1000

const NAMES = [
  'Ashford', 'Greywatch', 'Hollowmere', 'Kettlebridge', 'Larkspur', 'Marrowdale', 'Nettlefield',
  'Oakhallow', 'Pellmoor', 'Quillstone', 'Ravensgate', 'Saltmarsh', 'Thornbury', 'Umberfell',
  'Vellacourt', 'Wrenwood', 'Yarrowby', 'Brackenholt', 'Cinderleigh', 'Dunmarrow', 'Elderstead',
  'Fallowdeep', 'Gallowfen', 'Harrowgate', 'Ironbrook', 'Juniper Cross', 'Kingsfold',
  'Lanternhill', 'Mossbank', 'Northwold', 'Owlscar', 'Pikehollow', 'Rookcliff', 'Stonewake',
  'Tallowmere', 'Underhay', 'Vesper Hill', 'Whitlow', 'Yewcombe', 'Amberleigh', 'Barrowmoor',
  'Coldharbour', 'Duskwater', 'Emberly', 'Foxholt', 'Gildenford', 'Heathrow End', 'Ivyreach',
  'Jackdaw Ford', 'Knightsmere', 'Lowmarch', 'Millbrook', 'Nightingale', 'Orchard Rise',
  'Pennywell', 'Redfern', 'Sorrowby', 'Tidewell', 'Upper Stillwater', 'Wychwood', 'Brindle Tor',
  'Candlemoor', 'Driftwell', 'Eastbarrow',
]

const BLIGHT_NAMES = ['The Grey Hush', 'Rotwater Reach', 'The Pale Scar', 'Witherfold']
const FORTRESS_NAMES = ['Blackspire Keep', 'The Hollow Bastion', 'Ruin of Saint Vey', 'Drowned Tower',
  'The Ashen Cloister', 'Cairnhold', 'The Sunken Hall', 'Mourning Gate', 'Gravelmoor Fort']

export interface MapResult {
  regions: Region[]
  roads: Road[]
  river: { x: number; y: number }[]
}

interface Pt {
  x: number
  y: number
}

function dist(a: Pt, b: Pt): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function quarterOf(p: Pt): Quarter {
  const cx = p.x - MAP_SIZE / 2
  const cy = p.y - MAP_SIZE / 2
  if (Math.hypot(cx, cy) < MAP_SIZE * 0.2) return 'Heartland'
  const angle = (Math.atan2(cy, cx) * 180) / Math.PI // 0 = east, 90 = south
  if (angle >= -135 && angle < -45) return 'Northreach'
  if (angle >= -45 && angle < 45) return 'Eastwood'
  if (angle >= 45 && angle < 135) return 'Southmere'
  return 'Heartland'
}

function segmentsCross(a: Pt, b: Pt, c: Pt, d: Pt): boolean {
  const o = (p: Pt, q: Pt, r: Pt) => Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x))
  return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0
}

export function generateMap(seed: number, count: number, villageSlots: number): MapResult {
  const rand = makeRng(seed)
  const pick = <T>(list: T[]): T => list[Math.floor(rand() * list.length)] as T
  const c = MAP_SIZE / 2

  // 1. Village slots: an even ring, plus an outer ring for late joiners.
  const points: (Pt & { slot: 'ring' | 'edge' | null })[] = []
  const ringR = MAP_SIZE * 0.33
  const turn = rand() * Math.PI * 2
  for (let i = 0; i < villageSlots; i++) {
    const a = turn + (i / villageSlots) * Math.PI * 2
    points.push({ x: c + Math.cos(a) * ringR, y: c + Math.sin(a) * ringR, slot: 'ring' })
  }
  const edgeSlots = Math.max(4, Math.ceil(villageSlots / 3))
  for (let i = 0; i < edgeSlots; i++) {
    const a = turn + ((i + 0.5) / edgeSlots) * Math.PI * 2
    points.push({ x: c + Math.cos(a) * MAP_SIZE * 0.45, y: c + Math.sin(a) * MAP_SIZE * 0.45, slot: 'edge' })
  }

  // 2. Fill the rest with spread-out points inside the circle.
  const minGap = Math.sqrt((Math.PI * (MAP_SIZE * 0.47) ** 2) / Math.max(count, 1)) * 0.75
  let tries = 0
  while (points.length < count && tries < 20000) {
    tries++
    const a = rand() * Math.PI * 2
    const r = Math.sqrt(rand()) * MAP_SIZE * 0.47
    const p = { x: c + Math.cos(a) * r, y: c + Math.sin(a) * r, slot: null }
    if (points.every((q) => dist(p, q) > minGap * (q.slot ? 1.1 : 1))) points.push(p)
  }

  // 3. Roads: the minimum spanning tree (it never crosses itself), then short extra roads.
  const n = points.length
  const pairs: [number, number, number][] = []
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) pairs.push([i, j, dist(points[i]!, points[j]!)])
  }
  pairs.sort((p, q) => p[2] - q[2])
  const parent = points.map((_, i) => i)
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i]!)))
  const edges: [number, number][] = []
  const degree = new Array<number>(n).fill(0)
  const crosses = (i: number, j: number) =>
    edges.some(([a, b]) => a !== i && a !== j && b !== i && b !== j &&
      segmentsCross(points[i]!, points[j]!, points[a]!, points[b]!))
  for (const [i, j] of pairs) {
    if (find(i) !== find(j)) {
      parent[find(i)] = find(j)
      edges.push([i, j])
      degree[i]!++
      degree[j]!++
    }
  }
  const maxRoad = minGap * 2.1
  for (const [i, j, d] of pairs) {
    if (d > maxRoad) break
    if (degree[i]! >= 4 || degree[j]! >= 4) continue
    if (edges.some(([a, b]) => (a === i && b === j) || (a === j && b === i))) continue
    if (crosses(i, j)) continue
    edges.push([i, j])
    degree[i]!++
    degree[j]!++
  }

  // 4. A river from one side of the map to the other, bending through the middle.
  const river: Pt[] = []
  const ra = rand() * Math.PI
  const start = { x: c + Math.cos(ra) * MAP_SIZE * 0.55, y: c + Math.sin(ra) * MAP_SIZE * 0.55 }
  const end = { x: c - Math.cos(ra) * MAP_SIZE * 0.55, y: c - Math.sin(ra) * MAP_SIZE * 0.55 }
  const bend = (rand() - 0.5) * MAP_SIZE * 0.35
  for (let i = 0; i <= 12; i++) {
    const t = i / 12
    const wobble = Math.sin(t * Math.PI) * bend + Math.sin(t * Math.PI * 3 + ra) * 25
    river.push({
      x: start.x + (end.x - start.x) * t + Math.cos(ra + Math.PI / 2) * wobble,
      y: start.y + (end.y - start.y) * t + Math.sin(ra + Math.PI / 2) * wobble,
    })
  }
  const crossesRiver = (a: Pt, b: Pt) => river.some((p, k) => k > 0 && segmentsCross(a, b, river[k - 1]!, p))

  // 5. Region kinds: Blight in the two corners furthest out, fortresses spread around.
  const kinds: Region['kind'][] = points.map(() => 'open')
  const free = (i: number) => !points[i]!.slot && kinds[i] === 'open'
  const byFar = [...points.keys()].filter(free).sort((i, j) => dist(points[j]!, { x: c, y: c }) - dist(points[i]!, { x: c, y: c }))
  const blights: number[] = []
  for (const i of byFar) {
    if (blights.length >= 2) break
    if (blights.every((b) => dist(points[b]!, points[i]!) > MAP_SIZE * 0.6)) {
      blights.push(i)
      kinds[i] = 'blight'
    }
  }
  const fortressLevel: Record<number, 1 | 2 | 3> = {}
  const quarters: Quarter[] = ['Northreach', 'Eastwood', 'Southmere', 'Heartland']
  // One level 2 fortress in each quarter, a level 3 near the centre, level 1 camps by the ring.
  for (const q of quarters) {
    const options = [...points.keys()].filter((i) => free(i) && quarterOf(points[i]!) === q &&
      dist(points[i]!, { x: c, y: c }) > MAP_SIZE * 0.22)
    if (options.length) {
      const i = pick(options)
      kinds[i] = 'fortress'
      fortressLevel[i] = 2
    }
  }
  const centre = [...points.keys()].filter(free).sort((i, j) => dist(points[i]!, { x: c, y: c }) - dist(points[j]!, { x: c, y: c }))
  if (centre[1] !== undefined) {
    kinds[centre[1]] = 'fortress'
    fortressLevel[centre[1]] = 3
  }
  const camps = Math.max(2, Math.round(villageSlots / 4))
  const ringNear = [...points.keys()].filter((i) => free(i) &&
    Math.abs(dist(points[i]!, { x: c, y: c }) - ringR) < MAP_SIZE * 0.12)
  for (let k = 0; k < camps && ringNear.length; k++) {
    const idx = Math.floor(rand() * ringNear.length)
    const i = ringNear.splice(idx, 1)[0]!
    if (Object.keys(fortressLevel).some((f) => dist(points[Number(f)]!, points[i]!) < minGap * 1.6)) continue
    kinds[i] = 'fortress'
    fortressLevel[i] = 1
  }

  // 6. Terrain and bonuses. Richer bonuses towards the centre.
  const terrainBias: Record<Quarter, Terrain[]> = {
    Northreach: ['mountains', 'mountains', 'hills', 'forest', 'plains'],
    Eastwood: ['forest', 'forest', 'forest', 'hills', 'plains'],
    Southmere: ['plains', 'plains', 'hills', 'forest', 'hills'],
    Heartland: ['plains', 'forest', 'hills', 'plains', 'mountains'],
  }
  const terrainRes = { forest: 'wood', hills: 'stone', mountains: 'iron', plains: 'food' } as const

  const names = [...NAMES]
  const regions: Region[] = points.map((p, i) => {
    const quarter = quarterOf(p)
    const terrain = pick(terrainBias[quarter])
    const kind = kinds[i]!
    let name: string
    if (kind === 'blight') name = BLIGHT_NAMES[blights.indexOf(i)] ?? 'The Blight'
    else if (kind === 'fortress') name = FORTRESS_NAMES.splice(Math.floor(rand() * FORTRESS_NAMES.length), 1)[0] ?? 'Forgotten Hold'
    else name = names.splice(Math.floor(rand() * names.length), 1)[0] ?? `Region ${i + 1}`
    let bonus: RegionBonus | null = null
    if (kind === 'open') {
      const central = dist(p, { x: c, y: c }) < MAP_SIZE * 0.2
      const roll = rand()
      if (roll < 0.15) bonus = { kind: 'troopCap', amount: central ? 40 : 20 }
      else if (roll < 0.25) bonus = { kind: 'march', pct: central ? 15 : 10 }
      else bonus = { kind: 'production', res: terrainRes[terrain], pct: central ? 25 : 10 }
    }
    let fortress: Fortress | null = null
    const lvl = fortressLevel[i]
    if (kind === 'fortress' && lvl) {
      const g = { ...emptyUnits(), ...FORTRESS[lvl].garrison }
      fortress = { level: lvl, garrison: { ...g }, maxGarrison: g, garrisonAt: 0 }
    }
    return {
      id: i,
      name,
      x: Math.round(p.x),
      y: Math.round(p.y),
      kind,
      terrain: kind === 'blight' ? 'plains' : terrain,
      quarter,
      slot: p.slot,
      bonus,
      ownerId: null,
      villageOf: null,
      fortress,
    }
  })

  const roads: Road[] = edges.map(([a, b]) => ({
    a,
    b,
    length: Math.round(dist(points[a]!, points[b]!)),
    river: crossesRiver(points[a]!, points[b]!),
  }))

  return { regions, roads, river: river.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y) })) }
}
