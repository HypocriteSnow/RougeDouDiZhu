export type ActorId = 'player' | 'enemy'

export type SuitId = 'S' | 'H' | 'C' | 'D' | 'J'

export type Rank =
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | '10'
  | 'J'
  | 'Q'
  | 'K'
  | 'A'
  | '2'
  | 'BJ'
  | 'RJ'

export type HandType =
  | 'single'
  | 'pair'
  | 'triple'
  | 'three_one'
  | 'three_pair'
  | 'straight'
  | 'consecutive_pairs'
  | 'four_two'
  | 'airplane'
  | 'bomb'
  | 'rocket'

export type AirplaneWing = 'none' | 'single' | 'pair'

export type BattleNodeType = 'normal' | 'elite' | 'boss' | 'merchant_campfire'

export type RelicRarity = 'blue' | 'purple' | 'orange'

export interface Card {
  id: string
  suit: SuitId
  rank: Rank
  weight: number
  chips: number
}

export interface HandEval {
  type: HandType
  name: string
  value: number
  length: number
  baseChips: number
  cardChips: number
  mult: number
  totalScore: number
  signature: string
  wing?: AirplaneWing
  chainLength?: number
}

export interface PlayRecord {
  by: ActorId
  cards: Card[]
  eval: HandEval
}

export interface CombatState {
  roundOwner: ActorId
  actionTurn: ActorId
  currentPlay: PlayRecord | null
  trickHistory: PlayRecord[]
  log: string[]
  battleDamageDealt: number
  battleTurns: number
}

export interface CharacterState {
  hp: number
  maxHp: number
  hand: Card[]
  deck: Card[]
  discard: Card[]
}

export type HandLevelState = Record<HandType, number>

export interface PlayerProgress {
  level: number
  xp: number
  xpToNext: number
}

export interface RelicDefinition {
  id: string
  name: string
  rarity: RelicRarity
  description: string
  effectType: 'none'
}

export interface OwnedRelic {
  id: string
  name: string
  rarity: RelicRarity
  description: string
  effectType: 'none'
}

export interface RewardChoiceHandUpgrade {
  id: string
  type: 'hand_upgrade'
  title: string
  description: string
  handType: HandType
  deltaLevel: number
}

export interface RewardChoiceHandWildcard {
  id: string
  type: 'hand_wildcard'
  title: string
  description: string
  deltaLevel: number
}

export interface RewardChoiceXpBonus {
  id: string
  type: 'xp_bonus'
  title: string
  description: string
  xpGain: number
}

export interface RewardChoiceRelicPick {
  id: string
  type: 'relic_pick'
  title: string
  description: string
  relicId: string
}

export type RewardChoice =
  | RewardChoiceHandUpgrade
  | RewardChoiceHandWildcard
  | RewardChoiceXpBonus
  | RewardChoiceRelicPick

export interface RewardOffer {
  id: string
  offerType: 'hand_upgrade' | 'relic_pick'
  title: string
  subtitle: string
  choices: RewardChoice[]
}

export interface RunSettings {
  sfxVolume: number
  animationSpeed: 'normal' | 'fast'
}

export interface RunStats {
  battlesWon: number
  totalDamageDealt: number
  totalDamageTaken: number
  turnsPlayed: number
}

export interface RunBuffs {
  playerDamageMult: number
  playerDamageFlat: number
}

export type RunStatus = 'in_battle' | 'reward' | 'won' | 'lost'

export interface RunState {
  runId: string
  seed: string
  rngState: number
  battleIndex: number
  totalBattles: number
  currentNodeType: BattleNodeType
  status: RunStatus
  player: CharacterState
  enemy: CharacterState & { name: string }
  combat: CombatState
  progress: PlayerProgress
  handLevels: HandLevelState
  ownedRelics: OwnedRelic[]
  rewardQueue: RewardOffer[]
  activeRewardOffer: RewardOffer | null
  buffs: RunBuffs
  settings: RunSettings
  stats: RunStats
}

export interface EngineEvent {
  type: 'info' | 'combat' | 'reward' | 'system' | 'error'
  message: string
}

export interface EngineResult {
  state: RunState
  events: EngineEvent[]
  ok: boolean
}

export interface SaveSnapshot {
  version: number
  savedAt: string
  runState: RunState
}

export interface AiPolicyInput {
  enemyHand: Card[]
  currentPlay: PlayRecord | null
  roundOwner: ActorId
  hp: { enemy: number; player: number }
  deckInfo: { handLimit: number; enemyDeckLeft: number }
  randomValue?: number
}

export interface AiDecision {
  action: 'play' | 'pass'
  cardIds?: string[]
}
