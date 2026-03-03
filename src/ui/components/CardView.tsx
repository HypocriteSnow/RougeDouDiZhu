import clsx from 'clsx'

import type { Card } from '@/engine/types'

const SUIT_META: Record<Card['suit'], { symbol: string; colorClass: string }> = {
  S: { symbol: '\u2660', colorClass: 'text-slate-900' },
  H: { symbol: '\u2665', colorClass: 'text-rose-600' },
  C: { symbol: '\u2663', colorClass: 'text-slate-900' },
  D: { symbol: '\u2666', colorClass: 'text-rose-600' },
  J: { symbol: '\uD83C\uDCCF', colorClass: 'text-amber-700' },
}

interface CardViewProps {
  card: Card
  selected?: boolean
  small?: boolean
  onClick?: () => void
}

function renderRank(rank: Card['rank']): string {
  if (rank === 'BJ') return 'BJ'
  if (rank === 'RJ') return 'RJ'
  return rank
}

function edgeRank(rank: Card['rank'], top: boolean): string {
  if (rank === 'BJ') return top ? '小' : '鬼'
  if (rank === 'RJ') return top ? '大' : '鬼'
  return rank
}

export function CardView({ card, selected = false, small = false, onClick }: CardViewProps) {
  const suitMeta = SUIT_META[card.suit]
  const rank = renderRank(card.rank)

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={clsx(
        'relative shrink-0 rounded-lg border-2 bg-white p-1 text-slate-900 shadow-[0_8px_18px_rgba(0,0,0,0.35)] transition-all duration-200',
        small ? 'h-16 w-12 text-[11px]' : 'h-28 w-20 text-sm md:h-36 md:w-24',
        selected
          ? 'border-sky-500 -translate-y-4 shadow-lg shadow-sky-500/35'
          : 'border-slate-300 hover:-translate-y-2 hover:shadow-[0_10px_20px_rgba(0,0,0,0.4)]',
        onClick ? 'cursor-pointer' : 'cursor-default',
      )}
    >
      <div className="pointer-events-none absolute inset-1 rounded border border-slate-200" />

      <div className={clsx('absolute left-1.5 top-1 text-center leading-none', suitMeta.colorClass)}>
        <div className={clsx('font-black', small ? 'text-[10px]' : 'text-xs')}>{edgeRank(card.rank, true)}</div>
        <div className={clsx(small ? 'text-[10px]' : 'text-xs')}>{suitMeta.symbol}</div>
      </div>

      <div className={clsx('absolute bottom-1 right-1.5 rotate-180 text-center leading-none', suitMeta.colorClass)}>
        <div className={clsx('font-black', small ? 'text-[10px]' : 'text-xs')}>{edgeRank(card.rank, false)}</div>
        <div className={clsx(small ? 'text-[10px]' : 'text-xs')}>{suitMeta.symbol}</div>
      </div>

      <div className="flex h-full items-center justify-center">
        {small ? (
          <span className={clsx('text-base leading-none', suitMeta.colorClass)}>{suitMeta.symbol}</span>
        ) : (
          <div className="flex flex-col items-center">
            <span className={clsx('text-3xl leading-none', suitMeta.colorClass)}>{suitMeta.symbol}</span>
            <span className={clsx('mt-1 text-xs font-black leading-none', suitMeta.colorClass)}>{rank}</span>
          </div>
        )}
      </div>
    </button>
  )
}
