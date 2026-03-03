import { describe, expect, it } from 'vitest'

import { HAND_LEVEL_GROWTH, HAND_LEVEL_MAX, HAND_STATS, RELIC_POOL, SAVE_VERSION } from '@/engine/constants'
import { getChipValue, getRankWeight } from '@/engine/cards'
import { GameEngine } from '@/engine/game-engine'
import { applyHandLevelToEval, evaluateHand } from '@/engine/rules'
import type { Card, HandType, Rank, RunState, SaveSnapshot } from '@/engine/types'

function card(id: string, rank: Rank, suit: Card['suit'] = 'S'): Card {
  return {
    id,
    rank,
    suit,
    weight: getRankWeight(rank),
    chips: getChipValue(rank),
  }
}

function snapshotFromState(state: RunState): SaveSnapshot {
  return {
    version: SAVE_VERSION,
    savedAt: new Date().toISOString(),
    runState: state,
  }
}

function makeBattleWinState(base: RunState): RunState {
  const attackCards = [card('atk_1', 'A')]
  const attackEval = evaluateHand(attackCards)
  if (!attackEval) throw new Error('invalid test setup')

  return {
    ...base,
    status: 'in_battle',
    battleIndex: 1,
    totalBattles: 3,
    currentNodeType: 'normal',
    player: {
      ...base.player,
      hp: 1200,
      maxHp: 1200,
      hand: [],
      deck: [],
      discard: [],
    },
    enemy: {
      ...base.enemy,
      name: '测试敌人',
      hp: 20,
      maxHp: 800,
      hand: [],
      deck: [],
      discard: [],
    },
    combat: {
      ...base.combat,
      roundOwner: 'player',
      actionTurn: 'enemy',
      currentPlay: {
        by: 'player',
        cards: attackCards,
        eval: attackEval,
      },
      trickHistory: [],
      log: [],
      battleDamageDealt: 0,
      battleTurns: 0,
    },
    progress: {
      level: 1,
      xp: 130,
      xpToNext: 140,
    },
    rewardQueue: [],
    activeRewardOffer: null,
  }
}

describe('hand level growth', () => {
  it('牌型等级会修正底注、倍率和总分', () => {
    const evalResult = evaluateHand([card('h1', 'A')])
    if (!evalResult) throw new Error('invalid test setup')

    const leveled = applyHandLevelToEval(evalResult, 5)
    const expectedBase = HAND_STATS.single.baseChips + 4 * HAND_LEVEL_GROWTH.single.chipsInc
    const expectedMult = Number((HAND_STATS.single.mult + 4 * HAND_LEVEL_GROWTH.single.multInc).toFixed(2))

    expect(leveled.baseChips).toBe(expectedBase)
    expect(leveled.mult).toBe(expectedMult)
    expect(leveled.totalScore).toBe(Math.floor((expectedBase + evalResult.cardChips) * expectedMult))
  })
})

describe('leveling and reward offers', () => {
  it('牌型等级上限为 10 级', () => {
    const engine = new GameEngine('cap_seed')
    const state = engine.getState()

    state.status = 'reward'
    state.activeRewardOffer = {
      id: 'cap_offer',
      offerType: 'hand_upgrade',
      title: '牌型成长包',
      subtitle: '测试',
      choices: [
        {
          id: 'cap_choice',
          type: 'hand_upgrade',
          title: '单张 +1',
          description: '测试',
          handType: 'single',
          deltaLevel: 1,
        },
      ],
    }
    state.rewardQueue = []
    state.handLevels.single = HAND_LEVEL_MAX

    engine.restore(snapshotFromState(state))
    const result = engine.chooseReward('cap_choice')

    expect(result.ok).toBe(true)
    expect(result.state.handLevels.single).toBe(HAND_LEVEL_MAX)
  })

  it('单场多级连升时，奖励顺序为 每级 hand_upgrade -> relic_pick', () => {
    const engine = new GameEngine('multi_level_seed')
    const state = makeBattleWinState(engine.getState())

    state.progress = {
      level: 1,
      xp: 200,
      xpToNext: 140,
    }
    state.combat.battleDamageDealt = 5000

    engine.restore(snapshotFromState(state))
    const result = engine.pass('enemy')

    expect(result.ok).toBe(true)
    expect(result.state.status).toBe('reward')
    expect(result.state.progress.level).toBe(3)
    expect(result.state.activeRewardOffer?.offerType).toBe('hand_upgrade')
    expect(result.state.rewardQueue).toHaveLength(3)
    expect(result.state.rewardQueue.map((offer) => offer.offerType)).toEqual(['relic_pick', 'hand_upgrade', 'relic_pick'])
  })

  it('精英藏品包三选一至少包含一张紫色及以上', () => {
    const engine = new GameEngine('elite_drop_seed')
    const state = makeBattleWinState(engine.getState())

    state.currentNodeType = 'elite'

    engine.restore(snapshotFromState(state))
    const result = engine.pass('enemy')

    expect(result.ok).toBe(true)
    expect(result.state.status).toBe('reward')

    const relicOffer = result.state.rewardQueue.find((offer) => offer.offerType === 'relic_pick')
    expect(relicOffer).toBeTruthy()

    const rarities = relicOffer!.choices
      .map((choice) => (choice.type === 'relic_pick' ? RELIC_POOL.find((item) => item.id === choice.relicId)?.rarity : null))
      .filter((rarity): rarity is 'blue' | 'purple' | 'orange' => rarity !== null)

    expect(rarities.some((rarity) => rarity === 'purple' || rarity === 'orange')).toBe(true)
  })

  it('Boss 战胜后先结算奖励，且藏品包至少包含一张橙色', () => {
    const engine = new GameEngine('boss_drop_seed')
    const state = makeBattleWinState(engine.getState())

    state.battleIndex = state.totalBattles
    state.currentNodeType = 'boss'

    engine.restore(snapshotFromState(state))
    let result = engine.pass('enemy')

    expect(result.ok).toBe(true)
    expect(result.state.status).toBe('reward')

    const relicOffer = result.state.rewardQueue.find((offer) => offer.offerType === 'relic_pick')
    expect(relicOffer).toBeTruthy()

    const rarities = relicOffer!.choices
      .map((choice) => (choice.type === 'relic_pick' ? RELIC_POOL.find((item) => item.id === choice.relicId)?.rarity : null))
      .filter((rarity): rarity is 'blue' | 'purple' | 'orange' => rarity !== null)

    expect(rarities.includes('orange')).toBe(true)

    while (result.state.status === 'reward') {
      const active = result.state.activeRewardOffer
      expect(active).not.toBeNull()
      result = engine.chooseReward(active!.choices[0].id)
      expect(result.ok).toBe(true)
    }

    expect(result.state.status).toBe('won')
  })

  it('全部牌型满级时，牌型包回退为经验占位卡', () => {
    const engine = new GameEngine('max_level_fallback_seed')
    const state = makeBattleWinState(engine.getState())

    for (const type of Object.keys(state.handLevels) as HandType[]) {
      state.handLevels[type] = HAND_LEVEL_MAX
    }

    engine.restore(snapshotFromState(state))
    const result = engine.pass('enemy')

    expect(result.ok).toBe(true)
    expect(result.state.status).toBe('reward')
    expect(result.state.activeRewardOffer?.offerType).toBe('hand_upgrade')
    expect(result.state.activeRewardOffer?.choices.every((choice) => choice.type === 'xp_bonus')).toBe(true)
  })
})

