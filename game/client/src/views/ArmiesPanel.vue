<script setup lang="ts">
import { computed } from 'vue'
import { CARD_BY_ID, ORDERS, UNITS, UNIT_ORDER, type MyArmy, type Order } from '@stillmarch/shared'
import Icon from '../components/Icon.vue'
import { act, state, worldTime } from '../store.ts'
import { countdown, unitsText } from '../format.ts'

const v = computed(() => state.view!)
const me = computed(() => v.value.me)
const mine = computed(() => v.value.armies.filter((a) => a.own))
const allies = computed(() => v.value.armies.filter((a) => !a.own))
const name = (id: number) => v.value.regions[id]?.name ?? '?'

function status(a: MyArmy): string {
  if (a.battleId) return `Fighting a siege at ${name(a.at)}`
  const m = a.mission
  const where = name(a.target)
  if (a.arriveAt !== null) {
    const verb = m.kind === 'return' ? 'Heading home' : m.kind === 'raid' ? `Marching to raid ${where}` : m.kind === 'claim' ? `Marching to claim ${where}` : m.kind === 'siege' ? `Marching to the siege of ${where}` : `Marching to ${where}`
    return `${verb} · next stop ${name(a.path[0]!)} in ${countdown(a.arriveAt - worldTime.value)}`
  }
  if (m.kind === 'claim' && m.endsAt) return `Waking the Obelisk at ${name(a.at)} · ${countdown(m.endsAt - worldTime.value)}`
  if (m.kind === 'siege') return `Waiting at ${name(a.at)} for the siege`
  return `Stationed at ${name(a.at)}`
}

function food(a: MyArmy): string {
  if (a.starvingSince !== null) return 'Out of food: losing troops every hour'
  if (a.rationRate <= 0) return `${Math.floor(a.rations)} food · eating nothing in your land`
  const hours = a.rations / a.rationRate
  return `${Math.floor(a.rations)} food · lasts ${countdown((hours * 3_600_000) / v.value.speed)}`
}

function setOrder(a: MyArmy, o: Order) {
  void act({ type: 'setOrder', armyId: a.id, order: o }, 'New standing order')
}

function home(a: MyArmy) {
  void act({ type: 'redirect', armyId: a.id, target: me.value.homeRegion, mission: 'return' }, 'Heading home')
}

function showOnMap(id: number) {
  state.focusRegion = id
  state.tab = 'map'
}
</script>

<template>
  <div class="page">
    <h1>Armies</h1>
    <p class="muted small">Armies are tokens on the map. They take rations from your storehouse and eat them outside your own regions. When the food runs out they lose troops every world-hour until they get home or loot more.</p>

    <div class="card">
      <h3>At home in {{ name(me.homeRegion) }}</h3>
      <div class="row wrap">
        <span v-for="u in UNIT_ORDER" :key="u" class="pill"><Icon :name="u" :size="14" /> {{ me.home[u] }} {{ UNITS[u].plural }}</span>
      </div>
      <p class="ui small faint send-hint">To send an army, open the map and tap where it should go.</p>
      <button class="btn small" @click="state.tab = 'map'"><Icon name="map" :size="16" /> Open the map</button>
    </div>

    <div class="section-title"><h2>In the field</h2><span class="ui small faint">{{ mine.length }}</span></div>
    <div class="stack">
      <div v-for="a in mine" :key="a.id" class="card" :class="{ starving: a.starvingSince !== null }">
        <div class="row spread">
          <strong>{{ unitsText(a.units) }}</strong>
          <span v-if="a.commander" class="pill gold">{{ CARD_BY_ID[a.commander]?.name }}</span>
        </div>
        <p class="ui small">{{ status(a) }}</p>
        <p class="ui small muted">{{ food(a) }}<template v-if="a.loot.gold > 0"> &middot; carrying {{ Math.floor(a.loot.gold) }} gold</template></p>
        <div class="row wrap">
          <select :value="a.order" :aria-label="'Standing order'" class="order" @change="setOrder(a, ($event.target as HTMLSelectElement).value as Order)">
            <option v-for="(o, k) in ORDERS" :key="k" :value="k">{{ o.name }}</option>
          </select>
          <button class="btn small ghost" @click="showOnMap(a.arriveAt !== null ? a.path[0]! : a.at)">Show</button>
          <button v-if="!a.battleId && a.mission.kind !== 'return'" class="btn small ghost" @click="home(a)">Come home</button>
        </div>
      </div>
      <div v-if="!mine.length" class="empty">No armies out.</div>
    </div>

    <template v-if="allies.length">
      <div class="section-title"><h2>Your side</h2></div>
      <div class="stack">
        <div v-for="a in allies" :key="a.id" class="card">
          <strong>{{ v.players.find((p) => p.id === a.ownerId)?.name }}</strong>
          <p class="ui small">{{ unitsText(a.units) }} &middot; {{ status(a) }}</p>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.starving {
  border-color: #7a3c33;
}
.card p {
  margin: 0.3rem 0;
}
.order {
  width: auto;
  min-width: 130px;
  min-height: 36px;
}
.send-hint {
  margin-top: 0.5rem;
}
</style>
