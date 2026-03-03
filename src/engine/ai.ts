import { getValidPlays } from '@/engine/rules'
import type { AiDecision, AiPolicyInput } from '@/engine/types'

export function decideEnemyAction(input: AiPolicyInput): AiDecision {
  const { enemyHand, currentPlay, hp } = input

  const candidates = getValidPlays(enemyHand, currentPlay?.eval)
  if (candidates.length === 0) return { action: 'pass' }

  const lethalCandidates = candidates.filter((candidate) => candidate.eval.totalScore >= hp.player)
  if (lethalCandidates.length > 0) {
    lethalCandidates.sort((a, b) => a.eval.totalScore - b.eval.totalScore || a.cards.length - b.cards.length)
    return {
      action: 'play',
      cardIds: lethalCandidates[0].cards.map((card) => card.id),
    }
  }

  const nonExplosiveCandidates = candidates.filter((candidate) => candidate.eval.type !== 'bomb' && candidate.eval.type !== 'rocket')
  const filteredCandidates = nonExplosiveCandidates.length > 0 ? nonExplosiveCandidates : candidates

  const danger = hp.enemy / Math.max(1, hp.player)
  const isBehind = danger < 0.7

  const scored = filteredCandidates.map((candidate) => {
    const bombTax = candidate.eval.type === 'bomb' ? 260 : candidate.eval.type === 'rocket' ? 700 : 0
    const aggressionBonus = isBehind ? candidate.eval.totalScore * -0.15 : 0
    const score = candidate.eval.totalScore + candidate.cards.length * 8 + bombTax + aggressionBonus
    return { candidate, score }
  })

  scored.sort((a, b) => a.score - b.score)
  return {
    action: 'play',
    cardIds: scored[0].candidate.cards.map((card) => card.id),
  }
}
