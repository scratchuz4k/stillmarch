<script setup lang="ts">
import type { Chapter } from '../content/story'
import { vReveal } from '../directives/reveal'

defineProps<{ chapter: Chapter; side: 'left' | 'right' }>()
</script>

<template>
  <section class="chapter" :class="[`chapter--${side}`, { 'chapter--blight': chapter.tone === 'blight' }]">
    <article class="panel">
      <header class="panel__head">
        <span v-reveal class="panel__numeral" aria-hidden="true">{{ chapter.numeral }}</span>
        <p v-reveal="1" class="panel__kicker">
          <span class="visually-hidden">Chapter {{ chapter.numeral }}: </span>{{ chapter.kicker }}
        </p>
        <h2 v-reveal="2" class="panel__title ruled">{{ chapter.title }}</h2>
      </header>

      <p v-for="(para, i) in chapter.body" :key="i" v-reveal="3 + i" class="panel__body">{{ para }}</p>

      <template v-for="(extra, i) in chapter.extras" :key="`x${i}`">
        <figure v-if="extra.kind === 'quote'" v-reveal="4 + i" class="quote">
          <blockquote>{{ extra.text }}</blockquote>
          <figcaption v-if="extra.note">{{ extra.note }}</figcaption>
        </figure>

        <ol v-else-if="extra.kind === 'ladder'" v-reveal="4 + i" class="ladder">
          <li v-for="step in extra.steps" :key="step.name">
            <span class="ladder__name">{{ step.name }}</span>
            <span class="ladder__note">{{ step.note }}</span>
          </li>
        </ol>
      </template>

    </article>
  </section>
</template>

<style scoped>
.chapter {
  --tone: var(--accent);
  --tone-strong: var(--accent-strong);
  --tone-line: rgb(184 150 106 / 0.28);

  --rule: var(--tone);

  min-height: 100svh;
  display: flex;
  align-items: center;
  padding: 10svh 16px;
  scroll-snap-align: center;
}

.chapter--blight {
  --tone: var(--blight);
  --tone-strong: var(--blight-strong);
  --tone-line: rgb(181 124 255 / 0.3);
}

.chapter--left { justify-content: flex-start; }
.chapter--right { justify-content: flex-end; }

@media (min-width: 900px) {
  .chapter { padding-inline: 7vw; }
}

.panel {
  position: relative;
  width: min(100%, 35rem);
  padding: 2.25rem 1.5rem 2rem;
  border: 1px solid var(--tone-line);
  border-radius: 3px;
  background: linear-gradient(160deg, rgb(15 17 24 / 0.86), rgb(15 17 24 / 0.66));
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  box-shadow: 0 30px 80px -30px rgb(0 0 0 / 0.7);
}

.chapter--blight .panel {
  background: linear-gradient(160deg, rgb(22 12 34 / 0.86), rgb(18 10 28 / 0.62));
}

/* Bronze (or violet) rule down the inner edge, facing the compass. */
.panel::before {
  content: '';
  position: absolute;
  top: 2rem;
  bottom: 2rem;
  width: 2px;
  background: linear-gradient(transparent, var(--tone), transparent);
}
.chapter--left .panel::before { right: -1px; }
.chapter--right .panel::before { left: -1px; }

@media (min-width: 600px) {
  .panel { padding: 3rem 2.75rem 2.75rem; }
}

.panel__head {
  position: relative;
  margin-bottom: 1.5rem;
}

.panel__numeral {
  position: absolute;
  top: -1.4rem;
  right: -0.25rem;
  font-family: var(--font-display);
  font-size: clamp(4.5rem, 12vw, 7rem);
  font-weight: 700;
  line-height: 1;
  color: transparent;
  -webkit-text-stroke: 1px var(--tone-line);
  pointer-events: none;
  user-select: none;
}

.panel__kicker {
  font-family: var(--font-display);
  font-size: 0.78rem;
  font-weight: 600;
  letter-spacing: 0.28em;
  text-transform: uppercase;
  color: var(--tone);
}

.panel__title {
  position: relative;
  margin-top: 0.85rem;
  font-family: var(--font-display);
  font-weight: 700;
  font-size: clamp(1.75rem, 4.2vw, 2.5rem);
  line-height: 1.15;
  letter-spacing: 0.03em;
  color: var(--tone-strong);
  text-wrap: balance;
}

.panel__body {
  color: var(--ink-dim);
  text-wrap: pretty;
}

.panel__body + .panel__body {
  margin-top: 0.9rem;
}

.panel__body:first-of-type {
  font-size: 1.2rem;
  color: var(--ink);
}

/* --- Extras --- */
.quote,
.ladder {
  margin-top: 1.75rem;
}

.quote {
  padding-left: 1.25rem;
  border-left: 2px solid var(--tone);
}

.quote blockquote {
  font-size: 1.4rem;
  font-style: italic;
  line-height: 1.35;
  color: var(--tone-strong);
}

.quote figcaption {
  margin-top: 0.75rem;
  font-size: 0.98rem;
  color: var(--ink-faint);
}

.ladder {
  list-style: none;
  padding: 0;
}

.ladder li {
  position: relative;
  display: grid;
  gap: 0.1rem;
  padding: 0 0 1rem 1.75rem;
}

/* Rungs: a dot per rank, joined by a line. */
.ladder li::before {
  content: '';
  position: absolute;
  left: 0.2rem;
  top: 0.45rem;
  width: 9px;
  height: 9px;
  border: 1px solid var(--tone);
  transform: rotate(45deg);
  background: var(--bg);
}

.ladder li:not(:last-child)::after {
  content: '';
  position: absolute;
  left: calc(0.2rem + 4px);
  top: 1.1rem;
  bottom: 0.15rem;
  width: 1px;
  background: var(--tone-line);
}

.ladder li:last-child {
  padding-bottom: 0;
}

.ladder__name {
  font-family: var(--font-display);
  font-weight: 600;
  letter-spacing: 0.08em;
  color: var(--tone-strong);
}

.ladder__note {
  font-size: 1rem;
  color: var(--ink-dim);
}

</style>
