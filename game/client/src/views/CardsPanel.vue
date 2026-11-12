<script setup lang="ts">
import { computed } from 'vue'
import { BUILDINGS, BUILDING_ORDER, CARDS, CARD_BY_ID, STAT_BONUS, type BuildingKey, type CardState } from '@stillmarch/shared'
import Icon from '../components/Icon.vue'
import { act, liveRes, state, worldTime } from '../store.ts'
import { countdown } from '../format.ts'

const v = computed(() => state.view!)
const me = computed(() => v.value.me)
const owned = computed(() => Object.values(me.value.cards).sort((a, b) => CARDS.findIndex((c) => c.id === a.cardId) - CARDS.findIndex((c) => c.id === b.cardId)))
const crafting = computed(() => owned.value.filter((c) => c.building).length)
const combat = computed(() => owned.value.filter((c) => c.armyId).length)
const missing = computed(() => CARDS.length - owned.value.length)
const builtBuildings = computed(() => BUILDING_ORDER.filter((b) => me.value.buildings[b] > 0))

function status(c: CardState): string {
  if (c.prisonUntil !== null) return c.prisonUntil > worldTime.value ? `In prison for ${countdown(c.prisonUntil - worldTime.value)}` : 'Out of prison time: pay gold to get them back'
  if (c.armyId) return 'Leading an army'
  if (c.building) return `Running the ${BUILDINGS[c.building].name.toLowerCase()}`
  return 'Free'
}

function assign(c: CardState, b: string) {
  void act({ type: 'assignCard', cardId: c.cardId, building: b ? (b as BuildingKey) : null }, b ? 'Put to work' : 'Slot freed')
}

async function hire() {
  const id = await act({ type: 'hireCard' })
  if (id) {
    const c = CARD_BY_ID[id]
    state.toast = { text: `${c?.name} ${c?.epithet} answered your call`, error: false }
  }
}
</script>

<template>
  <div class="page">
    <h1>Wayfarers</h1>
    <p class="muted small">People like you, coming back to the continent without a House. Cards stay in your collection for every world. Put them in a crafting slot to run a building, or give one an army to lead.</p>
    <div class="row wrap slots ui small">
      <span class="pill">Crafting {{ crafting }}/{{ me.craftingSlots }}</span>
      <span class="pill">Combat {{ combat }}/{{ me.combatSlots }}</span>
      <span class="pill">Adventure: later</span>
    </div>

    <div class="cards">
      <article v-for="c in owned" :key="c.cardId" class="wcard" :class="[CARD_BY_ID[c.cardId]?.rarity, { jailed: c.prisonUntil !== null }]">
        <template v-if="CARD_BY_ID[c.cardId]">
          <header class="row spread">
            <div>
              <h3>{{ CARD_BY_ID[c.cardId]!.name }}</h3>
              <div class="epithet">{{ CARD_BY_ID[c.cardId]!.epithet }}</div>
            </div>
            <span class="pill" :class="CARD_BY_ID[c.cardId]!.rarity === 'uncommon' ? 'blight' : ''">{{ CARD_BY_ID[c.cardId]!.rarity }}</span>
          </header>
          <div class="portrait" aria-hidden="true">{{ CARD_BY_ID[c.cardId]!.name[0] }}</div>
          <div class="stats ui">
            <div :title="`Combat: +${(CARD_BY_ID[c.cardId]!.might * STAT_BONUS * 100).toFixed(0)}% for the army they lead`"><b>{{ CARD_BY_ID[c.cardId]!.might }}</b><span>Might</span></div>
            <div :title="`Crafting: +${(CARD_BY_ID[c.cardId]!.craft * STAT_BONUS * 100).toFixed(0)}% in the building they run`"><b>{{ CARD_BY_ID[c.cardId]!.craft }}</b><span>Craft</span></div>
            <div title="Adventures come later"><b>{{ CARD_BY_ID[c.cardId]!.wits }}</b><span>Wits</span></div>
          </div>
          <p class="trait small">{{ CARD_BY_ID[c.cardId]!.trait.text }}</p>
          <p class="lore small faint">{{ CARD_BY_ID[c.cardId]!.lore }}</p>
          <p class="ui small status">{{ status(c) }}</p>
          <button v-if="c.prisonUntil !== null && c.prisonUntil <= worldTime" class="btn small block" :disabled="liveRes.gold < v.prices.release[CARD_BY_ID[c.cardId]!.rarity]" @click="act({ type: 'releaseCard', cardId: c.cardId }, 'Back with you')">
            Pay {{ v.prices.release[CARD_BY_ID[c.cardId]!.rarity] }} gold
          </button>
          <select v-else-if="c.prisonUntil === null && !c.armyId && me.founded && !me.eliminated" :value="c.building ?? ''" :aria-label="`Crafting slot for ${CARD_BY_ID[c.cardId]!.name}`" @change="assign(c, ($event.target as HTMLSelectElement).value)">
            <option value="">No building</option>
            <option v-for="b in builtBuildings" :key="b" :value="b">{{ BUILDINGS[b].name }}</option>
          </select>
        </template>
      </article>
    </div>

    <div class="section-title"><h2>Hire</h2></div>
    <div class="card">
      <p class="small">Wayfarers come through the Wayfarer Village looking for work. Hiring costs <strong>{{ v.prices.hire }} gold</strong> and brings a random card you don't have yet (about 1 in 4 is Uncommon). Gold comes from raiding the Forgotten.</p>
      <button class="btn block" :disabled="state.busy || liveRes.gold < v.prices.hire || missing === 0 || !me.founded || me.eliminated" @click="hire">
        <Icon name="gold" :size="16" /> Hire a Wayfarer ({{ missing }} left to find)
      </button>
    </div>
  </div>
</template>

<style scoped>
.slots {
  margin-bottom: 1rem;
}
.cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 200px), 1fr));
  gap: 0.75rem;
}
.wcard {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding: 0.85rem;
  border-radius: 14px;
  background: linear-gradient(160deg, #1d2230, #141823);
  border: 1px solid var(--border);
}
.wcard.uncommon {
  border-color: #5b3e80;
  background: linear-gradient(160deg, #221d33, #151321);
}
.wcard.jailed {
  opacity: 0.7;
  filter: grayscale(0.6);
}
h3 {
  margin: 0;
}
.epithet {
  font-style: italic;
  color: var(--ink-dim);
  font-size: 0.9rem;
}
.portrait {
  height: 84px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  font-family: var(--font-display);
  font-size: 2.6rem;
  color: var(--accent);
  background: radial-gradient(circle at 50% 30%, #2c2a24, #12141b);
  border: 1px dashed #b8966a55;
}
.stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  text-align: center;
}
.stats b {
  display: block;
  font-size: 1.2rem;
  color: var(--accent-strong);
}
.stats span {
  font-size: 0.7rem;
  color: var(--ink-faint);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
.trait {
  margin: 0;
  color: var(--good);
}
.lore {
  margin: 0;
  flex: 1;
}
.status {
  margin: 0;
  color: var(--ink-dim);
}
.wcard select {
  min-height: 38px;
}
</style>
