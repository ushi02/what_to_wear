import type { Key, Msg } from '../i18n'
import type { AccessoryNeed, Category, DayWeather, Item, LastYearWeather } from '../types'

export const RAIN_PROB = 50
export const RAIN_MM = 0.5
export const WINDY_KMH = 30
export const HIGH_UV = 6
export const BIG_SWING = 10

export interface Summary {
  feelsMin: number
  feelsMax: number
  tempMin: number
  tempMax: number
  maxPrecipProb: number
  totalPrecip: number
  maxWind: number
  maxUv: number
  rainy: boolean
  avgCloud: number
  /** 降水概率最高的时刻 */
  rainPeak?: { hour: number; prob: number }
  /** 最早降水概率 ≥50% 的时刻 */
  rainFrom?: number
  condition: Condition
}

export type Condition = 'rain' | 'hot' | 'cold' | 'sunny' | 'cloudy'

export interface Pick {
  category: Category
  item?: Item
  reason: Msg
  /** 手上没有真正合适的，只能凑合 */
  fallback?: boolean
}

export interface Suggestion {
  item: Item
  why: Msg
}

export interface Recommendation {
  summary: Summary
  picks: Pick[]
  accessories: Pick[]
  tips: Msg[]
  shopping: Suggestion[]
}

export function summarize(day: DayWeather): Summary {
  const h = day.hours
  if (h.length === 0) throw new Error('没有该日的逐小时数据')
  const feels = h.map((x) => x.feels)
  const temps = h.map((x) => x.temp)
  const maxPrecipProb = Math.max(...h.map((x) => x.precipProb))
  const totalPrecip = h.reduce((s, x) => s + x.precip, 0)
  const peak = h.reduce((a, b) => (b.precipProb > a.precipProb ? b : a))
  const feelsMin = Math.min(...feels)
  const feelsMax = Math.max(...feels)
  const maxUv = Math.max(...h.map((x) => x.uv))
  const avgCloud = h.reduce((s, x) => s + x.cloud, 0) / h.length
  const rainy = maxPrecipProb >= RAIN_PROB || totalPrecip > RAIN_MM
  const condition: Condition = rainy
    ? 'rain'
    : feelsMax >= 30
      ? 'hot'
      : feelsMax < 8
        ? 'cold'
        : avgCloud < 50 || maxUv >= HIGH_UV
          ? 'sunny'
          : 'cloudy'
  return {
    feelsMin,
    feelsMax,
    tempMin: Math.min(...temps),
    tempMax: Math.max(...temps),
    maxPrecipProb,
    totalPrecip,
    maxWind: Math.max(...h.map((x) => x.wind)),
    maxUv,
    rainy,
    avgCloud,
    rainPeak: peak.precipProb > 0 ? { hour: peak.hour, prob: peak.precipProb } : undefined,
    rainFrom: h.find((x) => x.precipProb >= RAIN_PROB)?.hour,
    condition,
  }
}

const fits = (i: Item, t: number) => t >= i.range[0] && t <= i.range[1]
const distance = (i: Item, t: number) => (fits(i, t) ? 0 : Math.min(Math.abs(t - i.range[0]), Math.abs(t - i.range[1])))
const centerGap = (i: Item, t: number) => Math.abs((i.range[0] + i.range[1]) / 2 - t)
const rainLevel = (i: Item) => i.rain ?? 1

interface ChooseOpts {
  rainy?: boolean
  preferWindproof?: boolean
}

interface Choice {
  item?: Item
  fallback: boolean
  /** 衣橱里没有、但买了会明显更合适的 */
  better?: Item
}

/** 在某个类别里为目标体感温度挑一件。优先挑自己有的。 */
export function choose(items: Item[], category: Category, t: number, opts: ChooseOpts = {}): Choice {
  const all = items.filter((i) => i.category === category)
  const rainShoes = category === 'shoes' && opts.rainy
  const pool = rainShoes ? all.filter((i) => rainLevel(i) >= 1) : all

  // 雨天鞋子先看防雨等级，再看温度；大风天外套先看防不防风
  const score = (i: Item) => {
    let s = -centerGap(i, t)
    if (rainShoes) s += rainLevel(i) * 100
    if (opts.preferWindproof && i.windproof) s += 100
    return s
  }
  const best = (arr: Item[]) => [...arr].sort((a, b) => score(b) - score(a))[0] as Item | undefined

  const bestAny = best(pool.filter((i) => fits(i, t)))
  const bestOwned = best(pool.filter((i) => i.owned && fits(i, t)))

  if (bestOwned) {
    let better: Item | undefined
    if (bestAny && !bestAny.owned) {
      if (rainShoes && rainLevel(bestAny) > rainLevel(bestOwned) + 1) better = bestAny
      if (opts.preferWindproof && bestAny.windproof && !bestOwned.windproof) better = bestAny
    }
    return { item: bestOwned, fallback: false, better }
  }

  // 没有完全合适的：从自己有的里挑最接近的凑合一下
  const owned = pool.filter((i) => i.owned)
  const nearest = [...(owned.length ? owned : all.filter((i) => i.owned))].sort(
    (a, b) => distance(a, t) - distance(b, t),
  )[0]
  return { item: nearest, fallback: true, better: bestAny && !bestAny.owned ? bestAny : undefined }
}

const m = (key: Key, params?: Msg['params']): Msg => ({ key, params })

export function recommend(day: DayWeather, items: Item[], lastYear?: LastYearWeather): Recommendation {
  const s = summarize(day)
  const picks: Pick[] = []
  const tips: Msg[] = []
  const shopping: Suggestion[] = []
  const suggest = (item: Item, why: Msg) => {
    if (!shopping.some((x) => x.item.id === item.id)) shopping.push({ item, why })
  }

  const windy = s.maxWind >= WINDY_KMH
  const avg = (s.feelsMin + s.feelsMax) / 2
  const needOuter = s.feelsMin < 18 || (windy && s.feelsMin < 22)
  const needMid = s.feelsMin < 13 && s.feelsMax < 20

  const add = (category: Category, t: number, reason: Msg, opts: ChooseOpts = {}, missingWhy?: Msg) => {
    const c = choose(items, category, t, opts)
    picks.push({ category, item: c.item, reason, fallback: c.fallback })
    if (c.better) suggest(c.better, missingWhy ?? m('why.better', { t: { temp: t } }))
  }

  // 贴身层按白天最高体感选，免得中午热
  add('top', s.feelsMax, m('r.top', { t: { temp: s.feelsMax } }))
  if (needMid) add('mid', s.feelsMin, m('r.mid', { t: { temp: s.feelsMin } }))
  if (needOuter) {
    const reason = windy
      ? m('r.outerWindy', { w: { wind: s.maxWind }, t: { temp: s.feelsMin } })
      : m('r.outer', { t: { temp: s.feelsMin } })
    add('outer', s.feelsMin, reason, { preferWindproof: windy }, windy ? m('why.windy') : undefined)
  }
  add('bottom', avg, m('r.bottom', { t: { temp: avg } }))

  const shoeReason = !s.rainy
    ? m('r.shoes', { t: { temp: avg } })
    : s.rainPeak
      ? m('r.shoesRainPeak', { h: { hour: s.rainPeak.hour }, p: s.rainPeak.prob })
      : m('r.shoesRain')
  add('shoes', avg, shoeReason, { rainy: s.rainy }, m('why.rainShoes'))
  const shoe = picks[picks.length - 1]
  if (s.rainy && shoe.item && rainLevel(shoe.item) === 0) tips.push(m('tip.socks'))

  // 配件
  const needs = new Set<AccessoryNeed>()
  if (s.rainy) needs.add('rain')
  if (s.maxUv >= HIGH_UV) needs.add('uv')
  if (s.feelsMin < 5) needs.add('cold')
  if (s.feelsMin < 0) needs.add('freezing')
  const accessories: Pick[] = []
  for (const need of needs) {
    for (const item of items.filter((i) => i.category === 'accessory' && i.need === need)) {
      if (item.owned) accessories.push({ category: 'accessory', item, reason: m(`need.${need}`) })
      else if (need === 'rain') suggest(item, m('why.umbrella'))
    }
    if (need === 'rain' && !items.some((i) => i.need === 'rain' && i.owned)) tips.push(m('tip.noUmbrella'))
  }

  // 提示
  if (s.feelsMax - s.feelsMin >= BIG_SWING) {
    tips.push(m('tip.swing', { d: { diff: s.feelsMax - s.feelsMin } }))
  }
  if (s.rainy && !needOuter) tips.push(m('tip.umbrellaEnough'))
  if (lastYear) {
    const diff = (s.tempMin + s.tempMax) / 2 - lastYear.avgTemp
    if (Math.abs(diff) >= 3) tips.push(m(diff > 0 ? 'tip.warmer' : 'tip.colder', { d: { diff: Math.abs(diff) } }))
    if (lastYear.days > 0 && lastYear.rainyDays / lastYear.days >= 0.4) {
      tips.push(m('tip.rainyLastYear', { n: lastYear.rainyDays }))
    }
  }

  return { summary: s, picks, accessories, tips, shopping }
}
