import type { Condition } from '../lib/recommend'

export type Scene = Condition | 'snow'

interface Props {
  scene: Scene
  night: boolean
}

/** 位置用下标算，每次渲染都一样，不会闪 */
const spread = (n: number, seed: number) => Array.from({ length: n }, (_, i) => ((i * 37 + seed) % 100) / 100)

/** hero 卡片背后的天气动画：雨滴、雪花、云、太阳光晕、星星，纯 CSS 驱动 */
export function WeatherScene({ scene, night }: Props) {
  return (
    <div className="scene" aria-hidden>
      {night ? <Stars /> : (scene === 'sunny' || scene === 'hot') && <div className={`sun ${scene === 'hot' ? 'sun--hot' : ''}`} />}
      {night && scene !== 'rain' && scene !== 'snow' && <div className="moon" />}
      {(scene === 'cloudy' || scene === 'rain' || scene === 'snow' || scene === 'cold') && <Clouds dense={scene !== 'cold'} />}
      {scene === 'rain' && <Particles kind="drop" n={36} />}
      {scene === 'snow' && <Particles kind="flake" n={28} />}
      {scene === 'cold' && <Particles kind="frost" n={10} />}
    </div>
  )
}

function Stars() {
  const ys = spread(24, 11)
  return (
    <>
      {spread(24, 5).map((x, i) => (
        <span key={i} className="star" style={{ left: `${x * 100}%`, top: `${ys[i] * 60}%`, animationDelay: `${(i % 7) * 0.6}s` }} />
      ))}
    </>
  )
}

function Clouds({ dense }: { dense: boolean }) {
  return (
    <>
      <span className="cloud cloud--1" />
      <span className="cloud cloud--2" />
      {dense && <span className="cloud cloud--3" />}
    </>
  )
}

function Particles({ kind, n }: { kind: 'drop' | 'flake' | 'frost'; n: number }) {
  const delays = spread(n, 23)
  const ys = spread(n, 61)
  return (
    <>
      {spread(n, 3).map((x, i) => (
        <span
          key={i}
          className={kind}
          style={{
            left: `${x * 100}%`,
            // 雨雪从顶上落下；霜花固定位置闪烁
            top: kind === 'frost' ? `${ys[i] * 90}%` : undefined,
            animationDelay: `${-delays[i] * 4}s`,
            animationDuration: `${kind === 'drop' ? 0.7 + (i % 4) * 0.15 : 4 + (i % 5)}s`,
          }}
        />
      ))}
    </>
  )
}
