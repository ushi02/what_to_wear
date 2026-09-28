export type Category = 'top' | 'mid' | 'outer' | 'bottom' | 'shoes' | 'accessory'

export const CATEGORIES: Category[] = ['top', 'mid', 'outer', 'bottom', 'shoes', 'accessory']

/** 配件在什么情况下需要带 */
export type AccessoryNeed = 'rain' | 'uv' | 'cold' | 'freezing'

export interface Item {
  id: string
  /** 只有自定义衣物用；基础衣橱的名字走 i18n（item.<id>） */
  name: string
  emoji: string
  /** emoji 没有黑色款，用滤镜压暗 */
  dark?: boolean
  category: Category
  /** 适合的体感温度区间 [min, max]，°C */
  range: [number, number]
  /** 鞋子的防雨等级：0 网面/麂皮（雨天不穿），1 帆布/板鞋，2 皮鞋，3 雨靴/防水靴 */
  rain?: 0 | 1 | 2 | 3
  windproof?: boolean
  need?: AccessoryNeed
  owned: boolean
  wishlist: boolean
  custom?: boolean
}

export interface Place {
  name: string
  lat: number
  lon: number
  /** ISO 国家代码 */
  cc?: string
  /** 内置城市表里的 id，名字随界面语言切换 */
  cityId?: string
  current?: boolean
}

export interface HourWeather {
  hour: number
  temp: number
  feels: number
  precipProb: number
  precip: number
  wind: number
  uv: number
  cloud: number
}

export interface DayWeather {
  date: string
  hours: HourWeather[]
}

export interface LastYearWeather {
  avgTemp: number
  rainyDays: number
  days: number
}
