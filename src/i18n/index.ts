import { createContext, useContext } from 'react'
import { CITIES } from '../data/cities'
import type { Item, Place } from '../types'
import { MESSAGES, type Key, type Lang } from './messages'

export { LANGS, type Key, type Lang } from './messages'
export type Unit = 'metric' | 'imperial'

/** 消息参数：温度、温差、时刻、风速需要按语言和单位格式化 */
export type Param = string | number | { temp: number } | { diff: number } | { hour: number } | { wind: number }
export interface Msg {
  key: Key
  params?: Record<string, Param>
}

export function detectLang(): Lang {
  const langs = typeof navigator === 'undefined' ? [] : navigator.languages ?? [navigator.language]
  for (const l of langs) {
    if (l.startsWith('zh')) return 'zh'
    if (l.startsWith('ja')) return 'ja'
    if (l.startsWith('en')) return 'en'
  }
  return 'en'
}

export function detectUnit(): Unit {
  const l = typeof navigator === 'undefined' ? '' : navigator.language
  return /-(US|LR|MM)$/i.test(l) ? 'imperial' : 'metric'
}

const toF = (c: number) => (c * 9) / 5 + 32

export function makeI18n(lang: Lang, unit: Unit) {
  const dict = MESSAGES[lang]
  const imperial = unit === 'imperial'

  /** 36 → "36°"；withUnit 时 "36°C" / "97°F" */
  const temp = (c: number, withUnit = true) => `${Math.round(imperial ? toF(c) : c)}°${withUnit ? (imperial ? 'F' : 'C') : ''}`
  const diff = (d: number) => `${Math.round(imperial ? (d * 9) / 5 : d)}°${imperial ? 'F' : 'C'}`
  const wind = (kmh: number) => (imperial ? `${Math.round(kmh / 1.609)} mph` : `${Math.round(kmh)} km/h`)
  const hour = (h: number) => {
    if (lang === 'zh') return `${h} 点`
    if (lang === 'ja') return `${h}時`
    return h === 12 ? '12 PM' : h > 12 ? `${h - 12} PM` : `${h} AM`
  }
  const hourShort = (h: number) => (lang === 'en' ? (h === 12 ? '12p' : h > 12 ? `${h - 12}p` : `${h}a`) : lang === 'ja' ? `${h}時` : `${h}点`)

  const fmt = (p: Param): string => {
    if (typeof p === 'number') return String(Math.round(p))
    if (typeof p === 'string') return p
    if ('temp' in p) return temp(p.temp)
    if ('diff' in p) return diff(p.diff)
    if ('hour' in p) return hour(p.hour)
    return wind(p.wind)
  }

  const t = (key: Key, params?: Record<string, Param>) =>
    (dict[key] ?? key).replace(/\{(\w+)\}/g, (_, k: string) => (params && k in params ? fmt(params[k]) : `{${k}}`))

  const regions = new Intl.DisplayNames([lang], { type: 'region' })

  return {
    lang,
    unit,
    t,
    msg: (m: Msg) => t(m.key, m.params),
    temp,
    wind,
    hour,
    hourShort,
    itemName: (i: Item) => (i.custom ? i.name : t(`item.${i.id}` as Key)),
    placeName: (p: Place) => {
      if (p.current) return t('city.current')
      const city = p.cityId ? CITIES.find((c) => c.id === p.cityId) : undefined
      return city ? city[lang] : p.name
    },
    country: (cc?: string) => {
      if (!cc) return ''
      try {
        return regions.of(cc.toUpperCase()) ?? cc
      } catch {
        return cc
      }
    },
    date: (iso: string) => new Intl.DateTimeFormat(lang, { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`)),
  }
}

export type I18n = ReturnType<typeof makeI18n>

export function flag(cc?: string) {
  if (!cc || cc.length !== 2) return ''
  return String.fromCodePoint(...[...cc.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65))
}

export const I18nContext = createContext<I18n>(makeI18n('en', 'metric'))
export const useI18n = () => useContext(I18nContext)
