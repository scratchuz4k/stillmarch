// "Unfinished business": short starter tasks that teach the basics. Stillmarch has no main quest.

import type { Res } from '../types.ts'

export interface TaskDef {
  id: string
  title: string
  hint: string
  reward: Partial<Res>
}

export const TASKS: TaskDef[] = [
  { id: 'claim', title: 'Wake the Obelisk', hint: 'Claim the dormant Obelisk you arrived at.', reward: { wood: 100, stone: 100 } },
  { id: 'lumber2', title: 'Timber for the winter', hint: 'Raise the lumber camp to level 2.', reward: { wood: 150, stone: 100 } },
  { id: 'assign', title: 'Put a Wayfarer to work', hint: 'Give a Wayfarer a crafting slot in a building.', reward: { wood: 100, iron: 100 } },
  { id: 'farm2', title: 'Bread before swords', hint: 'Raise the farm to level 2.', reward: { food: 200, stone: 100 } },
  { id: 'obelisk2', title: 'The capstone stirs', hint: 'Raise the Obelisk to level 2.', reward: { wood: 300, stone: 300, iron: 200 } },
  { id: 'barracks', title: 'A place to drill', hint: 'Build a barracks.', reward: { iron: 200, wood: 150 } },
  { id: 'train', title: 'Ten good souls', hint: 'Have 10 troops at home.', reward: { food: 300, iron: 150 } },
  { id: 'raid', title: 'Gold from the Forgotten', hint: 'Win a raid on a Forgotten fortress.', reward: { gold: 50, food: 200 } },
  { id: 'region', title: 'Beyond the walls', hint: 'Claim a second region with an army.', reward: { wood: 400, stone: 400 } },
  { id: 'house', title: 'No one stands alone', hint: 'Found or join a House.', reward: { wood: 200, stone: 200, iron: 200 } },
]
