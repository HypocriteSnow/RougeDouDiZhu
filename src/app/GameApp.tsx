import { useEffect, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import {
  Bot,
  ChevronDown,
  ChevronUp,
  CircleAlert,
  Flame,
  Gift,
  HeartPulse,
  History,
  RefreshCcw,
  Settings2,
  Shield,
  Skull,
  Sparkles,
  Trophy,
  XCircle,
} from 'lucide-react'

import { canBeat } from '@/engine/rules'
import { useGameStore, useSelectedHandEval } from '@/store/game-store'
import { CardView } from '@/ui/components/CardView'

const RUN_STATUS_LABEL: Record<'in_battle' | 'reward' | 'won' | 'lost', string> = {
  in_battle: '战斗中',
  reward: '奖励选择',
  won: '胜利',
  lost: '失败',
}

function SectionLabel({ children }: { children: string }) {
  return <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">{children}</p>
}

function HpBar({ hp, maxHp, tint }: { hp: number; maxHp: number; tint: 'blue' | 'yellow' }) {
  const ratio = Math.max(0, Math.min(100, (hp / Math.max(1, maxHp)) * 100))

  return (
    <div className="w-full">
      <div className="mb-1.5 flex items-center justify-between text-xs text-neutral-400">
        <SectionLabel>HP</SectionLabel>
        <span className="font-semibold text-neutral-200">
          {hp} / {maxHp}
        </span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full border border-neutral-700 bg-neutral-800">
        <div
          className={clsx(
            'h-full transition-all duration-300',
            tint === 'blue'
              ? 'bg-blue-500 shadow-[0_0_16px_rgba(59,130,246,0.55)]'
              : 'bg-yellow-300 shadow-[0_0_16px_rgba(253,224,71,0.5)]',
          )}
          style={{ width: `${ratio}%` }}
        />
      </div>
    </div>
  )
}

function ResourceStats({ hand, deck, discard }: { hand: number; deck: number; discard: number }) {
  return (
    <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-neutral-300">
      <div className="rounded-lg border border-neutral-700 bg-neutral-900/80 px-2 py-1.5">
        <SectionLabel>Hand</SectionLabel>
        <p className="mt-0.5 text-sm font-semibold text-neutral-100">{hand}</p>
      </div>
      <div className="rounded-lg border border-neutral-700 bg-neutral-900/80 px-2 py-1.5">
        <SectionLabel>Deck</SectionLabel>
        <p className="mt-0.5 text-sm font-semibold text-neutral-100">{deck}</p>
      </div>
      <div className="rounded-lg border border-neutral-700 bg-neutral-900/80 px-2 py-1.5">
        <SectionLabel>Discard</SectionLabel>
        <p className="mt-0.5 text-sm font-semibold text-neutral-100">{discard}</p>
      </div>
    </div>
  )
}

function RewardPanel() {
  const runState = useGameStore((state) => state.runState)
  const chooseReward = useGameStore((state) => state.chooseReward)

  return (
    <div className="rounded-xl border border-neutral-700 bg-neutral-900/80 p-5 shadow-xl">
      <div className="flex items-center gap-2">
        <Gift className="h-5 w-5 text-blue-400" />
        <h2 className="text-xl font-semibold text-neutral-100">战斗奖励</h2>
      </div>
      <p className="mt-2 text-sm text-neutral-400">选择一个增益后进入下一战。</p>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {runState.pendingRewards.map((reward) => (
          <button
            key={reward.id}
            type="button"
            onClick={() => chooseReward(reward.id)}
            className="rounded-xl border border-neutral-700 bg-neutral-800/80 p-4 text-left transition-all duration-200 hover:border-blue-500 hover:bg-neutral-700/80 hover:shadow-xl"
          >
            <div className="text-sm font-semibold uppercase tracking-wider text-neutral-400">Reward</div>
            <div className="mt-1 text-lg font-semibold text-blue-400">{reward.title}</div>
            <p className="mt-2 text-sm text-neutral-300">{reward.description}</p>
          </button>
        ))}
      </div>
    </div>
  )
}

function EndOverlay() {
  const runState = useGameStore((state) => state.runState)
  const startNewRun = useGameStore((state) => state.startNewRun)

  if (runState.status !== 'won' && runState.status !== 'lost') return null

  const won = runState.status === 'won'

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/75 px-4 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-xl border border-neutral-700 bg-neutral-900/95 p-6 text-center shadow-xl">
        <div
          className={clsx(
            'mx-auto flex h-14 w-14 items-center justify-center rounded-xl border',
            won ? 'border-blue-500/70 bg-blue-500/15' : 'border-yellow-300/70 bg-yellow-300/10',
          )}
        >
          {won ? <Trophy className="h-7 w-7 text-blue-400" /> : <XCircle className="h-7 w-7 text-yellow-300" />}
        </div>

        <h2 className={clsx('mt-3 text-3xl font-bold', won ? 'text-blue-400' : 'text-yellow-300')}>
          {won ? 'Run 胜利' : 'Run 失败'}
        </h2>
        <p className="mt-2 text-neutral-300">{won ? '你完成了本次短流程爬塔。' : '血量归零，下一局请重整节奏。'}</p>

        <div className="mt-5 grid gap-2 text-sm text-neutral-300 md:grid-cols-3">
          <div className="rounded-lg border border-neutral-700 bg-neutral-800/70 p-2">
            <SectionLabel>战斗胜场</SectionLabel>
            <p className="mt-1 text-xl font-semibold text-neutral-100">{runState.stats.battlesWon}</p>
          </div>
          <div className="rounded-lg border border-neutral-700 bg-neutral-800/70 p-2">
            <SectionLabel>总造成伤害</SectionLabel>
            <p className="mt-1 text-xl font-semibold text-neutral-100">{runState.stats.totalDamageDealt}</p>
          </div>
          <div className="rounded-lg border border-neutral-700 bg-neutral-800/70 p-2">
            <SectionLabel>总承受伤害</SectionLabel>
            <p className="mt-1 text-xl font-semibold text-neutral-100">{runState.stats.totalDamageTaken}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => startNewRun()}
          className="mt-6 inline-flex items-center gap-2 rounded-lg border border-blue-500 bg-blue-500 px-6 py-2.5 font-semibold text-white shadow-xl transition-all duration-200 hover:scale-105 hover:brightness-110"
        >
          <RefreshCcw className="h-4 w-4" />
          开始新 Run
        </button>
      </div>
    </div>
  )
}

function SettingsPanel() {
  const runState = useGameStore((state) => state.runState)
  const settingsOpen = useGameStore((state) => state.settingsOpen)
  const setVolume = useGameStore((state) => state.setVolume)
  const setAnimationSpeed = useGameStore((state) => state.setAnimationSpeed)
  const toggleSettings = useGameStore((state) => state.toggleSettings)
  const clearProgress = useGameStore((state) => state.clearProgress)

  if (!settingsOpen) return null

  return (
    <div className="absolute right-4 top-16 z-30 w-80 rounded-xl border border-neutral-700 bg-neutral-900/95 p-4 shadow-xl">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-blue-400" />
          <h3 className="text-lg font-semibold text-neutral-100">设置</h3>
        </div>
        <button
          type="button"
          onClick={() => toggleSettings(false)}
          className="rounded-lg border border-neutral-700 bg-neutral-800 px-2.5 py-1 text-xs text-neutral-300 transition-all duration-200 hover:border-neutral-500 hover:bg-neutral-700"
        >
          关闭
        </button>
      </div>

      <label className="mb-4 block text-sm text-neutral-300">
        <SectionLabel>音量</SectionLabel>
        <div className="mt-1">{(runState.settings.sfxVolume * 100).toFixed(0)}%</div>
        <input
          className="mt-2 w-full accent-blue-500"
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={runState.settings.sfxVolume}
          onChange={(event) => setVolume(Number(event.target.value))}
        />
      </label>

      <div className="mb-4 text-sm text-neutral-300">
        <SectionLabel>动画速度</SectionLabel>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setAnimationSpeed('normal')}
            className={clsx(
              'rounded-lg border px-3 py-2 transition-all duration-200',
              runState.settings.animationSpeed === 'normal'
                ? 'border-blue-500 bg-blue-500 text-white'
                : 'border-neutral-700 bg-neutral-800 text-neutral-200 hover:border-neutral-500 hover:bg-neutral-700',
            )}
          >
            标准
          </button>
          <button
            type="button"
            onClick={() => setAnimationSpeed('fast')}
            className={clsx(
              'rounded-lg border px-3 py-2 transition-all duration-200',
              runState.settings.animationSpeed === 'fast'
                ? 'border-blue-500 bg-blue-500 text-white'
                : 'border-neutral-700 bg-neutral-800 text-neutral-200 hover:border-neutral-500 hover:bg-neutral-700',
            )}
          >
            快速
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={clearProgress}
        className="w-full rounded-lg border border-yellow-300/70 bg-yellow-300/10 px-3 py-2 text-sm font-semibold text-yellow-300 transition-all duration-200 hover:bg-yellow-300/20"
      >
        清档并重开
      </button>
    </div>
  )
}

function BattleLogPanel({ logs }: { logs: string[] }) {
  const [logExpanded, setLogExpanded] = useState(false)
  const collapsedLogs = logs.slice(-3)
  const visibleLogs = logExpanded ? logs : collapsedLogs
  const hiddenLogCount = Math.max(0, logs.length - collapsedLogs.length)

  return (
    <div className="rounded-xl border border-neutral-700 bg-neutral-950/45 p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-blue-400" />
          <SectionLabel>Battle Log</SectionLabel>
        </div>
        {logs.length > 3 && (
          <button
            type="button"
            onClick={() => setLogExpanded((open) => !open)}
            className="inline-flex items-center gap-1 rounded-lg border border-neutral-700 bg-neutral-800 px-2 py-1 text-xs text-neutral-300 transition-all duration-200 hover:border-blue-500 hover:bg-neutral-700"
          >
            {logExpanded ? '收起' : '展开'}
            {logExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        )}
      </div>
      <div className="max-h-40 space-y-1 overflow-y-auto pr-1 text-sm text-neutral-300">
        {visibleLogs.length > 0 ? (
          visibleLogs.map((line, index) => (
            <p key={`${line}-${index}`} className="rounded border border-neutral-700/70 bg-neutral-900/70 px-2 py-1.5">
              {line}
            </p>
          ))
        ) : (
          <p className="rounded border border-neutral-700/70 bg-neutral-900/70 px-2 py-1.5 text-neutral-500">暂无日志。</p>
        )}
      </div>
      {!logExpanded && hiddenLogCount > 0 && (
        <p className="mt-2 text-xs text-neutral-500">还有 {hiddenLogCount} 条历史记录，点击展开查看。</p>
      )}
    </div>
  )
}

export default function GameApp() {
  const runState = useGameStore((state) => state.runState)
  const selectedIds = useGameStore((state) => state.selectedIds)
  const banner = useGameStore((state) => state.banner)
  const isEnemyThinking = useGameStore((state) => state.isEnemyThinking)

  const toggleCard = useGameStore((state) => state.toggleCard)
  const playSelected = useGameStore((state) => state.playSelected)
  const pass = useGameStore((state) => state.pass)
  const enemyAct = useGameStore((state) => state.enemyAct)
  const setEnemyThinking = useGameStore((state) => state.setEnemyThinking)
  const startNewRun = useGameStore((state) => state.startNewRun)
  const toggleSettings = useGameStore((state) => state.toggleSettings)

  const selectedEval = useSelectedHandEval()
  const currentEval = runState.combat.currentPlay?.eval ?? null
  const enemyThinkingRef = useRef(isEnemyThinking)

  const canPlayerPlay = useMemo(() => {
    if (runState.status !== 'in_battle') return false
    if (runState.combat.actionTurn !== 'player') return false
    if (!selectedEval) return false
    if (!currentEval) return true
    return canBeat(selectedEval, currentEval)
  }, [runState.status, runState.combat.actionTurn, selectedEval, currentEval])

  const canPlayerPass =
    runState.status === 'in_battle' && runState.combat.actionTurn === 'player' && runState.combat.currentPlay !== null

  useEffect(() => {
    enemyThinkingRef.current = isEnemyThinking
  }, [isEnemyThinking])

  useEffect(() => {
    if (runState.status !== 'in_battle') return
    if (runState.combat.actionTurn !== 'enemy') return
    if (enemyThinkingRef.current) return

    setEnemyThinking(true)
    const delay = runState.settings.animationSpeed === 'fast' ? 450 : 900
    const timer = window.setTimeout(() => {
      enemyAct()
      setEnemyThinking(false)
    }, delay)

    return () => {
      window.clearTimeout(timer)
    }
  }, [
    runState.status,
    runState.combat.actionTurn,
    runState.settings.animationSpeed,
    enemyAct,
    setEnemyThinking,
  ])

  return (
    <div className="relative min-h-screen bg-neutral-950 text-neutral-200">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_0%,rgba(59,130,246,0.16),transparent_42%),radial-gradient(circle_at_85%_100%,rgba(253,224,71,0.09),transparent_40%)]" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 pb-6 pt-5 md:px-6">
        <header className="mb-4 rounded-xl border border-neutral-700 bg-neutral-900/80 p-4 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <SectionLabel>Run Status</SectionLabel>
              <h1 className="text-2xl font-semibold text-neutral-100">杀戮小丑：斗地主死斗版</h1>
              <p className="mt-1 text-sm text-neutral-400">
                Run {runState.battleIndex}/{runState.totalBattles} · 当前状态：{RUN_STATUS_LABEL[runState.status]}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => startNewRun()}
                className="inline-flex items-center gap-2 rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-2 text-sm text-neutral-200 transition-all duration-200 hover:border-blue-500 hover:bg-neutral-700"
              >
                <RefreshCcw className="h-4 w-4" />
                新 Run
              </button>
              <button
                type="button"
                onClick={() => toggleSettings()}
                className="inline-flex items-center gap-2 rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-2 text-sm text-neutral-200 transition-all duration-200 hover:border-blue-500 hover:bg-neutral-700"
              >
                <Settings2 className="h-4 w-4" />
                设置
              </button>
            </div>
          </div>
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-neutral-700 bg-neutral-950/70 px-3 py-2 text-sm text-neutral-300">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-yellow-300" />
            <span>{banner}</span>
          </div>
        </header>

        <SettingsPanel />

        {runState.status === 'reward' ? (
          <RewardPanel />
        ) : (
          <section className="overflow-hidden rounded-xl border border-neutral-700 bg-neutral-900/80 shadow-xl">
            <div className="grid gap-4 border-b border-neutral-700 p-4 xl:grid-cols-[1.6fr_1fr]">
              <div className="rounded-xl border border-neutral-700 bg-neutral-950/45 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg border border-neutral-700 bg-neutral-800 p-2">
                      <Skull className="h-5 w-5 text-yellow-300" />
                    </div>
                    <div>
                      <SectionLabel>Enemy</SectionLabel>
                      <h2 className="text-xl font-semibold text-neutral-100">{runState.enemy.name}</h2>
                    </div>
                  </div>
                  <span
                    className={clsx(
                      'rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wider',
                      runState.combat.roundOwner === 'enemy'
                        ? 'border-yellow-300/80 bg-yellow-300/10 text-yellow-300'
                        : 'border-neutral-600 text-neutral-400',
                    )}
                  >
                    {runState.combat.roundOwner === 'enemy' ? '敌方先手' : '敌方待机'}
                  </span>
                </div>

                <div className="mt-3">
                  <HpBar hp={runState.enemy.hp} maxHp={runState.enemy.maxHp} tint="yellow" />
                </div>
                <ResourceStats
                  hand={runState.enemy.hand.length}
                  deck={runState.enemy.deck.length}
                  discard={runState.enemy.discard.length}
                />
              </div>

              <div className="rounded-xl border border-neutral-700 bg-neutral-950/45 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg border border-neutral-700 bg-neutral-800 p-2">
                      <Shield className="h-5 w-5 text-blue-400" />
                    </div>
                    <div>
                      <SectionLabel>Player</SectionLabel>
                      <h2 className="text-xl font-semibold text-neutral-100">你</h2>
                    </div>
                  </div>
                  <span
                    className={clsx(
                      'rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wider',
                      runState.combat.actionTurn === 'player'
                        ? 'border-blue-500/80 bg-blue-500/10 text-blue-400'
                        : 'border-neutral-600 text-neutral-400',
                    )}
                  >
                    {runState.combat.actionTurn === 'player' ? '你的回合' : '等待中'}
                  </span>
                </div>

                <div className="mt-3">
                  <HpBar hp={runState.player.hp} maxHp={runState.player.maxHp} tint="blue" />
                </div>
                <ResourceStats
                  hand={runState.player.hand.length}
                  deck={runState.player.deck.length}
                  discard={runState.player.discard.length}
                />

                <div className="mt-3 flex items-center gap-2 rounded-lg border border-neutral-700 bg-neutral-900/70 px-2.5 py-2 text-xs text-neutral-300">
                  <Flame className="h-4 w-4 text-yellow-300" />
                  <span>
                    伤害倍率 <span className="font-semibold text-yellow-300">x{runState.buffs.playerDamageMult.toFixed(2)}</span>
                  </span>
                </div>
              </div>
            </div>

            <div className="grid gap-4 border-b border-neutral-700 p-4 xl:grid-cols-[1.6fr_1fr]">
              <div className="rounded-xl border border-neutral-700 bg-neutral-950/45 p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <SectionLabel>Card Table</SectionLabel>
                    <h3 className="text-base font-semibold text-neutral-100">当前出牌</h3>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-neutral-300">
                    {isEnemyThinking && runState.combat.actionTurn === 'enemy' ? (
                      <Bot className="h-4 w-4 animate-pulse text-blue-400" />
                    ) : (
                      <HeartPulse className="h-4 w-4 text-blue-400" />
                    )}
                    <span>行动方：{runState.combat.actionTurn === 'player' ? '你' : runState.enemy.name}</span>
                  </div>
                </div>

                {runState.combat.currentPlay ? (
                  <div className="rounded-xl border border-neutral-700 bg-neutral-900/70 p-3">
                    <p className="text-sm text-neutral-300">
                      最近出牌：
                      <span className="font-semibold text-neutral-100">
                        {runState.combat.currentPlay.by === 'player' ? '你' : runState.enemy.name}
                      </span>
                      · {runState.combat.currentPlay.eval.name} · 潜在伤害{' '}
                      <span className="font-semibold text-yellow-300">{runState.combat.currentPlay.eval.totalScore}</span>
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {runState.combat.currentPlay.cards.map((card) => (
                        <CardView key={card.id} card={card} small />
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 rounded-xl border border-neutral-700 bg-neutral-900/70 p-3 text-sm text-neutral-300">
                    <CircleAlert className="h-4 w-4 shrink-0 text-yellow-300" />
                    当前牌桌为空，{runState.combat.roundOwner === 'player' ? '你先手发起。' : '敌方先手发起。'}
                  </div>
                )}
              </div>

              <BattleLogPanel key={`${runState.battleIndex}-${runState.status}`} logs={runState.combat.log} />
            </div>

            <div className="p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="rounded-xl border border-neutral-700 bg-neutral-950/45 px-3 py-2 text-sm text-neutral-300">
                  <SectionLabel>Selected Hand</SectionLabel>
                  <div className="mt-1">
                    {selectedEval ? (
                      <>
                        已选牌型 <span className="font-semibold text-blue-400">{selectedEval.name}</span> · 预估分数{' '}
                        <span className="font-semibold text-yellow-300">{selectedEval.totalScore}</span>
                      </>
                    ) : selectedIds.length > 0 ? (
                      <span className="text-yellow-300">当前选择不是合法牌型。</span>
                    ) : (
                      <span>请选择手牌进行出牌。</span>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={pass}
                    disabled={!canPlayerPass}
                    className="rounded-lg border border-neutral-600 bg-neutral-800 px-4 py-2 text-sm text-neutral-100 transition-all duration-200 enabled:hover:border-neutral-400 enabled:hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    要不起
                  </button>
                  <button
                    type="button"
                    onClick={playSelected}
                    disabled={!canPlayerPlay}
                    className="rounded-lg border border-blue-500 bg-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-xl transition-all duration-200 enabled:hover:scale-105 enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    出牌
                  </button>
                </div>
              </div>

              <div className="mt-3 rounded-xl border border-neutral-700 bg-neutral-950/50 p-3">
                <SectionLabel>Your Hand</SectionLabel>
                <div className="mt-2 flex min-h-[170px] gap-2 overflow-x-auto pb-2">
                  {runState.player.hand.map((card) => (
                    <CardView
                      key={card.id}
                      card={card}
                      selected={selectedIds.includes(card.id)}
                      onClick={
                        runState.status === 'in_battle' && runState.combat.actionTurn === 'player'
                          ? () => toggleCard(card.id)
                          : undefined
                      }
                    />
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}
      </div>

      <EndOverlay />
    </div>
  )
}
