import clsx from 'clsx'

import type { Card } from '@/engine/types'

const SUIT_META: Record<Card['suit'], { symbol: string; colorClass: string; accent: string }> = {
  S: { symbol: '♠', colorClass: 'text-slate-900', accent: 'from-slate-100 to-white' },
  H: { symbol: '♥', colorClass: 'text-rose-600', accent: 'from-rose-50 to-white' },
  C: { symbol: '♣', colorClass: 'text-slate-900', accent: 'from-slate-100 to-white' },
  D: { symbol: '♦', colorClass: 'text-rose-600', accent: 'from-rose-50 to-white' },
  J: { symbol: '🃏', colorClass: 'text-amber-700', accent: 'from-amber-50 to-white' },
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

function isFaceRank(rank: Card['rank']): boolean {
  return rank === 'J' || rank === 'Q' || rank === 'K'
}

function pipRows(rank: Card['rank']): number[] {
  switch (rank) {
    case 'A':
      return [1]
    case '2':
      return [1, 1]
    case '3':
      return [1, 1, 1]
    case '4':
      return [2, 2]
    case '5':
      return [2, 1, 2]
    case '6':
      return [2, 2, 2]
    case '7':
      return [2, 1, 2, 2]
    case '8':
      return [2, 2, 2, 2]
    case '9':
      return [2, 2, 1, 2, 2]
    case '10':
      return [2, 2, 2, 2, 2]
    default:
      return []
  }
}

function FaceBody({ card }: { card: Card }) {
  const meta = SUIT_META[card.suit]
  const rank = renderRank(card.rank)

  if (card.rank === 'BJ' || card.rank === 'RJ') {
    return (
      <div className={clsx('flex h-full w-full flex-col items-center justify-center rounded-xl bg-gradient-to-b', meta.accent)}>
        <div className="text-3xl leading-none">🃏</div>
        <div className="mt-1 font-ui text-[10px] font-bold tracking-[0.18em] text-amber-800">JOKER</div>
      </div>
    )
  }

  if (isFaceRank(card.rank)) {
    return (
      <div className={clsx('flex h-full w-full items-center justify-center rounded-xl bg-gradient-to-b', meta.accent)}>
        <div className="text-center">
          <div className={clsx('font-ui text-4xl font-black leading-none', meta.colorClass)}>{rank}</div>
          <div className={clsx('mt-1 text-2xl leading-none', meta.colorClass)}>{meta.symbol}</div>
        </div>
      </div>
    )
  }

  const rows = pipRows(card.rank)
  return (
    <div className={clsx('flex h-full w-full flex-col justify-evenly rounded-xl bg-gradient-to-b', meta.accent, meta.colorClass)}>
      {rows.map((count, index) => (
        <div key={`${card.id}_row_${index}`} className={clsx('flex items-center', count === 1 ? 'justify-center' : 'justify-between px-2')}>
          {Array.from({ length: count }).map((_, pipIndex) => (
            <span
              key={`${card.id}_row_${index}_${pipIndex}`}
              className={clsx('leading-none', rows.length >= 4 ? 'text-base' : 'text-lg')}
            >
              {meta.symbol}
            </span>
          ))}
        </div>
      ))}
    </div>
  )
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
        'relative shrink-0 rounded-xl border-2 border-neutral-300 bg-white p-1.5 shadow-[0_8px_20px_rgba(0,0,0,0.3)] transition-all duration-200',
        small ? 'h-16 w-11 text-xs' : 'h-36 w-24 text-sm md:h-40 md:w-28',
        selected
          ? 'translate-y-[-0.6rem] border-blue-500 shadow-[0_10px_24px_rgba(59,130,246,0.45)]'
          : 'hover:translate-y-[-0.35rem] hover:brightness-105',
        onClick ? 'cursor-pointer hover:scale-[1.02]' : 'cursor-default',
      )}
    >
      <div className="pointer-events-none absolute inset-1 rounded-[10px] border border-slate-200" />

      <div className={clsx('absolute left-1.5 top-1.5 text-center leading-none', suitMeta.colorClass)}>
        <div className={clsx('font-black', small ? 'text-[10px]' : 'text-xs')}>{rank}</div>
        <div className={clsx(small ? 'text-[10px]' : 'text-xs')}>{suitMeta.symbol}</div>
      </div>

      <div className={clsx('absolute bottom-1.5 right-1.5 rotate-180 text-center leading-none', suitMeta.colorClass)}>
        <div className={clsx('font-black', small ? 'text-[10px]' : 'text-xs')}>{rank}</div>
        <div className={clsx(small ? 'text-[10px]' : 'text-xs')}>{suitMeta.symbol}</div>
      </div>

      {small ? (
        <div className={clsx('flex h-full items-center justify-center text-xl leading-none', suitMeta.colorClass)}>{suitMeta.symbol}</div>
      ) : (
        <FaceBody card={card} />
      )}
    </button>
  )
}
