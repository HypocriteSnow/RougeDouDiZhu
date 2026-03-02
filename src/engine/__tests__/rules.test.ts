import { describe, expect, it } from 'vitest'

import { getChipValue, getRankWeight } from '@/engine/cards'
import { canBeat, evaluateHand } from '@/engine/rules'
import type { Card, Rank } from '@/engine/types'

function card(id: string, rank: Rank, suit: Card['suit'] = 'S'): Card {
  return {
    id,
    rank,
    suit,
    weight: getRankWeight(rank),
    chips: getChipValue(rank),
  }
}

describe('evaluateHand', () => {
  it('识别顺子和连对', () => {
    const straight = evaluateHand([card('1', '6'), card('2', '7'), card('3', '8'), card('4', '9'), card('5', '10')])
    const consecutivePairs = evaluateHand([
      card('6', '4', 'S'),
      card('7', '4', 'H'),
      card('8', '5', 'S'),
      card('9', '5', 'H'),
      card('10', '6', 'S'),
      card('11', '6', 'H'),
    ])

    expect(straight?.type).toBe('straight')
    expect(straight?.signature).toBe('straight:5')

    expect(consecutivePairs?.type).toBe('consecutive_pairs')
    expect(consecutivePairs?.signature).toBe('consecutive_pairs:6')
  })

  it('识别飞机带单', () => {
    const airplane = evaluateHand([
      card('1', '4', 'S'),
      card('2', '4', 'H'),
      card('3', '4', 'C'),
      card('4', '5', 'S'),
      card('5', '5', 'H'),
      card('6', '5', 'C'),
      card('7', '9', 'S'),
      card('8', 'J', 'H'),
    ])

    expect(airplane?.type).toBe('airplane')
    expect(airplane?.signature).toBe('airplane:2:single')
    expect(airplane?.wing).toBe('single')
  })
})

describe('canBeat', () => {
  it('炸弹可以压制普通牌，王炸可以压制炸弹', () => {
    const pairA = evaluateHand([card('1', 'A'), card('2', 'A', 'H')])
    const bomb4 = evaluateHand([card('3', '4'), card('4', '4', 'H'), card('5', '4', 'C'), card('6', '4', 'D')])
    const rocket = evaluateHand([card('7', 'BJ', 'J'), card('8', 'RJ', 'J')])

    expect(pairA && bomb4 ? canBeat(bomb4, pairA) : false).toBe(true)
    expect(rocket && bomb4 ? canBeat(rocket, bomb4) : false).toBe(true)
  })
})
