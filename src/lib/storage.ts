import { useEffect, useState, type SetStateAction } from 'react'
import { BASE_WARDROBE, freshWardrobe } from '../data/baseWardrobe'
import { detectUnit, type Lang, type Unit } from '../i18n'
import type { Item, Place } from '../types'

const STATE_KEY = 'wtw:v1:state'
const CHANGED_KEY = 'wtw:v1:changedAt'
const OWNER_KEY = 'wtw:v1:owner'
const CACHE_PREFIX = 'wtw:cache:'

export type Theme = 'auto' | 'light' | 'dark'

export interface AppState {
  items: Item[]
  place?: Place
  lang: Lang
  unit: Unit
  theme: Theme
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

/** 去掉颜色款之后合并的旧 id：任一旧款有就算有 */
const RENAMED: Record<string, string> = { 'tee-white': 'tee', 'tee-black': 'tee', 'sneaker-white': 'sneaker' }

function migrateIds(items: Item[]): Item[] {
  const out: Item[] = []
  for (const i of items) {
    const id = RENAMED[i.id] ?? i.id
    const icon = i.icon && RENAMED[i.icon] ? RENAMED[i.icon] : i.icon
    const prev = out.find((x) => x.id === id)
    if (prev) Object.assign(prev, { owned: prev.owned || i.owned, wishlist: (prev.wishlist || i.wishlist) && !(prev.owned || i.owned) })
    else out.push({ ...i, id, icon })
  }
  return out
}

const defaults = (): AppState => ({ items: freshWardrobe(), lang: 'en', unit: detectUnit(), theme: 'auto' })

/** 用户最后一次在这台设备上改数据的时间（毫秒），从没改过是 0。和云端比新旧用 */
export function getChangedAt(): number {
  return Number(read(CHANGED_KEY)) || 0
}

/** 本地数据最后和哪个账号同步过（Cognito sub），共用设备时防止把上一个人的衣橱传给下一个人 */
export const getOwner = () => read(OWNER_KEY)
export const setOwner = (sub: string) => write(OWNER_KEY, sub)

export function loadState(): AppState {
  const raw = read(STATE_KEY)
  if (!raw) return defaults()
  try {
    return normalize(JSON.parse(raw) as Partial<AppState>)
  } catch {
    return defaults()
  }
}

/** 把存档（本地或云端）整理成当前版本的 AppState */
export function normalize(saved: Partial<AppState>): AppState {
  const savedItems = migrateIds(saved.items ?? [])
  // 基础衣橱的定义（温度区间、emoji 等）以代码为准，只保留用户的 owned / wishlist；新加的单品老用户也能看到
  const base = freshWardrobe().map((b) => {
    const mine = savedItems.find((i) => i.id === b.id)
    return mine ? { ...b, owned: mine.owned, wishlist: mine.wishlist } : b
  })
  const custom = savedItems.filter((i) => i.custom).map((i) => ({ ...i, emoji: i.emoji ?? '👕' }))
  // 日文已下线，之前存了 ja 的回落到英文
  const lang = saved.lang === 'zh' || saved.lang === 'en' ? saved.lang : 'en'
  return { ...defaults(), ...saved, lang, items: [...base, ...custom] }
}

export function useAppState() {
  const [state, replaceState] = useState<AppState>(loadState)
  useEffect(() => write(STATE_KEY, JSON.stringify(state)), [state])

  // 用户自己的改动记下时间；云端数据覆盖本地（replaceState）不算
  const setState = (next: SetStateAction<AppState>) => {
    write(CHANGED_KEY, String(Date.now()))
    replaceState(next)
  }

  const updateItem = (id: string, patch: Partial<Item>) =>
    setState((s) => ({ ...s, items: s.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) }))

  return {
    state,
    replaceState,
    setPlace: (place: Place) => setState((s) => ({ ...s, place })),
    setLang: (lang: Lang) => setState((s) => ({ ...s, lang })),
    setUnit: (unit: Unit) => setState((s) => ({ ...s, unit })),
    setTheme: (theme: Theme) => setState((s) => ({ ...s, theme })),
    /** 我没有 → 不再推荐 */
    disown: (id: string) => updateItem(id, { owned: false }),
    /** 其实有 / 已买到 */
    own: (id: string) => updateItem(id, { owned: true, wishlist: false }),
    setWishlist: (id: string, wishlist: boolean) => updateItem(id, { wishlist }),
    /** wishlist: true 时是“想买”的东西，还没拥有 */
    addCustom: (name: string, templateId: string, wishlist = false) => {
      const tpl = state.items.find((i) => i.id === templateId) ?? BASE_WARDROBE[0]
      const item: Item = { ...tpl, icon: tpl.icon ?? tpl.id, id: `custom-${Date.now()}`, name, owned: !wishlist, wishlist, custom: true }
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
