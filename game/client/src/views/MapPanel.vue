<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { MAP_SIZE, sameSide, type World } from '@stillmarch/shared'
import RegionSheet from '../components/RegionSheet.vue'
import { state, worldTime } from '../store.ts'

const v = computed(() => state.view!)
const meId = computed(() => v.value.me.id)
const svg = ref<SVGSVGElement | null>(null)
const box = reactive({ w: 360, h: 600 })
const cam = reactive({ x: 0, y: 0, w: MAP_SIZE })
const selected = ref<number | null>(null)

// A stand-in world with just what the side checks need.
const lite = computed(() => ({
  players: Object.fromEntries(v.value.players.map((p) => [p.id, p])),
  houses: Object.fromEntries(v.value.houses.map((h) => [h.id, h])),
}) as unknown as World)

function side(ownerId: string | null): 'none' | 'me' | 'ally' | 'foe' {
  if (!ownerId) return 'none'
  if (ownerId === meId.value) return 'me'
  return sameSide(lite.value, meId.value, ownerId) ? 'ally' : 'foe'
}

const camH = computed(() => cam.w * (box.h / box.w))
const viewBox = computed(() => `${cam.x} ${cam.y} ${cam.w} ${camH.value}`)
const zoom = computed(() => MAP_SIZE / cam.w)

function centreOn(id: number, w = 420) {
  const r = v.value.regions[id]
  if (!r) return
  cam.w = w
  cam.x = r.x - w / 2
  cam.y = r.y - (w * (box.h / box.w)) / 2
}

function measure() {
  const el = svg.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  box.w = Math.max(1, rect.width)
  box.h = Math.max(1, rect.height)
}

let ro: ResizeObserver | null = null
onMounted(() => {
  measure()
  ro = new ResizeObserver(measure)
  if (svg.value) ro.observe(svg.value)
  if (state.focusRegion !== null) {
    selected.value = state.focusRegion
    centreOn(state.focusRegion)
    state.focusRegion = null
  } else {
    centreOn(v.value.me.homeRegion, 600)
  }
})
onBeforeUnmount(() => ro?.disconnect())

// ---------- Pan and pinch ----------
const pointers = new Map<number, { x: number; y: number }>()
let moved = 0
let pinchStart: { dist: number; w: number; cx: number; cy: number } | null = null

function toMap(clientX: number, clientY: number) {
  const rect = svg.value!.getBoundingClientRect()
  return { x: cam.x + ((clientX - rect.left) / rect.width) * cam.w, y: cam.y + ((clientY - rect.top) / rect.height) * camH.value }
}

function zoomAt(clientX: number, clientY: number, newW: number) {
  const w = Math.min(MAP_SIZE * 1.4, Math.max(140, newW))
  const p = toMap(clientX, clientY)
  const fx = (p.x - cam.x) / cam.w
  const fy = (p.y - cam.y) / camH.value
  cam.w = w
  cam.x = p.x - fx * w
  cam.y = p.y - fy * (w * (box.h / box.w))
}

function down(e: PointerEvent) {
  svg.value?.setPointerCapture(e.pointerId)
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
  moved = 0
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()] as [{ x: number; y: number }, { x: number; y: number }]
    pinchStart = { dist: Math.hypot(a.x - b.x, a.y - b.y), w: cam.w, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 }
  }
}

function move(e: PointerEvent) {
  const prev = pointers.get(e.pointerId)
  if (!prev) return
  const next = { x: e.clientX, y: e.clientY }
  pointers.set(e.pointerId, next)
  if (pointers.size === 1) {
    const dx = ((next.x - prev.x) / box.w) * cam.w
    const dy = ((next.y - prev.y) / box.h) * camH.value
    cam.x -= dx
    cam.y -= dy
    moved += Math.abs(next.x - prev.x) + Math.abs(next.y - prev.y)
  } else if (pointers.size === 2 && pinchStart) {
    const [a, b] = [...pointers.values()] as [{ x: number; y: number }, { x: number; y: number }]
    const d = Math.hypot(a.x - b.x, a.y - b.y)
    zoomAt(pinchStart.cx, pinchStart.cy, pinchStart.w * (pinchStart.dist / Math.max(1, d)))
    moved += 10
  }
}

function up(e: PointerEvent) {
  pointers.delete(e.pointerId)
  if (pointers.size < 2) pinchStart = null
}

function wheel(e: WheelEvent) {
  e.preventDefault()
  zoomAt(e.clientX, e.clientY, cam.w * (e.deltaY > 0 ? 1.15 : 1 / 1.15))
}

function pick(id: number) {
  if (moved > 8) return
  selected.value = id
}

watch(() => state.focusRegion, (id) => {
  if (id === null) return
  selected.value = id
  centreOn(id)
  state.focusRegion = null
})

// ---------- What's drawn ----------
const regions = computed(() => v.value.regions)
const roads = computed(() =>
  v.value.roads.map((r) => {
    const a = regions.value[r.a]!
    const b = regions.value[r.b]!
    return { ...r, x1: a.x, y1: a.y, x2: b.x, y2: b.y, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 }
  }),
)

const riverPath = computed(() => {
  const pts = v.value.river
  if (pts.length < 2) return ''
  let d = `M${pts[0]!.x},${pts[0]!.y}`
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i]!
    const n = pts[i + 1]!
    d += ` Q${p.x},${p.y} ${(p.x + n.x) / 2},${(p.y + n.y) / 2}`
  }
  const last = pts[pts.length - 1]!
  return `${d} T${last.x},${last.y}`
})

const warRegions = computed(() => new Set(v.value.wars.filter((w) => w.state !== 'done').map((w) => w.regionId)))

const TERRAIN_FILL: Record<string, string> = { plains: '#2b3326', forest: '#1f3022', hills: '#33302a', mountains: '#2c2f36' }

function lerpPos(at: number, next: number | null | undefined, dep: number | null, arr: number | null, offset: number) {
  const a = regions.value[at]!
  if (next === null || next === undefined || dep === null || arr === null) {
    const ang = offset * 2.4
    return { x: a.x + Math.cos(ang) * 22, y: a.y + Math.sin(ang) * 22, moving: false }
  }
  const b = regions.value[next]!
  const f = Math.min(1, Math.max(0, (worldTime.value - dep) / Math.max(1, arr - dep)))
  return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, moving: true }
}

const tokens = computed(() => {
  const list: { id: string; x: number; y: number; kind: 'me' | 'ally' | 'foe'; moving: boolean; label: string }[] = []
  let i = 0
  for (const a of v.value.armies) {
    const p = lerpPos(a.at, a.arriveAt !== null ? a.path[0] : null, a.departedAt, a.arriveAt, i++)
    list.push({ id: a.id, ...p, kind: a.own ? 'me' : 'ally', label: '' })
  }
  for (const a of v.value.others) {
    const p = lerpPos(a.at, a.next, a.departedAt, a.arriveAt, i++)
    list.push({ id: a.id, ...p, kind: 'foe', label: a.size })
  }
  return list
})

const quarterLabels = [
  { name: 'Northreach', x: 500, y: 70 },
  { name: 'Eastwood', x: 900, y: 500 },
  { name: 'Southmere', x: 500, y: 950 },
  { name: 'Heartland', x: 500, y: 420 },
]

function ownerName(id: string | null): string {
  return v.value.players.find((p) => p.id === id)?.name ?? ''
}
</script>

<template>
  <div class="mapwrap">
    <svg
      ref="svg"
      class="map"
      :viewBox="viewBox"
      role="application"
      aria-label="Map of Valdris. Drag to move, pinch or scroll to zoom, tap a region."
      @pointerdown="down"
      @pointermove="move"
      @pointerup="up"
      @pointercancel="up"
      @wheel="wheel"
    >
      <defs>
        <radialGradient id="land" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#1d211c" />
          <stop offset="85%" stop-color="#161915" />
          <stop offset="100%" stop-color="#0f1118" />
        </radialGradient>
      </defs>
      <circle :cx="MAP_SIZE / 2" :cy="MAP_SIZE / 2" :r="MAP_SIZE * 0.51" fill="url(#land)" />
      <text v-for="q in quarterLabels" :key="q.name" :x="q.x" :y="q.y" class="quarter" text-anchor="middle">{{ q.name }}</text>
      <path :d="riverPath" class="river" />
      <g class="roads">
        <line v-for="(r, i) in roads" :key="i" :x1="r.x1" :y1="r.y1" :x2="r.x2" :y2="r.y2" :class="{ ford: r.river }" />
        <circle v-for="(r, i) in roads.filter((x) => x.river)" :key="`f${i}`" :cx="r.mx" :cy="r.my" r="4" class="bridge" />
      </g>
      <g v-for="r in regions" :key="r.id" class="region" :class="[`side-${side(r.ownerId)}`, r.kind, { sel: selected === r.id, village: !!r.villageOf && !!ownerName(r.villageOf) }]" @click="pick(r.id)">
        <circle v-if="r.kind === 'blight'" :cx="r.x" :cy="r.y" r="34" class="blight-haze" />
        <circle :cx="r.x" :cy="r.y" r="26" class="hit" />
        <circle :cx="r.x" :cy="r.y" :r="r.villageOf && ownerName(r.villageOf) ? 15 : 11" :fill="r.kind === 'blight' ? '#2a1d3a' : r.kind === 'fortress' ? '#1a1416' : TERRAIN_FILL[r.terrain]" class="node" />
        <path v-if="r.kind === 'fortress'" :d="`M${r.x - 6},${r.y + 5} v-8 l3,2 v-3 l3,-2 l3,2 v3 l3,-2 v8 Z`" class="glyph fort" />
        <path v-else-if="r.villageOf && ownerName(r.villageOf)" :d="`M${r.x - 7},${r.y + 5} v-6 l7,-5 l7,5 v6 Z`" class="glyph" />
        <path v-else-if="r.kind === 'open'" :d="`M${r.x - 1.5},${r.y + 6} l0.6,-10 h1.8 l0.6,10 Z M${r.x - 2.5},${r.y - 5} l2.5,-4 l2.5,4 Z`" class="glyph obelisk" />
        <circle v-if="warRegions.has(r.id)" :cx="r.x" :cy="r.y" r="20" class="war-ring" />
        <text v-if="zoom > 1.6 || r.villageOf || r.kind !== 'open'" :x="r.x" :y="r.y + 28" class="label" text-anchor="middle" :style="{ fontSize: `${Math.max(9, 13 / Math.sqrt(zoom))}px` }">{{ r.name }}</text>
      </g>
      <g class="tokens">
        <g v-for="t in tokens" :key="t.id" :class="['token', t.kind, { moving: t.moving }]">
          <path :d="`M${t.x},${t.y - 8} l7,12 h-14 Z`" />
          <text v-if="t.label && zoom > 1.4" :x="t.x" :y="t.y - 11" text-anchor="middle" class="tlabel">{{ t.label }}</text>
        </g>
      </g>
    </svg>

    <div class="legend ui">
      <span><i class="sw me"></i>You</span>
      <span><i class="sw ally"></i>Your side</span>
      <span><i class="sw foe"></i>Others</span>
      <button class="btn ghost small" @click="centreOn(v.me.homeRegion, 600)">Home</button>
    </div>

    <RegionSheet v-if="selected !== null" :region-id="selected" @close="selected = null" />
  </div>
</template>

<style scoped>
.mapwrap {
  position: fixed;
  inset: 0;
  top: 0;
  z-index: 10;
  padding-top: calc(118px + env(safe-area-inset-top));
  padding-bottom: calc(var(--tabbar) + env(safe-area-inset-bottom));
  background: var(--bg);
}
.map {
  width: 100%;
  height: 100%;
  touch-action: none;
  user-select: none;
  display: block;
}
.quarter {
  font-family: var(--font-display);
  font-size: 26px;
  letter-spacing: 0.25em;
  fill: #b8966a33;
  pointer-events: none;
}
.river {
  fill: none;
  stroke: #2d4a6a;
  stroke-width: 9;
  stroke-linecap: round;
  opacity: 0.8;
}
.roads line {
  stroke: #6d6450;
  stroke-width: 2.2;
  stroke-dasharray: 6 4;
  opacity: 0.8;
}
.roads line.ford {
  stroke: #8a7a5a;
}
.bridge {
  fill: #0f1118;
  stroke: #a39270;
  stroke-width: 1.5;
}
.region {
  cursor: pointer;
}
.hit {
  fill: transparent;
}
.node {
  stroke: #4a4f5c;
  stroke-width: 1.5;
}
.side-me .node {
  stroke: var(--accent-strong);
  stroke-width: 3;
}
.side-ally .node {
  stroke: var(--glow);
  stroke-width: 3;
}
.side-foe .node {
  stroke: var(--bad);
  stroke-width: 3;
}
.region.sel .node {
  stroke: #fff;
  stroke-width: 3.5;
}
.glyph {
  fill: #b9b0a0;
  pointer-events: none;
}
.glyph.fort {
  fill: #b05a4e;
}
.glyph.obelisk {
  fill: #8d8778;
}
.side-me .glyph {
  fill: var(--accent-strong);
}
.blight-haze {
  fill: #b57cff22;
  stroke: #b57cff55;
  stroke-dasharray: 3 5;
}
.war-ring {
  fill: none;
  stroke: var(--bad);
  stroke-width: 2;
  stroke-dasharray: 4 3;
  animation: spin 6s linear infinite;
  transform-box: fill-box;
  transform-origin: center;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.label {
  fill: var(--ink-dim);
  font-family: var(--font-ui);
  pointer-events: none;
  paint-order: stroke;
  stroke: #0f1118;
  stroke-width: 3px;
}
.token path {
  stroke: #0f1118;
  stroke-width: 1.5;
}
.token.me path {
  fill: var(--accent-strong);
}
.token.ally path {
  fill: var(--glow);
}
.token.foe path {
  fill: var(--bad);
}
.tlabel {
  font-family: var(--font-ui);
  font-size: 10px;
  fill: var(--bad);
  paint-order: stroke;
  stroke: #0f1118;
  stroke-width: 3px;
}
.legend {
  position: absolute;
  padding: 0.25rem 0.5rem;
  border-radius: 8px;
  background: #0f1118b3;
  left: 12px;
  right: 12px;
  top: calc(124px + env(safe-area-inset-top));
  display: flex;
  gap: 0.75rem;
  align-items: center;
  font-size: 0.75rem;
  color: var(--ink-dim);
  pointer-events: none;
}
.legend .btn {
  margin-left: auto;
  pointer-events: auto;
  background: #0f1118cc;
}
.sw {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  margin-right: 4px;
  vertical-align: -1px;
}
.sw.me {
  background: var(--accent-strong);
}
.sw.ally {
  background: var(--glow);
}
.sw.foe {
  background: var(--bad);
}
@media (prefers-reduced-motion: reduce) {
  .war-ring {
    animation: none;
  }
}
</style>
