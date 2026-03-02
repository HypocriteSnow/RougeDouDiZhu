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
}

export interface CharacterState {
  hp: number
  maxHp: number
  hand: Card[]
  deck: Card[]
  discard: Card[]
}

export interface RewardOption {
  id: string
  title: string
  description: string
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
  status: RunStatus
  player: CharacterState
  enemy: CharacterState & { name: string }
  combat: CombatState
  pendingRewards: RewardOption[]
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
