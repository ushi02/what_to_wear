import { CircleHalf, Moon, Sun } from '@phosphor-icons/react'
import { useEffect, useMemo, useState } from 'react'
import { CityPicker } from './components/CityPicker'
import { TodayView } from './components/TodayView'
import { WardrobeView } from './components/WardrobeView'
import { WishlistView } from './components/WishlistView'
import { I18nContext, LANGS, makeI18n } from './i18n'
import { signIn, signOut, useAuth } from './lib/auth'
import { useCloudSync } from './lib/cloud'
import { useAppState, type Theme } from './lib/storage'

type Tab = 'today' | 'wardrobe' | 'wishlist'

export default function App() {
  const app = useAppState()
  const { items, place, lang, unit, theme } = app.state
  const auth = useAuth()
  const sync = useCloudSync(auth.session, app.state, app.replaceState)
  const i18n = useMemo(() => makeI18n(lang, unit), [lang, unit])
  const { t } = i18n
  const [tab, setTab] = useState<Tab>('today')
  const [picking, setPicking] = useState(false)
  const wishCount = items.filter((i) => i.wishlist).length

  useEffect(() => {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : lang
    document.title = t('app.title')
  }, [lang, t])

  // auto 时跟随系统，系统切换深浅色也实时跟上；index.html 里有一段同样的逻辑防止首屏闪白
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => (document.documentElement.dataset.theme = theme === 'auto' ? (mq.matches ? 'dark' : 'light') : theme)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [theme])

  const themes: [Theme, typeof Sun][] = [
    ['light', Sun],
    ['auto', CircleHalf],
    ['dark', Moon],
  ]

  const tabs: [Tab, string][] = [
    ['today', t('tab.today')],
    ['wardrobe', t('tab.wardrobe')],
    ['wishlist', t('tab.wishlist')],
  ]

  return (
    <I18nContext.Provider value={i18n}>
      <div className="app">
        <header className="topbar">
          <h1 className="brand">
            <span className="brand-label">{t('app.title')}</span>
          </h1>
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
            <div className="seg small icons" role="group" aria-label="Theme">
              {themes.map(([id, Icon]) => (
                <button key={id} className={theme === id ? 'on' : ''} onClick={() => app.setTheme(id)} title={t(`theme.${id}`)} aria-label={t(`theme.${id}`)} aria-pressed={theme === id}>
                  <Icon size={15} weight={theme === id ? 'fill' : 'regular'} />
                </button>
              ))}
            </div>
            {auth.ready &&
              (auth.session ? (
                <div className="seg small account" role="group" aria-label="Account">
                  <span className={`sync-dot ${sync.status}`} role="status" title={t(`sync.${sync.status}`)} aria-label={t(`sync.${sync.status}`)} />
                  <button
                    title={auth.session.email}
                    onClick={async () => {
                      // 退出会作废令牌，先把还没传的改动发出去
                      await sync.flush().catch(() => {})
                      await signOut()
                    }}
                  >
                    {t('account.signOut')}
                  </button>
                </div>
              ) : (
                <div className="seg small" role="group" aria-label="Account">
                  <button onClick={() => signIn()}>{t('account.signIn')}</button>
                </div>
              ))}
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
              onAddCustom={(name, templateId) => app.addCustom(name, templateId)}
              onRemoveCustom={app.removeCustom}
              onReset={app.reset}
            />
          )}
          {tab === 'wishlist' && (
            <WishlistView
              items={items}
              onBought={app.own}
              // 自己加的想买的东西，不要了就直接删，免得留在“我没有的”里
              onRemove={(id) => (items.find((i) => i.id === id)?.custom ? app.removeCustom(id) : app.setWishlist(id, false))}
              onAdd={(name, templateId) => app.addCustom(name, templateId, true)}
            />
          )}
        </main>
      </div>
    </I18nContext.Provider>
  )
}
