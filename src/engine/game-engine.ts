import { ENEMY_TABLE } from '@/data/enemies'
import { BASE_SETTINGS, ENEMY_NAMES, HAND_LIMIT, REWARDS, SAVE_VERSION } from '@/engine/constants'
import { createFullDeck, drawToLimit, pickCardsByIds, removeCardsByIds, shuffleCards, splitDeck } from '@/engine/cards'
import { canBeat, evaluateHand } from '@/engine/rules'
import { hashSeed, nextRandom, randomInt } from '@/engine/rng'
import type {
  ActorId,
  Card,
  CharacterState,
  CombatState,
  EngineEvent,
  EngineResult,
  PlayRecord,
  RewardOption,
  RunState,
  SaveSnapshot,
} from '@/engine/types'

function nowIso(): string {
  return new Date().toISOString()
}

function createCombatState(owner: ActorId = 'player'): CombatState {
  return {
    roundOwner: owner,
    actionTurn: owner,
    currentPlay: null,
    trickHistory: [],
    log: ['战斗开始。由你先手发起攻势。'],
  }
}

function pushLog(log: string[], message: string): string[] {
  const next = [...log, message]
  if (next.length > 30) return next.slice(next.length - 30)
  return next
}

function dealCharacter(
  base: { hp: number; maxHp: number },
  deck: Card[],
  rngState: number,
): { character: CharacterState; rngState: number } {
  const drawn = drawToLimit({ hp: base.hp, maxHp: base.maxHp, hand: [], deck, discard: [] }, HAND_LIMIT, rngState)
  return { character: drawn.character, rngState: drawn.rngState }
}

function buildEnemyForBattle(battleIndex: number, totalBattles: number): { name: string; maxHp: number } {
  const idx = Math.min(battleIndex - 1, ENEMY_TABLE.length - 1)
  const template = ENEMY_TABLE[idx]
  const isBoss = battleIndex === totalBattles
  const scaling = (battleIndex - 1) * 120
  return {
    name: isBoss ? ENEMY_NAMES[ENEMY_NAMES.length - 1] : template.name,
    maxHp: template.maxHp + scaling + (isBoss ? 260 : 0),
  }
}

function createBattleState(
  playerCore: { hp: number; maxHp: number },
  battleIndex: number,
  totalBattles: number,
  rngState: number,
): {
  player: CharacterState
  enemy: CharacterState & { name: string }
  combat: CombatState
  rngState: number
} {
  const shuffled = shuffleCards(createFullDeck(), rngState)
  const split = splitDeck(shuffled.cards)

  const playerDeal = dealCharacter(playerCore, split.playerDeck, shuffled.rngState)
  const enemyTemplate = buildEnemyForBattle(battleIndex, totalBattles)
  const enemyDeal = dealCharacter({ hp: enemyTemplate.maxHp, maxHp: enemyTemplate.maxHp }, split.enemyDeck, playerDeal.rngState)

  return {
    player: playerDeal.character,
    enemy: {
      ...enemyDeal.character,
      name: enemyTemplate.name,
    },
    combat: createCombatState('player'),
    rngState: enemyDeal.rngState,
  }
}

function cloneState(state: RunState): RunState {
  return structuredClone(state)
}

export class GameEngine {
  private state: RunState

  constructor(seed?: string) {
    this.state = this.makeInitialRun(seed)
  }

  private makeInitialRun(seed?: string): RunState {
    const normalizedSeed = seed?.trim() || `${Date.now()}`
    const startRng = hashSeed(normalizedSeed)
    const roll = randomInt(startRng, 3)
    const totalBattles = 3 + roll.value

    const battle = createBattleState(
      {
        hp: 3200,
        maxHp: 3200,
      },
      1,
      totalBattles,
      roll.rngState,
    )

    return {
      runId: `run_${normalizedSeed}_${Math.floor(Math.random() * 10000)}`,
      seed: normalizedSeed,
      rngState: battle.rngState,
      battleIndex: 1,
      totalBattles,
      status: 'in_battle',
      player: battle.player,
      enemy: battle.enemy,
      combat: battle.combat,
      pendingRewards: [],
      buffs: {
        playerDamageMult: 1,
        playerDamageFlat: 0,
      },
      settings: { ...BASE_SETTINGS },
      stats: {
        battlesWon: 0,
        totalDamageDealt: 0,
        totalDamageTaken: 0,
        turnsPlayed: 0,
      },
    }
  }

  private result(ok: boolean, events: EngineEvent[]): EngineResult {
    return { ok, events, state: cloneState(this.state) }
  }

  private fail(message: string): EngineResult {
    return this.result(false, [{ type: 'error', message }])
  }

  public getState(): RunState {
    return cloneState(this.state)
  }

  public consumeRandom(): number {
    const roll = nextRandom(this.state.rngState)
    this.state.rngState = roll.rngState
    return roll.value
  }

  public startRun(seed?: string): RunState {
    this.state = this.makeInitialRun(seed)
    return this.getState()
  }

  public playCards(actorId: ActorId, cardIds: string[]): EngineResult {
    if (this.state.status !== 'in_battle') return this.fail('当前不在战斗阶段。')
    if (this.state.combat.actionTurn !== actorId) return this.fail('还没轮到该角色行动。')
    if (cardIds.length === 0) return this.fail('请选择要打出的牌。')

    const next = cloneState(this.state)
    const actor = actorId === 'player' ? next.player : next.enemy
    const playedCards = pickCardsByIds(actor.hand, cardIds)
    if (playedCards.length !== cardIds.length) return this.fail('选择的牌不完整或已失效。')

    if (next.combat.currentPlay === null && actorId !== next.combat.roundOwner) {
      return this.fail('当前不是你的发起回合。')
    }

    const handEval = evaluateHand(playedCards)
    if (!handEval) return this.fail('所选牌不是合法牌型。')

    if (next.combat.currentPlay && !canBeat(handEval, next.combat.currentPlay.eval)) {
      return this.fail('这手牌无法压制当前牌面。')
    }

    const playRecord: PlayRecord = {
      by: actorId,
      cards: playedCards,
      eval: handEval,
    }

    actor.hand = removeCardsByIds(actor.hand, cardIds)
    actor.discard.push(...playedCards)

    next.combat.currentPlay = playRecord
    next.combat.trickHistory.push(playRecord)
    next.combat.actionTurn = actorId === 'player' ? 'enemy' : 'player'
    next.combat.log = pushLog(next.combat.log, `${actorId === 'player' ? '你' : next.enemy.name} 打出 ${handEval.name}。`)
    next.stats.turnsPlayed += 1

    this.state = next
    return this.result(true, [{ type: 'combat', message: `${handEval.name} 已出牌。` }])
  }

  public pass(actorId: ActorId): EngineResult {
    if (this.state.status !== 'in_battle') return this.fail('当前不在战斗阶段。')
    if (this.state.combat.actionTurn !== actorId) return this.fail('还没轮到该角色行动。')
    if (!this.state.combat.currentPlay) return this.fail('当前没有可放弃的对局。')

    const next = cloneState(this.state)
    const currentPlay = next.combat.currentPlay
    if (!currentPlay) return this.fail('当前没有可放弃的对局。')

    const winner: ActorId = actorId === 'player' ? 'enemy' : 'player'
    const isDefenseSuccess = winner !== next.combat.roundOwner
    const currentEval = currentPlay.eval

    let damage = currentEval.totalScore
    if (!isDefenseSuccess && winner === 'player') {
      damage = Math.floor(damage * next.buffs.playerDamageMult + next.buffs.playerDamageFlat)
    }

    if (isDefenseSuccess) {
      next.combat.log = pushLog(
        next.combat.log,
        `${actorId === 'player' ? '你' : next.enemy.name} 要不起。${winner === 'player' ? '你' : next.enemy.name} 防守成功。`,
      )
    } else {
      if (winner === 'player') {
        next.enemy.hp = Math.max(0, next.enemy.hp - damage)
        next.stats.totalDamageDealt += damage
      } else {
        next.player.hp = Math.max(0, next.player.hp - damage)
        next.stats.totalDamageTaken += damage
      }

      next.combat.log = pushLog(
        next.combat.log,
        `${actorId === 'player' ? '你' : next.enemy.name} 要不起，承受 ${damage} 点伤害。`,
      )
    }

    const battleEnded = next.player.hp <= 0 || next.enemy.hp <= 0

    if (battleEnded) {
      if (next.player.hp <= 0) {
        next.status = 'lost'
        next.combat.log = pushLog(next.combat.log, '你倒下了，本次 Run 结束。')
      } else if (next.enemy.hp <= 0) {
        next.stats.battlesWon += 1
        if (next.battleIndex >= next.totalBattles) {
          next.status = 'won'
          next.combat.log = pushLog(next.combat.log, 'Boss 已击败，你赢下了本次 Run。')
        } else {
          next.status = 'reward'
          next.pendingRewards = [...REWARDS]
          next.combat.log = pushLog(next.combat.log, '战斗胜利，选择一个奖励进入下一战。')
        }
      }

      next.combat.currentPlay = null
      next.combat.trickHistory = []
      this.state = next
      return this.result(true, [{ type: 'combat', message: '战斗已结算。' }])
    }

    const drawPlayer = drawToLimit(next.player, HAND_LIMIT, next.rngState)
    next.player = drawPlayer.character

    const drawEnemy = drawToLimit(next.enemy, HAND_LIMIT, drawPlayer.rngState)
    next.enemy = { ...drawEnemy.character, name: next.enemy.name }
    next.rngState = drawEnemy.rngState

    next.combat.roundOwner = winner
    next.combat.actionTurn = winner
    next.combat.currentPlay = null
    next.combat.trickHistory = []

    this.state = next
    return this.result(true, [
      {
        type: 'combat',
        message: isDefenseSuccess ? `${winner === 'player' ? '你' : next.enemy.name} 夺得牌权。` : `${winner === 'player' ? '你' : next.enemy.name} 连击成功。`,
      },
    ])
  }

  public chooseReward(rewardId: string): EngineResult {
    if (this.state.status !== 'reward') return this.fail('当前没有可选奖励。')
    const exists = this.state.pendingRewards.some((reward) => reward.id === rewardId)
    if (!exists) return this.fail('奖励不存在。')

    const next = cloneState(this.state)

    if (rewardId === 'heal_220') {
      next.player.hp = Math.min(next.player.maxHp, next.player.hp + 220)
    } else if (rewardId === 'maxhp_120') {
      next.player.maxHp += 120
      next.player.hp = Math.min(next.player.maxHp, next.player.hp + 120)
    } else if (rewardId === 'damage_up') {
      next.buffs.playerDamageMult = Number((next.buffs.playerDamageMult + 0.2).toFixed(2))
    }

    next.pendingRewards = []
    this.state = next
    return this.nextBattle()
  }

  public nextBattle(): EngineResult {
    if (this.state.status !== 'reward') return this.fail('当前不在下一战准备阶段。')
    if (this.state.battleIndex >= this.state.totalBattles) return this.fail('当前已是最终战。')

    const next = cloneState(this.state)
    const battleIndex = next.battleIndex + 1

    const battle = createBattleState(
      {
        hp: next.player.hp,
        maxHp: next.player.maxHp,
      },
      battleIndex,
      next.totalBattles,
      next.rngState,
    )

    next.battleIndex = battleIndex
    next.status = 'in_battle'
    next.player = battle.player
    next.enemy = battle.enemy
    next.combat = battle.combat
    next.rngState = battle.rngState

    this.state = next
    return this.result(true, [{ type: 'system', message: `进入第 ${battleIndex} / ${next.totalBattles} 战。` }])
  }

  public serialize(): SaveSnapshot {
    return {
      version: SAVE_VERSION,
      savedAt: nowIso(),
      runState: cloneState(this.state),
    }
  }

  public restore(snapshot: SaveSnapshot): RunState {
    if (snapshot.version !== SAVE_VERSION) {
      this.state = this.makeInitialRun()
      return this.getState()
    }

    this.state = cloneState(snapshot.runState)
    return this.getState()
  }

  public updateSettings(partial: Partial<RunState['settings']>): RunState {
    this.state = {
      ...this.state,
      settings: {
        ...this.state.settings,
        ...partial,
      },
    }
    return this.getState()
  }

  public getRewards(): RewardOption[] {
    return [...this.state.pendingRewards]
  }
}
