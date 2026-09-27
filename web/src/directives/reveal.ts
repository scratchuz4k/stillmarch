import type { Directive } from 'vue'

// v-reveal: the element rises in from below the first time it scrolls into
// view. Pass a number (v-reveal="2") to stagger siblings by that many steps.

let observer: IntersectionObserver | undefined

function getObserver() {
  observer ??= new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        entry.target.classList.add('is-revealed')
        observer!.unobserve(entry.target)
      }
    },
    { rootMargin: '0px 0px -12% 0px', threshold: 0.1 },
  )
  return observer
}

export const vReveal: Directive<HTMLElement, number | undefined> = {
  mounted(el, { value }) {
    el.classList.add('reveal')
    el.style.setProperty('--reveal-step', String(value ?? 0))
    getObserver().observe(el)
  },
  unmounted(el) {
    observer?.unobserve(el)
  },
}
