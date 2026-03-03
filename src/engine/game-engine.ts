import { ENEMY_TABLE } from '@/data/enemies'
import {
  BASE_SETTINGS,
  DEFAULT_HAND_LEVELS,
  ENEMY_DAMAGE_CLAMP_MAX,
  ENEMY_DAMAGE_CLAMP_MIN,
  ENEMY_DAMAGE_SCALE,
  ENEMY_HP_BASE,
  ENEMY_HP_VARIANCE,
  HAND_STATS,
  HAND_LEVEL_MAX,
  HAND_LIMIT,
  NODE_TIER_SCORE_BONUS,
  PLAYER_START_HP,
  RELIC_DROP_WEIGHTS,
  RELIC_POOL,
  RUN_NODE_SEQUENCE,
  SAVE_VERSION,
  getNodeTypeForBattleIndex,
  getXpToNextLevel,
} from '@/engine/constants'
import { createFullDeck, drawToLimit, pickCardsByIds, removeCardsByIds, shuffleCards, sortCardsForDisplay, splitDeck } from '@/engine/cards'
import { applyHandLevelsToEval, canBeat, evaluateHand } from '@/engine/rules'
import { hashSeed, nextRandom, randomInt } from '@/engine/rng'
import type {
  ActorId,
  Card,
  CharacterState,
  CombatState,
  EngineEvent,
  EngineResult,
  HandType,
  PlayRecord,
  RelicDefinition,
  RelicRarity,
  RewardChoice,
  RewardOffer,
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
    battleDamageDealt: 0,
    battleTurns: 0,
  }
}

function pushLog(log: string[], message: string): string[] {
  const next = [...log, message]
  if (next.length > 40) return next.slice(next.length - 40)
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

function roundToNearestTen(value: number): number {
  return Math.round(value / 10) * 10
}

function clamp(value: number, minValue: number, maxValue: number): number {
  return Math.max(minValue, Math.min(maxValue, value))
}

function rollEnemyHp(baseHp: number, rngState: number): { hp: number; rngState: number } {
  const roll = randomInt(rngState, 1001)
  const ratio = 1 - ENEMY_HP_VARIANCE + (roll.value / 1000) * ENEMY_HP_VARIANCE * 2
  const hp = Math.max(10, roundToNearestTen(baseHp * ratio))

  return {
    hp,
    rngState: roll.rngState,
  }
}

function buildEnemyForBattle(battleIndex: number, totalBattles: number): { name: string; maxHp: number } {
  const nodeType = getNodeTypeForBattleIndex(battleIndex, totalBattles)
  const template = ENEMY_TABLE.find((enemy) => enemy.nodeType === nodeType) ?? ENEMY_TABLE[0]

  return {
    name: template.name,
    maxHp: ENEMY_HP_BASE[nodeType],
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
  const enemyHpRoll = rollEnemyHp(enemyTemplate.maxHp, playerDeal.rngState)
  const enemyDeal = dealCharacter({ hp: enemyHpRoll.hp, maxHp: enemyHpRoll.hp }, split.enemyDeck, enemyHpRoll.rngState)

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

function normalizeHandOrder(state: RunState): RunState {
  return {
    ...state,
    player: {
      ...state.player,
      hand: sortCardsForDisplay(state.player.hand, 'rank_desc'),
    },
    enemy: {
      ...state.enemy,
      hand: sortCardsForDisplay(state.enemy.hand, 'rank_desc'),
    },
  }
}

function pickRandomUnique<T>(items: T[], count: number, rngState: number): { picked: T[]; rngState: number } {
  const pool = [...items]
  const picked: T[] = []
  let state = rngState

  while (pool.length > 0 && picked.length < count) {
    const roll = randomInt(state, pool.length)
    state = roll.rngState
    const [chosen] = pool.splice(roll.value, 1)
    if (chosen !== undefined) picked.push(chosen)
  }

  return { picked, rngState: state }
}

export class GameEngine {
  private state: RunState

  constructor(seed?: string) {
    this.state = this.makeInitialRun(seed)
  }

  private makeInitialRun(seed?: string): RunState {
    const normalizedSeed = seed?.trim() || `${Date.now()}`
    const startRng = hashSeed(normalizedSeed)
    const totalBattles = RUN_NODE_SEQUENCE.length

    const battle = createBattleState(
      {
        hp: PLAYER_START_HP,
        maxHp: PLAYER_START_HP,
      },
      1,
      totalBattles,
      startRng,
    )

    return {
      runId: `run_${normalizedSeed}_${Math.floor(Math.random() * 10000)}`,
      seed: normalizedSeed,
      rngState: battle.rngState,
      battleIndex: 1,
      totalBattles,
      currentNodeType: getNodeTypeForBattleIndex(1, totalBattles),
      status: 'in_battle',
      player: battle.player,
      enemy: battle.enemy,
      combat: battle.combat,
      progress: {
        level: 1,
        xp: 0,
        xpToNext: getXpToNextLevel(1),
      },
      handLevels: { ...DEFAULT_HAND_LEVELS },
      ownedRelics: [],
      rewardQueue: [],
      activeRewardOffer: null,
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

  private makeOfferId(prefix: string, next: RunState): string {
    return `${prefix}_${next.battleIndex}_${next.progress.level}_${Math.abs(next.rngState % 100000)}`
  }

  private rollRarity(nodeType: RunState['currentNodeType'], rngState: number): { rarity: RelicRarity; rngState: number } {
    const weights = RELIC_DROP_WEIGHTS[nodeType === 'merchant_campfire' ? 'normal' : nodeType]
    const total = weights.blue + weights.purple + weights.orange
    const roll = randomInt(rngState, total)
    const value = roll.value

    if (value < weights.blue) return { rarity: 'blue', rngState: roll.rngState }
    if (value < weights.blue + weights.purple) return { rarity: 'purple', rngState: roll.rngState }
    return { rarity: 'orange', rngState: roll.rngState }
  }

  private pickRelicByRarity(
    rarity: RelicRarity,
    selectedIds: Set<string>,
    rngState: number,
  ): { relic: RelicDefinition | null; rngState: number } {
    const pool = RELIC_POOL.filter((item) => item.rarity === rarity && !selectedIds.has(item.id))
    if (pool.length === 0) return { relic: null, rngState }

    const roll = randomInt(rngState, pool.length)
    return { relic: pool[roll.value], rngState: roll.rngState }
  }

  private pickAnyRelic(selectedIds: Set<string>, rngState: number): { relic: RelicDefinition | null; rngState: number } {
    const pool = RELIC_POOL.filter((item) => !selectedIds.has(item.id))
    if (pool.length === 0) return { relic: null, rngState }

    const roll = randomInt(rngState, pool.length)
    return { relic: pool[roll.value], rngState: roll.rngState }
  }

  private buildRelicOffer(next: RunState): RewardOffer {
    const selectedIds = new Set<string>()
    const picks: RelicDefinition[] = []
    let state = next.rngState

    for (let i = 0; i < 3; i += 1) {
      const rarityRoll = this.rollRarity(next.currentNodeType, state)
      state = rarityRoll.rngState

      let pick = this.pickRelicByRarity(rarityRoll.rarity, selectedIds, state)
      state = pick.rngState

      if (!pick.relic) {
        pick = this.pickAnyRelic(selectedIds, state)
        state = pick.rngState
      }

      if (pick.relic) {
        picks.push(pick.relic)
        selectedIds.add(pick.relic.id)
      }
    }

    if (next.currentNodeType === 'elite' && !picks.some((item) => item.rarity === 'purple' || item.rarity === 'orange')) {
      const candidate = RELIC_POOL.filter((item) => (item.rarity === 'purple' || item.rarity === 'orange') && !selectedIds.has(item.id))
      if (candidate.length > 0 && picks.length > 0) {
        const slotRoll = randomInt(state, picks.length)
        state = slotRoll.rngState
        const candRoll = randomInt(state, candidate.length)
        state = candRoll.rngState
        picks[slotRoll.value] = candidate[candRoll.value]
      }
    }

    if (next.currentNodeType === 'boss' && !picks.some((item) => item.rarity === 'orange')) {
      const candidate = RELIC_POOL.filter((item) => item.rarity === 'orange' && !selectedIds.has(item.id))
      if (candidate.length > 0 && picks.length > 0) {
        const slotRoll = randomInt(state, picks.length)
        state = slotRoll.rngState
        const candRoll = randomInt(state, candidate.length)
        state = candRoll.rngState
        picks[slotRoll.value] = candidate[candRoll.value]
      }
    }

    next.rngState = state

    const choices: RewardChoice[] = picks.map((relic) => ({
      id: `${relic.id}_${Math.abs(next.rngState % 10000)}`,
      type: 'relic_pick',
      title: relic.name,
      description: relic.description,
      relicId: relic.id,
    }))

    return {
      id: this.makeOfferId('relic', next),
      offerType: 'relic_pick',
      title: '随机藏品',
      subtitle: '从三件藏品中选择一件加入本局背包。',
      choices,
    }
  }

  private buildHandUpgradeOffer(next: RunState): RewardOffer {
    const upgradable = (Object.keys(next.handLevels) as HandType[]).filter((type) => next.handLevels[type] < HAND_LEVEL_MAX)

    if (upgradable.length === 0) {
      return {
        id: this.makeOfferId('hand_xp', next),
        offerType: 'hand_upgrade',
        title: '牌型成长包',
        subtitle: '全部牌型已满级，改为经验补偿。',
        choices: [80, 120, 160].map((xp) => ({
          id: `xp_bonus_${xp}_${Math.abs(next.rngState % 10000)}`,
          type: 'xp_bonus',
          title: `经验补偿 +${xp}`,
          description: '已满级占位奖励。',
          xpGain: xp,
        })),
      }
    }

    const pickCount = Math.min(3, upgradable.length)
    const picked = pickRandomUnique(upgradable, pickCount, next.rngState)
    next.rngState = picked.rngState

    const choices: RewardChoice[] = picked.picked.map((handType) => ({
      id: `hand_up_${handType}_${Math.abs(next.rngState % 10000)}`,
      type: 'hand_upgrade',
      title: `${HAND_STATS[handType].name} +1`,
      description: '提升该牌型的底注与倍率成长。',
      handType,
      deltaLevel: 1,
    }))

    while (choices.length < 3) {
      choices.push({
        id: `hand_wild_${choices.length}_${Math.abs(next.rngState % 10000)}`,
        type: 'hand_wildcard',
        title: '通配升级 +1',
        description: '随机一个未满级牌型提升 1 级。',
        deltaLevel: 1,
      })
    }

    return {
      id: this.makeOfferId('hand', next),
      offerType: 'hand_upgrade',
      title: '牌型成长包',
      subtitle: '从三张成长卡中选择一张。',
      choices,
    }
  }

  private queueLevelRewardOffers(next: RunState): void {
    next.rewardQueue.push(this.buildHandUpgradeOffer(next))
    next.rewardQueue.push(this.buildRelicOffer(next))
  }

  private grantXp(next: RunState, xpGain: number): number {
    if (xpGain <= 0) return 0
    next.progress.xp += xpGain

    let levelsGained = 0
    while (next.progress.xp >= next.progress.xpToNext) {
      next.progress.xp -= next.progress.xpToNext
      next.progress.level += 1
      next.progress.xpToNext = getXpToNextLevel(next.progress.level)
      levelsGained += 1
      this.queueLevelRewardOffers(next)
    }

    return levelsGained
  }

  private startRewardFlowOrAdvance(next: RunState): void {
    if (next.rewardQueue.length > 0) {
      next.activeRewardOffer = next.rewardQueue.shift() ?? null
      next.status = 'reward'
      return
    }

    next.activeRewardOffer = null

    if (next.battleIndex >= next.totalBattles) {
      next.status = 'won'
      return
    }

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
    next.currentNodeType = getNodeTypeForBattleIndex(battleIndex, next.totalBattles)
    next.status = 'in_battle'
    next.player = battle.player
    next.enemy = battle.enemy
    next.combat = battle.combat
    next.rngState = battle.rngState
  }

  private evaluateBattleScore(next: RunState): { score: number; xpGain: number } {
    const damagePart = Math.min(700, next.combat.battleDamageDealt * 0.12)
    const hpPart = Math.round((next.player.hp / Math.max(1, next.player.maxHp)) * 300)
    const tempoPart = Math.max(0, 260 - next.combat.battleTurns * 15)
    const winPart = 120
    const tierPart = NODE_TIER_SCORE_BONUS[next.currentNodeType === 'merchant_campfire' ? 'normal' : next.currentNodeType]

    const battleScore = Math.floor(damagePart + hpPart + tempoPart + winPart + tierPart)
    const xpGain = Math.max(60, Math.floor(battleScore / 4))

    return { score: battleScore, xpGain }
  }

  private applyRewardChoice(next: RunState, choice: RewardChoice): void {
    if (choice.type === 'hand_upgrade') {
      next.handLevels[choice.handType] = Math.min(HAND_LEVEL_MAX, next.handLevels[choice.handType] + choice.deltaLevel)
      return
    }

    if (choice.type === 'hand_wildcard') {
      const upgradable = (Object.keys(next.handLevels) as HandType[]).filter((type) => next.handLevels[type] < HAND_LEVEL_MAX)
      if (upgradable.length > 0) {
        const roll = randomInt(next.rngState, upgradable.length)
        next.rngState = roll.rngState
        const chosen = upgradable[roll.value]
        next.handLevels[chosen] = Math.min(HAND_LEVEL_MAX, next.handLevels[chosen] + choice.deltaLevel)
      }
      return
    }

    if (choice.type === 'xp_bonus') {
      this.grantXp(next, choice.xpGain)
      return
    }

    const relic = RELIC_POOL.find((item) => item.id === choice.relicId)
    if (!relic) return

    next.ownedRelics.push({
      id: relic.id,
      name: relic.name,
      rarity: relic.rarity,
      description: relic.description,
      effectType: relic.effectType,
    })
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

    const outputEval = actorId === 'player' ? applyHandLevelsToEval(handEval, next.handLevels) : handEval

    const playRecord: PlayRecord = {
      by: actorId,
      cards: playedCards,
      eval: outputEval,
    }

    actor.hand = removeCardsByIds(actor.hand, cardIds)
    actor.discard.push(...playedCards)

    next.combat.currentPlay = playRecord
    next.combat.trickHistory.push(playRecord)
    next.combat.actionTurn = actorId === 'player' ? 'enemy' : 'player'
    next.combat.battleTurns += 1
    next.combat.log = pushLog(next.combat.log, `${actorId === 'player' ? '你' : next.enemy.name} 打出 ${outputEval.name}。`)
    next.stats.turnsPlayed += 1

    this.state = next
    return this.result(true, [{ type: 'combat', message: `${outputEval.name} 已出牌。` }])
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
    } else if (!isDefenseSuccess && winner === 'enemy') {
      const nodeType = next.currentNodeType === 'merchant_campfire' ? 'normal' : next.currentNodeType
      const scaled = Math.floor(damage * ENEMY_DAMAGE_SCALE[nodeType])
      damage = clamp(scaled, ENEMY_DAMAGE_CLAMP_MIN[nodeType], ENEMY_DAMAGE_CLAMP_MAX[nodeType])
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
        next.combat.battleDamageDealt += damage
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
      next.combat.currentPlay = null
      next.combat.trickHistory = []
      next.rewardQueue = []
      next.activeRewardOffer = null

      if (next.player.hp <= 0) {
        next.status = 'lost'
        next.combat.log = pushLog(next.combat.log, '你倒下了，本次 Run 结束。')
        this.state = next
        return this.result(true, [{ type: 'combat', message: '战斗已结算。' }])
      }

      next.stats.battlesWon += 1

      const score = this.evaluateBattleScore(next)
      const levelUps = this.grantXp(next, score.xpGain)
      next.combat.log = pushLog(next.combat.log, `战斗评分 ${score.score}，获得 ${score.xpGain} 经验。`)
      if (levelUps > 0) {
        next.combat.log = pushLog(next.combat.log, `本场共提升 ${levelUps} 级，解锁成长奖励。`)
      }

      this.startRewardFlowOrAdvance(next)

      if (next.status === 'won') {
        next.combat.log = pushLog(next.combat.log, 'Boss 已击败，你赢下了本次 Run。')
      } else if (next.status === 'reward') {
        next.combat.log = pushLog(next.combat.log, '升级奖励已就绪，请选择。')
      }

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

  public chooseReward(choiceId: string): EngineResult {
    if (this.state.status !== 'reward') return this.fail('当前没有可选奖励。')
    if (!this.state.activeRewardOffer) return this.fail('当前奖励为空。')

    const next = cloneState(this.state)
    const activeOffer = next.activeRewardOffer
    if (!activeOffer) return this.fail('当前奖励为空。')
    const choice = activeOffer.choices.find((item) => item.id === choiceId)
    if (!choice) return this.fail('奖励不存在。')

    this.applyRewardChoice(next, choice)

    next.activeRewardOffer = next.rewardQueue.shift() ?? null
    if (next.activeRewardOffer) {
      next.status = 'reward'
    } else {
      next.status = next.battleIndex >= next.totalBattles ? 'won' : 'in_battle'
      if (next.status === 'in_battle') {
        this.startRewardFlowOrAdvance(next)
      }
    }

    this.state = next
    return this.result(true, [{ type: 'reward', message: '奖励已选择。' }])
  }

  public nextBattle(): EngineResult {
    if (this.state.status !== 'reward') return this.fail('当前不在下一战准备阶段。')
    if (this.state.activeRewardOffer || this.state.rewardQueue.length > 0) {
      return this.fail('仍有奖励待选择。')
    }
    if (this.state.battleIndex >= this.state.totalBattles) return this.fail('当前已是最终战。')

    const next = cloneState(this.state)
    this.startRewardFlowOrAdvance(next)
    this.state = next
    return this.result(true, [{ type: 'system', message: `进入第 ${next.battleIndex} / ${next.totalBattles} 战。` }])
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

    this.state = normalizeHandOrder(cloneState(snapshot.runState))
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

  public getRewards(): RewardOffer[] {
    return [
      ...(this.state.activeRewardOffer ? [this.state.activeRewardOffer] : []),
      ...this.state.rewardQueue,
    ]
  }
}
