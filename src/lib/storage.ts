import { useEffect, useState } from 'react'
import { BASE_WARDROBE, freshWardrobe } from '../data/baseWardrobe'
import { detectLang, detectUnit, type Lang, type Unit } from '../i18n'
import type { Item, Place } from '../types'

const STATE_KEY = 'wtw:v1:state'
const CACHE_PREFIX = 'wtw:cache:'

export interface AppState {
  items: Item[]
  place?: Place
  lang: Lang
  unit: Unit
}

// 隐私模式或禁用站点数据时 localStorage 会抛异常，统一吞掉，页面照常能用
function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* 存不了就算了 */
  }
}

const defaults = (): AppState => ({ items: freshWardrobe(), lang: detectLang(), unit: detectUnit() })

export function loadState(): AppState {
  const raw = read(STATE_KEY)
  if (!raw) return defaults()
  try {
    const saved = JSON.parse(raw) as Partial<AppState>
    const savedItems = saved.items ?? []
    // 基础衣橱的定义（温度区间、emoji 等）以代码为准，只保留用户的 owned / wishlist；新加的单品老用户也能看到
    const base = freshWardrobe().map((b) => {
      const mine = savedItems.find((i) => i.id === b.id)
      return mine ? { ...b, owned: mine.owned, wishlist: mine.wishlist } : b
    })
    const custom = savedItems.filter((i) => i.custom).map((i) => ({ ...i, emoji: i.emoji ?? '👕' }))
    return { ...defaults(), ...saved, items: [...base, ...custom] }
  } catch {
    return defaults()
  }
}

export function useAppState() {
  const [state, setState] = useState<AppState>(loadState)
  useEffect(() => write(STATE_KEY, JSON.stringify(state)), [state])

  const updateItem = (id: string, patch: Partial<Item>) =>
    setState((s) => ({ ...s, items: s.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) }))

  return {
    state,
    setPlace: (place: Place) => setState((s) => ({ ...s, place })),
    setLang: (lang: Lang) => setState((s) => ({ ...s, lang })),
    setUnit: (unit: Unit) => setState((s) => ({ ...s, unit })),
    /** 我没有 → 不再推荐 */
    disown: (id: string) => updateItem(id, { owned: false }),
    /** 其实有 / 已买到 */
    own: (id: string) => updateItem(id, { owned: true, wishlist: false }),
    setWishlist: (id: string, wishlist: boolean) => updateItem(id, { wishlist }),
    addCustom: (name: string, templateId: string) => {
      const tpl = state.items.find((i) => i.id === templateId) ?? BASE_WARDROBE[0]
      const item: Item = { ...tpl, id: `custom-${Date.now()}`, name, owned: true, wishlist: false, custom: true }
      setState((s) => ({ ...s, items: [...s.items, item] }))
    },
    removeCustom: (id: string) => setState((s) => ({ ...s, items: s.items.filter((i) => i.id !== id) })),
    reset: () => setState((s) => ({ ...s, items: freshWardrobe() })),
  }
}

export function cacheGet<T>(key: string, maxAgeMs: number): T | undefined {
  const raw = read(CACHE_PREFIX + key)
  if (!raw) return undefined
  try {
    const { at, value } = JSON.parse(raw) as { at: number; value: T }
    return Date.now() - at < maxAgeMs ? value : undefined
  } catch {
    return undefined
  }
}

export function cacheSet(key: string, value: unknown) {
  write(CACHE_PREFIX + key, JSON.stringify({ at: Date.now(), value }))
}
