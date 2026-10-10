import { useState } from 'react'
import { useI18n, type Key } from '../i18n'
import { CATEGORIES, type Item } from '../types'
import { AddItemForm } from './AddItemForm'
import { ItemIcon } from './icons'

interface Props {
  items: Item[]
  onDisown: (id: string) => void
  onOwn: (id: string) => void
  onWishlist: (id: string, on: boolean) => void
  onAddCustom: (name: string, templateId: string) => void
  onRemoveCustom: (id: string) => void
  onReset: () => void
}

export function WardrobeView({ items, onDisown, onOwn, onWishlist, onAddCustom, onRemoveCustom, onReset }: Props) {
  const { t, itemName } = useI18n()
  const [confirmReset, setConfirmReset] = useState(false)
  const missing = items.filter((i) => !i.owned)
  const catLabel = (c: string) => t(`cat.${c}` as Key)

  return (
    <>
      <p className="intro">{t('wardrobe.intro')}</p>

      {CATEGORIES.map((cat) => {
        const owned = items.filter((i) => i.category === cat && i.owned)
        if (!owned.length) return null
        return (
          <section className="section" key={cat}>
            <h2>{catLabel(cat)}</h2>
            <div className="closet">
              {owned.map((i) => (
                <div key={i.id} className="closet-item">
                  <span className={`closet-icon cat-${i.category}`} aria-hidden><ItemIcon item={i} size={30} /></span>
                  <span className="closet-name">{itemName(i)}</span>
                  <button className="link small" onClick={() => (i.custom ? onRemoveCustom(i.id) : onDisown(i.id))}>
                    {t(i.custom ? 'wardrobe.delete' : 'wardrobe.dontHave')}
                  </button>
                </div>
              ))}
            </div>
          </section>
        )
      })}

      {missing.length > 0 && (
        <section className="section">
          <h2>{t('wardrobe.missing')}</h2>
          <div className="closet">
            {missing.map((i) => (
              <div key={i.id} className="closet-item off">
                <span className={`closet-icon cat-${i.category}`} aria-hidden><ItemIcon item={i} size={30} /></span>
                <span className="closet-name">{itemName(i)}</span>
                <span className="closet-actions">
                  {!i.wishlist && <button className="link small" onClick={() => onWishlist(i.id, true)}>+ {t('wardrobe.want')}</button>}
                  <button className="link small" onClick={() => onOwn(i.id)}>{t('wardrobe.haveIt')}</button>
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <AddItemForm items={items} title="wardrobe.addTitle" placeholder="wardrobe.namePh" onAdd={onAddCustom} />

      <div className="reset">
        {confirmReset ? (
          <span className="row">
            <span className="muted small">{t('wardrobe.resetConfirm')}</span>
            <button className="danger" onClick={() => { onReset(); setConfirmReset(false) }}>{t('wardrobe.resetYes')}</button>
            <button className="link" onClick={() => setConfirmReset(false)}>{t('wardrobe.resetNo')}</button>
          </span>
        ) : (
          <button className="link muted" onClick={() => setConfirmReset(true)}>{t('wardrobe.reset')}</button>
        )}
      </div>
    </>
  )
}
