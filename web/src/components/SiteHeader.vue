<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { navLinks } from '../content/nav'

// Path from the current page back to the preview root: './' on the landing
// page, '../' on pages in a sub-folder such as media/.
const { root = './' } = defineProps<{ root?: string }>()
const to = (href: string) => (href === '#' ? href : root + href)

const open = ref(false)
const scrolled = ref(false)
const toggle = ref<HTMLButtonElement>()
const logo = to('stillmarch.png')

const onScroll = () => {
  scrolled.value = window.scrollY > 24
}
const onKey = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && open.value) {
    open.value = false
    toggle.value?.focus()
  }
}
// Placeholder links ('#') shouldn't jump the page back to the top.
const follow = (e: MouseEvent, href: string) => {
  if (href === '#') e.preventDefault()
  open.value = false
}

// Keep the page still behind the open mobile menu.
watch(open, (isOpen) => {
  document.documentElement.style.overflow = isOpen ? 'hidden' : ''
})

onMounted(() => {
  onScroll()
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScroll)
  window.removeEventListener('keydown', onKey)
  document.documentElement.style.overflow = ''
})
</script>

<template>
  <header class="header" :class="{ 'header--solid': scrolled || open, 'header--open': open }">
    <a class="brand" :href="to('')" aria-label="Stillmarch home">
      <img :src="logo" alt="" width="30" height="30" />
      <span>Stillmarch</span>
    </a>

    <nav class="nav" aria-label="Main">
      <a v-for="link in navLinks" :key="link.label" :href="to(link.href)" @click="follow($event, link.href)">
        {{ link.label }}
      </a>
    </nav>

    <button
      ref="toggle"
      class="toggle"
      type="button"
      :aria-expanded="open"
      aria-controls="mobile-menu"
      :aria-label="open ? 'Close menu' : 'Open menu'"
      @click="open = !open"
    >
      <span aria-hidden="true"></span>
    </button>
  </header>

  <!-- Outside the header: its backdrop blur would otherwise trap this
       fixed overlay inside the header's 64px box. -->
  <div id="mobile-menu" class="drawer" :class="{ 'drawer--open': open }" :inert="!open">
    <nav class="drawer__nav" aria-label="Main">
      <a
        v-for="(link, i) in navLinks"
        :key="link.label"
        :href="to(link.href)"
        :style="{ '--i': i }"
        @click="follow($event, link.href)"
      >
        {{ link.label }}
      </a>
    </nav>
  </div>
</template>

<style scoped>
.header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 2rem;
  height: 64px;
  padding: env(safe-area-inset-top) max(20px, 3vw) 0;
  border-bottom: 1px solid transparent;
  transition:
    background-color 0.35s,
    border-color 0.35s,
    backdrop-filter 0.35s;
}

.header--solid {
  background: rgb(15 17 24 / 0.72);
  border-bottom-color: rgb(184 150 106 / 0.18);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.brand {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-family: var(--font-display);
  font-size: 0.95rem;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  text-decoration: none;
  color: var(--ink);
}

.brand img {
  width: 30px;
  height: 30px;
}

.nav {
  display: flex;
  gap: 1.75rem;
  margin-left: 1.5rem;
}

.nav a {
  position: relative;
  padding: 0.35rem 0;
  font-family: var(--font-display);
  font-size: 0.78rem;
  font-weight: 600;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  text-decoration: none;
  color: var(--ink-dim);
  transition: color 0.2s;
}

/* Bronze hairline that draws in under the hovered link. */
.nav a::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 1px;
  background: var(--accent);
  transform: scaleX(0);
  transform-origin: left;
  transition: transform 0.25s ease;
}

.nav a:hover,
.nav a:focus-visible {
  color: var(--ink);
}

.nav a:hover::after,
.nav a:focus-visible::after {
  transform: scaleX(1);
}

a:focus-visible,
.toggle:focus-visible {
  outline: 2px solid var(--glow);
  outline-offset: 3px;
}

/* --- Mobile menu --- */
.toggle {
  display: none;
  position: relative;
  z-index: 2;
  width: 44px;
  height: 44px;
  margin-left: auto;
  margin-right: -10px;
  padding: 0;
  border: 0;
  background: none;
  color: var(--ink);
  cursor: pointer;
}

/* Two bars that cross into an X when open. */
.toggle span,
.toggle span::before {
  position: absolute;
  left: 11px;
  width: 22px;
  height: 1.5px;
  background: currentColor;
  transition: transform 0.3s ease;
}

.toggle span {
  top: 18px;
}

.toggle span::before {
  content: '';
  left: 0;
  top: 7px;
}

.header--open .toggle span {
  transform: translateY(3.5px) rotate(45deg);
}

.header--open .toggle span::before {
  transform: translateY(-7px) rotate(-90deg);
}

.drawer {
  display: none;
}

@media (max-width: 899px) {
  .nav {
    display: none;
  }

  .toggle {
    display: block;
  }

  .drawer {
    position: fixed;
    inset: 0;
    z-index: 9;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: calc(96px + env(safe-area-inset-top)) 24px calc(32px + env(safe-area-inset-bottom));
    background: rgb(12 13 19 / 0.97);
    opacity: 0;
    visibility: hidden;
    transition:
      opacity 0.3s ease,
      visibility 0s linear 0.3s;
  }

  .drawer--open {
    opacity: 1;
    visibility: visible;
    transition: opacity 0.3s ease;
  }

  .drawer__nav {
    display: flex;
    flex-direction: column;
  }

  .drawer__nav a {
    padding: 0.85rem 0;
    border-bottom: 1px solid rgb(184 150 106 / 0.16);
    font-family: var(--font-display);
    font-size: 1.5rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-decoration: none;
    color: var(--ink);
    opacity: 0;
    transform: translateY(12px);
    transition:
      opacity 0.35s ease,
      transform 0.45s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .drawer--open .drawer__nav a {
    opacity: 1;
    transform: none;
    transition-delay: calc(0.06s + var(--i) * 0.05s);
  }
}

@media (prefers-reduced-motion: reduce) {
  .drawer,
  .drawer__nav a,
  .toggle span,
  .toggle span::before {
    transition: none;
  }
}
</style>
