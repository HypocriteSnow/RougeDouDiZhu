import { getValidPlays } from '@/engine/rules'
import type { AiDecision, AiPolicyInput } from '@/engine/types'

export function decideEnemyAction(input: AiPolicyInput): AiDecision {
  const { enemyHand, currentPlay, hp, randomValue = Math.random() } = input

  const candidates = getValidPlays(enemyHand, currentPlay?.eval)
  if (candidates.length === 0) return { action: 'pass' }

  const danger = hp.enemy / Math.max(1, hp.player)
  const isBehind = danger < 0.7

  const scored = candidates.map((candidate) => {
    const bombTax = candidate.eval.type === 'bomb' ? 260 : candidate.eval.type === 'rocket' ? 700 : 0
    const aggressionBonus = isBehind ? candidate.eval.totalScore * -0.15 : 0
    const randomJitter = (randomValue - 0.5) * 18
    const score = candidate.eval.totalScore + candidate.cards.length * 8 + bombTax + aggressionBonus + randomJitter
    return { candidate, score }
  })

  scored.sort((a, b) => a.score - b.score)
  return {
    action: 'play',
    cardIds: scored[0].candidate.cards.map((card) => card.id),
  }
}
