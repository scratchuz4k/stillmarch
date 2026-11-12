<script setup lang="ts">
// Inline icons, all drawn on a 24x24 grid. In the lore every building keeps one detail
// unfinished, so each building icon has one stroke left open (a dashed or missing bit).
defineProps<{ name: string; size?: number }>()

const PATHS: Record<string, string> = {
  wood: 'M4 15c0-2 2-3 4-3h10a3 3 0 1 1 0 6H8c-2 0-4-1-4-3Zm14-3a3 3 0 0 0 0 6M6 9l3-5M10 9l2-4',
  stone: 'M5 17l2-7 5-3 6 3 1 7-6 2Zm7-10v6l7 4M12 13l-7 4',
  iron: 'M4 16l3-6h10l3 6Zm3-6 2-3h6l2 3',
  food: 'M12 21V9m0 4c-3 0-5-2-5-5 3 0 5 2 5 5Zm0 0c3 0 5-2 5-5-3 0-5 2-5 5Zm0-4c-2 0-3-2-3-4 2 0 3 2 3 4Zm0 0c2 0 3-2 3-4-2 0-3 2-3 4Z',
  gold: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm0 4v8m-3-6h4a2 2 0 0 1 0 4H9',
  obelisk: 'M10 20l1-13h2l1 13Zm0-15 2-3 2 3M7 21h10',
  lumber: 'M4 20h16M7 20V10l5-5 5 5v10M10 20v-5h4v5',
  quarry: 'M3 20l5-9 4 5 3-3 6 7Zm11-12 2-3 2 3',
  mine: 'M4 20V11a8 8 0 0 1 16 0v9M9 20v-6h6v6M14 6l3-3',
  farm: 'M3 20h18M5 20v-7l7-5 7 5v7M9 20v-4h6v4M12 3v2',
  storehouse: 'M4 20V9l8-5 8 5v11Zm4 0v-7h8v7M8 16h8',
  walls: 'M3 20V9h3v2h3V9h3v2h3V9h3v2h3v9Zm6 0v-4h6v4',
  barracks: 'M5 20V8l7-4 7 4v12M9 20v-5h6v5M5 11h14M12 4v2',
  village: 'M3 20h18M5 20v-8l4-3 4 3v8M13 20v-6l3-2 3 2v6M8 20v-3',
  map: 'M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2Zm6-2v14m6-12v14',
  army: 'M5 19 19 5M14 5h5v5M5 14l5 5M3 21l3-3',
  cards: 'M7 3h10v15H7Zm-3 3v15h11M10 8h4M10 11h4',
  house: 'M6 21V5l6 3 6-3v16l-6-3Z',
  log: 'M6 3h9l4 4v14H6ZM9 10h7M9 14h7M9 18h4',
  chat: 'M4 5h16v11H9l-5 4Z',
  plus: 'M12 5v14M5 12h14',
  close: 'M6 6l12 12M18 6 6 18',
  back: 'M15 5l-7 7 7 7',
  clock: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm0 4v4l3 2',
  shield: 'M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6Z',
  sword: 'M14 4h6v6L9 21l-3-3ZM5 15l4 4M3 21l3-3',
  crown: 'M4 18h16l1-10-5 4-4-6-4 6-5-4Z',
  fortress: 'M4 21V9l3 2V7l5-3 5 3v4l3-2v12ZM10 21v-5h4v5',
  blight: 'M12 3c3 4 6 6 6 10a6 6 0 0 1-12 0c0-4 3-6 6-10Zm0 9v5',
  flag: 'M6 21V4m0 1h11l-2 4 2 4H6',
  bell: 'M6 16V11a6 6 0 0 1 12 0v5l2 2H4Zm4 4h4',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Zm10-3a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z',
  people: 'M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM2 20c0-3 3-5 6-5s6 2 6 5m0-5c1-.5 1.5-.5 2-.5 3 0 6 2 6 5',
  scroll: 'M7 4h11a2 2 0 0 1 0 4H7m0-4a2 2 0 0 0 0 4v11a2 2 0 0 0 2 2h9V8M10 12h5M10 16h5',
  infantry: 'M12 3l5 3v5c0 4-2 7-5 9-3-2-5-5-5-9V6Z',
  archers: 'M6 4c6 2 9 8 6 16M6 4v16M6 12h12m-3-3 3 3-3 3',
  cavalry: 'M4 18l3-7 5-2 3-5 2 3-1 3 4 3-2 2-4-1-3 4M7 18v3m8-4v4',
  ram: 'M3 13h13l5-3v6l-5-3M5 13v4m8-4v4M4 19h11',
}

const UNFINISHED = new Set(['obelisk', 'lumber', 'quarry', 'mine', 'farm', 'storehouse', 'walls', 'barracks'])
</script>

<template>
  <svg
    :width="size ?? 20"
    :height="size ?? 20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.6"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    class="icon"
  >
    <path :d="PATHS[name] ?? PATHS.scroll" :stroke-dasharray="UNFINISHED.has(name) ? '60 2.5 400' : undefined" />
  </svg>
</template>

<style scoped>
.icon {
  flex: none;
  vertical-align: middle;
}
</style>
