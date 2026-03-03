import { describe, expect, it } from 'vitest'

import { SAVE_VERSION } from '@/engine/constants'
import { getChipValue, getRankWeight } from '@/engine/cards'
import { GameEngine } from '@/engine/game-engine'
import { evaluateHand } from '@/engine/rules'
import type { Card, Rank, RunState, SaveSnapshot } from '@/engine/types'

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

function makePassResolutionState(base: RunState): RunState {
  const attackCards = [card('p1', 'A')]
  const attackEval = evaluateHand(attackCards)
  if (!attackEval) throw new Error('invalid test setup')

  return {
    ...base,
    status: 'in_battle',
    currentNodeType: 'normal',
    battleIndex: 1,
    totalBattles: 3,
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

describe('GameEngine.pass', () => {
  it('攻击方压制到底时造成伤害并进入奖励流', () => {
    const engine = new GameEngine('seed_x')
    const state = makePassResolutionState(engine.getState())

    engine.restore(snapshotFromState(state))
    const result = engine.pass('enemy')

    expect(result.ok).toBe(true)
    expect(result.state.enemy.hp).toBe(0)
    expect(result.state.status).toBe('reward')
    expect(result.state.activeRewardOffer?.offerType).toBe('hand_upgrade')
    expect(result.state.rewardQueue[0]?.offerType).toBe('relic_pick')
    expect(result.state.stats.battlesWon).toBe(1)
  })

  it('防守成功时不造成伤害并转移牌权', () => {
    const engine = new GameEngine('seed_y')
    const state = makePassResolutionState(engine.getState())

    state.enemy.hp = 600
    state.combat.roundOwner = 'enemy'

    engine.restore(snapshotFromState(state))
    const result = engine.pass('enemy')

    expect(result.ok).toBe(true)
    expect(result.state.enemy.hp).toBe(600)
    expect(result.state.combat.roundOwner).toBe('player')
    expect(result.state.combat.actionTurn).toBe('player')
    expect(result.state.status).toBe('in_battle')
  })
})

