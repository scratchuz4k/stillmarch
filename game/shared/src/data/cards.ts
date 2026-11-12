// The Wayfarer card pool: 12 Common and 4 Uncommon.
// Wayfarers are people like you, coming back to the continent, just without a House.

export type Rarity = 'common' | 'uncommon'

export type TraitKind =
  | 'rations' // the army eats less
  | 'loot' // the army carries more home
  | 'march' // the army marches faster
  | 'fortress' // more damage against the Forgotten
  | 'walls' // home troops defend better
  | 'build' // faster building when running the Obelisk
  | 'production' // more output from the building they run
  | 'training' // faster training when running the barracks

export interface CardDef {
  id: string
  name: string
  epithet: string
  rarity: Rarity
  might: number
  craft: number
  wits: number
  trait: { kind: TraitKind; pct: number; text: string }
  lore: string
}

export const CARDS: CardDef[] = [
  {
    id: 'aldric',
    name: 'Aldric',
    epithet: 'the Ferryman',
    rarity: 'common',
    might: 3,
    craft: 6,
    wits: 3,
    trait: { kind: 'production', pct: 10, text: '+10% output from the building he runs' },
    lore: 'Rowed refugees across the Stillness for coin. Now he rows back.',
  },
  {
    id: 'brena',
    name: 'Brena',
    epithet: 'Two-Axes',
    rarity: 'common',
    might: 7,
    craft: 2,
    wits: 3,
    trait: { kind: 'fortress', pct: 15, text: '+15% damage against the Forgotten' },
    lore: 'Her grandmother kept both axes oiled for forty years, waiting.',
  },
  {
    id: 'corvin',
    name: 'Corvin',
    epithet: 'the Tallyman',
    rarity: 'common',
    might: 2,
    craft: 6,
    wits: 4,
    trait: { kind: 'build', pct: 10, text: '+10% build speed when running the Obelisk' },
    lore: 'Counts everything twice. Loses nothing.',
  },
  {
    id: 'dagny',
    name: 'Dagny',
    epithet: 'Quick-Foot',
    rarity: 'common',
    might: 5,
    craft: 2,
    wits: 5,
    trait: { kind: 'march', pct: 10, text: 'The army she leads marches 10% faster' },
    lore: 'Knows every goat path between here and the coast.',
  },
  {
    id: 'edmer',
    name: 'Edmer',
    epithet: 'the Mason',
    rarity: 'common',
    might: 3,
    craft: 7,
    wits: 2,
    trait: { kind: 'walls', pct: 10, text: 'Home troops defend 10% better' },
    lore: 'Leaves one stone in every wall uncut, as his father did.',
  },
  {
    id: 'fenna',
    name: 'Fenna',
    epithet: 'the Forager',
    rarity: 'common',
    might: 4,
    craft: 3,
    wits: 5,
    trait: { kind: 'rations', pct: 20, text: 'The army she leads eats 20% less' },
    lore: 'Can make a stew out of bark and a rumour.',
  },
  {
    id: 'garrick',
    name: 'Garrick',
    epithet: 'Old Shield',
    rarity: 'common',
    might: 6,
    craft: 3,
    wits: 3,
    trait: { kind: 'walls', pct: 10, text: 'Home troops defend 10% better' },
    lore: 'Has been holding the same gate, in his head, for thirty years.',
  },
  {
    id: 'hesk',
    name: 'Hesk',
    epithet: 'the Smith',
    rarity: 'common',
    might: 3,
    craft: 7,
    wits: 2,
    trait: { kind: 'training', pct: 10, text: '+10% training speed when running the barracks' },
    lore: 'Hums while she hammers. Nobody knows the tune.',
  },
  {
    id: 'ilse',
    name: 'Ilse',
    epithet: 'the Herbwife',
    rarity: 'common',
    might: 2,
    craft: 5,
    wits: 5,
    trait: { kind: 'production', pct: 10, text: '+10% output from the building she runs' },
    lore: 'Her satchel smells of every season at once.',
  },
  {
    id: 'jory',
    name: 'Jory',
    epithet: 'Light-Fingers',
    rarity: 'common',
    might: 5,
    craft: 2,
    wits: 5,
    trait: { kind: 'loot', pct: 15, text: 'The army he leads carries 15% more loot' },
    lore: 'Swears he only takes what nobody was using.',
  },
  {
    id: 'kestra',
    name: 'Kestra',
    epithet: 'the Bowyer',
    rarity: 'common',
    might: 6,
    craft: 4,
    wits: 2,
    trait: { kind: 'fortress', pct: 15, text: '+15% damage against the Forgotten' },
    lore: 'Strings her bows with something she won’t name.',
  },
  {
    id: 'lothar',
    name: 'Lothar',
    epithet: 'the Drover',
    rarity: 'common',
    might: 4,
    craft: 5,
    wits: 3,
    trait: { kind: 'rations', pct: 20, text: 'The army he leads eats 20% less' },
    lore: 'Lost his herd to the Stillness. Kept the bell.',
  },
  {
    id: 'mirela',
    name: 'Mirela',
    epithet: 'of the Broken Banner',
    rarity: 'uncommon',
    might: 9,
    craft: 3,
    wits: 5,
    trait: { kind: 'march', pct: 15, text: 'The army she leads marches 15% faster' },
    lore: 'Carries the half of a banner whose other half nobody has found.',
  },
  {
    id: 'norwin',
    name: 'Norwin',
    epithet: 'the Archivist',
    rarity: 'uncommon',
    might: 2,
    craft: 9,
    wits: 6,
    trait: { kind: 'build', pct: 20, text: '+20% build speed when running the Obelisk' },
    lore: 'Remembers the books that were lost, and rewrites them from memory, slightly wrong.',
  },
  {
    id: 'osric',
    name: 'Osric',
    epithet: 'Ironhand',
    rarity: 'uncommon',
    might: 8,
    craft: 6,
    wits: 3,
    trait: { kind: 'loot', pct: 25, text: 'The army he leads carries 25% more loot' },
    lore: 'The hand is real. The iron is a glove he never takes off.',
  },
  {
    id: 'sabine',
    name: 'Sabine',
    epithet: 'the Pathfinder',
    rarity: 'uncommon',
    might: 5,
    craft: 4,
    wits: 9,
    trait: { kind: 'fortress', pct: 25, text: '+25% damage against the Forgotten' },
    lore: 'Walked into the Blight once and came back with directions.',
  },
]

export const CARD_BY_ID: Record<string, CardDef> = Object.fromEntries(CARDS.map((c) => [c.id, c]))

/** The two cards every new account starts with. */
export const STARTER_CARDS = ['brena', 'aldric']
