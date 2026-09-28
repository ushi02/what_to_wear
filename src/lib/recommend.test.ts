import { describe, expect, it } from 'vitest'
import { freshWardrobe } from '../data/baseWardrobe'
import type { DayWeather, HourWeather, Item } from '../types'
import { recommend } from './recommend'

/** 生成 7–22 点的天气；feels 从 min 线性升到 max 再降回去 */
function day(opts: { min: number; max: number; prob?: number; mm?: number; wind?: number; uv?: number }): DayWeather {
  const hours: HourWeather[] = []
  for (let h = 7; h <= 22; h++) {
    const k = 1 - Math.abs(h - 14) / 8
    const feels = opts.min + (opts.max - opts.min) * Math.max(0, k)
    hours.push({
      hour: h,
      temp: feels,
      feels,
      precipProb: h === 15 ? (opts.prob ?? 0) : 0,
      precip: h === 15 ? (opts.mm ?? 0) : 0,
      wind: opts.wind ?? 5,
      uv: h === 13 ? (opts.uv ?? 2) : 0,
      cloud: 30,
    })
  }
  return { date: '2026-09-28', hours }
}

const without = (...ids: string[]): Item[] => freshWardrobe().map((i) => (ids.includes(i.id) ? { ...i, owned: false } : i))
const pickOf = (rec: ReturnType<typeof recommend>, cat: string) => rec.picks.find((p) => p.category === cat)

describe('recommend', () => {
  it('雨天不推荐网面鞋，优先防水鞋，并带伞', () => {
    const rec = recommend(day({ min: 15, max: 20, prob: 80, mm: 3 }), freshWardrobe())
    expect(rec.summary.rainy).toBe(true)
    expect(pickOf(rec, 'shoes')?.item?.id).toBe('boots')
    expect(rec.accessories.map((a) => a.item?.id)).toContain('umbrella')
  })

  it('雨天没有防水靴时穿皮鞋，皮鞋够用就不催着买', () => {
    const rec = recommend(day({ min: 15, max: 20, prob: 80 }), without('boots'))
    expect(pickOf(rec, 'shoes')?.item?.id).toBe('leather')
    expect(rec.shopping.map((s) => s.item.id)).not.toContain('boots')
  })

  it('雨天只有匡威时穿匡威，并建议买双防水鞋', () => {
    const rec = recommend(day({ min: 15, max: 20, prob: 80 }), without('boots', 'leather'))
    expect(['canvas', 'sneaker-white']).toContain(pickOf(rec, 'shoes')?.item?.id)
    expect(rec.shopping.map((s) => s.item.id)).toContain('boots')
  })

  it('雨天只有网面鞋时凑合穿，给出换袜子提示和购买建议', () => {
    const rec = recommend(day({ min: 15, max: 20, prob: 80 }), without('boots', 'leather', 'canvas', 'sneaker-white', 'sandals'))
    expect(pickOf(rec, 'shoes')?.item?.id).toBe('sneaker-mesh')
    expect(rec.tips.map((t) => t.key)).toContain('tip.socks')
    expect(rec.shopping.length).toBeGreaterThan(0)
  })

  it('不下雨时可以穿网面鞋', () => {
    const items = without('canvas', 'sneaker-white', 'leather')
    const rec = recommend(day({ min: 14, max: 22 }), items)
    expect(pickOf(rec, 'shoes')?.item?.id).toBe('sneaker-mesh')
  })

  it('标记"我没有"的衣服不会被推荐', () => {
    const rec = recommend(day({ min: 24, max: 32 }), without('tee-white'))
    expect(pickOf(rec, 'top')?.item?.id).toBe('tee-black')
  })

  it('炎热天：短袖短裤，不穿外套', () => {
    const rec = recommend(day({ min: 26, max: 34, uv: 8 }), freshWardrobe())
    expect(pickOf(rec, 'top')?.item?.range[0]).toBeGreaterThanOrEqual(20)
    expect(pickOf(rec, 'bottom')?.item?.id).toBe('shorts')
    expect(pickOf(rec, 'outer')).toBeUndefined()
    expect(rec.accessories.map((a) => a.item?.id)).toEqual(expect.arrayContaining(['cap', 'sunglasses']))
  })

  it('严寒：保暖内衣 + 厚毛衣 + 厚羽绒 + 围巾手套', () => {
    const rec = recommend(day({ min: -8, max: -2 }), freshWardrobe())
    expect(pickOf(rec, 'top')?.item?.id).toBe('thermal')
    expect(pickOf(rec, 'mid')?.item?.id).toBe('sweater')
    expect(pickOf(rec, 'outer')?.item?.id).toBe('heavy-down')
    expect(rec.accessories.map((a) => a.item?.id)).toEqual(expect.arrayContaining(['scarf', 'gloves']))
  })

  it('温差大时提示叠穿，并按最低体感带外套', () => {
    const rec = recommend(day({ min: 12, max: 24 }), freshWardrobe())
    expect(rec.tips.map((t) => t.key)).toContain('tip.swing')
    expect(pickOf(rec, 'outer')?.item).toBeDefined()
  })

  it('大风天优先防风外套；没有的话建议购买', () => {
    const windy = day({ min: 14, max: 19, wind: 40 })
    expect(pickOf(recommend(windy, freshWardrobe()), 'outer')?.item?.id).toBe('windbreaker')
    const rec = recommend(windy, without('windbreaker'))
    expect(rec.shopping.map((s) => s.item.id)).toContain('windbreaker')
  })

  it('下雨但没有伞时建议买伞', () => {
    const rec = recommend(day({ min: 22, max: 28, prob: 70 }), without('umbrella'))
    expect(rec.shopping.map((s) => s.item.id)).toContain('umbrella')
  })

  it('和去年同期对比', () => {
    const rec = recommend(day({ min: 10, max: 16 }), freshWardrobe(), { avgTemp: 20, rainyDays: 8, days: 15 })
    expect(rec.tips.map((t) => t.key)).toEqual(expect.arrayContaining(['tip.colder', 'tip.rainyLastYear']))
  })
})
