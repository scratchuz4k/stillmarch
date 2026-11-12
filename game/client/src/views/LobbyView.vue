<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { api } from '../api.ts'
import { logout, openWorld, refreshWorlds, state, toast } from '../store.ts'

const creating = ref(false)
const name = ref('Valdris test')
const speed = ref(50)
const alwaysOpen = ref(true)
const aiHouses = ref(2)

onMounted(() => refreshWorlds().catch((e: Error) => toast(e.message, true)))

async function enter(id: string) {
  try {
    await openWorld(id)
  } catch (e) {
    toast((e as Error).message, true)
  }
}

async function create() {
  try {
    const { id } = await api.createWorld({ name: name.value, speed: speed.value, alwaysOpen: alwaysOpen.value, aiHouses: aiHouses.value })
    await refreshWorlds()
    creating.value = false
    await enter(id)
  } catch (e) {
    toast((e as Error).message, true)
  }
}
</script>

<template>
  <main class="page">
    <div class="row spread">
      <h1>Worlds</h1>
      <button class="btn ghost small" @click="logout">Log out</button>
    </div>
    <p class="muted">Signed in as <strong>{{ state.account?.username }}</strong> &middot; {{ state.account?.cards.length }} Wayfarer cards in your collection.</p>
    <div class="stack">
      <div v-for="w in state.worlds" :key="w.id" class="card world">
        <div class="row spread">
          <h2>{{ w.name }}</h2>
          <span v-if="w.dev" class="pill blight">test world</span>
        </div>
        <p class="ui small muted">
          Speed &times;{{ w.speed }} &middot; {{ w.players }}/{{ w.maxPlayers }} players &middot; sieges: {{ w.window }}
        </p>
        <button v-if="w.joined" class="btn block" @click="enter(w.id)">Continue</button>
        <button v-else-if="w.joinOpen" class="btn block" @click="enter(w.id)">Join this world</button>
        <p v-else class="faint small ui">Closed to new players.</p>
      </div>
      <div v-if="!state.worlds.length" class="empty">No worlds yet.</div>
    </div>

    <div class="section-title"><h2>New test world</h2></div>
    <button v-if="!creating" class="btn ghost block" @click="creating = true">Create a test world</button>
    <form v-else class="card stack" @submit.prevent="create">
      <div>
        <label for="wn">Name</label>
        <input id="wn" v-model="name" type="text" maxlength="40" />
      </div>
      <div>
        <label for="ws">World speed (&times;)</label>
        <input id="ws" v-model.number="speed" type="number" min="1" max="1000" />
        <p class="faint small ui">At &times;50 a day of game time takes about half an hour.</p>
      </div>
      <div>
        <label for="ai">AI Houses</label>
        <input id="ai" v-model.number="aiHouses" type="number" min="0" max="3" />
      </div>
      <label class="row"><input v-model="alwaysOpen" type="checkbox" /> Sieges any time (instead of 16:30&ndash;22:30 CET)</label>
      <div class="row">
        <button class="btn">Create and join</button>
        <button type="button" class="btn ghost" @click="creating = false">Cancel</button>
      </div>
    </form>
  </main>
</template>

<style scoped>
.world h2 {
  margin: 0;
}
</style>
