<script setup lang="ts">
import { ref } from 'vue'
import SiteHeader from '../components/SiteHeader.vue'
import { art, footage, media, type MediaItem } from '../content/media'
import { vReveal } from '../directives/reveal'

// Full-size viewer: a native <dialog>, so Escape and focus trapping come free.
const viewer = ref<HTMLDialogElement>()
const current = ref<MediaItem>()

const view = (item: MediaItem) => {
  current.value = item
  viewer.value?.showModal()
}
// Clicking the dim backdrop (the dialog itself, not its contents) closes it.
const onViewerClick = (e: MouseEvent) => {
  if (e.target === viewer.value) viewer.value?.close()
}
</script>

<template>
  <SiteHeader root="../" />

  <main class="page">
    <header class="head">
      <p v-reveal class="head__kicker">{{ media.kicker }}</p>
      <h1 v-reveal="1" class="head__title ruled">{{ media.title }}</h1>
      <p v-reveal="2" class="head__dek">{{ media.dek }}</p>
    </header>

    <section class="grid" aria-label="Art">
      <figure
        v-for="(item, i) in art"
        :key="item.file"
        v-reveal="i"
        class="card"
        :class="{ 'card--wide': item.width > item.height }"
      >
        <button class="card__view" type="button" :aria-label="`View ${item.title} full size`" @click="view(item)">
          <img :src="item.src" :alt="`${item.title}: ${item.note}`" :width="item.width" :height="item.height" loading="lazy" />
        </button>
        <figcaption class="card__caption">
          <span class="card__text">
            <span class="card__title">{{ item.title }}</span>
            <span class="card__note">{{ item.note }} · {{ item.width }}×{{ item.height }} WebP</span>
          </span>
          <a class="card__download" :href="item.src" :download="item.file">Download</a>
        </figcaption>
      </figure>
    </section>

    <section class="footage">
      <h2 v-reveal class="footage__title ruled">{{ footage.title }}</h2>
      <p v-reveal="1" class="footage__empty">{{ footage.empty }}</p>
    </section>
  </main>

  <dialog ref="viewer" class="viewer" aria-label="Full-size image" @click="onViewerClick">
    <template v-if="current">
      <img :src="current.src" :alt="`${current.title}: ${current.note}`" />
      <div class="viewer__bar">
        <span>{{ current.title }}</span>
        <a :href="current.src" :download="current.file">Download</a>
        <button type="button" @click="viewer?.close()">Close</button>
      </div>
    </template>
  </dialog>
</template>

<style scoped>
.page {
  width: min(100% - 40px, 72rem);
  margin-inline: auto;
  padding: calc(64px + 12svh) 0 14svh;
}

/* --- Head --- */
.head__kicker {
  font-family: var(--font-display);
  font-size: 0.78rem;
  font-weight: 600;
  letter-spacing: 0.28em;
  text-transform: uppercase;
  color: var(--accent);
}

.head__title {
  margin-top: 0.85rem;
  font-family: var(--font-display);
  font-size: clamp(2.2rem, 6vw, 3.6rem);
  font-weight: 700;
  line-height: 1.1;
  letter-spacing: 0.03em;
  color: var(--accent-strong);
  --rule-width: 260px;
}

.head__dek {
  max-width: 46ch;
  margin-top: 1.25rem;
  color: var(--ink-dim);
}

/* --- Art grid --- */
.grid {
  display: grid;
  gap: 1.5rem;
  margin-top: 3.5rem;
}

@media (min-width: 720px) {
  .grid {
    grid-template-columns: 1fr 1fr;
  }

  .card--wide {
    grid-column: 1 / -1;
  }
}

.card {
  margin: 0;
  border: 1px solid rgb(184 150 106 / 0.2);
  border-radius: 3px;
  background: rgb(21 25 35 / 0.6);
  overflow: hidden;
  transition: border-color 0.25s;
}

.card:hover,
.card:focus-within {
  border-color: rgb(184 150 106 / 0.5);
}

.card__view {
  display: block;
  width: 100%;
  padding: 0;
  border: 0;
  background: #0f1118;
  cursor: zoom-in;
  overflow: hidden;
}

.card__view img {
  width: 100%;
  height: auto;
  transition: transform 0.6s cubic-bezier(0.16, 1, 0.3, 1);
}

.card__view:hover img,
.card__view:focus-visible img {
  transform: scale(1.025);
}

.card__caption {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem 1.25rem;
  border-top: 1px solid rgb(184 150 106 / 0.14);
}

.card__text {
  display: grid;
  gap: 0.15rem;
}

.card__title {
  font-family: var(--font-display);
  font-weight: 600;
  letter-spacing: 0.05em;
  color: var(--ink);
}

.card__note {
  font-size: 0.92rem;
  color: var(--ink-faint);
}

.card__download,
.viewer__bar a,
.viewer__bar button {
  flex-shrink: 0;
  padding: 0.5rem 0.95rem;
  border: 1px solid var(--accent);
  border-radius: 2px;
  background: none;
  font-family: var(--font-display);
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  text-decoration: none;
  color: var(--accent-strong);
  cursor: pointer;
  transition:
    background-color 0.2s,
    color 0.2s;
}

.card__download:hover,
.card__download:focus-visible,
.viewer__bar a:hover,
.viewer__bar a:focus-visible,
.viewer__bar button:hover,
.viewer__bar button:focus-visible {
  background: var(--accent);
  color: var(--bg);
}

:focus-visible {
  outline: 2px solid var(--glow);
  outline-offset: 3px;
}

/* --- Footage --- */
.footage {
  margin-top: 6rem;
}

.footage__title {
  font-family: var(--font-display);
  font-size: clamp(1.6rem, 4vw, 2.2rem);
  font-weight: 700;
  letter-spacing: 0.03em;
  color: var(--accent-strong);
}

.footage__empty {
  max-width: 46ch;
  margin-top: 1.25rem;
  padding: 1.5rem 1.75rem;
  border: 1px dashed rgb(184 150 106 / 0.3);
  border-radius: 3px;
  font-style: italic;
  color: var(--ink-faint);
}

/* --- Viewer --- */
.viewer {
  /* The global reset zeroes margins; auto margins are what centre a modal. */
  margin: auto;
  max-width: min(96vw, 1400px);
  max-height: 94svh;
  padding: 0;
  border: 1px solid rgb(184 150 106 / 0.3);
  border-radius: 3px;
  background: #0f1118;
  color: var(--ink);
}

.viewer::backdrop {
  background: rgb(6 7 11 / 0.85);
  backdrop-filter: blur(4px);
}

.viewer img {
  display: block;
  max-width: 100%;
  max-height: calc(94svh - 64px);
  margin-inline: auto;
}

.viewer__bar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border-top: 1px solid rgb(184 150 106 / 0.18);
  font-family: var(--font-display);
  letter-spacing: 0.05em;
}

.viewer__bar span {
  margin-right: auto;
}

@media (prefers-reduced-motion: reduce) {
  .card__view img {
    transition: none;
  }
}
</style>
