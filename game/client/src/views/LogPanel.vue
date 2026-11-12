<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import BattleReport from '../components/BattleReport.vue'
import { act, state, worldTime } from '../store.ts'
import { ago } from '../format.ts'

const v = computed(() => state.view!)
const tab = ref<'reports' | 'chat'>('reports')
const open = ref<string | null>(null)
const text = ref('')
const worldChat = computed(() => v.value.chat.filter((m) => m.channel === 'world').slice(-80))

onMounted(() => {
  if (v.value.me.reports.some((r) => !r.read)) void act({ type: 'readReports' })
})

async function send() {
  if (!text.value.trim()) return
  const r = await act({ type: 'chat', channel: 'world', text: text.value })
  if (r !== null) text.value = ''
}
</script>

<template>
  <div class="page">
    <div class="row seg ui" role="tablist">
      <button role="tab" :aria-selected="tab === 'reports'" :class="{ on: tab === 'reports' }" @click="tab = 'reports'">Reports</button>
      <button role="tab" :aria-selected="tab === 'chat'" :class="{ on: tab === 'chat' }" @click="tab = 'chat'">World chat</button>
    </div>

    <template v-if="tab === 'reports'">
      <div class="stack">
        <article v-for="r in v.me.reports" :key="r.id" class="card report" :class="{ unread: !r.read, battle: !!r.battle }">
          <button class="head" :aria-expanded="open === r.id" @click="open = open === r.id ? null : r.id">
            <span class="row spread">
              <strong>{{ r.title }}</strong>
              <span class="ui small faint">{{ ago(worldTime - r.at) }}</span>
            </span>
            <span class="small muted">{{ r.text }}</span>
          </button>
          <BattleReport v-if="r.battle && open === r.id" :log="r.battle" />
        </article>
        <div v-if="!v.me.reports.length" class="empty">Nothing has happened yet.</div>
      </div>
    </template>

    <template v-else>
      <div class="card chat">
        <p v-for="m in worldChat" :key="m.id" class="small"><strong>{{ m.fromName }}:</strong> {{ m.text }} <span class="faint ui">{{ ago(worldTime - m.at) }}</span></p>
        <p v-if="!worldChat.length" class="faint small ui">Nobody has said anything yet.</p>
      </div>
      <form class="row send" @submit.prevent="send">
        <input v-model="text" type="text" maxlength="300" placeholder="Say something to the world" aria-label="Message to the world" />
        <button class="btn">Send</button>
      </form>
    </template>
  </div>
</template>

<style scoped>
.seg {
  margin-bottom: 1rem;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 3px;
  gap: 3px;
}
.seg button {
  flex: 1;
  min-height: 38px;
  border: 0;
  border-radius: 8px;
  background: none;
  color: var(--ink-dim);
  font-weight: 600;
}
.seg button.on {
  background: var(--panel-2);
  color: var(--accent-strong);
}
.report {
  padding: 0;
}
.report.unread {
  border-color: var(--accent);
}
.head {
  display: block;
  width: 100%;
  text-align: left;
  background: none;
  border: 0;
  padding: 0.75rem 0.85rem;
}
.head .small {
  display: block;
  margin-top: 0.2rem;
}
.chat p {
  margin: 0 0 0.4rem;
}
.send {
  margin-top: 0.75rem;
}
</style>
