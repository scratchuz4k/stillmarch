<script setup lang="ts">
import { onMounted } from 'vue'
import { boot, state } from './store.ts'
import AuthView from './views/AuthView.vue'
import LobbyView from './views/LobbyView.vue'
import GameView from './views/GameView.vue'

onMounted(boot)
</script>

<template>
  <div v-if="state.booting" class="splash ui muted">Waking the Obelisk&hellip;</div>
  <AuthView v-else-if="!state.account" />
  <LobbyView v-else-if="!state.view" />
  <GameView v-else />
  <Transition name="toast">
    <div v-if="state.toast" class="toast ui" :class="{ error: state.toast.error }" role="status">{{ state.toast.text }}</div>
  </Transition>
</template>

<style>
.splash {
  min-height: 100dvh;
  display: grid;
  place-items: center;
}
.toast {
  position: fixed;
  left: 16px;
  right: 16px;
  bottom: calc(var(--tabbar) + 12px + env(safe-area-inset-bottom));
  max-width: 480px;
  margin: 0 auto;
  padding: 0.7rem 1rem;
  border-radius: var(--radius);
  background: #24301f;
  border: 1px solid #3f6b48;
  color: var(--ink);
  font-size: 0.9rem;
  z-index: 100;
  box-shadow: 0 8px 30px #0008;
}
.toast.error {
  background: #301d1a;
  border-color: #7a3c33;
}
.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.2s, transform 0.2s;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>
