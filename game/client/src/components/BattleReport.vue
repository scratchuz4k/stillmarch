<script setup lang="ts">
import { ORDERS, UNITS, UNIT_ORDER, totalUnits, type BattleLog, type Units } from '@stillmarch/shared'
import Icon from './Icon.vue'

defineProps<{ log: BattleLog }>()

function short(u: Units): string {
  const parts = UNIT_ORDER.filter((k) => u[k] > 0).map((k) => `${u[k]} ${UNITS[k].plural}`)
  return parts.length ? parts.join(', ') : '—'
}
</script>

<template>
  <div class="battle ui">
    <div class="sides">
      <div>
        <h4>Attackers</h4>
        <p class="small">{{ log.attackerNames.join(', ') }}</p>
        <div v-for="u in UNIT_ORDER" :key="u" v-show="log.attackerStart[u] > 0" class="line small">
          <Icon :name="u" :size="14" /> {{ log.attackerEnd[u] }}/{{ log.attackerStart[u] }}
        </div>
      </div>
      <div>
        <h4>Defenders</h4>
        <p class="small">{{ log.defenderNames.join(', ') }}</p>
        <div v-for="u in UNIT_ORDER" :key="u" v-show="log.defenderStart[u] > 0" class="line small">
          <Icon :name="u" :size="14" /> {{ log.defenderEnd[u] }}/{{ log.defenderStart[u] }}
        </div>
      </div>
    </div>
    <table class="rounds small">
      <thead>
        <tr><th>Round</th><th>Orders</th><th>Attackers lost</th><th>Defenders lost</th></tr>
      </thead>
      <tbody>
        <tr v-for="r in log.rounds" :key="r.round">
          <td>{{ r.round }}</td>
          <td>{{ ORDERS[r.attackerOrder].name }} / {{ ORDERS[r.defenderOrder].name }}</td>
          <td>{{ totalUnits(r.attackerLosses) ? short(r.attackerLosses) : '—' }}</td>
          <td>{{ totalUnits(r.defenderLosses) ? short(r.defenderLosses) : '—' }}<span v-if="r.wallLevel !== undefined" class="faint"> &middot; walls {{ r.wallLevel }}</span></td>
        </tr>
      </tbody>
    </table>
    <p v-for="r in log.rounds.filter((x) => x.note)" :key="`n${r.round}`" class="small faint">Round {{ r.round }}: {{ r.note }}</p>
    <p class="small"><strong :class="log.winner">{{ log.winner === 'attacker' ? 'The attackers won.' : 'The defenders held.' }}</strong></p>
    <p v-if="log.loot && Object.values(log.loot).some((n) => (n ?? 0) > 0)" class="small">Loot: {{ Object.entries(log.loot).filter(([, n]) => (n ?? 0) > 0).map(([k, n]) => `${n} ${k}`).join(', ') }}</p>
    <p v-if="log.captured?.length" class="small bad">Captured: {{ log.captured.join(', ') }}</p>
  </div>
</template>

<style scoped>
.battle {
  padding: 0 0.85rem 0.85rem;
  border-top: 1px solid var(--border);
}
.sides {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
  margin: 0.75rem 0;
}
h4 {
  margin: 0;
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--ink-faint);
}
.sides p {
  margin: 0.1rem 0 0.3rem;
}
.line {
  display: flex;
  gap: 0.3rem;
  align-items: center;
}
.rounds {
  width: 100%;
  border-collapse: collapse;
  display: block;
  overflow-x: auto;
}
.rounds th,
.rounds td {
  text-align: left;
  padding: 0.25rem 0.4rem 0.25rem 0;
  border-bottom: 1px solid var(--border);
  vertical-align: top;
}
.rounds th {
  color: var(--ink-faint);
  font-weight: 500;
}
.attacker {
  color: var(--accent-strong);
}
.defender {
  color: var(--glow);
}
.bad {
  color: var(--bad);
}
</style>
