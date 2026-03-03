import { describe, expect, it } from 'vitest'

import { decideEnemyAction } from '@/engine/ai'
import { GameEngine } from '@/engine/game-engine'
import { getValidPlays } from '@/engine/rules'
import type { EngineResult, RunState } from '@/engine/types'

function playLowestValid(engine: GameEngine, state: RunState, actor: 'player' | 'enemy'): EngineResult {
  const hand = actor === 'player' ? state.player.hand : state.enemy.hand
  const validPlays = getValidPlays(hand, state.combat.currentPlay?.eval)

  if (validPlays.length > 0) {
    validPlays.sort((a, b) => a.eval.totalScore - b.eval.totalScore)
    return engine.playCards(actor, validPlays[0].cards.map((card) => card.id))
  }

  if (state.combat.currentPlay) return engine.pass(actor)
  if (hand.length > 0) return engine.playCards(actor, [hand[0].id])
  return engine.pass(actor)
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

describe('battle flow safety', () => {
  it('多局自动对战不会卡死在 enemy turn', () => {
    const runs = 8
    const maxStepsPerRun = 500
    let totalEnemyTurns = 0

    for (let run = 0; run < runs; run += 1) {
      const engine = new GameEngine(`flow_seed_${run}`)
      let steps = 0

      while (steps < maxStepsPerRun) {
        const state = engine.getState()
        if (state.status === 'won' || state.status === 'lost') {
          break
        }

        let result: EngineResult
        if (state.status === 'reward') {
          const active = state.activeRewardOffer
          expect(active).not.toBeNull()
          result = engine.chooseReward(active!.choices[0].id)
        } else if (state.combat.actionTurn === 'enemy') {
          totalEnemyTurns += 1
          result = stepEnemy(engine, state)
        } else {
          result = playLowestValid(engine, state, 'player')
        }

        expect(result.ok).toBe(true)

        const changed =
          result.state.status !== state.status ||
          result.state.combat.actionTurn !== state.combat.actionTurn ||
          result.state.combat.log.length !== state.combat.log.length ||
          result.state.player.hp !== state.player.hp ||
          result.state.enemy.hp !== state.enemy.hp ||
          result.state.combat.trickHistory.length !== state.combat.trickHistory.length ||
          result.state.progress.level !== state.progress.level ||
          result.state.rewardQueue.length !== state.rewardQueue.length

        expect(changed).toBe(true)
        steps += 1
      }
    }

    expect(totalEnemyTurns).toBeGreaterThan(0)
  }, 20000)
})

