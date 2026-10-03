import {
  BaseballCap,
  Boot,
  Cloud,
  CloudMoon,
  CloudRain,
  CloudSnow,
  CloudSun,
  Hoodie,
  Moon,
  Pants,
  ShirtFolded,
  Sneaker,
  SneakerMove,
  Sun,
  Sunglasses,
  ThermometerCold,
  ThermometerHot,
  TShirt,
  Umbrella,
  type Icon,
  type IconProps,
} from '@phosphor-icons/react'
import type { HourWeather, Item } from '../types'
import { RAIN_PROB } from '../lib/recommend'
import type { Scene } from './WeatherScene'

/**
 * Phosphor 没有的衣物自己画：同样 256 网格、16 描边、圆角端点，
 * duotone 的底色用 currentColor 20% 透明度，和 Phosphor 的 duotone 一致。
 */
function custom(fill: string, lines = '') {
  return function CustomIcon({ size = 24, className }: IconProps) {
    return (
      <svg viewBox="0 0 256 256" width={size} height={size} className={className} fill="none" stroke="currentColor" strokeWidth={16} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d={fill} fill="currentColor" fillOpacity={0.2} />
        {lines && <path d={lines} />}
      </svg>
    )
  }
}

const SLEEVES = 'M92,40 L48,58 L26,166 L60,174 L76,108 L76,216 L180,216 L180,108 L196,174 L230,166 L208,58 L164,40'
const LongSleeve = custom(`${SLEEVES} C164,62 148,76 128,76 C108,76 92,62 92,40 Z`)
const Thermal = custom(`${SLEEVES} C164,62 148,76 128,76 C108,76 92,62 92,40 Z`, 'M76,192 H180 M30,146 L64,154 M226,146 L192,154 M112,104 V176 M144,104 V176')
const Cardigan = custom(`${SLEEVES} L128,120 L92,40 Z`, 'M128,120 V216 M146,150 h0 M146,182 h0')
const Sweater = custom(`${SLEEVES} C164,58 148,68 128,68 C108,68 92,58 92,40 Z`, 'M76,190 H180 M30,146 L64,154 M226,146 L192,154 M112,92 l16,18 l16,-18 M112,128 l16,18 l16,-18 M112,164 l16,18 l16,-18')
const Jacket = custom(`${SLEEVES} L148,64 L128,84 L108,64 Z`, 'M128,84 V216 M96,168 H112 M144,168 H160')
const Puffer = custom(`${SLEEVES} C164,58 148,68 128,68 C108,68 92,58 92,40 Z`, 'M76,112 H180 M76,148 H180 M76,184 H180 M128,68 V216 M40,110 L70,116 M216,110 L186,116')
const HeavyPuffer = custom(
  `M92,52 C92,24 164,24 164,52 L208,64 L230,166 L196,174 L180,112 L180,220 L76,220 L76,112 L60,174 L26,166 L48,64 Z`,
  'M92,52 C100,76 156,76 164,52 M76,112 H180 M76,148 H180 M76,184 H180 M128,72 V220 M40,110 L70,116 M216,110 L186,116',
)
const Shorts = custom('M56,48 H200 L220,176 L150,186 L128,104 L106,186 L36,176 Z', 'M56,76 H200')
const Scarf = custom('M44,56 C44,136 212,136 212,56 L178,56 C178,98 78,98 78,56 Z M98,108 L80,214 L118,222 L134,114 Z M150,112 L164,208 L200,198 L178,100 Z', 'M86,230 l-3,10 M100,232 v10 M114,232 l3,10 M170,222 l2,10 M184,218 l4,10 M198,214 l5,9')
const Mitten = custom('M88,224 V128 C88,80 104,48 136,48 C168,48 184,80 184,128 V224 Z M88,148 C60,140 46,112 58,98 C68,86 82,96 88,110', 'M88,192 H184')
const FlipFlop = custom('M128,24 C170,24 184,66 180,120 C176,180 166,232 128,232 C90,232 80,180 76,120 C72,66 86,24 128,24 Z', 'M128,68 L90,132 M128,68 L166,132')
const Loafer = custom('M24,184 V150 C24,128 44,112 72,104 L104,86 C112,116 152,116 164,94 C204,104 232,136 232,166 V184 Z', 'M24,200 H232 M100,112 C120,134 148,134 166,112')

const ITEM_ICONS: Record<string, Icon | ReturnType<typeof custom>> = {
  'tee-white': TShirt,
  'tee-black': TShirt,
  shirt: ShirtFolded,
  longsleeve: LongSleeve,
  thermal: Thermal,
  'knit-light': Cardigan,
  hoodie: Hoodie,
  sweater: Sweater,
  windbreaker: Jacket,
  'light-down': Puffer,
  'heavy-down': HeavyPuffer,
  shorts: Shorts,
  chinos: Pants,
  jeans: Pants,
  'fleece-pants': Pants,
  canvas: Sneaker,
  'sneaker-white': Sneaker,
  'sneaker-mesh': SneakerMove,
  leather: Loafer,
  boots: Boot,
  sandals: FlipFlop,
  umbrella: Umbrella,
  cap: BaseballCap,
  sunglasses: Sunglasses,
  scarf: Scarf,
  gloves: Mitten,
}

/** 旧版自定义衣物没记模板 id，只能从 emoji 反推 */
const EMOJI_FALLBACK: Record<string, string> = {
  '👕': 'tee-white', '👔': 'shirt', '👚': 'longsleeve', '🌡️': 'thermal', '🧶': 'sweater', '🧥': 'light-down', '🌬️': 'windbreaker',
  '🩳': 'shorts', '👖': 'chinos', '👟': 'canvas', '👞': 'leather', '🥾': 'boots', '🩴': 'sandals',
  '☂️': 'umbrella', '🧢': 'cap', '🕶️': 'sunglasses', '🧣': 'scarf', '🧤': 'gloves',
}

export function ItemIcon({ item, size = 28 }: { item: Item; size?: number }) {
  const C = ITEM_ICONS[item.icon ?? item.id] ?? ITEM_ICONS[EMOJI_FALLBACK[item.emoji] ?? '']
  if (!C) return <span style={{ fontSize: size * 0.85 }}>{item.emoji}</span>
  return <C size={size} weight="duotone" />
}

export function SceneIcon({ scene, night, size }: { scene: Scene; night: boolean; size: number }) {
  const C = { rain: CloudRain, snow: CloudSnow, hot: ThermometerHot, cold: ThermometerCold, cloudy: night ? CloudMoon : Cloud, sunny: night ? Moon : Sun }[scene]
  return <C size={size} weight="duotone" />
}

export function HourIcon({ h, size = 18 }: { h: HourWeather; size?: number }) {
  const night = h.hour >= 19
  const C = h.precipProb >= RAIN_PROB ? CloudRain : h.cloud >= 70 ? Cloud : h.cloud >= 30 ? (night ? CloudMoon : CloudSun) : night ? Moon : Sun
  return <C size={size} weight="fill" />
}
