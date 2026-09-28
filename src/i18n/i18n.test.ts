import { describe, expect, it } from 'vitest'
import { BASE_WARDROBE } from '../data/baseWardrobe'
import { searchLocalCities } from '../data/cities'
import { makeI18n } from '.'
import { MESSAGES, type Key } from './messages'

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()

describe('messages', () => {
  it('三种语言的占位符一致', () => {
    for (const key of Object.keys(MESSAGES.en) as Key[]) {
      expect(placeholders(MESSAGES.zh[key]), `zh ${key}`).toEqual(placeholders(MESSAGES.en[key]))
      expect(placeholders(MESSAGES.ja[key]), `ja ${key}`).toEqual(placeholders(MESSAGES.en[key]))
    }
  })

  it('每件基础衣物都有翻译', () => {
    for (const i of BASE_WARDROBE) expect(MESSAGES.en[`item.${i.id}` as Key], i.id).toBeTruthy()
  })

  it('温度、风速按单位格式化', () => {
    const c = makeI18n('zh', 'metric')
    const f = makeI18n('en', 'imperial')
    expect(c.t('r.top', { t: { temp: 36 } })).toBe('白天最高体感 36°C')
    expect(f.t('r.top', { t: { temp: 36 } })).toBe('Daytime high feels like 97°F')
    expect(f.t('tip.swing', { d: { diff: 10 } })).toContain('18°F')
    expect(f.wind(30)).toBe('19 mph')
    expect(f.hour(15)).toBe('3 PM')
  })
})

describe('searchLocalCities', () => {
  it.each([
    ['纽约', 'newyork'],
    ['ニューヨーク', 'newyork'],
    ['new york', 'newyork'],
    ['东京', 'tokyo'],
    ['東京', 'tokyo'],
    ['大阪', 'osaka'],
    ['ロンドン', 'london'],
    ['sao paulo', 'saopaulo'],
    ['zürich', 'zurich'],
  ])('%s → %s', (q, id) => {
    expect(searchLocalCities(q)[0]?.id).toBe(id)
  })
})
