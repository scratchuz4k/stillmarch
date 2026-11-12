<script setup lang="ts">
import { ref } from 'vue'
import { login, toast } from '../store.ts'

const mode = ref<'login' | 'register'>('login')
const username = ref('')
const password = ref('')
const busy = ref(false)

async function submit() {
  busy.value = true
  try {
    await login(username.value, password.value, mode.value === 'register')
  } catch (e) {
    toast((e as Error).message, true)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <main class="auth">
    <div class="crest" aria-hidden="true">
      <svg viewBox="0 0 120 160" width="72" height="96">
        <path d="M52 150 L56 40 L64 40 L68 150 Z" fill="none" stroke="#b8966a" stroke-width="3" />
        <path d="M50 34 L60 14 L70 34 Z" fill="none" stroke="#dcbd90" stroke-width="3" />
        <path d="M30 152 H90" stroke="#b8966a" stroke-width="3" stroke-dasharray="40 6 8" />
        <circle cx="60" cy="6" r="3" fill="#a9c2ff" />
      </svg>
    </div>
    <h1>Stillmarch</h1>
    <p class="muted lede">You come back to Valdris with nothing: no books, no records. Claim an Obelisk and make a House of it.</p>
    <form class="card stack" @submit.prevent="submit">
      <div>
        <label for="u">Username</label>
        <input id="u" v-model="username" type="text" autocomplete="username" required minlength="3" maxlength="20" />
      </div>
      <div>
        <label for="p">Password</label>
        <input id="p" v-model="password" type="password" :autocomplete="mode === 'register' ? 'new-password' : 'current-password'" required minlength="6" />
      </div>
      <button class="btn block" :disabled="busy">{{ mode === 'login' ? 'Log in' : 'Create account' }}</button>
      <button type="button" class="btn ghost block" @click="mode = mode === 'login' ? 'register' : 'login'">
        {{ mode === 'login' ? 'New here? Create an account' : 'Have an account? Log in' }}
      </button>
    </form>
  </main>
</template>

<style scoped>
.auth {
  max-width: 420px;
  margin: 0 auto;
  padding: 3rem 16px;
  text-align: center;
}
.crest {
  margin-bottom: 0.5rem;
}
h1 {
  font-size: 2.2rem;
}
.lede {
  margin-bottom: 1.5rem;
}
form {
  text-align: left;
}
</style>
