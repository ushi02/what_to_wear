import { ArrowDown, ArrowUp, CaretRight, Equals, Umbrella } from '@phosphor-icons/react'
import { useI18n, type Key } from '../i18n'
import { compare, recommend } from '../lib/recommend'
import type { DayWeather, Item } from '../types'
import { ItemIcon, SceneIcon } from './icons'
import type { Scene } from './WeatherScene'

interface Props {
  day: DayWeather
  /** 拿来比冷暖的前一天 */
  prev?: DayWeather
  /** 前一天是不是今天（决定文案说“比今天”还是“比昨天”） */
  prevIsToday: boolean
  label: string
  items: Item[]
  onOpen: () => void
}

/** 另一天的小预览：天气 + 该穿什么，点一下切过去 */
export function DayPeek({ day, prev, prevIsToday, label, items, onOpen }: Props) {
  const { t, msg, temp, itemName, date } = useI18n()
  if (!day.hours.length) return null
  const rec = recommend(day, items)
  const s = rec.summary
  const scene: Scene = s.condition === 'rain' && s.tempMax <= 2 ? 'snow' : s.condition
  const [cmp] = compare(s, prev, prevIsToday)
  const wear = [...rec.picks, ...rec.accessories].filter((p) => p.item)

  return (
    <button className={`peek hero--${scene}`} onClick={onOpen}>
      <div className="peek-head">
        <span className="peek-label">{label}</span>
        <span className="peek-date">{date(day.date)}</span>
      </div>

      <div className="peek-main">
        <SceneIcon scene={scene} night={false} size={40} />
        <span className="peek-temp">{temp(s.tempMax, false)}</span>
        <span className="peek-low">/ {temp(s.tempMin, false)}</span>
      </div>
      <div className="peek-cond">
        {t(`cond.${s.condition}` as Key)}
        {s.maxPrecipProb >= 20 && <> · <Umbrella weight="fill" /> {t('peek.rain', { p: s.maxPrecipProb })}</>}
      </div>
      {cmp && (
        <div className={`trend trend--${cmp.trend}`}>
          {cmp.trend === 'up' ? <ArrowUp weight="bold" /> : cmp.trend === 'down' ? <ArrowDown weight="bold" /> : <Equals weight="bold" />}
          {msg(cmp.msg)}
        </div>
      )}

      <div className="peek-wear">
        <div className="peek-wear-title">{t('peek.wear')}</div>
        <ul>
          {wear.map((p) => (
            <li key={p.item!.id}>
              <span className={`peek-icon cat-${p.category}`} aria-hidden><ItemIcon item={p.item!} size={18} /></span>
              {itemName(p.item!)}
            </li>
          ))}
        </ul>
      </div>

      <span className="peek-open">{t('peek.open')} <CaretRight weight="bold" /></span>
    </button>
  )
}
