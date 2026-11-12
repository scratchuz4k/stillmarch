<script setup lang="ts">
import { computed, ref } from 'vue'
import { CLAIM_COST, sameSide, type World } from '@stillmarch/shared'
import Icon from './Icon.vue'
import SendArmy from './SendArmy.vue'
import { act, state, worldTime } from '../store.ts'
import { countdown, unitsText } from '../format.ts'

const props = defineProps<{ regionId: number }>()
const emit = defineEmits<{ close: [] }>()

const v = computed(() => state.view!)
const me = computed(() => v.value.me)
const r = computed(() => v.value.regions[props.regionId]!)
const lite = computed(() => ({
  players: Object.fromEntries(v.value.players.map((p) => [p.id, p])),
  houses: Object.fromEntries(v.value.houses.map((h) => [h.id, h])),
}) as unknown as World)

const owner = computed(() => v.value.players.find((p) => p.id === r.value.ownerId) ?? null)
const villageOf = computed(() => v.value.players.find((p) => p.id === r.value.villageOf && p.village === r.value.id) ?? null)
const ownerHouse = computed(() => v.value.houses.find((h) => h.id === owner.value?.houseId) ?? null)
const mine = computed(() => r.value.ownerId === me.value.id)
const friendly = computed(() => !!r.value.ownerId && sameSide(lite.value, me.value.id, r.value.ownerId))
const hostileOwner = computed(() => !!r.value.ownerId && !friendly.value)
const ownerProtected = computed(() => (owner.value?.protectedUntil ?? 0) > worldTime.value)
const out = computed(() => me.value.eliminated)

const wars = computed(() => v.value.wars.filter((w) => w.regionId === r.value.id && w.state !== 'done'))
const myWar = computed(() => wars.value.find((w) => sameSide(lite.value, me.value.id, w.attackerId)) ?? null)
const armiesHere = computed(() => v.value.armies.filter((a) => a.at === r.value.id && a.arriveAt === null))
const othersHere = computed(() => v.value.others.filter((a) => a.at === r.value.id && a.arriveAt === null))
const fieldArmies = computed(() => v.value.armies.filter((a) => a.own && !a.battleId))

type Mission = 'move' | 'claim' | 'raid' | 'siege'
const sending = ref<Mission | null>(null)

const canClaim = computed(() => r.value.kind === 'open' && !r.value.ownerId && !r.value.villageOf)
const canRaid = computed(() => r.value.kind === 'fortress' || (!!villageOf.value && hostileOwner.value && !ownerProtected.value))
const canDeclare = computed(() => hostileOwner.value && !ownerProtected.value && !wars.value.length && me.value.founded)

function bonusText(): string {
  const b = r.value.bonus
  if (!b) return ''
  if (b.kind === 'production') return `+${b.pct}% ${b.res} for whoever holds it`
  if (b.kind === 'troopCap') return `+${b.amount} troop cap for whoever holds it`
  return `+${b.pct}% march speed for whoever holds it`
}

async function declare() {
  const what = villageOf.value ? `${villageOf.value.name}’s village. If you win, they are out of the world.` : r.value.name
  if (!confirm(`Declare a siege on ${what}? It starts after a day's notice, in the battle window.`)) return
  await act({ type: 'declareSiege', regionId: r.value.id }, 'Siege declared. Muster your armies there before it starts.')
}

async function redirect(armyId: string, mission: Mission | 'return', warId?: string) {
  const a: Parameters<typeof act>[0] = { type: 'redirect', armyId, target: r.value.id, mission }
  if (warId) a.warId = warId
  await act(a, mission === 'return' ? 'Heading home' : 'New orders sent')
}
</script>

<template>
  <div class="sheet-backdrop" @click.self="emit('close')">
    <section class="sheet" role="dialog" :aria-label="r.name">
      <div class="grip" aria-hidden="true"></div>
      <div class="row spread">
        <h2 class="row"><Icon :name="r.kind === 'fortress' ? 'fortress' : r.kind === 'blight' ? 'blight' : villageOf ? 'village' : 'obelisk'" /> {{ r.name }}</h2>
        <button class="btn ghost small" aria-label="Close" @click="emit('close')"><Icon name="close" :size="16" /></button>
      </div>
      <p class="ui small muted">{{ r.quarter }} &middot; {{ r.terrain }}<template v-if="r.kind === 'fortress'"> &middot; Forgotten fortress, level {{ r.fortress?.level }}</template></p>

      <template v-if="r.kind === 'blight'">
        <p>The Blight. Nothing grows right here, and the only way in will be on a Wayfarer's adventure. Closed for now.</p>
      </template>
      <template v-else-if="r.kind === 'fortress'">
        <p>A Forgotten stronghold with a garrison of <strong>{{ r.fortress?.size }}</strong>. Beat it in a raid for gold and food; the garrison grows back over time.</p>
      </template>
      <template v-else>
        <p v-if="villageOf">Village of <strong>{{ villageOf.name }}</strong><template v-if="ownerHouse"> of {{ ownerHouse.name }} [{{ ownerHouse.tag }}]</template>.<span v-if="ownerProtected" class="pill good">protected</span></p>
        <p v-else-if="owner">Held by <strong>{{ owner.name }}</strong><template v-if="ownerHouse"> of {{ ownerHouse.name }}</template>.</p>
        <p v-else>A dormant Obelisk. Send an army to wake it and the region is yours.</p>
        <p v-if="bonusText()" class="ui small"><span class="pill gold">{{ bonusText() }}</span></p>
      </template>

      <div v-for="w in wars" :key="w.id" class="card war">
        <div class="row spread">
          <strong class="row"><Icon name="sword" :size="16" /> Siege</strong>
          <span class="ui small">{{ w.state === 'fighting' ? 'fighting now' : `starts in ${countdown(w.startsAt - worldTime)}` }}</span>
        </div>
        <p class="ui small muted">{{ v.players.find((p) => p.id === w.attackerId)?.name }} against {{ v.players.find((p) => p.id === w.defenderId)?.name }}{{ w.village ? ' — the village itself' : '' }}. Armies must be here before it starts.</p>
      </div>

      <div v-if="armiesHere.length || othersHere.length" class="here">
        <h3>Here now</h3>
        <p v-for="a in armiesHere" :key="a.id" class="ui small">{{ a.own ? 'Your army' : `${v.players.find((p) => p.id === a.ownerId)?.name}’s army` }}: {{ unitsText(a.units) }}</p>
        <p v-for="a in othersHere" :key="a.id" class="ui small" style="color: var(--bad)">{{ v.players.find((p) => p.id === a.ownerId)?.name }}: {{ a.size }} troops</p>
      </div>

      <div v-if="!out && me.founded && r.kind !== 'blight'" class="actions">
        <h3>Send from your village</h3>
        <div class="row wrap">
          <button v-if="canRaid" class="btn small" @click="sending = 'raid'"><Icon name="sword" :size="16" /> Raid</button>
          <button v-if="canClaim" class="btn small" @click="sending = 'claim'"><Icon name="flag" :size="16" /> Claim ({{ CLAIM_COST.wood }} wood, {{ CLAIM_COST.stone }} stone)</button>
          <button v-if="myWar && myWar.state === 'declared'" class="btn small" @click="sending = 'siege'"><Icon name="sword" :size="16" /> Join the siege</button>
          <button v-if="r.id !== me.homeRegion" class="btn small ghost" @click="sending = 'move'">Station here</button>
          <button v-if="canDeclare" class="btn small danger" @click="declare"><Icon name="crown" :size="16" /> Declare siege</button>
        </div>
        <p v-if="hostileOwner && ownerProtected" class="ui small faint">Under beginner protection: no raids or sieges yet.</p>

        <template v-if="fieldArmies.length">
          <h3>Armies in the field</h3>
          <div v-for="a in fieldArmies" :key="a.id" class="card field">
            <p class="ui small">{{ unitsText(a.units) }} &middot; at {{ v.regions[a.at]?.name }}</p>
            <div class="row wrap">
              <button v-if="a.at !== r.id || a.arriveAt !== null" class="btn small ghost" @click="redirect(a.id, 'move')">Move here</button>
              <button v-if="canRaid" class="btn small ghost" @click="redirect(a.id, 'raid')">Raid here</button>
              <button v-if="canClaim" class="btn small ghost" @click="redirect(a.id, 'claim')">Claim here</button>
              <button v-if="myWar && myWar.state === 'declared'" class="btn small ghost" @click="redirect(a.id, 'siege', myWar.id)">Join siege</button>
            </div>
          </div>
        </template>
      </div>
    </section>
    <SendArmy v-if="sending" :region-id="r.id" :mission="sending" :war-id="myWar?.id" @close="sending = null" @sent="sending = null; emit('close')" />
  </div>
</template>

<style scoped>
.sheet-backdrop {
  position: fixed;
  inset: 0;
  z-index: 40;
  background: #0006;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}
.sheet {
  width: 100%;
  max-width: 720px;
  max-height: 78dvh;
  overflow: auto;
  background: var(--panel);
  border: 1px solid var(--border);
  border-bottom: 0;
  border-radius: 16px 16px 0 0;
  padding: 0.5rem 16px calc(1rem + env(safe-area-inset-bottom));
}
.grip {
  width: 40px;
  height: 4px;
  border-radius: 2px;
  background: var(--border);
  margin: 0.25rem auto 0.75rem;
}
h2 {
  margin: 0;
}
.war {
  border-color: #7a3c33;
  margin-bottom: 0.75rem;
}
.war p {
  margin: 0.25rem 0 0;
}
.here,
.actions {
  margin-top: 0.75rem;
}
.here p {
  margin: 0 0 0.25rem;
}
.field {
  margin-top: 0.5rem;
}
.field p {
  margin: 0 0 0.4rem;
}
h3 {
  margin-top: 0.75rem;
}
</style>
