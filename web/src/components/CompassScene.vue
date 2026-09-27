<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

const canvas = ref<HTMLCanvasElement>()
const haze = ref<HTMLDivElement>()

let cleanup: (() => void) | undefined

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a))
  return t * t * (3 - 2 * t)
}
const easeOutBack = (x: number) => 1 + 2.70158 * Math.pow(x - 1, 3) + 1.70158 * Math.pow(x - 1, 2)

// Soft round sprite, shared by the core halo and the ash particles.
function makeGlowTexture() {
  const size = 128
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')!
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.25, 'rgba(255,255,255,0.6)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

// Symmetric plate along +y, given [halfWidth, y] pairs from base to tip.
function makeBladeShape(profile: [number, number][]) {
  const shape = new THREE.Shape()
  profile.forEach(([hw, y], i) => (i === 0 ? shape.moveTo(-hw, y) : shape.lineTo(-hw, y)))
  for (let i = profile.length - 1; i >= 0; i--) {
    const [hw, y] = profile[i]!
    if (hw > 0) shape.lineTo(hw, y) // a zero-width tip is already on the path
  }
  shape.closePath()
  return shape
}

function makeAnnulus(outer: number, inner: number) {
  const shape = new THREE.Shape()
  shape.absarc(0, 0, outer, 0, Math.PI * 2, false)
  if (inner > 0) {
    const hole = new THREE.Path()
    hole.absarc(0, 0, inner, 0, Math.PI * 2, true)
    shape.holes.push(hole)
  }
  return shape
}

// Thin bar between two points in the compass plane.
function makeBar(a: THREE.Vector2, b: THREE.Vector2, width: number, depth: number, mat: THREE.Material) {
  const len = a.distanceTo(b)
  const bar = new THREE.Mesh(new THREE.BoxGeometry(width, len, depth), mat)
  bar.position.set((a.x + b.x) / 2, (a.y + b.y) / 2, 0)
  bar.rotation.z = Math.atan2(b.y - a.y, b.x - a.x) - Math.PI / 2
  return bar
}

onMounted(() => {
  const el = canvas.value!
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const renderer = new THREE.WebGLRenderer({ canvas: el, antialias: true, alpha: false })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05

  const bg = new THREE.Color('#0f1118')
  const fog = new THREE.FogExp2(bg.clone(), 0.06)
  const scene = new THREE.Scene()
  scene.background = bg.clone()
  scene.fog = fog

  const pmrem = new THREE.PMREMGenerator(renderer)
  const envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  scene.environment = envMap
  scene.environmentIntensity = 0.5

  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100)
  camera.position.set(0, 0, 9)

  // Lights: warm key from above, cold blue from the compass core.
  scene.add(new THREE.AmbientLight('#8090b0', 0.25))
  const key = new THREE.DirectionalLight('#ffe2b8', 1.6)
  key.position.set(3, 5, 4)
  scene.add(key)

  const glowTex = makeGlowTexture()

  // --- Compass -------------------------------------------------------------
  const compass = new THREE.Group()
  scene.add(compass)

  const coreLight = new THREE.PointLight('#a9c2ff', 3, 6, 1.6)
  coreLight.position.z = 1.2 // a little in front, so the glow rakes across the plates
  compass.add(coreLight)

  // Built after the logo: flat, outlined steel plates with bronze inlay.
  const steel = new THREE.MeshStandardMaterial({ color: '#c9ced9', metalness: 0.95, roughness: 0.28 })
  const bronze = new THREE.MeshStandardMaterial({ color: '#b8966a', metalness: 0.9, roughness: 0.35 })
  const inset = new THREE.MeshStandardMaterial({ color: '#1a1e29', metalness: 0.7, roughness: 0.5 })

  const plate = (shape: THREE.Shape, depth: number, mat: THREE.Material, z = 0) => {
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: true,
      bevelThickness: 0.012,
      bevelSize: 0.01,
      bevelSegments: 2,
      curveSegments: 64,
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.z = z
    return mesh
  }

  const TIP_RING = 2.36 // distance of the small end rings from the centre

  // Cardinal blades: long, slightly flared, with a notched arrowhead tip.
  const bladeShape = makeBladeShape([[0.07, 0.6], [0.105, 1.68], [0.08, 1.8], [0.1, 1.86], [0, 2.25]])
  const bladeInset = makeBladeShape([[0.035, 0.72], [0.06, 1.64], [0.04, 1.76]])
  const tipInset = makeBladeShape([[0.05, 1.9], [0, 2.14]])
  const blades = new THREE.Group()
  for (let k = 0; k < 4; k++) {
    const arm = new THREE.Group()
    arm.rotation.z = (k * Math.PI) / 2
    arm.add(plate(bladeShape, 0.05, steel))
    arm.add(plate(bladeInset, 0.02, inset, 0.05))
    arm.add(plate(tipInset, 0.02, inset, 0.05))
    const line = makeBar(new THREE.Vector2(0, 0.74), new THREE.Vector2(0, 1.62), 0.014, 0.02, bronze)
    line.position.z = 0.085
    arm.add(line)
    // Collar where the blade meets the hub.
    const collar = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.09, 0.1), steel)
    collar.position.set(0, 0.68, 0.04)
    arm.add(collar)
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.095, 0.02, 16, 48), steel)
    ring.position.set(0, TIP_RING, 0.03)
    arm.add(ring)
    blades.add(arm)
  }
  compass.add(blades)

  // Diagonal needles between the blades.
  const needleShape = makeBladeShape([[0.045, 0.45], [0.03, 0.9], [0, 1.18]])
  const needleInset = makeBladeShape([[0.018, 0.55], [0, 0.95]])
  for (let k = 0; k < 4; k++) {
    const arm = new THREE.Group()
    arm.rotation.z = Math.PI / 4 + (k * Math.PI) / 2
    arm.add(plate(needleShape, 0.035, steel))
    arm.add(plate(needleInset, 0.015, inset, 0.035))
    compass.add(arm)
  }

  // Hub: outer rim, engraved dial band, then two inner rings round the core.
  const hub = new THREE.Group()
  hub.position.z = 0.04
  hub.add(plate(makeAnnulus(0.46, 0), 0.06, inset))
  hub.add(plate(makeAnnulus(0.66, 0.56), 0.08, steel))
  hub.add(plate(makeAnnulus(0.56, 0.44), 0.05, inset))
  hub.add(plate(makeAnnulus(0.46, 0.42), 0.08, steel))
  hub.add(plate(makeAnnulus(0.3, 0.25), 0.12, steel))
  hub.add(plate(makeAnnulus(0.21, 0.175), 0.14, steel))
  const dialTick = new THREE.BoxGeometry(0.007, 0.05, 0.012)
  for (let i = 0; i < 96; i++) {
    const a = (i / 96) * Math.PI * 2
    const t = new THREE.Mesh(dialTick, bronze)
    const r = i % 8 === 0 ? 0.5 : 0.52
    t.position.set(Math.cos(a) * r, Math.sin(a) * r, 0.07)
    t.rotation.z = a - Math.PI / 2
    t.scale.y = i % 8 === 0 ? 1.8 : 1
    hub.add(t)
  }
  compass.add(hub)

  // Gold diamond joining the four end rings.
  const corners = [0, 1, 2, 3].map((k) => {
    const a = Math.PI / 2 + (k * Math.PI) / 2
    return new THREE.Vector2(Math.cos(a) * TIP_RING, Math.sin(a) * TIP_RING)
  })
  corners.forEach((c, k) => {
    const next = corners[(k + 1) % 4]!
    // Stop short of each ring so the line meets its rim, not its centre.
    const dir = next.clone().sub(c).normalize().multiplyScalar(0.115)
    compass.add(makeBar(c.clone().add(dir), next.clone().sub(dir), 0.016, 0.016, bronze))
  })

  // Outer circle, broken just east of south as in the logo.
  const circle = new THREE.Mesh(
    new THREE.TorusGeometry(2.2, 0.014, 12, 256, Math.PI * 2 * (343 / 360)),
    bronze,
  )
  circle.rotation.z = THREE.MathUtils.degToRad(-76)
  compass.add(circle)

  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.1, 32, 16),
    new THREE.MeshBasicMaterial({ color: '#eef3ff', toneMapped: false, fog: false }),
  )
  core.position.z = 0.2
  compass.add(core)

  const halo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTex,
      color: '#a9c2ff',
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  )
  halo.scale.setScalar(1.1)
  halo.position.z = 0.26
  compass.add(halo)

  // --- The Blight ----------------------------------------------------------
  // Scrolling down, the Blight creeps in: purple air, violet crystals rising
  // from below, tarnished metal, and the core's cold blue turning violet.
  const crystalMat = new THREE.MeshStandardMaterial({
    color: '#6b3fa8',
    emissive: '#7b3fe0',
    emissiveIntensity: 0.6,
    metalness: 0.1,
    roughness: 0.15,
    flatShading: true,
  })
  const shardGeo = new THREE.OctahedronGeometry(0.5, 0)
  shardGeo.scale(0.35, 1.6, 0.35)
  shardGeo.translate(0, 0.8, 0) // pivot at the base, so shards grow upward

  type Crystal = { group: THREE.Group; threshold: number }
  const crystals: Crystal[] = []
  const blightLayer = new THREE.Group()
  scene.add(blightLayer)
  const CLUSTERS = 22
  for (let i = 0; i < CLUSTERS; i++) {
    const cluster = new THREE.Group()
    // Spread across the lower half and edges, clear of the compass itself.
    const side = i % 2 === 0 ? 1 : -1
    const x = side * (2.2 + Math.random() * 6.5)
    const y = -5.5 + Math.random() * 7
    const z = -1 - Math.random() * 5
    cluster.position.set(x, y, z)
    const shards = 3 + Math.floor(Math.random() * 4)
    for (let s = 0; s < shards; s++) {
      const shard = new THREE.Mesh(shardGeo, crystalMat)
      shard.rotation.set((Math.random() - 0.5) * 0.9, Math.random() * Math.PI, (Math.random() - 0.5) * 0.9)
      shard.scale.setScalar(0.5 + Math.random() * 0.9)
      cluster.add(shard)
    }
    blightLayer.add(cluster)
    // Lower clusters are taken first: the Blight rises from the ground.
    crystals.push({ group: cluster, threshold: clamp01((y + 5.5) / 7) * 0.75 + Math.random() * 0.1 })
  }
  const blightLight = new THREE.PointLight('#8a4dff', 0, 16, 1.4)
  blightLight.position.set(0, -4.5, 1)
  scene.add(blightLight)

  // Colours the Blight pulls the scene toward.
  const clean = {
    bg: bg.clone(),
    steel: steel.color.clone(),
    bronze: bronze.color.clone(),
    glow: new THREE.Color('#a9c2ff'),
    core: new THREE.Color('#eef3ff'),
    ash: new THREE.Color('#dcbd90'),
  }
  const blighted = {
    bg: new THREE.Color('#1b0f26'),
    steel: new THREE.Color('#8a7f9a'),
    bronze: new THREE.Color('#7d6470'),
    glow: new THREE.Color('#b57cff'),
    core: new THREE.Color('#e7d4ff'),
    ash: new THREE.Color('#b98cff'),
  }

  // --- Drifting ash --------------------------------------------------------
  const ashCount = window.innerWidth < 700 ? 900 : 1800
  const positions = new Float32Array(ashCount * 3)
  const speeds = new Float32Array(ashCount)
  for (let i = 0; i < ashCount; i++) {
    const r = 1.5 + Math.random() * 12
    const a = Math.random() * Math.PI * 2
    positions[i * 3] = Math.cos(a) * r
    positions[i * 3 + 1] = (Math.random() - 0.5) * 20
    positions[i * 3 + 2] = Math.sin(a) * r - 2
    speeds[i] = 0.1 + Math.random() * 0.35
  }
  const ashGeo = new THREE.BufferGeometry()
  ashGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  const ashMat = new THREE.PointsMaterial({
    size: 0.07,
    map: glowTex,
    color: clean.ash.clone(),
    transparent: true,
    opacity: 0.7,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  })
  const ash = new THREE.Points(ashGeo, ashMat)
  scene.add(ash)

  // --- Scroll + pointer ----------------------------------------------------
  let scrollTarget = 0
  let scroll = 0
  const pointer = { x: 0, y: 0 }
  const pointerSmooth = { x: 0, y: 0 }

  // Sections declare where the compass should make room for their text with
  // data-compass-side: 1 = panel on the left, -1 = panel on the right,
  // 0 = centred. Wide screens slide the compass part-way into the free half;
  // portrait screens (phones) lift it above the bottom text sheet instead.
  const SIDE_SHIFT = 0.28 // fraction of the half-screen: part-way over, not fully
  let anchors: { center: number; side: number }[] = []
  let sideTarget = 0
  let side = 0

  const measure = () => {
    anchors = [...document.querySelectorAll<HTMLElement>('[data-compass-side]')].map((el) => {
      const r = el.getBoundingClientRect()
      return { center: r.top + window.scrollY + r.height / 2, side: Number(el.dataset.compassSide) || 0 }
    })
  }

  const onScroll = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight
    scrollTarget = max > 0 ? window.scrollY / max : 0

    sideTarget = 0
    if (anchors.length === 0) return
    // Blend between the two sections either side of the viewport's centre.
    const v = window.scrollY + window.innerHeight / 2
    const next = anchors.findIndex((a) => a.center >= v)
    if (next <= 0) sideTarget = anchors[0]!.side
    else if (next === -1) sideTarget = anchors[anchors.length - 1]!.side
    else {
      const a = anchors[next - 1]!
      const b = anchors[next]!
      sideTarget = a.side + (b.side - a.side) * smoothstep(0, 1, (v - a.center) / (b.center - a.center))
    }
  }
  const onPointer = (e: PointerEvent) => {
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1
    pointer.y = (e.clientY / window.innerHeight) * 2 - 1
  }
  const onResize = () => {
    const w = window.innerWidth
    const h = window.innerHeight
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    // Pull back on narrow screens so the ring stays in frame.
    camera.fov = w / h < 0.8 ? 62 : 40
    camera.updateProjectionMatrix()
    measure()
    onScroll()
  }

  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('pointermove', onPointer, { passive: true })
  window.addEventListener('resize', onResize)
  // Section heights shift as fonts load and content reveals; keep anchors fresh.
  const layoutObserver = new ResizeObserver(() => {
    measure()
    onScroll()
  })
  layoutObserver.observe(document.body)
  onResize()

  // --- Loop ----------------------------------------------------------------
  const clock = new THREE.Clock()
  let frame = 0
  let lastHaze = -1

  const tick = () => {
    frame = requestAnimationFrame(tick)
    const dt = Math.min(clock.getDelta(), 0.05)
    const t = clock.elapsedTime

    const ease = 1 - Math.pow(0.001, dt) // frame-rate independent smoothing
    scroll += (scrollTarget - scroll) * ease
    pointerSmooth.x += (pointer.x - pointerSmooth.x) * ease
    pointerSmooth.y += (pointer.y - pointerSmooth.y) * ease
    side += (sideTarget - side) * ease

    const spin = reducedMotion ? 0 : t * 0.08

    // Scroll story: the compass turns a full revolution and tilts back,
    // while the camera dollies in.
    compass.rotation.z = -scroll * Math.PI * 2 + spin
    compass.rotation.x = -scroll * 1.1 + pointerSmooth.y * 0.15
    compass.rotation.y = Math.sin(scroll * Math.PI) * 0.6 + pointerSmooth.x * 0.25

    camera.position.z = 9 - Math.sin(scroll * Math.PI) * 3
    camera.position.y = -scroll * 1.2
    camera.lookAt(0, -scroll * 0.6, 0)

    // Placement is worked out as screen fractions, converted to world units
    // at the compass's distance from the camera.
    const halfHeight = camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))
    const halfWidth = halfHeight * camera.aspect
    const wide = window.innerWidth >= 1024
    const portrait = camera.aspect < 0.8
    // Sit high in the hero so the title reads beneath it; settle as you scroll.
    const heroLift = Math.max(0, 1 - scroll * 8) * (portrait ? 0.36 : 0.21)
    // On phones, rise above the chapter's text sheet.
    const sheetLift = portrait ? Math.abs(side) * 0.42 : 0
    compass.position.x = wide ? side * SIDE_SHIFT * halfWidth : 0
    compass.position.y = (heroLift + sheetLift) * halfHeight

    // Blight: nothing in the hero, fully taken by the closing section.
    const blight = smoothstep(0.06, 0.92, scroll)

    const bgNow = scene.background as THREE.Color
    bgNow.lerpColors(clean.bg, blighted.bg, blight)
    fog.color.copy(bgNow)
    fog.density = 0.06 + blight * 0.03

    steel.color.lerpColors(clean.steel, blighted.steel, blight * 0.7)
    steel.roughness = 0.28 + blight * 0.3
    bronze.color.lerpColors(clean.bronze, blighted.bronze, blight * 0.7)
    ;(halo.material as THREE.SpriteMaterial).color.lerpColors(clean.glow, blighted.glow, blight)
    ;(core.material as THREE.MeshBasicMaterial).color.lerpColors(clean.core, blighted.core, blight)
    coreLight.color.lerpColors(clean.glow, blighted.glow, blight)
    ashMat.color.lerpColors(clean.ash, blighted.ash, blight)

    const pulse = reducedMotion ? 1 : 1 + Math.sin(t * 1.8) * 0.08
    halo.scale.setScalar(1.1 * pulse + scroll * 0.5)
    coreLight.intensity = 3 * pulse + scroll * 3

    const throb = reducedMotion ? 1 : 1 + Math.sin(t * 1.3) * 0.25
    crystalMat.emissiveIntensity = (0.35 + blight * 0.8) * throb
    blightLight.intensity = blight * 40 * throb
    for (const c of crystals) {
      const g = clamp01((blight - c.threshold) / 0.2)
      c.group.visible = g > 0.001
      if (c.group.visible) c.group.scale.setScalar(Math.max(0.001, easeOutBack(g)))
    }
    blightLayer.rotation.y = reducedMotion ? 0 : Math.sin(t * 0.1) * 0.05

    if (!reducedMotion) {
      const p = ashGeo.attributes.position!.array as Float32Array
      // Blighted ash rises faster.
      const rise = 1 + blight * 1.2
      for (let i = 0; i < ashCount; i++) {
        let y = p[i * 3 + 1]! + speeds[i]! * rise * dt
        if (y > 10) y = -10
        p[i * 3 + 1] = y
      }
      ashGeo.attributes.position!.needsUpdate = true
    }
    ash.rotation.y = scroll * 1.5 + spin * 0.5

    // Purple haze creeping up from the bottom of the screen.
    const h = Math.round(blight * 100) / 100
    if (h !== lastHaze && haze.value) {
      haze.value.style.opacity = String(h)
      lastHaze = h
    }

    renderer.render(scene, camera)
  }
  tick()

  cleanup = () => {
    cancelAnimationFrame(frame)
    layoutObserver.disconnect()
    window.removeEventListener('scroll', onScroll)
    window.removeEventListener('pointermove', onPointer)
    window.removeEventListener('resize', onResize)
    scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.Points || obj instanceof THREE.Sprite) {
        obj.geometry.dispose()
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
        mats.forEach((m) => m.dispose())
      }
    })
    glowTex.dispose()
    envMap.dispose()
    pmrem.dispose()
    renderer.dispose()
  }
})

onBeforeUnmount(() => cleanup?.())
</script>

<template>
  <canvas ref="canvas" class="scene" aria-hidden="true"></canvas>
  <div ref="haze" class="blight-haze" aria-hidden="true"></div>
</template>

<style scoped>
.scene {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
  z-index: 0;
}

.blight-haze {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  opacity: 0;
  background:
    radial-gradient(120% 60% at 50% 110%, rgb(123 63 224 / 0.45), transparent 70%),
    radial-gradient(80% 50% at 0% 100%, rgb(90 30 150 / 0.35), transparent 70%),
    radial-gradient(80% 50% at 100% 100%, rgb(90 30 150 / 0.35), transparent 70%);
}
</style>
