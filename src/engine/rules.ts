import { HAND_STATS } from '@/engine/constants'
import type { Card, HandEval } from '@/engine/types'

interface RankGroup {
  rank: string
  count: number
  weight: number
}

function buildEval(type: HandEval['type'], cards: Card[], value: number, signature: string, extra?: Partial<HandEval>): HandEval {
  const stats = HAND_STATS[type]
  const cardChips = cards.reduce((acc, card) => acc + card.chips, 0)
  return {
    type,
    name: stats.name,
    value,
    length: cards.length,
    baseChips: stats.baseChips,
    cardChips,
    mult: stats.mult,
    totalScore: Math.floor((stats.baseChips + cardChips) * stats.mult),
    signature,
    ...extra,
  }
}

function buildGroups(cards: Card[]): RankGroup[] {
  const counts = new Map<string, { count: number; weight: number }>()
  for (const card of cards) {
    const prev = counts.get(card.rank)
    if (prev) counts.set(card.rank, { count: prev.count + 1, weight: card.weight })
    else counts.set(card.rank, { count: 1, weight: card.weight })
  }

  return [...counts.entries()]
    .map(([rank, value]) => ({ rank, count: value.count, weight: value.weight }))
    .sort((a, b) => b.count - a.count || b.weight - a.weight)
}

function isConsecutive(weights: number[]): boolean {
  for (let i = 1; i < weights.length; i += 1) {
    if (weights[i] - weights[i - 1] !== 1) return false
  }
  return true
}

function detectAirplane(cards: Card[], groups: RankGroup[]): HandEval | null {
  const tripleCandidates = groups
    .filter((group) => group.count >= 3 && group.weight <= 14)
    .map((group) => group.weight)
    .sort((a, b) => a - b)

  if (tripleCandidates.length < 2) return null

  const countsByWeight = new Map<number, number>()
  for (const group of groups) countsByWeight.set(group.weight, group.count)

  const maybeBuild = (chain: number[]): HandEval | null => {
    const working = new Map(countsByWeight)
    for (const weight of chain) {
      const current = working.get(weight) ?? 0
      if (current < 3) return null
      working.set(weight, current - 3)
    }

    const remaining = [...working.values()].filter((count) => count > 0)
    const remainingTotal = remaining.reduce((acc, count) => acc + count, 0)
    const chainLength = chain.length
    const highest = chain[chain.length - 1]

    if (remainingTotal === 0 && cards.length === chainLength * 3) {
      return buildEval('airplane', cards, highest, `airplane:${chainLength}:none`, {
        chainLength,
        wing: 'none',
      })
    }

    if (remainingTotal === chainLength && cards.length === chainLength * 4 && remaining.every((count) => count === 1)) {
      return buildEval('airplane', cards, highest, `airplane:${chainLength}:single`, {
        chainLength,
        wing: 'single',
      })
    }

    if (
      remainingTotal === chainLength * 2 &&
      cards.length === chainLength * 5 &&
      remaining.every((count) => count === 2)
    ) {
      return buildEval('airplane', cards, highest, `airplane:${chainLength}:pair`, {
        chainLength,
        wing: 'pair',
      })
    }

    return null
  }

  for (let start = 0; start < tripleCandidates.length - 1; start += 1) {
    for (let end = start + 1; end < tripleCandidates.length; end += 1) {
      const chain = tripleCandidates.slice(start, end + 1)
      if (!isConsecutive(chain)) break
      const evalResult = maybeBuild(chain)
      if (evalResult) return evalResult
    }
  }

  return null
}

export function evaluateHand(cards: Card[]): HandEval | null {
  if (cards.length === 0) return null

  const sorted = [...cards].sort((a, b) => a.weight - b.weight)
  const len = sorted.length
  const groups = buildGroups(sorted)

  if (len === 2 && sorted[0].weight === 16 && sorted[1].weight === 17) {
    return buildEval('rocket', cards, 17, 'rocket')
  }

  if (len === 4 && groups[0]?.count === 4) {
    return buildEval('bomb', cards, groups[0].weight, 'bomb')
  }

  if (len === 1) return buildEval('single', cards, groups[0].weight, 'single')
  if (len === 2 && groups[0].count === 2) return buildEval('pair', cards, groups[0].weight, 'pair')
  if (len === 3 && groups[0].count === 3) return buildEval('triple', cards, groups[0].weight, 'triple')
  if (len === 4 && groups[0].count === 3) return buildEval('three_one', cards, groups[0].weight, 'three_one')
  if (len === 5 && groups[0].count === 3 && groups[1]?.count === 2) {
    return buildEval('three_pair', cards, groups[0].weight, 'three_pair')
  }

  if (len >= 5 && groups.length === len && groups[0].count === 1 && sorted[len - 1].weight <= 14) {
    const weights = sorted.map((card) => card.weight)
    if (isConsecutive(weights)) {
      return buildEval('straight', cards, weights[weights.length - 1], `straight:${len}`)
    }
  }

  if (len >= 6 && len % 2 === 0 && groups.length === len / 2 && groups.every((group) => group.count === 2)) {
    const weights = groups
      .map((group) => group.weight)
      .sort((a, b) => a - b)
    if (weights[weights.length - 1] <= 14 && isConsecutive(weights)) {
      return buildEval('consecutive_pairs', cards, weights[weights.length - 1], `consecutive_pairs:${len}`)
    }
  }

  if (len === 6 && groups[0].count === 4) {
    return buildEval('four_two', cards, groups[0].weight, 'four_two:6')
  }

  if (len === 8 && groups[0].count === 4 && groups.length === 3 && groups[1].count === 2 && groups[2].count === 2) {
    return buildEval('four_two', cards, groups[0].weight, 'four_two:8')
  }

  return detectAirplane(cards, groups)
}

export function canBeat(playEval: HandEval, targetEval: HandEval): boolean {
  if (playEval.type === 'rocket') return true
  if (targetEval.type === 'rocket') return false

  if (playEval.type === 'bomb') {
    if (targetEval.type === 'bomb') return playEval.value > targetEval.value
    return true
  }

  if (targetEval.type === 'bomb') return false

  if (playEval.type !== targetEval.type) return false
  if (playEval.signature !== targetEval.signature) return false

  return playEval.value > targetEval.value
}

export function getValidPlays(handCards: Card[], targetEval?: HandEval): Array<{ cards: Card[]; eval: HandEval }> {
  const validPlays: Array<{ cards: Card[]; eval: HandEval }> = []
  const n = handCards.length

  for (let mask = 1; mask < 1 << n; mask += 1) {
    const combo: Card[] = []
    for (let i = 0; i < n; i += 1) {
      if (mask & (1 << i)) combo.push(handCards[i])
    }

    const evaluation = evaluateHand(combo)
    if (!evaluation) continue
    if (targetEval && !canBeat(evaluation, targetEval)) continue

    validPlays.push({ cards: combo, eval: evaluation })
  }

  return validPlays
}
