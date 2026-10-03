import { Check, ShoppingBagOpen } from '@phosphor-icons/react'
import { useI18n, type Key } from '../i18n'
import type { Item } from '../types'
import { ItemIcon } from './icons'

interface Props {
  items: Item[]
  onBought: (id: string) => void
  onRemove: (id: string) => void
}

export function WishlistView({ items, onBought, onRemove }: Props) {
  const { t, itemName } = useI18n()
  const list = items.filter((i) => i.wishlist)
  if (!list.length) {
    return (
      <div className="empty-state">
        <div className="empty-icon" aria-hidden><ShoppingBagOpen size={56} weight="duotone" /></div>
        <p className="muted">{t('wish.empty')}</p>
      </div>
    )
  }
  return (
    <section className="card">
      <ul className="rows">
        {list.map((i) => (
          <li key={i.id}>
            <span className={`row-icon cat-${i.category}`} aria-hidden><ItemIcon item={i} size={24} /></span>
            <div className="row-main">
              <div>{itemName(i)}</div>
              <div className="muted small">{t(`cat.${i.category}` as Key)}</div>
            </div>
            <span className="row">
              <button className="primary" onClick={() => onBought(i.id)}><Check weight="bold" /> {t('wish.bought')}</button>
              <button className="link" onClick={() => onRemove(i.id)}>{t('wish.remove')}</button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
