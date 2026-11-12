<script setup lang="ts">
import { computed } from 'vue'
import Icon from '../components/Icon.vue'
import ResourceBar from '../components/ResourceBar.vue'
import VillagePanel from './VillagePanel.vue'
import MapPanel from './MapPanel.vue'
import ArmiesPanel from './ArmiesPanel.vue'
import CardsPanel from './CardsPanel.vue'
import HousePanel from './HousePanel.vue'
import LogPanel from './LogPanel.vue'
import { leaveWorld, state, type Tab } from '../store.ts'

const tabs: { id: Tab; label: string; icon: string }[] = [
  { id: 'village', label: 'Village', icon: 'village' },
  { id: 'map', label: 'Map', icon: 'map' },
  { id: 'armies', label: 'Armies', icon: 'army' },
  { id: 'cards', label: 'Wayfarers', icon: 'cards' },
  { id: 'house', label: 'House', icon: 'house' },
  { id: 'log', label: 'Log', icon: 'log' },
]

const unread = computed(() => state.view?.me.reports.filter((r) => !r.read).length ?? 0)
const out = computed(() => state.view?.me.eliminated ?? false)
</script>

<template>
  <div class="game" :class="{ 'map-mode': state.tab === 'map' }">
    <header class="top">
      <div class="row spread head">
        <button class="btn ghost small" aria-label="Back to worlds" @click="leaveWorld"><Icon name="back" :size="16" /></button>
        <div class="title">
          <span class="world">{{ state.view?.worldName }}</span>
          <span class="ui small faint">&times;{{ state.view?.speed }}<span v-if="!state.live"> &middot; reconnecting&hellip;</span></span>
        </div>
        <span class="dot" :class="{ on: state.live }" :title="state.live ? 'Live' : 'Offline'"></span>
      </div>
      <ResourceBar v-if="!out" />
      <div v-else class="out ui small">Your village has fallen. You can watch the map and use chat.</div>
    </header>

    <main class="content">
      <VillagePanel v-if="state.tab === 'village'" />
      <MapPanel v-else-if="state.tab === 'map'" />
      <ArmiesPanel v-else-if="state.tab === 'armies'" />
      <CardsPanel v-else-if="state.tab === 'cards'" />
      <HousePanel v-else-if="state.tab === 'house'" />
      <LogPanel v-else />
    </main>

    <nav class="tabs ui" aria-label="Game screens">
      <button v-for="t in tabs" :key="t.id" :class="{ active: state.tab === t.id }" :aria-current="state.tab === t.id ? 'page' : undefined" @click="state.tab = t.id">
        <span class="ic"><Icon :name="t.icon" :size="22" /><b v-if="t.id === 'log' && unread" class="badge">{{ unread > 9 ? '9+' : unread }}</b></span>
        <span class="lbl">{{ t.label }}</span>
      </button>
    </nav>
  </div>
</template>

<style scoped>
.game {
  min-height: 100dvh;
}
.top {
  position: sticky;
  top: 0;
  z-index: 20;
  background: linear-gradient(#0f1118 85%, #0f111800);
  padding: calc(0.5rem + env(safe-area-inset-top)) 16px 0.5rem;
}
.head {
  max-width: 720px;
  margin: 0 auto 0.4rem;
}
.title {
  display: flex;
  flex-direction: column;
  align-items: center;
  line-height: 1.1;
}
.world {
  font-family: var(--font-display);
  color: var(--accent-strong);
  font-size: 1rem;
}
.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--bad);
  margin: 0 12px;
}
.dot.on {
  background: var(--good);
}
.out {
  max-width: 720px;
  margin: 0 auto;
  padding: 0.5rem 0.75rem;
  border: 1px solid #7a3c33;
  border-radius: var(--radius);
  color: var(--bad);
}
.tabs {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 30;
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  height: calc(var(--tabbar) + env(safe-area-inset-bottom));
  padding-bottom: env(safe-area-inset-bottom);
  background: #0c0e14;
  border-top: 1px solid var(--border);
}
.tabs button {
  background: none;
  border: 0;
  color: var(--ink-faint);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  font-size: 0.68rem;
  min-width: 0;
}
.tabs button.active {
  color: var(--accent-strong);
}
.ic {
  position: relative;
}
.badge {
  position: absolute;
  top: -6px;
  right: -10px;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  border-radius: 9px;
  background: #8a4a40;
  color: #fff;
  font-size: 0.65rem;
  line-height: 18px;
}
.lbl {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}
</style>
