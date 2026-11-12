<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import {
  CARD_BY_ID,
  ORDERS,
  RATIONS_PER_HOUR,
  UNITS,
  UNIT_ORDER,
  armySpeed,
  findPath,
  foodPoints,
  pathTime,
  totalUnits,
  type Order,
  type Units,
  type World,
} from '@stillmarch/shared'
import Icon from './Icon.vue'
import { act, liveRes, state } from '../store.ts'
import { countdown } from '../format.ts'

const props = defineProps<{ regionId: number; mission: 'move' | 'claim' | 'raid' | 'siege'; warId?: string | undefined }>()
const emit = defineEmits<{ close: []; sent: [] }>()

const v = computed(() => state.view!)
const me = computed(() => v.value.me)
const target = computed(() => v.value.regions[props.regionId]!)
const units = reactive<Units>({ infantry: 0, archers: 0, cavalry: 0, ram: 0 })
const commander = ref<string>('')
const order = ref<Order>(props.mission === 'move' || props.mission === 'claim' ? 'hold' : 'charge')

const lite = computed(() => ({ regions: v.value.regions, roads: v.value.roads, config: { speed: v.value.speed } }) as unknown as World)

const freeCards = computed(() => {
  const used = Object.values(me.value.cards).filter((c) => c.armyId).length
  if (used >= me.value.combatSlots) return []
  return Object.values(me.value.cards).filter((c) => !c.armyId && !c.building && c.prisonUntil === null)
})

const speed = computed(() => armySpeed(lite.value, { units, ownerId: me.value.id, commander: commander.value || null }))
const path = computed(() => findPath(lite.value, me.value.homeRegion, props.regionId, speed.value))
const travel = computed(() => (path.value ? pathTime(lite.value, me.value.homeRegion, path.value, speed.value) : 0))
const perHour = computed(() => {
  const c = commander.value ? CARD_BY_ID[commander.value] : undefined
  const cut = c && c.trait.kind === 'rations' ? c.trait.pct / 100 : 0
  return foodPoints(units) * RATIONS_PER_HOUR * (1 - cut)
})
// Enough food for the march there and back, plus a margin.
const suggested = computed(() => {
  const hours = (travel.value * v.value.speed) / 3_600_000
  return Math.ceil(perHour.value * (hours * 2 + 2))
})
const rations = ref<number | null>(null)
const rationsValue = computed(() => Math.min(Math.floor(liveRes.value.food), rations.value ?? suggested.value))
const lasts = computed(() => (perHour.value > 0 ? rationsValue.value / perHour.value : Infinity))

function all() {
  for (const k of UNIT_ORDER) units[k] = me.value.home[k]
}

const title = computed(() => ({ move: 'Station an army', claim: 'Claim this region', raid: 'Raid', siege: 'Join the siege' })[props.mission])

async function send() {
  const a: Parameters<typeof act>[0] = {
    type: 'send',
    units: { ...units },
    rations: rationsValue.value,
    commander: commander.value || null,
    order: order.value,
    target: props.regionId,
    mission: props.mission,
  }
  if (props.warId && props.mission === 'siege') a.warId = props.warId
  const id = await act(a, 'The army marches')
  if (id) emit('sent')
}
</script>

<template>
  <Teleport to="body">
  <div class="sheet-backdrop" @click.self="emit('close')">
    <section class="sheet" role="dialog" :aria-label="title">
      <div class="row spread">
        <h2>{{ title }}: {{ target.name }}</h2>
        <button class="btn ghost small" aria-label="Close" @click="emit('close')"><Icon name="close" :size="16" /></button>
      </div>

      <div class="units">
        <div v-for="u in UNIT_ORDER" :key="u" class="urow">
          <span class="row"><Icon :name="u" /> {{ UNITS[u].name }}</span>
          <input v-model.number="units[u]" type="number" min="0" :max="me.home[u]" :aria-label="UNITS[u].plural" />
          <button class="btn ghost small" @click="units[u] = me.home[u]">{{ me.home[u] }}</button>
        </div>
        <button class="btn ghost small" @click="all">Send everyone</button>
      </div>

      <div class="grid2">
        <div>
          <label for="cmd">Commander (combat slot)</label>
          <select id="cmd" v-model="commander">
            <option value="">None</option>
            <option v-for="c in freeCards" :key="c.cardId" :value="c.cardId">{{ CARD_BY_ID[c.cardId]?.name }} (Might {{ CARD_BY_ID[c.cardId]?.might }})</option>
          </select>
        </div>
        <div>
          <label for="ord">Standing order</label>
          <select id="ord" v-model="order">
            <option v-for="(o, k) in ORDERS" :key="k" :value="k">{{ o.name }}</option>
          </select>
        </div>
      </div>
      <p class="ui small faint">{{ ORDERS[order].blurb }}</p>

      <label for="rat">Rations (food): {{ rationsValue }}</label>
      <input id="rat" type="range" min="0" :max="Math.floor(liveRes.food)" :value="rationsValue" @input="rations = Number(($event.target as HTMLInputElement).value)" />
      <p class="ui small muted">
        <template v-if="totalUnits(units) > 0">
          March: {{ path ? countdown(travel) : 'no road' }} &middot; eats {{ perHour.toFixed(1) }} per world-hour in the field &middot; food lasts {{ Number.isFinite(lasts) ? countdown((lasts * 3_600_000) / v.speed) : 'forever' }}
        </template>
        <template v-else>Pick some troops.</template>
      </p>
      <p v-if="mission === 'siege'" class="ui small faint">Be there before the siege starts: once the first round begins, nobody new can join.</p>

      <button class="btn block" :disabled="state.busy || totalUnits(units) === 0 || !path" @click="send">Send</button>
    </section>
  </div>
  </Teleport>
</template>

<style scoped>
.sheet-backdrop {
  position: fixed;
  inset: 0;
  z-index: 50;
  background: #0008;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}
.sheet {
  width: 100%;
  max-width: 720px;
  max-height: 88dvh;
  overflow: auto;
  background: var(--panel);
  border: 1px solid var(--border);
  border-bottom: 0;
  border-radius: 16px 16px 0 0;
  padding: 1rem 16px calc(1rem + env(safe-area-inset-bottom));
}
h2 {
  margin: 0;
  font-size: 1.05rem;
}
.units {
  margin: 0.75rem 0;
}
.urow {
  display: grid;
  grid-template-columns: 1fr 90px auto;
  gap: 0.5rem;
  align-items: center;
  margin-bottom: 0.4rem;
}
input[type='range'] {
  width: 100%;
  accent-color: var(--accent);
}
</style>
