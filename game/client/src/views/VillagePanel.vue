<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import {
  BUILDINGS,
  BUILDING_ORDER,
  BUILD_QUEUE_LENGTH,
  ORDERS,
  TASKS,
  UNITS,
  UNIT_ORDER,
  buildCost,
  buildTime,
  canAfford,
  levelCap,
  plannedLevel,
  scaleCost,
  trainTime,
  type BuildingKey,
  type Order,
  type Res,
  type UnitKey,
  type World,
} from '@stillmarch/shared'
import Icon from '../components/Icon.vue'
import Cost from '../components/Cost.vue'
import { act, liveRes, state, worldTime } from '../store.ts'
import { countdown } from '../format.ts'
import { enablePush } from '../api.ts'

const v = computed(() => state.view!)
const me = computed(() => v.value.me)
const fakeWorld = computed(() => ({ config: { speed: v.value.speed } }) as unknown as World)
const home = computed(() => v.value.regions[me.value.homeRegion]!)

const buildings = computed(() =>
  BUILDING_ORDER.map((key) => {
    const def = BUILDINGS[key]
    const level = me.value.buildings[key]
    const next = plannedLevel(me.value, key) + 1
    const locked = key !== 'obelisk' && me.value.buildings.obelisk < def.unlockObelisk
    const capped = next > def.maxLevel || (key !== 'obelisk' && next > levelCap(key, me.value.buildings.obelisk))
    const cost = buildCost(key, next)
    return {
      key,
      def,
      level,
      next,
      locked,
      capped,
      maxed: next > def.maxLevel,
      cost,
      time: buildTime(fakeWorld.value, me.value, key, next),
      affordable: canAfford(liveRes.value, cost),
    }
  }),
)

const queueFull = computed(() => me.value.buildQueue.length >= BUILD_QUEUE_LENGTH)

function build(key: BuildingKey) {
  void act({ type: 'build', building: key }, `${BUILDINGS[key].name} queued`)
}

const trainCounts = reactive<Record<UnitKey, number>>({ infantry: 10, archers: 10, cavalry: 5, ram: 1 })
const freeFood = computed(() => me.value.troopCap - me.value.troopsUsed)
function trainCost(u: UnitKey): Partial<Res> {
  return scaleCost(UNITS[u].cost, Math.max(1, trainCounts[u] || 1))
}
function train(u: UnitKey) {
  void act({ type: 'train', unit: u, count: trainCounts[u] }, `Training ${trainCounts[u]} ${UNITS[u].plural}`)
}

function setHomeOrder(o: Order) {
  void act({ type: 'setOrder', armyId: 'home', order: o }, 'Home troops have new orders')
}

const protectedFor = computed(() => me.value.protectionUntil - worldTime.value)
const tasks = computed(() => TASKS.map((t) => ({ ...t, state: me.value.tasks[t.id] ?? 'open' })))
const openTasks = computed(() => tasks.value.filter((t) => t.state !== 'claimed'))

const pushMsg = ref('')
async function push() {
  try {
    pushMsg.value = await enablePush()
  } catch (e) {
    pushMsg.value = (e as Error).message
  }
}
function dropProtection() {
  if (confirm('Drop your beginner protection now? Other players will be able to raid and besiege you.')) {
    void act({ type: 'dropProtection' }, 'Protection dropped')
  }
}
const skipMinutes = ref(60)
</script>

<template>
  <div class="page">
    <section v-if="!me.founded" class="card arrive">
      <h1>You have arrived</h1>
      <p>You stand at a dormant Obelisk in <strong>{{ home.name }}</strong>, in {{ home.quarter }}: a bare shaft, its capstone at its foot. A few followers wait for you to decide.</p>
      <button class="btn block" :disabled="state.busy" @click="act({ type: 'found' }, 'The Obelisk wakes. Your village is founded.')">
        <Icon name="obelisk" /> Claim the Obelisk
      </button>
    </section>

    <template v-else>
      <div class="row spread">
        <h1>{{ home.name }}</h1>
        <span class="pill gold">Obelisk {{ me.buildings.obelisk }}</span>
      </div>
      <p class="muted small ui">{{ home.quarter }} &middot; {{ home.terrain }} &middot; troops {{ me.troopsUsed }}/{{ me.troopCap }} &middot; regions {{ me.regionsHeld }}/{{ me.regionCap }}</p>

      <div v-if="protectedFor > 0" class="card protect row spread">
        <div class="row"><Icon name="shield" /><span class="ui small">Beginner protection: <strong>{{ countdown(protectedFor) }}</strong> left</span></div>
        <button class="btn ghost small" @click="dropProtection">Drop it</button>
      </div>

      <div class="section-title"><h2>Building</h2><span class="ui small faint">{{ me.buildQueue.length }}/{{ BUILD_QUEUE_LENGTH }}</span></div>
      <div v-if="me.buildQueue.length" class="stack">
        <div v-for="(j, i) in me.buildQueue" :key="i" class="card job">
          <div class="row spread">
            <span class="row"><Icon :name="j.building" /> {{ BUILDINGS[j.building].name }} &rarr; {{ j.toLevel }}</span>
            <span class="ui small">{{ worldTime < j.startedAt ? 'waiting' : countdown(j.endsAt - worldTime) }}</span>
          </div>
          <div class="bar"><i :style="{ width: `${Math.min(100, Math.max(0, ((worldTime - j.startedAt) / (j.endsAt - j.startedAt)) * 100))}%` }"></i></div>
        </div>
      </div>
      <p v-else class="faint small ui">Nothing is being built.</p>

      <div class="blist">
        <div v-for="b in buildings" :key="b.key" class="card bcard" :class="{ locked: b.locked }">
          <div class="row spread">
            <span class="row name"><Icon :name="b.key" :size="22" /> {{ b.def.name }}</span>
            <span class="pill">{{ b.level }}</span>
          </div>
          <p class="small muted blurb">{{ b.def.blurb }}</p>
          <template v-if="b.locked">
            <p class="ui small faint">Needs Obelisk level {{ b.def.unlockObelisk }}.</p>
          </template>
          <template v-else-if="b.maxed">
            <p class="ui small faint">Highest level.</p>
          </template>
          <template v-else-if="b.capped">
            <p class="ui small faint">Raise the Obelisk to go higher.</p>
          </template>
          <template v-else>
            <Cost :cost="b.cost" />
            <button class="btn small block" :disabled="state.busy || !b.affordable || queueFull" @click="build(b.key)">
              {{ b.level === 0 && b.next === 1 ? 'Build' : `Level ${b.next}` }} &middot; {{ countdown(b.time) }}
            </button>
          </template>
        </div>
      </div>

      <template v-if="me.buildings.barracks > 0">
        <div class="section-title"><h2>Barracks</h2><span class="ui small faint">room for {{ freeFood }} more</span></div>
        <div v-if="me.trainQueue.length" class="stack">
          <div v-for="(j, i) in me.trainQueue" :key="i" class="card job">
            <div class="row spread">
              <span class="row"><Icon :name="j.unit" /> {{ j.count }} {{ UNITS[j.unit].plural }}</span>
              <span class="ui small">{{ worldTime < j.startedAt ? 'waiting' : countdown(j.endsAt - worldTime) }}</span>
            </div>
          </div>
        </div>
        <div class="stack train">
          <div v-for="u in UNIT_ORDER" :key="u" class="card">
            <div class="row spread">
              <span class="row"><Icon :name="u" /> <strong>{{ UNITS[u].name }}</strong></span>
              <span class="ui small faint">atk {{ UNITS[u].attack }} &middot; def {{ UNITS[u].defence }} &middot; food {{ UNITS[u].food }}<template v-if="UNITS[u].strongVs"> &middot; strong vs {{ UNITS[UNITS[u].strongVs!].plural }}</template></span>
            </div>
            <div class="row train-row">
              <input v-model.number="trainCounts[u]" type="number" min="1" max="500" :aria-label="`How many ${UNITS[u].plural}`" />
              <Cost :cost="trainCost(u)" />
              <button class="btn small" :disabled="state.busy || !canAfford(liveRes, trainCost(u))" @click="train(u)">
                Train &middot; {{ countdown(trainTime(fakeWorld, me, u, Math.max(1, trainCounts[u] || 1))) }}
              </button>
            </div>
          </div>
        </div>
      </template>

      <div class="section-title"><h2>At home</h2></div>
      <div class="card">
        <div class="row wrap">
          <span v-for="u in UNIT_ORDER" :key="u" class="pill"><Icon :name="u" :size="14" /> {{ me.home[u] }} {{ UNITS[u].plural }}</span>
        </div>
        <label class="order-label" for="ho">Home troops defend with</label>
        <select id="ho" :value="me.homeOrder" @change="setHomeOrder(($event.target as HTMLSelectElement).value as Order)">
          <option v-for="(o, k) in ORDERS" :key="k" :value="k">{{ o.name }}: {{ o.blurb }}</option>
        </select>
      </div>

      <div class="section-title"><h2>Unfinished business</h2><span class="ui small faint">{{ tasks.length - openTasks.length }}/{{ tasks.length }}</span></div>
      <div class="stack">
        <div v-for="t in openTasks" :key="t.id" class="card row spread task" :class="{ done: t.state === 'done' }">
          <div>
            <strong>{{ t.title }}</strong>
            <div class="small muted">{{ t.hint }}</div>
            <Cost :cost="t.reward" plus />
          </div>
          <button v-if="t.state === 'done'" class="btn small" @click="act({ type: 'claimTask', taskId: t.id }, 'Reward collected')">Collect</button>
        </div>
        <p v-if="!openTasks.length" class="faint small ui">All done. Stillmarch has no main quest: the rest is up to you.</p>
      </div>
    </template>

    <div class="section-title"><h2>Settings</h2></div>
    <div class="card stack">
      <div>
        <button class="btn ghost block" @click="push"><Icon name="bell" /> Turn on notifications</button>
        <p v-if="pushMsg" class="small ui muted">{{ pushMsg }}</p>
      </div>
      <p class="small ui faint">Sieges happen in the battle window: {{ v.window }}. {{ v.windowOpen ? 'It is open now.' : 'It is closed now.' }}</p>
      <template v-if="v.dev">
        <hr />
        <p class="small ui muted">Test world cheats</p>
        <div class="row wrap">
          <button class="btn small ghost" @click="act({ type: 'cheat', cheat: 'finish' }, 'Queues finished')">Finish queues</button>
          <button class="btn small ghost" @click="act({ type: 'cheat', cheat: 'resources' }, '+3000 of each, +500 gold')">Add resources</button>
        </div>
        <div class="row">
          <input v-model.number="skipMinutes" type="number" min="1" aria-label="Minutes to skip" />
          <button class="btn small ghost" @click="act({ type: 'cheat', cheat: 'skip', minutes: skipMinutes }, `Skipped ${skipMinutes} minutes`)">Skip minutes</button>
        </div>
        <p class="small ui faint">Skipping moves the whole world's clock forward, for everyone in it.</p>
      </template>
    </div>
  </div>
</template>

<style scoped>
.arrive {
  margin-top: 1rem;
}
.protect {
  margin: 0.75rem 0;
  border-color: #3a4a6a;
}
.job .bar {
  margin-top: 0.5rem;
}
.blist {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 210px), 1fr));
  gap: 0.6rem;
  margin-top: 0.75rem;
}
.bcard {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}
.bcard .blurb {
  flex: 1;
  margin: 0;
}
.bcard.locked {
  opacity: 0.55;
}
.name {
  font-family: var(--font-display);
  color: var(--accent-strong);
}
.train-row {
  margin-top: 0.5rem;
  flex-wrap: wrap;
}
.train-row input {
  width: 84px;
  flex: none;
}
.train-row .btn {
  margin-left: auto;
}
.order-label {
  margin-top: 0.75rem;
}
.task.done {
  border-color: var(--accent);
}
</style>
