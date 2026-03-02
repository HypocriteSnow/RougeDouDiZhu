import type { HandType, Rank, RewardOption } from '@/engine/types'

export const HAND_LIMIT = 10
export const SAVE_VERSION = 1

export const BASE_SETTINGS = {
  sfxVolume: 0.65,
  animationSpeed: 'normal',
} as const

export const SUITS = ['S', 'H', 'C', 'D'] as const
export const BASE_RANKS: Rank[] = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2']

export const HAND_STATS: Record<HandType, { name: string; baseChips: number; mult: number }> = {
  rocket: { name: '王炸', baseChips: 100, mult: 8 },
  bomb: { name: '炸弹', baseChips: 60, mult: 5 },
  airplane: { name: '飞机', baseChips: 50, mult: 4.5 },
  four_two: { name: '四带二', baseChips: 45, mult: 4 },
  consecutive_pairs: { name: '连对', baseChips: 40, mult: 4 },
  straight: { name: '顺子', baseChips: 30, mult: 3.5 },
  three_pair: { name: '三带一对', baseChips: 25, mult: 3 },
  three_one: { name: '三带一', baseChips: 20, mult: 2.5 },
  triple: { name: '三不带', baseChips: 15, mult: 2 },
  pair: { name: '一对', baseChips: 10, mult: 1.5 },
  single: { name: '单张', baseChips: 5, mult: 1 },
}

export const REWARDS: RewardOption[] = [
  { id: 'heal_220', title: '应急包扎', description: '恢复 220 点生命值。' },
  { id: 'maxhp_120', title: '强化体魄', description: '最大生命 +120，并恢复 120 点生命值。' },
  { id: 'damage_up', title: '锋刃校准', description: '本次 Run 你的伤害倍率 +0.2。' },
]

export const ENEMY_NAMES = ['史莱姆地主', '牌桌猎犬', '黑桃审判官', '扑克恶魔']
