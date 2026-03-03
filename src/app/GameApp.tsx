import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import {
  CircleAlert,
  Flame,
  Gift,
  Heart,
  History,
  RefreshCcw,
  Settings2,
  ShieldAlert,
  Skull,
  Sparkles,
  Sword,
  Trophy,
  XCircle,
} from 'lucide-react'

import {
  HAND_LEVEL_MAX,
  HAND_TYPE_ORDER,
  RELIC_POOL,
  getLeveledHandStats,
} from '@/engine/constants'
import { sortCardsForDisplay, type HandSortMode } from '@/engine/cards'
import { canBeat } from '@/engine/rules'
import type { BattleNodeType, HandEval, RelicRarity, RewardChoice, RunStatus } from '@/engine/types'
import { useGameStore, useSelectedHandEval } from '@/store/game-store'
import { CardView } from '@/ui/components/CardView'

const RUN_STATUS_LABEL: Record<RunStatus, string> = {
  in_battle: '战斗中',
  reward: '奖励选择',
  won: '胜利',
  lost: '失败',
}

const NODE_TYPE_LABEL: Record<BattleNodeType, string> = {
  normal: '普通节点',
  elite: '精英节点',
  boss: 'Boss 节点',
  merchant_campfire: '营地节点',
}

const RELIC_RARITY_STYLE: Record<RelicRarity, { badge: string; card: string }> = {
  blue: {
    badge: 'border-sky-400/70 bg-sky-500/15 text-sky-200',
    card: 'border-sky-400/60 bg-sky-500/10',
  },
  purple: {
    badge: 'border-violet-400/70 bg-violet-500/15 text-violet-200',
    card: 'border-violet-400/60 bg-violet-500/10',
  },
  orange: {
    badge: 'border-amber-400/80 bg-amber-500/15 text-amber-200',
    card: 'border-amber-400/70 bg-amber-500/10',
  },
}

function SectionLabel({ children }: { children: string }) {
  return <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-200/75">{children}</p>
}

function HpBar({ hp, maxHp, tone }: { hp: number; maxHp: number; tone: 'enemy' | 'player' }) {
  const ratio = Math.max(0, Math.min(100, (hp / Math.max(1, maxHp)) * 100))

  return (
    <div className="w-full">
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className={clsx('inline-flex items-center gap-1', tone === 'enemy' ? 'text-rose-200' : 'text-sky-200')}>
          <Heart className="h-3.5 w-3.5" />
          {hp} / {maxHp}
        </span>
        <SectionLabel>HP</SectionLabel>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full border border-emerald-800 bg-emerald-950/90">
        <div
          className={clsx(
            'h-full transition-all duration-300',
            tone === 'enemy'
              ? 'bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.45)]'
              : 'bg-sky-500 shadow-[0_0_12px_rgba(14,165,233,0.55)]',
          )}
          style={{ width: `${ratio}%` }}
        />
      </div>
    </div>
  )
}

function ResourceStats({
  hand,
  deck,
  discard,
}: {
  hand: number
  deck: number
  discard: number
}) {
  return (
    <div className="flex gap-2 text-xs font-mono text-emerald-200">
      <div className="rounded-lg border border-emerald-800 bg-emerald-950/75 px-2 py-1">
        牌库 <span className="ml-1 text-base">{deck}</span>
      </div>
      <div className="rounded-lg border border-emerald-800 bg-emerald-950/75 px-2 py-1">
        手牌 <span className="ml-1 text-base text-amber-300">{hand}</span>
      </div>
      <div className="rounded-lg border border-emerald-800 bg-emerald-950/75 px-2 py-1">
        弃牌 <span className="ml-1 text-base">{discard}</span>
      </div>
    </div>
  )
}

function RewardChoiceCard({
  choice,
  onPick,
}: {
  choice: RewardChoice
  onPick: (choiceId: string) => void
}) {
  const runState = useGameStore((state) => state.runState)
  const relic = choice.type === 'relic_pick' ? RELIC_POOL.find((item) => item.id === choice.relicId) : null
  const rarityStyle = relic ? RELIC_RARITY_STYLE[relic.rarity] : null
  const handUpgradePreview =
    choice.type === 'hand_upgrade'
      ? (() => {
          const currentLevel = runState.handLevels[choice.handType]
          const targetLevel = Math.min(HAND_LEVEL_MAX, currentLevel + choice.deltaLevel)
          return {
            currentLevel,
            targetLevel,
            currentStats: getLeveledHandStats(choice.handType, currentLevel),
            targetStats: getLeveledHandStats(choice.handType, targetLevel),
          }
        })()
      : null

  return (
    <button
      type="button"
      onClick={() => onPick(choice.id)}
      className={clsx(
        'rounded-xl border p-4 text-left transition-all duration-200 hover:-translate-y-0.5',
        rarityStyle
          ? `${rarityStyle.card} hover:border-amber-300`
          : 'border-emerald-700 bg-emerald-900/70 hover:border-amber-300 hover:bg-emerald-900',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="text-lg font-semibold text-amber-300">{choice.title}</div>
        {relic && (
          <span className={clsx('rounded px-2 py-0.5 text-[11px] font-semibold', RELIC_RARITY_STYLE[relic.rarity].badge)}>
            {relic.rarity === 'blue' ? '蓝' : relic.rarity === 'purple' ? '紫' : '橙'}
          </span>
        )}
      </div>
      <p className="mt-2 text-sm text-emerald-100/90">{choice.description}</p>

      {choice.type === 'hand_upgrade' && handUpgradePreview && (
        <div className="mt-2 space-y-1 text-xs text-emerald-200/80">
          <p>
            牌型成长：Lv {handUpgradePreview.currentLevel} {'->'} Lv {handUpgradePreview.targetLevel}
          </p>
          <p>
            底注 {handUpgradePreview.currentStats.baseChips} {'->'} {handUpgradePreview.targetStats.baseChips}，倍率 x
            {handUpgradePreview.currentStats.mult.toFixed(2)} {'->'} x{handUpgradePreview.targetStats.mult.toFixed(2)}
          </p>
        </div>
      )}
      {choice.type === 'hand_wildcard' && (
        <p className="mt-2 text-xs text-emerald-200/80">通配成长：随机未满级牌型 +{choice.deltaLevel}</p>
      )}
      {choice.type === 'xp_bonus' && <p className="mt-2 text-xs text-emerald-200/80">立即获得 +{choice.xpGain} 经验</p>}
      {choice.type === 'relic_pick' && relic && <p className="mt-2 text-xs text-emerald-200/80">开发中占位藏品</p>}
    </button>
  )
}

function RewardFlowPanel() {
  const runState = useGameStore((state) => state.runState)
  const chooseReward = useGameStore((state) => state.chooseReward)

  const offer = runState.activeRewardOffer

  if (!offer) {
    return (
      <div className="mx-auto w-full max-w-5xl rounded-2xl border-2 border-emerald-800 bg-emerald-950/85 p-6 text-center text-emerald-200">
        奖励队列为空，正在进入下一阶段。
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-5xl rounded-2xl border-2 border-emerald-800 bg-emerald-950/85 p-5 shadow-2xl md:p-6">
      <div className="flex items-center gap-2">
        <Gift className="h-5 w-5 text-amber-300" />
        <h2 className="text-2xl font-bold text-emerald-100">{offer.title}</h2>
      </div>
      <p className="mt-1 text-sm text-emerald-200/85">{offer.subtitle}</p>
      <p className="mt-1 text-xs text-emerald-300/80">待结算步骤：当前 1 / 共 {runState.rewardQueue.length + 1} 步</p>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {offer.choices.map((choice) => (
          <RewardChoiceCard key={choice.id} choice={choice} onPick={chooseReward} />
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
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/80 px-4 backdrop-blur-md">
      <div className="w-full max-w-xl rounded-3xl border-4 border-emerald-800 bg-emerald-950/95 p-8 text-center shadow-2xl">
        <div
          className={clsx(
            'mx-auto flex h-14 w-14 items-center justify-center rounded-xl border',
            won ? 'border-amber-300/85 bg-amber-300/15' : 'border-rose-500/80 bg-rose-500/10',
          )}
        >
          {won ? <Trophy className="h-7 w-7 text-amber-300" /> : <XCircle className="h-7 w-7 text-rose-400" />}
        </div>

        <h2 className={clsx('mt-3 text-4xl font-black', won ? 'text-amber-300' : 'text-rose-400')}>
          {won ? '你赢了' : '你倒下了'}
        </h2>
        <p className="mt-2 text-emerald-100/90">{won ? '本次 Run 全部战斗已完成。' : '生命归零，本次 Run 结束。'}</p>

        <button
          type="button"
          onClick={() => startNewRun()}
          className="mt-6 inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-400 px-7 py-2.5 font-bold text-emerald-950 transition-all duration-200 hover:scale-105 hover:bg-amber-300"
        >
          <RefreshCcw className="h-4 w-4" />
          再来一局
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
    <div className="absolute right-4 top-[8.25rem] z-30 w-[19rem] rounded-xl border border-emerald-700 bg-emerald-950/95 p-4 shadow-2xl">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-amber-300" />
          <h3 className="text-lg font-semibold text-emerald-100">设置</h3>
        </div>
        <button
          type="button"
          onClick={() => toggleSettings(false)}
          className="rounded-lg border border-emerald-700 bg-emerald-900/60 px-2.5 py-1 text-xs text-emerald-100 transition-all duration-200 hover:border-amber-300"
        >
          关闭
        </button>
      </div>

      <label className="mb-4 block text-sm text-emerald-100">
        <SectionLabel>音量</SectionLabel>
        <div className="mt-1">{(runState.settings.sfxVolume * 100).toFixed(0)}%</div>
        <input
          className="mt-2 w-full accent-amber-400"
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={runState.settings.sfxVolume}
          onChange={(event) => setVolume(Number(event.target.value))}
        />
      </label>

      <div className="mb-4 text-sm text-emerald-100">
        <SectionLabel>动画速度</SectionLabel>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setAnimationSpeed('normal')}
            className={clsx(
              'rounded-lg border px-3 py-2 font-semibold transition-all duration-200',
              runState.settings.animationSpeed === 'normal'
                ? 'border-amber-300 bg-amber-400 text-emerald-950'
                : 'border-emerald-700 bg-emerald-900/70 text-emerald-100 hover:border-amber-300',
            )}
          >
            标准
          </button>
          <button
            type="button"
            onClick={() => setAnimationSpeed('fast')}
            className={clsx(
              'rounded-lg border px-3 py-2 font-semibold transition-all duration-200',
              runState.settings.animationSpeed === 'fast'
                ? 'border-amber-300 bg-amber-400 text-emerald-950'
                : 'border-emerald-700 bg-emerald-900/70 text-emerald-100 hover:border-amber-300',
            )}
          >
            快速
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={clearProgress}
        className="w-full rounded-lg border border-rose-500/70 bg-rose-500/10 px-3 py-2 text-sm font-semibold text-rose-300 transition-all duration-200 hover:bg-rose-500/20"
      >
        清档并重开
      </button>
    </div>
  )
}

function LogDrawer({
  open,
  logs,
  onClose,
}: {
  open: boolean
  logs: string[]
  onClose: () => void
}) {
  if (!open) return null

  return (
    <div className="absolute inset-0 z-30 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <aside
        className="ml-auto h-full w-full max-w-md border-l-2 border-emerald-700 bg-emerald-950/95 p-4"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-amber-300" />
            <h3 className="text-lg font-semibold text-emerald-100">战斗日志</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-emerald-700 bg-emerald-900/60 px-2.5 py-1 text-xs text-emerald-100 hover:border-amber-300"
          >
            关闭
          </button>
        </div>
        <div className="hide-scrollbar h-[calc(100%-3rem)] space-y-2 overflow-y-auto pr-1 text-sm text-emerald-100">
          {logs.map((line, index) => (
            <p key={`${line}-${index}`} className="rounded border border-emerald-800 bg-emerald-950/85 px-2 py-1.5">
              {line}
            </p>
          ))}
          {logs.length === 0 && <p className="text-emerald-200/65">暂无日志。</p>}
        </div>
      </aside>
    </div>
  )
}

function buildSettlementAnnouncementFromLog(line: string): string | null {
  const defenseSuccess = line.match(/^(.*?)\s*要不起。\s*(.*?)\s*防守成功。$/)
  if (defenseSuccess) {
    const [, passer, defender] = defenseSuccess
    return `${passer} 要不起！\n${defender} 防守成功，伤害被完全化解。`
  }

  const defenseFail = line.match(/^(.*?)\s*要不起，承受\s*(\d+)\s*点伤害。$/)
  if (defenseFail) {
    const [, passer, damage] = defenseFail
    return `${passer} 要不起，防守失败！\n本次受到 ${damage} 点伤害。`
  }

  return null
}

function buildTempoAnnouncementFromBanner(banner: string): string | null {
  const gainedLead = banner.match(/^(.*?)\s*夺得牌权。$/)
  if (gainedLead) {
    const actor = gainedLead[1]
    if (actor === '你') return '你夺得牌权！\n由你发起新的攻击。'
    return '敌人夺得牌权！\n敌人即将发起攻击。'
  }

  const comboLead = banner.match(/^(.*?)\s*连击成功。$/)
  if (comboLead) {
    const actor = comboLead[1]
    if (actor === '你') return '乘胜追击！\n继续由你发起攻击。'
    return '敌人连击！\n敌人继续发起攻击。'
  }

  return null
}

function projectedDamageForPlayer(evalResult: HandEval, mult: number, flat: number): number {
  return Math.floor(evalResult.totalScore * mult + flat)
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
  const trickScrollRef = useRef<HTMLDivElement | null>(null)
  const logLengthRef = useRef(runState.combat.log.length)
  const bannerRef = useRef(banner)
  const battleStartKeyRef = useRef<string>('')
  const announcementTimerRef = useRef<number | null>(null)
  const announcementQueueRef = useRef<Array<{ text: string; duration: number }>>([])
  const announcementActiveRef = useRef(false)
  const animationSpeedRef = useRef(runState.settings.animationSpeed)

  const [logOpen, setLogOpen] = useState(false)
  const [handSortMode, setHandSortMode] = useState<HandSortMode>('rank_desc')
  const [announcement, setAnnouncement] = useState('')

  const playNextAnnouncement = useCallback(() => {
    if (announcementActiveRef.current) return

    const runQueue = (): void => {
      const next = announcementQueueRef.current.shift()
      if (!next) return

      announcementActiveRef.current = true
      setAnnouncement(next.text)

      announcementTimerRef.current = window.setTimeout(() => {
        setAnnouncement('')
        announcementTimerRef.current = null
        announcementActiveRef.current = false
        runQueue()
      }, next.duration)
    }

    runQueue()
  }, [])

  const enqueueAnnouncement = useCallback(
    (text: string, duration?: number) => {
      if (!text) return
      const hold = duration ?? (animationSpeedRef.current === 'fast' ? 1000 : 1700)

      announcementQueueRef.current.push({ text, duration: hold })
      playNextAnnouncement()
    },
    [playNextAnnouncement],
  )

  const playerHandCards = useMemo(
    () => sortCardsForDisplay(runState.player.hand, handSortMode),
    [runState.player.hand, handSortMode],
  )

  const selectedProjectedDamage = selectedEval
    ? projectedDamageForPlayer(selectedEval, runState.buffs.playerDamageMult, runState.buffs.playerDamageFlat)
    : null

  const focusedHandType = selectedEval?.type ?? currentEval?.type ?? null
  const canPlayerPlay = useMemo(() => {
    if (announcement) return false
    if (runState.status !== 'in_battle') return false
    if (runState.combat.actionTurn !== 'player') return false
    if (!selectedEval) return false
    if (!currentEval) return true
    return canBeat(selectedEval, currentEval)
  }, [announcement, runState.status, runState.combat.actionTurn, selectedEval, currentEval])

  const canPlayerPass =
    !announcement &&
    runState.status === 'in_battle' &&
    runState.combat.actionTurn === 'player' &&
    runState.combat.currentPlay !== null

  useEffect(() => {
    enemyThinkingRef.current = isEnemyThinking
  }, [isEnemyThinking])

  useEffect(() => {
    animationSpeedRef.current = runState.settings.animationSpeed
  }, [runState.settings.animationSpeed])

  useEffect(() => {
    if (runState.status !== 'in_battle') return
    if (announcement) return
    if (runState.combat.actionTurn !== 'enemy') return
    if (enemyThinkingRef.current) return

    setEnemyThinking(true)
    const delay = runState.settings.animationSpeed === 'fast' ? 500 : 950
    const timer = window.setTimeout(() => {
      try {
        enemyAct()
      } catch (error) {
        console.error('Enemy action failed:', error)
      } finally {
        setEnemyThinking(false)
      }
    }, delay)

    return () => {
      window.clearTimeout(timer)
      setEnemyThinking(false)
    }
  }, [
    announcement,
    runState.status,
    runState.combat.actionTurn,
    runState.settings.animationSpeed,
    enemyAct,
    setEnemyThinking,
  ])

  useEffect(() => {
    if (!isEnemyThinking) return
    if (announcement) return
    if (runState.status !== 'in_battle') return
    if (runState.combat.actionTurn !== 'enemy') return

    const guardDelay = runState.settings.animationSpeed === 'fast' ? 1800 : 2600
    const guard = window.setTimeout(() => {
      if (!enemyThinkingRef.current) return
      setEnemyThinking(false)
    }, guardDelay)

    return () => {
      window.clearTimeout(guard)
    }
  }, [
    announcement,
    isEnemyThinking,
    runState.status,
    runState.combat.actionTurn,
    runState.settings.animationSpeed,
    setEnemyThinking,
  ])

  useEffect(
    () => () => {
      if (announcementTimerRef.current !== null) {
        window.clearTimeout(announcementTimerRef.current)
      }
      announcementQueueRef.current = []
      announcementActiveRef.current = false
    },
    [],
  )

  useEffect(() => {
    if (runState.status !== 'in_battle') {
      logLengthRef.current = runState.combat.log.length
      return
    }

    const prevLength = logLengthRef.current
    const currentLogs = runState.combat.log
    logLengthRef.current = currentLogs.length

    if (currentLogs.length <= prevLength) return

    const appended = currentLogs.slice(prevLength)
    const keyLine = appended.find((line) => line.includes('防守成功') || line.includes('承受'))
    if (!keyLine) return

    const text = buildSettlementAnnouncementFromLog(keyLine)
    if (text) enqueueAnnouncement(text)
  }, [runState.status, runState.combat.log, enqueueAnnouncement])

  useEffect(() => {
    if (banner === bannerRef.current) return
    bannerRef.current = banner

    const text = buildTempoAnnouncementFromBanner(banner)
    if (!text) return

    const timer = window.setTimeout(() => {
      enqueueAnnouncement(text, runState.settings.animationSpeed === 'fast' ? 900 : 1300)
    }, 0)

    return () => {
      window.clearTimeout(timer)
    }
  }, [banner, runState.settings.animationSpeed, enqueueAnnouncement])

  useEffect(() => {
    if (runState.status !== 'in_battle') return
    const nextKey = `${runState.battleIndex}:${runState.status}`
    if (battleStartKeyRef.current === nextKey) return

    battleStartKeyRef.current = nextKey
    const timer = window.setTimeout(() => {
      enqueueAnnouncement('战斗开始！\n由你先手出牌发起攻击', runState.settings.animationSpeed === 'fast' ? 900 : 1400)
    }, 0)

    return () => {
      window.clearTimeout(timer)
    }
  }, [runState.battleIndex, runState.status, runState.settings.animationSpeed, enqueueAnnouncement])

  useEffect(() => {
    const panel = trickScrollRef.current
    if (!panel) return
    panel.scrollTop = panel.scrollHeight
  }, [runState.combat.trickHistory.length, runState.battleIndex])

  const toggleSortMode = () => {
    setHandSortMode((prev) => (prev === 'rank_desc' ? 'suit_group' : 'rank_desc'))
  }

  const xpPercent = Math.max(0, Math.min(100, (runState.progress.xp / Math.max(1, runState.progress.xpToNext)) * 100))

  return (
    <div className="relative h-screen overflow-hidden text-white">
      <div className="absolute inset-0 bg-[#022c22]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_-8%,rgba(16,185,129,0.35),transparent_38%),radial-gradient(circle_at_90%_108%,rgba(14,116,144,0.2),transparent_42%),linear-gradient(180deg,rgba(2,44,34,0.05)_0%,rgba(1,32,25,0.65)_100%)]" />

      <div className="relative flex h-full min-h-0 flex-col overflow-hidden">
        <header
          className={clsx(
            'border-b-2 bg-emerald-950/55 px-4 py-3 shadow-md backdrop-blur-sm transition-colors',
            runState.combat.roundOwner === 'enemy' ? 'border-rose-500 bg-rose-950/20' : 'border-emerald-800',
          )}
        >
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div
                className={clsx(
                  'flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 bg-slate-900/90',
                  runState.combat.roundOwner === 'enemy'
                    ? 'border-rose-500 shadow-[0_0_15px_rgba(239,68,68,0.45)]'
                    : 'border-slate-600',
                )}
              >
                <Skull className="h-7 w-7 text-rose-400" />
              </div>
              <div className="w-full max-w-lg">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl font-bold text-rose-200">{runState.enemy.name}</h1>
                  {runState.combat.roundOwner === 'enemy' && (
                    <span className="animate-pulse rounded bg-rose-600 px-2 py-0.5 text-xs font-bold text-white">攻击回合</span>
                  )}
                  <span className="rounded border border-emerald-700 bg-emerald-900/70 px-2 py-0.5 text-xs text-emerald-100">
                    {NODE_TYPE_LABEL[runState.currentNodeType]}
                  </span>
                </div>
                <HpBar hp={runState.enemy.hp} maxHp={runState.enemy.maxHp} tone="enemy" />
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-emerald-100">
                  <span className="rounded border border-amber-400/60 bg-amber-400/10 px-2 py-0.5 text-amber-200">
                    Lv {runState.progress.level}
                  </span>
                  <span className="rounded border border-emerald-700 bg-emerald-900/70 px-2 py-0.5">
                    XP {runState.progress.xp}/{runState.progress.xpToNext}
                  </span>
                  <span className="rounded border border-emerald-700 bg-emerald-900/70 px-2 py-0.5">
                    Run {runState.battleIndex}/{runState.totalBattles}
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full border border-emerald-800 bg-emerald-950/90">
                  <div
                    className="h-full bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.35)] transition-all duration-300"
                    style={{ width: `${xpPercent}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <ResourceStats
                hand={runState.enemy.hand.length}
                deck={runState.enemy.deck.length}
                discard={runState.enemy.discard.length}
              />
              <button
                type="button"
                onClick={() => setLogOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-700 bg-emerald-900/70 px-3 py-2 text-sm font-semibold text-emerald-100 transition-all duration-200 hover:border-amber-300"
              >
                <History className="h-4 w-4" />
                日志
              </button>
              <button
                type="button"
                onClick={() => startNewRun()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-700 bg-emerald-900/70 px-3 py-2 text-sm font-semibold text-emerald-100 transition-all duration-200 hover:border-amber-300"
              >
                <RefreshCcw className="h-4 w-4" />
                新 Run
              </button>
              <button
                type="button"
                onClick={() => toggleSettings()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-700 bg-emerald-900/70 px-3 py-2 text-sm font-semibold text-emerald-100 transition-all duration-200 hover:border-amber-300"
              >
                <Settings2 className="h-4 w-4" />
                设置
              </button>
            </div>
          </div>
        </header>

        <div className="border-b border-emerald-800/70 bg-emerald-950/55 px-4 py-2 backdrop-blur-sm">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-2">
            <div className="flex items-start gap-2 rounded-lg border border-emerald-800 bg-emerald-950/70 px-3 py-2 text-sm text-emerald-100">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
              <span>
                {banner} · {RUN_STATUS_LABEL[runState.status]}
              </span>
            </div>

            <div className="hide-scrollbar flex gap-2 overflow-x-auto pb-1">
              {runState.ownedRelics.length === 0 ? (
                <div className="rounded-lg border border-emerald-800 bg-emerald-950/70 px-3 py-1.5 text-xs text-emerald-200/80">
                  本局藏品背包：暂无（开发中）
                </div>
              ) : (
                runState.ownedRelics.map((relic, idx) => (
                  <div
                    key={`${relic.id}_${idx}`}
                    className={clsx(
                      'whitespace-nowrap rounded-lg border px-3 py-1.5 text-xs',
                      RELIC_RARITY_STYLE[relic.rarity].card,
                    )}
                    title={relic.description}
                  >
                    <span className="font-semibold">{relic.name}</span>
                    <span className="ml-2 text-emerald-200/80">开发中</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <SettingsPanel />
        <LogDrawer open={logOpen} logs={runState.combat.log} onClose={() => setLogOpen(false)} />

        {runState.status === 'reward' ? (
          <main className="flex min-h-0 flex-1 items-center px-4 py-6">
            <RewardFlowPanel />
          </main>
        ) : (
          <>
            <main className="relative min-h-0 flex-1 overflow-hidden px-4 py-3">
              {announcement && (
                <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-black/45 backdrop-blur-[1px]">
                  <p className="animate-bounce whitespace-pre-line text-center text-3xl font-black tracking-wider text-amber-300 drop-shadow-[0_0_16px_rgba(0,0,0,0.75)] md:text-5xl">
                    {announcement}
                  </p>
                </div>
              )}

              <aside className="pointer-events-auto absolute left-2 top-1/2 z-10 hidden h-[75%] max-h-[34rem] w-[17rem] -translate-y-1/2 flex-col rounded-xl border border-emerald-800 bg-emerald-950/75 p-2 xl:flex">
                <div className="flex items-center justify-between">
                  <SectionLabel>牌型成长</SectionLabel>
                  <span className="text-[11px] text-emerald-300/80">Lv / 底注 / 倍率</span>
                </div>
                <div className="hide-scrollbar mt-2 space-y-1 overflow-y-auto pr-1 text-xs">
                  {HAND_TYPE_ORDER.map((handType) => {
                    const level = runState.handLevels[handType]
                    const stats = getLeveledHandStats(handType, level)
                    const isFocused = focusedHandType === handType

                    return (
                      <div
                        key={handType}
                        className={clsx(
                          'rounded-lg border px-2 py-1.5',
                          isFocused
                            ? 'border-amber-300/80 bg-amber-300/10 text-amber-200'
                            : 'border-emerald-800 bg-emerald-900/45 text-emerald-100',
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold">{stats.name}</span>
                          <span className="font-mono text-[11px]">Lv {level}</span>
                        </div>
                        <div className="mt-1 text-[11px] text-emerald-100/90">
                          底注 {stats.baseChips} · 倍率 x{stats.mult.toFixed(2)}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </aside>

              <div className="mx-auto flex h-full min-h-0 w-full max-w-5xl flex-col">
                <div className="shrink-0 rounded-xl bg-emerald-950/45 px-3 py-2 text-sm text-emerald-100">
                  {runState.combat.currentPlay ? (
                    <>
                      最近出牌：
                      <span className="font-semibold text-amber-300">
                        {runState.combat.currentPlay.by === 'player' ? '你' : runState.enemy.name}
                      </span>
                      · {runState.combat.currentPlay.eval.name} · 潜在伤害{' '}
                      <span className="font-semibold text-amber-300">{runState.combat.currentPlay.eval.totalScore}</span>
                    </>
                  ) : (
                    <span className="inline-flex items-center gap-2">
                      <CircleAlert className="h-4 w-4 text-amber-300" />
                      当前牌桌为空，{runState.combat.roundOwner === 'player' ? '由你先手发起。' : '敌方先手发起。'}
                    </span>
                  )}
                </div>

                <div ref={trickScrollRef} className="hide-scrollbar mt-3 min-h-0 flex-1 space-y-4 overflow-y-auto px-1 py-1">
                  {runState.combat.trickHistory.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-center text-xl font-bold italic text-emerald-200/75">
                      {runState.combat.roundOwner === 'player' ? '你的攻击回合，请出牌。' : '敌人的攻击回合，准备防守。'}
                    </div>
                  ) : (
                    runState.combat.trickHistory.map((play, idx) => (
                      <div
                        key={`${play.by}_${idx}`}
                        className={clsx(
                          'flex w-fit max-w-full flex-col gap-2 rounded-xl bg-emerald-900/75 p-3 shadow-lg',
                          play.by === 'player'
                            ? 'ml-auto items-end border border-sky-500/75'
                            : 'items-start border border-rose-500/75',
                        )}
                      >
                        <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                          <span className={play.by === 'player' ? 'text-sky-300' : 'text-rose-300'}>
                            {play.by === 'player' ? '你' : runState.enemy.name}
                            {idx === 0 ? ' (发起)' : ' (压制)'}
                          </span>
                          <span className="rounded bg-slate-800 px-2 py-0.5 text-xs text-white">{play.eval.name}</span>
                          <span className="text-amber-300">{play.eval.totalScore} 潜在伤害</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {play.cards.map((card) => (
                            <CardView key={card.id} card={card} small />
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </main>

            <footer
              className={clsx(
                'shrink-0 border-t-4 px-4 pb-4 pt-3 transition-colors',
                runState.combat.roundOwner === 'player' ? 'border-sky-500 bg-sky-950/20' : 'border-emerald-800 bg-emerald-900/70',
              )}
            >
              <div className="mx-auto w-full max-w-7xl">
                <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                  <div className="flex flex-col gap-3 md:flex-row md:items-end">
                    <div className="rounded-xl border border-emerald-800 bg-emerald-950/80 px-3 py-2">
                      <div className="mb-1 flex items-center gap-2">
                        <SectionLabel>Player</SectionLabel>
                        {runState.combat.actionTurn === 'player' && (
                          <span className="animate-pulse rounded bg-sky-600 px-2 py-0.5 text-xs font-bold text-white">
                            攻击回合
                          </span>
                        )}
                      </div>
                      <HpBar hp={runState.player.hp} maxHp={runState.player.maxHp} tone="player" />
                    </div>
                    <ResourceStats
                      hand={runState.player.hand.length}
                      deck={runState.player.deck.length}
                      discard={runState.player.discard.length}
                    />
                  </div>

                  <div className="w-full lg:max-w-2xl">
                    <div className="rounded-lg bg-emerald-950/70 px-3 py-2 text-sm text-emerald-100">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        {selectedEval ? (
                          <span>
                            {selectedEval.name} · 出牌分 <span className="font-semibold text-amber-300">{selectedEval.totalScore}</span>
                            {selectedProjectedDamage !== null && (
                              <span className="ml-2 text-emerald-200/85">
                                进攻成功时伤害 <span className="font-semibold text-amber-300">{selectedProjectedDamage}</span>
                              </span>
                            )}
                          </span>
                        ) : selectedIds.length > 0 ? (
                          <span className="text-amber-300">无效牌型</span>
                        ) : (
                          <span className="text-emerald-200/75">请选择手牌</span>
                        )}

                        {runState.status === 'in_battle' &&
                          (runState.buffs.playerDamageMult !== 1 || runState.buffs.playerDamageFlat !== 0) && (
                            <span className="inline-flex items-center gap-1 rounded-md border border-amber-400/60 bg-amber-400/10 px-2 py-0.5 text-xs text-amber-200">
                              <Flame className="h-3.5 w-3.5" />
                              伤害加成 x{runState.buffs.playerDamageMult.toFixed(2)}
                            </span>
                          )}
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        onClick={toggleSortMode}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-700 bg-emerald-900/75 px-4 py-2 text-sm font-semibold text-emerald-100 transition-all duration-200 hover:border-amber-300"
                        title={handSortMode === 'rank_desc' ? '当前按大小排序' : '当前按花色分组排序'}
                      >
                        切换
                        <span className="text-xs text-amber-300">{handSortMode === 'rank_desc' ? '大小' : '花色'}</span>
                      </button>

                      {runState.combat.currentPlay && (
                        <button
                          type="button"
                          onClick={pass}
                          disabled={!canPlayerPass}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-500 bg-slate-700 px-4 py-2 text-sm font-semibold text-white transition-all duration-200 enabled:hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <ShieldAlert className="h-4 w-4" />
                          要不起
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={playSelected}
                        disabled={!canPlayerPlay}
                        className={clsx(
                          'inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-lg transition-all duration-200',
                          canPlayerPlay
                            ? currentEval
                              ? 'bg-amber-600 shadow-amber-500/40 hover:bg-amber-500'
                              : 'bg-sky-600 shadow-sky-500/40 hover:bg-sky-500'
                            : 'cursor-not-allowed border border-slate-700 bg-slate-800 text-slate-500 shadow-none',
                        )}
                      >
                        {currentEval ? <ShieldAlert className="h-4 w-4" /> : <Sword className="h-4 w-4" />}
                        {currentEval ? '压制出牌' : '发起攻击'}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="hide-scrollbar overflow-x-auto pb-2">
                  <div className="flex w-max min-w-full min-h-[160px] items-end justify-center gap-2 pr-1">
                    {playerHandCards.map((card) => (
                      <CardView
                        key={card.id}
                        card={card}
                        selected={selectedIds.includes(card.id)}
                        onClick={
                          runState.status === 'in_battle' && runState.combat.actionTurn === 'player' && !announcement
                            ? () => toggleCard(card.id)
                            : undefined
                        }
                      />
                    ))}
                  </div>
                </div>
              </div>
            </footer>
          </>
        )}
      </div>

      <EndOverlay />
    </div>
  )
}

