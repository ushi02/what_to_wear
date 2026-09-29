import { useEffect, useMemo, useState } from 'react'
import { flag, useI18n, type Key } from '../i18n'
import { RAIN_PROB, recommend, type Condition } from '../lib/recommend'
import { getForecast, getLastYear, OUT_END, OUT_START, WeatherError } from '../lib/weather'
import type { DayWeather, HourWeather, Item, LastYearWeather, Place } from '../types'

interface Props {
  place: Place
  items: Item[]
  onChangePlace: () => void
  onWishlist: (id: string) => void
}

const COND_ICON: Record<Condition, string> = { rain: '🌧️', hot: '🥵', cold: '🥶', sunny: '☀️', cloudy: '⛅' }

const hourIcon = (h: HourWeather) => (h.precipProb >= RAIN_PROB ? '🌧️' : h.cloud >= 70 ? '☁️' : h.cloud >= 30 ? '⛅' : h.hour >= 19 ? '🌙' : '☀️')

export function TodayView({ place, items, onChangePlace, onWishlist }: Props) {
  const i18n = useI18n()
  const { t, msg, temp, hour, hourShort, itemName, placeName, country } = i18n

  // 结果带上请求时的 key，换城市/换天后旧结果自动失效，不用在 effect 里手动清空
  const placeKey = `${place.lat},${place.lon}`
  const [fc, setFc] = useState<{ key: string; days?: DayWeather[]; error?: string }>()
  const [ly, setLy] = useState<{ key: string; value: LastYearWeather }>()
  // 晚上 8 点以后默认看明天
  const [dayIndex, setDayIndex] = useState(new Date().getHours() >= 20 ? 1 : 0)

  useEffect(() => {
    let cancelled = false
    getForecast(place)
      .then((days) => !cancelled && setFc({ key: placeKey, days }))
      .catch((e: unknown) => !cancelled && setFc({ key: placeKey, error: e instanceof WeatherError ? e.status : 'network' }))
    return () => {
      cancelled = true
    }
  }, [place, placeKey])

  const current = fc?.key === placeKey ? fc : undefined
  const days = current?.days
  const day = days?.[Math.min(dayIndex, days.length - 1)]
  const lyKey = day ? `${placeKey}:${day.date}` : ''
  const lastYear = ly?.key === lyKey ? ly.value : undefined

  useEffect(() => {
    if (!day) return
    let cancelled = false
    // 去年数据只是参考，拿不到也不影响推荐
    getLastYear(place, day.date)
      .then((value) => !cancelled && setLy({ key: lyKey, value }))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [place, day, lyKey])

  const rec = useMemo(() => (day && day.hours.length ? recommend(day, items, lastYear) : undefined), [day, items, lastYear])

  const placeButton = (
    <div className="hero-place-row">
      <button className="hero-place" onClick={onChangePlace}>
        {flag(place.cc)} {placeName(place)}
        {place.cc && !place.current && <span className="hero-country"> · {country(place.cc)}</span>}
      </button>
      <button className="hero-change" onClick={onChangePlace}>
        🔄 {t('city.change')}
      </button>
    </div>
  )

  if (current?.error) {
    return (
      <section className="hero hero--cloudy">
        {placeButton}
        <p className="hero-msg">😵 {t('wx.error', { status: current.error })}</p>
      </section>
    )
  }
  if (!days) {
    return (
      <section className="hero hero--cloudy">
        {placeButton}
        <p className="hero-msg">{t('wx.loading')}</p>
      </section>
    )
  }
  if (!rec || !day) {
    return (
      <section className="hero hero--cloudy">
        {placeButton}
        <p className="hero-msg">{t('wx.pastDay')}</p>
      </section>
    )
  }

  const s = rec.summary
  const maxProb = Math.max(...day.hours.map((h) => h.precipProb))

  return (
    <>
      <section className={`hero hero--${s.condition}`}>
        <div className="hero-top">
          {placeButton}
          <div className="seg glass" role="tablist">
            {days.map((d, i) => (
              <button key={d.date} role="tab" aria-selected={i === dayIndex} className={i === dayIndex ? 'on' : ''} onClick={() => setDayIndex(i)}>
                {t(i === 0 ? 'day.today' : 'day.tomorrow')}
              </button>
            ))}
          </div>
        </div>

        <div className="hero-main">
          <span className="hero-icon" aria-hidden>{COND_ICON[s.condition]}</span>
          <span className="hero-temp">{temp(s.tempMax, false)}</span>
          <div className="hero-side">
            <div className="hero-cond">{t(`cond.${s.condition}` as Key)} · {i18n.date(day.date)}</div>
            <div>{t('wx.range', { min: { temp: s.tempMin }, max: { temp: s.tempMax } })}</div>
            <div>{t('wx.feels', { min: { temp: s.feelsMin }, max: { temp: s.feelsMax } })}</div>
          </div>
        </div>

        <div className="hero-sub">
          <span>{s.rainFrom != null ? `☔ ${t('wx.rainFrom', { h: { hour: s.rainFrom } })}` : `🌂 ${t('wx.dry')}`}</span>
          <span>💨 {t('wx.wind', { w: { wind: s.maxWind } })}</span>
          <span>🔆 {t('wx.uv', { u: s.maxUv })}</span>
        </div>

        <div className="hourly" role="list">
          {day.hours.map((h) => (
            <div key={h.hour} className="hour" role="listitem" title={`${hour(h.hour)} · ${temp(h.feels)} · ${h.precipProb}%`}>
              <span className="hour-t">{temp(h.feels, false)}</span>
              <span className="hour-i" aria-hidden>{hourIcon(h)}</span>
              <span className="hour-bar">
                <span style={{ height: `${Math.max(h.precipProb, 4)}%` }} className={h.precipProb >= RAIN_PROB ? 'wet' : ''} />
              </span>
              <span className="hour-p">{maxProb > 0 ? `${h.precipProb}%` : ''}</span>
              <span className="hour-h">{hourShort(h.hour)}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <h2>{t('outfit.title')}</h2>
        <div className="outfit">
          {rec.picks.map((p) => (
            <article key={p.category} className={`tile ${p.item ? '' : 'empty'}`}>
              <div className="tile-top">
                <span className={`tile-emoji ${p.item?.dark ? 'emoji-dark' : ''}`} aria-hidden>{p.item?.emoji ?? '❔'}</span>
                <span className="tile-cat">{t(`cat.${p.category}` as Key)}</span>
              </div>
              <div className="tile-name">{p.item ? itemName(p.item) : t('outfit.nothing')}</div>
              {p.fallback && p.item && <span className="badge warn">{t('outfit.fallback')}</span>}
              <div className="tile-reason">{msg(p.reason)}</div>
            </article>
          ))}
        </div>

        {rec.accessories.length > 0 && (
          <div className="bring">
            <span className="bring-label">{t('outfit.bring')}</span>
            {rec.accessories.map((p) => (
              <span key={p.item!.id} className="chip static" title={msg(p.reason)}>
                {p.item!.emoji} {itemName(p.item!)}
              </span>
            ))}
          </div>
        )}
      </section>

      {rec.tips.length > 0 && (
        <section className="card tips">
          <h2>💡 {t('tips.title')}</h2>
          <ul>
            {rec.tips.map((m) => <li key={m.key}>{msg(m)}</li>)}
          </ul>
        </section>
      )}

      {rec.shopping.length > 0 && (
        <section className="card">
          <h2>🛍️ {t('shop.title')}</h2>
          <ul className="rows">
            {rec.shopping.map(({ item, why }) => (
              <li key={item.id}>
                <span className="row-emoji" aria-hidden>{item.emoji}</span>
                <div className="row-main">
                  <div>{itemName(item)}</div>
                  <div className="muted small">{msg(why)}</div>
                </div>
                {item.wishlist ? (
                  <span className="muted small">✓ {t('shop.inList')}</span>
                ) : (
                  <button className="ghost" onClick={() => onWishlist(item.id)}>+ {t('shop.add')}</button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="footnote">
        {t('footnote', { from: { hour: OUT_START }, to: { hour: OUT_END } })}{' '}
        {lastYear && t('footnote.lastYear', { t: { temp: lastYear.avgTemp }, n: lastYear.rainyDays })}
      </p>
    </>
  )
}
