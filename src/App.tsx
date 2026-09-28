import { useEffect, useMemo, useState } from 'react'
import { CityPicker } from './components/CityPicker'
import { TodayView } from './components/TodayView'
import { WardrobeView } from './components/WardrobeView'
import { WishlistView } from './components/WishlistView'
import { I18nContext, LANGS, makeI18n } from './i18n'
import { useAppState } from './lib/storage'

type Tab = 'today' | 'wardrobe' | 'wishlist'

export default function App() {
  const app = useAppState()
  const { items, place, lang, unit } = app.state
  const i18n = useMemo(() => makeI18n(lang, unit), [lang, unit])
  const { t } = i18n
  const [tab, setTab] = useState<Tab>('today')
  const [picking, setPicking] = useState(false)
  const wishCount = items.filter((i) => i.wishlist).length

  useEffect(() => {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : lang
    document.title = t('app.title')
  }, [lang, t])

  const tabs: [Tab, string][] = [
    ['today', t('tab.today')],
    ['wardrobe', t('tab.wardrobe')],
    ['wishlist', t('tab.wishlist')],
  ]

  return (
    <I18nContext.Provider value={i18n}>
      <div className="app">
        <header className="topbar">
          <h1>{t('app.title')}</h1>
          <div className="settings">
            <div className="seg small" role="group" aria-label="Language">
              {LANGS.map((l) => (
                <button key={l.id} className={l.id === lang ? 'on' : ''} onClick={() => app.setLang(l.id)}>
                  {l.label}
                </button>
              ))}
            </div>
            <div className="seg small" role="group" aria-label="Unit">
              <button className={unit === 'metric' ? 'on' : ''} onClick={() => app.setUnit('metric')}>°C</button>
              <button className={unit === 'imperial' ? 'on' : ''} onClick={() => app.setUnit('imperial')}>°F</button>
            </div>
          </div>
        </header>

        <nav className="tabs">
          {tabs.map(([key, label]) => (
            <button key={key} className={tab === key ? 'on' : ''} onClick={() => setTab(key)}>
              {label}
              {key === 'wishlist' && wishCount > 0 && <span className="badge">{wishCount}</span>}
            </button>
          ))}
        </nav>

        <main>
          {tab === 'today' &&
            (!place || picking ? (
              <CityPicker
                onPick={(p) => {
                  app.setPlace(p)
                  setPicking(false)
                }}
                onCancel={place ? () => setPicking(false) : undefined}
              />
            ) : (
              <TodayView place={place} items={items} onChangePlace={() => setPicking(true)} onWishlist={(id) => app.setWishlist(id, true)} />
            ))}
          {tab === 'wardrobe' && (
            <WardrobeView
              items={items}
              onDisown={app.disown}
              onOwn={app.own}
              onWishlist={app.setWishlist}
              onAddCustom={app.addCustom}
              onRemoveCustom={app.removeCustom}
              onReset={app.reset}
            />
          )}
          {tab === 'wishlist' && <WishlistView items={items} onBought={app.own} onRemove={(id) => app.setWishlist(id, false)} />}
        </main>
      </div>
    </I18nContext.Provider>
  )
}
