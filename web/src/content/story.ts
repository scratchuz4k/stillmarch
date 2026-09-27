// Landing-page copy. Every claim here is drawn from dev/data/game-data.json —
// keep it that way when editing.

export type Extra =
  | { kind: 'quote'; text: string; note?: string }
  | { kind: 'ladder'; steps: { name: string; note: string }[] }

export interface Chapter {
  numeral: string
  kicker: string
  title: string
  body: string[]
  extras: Extra[]
  /** 'blight' swaps the bronze accent for violet. */
  tone?: 'blight'
}

export const hero = {
  title: 'Stillmarch',
  sub: 'A dark-medieval sandbox MMO with no main quest and no NPC king. Every war, every crown and every betrayal is made by players.',
}

export const chapters: Chapter[] = [
  {
    numeral: 'I',
    kicker: 'The Return',
    title: 'A world that stopped finishing things.',
    body: [
      'A thousand years ago the empire Perpetua united Valdris, ended every war and declared history finished. Then came the Stillness. There was no plague and no invasion. People simply stopped finishing things, and a continent fell silent.',
      'The only ones who got out were those with unfinished business: debtors, heretics, sailors, prisoners. You are their descendants, coming home with nothing. No books, no records, no time to pack.',
    ],
    extras: [
      {
        kind: 'quote',
        text: 'Remember shame rather than remember nothing.',
        note: 'Every building players raise keeps one small detail deliberately unfinished. Nobody can say why.',
      },
    ],
  },
  {
    numeral: 'II',
    kicker: 'Houses',
    title: 'The crown is borrowed, never owned.',
    body: [
      'Your guild is a House: part family, part company, never locked into a class. Run the banks and you’re a banking House. Stop, and you aren’t. Build a temple, rob the roads, or sell your blades to both sides of the same war.',
    ],
    extras: [
      {
        kind: 'ladder',
        steps: [
          { name: 'House', note: 'Defined by what its members actually do, week to week' },
          { name: 'Barony', note: 'Hold three regions' },
          { name: 'Kingdom', note: 'Baronies under an elected king: a vote every 4 weeks, no barony above 30%' },
          { name: 'Empire', note: 'Allied kingdoms, with room for only two or three per server' },
        ],
      },
    ],
  },
  {
    numeral: 'III',
    kicker: 'War',
    title: 'Land is taken, never given.',
    body: [
      'Every region answers to an Obelisk, a machine Perpetua left behind that nobody alive understands. To take one, raise a Siege Banner, muster an army and march.',
      'Armies fight for pay, not glory. The commander funds each campaign from their own House treasury, and every member is paid by what they contributed.',
    ],
    extras: [],
  },
  {
    numeral: 'IV',
    kicker: 'The Blight',
    title: 'Where the colour drains out of the land.',
    body: [
      'The Blight spreads outward from the places the Forgotten hold. They were Perpetua’s soldiers, and they still walk patrols nobody ever told them to end. You’ll know the Blight by its purple air and violet crystals.',
      'Everything there is stronger. It’s also the only ground where the finest materials grow.',
    ],
    extras: [],
    tone: 'blight',
  },
  {
    numeral: 'V',
    kicker: 'The Chronicles',
    title: 'Seven wonders. One server. Nothing is safe.',
    body: [
      'Each server has seven Great Projects, one-of-a-kind structures funded by trade and treasuries. Each gives the kingdom holding it a deliberately overpowered bonus, and any of them can be torn down.',
      'The Chronicles remember all of it: every alliance, who took which region from whom and when, and every betrayal. There are no seasons and no resets.',
    ],
    extras: [],
    tone: 'blight',
  },
]

export const closing = {
  title: 'History isn’t finished.',
  path: ['Small playtests', 'Founder’s Access', 'Early Access'],
  pathNote: 'No dates until they’re real.',
  cta: 'Explore every system',
}
