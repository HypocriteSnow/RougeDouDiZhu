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

function baseState(): RunState {
  const attackCards = [card('p1', 'A')]
  const attackEval = evaluateHand(attackCards)
  if (!attackEval) throw new Error('invalid test setup')

  return {
    runId: 'run_test',
    seed: 'test_seed',
    rngState: 123,
    battleIndex: 1,
    totalBattles: 3,
    status: 'in_battle',
    player: {
      hp: 1200,
      maxHp: 1200,
      hand: [],
      deck: [],
      discard: [],
    },
    enemy: {
      name: '测试敌人',
      hp: 20,
      maxHp: 800,
      hand: [],
      deck: [],
      discard: [],
    },
    combat: {
      roundOwner: 'player',
      actionTurn: 'enemy',
      currentPlay: {
        by: 'player',
        cards: attackCards,
        eval: attackEval,
      },
      trickHistory: [],
      log: [],
    },
    pendingRewards: [],
    buffs: {
      playerDamageMult: 1,
      playerDamageFlat: 0,
    },
    settings: {
      sfxVolume: 0.5,
      animationSpeed: 'normal',
    },
    stats: {
      battlesWon: 0,
      totalDamageDealt: 0,
      totalDamageTaken: 0,
      turnsPlayed: 0,
    },
  }
}

function snapshotFromState(state: RunState): SaveSnapshot {
  return {
    version: SAVE_VERSION,
    savedAt: new Date().toISOString(),
    runState: state,
  }
}

describe('GameEngine.pass', () => {
  it('攻击方压制到底时造成伤害并进入奖励阶段', () => {
    const engine = new GameEngine('seed_x')
    engine.restore(snapshotFromState(baseState()))

    const result = engine.pass('enemy')

    expect(result.ok).toBe(true)
    expect(result.state.enemy.hp).toBe(0)
    expect(result.state.status).toBe('reward')
    expect(result.state.pendingRewards).toHaveLength(3)
    expect(result.state.stats.battlesWon).toBe(1)
  })

  it('防守成功时不造成伤害并转移牌权', () => {
    const engine = new GameEngine('seed_y')
    const state = baseState()

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
