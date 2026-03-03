import { describe, expect, it } from 'vitest'

import {
  ENEMY_DAMAGE_CLAMP_MAX,
  ENEMY_DAMAGE_CLAMP_MIN,
  ENEMY_DAMAGE_SCALE,
  ENEMY_HP_BASE,
  ENEMY_HP_VARIANCE,
  SAVE_VERSION,
} from '@/engine/constants'
import { getChipValue, getRankWeight } from '@/engine/cards'
import { decideEnemyAction } from '@/engine/ai'
import { GameEngine } from '@/engine/game-engine'
import { evaluateHand, getValidPlays } from '@/engine/rules'
import type { Card, EngineResult, Rank, RunState, SaveSnapshot } from '@/engine/types'

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

function median(values: number[]): number {
  if (values.length === 0) throw new Error('Cannot compute median of empty array.')
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) return sorted[mid]
  return (sorted[mid - 1] + sorted[mid]) / 2
}

function forceAdvanceToBattle(engine: GameEngine, targetBattleIndex: number): RunState {
  while (true) {
    const current = engine.getState()
    if (current.battleIndex === targetBattleIndex && current.status === 'in_battle') return current
    if (current.battleIndex >= targetBattleIndex) return current

    const prepared: RunState = {
      ...current,
      status: 'reward',
      activeRewardOffer: null,
      rewardQueue: [],
    }

    engine.restore(snapshotFromState(prepared))
    const moved = engine.nextBattle()
    if (!moved.ok) throw new Error('Failed to force advance battle in test.')
  }
}

function playLowestValid(engine: GameEngine, state: RunState, actor: 'player' | 'enemy'): EngineResult {
  const hand = actor === 'player' ? state.player.hand : state.enemy.hand
  const validPlays = getValidPlays(hand, state.combat.currentPlay?.eval)

  if (validPlays.length > 0) {
    validPlays.sort((a, b) => a.eval.totalScore - b.eval.totalScore)
    return engine.playCards(actor, validPlays[0].cards.map((playCard) => playCard.id))
  }

  if (state.combat.currentPlay) return engine.pass(actor)
  if (hand.length > 0) return engine.playCards(actor, [hand[0].id])
  return engine.pass(actor)
}

function playBalancedValid(engine: GameEngine, state: RunState, actor: 'player' | 'enemy'): EngineResult {
  const hand = actor === 'player' ? state.player.hand : state.enemy.hand
  const validPlays = getValidPlays(hand, state.combat.currentPlay?.eval)

  if (validPlays.length > 0) {
    const nonExplosive = validPlays.filter((candidate) => candidate.eval.type !== 'bomb' && candidate.eval.type !== 'rocket')
    const candidates = nonExplosive.length > 0 ? nonExplosive : validPlays
    candidates.sort((a, b) => a.eval.totalScore - b.eval.totalScore || a.cards.length - b.cards.length)
    const pickIndex = Math.floor((candidates.length - 1) * 1)
    return engine.playCards(actor, candidates[pickIndex].cards.map((playCard) => playCard.id))
  }

  if (state.combat.currentPlay) return engine.pass(actor)
  if (hand.length > 0) return engine.playCards(actor, [hand[0].id])
  return engine.pass(actor)
}

function playContextualPlayerTurn(engine: GameEngine, state: RunState): EngineResult {
  const isDefending = state.combat.currentPlay !== null && state.combat.roundOwner === 'enemy'
  if (isDefending) return playLowestValid(engine, state, 'player')
  return playBalancedValid(engine, state, 'player')
}

function stepEnemy(engine: GameEngine, state: RunState): EngineResult {
  const decision = decideEnemyAction({
    enemyHand: state.enemy.hand,
    currentPlay: state.combat.currentPlay,
    roundOwner: state.combat.roundOwner,
    hp: { enemy: state.enemy.hp, player: state.player.hp },
    deckInfo: { handLimit: 10, enemyDeckLeft: state.enemy.deck.length },
    randomValue: engine.consumeRandom(),
  })

  const primary =
    decision.action === 'play'
      ? engine.playCards('enemy', decision.cardIds ?? [])
      : engine.pass('enemy')

  if (primary.ok) return primary
  return playLowestValid(engine, state, 'enemy')
}

describe('balance and pacing', () => {
  it('固定为三战节点顺序 normal -> elite -> boss', () => {
    const engine = new GameEngine('sequence_seed')

    const battle1 = engine.getState()
    expect(battle1.totalBattles).toBe(3)
    expect(battle1.battleIndex).toBe(1)
    expect(battle1.currentNodeType).toBe('normal')

    const battle2 = forceAdvanceToBattle(engine, 2)
    expect(battle2.currentNodeType).toBe('elite')

    const battle3 = forceAdvanceToBattle(engine, 3)
    expect(battle3.currentNodeType).toBe('boss')
  })

  it('敌人血量在节点预算 ±5% 范围内并按十位取整', () => {
    const seeds = 30
    for (let i = 0; i < seeds; i += 1) {
      const engine = new GameEngine(`hp_seed_${i}`)
      const b1 = forceAdvanceToBattle(engine, 1)
      const b2 = forceAdvanceToBattle(engine, 2)
      const b3 = forceAdvanceToBattle(engine, 3)

      const checks: Array<{ node: 'normal' | 'elite' | 'boss'; hp: number }> = [
        { node: 'normal', hp: b1.enemy.maxHp },
        { node: 'elite', hp: b2.enemy.maxHp },
        { node: 'boss', hp: b3.enemy.maxHp },
      ]

      for (const check of checks) {
        const base = ENEMY_HP_BASE[check.node]
        const minRounded = Math.round((base * (1 - ENEMY_HP_VARIANCE)) / 10) * 10
        const maxRounded = Math.round((base * (1 + ENEMY_HP_VARIANCE)) / 10) * 10

        expect(check.hp).toBeGreaterThanOrEqual(minRounded)
        expect(check.hp).toBeLessThanOrEqual(maxRounded)
        expect(check.hp % 10).toBe(0)
      }
    }
  })

  it('敌方伤害应用节点缩放并受最小/最大伤害钳制', () => {
    const engine = new GameEngine('enemy_damage_seed')
    const base = engine.getState()

    const highCards = [card('bj', 'BJ', 'J'), card('rj', 'RJ', 'J')]
    const lowCards = [card('s3', '3', 'S')]

    const highEval = evaluateHand(highCards)
    const lowEval = evaluateHand(lowCards)
    if (!highEval || !lowEval) throw new Error('Invalid hand setup for damage clamp tests.')

    const highPlayState: RunState = {
      ...base,
      status: 'in_battle',
      currentNodeType: 'boss',
      player: { ...base.player, hp: 1000, maxHp: 1000, hand: [], deck: [], discard: [] },
      enemy: { ...base.enemy, name: '测试敌人', hp: 1000, maxHp: 1000, hand: [], deck: [], discard: [] },
      combat: {
        ...base.combat,
        roundOwner: 'enemy',
        actionTurn: 'player',
        currentPlay: { by: 'enemy', cards: highCards, eval: highEval },
        trickHistory: [],
        log: [],
        battleDamageDealt: 0,
        battleTurns: 0,
      },
      rewardQueue: [],
      activeRewardOffer: null,
    }

    engine.restore(snapshotFromState(highPlayState))
    const highResult = engine.pass('player')
    expect(highResult.ok).toBe(true)
    expect(highPlayState.player.hp - highResult.state.player.hp).toBe(ENEMY_DAMAGE_CLAMP_MAX.boss)

    const lowPlayState: RunState = {
      ...highPlayState,
      currentNodeType: 'normal',
      player: { ...highPlayState.player, hp: 1000, maxHp: 1000 },
      combat: {
        ...highPlayState.combat,
        currentPlay: { by: 'enemy', cards: lowCards, eval: lowEval },
      },
    }

    engine.restore(snapshotFromState(lowPlayState))
    const lowResult = engine.pass('player')
    expect(lowResult.ok).toBe(true)
    expect(lowPlayState.player.hp - lowResult.state.player.hp).toBe(ENEMY_DAMAGE_CLAMP_MIN.normal)

    const expectedScaled = Math.floor(highEval.totalScore * ENEMY_DAMAGE_SCALE.boss)
    expect(expectedScaled).toBeGreaterThan(ENEMY_DAMAGE_CLAMP_MAX.boss)
  })

  it('自动对战节奏与生存率处于预期区间', () => {
    const seeds = 30
    const normalCounts: number[] = []
    const eliteCounts: number[] = []
    const bossCounts: number[] = []
    const wonRatios: number[] = []

    for (let i = 0; i < seeds; i += 1) {
      const engine = new GameEngine(`pace_seed_${i}`)
      const counts = { normal: 0, elite: 0, boss: 0 }
      let steps = 0

      while (steps < 1400) {
        const state = engine.getState()
        if (state.status === 'won' || state.status === 'lost') {
          if (state.status === 'won') {
            wonRatios.push(state.player.hp / Math.max(1, state.player.maxHp))
          }
          break
        }

        let result: EngineResult
        if (state.status === 'reward') {
          const activeOffer = state.activeRewardOffer
          expect(activeOffer).not.toBeNull()
          result = engine.chooseReward(activeOffer!.choices[0].id)
        } else if (state.combat.actionTurn === 'enemy') {
          result = stepEnemy(engine, state)
        } else {
          result = playContextualPlayerTurn(engine, state)
        }

        expect(result.ok).toBe(true)
        if (state.status === 'in_battle' && result.state.enemy.hp < state.enemy.hp) {
          if (state.currentNodeType === 'normal') counts.normal += 1
          if (state.currentNodeType === 'elite') counts.elite += 1
          if (state.currentNodeType === 'boss') counts.boss += 1
        }
        steps += 1
      }

      normalCounts.push(counts.normal)
      eliteCounts.push(counts.elite)
      bossCounts.push(counts.boss)
    }

    const normalMedian = median(normalCounts)
    const eliteMedian = median(eliteCounts)
    const bossMedian = median(bossCounts)
    const hpRatioMedian = median(wonRatios)

    expect(normalMedian).toBeGreaterThanOrEqual(4)
    expect(normalMedian).toBeLessThanOrEqual(6)

    expect(eliteMedian).toBeGreaterThanOrEqual(10)
    expect(eliteMedian).toBeLessThanOrEqual(13)

    expect(bossMedian).toBeGreaterThanOrEqual(16)
    expect(bossMedian).toBeLessThanOrEqual(19)

    expect(wonRatios.length).toBeGreaterThanOrEqual(Math.floor(seeds * 0.6))
    expect(hpRatioMedian).toBeGreaterThanOrEqual(0.3)
    expect(hpRatioMedian).toBeLessThanOrEqual(0.75)
  }, 30000)
})
