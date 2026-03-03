import type { BattleNodeType } from '@/engine/types'

export interface EnemyTemplate {
  name: string
  nodeType: Exclude<BattleNodeType, 'merchant_campfire'>
}

export const ENEMY_TABLE: EnemyTemplate[] = [
  { name: '史莱姆地主', nodeType: 'normal' },
  { name: '黑桃审判官', nodeType: 'elite' },
  { name: '扑克恶魔', nodeType: 'boss' },
]
