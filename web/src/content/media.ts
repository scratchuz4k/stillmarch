// Media page content. Only official art that exists goes here; screenshots and
// footage get their own lists once there's something to show.

import banner from '../assets/media/banner.webp'
import emblem from '../assets/media/emblem.webp'
import logoSquare from '../assets/media/logo-square.webp'

export interface MediaItem {
  title: string
  note: string
  src: string
  width: number
  height: number
  /** Suggested file name when downloaded. */
  file: string
}

export const media = {
  kicker: 'Media',
  title: 'Art & brand',
  dek: 'Official Stillmarch art, free to share. Click an image to see it full size.',
}

export const art: MediaItem[] = [
  {
    title: 'Logo, wide',
    note: 'The compass emblem beside the wordmark',
    src: banner,
    width: 2000,
    height: 923,
    file: 'stillmarch-logo-wide.webp',
  },
  {
    title: 'Emblem',
    note: 'The compass on its own',
    src: emblem,
    width: 2000,
    height: 2000,
    file: 'stillmarch-emblem.webp',
  },
  {
    title: 'Logo, square',
    note: 'The emblem above the wordmark',
    src: logoSquare,
    width: 2000,
    height: 2000,
    file: 'stillmarch-logo-square.webp',
  },
]

export const footage = {
  title: 'Screenshots & footage',
  empty: 'Nothing to show yet. Screenshots and video will appear here as they’re released.',
}
