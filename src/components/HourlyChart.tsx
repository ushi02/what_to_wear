import { useState } from 'react'
import { useI18n } from '../i18n'
import { RAIN_PROB } from '../lib/recommend'
import type { HourWeather } from '../types'
import { HourIcon } from './icons'

/** 每小时一列的宽度；小时多了就横向滚动 */
const COL = 44
const CURVE_TOP = 24
const CURVE_H = 56
const RAIN_TOP = CURVE_TOP + CURVE_H + 16
const RAIN_H = 26
const HEIGHT = RAIN_TOP + RAIN_H

/** 单调三次插值（Fritsch–Carlson），曲线不会冲过真实的最高/最低点 */
function smoothPath(pts: [number, number][]): string {
  const n = pts.length
  if (n < 2) return ''
  const dx = pts.slice(1).map((p, i) => p[0] - pts[i][0])
  const slope = pts.slice(1).map((p, i) => (p[1] - pts[i][1]) / dx[i])
  const m = pts.map((_, i) => (i === 0 ? slope[0] : i === n - 1 ? slope[n - 2] : slope[i - 1] * slope[i] <= 0 ? 0 : (slope[i - 1] + slope[i]) / 2))
  for (let i = 0; i < n - 1; i++) {
    if (slope[i] === 0) {
      m[i] = m[i + 1] = 0
      continue
    }
    const a = m[i] / slope[i]
    const b = m[i + 1] / slope[i]
    const h = Math.hypot(a, b)
    if (h > 3) {
      m[i] = (3 * a * slope[i]) / h
      m[i + 1] = (3 * b * slope[i]) / h
    }
  }
  let d = `M${pts[0][0]},${pts[0][1]}`
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = pts[i]
    const [x1, y1] = pts[i + 1]
    const t = dx[i] / 3
    d += ` C${x0 + t},${y0 + m[i] * t} ${x1 - t},${y1 - m[i + 1] * t} ${x1},${y1}`
  }
  return d
}

export function HourlyChart({ hours }: { hours: HourWeather[] }) {
  const { t, temp, hour, hourShort } = useI18n()
  const [active, setActive] = useState<number>()

  const width = hours.length * COL
  const feels = hours.map((h) => h.feels)
  const lo = Math.min(...feels)
  const hi = Math.max(...feels)
  const span = Math.max(hi - lo, 4)
  const x = (i: number) => i * COL + COL / 2
  const y = (v: number) => CURVE_TOP + CURVE_H - ((v - lo) / span) * CURVE_H
  const pts = hours.map((h, i) => [x(i), y(h.feels)] as [number, number])
  const line = smoothPath(pts)
  const area = `${line} L${x(hours.length - 1)},${CURVE_TOP + CURVE_H + 6} L${x(0)},${CURVE_TOP + CURVE_H + 6} Z`

  // 只标最高、最低和每三小时一个，其余靠悬停
  const hiIdx = feels.indexOf(hi)
  const loIdx = feels.indexOf(lo)
  const labelled = (i: number) => i === hiIdx || i === loIdx || (i % 3 === 0 && Math.abs(i - hiIdx) > 1 && Math.abs(i - loIdx) > 1)

  const tip = (h: HourWeather) => t('wx.hourTip', { h: { hour: h.hour }, t: { temp: h.feels }, p: h.precipProb })
  const pick = (clientX: number, el: HTMLElement) => {
    const i = Math.floor((clientX - el.getBoundingClientRect().left) / COL)
    setActive(Math.max(0, Math.min(hours.length - 1, i)))
  }
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    const step = e.key === 'ArrowRight' ? 1 : -1
    setActive((a) => Math.max(0, Math.min(hours.length - 1, (a ?? (step > 0 ? -1 : hours.length)) + step)))
  }
  const cur = active != null ? hours[active] : undefined

  return (
    <figure className="hourly">
      <figcaption className="hourly-cap">
        <span>{t('wx.hourly')}</span>
        <span className="hourly-readout" aria-live="polite">{cur ? tip(cur) : ''}</span>
      </figcaption>
      <div className="hourly-scroll">
        <div
          className="hourly-inner"
          style={{ width }}
          tabIndex={0}
          role="img"
          aria-label={t('wx.hourly')}
          onPointerMove={(e) => pick(e.clientX, e.currentTarget)}
          onPointerLeave={() => setActive(undefined)}
          onKeyDown={onKey}
          onBlur={() => setActive(undefined)}
        >
          <div className="hourly-icons" aria-hidden>
            {hours.map((h) => (
              <span key={h.hour} style={{ width: COL }}><HourIcon h={h} /></span>
            ))}
          </div>
          <svg width={width} height={HEIGHT} aria-hidden>
            <defs>
              <linearGradient id="hourly-wash" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#fff" stopOpacity="0.28" />
                <stop offset="1" stopColor="#fff" stopOpacity="0" />
              </linearGradient>
            </defs>
            <line className="hourly-base" x1={0} x2={width} y1={RAIN_TOP + RAIN_H + 0.5} y2={RAIN_TOP + RAIN_H + 0.5} />
            <path d={area} fill="url(#hourly-wash)" />
            <path d={line} className="hourly-line" />
            {hours.map((h, i) => {
              const barH = Math.max((h.precipProb / 100) * RAIN_H, 2)
              return (
                <g key={h.hour}>
                  <rect
                    className={`hourly-rain ${h.precipProb >= RAIN_PROB ? 'wet' : ''}`}
                    x={x(i) - 7}
                    y={RAIN_TOP + RAIN_H - barH}
                    width={14}
                    height={barH}
                    rx={Math.min(4, barH / 2)}
                  />
                  {labelled(i) && (
                    <text className="hourly-label" x={x(i)} y={y(h.feels) - 9} textAnchor="middle">
                      {temp(h.feels, false)}
                    </text>
                  )}
                </g>
              )
            })}
            {cur && active != null && (
              <g className="hourly-cross">
                <line x1={x(active)} x2={x(active)} y1={4} y2={RAIN_TOP + RAIN_H} />
                <circle cx={x(active)} cy={y(cur.feels)} r={5} />
              </g>
            )}
            {pts.map(([px, py], i) => (i === hiIdx || i === loIdx) && i !== active && <circle key={i} className="hourly-dot" cx={px} cy={py} r={3.5} />)}
          </svg>
          <div className="hourly-hours" aria-hidden>
            {hours.map((h, i) => (
              <span key={h.hour} style={{ width: COL }} className={i === active ? 'on' : ''}>{hourShort(h.hour)}</span>
            ))}
          </div>
        </div>
      </div>
      <div className="hourly-legend" aria-hidden>
        <span className="key-rain" /> {t('wx.rainChance')}
      </div>
      <table className="sr-only">
        <caption>{t('wx.hourly')}</caption>
        <tbody>
          {hours.map((h) => (
            <tr key={h.hour}>
              <th scope="row">{hour(h.hour)}</th>
              <td>{temp(h.feels)}</td>
              <td>{h.precipProb}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
