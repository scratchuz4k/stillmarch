<script setup lang="ts">
import { computed } from 'vue'
import type { Res, ResKey } from '@stillmarch/shared'
import Icon from './Icon.vue'
import { liveRes } from '../store.ts'
import { num } from '../format.ts'

const props = defineProps<{ cost: Partial<Res>; plus?: boolean }>()
const items = computed(() =>
  (Object.entries(props.cost) as [ResKey, number][])
    .filter(([, n]) => n > 0)
    .map(([k, n]) => ({ k, n, short: !props.plus && liveRes.value[k] < n })),
)
</script>

<template>
  <span class="cost ui">
    <span v-for="i in items" :key="i.k" class="c" :class="{ short: i.short }"><Icon :name="i.k" :size="14" />{{ plus ? '+' : '' }}{{ num(i.n) }}</span>
  </span>
</template>

<style scoped>
.cost {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  font-size: 0.8rem;
  color: var(--ink-dim);
}
.c {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}
.short {
  color: var(--bad);
}
</style>
