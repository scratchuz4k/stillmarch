// Site menu. Hrefs are relative to the landing page's folder (the preview
// root); the header prefixes them for pages deeper in. Links still marked '#'
// are placeholders until their pages exist.

/** The systems reference (dev/), deployed one level up from this page. */
export const REFERENCE_URL = '../'

export interface NavLink {
  label: string
  href: string
}

export const navLinks: NavLink[] = [
  { label: 'Media', href: 'media/' },
  { label: 'FAQ', href: REFERENCE_URL },
]
