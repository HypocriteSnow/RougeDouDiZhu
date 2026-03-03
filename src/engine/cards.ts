import { BASE_RANKS, SUITS } from '@/engine/constants'
import { randomInt } from '@/engine/rng'
import type { Card, CharacterState, Rank, SuitId } from '@/engine/types'

export type HandSortMode = 'rank_desc' | 'suit_group'

const SUIT_PRIORITY: Record<SuitId, number> = {
  S: 0,
  C: 1,
  H: 2,
  D: 3,
  J: 4,
}

export function getChipValue(rank: Rank): number {
  if (['J', 'Q', 'K'].includes(rank)) return 10
  if (rank === 'A') return 15
  if (rank === '2') return 20
  if (rank === 'BJ') return 30
  if (rank === 'RJ') return 50
  return Number(rank)
}

export function getRankWeight(rank: Rank): number {
  if (rank === 'BJ') return 16
  if (rank === 'RJ') return 17
  if (rank === '2') return 15
  if (rank === 'A') return 14
  if (rank === 'K') return 13
  if (rank === 'Q') return 12
  if (rank === 'J') return 11
  return Number(rank)
}

export function createFullDeck(): Card[] {
  const deck: Card[] = []
  let id = 0

  for (const suit of SUITS) {
    for (const rank of BASE_RANKS) {
      deck.push({
        id: `c_${id}`,
        suit,
        rank,
        weight: getRankWeight(rank),
        chips: getChipValue(rank),
      })
      id += 1
    }
  }

  const jokerSuit: SuitId = 'J'
  deck.push({ id: `c_${id++}`, suit: jokerSuit, rank: 'BJ', weight: 16, chips: 30 })
  deck.push({ id: `c_${id++}`, suit: jokerSuit, rank: 'RJ', weight: 17, chips: 50 })
  return deck
}

export function shuffleCards(cards: Card[], rngState: number): { cards: Card[]; rngState: number } {
  const next = [...cards]
  let state = rngState

  for (let i = next.length - 1; i > 0; i -= 1) {
    const roll = randomInt(state, i + 1)
    state = roll.rngState
    const j = roll.value
    ;[next[i], next[j]] = [next[j], next[i]]
  }

  return { cards: next, rngState: state }
}

export function splitDeck(deck: Card[]): { playerDeck: Card[]; enemyDeck: Card[] } {
  return {
    playerDeck: deck.slice(0, 27),
    enemyDeck: deck.slice(27),
  }
}

export function removeCardsByIds(cards: Card[], ids: string[]): Card[] {
  const set = new Set(ids)
  return cards.filter((card) => !set.has(card.id))
}

export function pickCardsByIds(cards: Card[], ids: string[]): Card[] {
  const map = new Map(cards.map((card) => [card.id, card]))
  const picked: Card[] = []
  for (const id of ids) {
    const found = map.get(id)
    if (found) picked.push(found)
  }
  return picked
}

export function compareCardsByRankDesc(a: Card, b: Card): number {
  if (b.weight !== a.weight) return b.weight - a.weight
  if (a.suit !== b.suit) return SUIT_PRIORITY[a.suit] - SUIT_PRIORITY[b.suit]
  return a.id.localeCompare(b.id)
}

export function compareCardsBySuitGroup(a: Card, b: Card): number {
  if (a.suit !== b.suit) return SUIT_PRIORITY[a.suit] - SUIT_PRIORITY[b.suit]
  if (b.weight !== a.weight) return b.weight - a.weight
  return a.id.localeCompare(b.id)
}

export function sortCardsForDisplay(cards: Card[], mode: HandSortMode = 'rank_desc'): Card[] {
  const sorted = [...cards]
  sorted.sort(mode === 'suit_group' ? compareCardsBySuitGroup : compareCardsByRankDesc)
  return sorted
}

export function drawToLimit(
  character: CharacterState,
  handLimit: number,
  rngState: number,
): { character: CharacterState; rngState: number } {
  const hand = [...character.hand]
  let deck = [...character.deck]
  let discard = [...character.discard]
  let state = rngState

  while (hand.length < handLimit) {
    if (deck.length === 0) {
      if (discard.length === 0) break
      const reshuffle = shuffleCards(discard, state)
      deck = reshuffle.cards
      state = reshuffle.rngState
      discard = []
    }

    const card = deck.pop()
    if (!card) break
    hand.push(card)
  }

  return {
    character: {
      ...character,
      hand: sortCardsForDisplay(hand, 'rank_desc'),
      deck,
      discard,
    },
    rngState: state,
  }
}
