import { searchLocalCities } from '../data/cities'
import type { Lang } from '../i18n'
import type { DayWeather, LastYearWeather, Place } from '../types'
import { cacheGet, cacheSet } from './storage'

/** 只看出门时段 */
export const OUT_START = 7
export const OUT_END = 22

const HOUR = 60 * 60 * 1000

export class WeatherError extends Error {
  status: string
  constructor(status: string) {
    super(`weather ${status}`)
    this.status = status
  }
}

async function getJson<T>(url: string): Promise<T> {
  let res: Response
  try {
    res = await fetch(url)
  } catch {
    throw new WeatherError('network')
  }
  if (!res.ok) throw new WeatherError(String(res.status))
  return res.json() as Promise<T>
}

const key = (p: Place) => `${p.lat.toFixed(2)},${p.lon.toFixed(2)}`

interface GeoResult {
  name: string
  admin1?: string
  country_code?: string
  latitude: number
  longitude: number
  population?: number
}

const near = (a: Place, b: Place) => Math.abs(a.lat - b.lat) < 0.3 && Math.abs(a.lon - b.lon) < 0.3

/** 先查内置城市表（中日英别名都可靠），再查 Open-Meteo 并按人口排序 */
export async function searchCity(query: string, lang: Lang): Promise<Place[]> {
  const local: Place[] = searchLocalCities(query)
    .slice(0, 5)
    .map((c) => ({ name: c[lang], lat: c.lat, lon: c.lon, cc: c.cc, cityId: c.id }))

  let remote: Place[] = []
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=10&language=${lang}&format=json`
    const data = await getJson<{ results?: GeoResult[] }>(url)
    remote = (data.results ?? [])
      .sort((a, b) => (b.population ?? 0) - (a.population ?? 0))
      .map((x) => ({
        name: x.admin1 && x.admin1 !== x.name ? `${x.name}, ${x.admin1}` : x.name,
        lat: x.latitude,
        lon: x.longitude,
        cc: x.country_code,
      }))
      .filter((p) => !local.some((l) => near(l, p)))
  } catch (e) {
    // 内置表里有结果时，远程失败也不影响
    if (!local.length) throw e
  }
  return [...local, ...remote].slice(0, 8)
}

interface ForecastResponse {
  hourly: {
    time: string[]
    temperature_2m: number[]
    apparent_temperature: number[]
    precipitation_probability: (number | null)[]
    precipitation: number[]
    wind_speed_10m: number[]
    uv_index: (number | null)[]
    cloud_cover: (number | null)[]
  }
}

/** 返回今天和明天两天（按当地时区），每天只保留出门时段的逐小时数据 */
export async function getForecast(place: Place): Promise<DayWeather[]> {
  const cacheKey = `fc2:${key(place)}:${new Date().toDateString()}`
  const cached = cacheGet<DayWeather[]>(cacheKey, HOUR)
  if (cached) return cached

  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${place.lat}&longitude=${place.lon}` +
    '&hourly=temperature_2m,apparent_temperature,precipitation_probability,precipitation,wind_speed_10m,uv_index,cloud_cover' +
    '&timezone=auto&forecast_days=2'
  const { hourly: h } = await getJson<ForecastResponse>(url)

  const days = new Map<string, DayWeather>()
  h.time.forEach((t, i) => {
    const [date, clock] = t.split('T')
    const hour = Number(clock.slice(0, 2))
    if (hour < OUT_START || hour > OUT_END) return
    if (!days.has(date)) days.set(date, { date, hours: [] })
    days.get(date)!.hours.push({
      hour,
      temp: h.temperature_2m[i],
      feels: h.apparent_temperature[i],
      precipProb: h.precipitation_probability[i] ?? 0,
      precip: h.precipitation[i] ?? 0,
      wind: h.wind_speed_10m[i],
      uv: h.uv_index[i] ?? 0,
      cloud: h.cloud_cover[i] ?? 0,
    })
  })
  const result = [...days.values()]
  cacheSet(cacheKey, result)
  return result
}

function shiftDate(date: string, years: number, days: number): string {
  const d = new Date(`${date}T12:00:00Z`)
  d.setUTCFullYear(d.getUTCFullYear() + years)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** 去年同一天前后各 7 天的平均气温和雨天数 */
export async function getLastYear(place: Place, date: string): Promise<LastYearWeather> {
  const start = shiftDate(date, -1, -7)
  const end = shiftDate(date, -1, 7)
  const cacheKey = `ly:${key(place)}:${start}`
  const cached = cacheGet<LastYearWeather>(cacheKey, 30 * 24 * HOUR)
  if (cached) return cached

  const url =
    `https://archive-api.open-meteo.com/v1/archive?latitude=${place.lat}&longitude=${place.lon}` +
    `&start_date=${start}&end_date=${end}&daily=temperature_2m_mean,precipitation_sum&timezone=auto`
  const { daily } = await getJson<{ daily: { temperature_2m_mean: (number | null)[]; precipitation_sum: (number | null)[] } }>(url)

  const temps = daily.temperature_2m_mean.filter((x): x is number => x != null)
  const result: LastYearWeather = {
    avgTemp: temps.reduce((a, b) => a + b, 0) / Math.max(temps.length, 1),
    rainyDays: daily.precipitation_sum.filter((x) => (x ?? 0) >= 1).length,
    days: daily.precipitation_sum.length,
  }
  cacheSet(cacheKey, result)
  return result
}
