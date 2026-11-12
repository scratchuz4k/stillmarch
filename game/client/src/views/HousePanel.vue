<script setup lang="ts">
import { computed, ref } from 'vue'
import { ALLY_WIN_AGE, HOUSE_SWITCH_COOLDOWN, type House } from '@stillmarch/shared'
import Icon from '../components/Icon.vue'
import { act, state, worldTime } from '../store.ts'
import { countdown } from '../format.ts'

const v = computed(() => state.view!)
const me = computed(() => v.value.me)
const myHouse = computed(() => v.value.houses.find((h) => h.id === me.value.houseId) ?? null)
const others = computed(() => v.value.houses.filter((h) => h.id !== me.value.houseId))
const isLeader = computed(() => myHouse.value?.leaderId === me.value.id)
const canLead = computed(() => isLeader.value || !!myHouse.value?.officers.includes(me.value.id))
const memberLimit = computed(() => v.value.houseMemberLimit)
const allyCap = computed(() => v.value.allianceLimit)
const switchIn = computed(() => {
  if (me.value.houseJoinedAt === null) return 0
  const scaled = (HOUSE_SWITCH_COOLDOWN * 1000) / v.value.speed
  return me.value.houseJoinedAt + scaled - worldTime.value
})
const winAge = computed(() => (ALLY_WIN_AGE * 1000) / v.value.speed)

const name = (id: string) => v.value.players.find((p) => p.id === id)?.name ?? '?'
const houseName = (id: string) => v.value.houses.find((h) => h.id === id)?.name ?? '?'
const isAIHouse = (h: House) => v.value.players.find((p) => p.id === h.leaderId)?.isAI ?? false
const allied = (h: House) => !!myHouse.value?.allies.some((a) => a.houseId === h.id)
const offered = (h: House) => !!myHouse.value?.allyOffers.includes(h.id)

const newName = ref('')
const newTag = ref('')
async function create() {
  const id = await act({ type: 'createHouse', name: newName.value, tag: newTag.value }, 'Your House is founded')
  if (id) {
    newName.value = ''
    newTag.value = ''
  }
}

function leave() {
  if (confirm(`Leave ${myHouse.value?.name}? You can't join another House for 3 world-days after joining one.`)) {
    void act({ type: 'leaveHouse' }, 'You left the House')
  }
}

function betray(h: House) {
  if (confirm(`Break the alliance with ${h.name}? It ends at once, and they can be attacked straight away.`)) {
    void act({ type: 'breakAlliance', houseId: h.id }, 'The alliance is broken')
  }
}

const wars = computed(() => v.value.wars.filter((w) => w.state !== 'done'))
const pastWars = computed(() => v.value.wars.filter((w) => w.state === 'done').slice(-5).reverse())

const chatText = ref('')
const houseChat = computed(() => (myHouse.value ? v.value.chat.filter((m) => m.channel === myHouse.value!.id).slice(-30) : []))
async function sendChat() {
  if (!myHouse.value || !chatText.value.trim()) return
  const ok = await act({ type: 'chat', channel: myHouse.value.id, text: chatText.value })
  if (ok !== null) chatText.value = ''
}

function showRegion(id: number) {
  state.focusRegion = id
  state.tab = 'map'
}
</script>

<template>
  <div class="page">
    <h1>House</h1>

    <template v-if="myHouse">
      <div class="card">
        <div class="row spread">
          <h2>{{ myHouse.name }} <span class="faint">[{{ myHouse.tag }}]</span></h2>
          <span class="pill">{{ myHouse.members.length }}/{{ memberLimit }}</span>
        </div>
        <ul class="members">
          <li v-for="m in myHouse.members" :key="m" class="row spread">
            <span>
              {{ name(m) }}
              <span v-if="m === myHouse.leaderId" class="pill gold">leader</span>
              <span v-else-if="myHouse.officers.includes(m)" class="pill">officer</span>
            </span>
            <button v-if="isLeader && m !== me.id" class="btn ghost small" @click="act({ type: 'setOfficer', memberId: m, officer: !myHouse.officers.includes(m) })">
              {{ myHouse.officers.includes(m) ? 'Make member' : 'Make officer' }}
            </button>
          </li>
        </ul>
        <p class="ui small faint">The leader and officers declare sieges and make alliances. You can't leave while your House is at war.</p>
        <button class="btn ghost small" @click="leave">Leave House</button>
      </div>

      <div class="section-title"><h2>Alliances</h2><span class="ui small faint">cap {{ allyCap }} players together</span></div>
      <div v-if="myHouse.allies.length" class="stack">
        <div v-for="a in myHouse.allies" :key="a.houseId" class="card row spread">
          <span>
            <strong>{{ houseName(a.houseId) }}</strong>
            <span class="ui small faint"> &middot; {{ worldTime - a.since >= winAge ? 'shares a win' : `shares a win in ${countdown(a.since + winAge - worldTime)}` }}</span>
          </span>
          <button v-if="canLead" class="btn danger small" @click="betray(v.houses.find((h) => h.id === a.houseId)!)">Break</button>
        </div>
      </div>
      <p v-else class="faint small ui">No allies. Allies can't attack each other, can join each other's battles, and share the win if the alliance is at least 3 world-days old.</p>
      <div v-if="myHouse.allyOffers.length" class="stack offers">
        <div v-for="o in myHouse.allyOffers" :key="o" class="card row spread">
          <span><strong>{{ houseName(o) }}</strong> offers an alliance</span>
          <span v-if="canLead" class="row">
            <button class="btn small" @click="act({ type: 'acceptAlliance', houseId: o }, 'Allied')">Accept</button>
            <button class="btn ghost small" @click="act({ type: 'declineAlliance', houseId: o })">No</button>
          </span>
        </div>
      </div>

      <div class="section-title"><h2>House chat</h2></div>
      <div class="card chat">
        <p v-for="m in houseChat" :key="m.id" class="small"><strong>{{ m.fromName }}:</strong> {{ m.text }}</p>
        <p v-if="!houseChat.length" class="faint small ui">Nothing said yet.</p>
        <form class="row" @submit.prevent="sendChat">
          <input v-model="chatText" type="text" maxlength="300" placeholder="To your House" aria-label="Message to your House" />
          <button class="btn small">Send</button>
        </form>
      </div>
    </template>

    <template v-else>
      <p class="muted">No one stands alone for long. Found a House, or join one that has room.</p>
      <p v-if="switchIn > 0" class="ui small faint">You joined a House recently: you can join another in {{ countdown(switchIn) }}.</p>
      <form v-if="!me.eliminated" class="card stack" @submit.prevent="create">
        <h3>Found a House</h3>
        <div class="grid2">
          <div>
            <label for="hn">Name</label>
            <input id="hn" v-model="newName" type="text" maxlength="32" placeholder="House Ashgrove" />
          </div>
          <div>
            <label for="ht">Tag</label>
            <input id="ht" v-model="newTag" type="text" maxlength="4" placeholder="ASH" />
          </div>
        </div>
        <button class="btn block" :disabled="state.busy">Found it</button>
      </form>
    </template>

    <div class="section-title"><h2>Houses in the world</h2></div>
    <div class="stack">
      <div v-for="h in others" :key="h.id" class="card">
        <div class="row spread">
          <strong>{{ h.name }} <span class="faint">[{{ h.tag }}]</span></strong>
          <span class="row">
            <span v-if="isAIHouse(h)" class="pill">AI</span>
            <span v-if="allied(h)" class="pill good">ally</span>
            <span class="pill">{{ h.members.length }}</span>
          </span>
        </div>
        <p class="ui small muted">{{ h.members.map(name).join(', ') }}<template v-if="h.allies.length"> &middot; allied with {{ h.allies.map((a) => houseName(a.houseId)).join(', ') }}</template></p>
        <div v-if="!isAIHouse(h) && !me.eliminated" class="row wrap">
          <button v-if="!myHouse" class="btn small" @click="act({ type: 'joinHouse', houseId: h.id }, `You joined ${h.name}`)">Join</button>
          <button v-if="myHouse && canLead && !allied(h) && !offered(h)" class="btn small ghost" @click="act({ type: 'proposeAlliance', houseId: h.id }, 'Alliance offered')">Offer alliance</button>
          <button v-if="myHouse && canLead && offered(h)" class="btn small" @click="act({ type: 'acceptAlliance', houseId: h.id }, 'Allied')">Accept their offer</button>
        </div>
      </div>
      <p v-if="!others.length" class="faint small ui">No other Houses yet.</p>
    </div>

    <div class="section-title"><h2>Sieges</h2></div>
    <div class="stack">
      <button v-for="w in wars" :key="w.id" class="card war" @click="showRegion(w.regionId)">
        <div class="row spread">
          <strong class="row"><Icon name="sword" :size="16" /> {{ v.regions[w.regionId]?.name }}</strong>
          <span class="ui small">{{ w.state === 'fighting' ? 'fighting now' : `in ${countdown(w.startsAt - worldTime)}` }}</span>
        </div>
        <span class="ui small muted">{{ name(w.attackerId) }} against {{ name(w.defenderId) }}{{ w.village ? ' (village)' : '' }}</span>
      </button>
      <p v-if="!wars.length" class="faint small ui">No sieges declared.</p>
      <p v-for="w in pastWars" :key="w.id" class="ui small faint">{{ v.regions[w.regionId]?.name }}: {{ w.result === 'attacker' ? `${name(w.attackerId)} won` : w.result === 'defender' ? `${name(w.defenderId)} held` : 'called off' }}</p>
    </div>
  </div>
</template>

<style scoped>
.members {
  list-style: none;
  padding: 0;
  margin: 0.5rem 0;
}
.members li {
  padding: 0.35rem 0;
  border-bottom: 1px solid var(--border);
}
.offers {
  margin-top: 0.75rem;
}
.chat p {
  margin: 0 0 0.35rem;
}
.chat form {
  margin-top: 0.5rem;
}
.war {
  text-align: left;
  width: 100%;
  border-color: #7a3c33;
  color: inherit;
}
</style>
