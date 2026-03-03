import { SAVE_VERSION } from '@/engine/constants'
import type { SaveSnapshot } from '@/engine/types'

const SAVE_KEY = 'rouge_doudizhu_save_v3'

export function saveSnapshot(snapshot: SaveSnapshot): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(snapshot))
  } catch {
    // ignore localStorage failures
  }
}

export function loadSnapshot(): SaveSnapshot | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw) as SaveSnapshot
    if (!parsed || typeof parsed !== 'object') return null
    if (parsed.version !== SAVE_VERSION) return null
    if (!parsed.runState) return null

    return parsed
  } catch {
    return null
  }
}

export function clearSnapshot(): void {
  try {
    localStorage.removeItem(SAVE_KEY)
  } catch {
    // ignore localStorage failures
  }
}
