import { useState } from 'react'
import { CITIES } from '../data/cities'
import { flag, useI18n, type Key } from '../i18n'
import { searchCity } from '../lib/weather'
import type { Place } from '../types'

const POPULAR = ['tokyo', 'shanghai', 'seoul', 'newyork', 'london', 'paris'].map((id) => CITIES.find((c) => c.id === id)!)

export function CityPicker({ onPick, onCancel }: { onPick: (p: Place) => void; onCancel?: () => void }) {
  const { t, lang, country, placeName } = useI18n()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Place[]>()
  const [status, setStatus] = useState<Key | ''>('')

  const locate = () => {
    if (!navigator.geolocation) return setStatus('city.noGeo')
    setStatus('city.locating')
    navigator.geolocation.getCurrentPosition(
      (pos) => onPick({ name: '', lat: pos.coords.latitude, lon: pos.coords.longitude, current: true }),
      () => setStatus('city.geoFailed'),
      { timeout: 10000, maximumAge: 30 * 60 * 1000 },
    )
  }

  const search = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return
    setStatus('city.searching')
    try {
      const found = await searchCity(query.trim(), lang)
      setResults(found)
      setStatus(found.length ? '' : 'city.notFound')
    } catch {
      setResults([])
      setStatus('city.notFound')
    }
  }

  return (
    <section className="card picker">
      <h2 className="picker-title">{t('city.welcome')}</h2>
      <form onSubmit={search} className="search">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('city.placeholder')} aria-label={t('city.placeholder')} />
        <button type="submit" className="primary">{t('city.search')}</button>
      </form>

      {status && <p className="muted small">{t(status)}</p>}

      {results && results.length > 0 ? (
        <ul className="results">
          {results.map((p) => (
            <li key={`${p.lat},${p.lon}`}>
              <button onClick={() => onPick(p)}>
                <span className="flag">{flag(p.cc)}</span>
                <span className="result-name">{placeName(p)}</span>
                <span className="muted small">{country(p.cc)}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="chips">
          {POPULAR.map((c) => (
            <button key={c.id} className="chip" onClick={() => onPick({ name: c[lang], lat: c.lat, lon: c.lon, cc: c.cc, cityId: c.id })}>
              {flag(c.cc)} {c[lang]}
            </button>
          ))}
        </div>
      )}

      <div className="picker-actions">
        <button className="ghost" onClick={locate}>📍 {t('city.useLocation')}</button>
        {onCancel && <button className="link" onClick={onCancel}>{t('city.cancel')}</button>}
      </div>
    </section>
  )
}
