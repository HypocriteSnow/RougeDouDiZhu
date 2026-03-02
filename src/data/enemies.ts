export interface EnemyTemplate {
  name: string
  maxHp: number
}

export const ENEMY_TABLE: EnemyTemplate[] = [
  { name: '史莱姆地主', maxHp: 1700 },
  { name: '牌桌猎犬', maxHp: 1950 },
  { name: '黑桃审判官', maxHp: 2250 },
  { name: '扑克恶魔', maxHp: 2600 },
]
