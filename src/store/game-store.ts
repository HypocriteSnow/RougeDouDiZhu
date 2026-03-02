import { create } from 'zustand'

import { decideEnemyAction } from '@/engine/ai'
import { GameEngine } from '@/engine/game-engine'
import { evaluateHand } from '@/engine/rules'
import type { EngineResult, RunState } from '@/engine/types'
import { clearSnapshot, loadSnapshot, saveSnapshot } from '@/lib/persistence'

interface GameStore {
  engine: GameEngine
  runState: RunState
  selectedIds: string[]
  isEnemyThinking: boolean
  banner: string
  settingsOpen: boolean
  toggleCard: (id: string) => void
  clearSelection: () => void
  startNewRun: (seed?: string) => void
  playSelected: () => void
  pass: () => void
  enemyAct: () => void
  chooseReward: (rewardId: string) => void
  setEnemyThinking: (thinking: boolean) => void
  setVolume: (volume: number) => void
  setAnimationSpeed: (speed: 'normal' | 'fast') => void
  toggleSettings: (open?: boolean) => void
  clearProgress: () => void
}

function eventToBanner(result: EngineResult): string {
  const last = result.events[result.events.length - 1]
  return last?.message ?? ''
}

function persist(engine: GameEngine): void {
  saveSnapshot(engine.serialize())
}

function initEngine(): { engine: GameEngine; runState: RunState } {
  const engine = new GameEngine()
  const snapshot = loadSnapshot()
  if (snapshot) engine.restore(snapshot)
  return { engine, runState: engine.getState() }
}

const initial = initEngine()

export const useGameStore = create<GameStore>((set, get) => ({
  engine: initial.engine,
  runState: initial.runState,
  selectedIds: [],
  isEnemyThinking: false,
  banner: '准备开局。',
  settingsOpen: false,

  toggleCard: (id) => {
    const { runState, selectedIds } = get()
    if (runState.status !== 'in_battle') return
    if (runState.combat.actionTurn !== 'player') return

    const next = selectedIds.includes(id) ? selectedIds.filter((value) => value !== id) : [...selectedIds, id]
    set({ selectedIds: next })
  },

  clearSelection: () => {
    set({ selectedIds: [] })
  },

  startNewRun: (seed) => {
    const { engine } = get()
    const runState = engine.startRun(seed)
    persist(engine)
    set({ runState, selectedIds: [], banner: '新 Run 已开始。', isEnemyThinking: false })
  },

  playSelected: () => {
    const { selectedIds, engine } = get()
    if (selectedIds.length === 0) return

    const result = engine.playCards('player', selectedIds)
    persist(engine)

    set({
      runState: result.state,
      selectedIds: result.ok ? [] : selectedIds,
      banner: eventToBanner(result),
    })
  },

  pass: () => {
    const { engine } = get()
    const result = engine.pass('player')
    persist(engine)

    set({
      runState: result.state,
      selectedIds: [],
      banner: eventToBanner(result),
    })
  },

  enemyAct: () => {
    const { runState, engine } = get()
    if (runState.status !== 'in_battle') return
    if (runState.combat.actionTurn !== 'enemy') return

    const decision = decideEnemyAction({
      enemyHand: runState.enemy.hand,
      currentPlay: runState.combat.currentPlay,
      roundOwner: runState.combat.roundOwner,
      hp: { enemy: runState.enemy.hp, player: runState.player.hp },
      deckInfo: { handLimit: 10, enemyDeckLeft: runState.enemy.deck.length },
      randomValue: engine.consumeRandom(),
    })

    const result = decision.action === 'play' ? engine.playCards('enemy', decision.cardIds ?? []) : engine.pass('enemy')

    persist(engine)
    set({ runState: result.state, banner: eventToBanner(result), selectedIds: [] })
  },

  chooseReward: (rewardId) => {
    const { engine } = get()
    const result = engine.chooseReward(rewardId)
    persist(engine)

    set({
      runState: result.state,
      selectedIds: [],
      banner: eventToBanner(result),
    })
  },

  setEnemyThinking: (thinking) => {
    set({ isEnemyThinking: thinking })
  },

  setVolume: (volume) => {
    const { engine } = get()
    const runState = engine.updateSettings({ sfxVolume: volume })
    persist(engine)
    set({ runState })
  },

  setAnimationSpeed: (speed) => {
    const { engine } = get()
    const runState = engine.updateSettings({ animationSpeed: speed })
    persist(engine)
    set({ runState })
  },

  toggleSettings: (open) => {
    const current = get().settingsOpen
    set({ settingsOpen: open ?? !current })
  },

  clearProgress: () => {
    clearSnapshot()
    const engine = new GameEngine()
    const runState = engine.getState()
    persist(engine)
    set({
      engine,
      runState,
      selectedIds: [],
      banner: '已清档并重新开始。',
      isEnemyThinking: false,
    })
  },
}))

export function useSelectedHandEval() {
  const runState = useGameStore((state) => state.runState)
  const selectedIds = useGameStore((state) => state.selectedIds)

  const selectedCards = runState.player.hand.filter((card) => selectedIds.includes(card.id))
  return evaluateHand(selectedCards)
}
