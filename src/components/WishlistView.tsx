import { useI18n, type Key } from '../i18n'
import type { Item } from '../types'

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
        <div className="empty-emoji" aria-hidden>🛍️</div>
        <p className="muted">{t('wish.empty')}</p>
      </div>
    )
  }
  return (
    <section className="card">
      <ul className="rows">
        {list.map((i) => (
          <li key={i.id}>
            <span className="row-emoji" aria-hidden>{i.emoji}</span>
            <div className="row-main">
              <div>{itemName(i)}</div>
              <div className="muted small">{t(`cat.${i.category}` as Key)}</div>
            </div>
            <span className="row">
              <button className="primary" onClick={() => onBought(i.id)}>✓ {t('wish.bought')}</button>
              <button className="link" onClick={() => onRemove(i.id)}>{t('wish.remove')}</button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
