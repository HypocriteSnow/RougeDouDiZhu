import type { BattleNodeType, HandLevelState, HandType, Rank, RelicDefinition, RelicRarity } from '@/engine/types'

export const HAND_LIMIT = 10
export const SAVE_VERSION = 3

export const BASE_SETTINGS = {
  sfxVolume: 0.65,
  animationSpeed: 'normal',
} as const

export const SUITS = ['S', 'H', 'C', 'D'] as const
export const BASE_RANKS: Rank[] = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2']

export const HAND_STATS: Record<HandType, { name: string; baseChips: number; mult: number }> = {
  single: { name: '单张', baseChips: 8, mult: 1.0 },
  pair: { name: '一对', baseChips: 12, mult: 1.35 },
  triple: { name: '三不带', baseChips: 16, mult: 1.65 },
  three_one: { name: '三带一', baseChips: 20, mult: 1.9 },
  three_pair: { name: '三带一对', baseChips: 24, mult: 2.15 },
  straight: { name: '顺子', baseChips: 28, mult: 2.35 },
  consecutive_pairs: { name: '连对', baseChips: 32, mult: 2.6 },
  four_two: { name: '四带二', baseChips: 36, mult: 2.85 },
  airplane: { name: '飞机', baseChips: 40, mult: 3.15 },
  bomb: { name: '炸弹', baseChips: 48, mult: 3.7 },
  rocket: { name: '王炸', baseChips: 56, mult: 4.4 },
}

export const HAND_LEVEL_MAX = 10

export const HAND_LEVEL_GROWTH: Record<HandType, { chipsInc: number; multInc: number }> = {
  single: { chipsInc: 1, multInc: 0.03 },
  pair: { chipsInc: 1, multInc: 0.04 },
  triple: { chipsInc: 1, multInc: 0.05 },
  three_one: { chipsInc: 1, multInc: 0.06 },
  three_pair: { chipsInc: 1, multInc: 0.07 },
  straight: { chipsInc: 2, multInc: 0.08 },
  consecutive_pairs: { chipsInc: 2, multInc: 0.09 },
  four_two: { chipsInc: 2, multInc: 0.1 },
  airplane: { chipsInc: 2, multInc: 0.11 },
  bomb: { chipsInc: 3, multInc: 0.13 },
  rocket: { chipsInc: 3, multInc: 0.15 },
}

export const HAND_TYPE_ORDER: HandType[] = [
  'single',
  'pair',
  'triple',
  'three_one',
  'three_pair',
  'straight',
  'consecutive_pairs',
  'four_two',
  'airplane',
  'bomb',
  'rocket',
]

export const DEFAULT_HAND_LEVELS: HandLevelState = {
  single: 1,
  pair: 1,
  triple: 1,
  three_one: 1,
  three_pair: 1,
  straight: 1,
  consecutive_pairs: 1,
  four_two: 1,
  airplane: 1,
  bomb: 1,
  rocket: 1,
}

export function getLeveledHandStats(type: HandType, level: number): { name: string; baseChips: number; mult: number } {
  const base = HAND_STATS[type]
  const growth = HAND_LEVEL_GROWTH[type]
  const lv = Math.max(1, Math.min(HAND_LEVEL_MAX, level))

  return {
    name: base.name,
    baseChips: base.baseChips + (lv - 1) * growth.chipsInc,
    mult: Number((base.mult + (lv - 1) * growth.multInc).toFixed(2)),
  }
}

export function getXpToNextLevel(level: number): number {
  return 140 + Math.max(0, level - 1) * 55
}

export type CombatNodeType = Exclude<BattleNodeType, 'merchant_campfire'>

export const RUN_NODE_SEQUENCE: CombatNodeType[] = ['normal', 'elite', 'boss']

export const NODE_TIER_SCORE_BONUS: Record<CombatNodeType, number> = {
  normal: 0,
  elite: 120,
  boss: 220,
}

export function getNodeTypeForBattleIndex(battleIndex: number, totalBattles: number): CombatNodeType {
  if (totalBattles <= RUN_NODE_SEQUENCE.length) {
    const idx = Math.max(0, Math.min(RUN_NODE_SEQUENCE.length - 1, battleIndex - 1))
    return RUN_NODE_SEQUENCE[idx]
  }

  if (battleIndex >= totalBattles) return 'boss'
  if (battleIndex === totalBattles - 1) return 'elite'
  return 'normal'
}

export const PLAYER_START_HP = 1800

export const ENEMY_HP_BASE: Record<CombatNodeType, number> = {
  normal: 500,
  elite: 1100,
  boss: 1950,
}

export const ENEMY_HP_VARIANCE = 0.05

export const ENEMY_DAMAGE_SCALE: Record<CombatNodeType, number> = {
  normal: 0.52,
  elite: 0.58,
  boss: 0.64,
}

export const ENEMY_DAMAGE_CLAMP_MIN: Record<CombatNodeType, number> = {
  normal: 18,
  elite: 24,
  boss: 30,
}

export const ENEMY_DAMAGE_CLAMP_MAX: Record<CombatNodeType, number> = {
  normal: 120,
  elite: 150,
  boss: 190,
}

export const RELIC_POOL: RelicDefinition[] = [
  { id: 'blue_ink_compass', name: '墨迹罗盘', rarity: 'blue', description: '开发中：暂无效果。', effectType: 'none' },
  { id: 'blue_glass_die', name: '玻璃骰', rarity: 'blue', description: '开发中：暂无效果。', effectType: 'none' },
  { id: 'blue_worn_badge', name: '旧徽章', rarity: 'blue', description: '开发中：暂无效果。', effectType: 'none' },
  { id: 'blue_tea_token', name: '茶馆筹码', rarity: 'blue', description: '开发中：暂无效果。', effectType: 'none' },
  { id: 'blue_folded_map', name: '折叠地图', rarity: 'blue', description: '开发中：暂无效果。', effectType: 'none' },
  { id: 'blue_metal_clip', name: '金属夹', rarity: 'blue', description: '开发中：暂无效果。', effectType: 'none' },

  { id: 'purple_midnight_clock', name: '午夜钟芯', rarity: 'purple', description: '开发中：暂无效果。', effectType: 'none' },
  { id: 'purple_hollow_seal', name: '镂空封印', rarity: 'purple', description: '开发中：暂无效果。', effectType: 'none' },
  { id: 'purple_orchid_coin', name: '兰纹币', rarity: 'purple', description: '开发中：暂无效果。', effectType: 'none' },
  { id: 'purple_crystal_feather', name: '晶羽', rarity: 'purple', description: '开发中：暂无效果。', effectType: 'none' },

  { id: 'orange_ancient_joker', name: '远古鬼牌', rarity: 'orange', description: '开发中：暂无效果。', effectType: 'none' },
  { id: 'orange_royal_contract', name: '王室契约', rarity: 'orange', description: '开发中：暂无效果。', effectType: 'none' },
]

export const RELIC_DROP_WEIGHTS: Record<CombatNodeType, Record<RelicRarity, number>> = {
  normal: { blue: 78, purple: 20, orange: 2 },
  elite: { blue: 50, purple: 40, orange: 10 },
  boss: { blue: 25, purple: 45, orange: 30 },
}

export const ENEMY_NAMES = ['史莱姆地主', '牌桌猎犬', '黑桃审判官', '扑克恶魔']
