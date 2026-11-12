<script setup lang="ts">
import { computed } from 'vue'
import Icon from './Icon.vue'
import { liveRes, state } from '../store.ts'
import { compact } from '../format.ts'

const items = computed(() => {
  const me = state.view!.me
  const r = liveRes.value
  return [
    { key: 'wood', v: r.wood, rate: me.rates.wood, full: r.wood >= me.storage },
    { key: 'stone', v: r.stone, rate: me.rates.stone, full: r.stone >= me.storage },
    { key: 'iron', v: r.iron, rate: me.rates.iron, full: r.iron >= me.storage },
    { key: 'food', v: r.food, rate: me.rates.food, full: r.food >= me.storage },
    { key: 'gold', v: r.gold, rate: 0, full: false },
  ]
})
</script>

<template>
  <div class="res ui" :title="`Storehouse holds ${state.view?.me.storage} of each`">
    <div v-for="i in items" :key="i.key" class="r" :class="[i.key, { full: i.full }]">
      <Icon :name="i.key" :size="16" />
      <span class="v">{{ compact(i.v) }}</span>
      <span v-if="i.rate" class="rate">+{{ compact(i.rate) }}/h</span>
    </div>
  </div>
</template>

<style scoped>
.res {
  max-width: 720px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 4px;
}
.r {
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: center;
  column-gap: 4px;
  padding: 4px 6px;
  border-radius: 8px;
  background: var(--panel);
  border: 1px solid var(--border);
  min-width: 0;
}
.v {
  font-weight: 600;
  font-size: 0.85rem;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  overflow: hidden;
}
.rate {
  grid-column: 1 / -1;
  font-size: 0.62rem;
  color: var(--ink-faint);
  white-space: nowrap;
}
.wood {
  color: #c9a27a;
}
.stone {
  color: #b9bcc6;
}
.iron {
  color: #9fb1c8;
}
.food {
  color: #c9c27a;
}
.gold {
  color: var(--accent-strong);
}
.full {
  border-color: var(--warn);
}
.r .v {
  color: var(--ink);
}
</style>
