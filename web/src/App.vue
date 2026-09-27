<script setup lang="ts">
import CompassScene from './components/CompassScene.vue'
import StoryChapter from './components/StoryChapter.vue'
import { chapters, closing, hero } from './content/story'
import { vReveal } from './directives/reveal'

// The systems reference (dev/) is deployed one level up from this page.
const REFERENCE_URL = '../'
</script>

<template>
  <CompassScene />
  <div class="vignette" aria-hidden="true"></div>

  <main class="page">
    <section class="hero">
      <h1 v-reveal class="hero__title ruled">{{ hero.title }}</h1>
      <p v-reveal="1" class="hero__sub">{{ hero.sub }}</p>
      <span v-reveal="2" class="hero__cue" aria-hidden="true">Scroll to begin</span>
    </section>

    <StoryChapter
      v-for="(chapter, i) in chapters"
      :key="chapter.numeral"
      :chapter="chapter"
      :side="i % 2 ? 'right' : 'left'"
    />

    <section class="closing">
      <h2 v-reveal class="closing__title ruled">{{ closing.title }}</h2>

      <ol v-reveal="1" class="path" aria-label="Road to launch">
        <li v-for="step in closing.path" :key="step">{{ step }}</li>
      </ol>
      <p v-reveal="2" class="path__note">{{ closing.pathNote }}</p>

      <a v-reveal="3" class="closing__cta" :href="REFERENCE_URL">{{ closing.cta }}</a>
    </section>
  </main>
</template>

<style scoped>
.page {
  position: relative;
  z-index: 1;
}

/* One backdrop for the whole page, so the hero's framing carries all the
   way down instead of ending at its bottom edge. */
.vignette {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background: radial-gradient(120% 90% at 50% 40%, transparent 55%, rgb(8 9 14 / 0.75));
}

/* --- Hero --- */
.hero {
  min-height: 100svh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  position: relative;
  padding: 0 16px 9svh;
  text-align: center;
  scroll-snap-align: start;
}


.hero__title {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: clamp(2.75rem, 10vw, 6.5rem);
  letter-spacing: 0.14em;
  line-height: 1;
  text-transform: uppercase;
  color: var(--ink);
  text-shadow: 0 0 40px rgb(169 194 255 / 0.25), 0 2px 24px rgb(15 17 24 / 0.9);
  --rule-width: 420px;
}


.hero__sub {
  max-width: 44ch;
  margin-top: 1.5rem;
  color: var(--ink-dim);
  text-shadow: 0 2px 14px rgb(15 17 24 / 0.95);
  text-wrap: balance;
}

.hero__cue {
  margin-top: 2.5rem;
  font-family: var(--font-display);
  font-size: 0.72rem;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  color: var(--accent);
}

.hero__cue::after {
  content: '';
  display: block;
  width: 1px;
  height: 44px;
  margin: 0.75rem auto 0;
  background: linear-gradient(var(--accent), transparent);
  animation: cue 2.4s ease-in-out infinite;
  transform-origin: top;
}

@keyframes cue {
  0%, 100% { transform: scaleY(0.3); opacity: 0.4; }
  50% { transform: scaleY(1); opacity: 1; }
}

@media (prefers-reduced-motion: reduce) {
  .hero__cue::after { animation: none; }
}

/* --- Closing --- */
.closing {
  min-height: 100svh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 14svh 16px;
  text-align: center;
  scroll-snap-align: center;
  /* Light violet scrim: keeps the text readable without hiding the Blight. */
  background: radial-gradient(60% 45% at 50% 50%, rgb(20 10 30 / 0.7), transparent 75%);
}

.closing__title {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: clamp(2.2rem, 7vw, 4.4rem);
  line-height: 1.1;
  color: var(--ink);
  text-shadow: 0 0 40px rgb(181 124 255 / 0.35);
  text-wrap: balance;
  --rule: var(--blight);
  --rule-width: 320px;
}


.path {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.75rem 0;
  margin-top: 2.75rem;
  padding: 0;
  list-style: none;
  counter-reset: step;
}

.path li {
  display: flex;
  align-items: center;
  font-family: var(--font-display);
  font-size: 0.82rem;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--ink);
  counter-increment: step;
}

.path li::before {
  content: counter(step);
  display: inline-grid;
  place-items: center;
  width: 1.7rem;
  height: 1.7rem;
  margin-right: 0.6rem;
  border: 1px solid var(--blight);
  border-radius: 50%;
  font-size: 0.72rem;
  letter-spacing: 0;
  color: var(--blight-strong);
}

.path li:not(:last-child)::after {
  content: '';
  width: 2.25rem;
  height: 1px;
  margin: 0 0.9rem;
  background: linear-gradient(90deg, var(--blight), transparent);
}

.path__note {
  margin-top: 0.9rem;
  font-size: 0.98rem;
  font-style: italic;
  color: var(--ink-faint);
}

.closing__cta {
  margin-top: 2.5rem;
  padding: 1rem 2rem;
  border: 1px solid var(--accent);
  border-radius: 2px;
  background: rgb(15 17 24 / 0.5);
  font-family: var(--font-display);
  font-size: 0.85rem;
  font-weight: 600;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  text-decoration: none;
  color: var(--accent-strong);
  transition: background-color 0.25s, color 0.25s;
}

.closing__cta:hover,
.closing__cta:focus-visible {
  background: var(--accent);
  color: var(--bg);
}

.closing__cta:focus-visible {
  outline: 2px solid var(--glow);
  outline-offset: 3px;
}
</style>
