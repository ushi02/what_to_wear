import { useState } from 'react'
import { useI18n, type Key } from '../i18n'
import type { Item } from '../types'

interface Props {
  items: Item[]
  title: Key
  placeholder: Key
  onAdd: (name: string, templateId: string) => void
}

/** 自定义单品：起个名字，再挑一件基础款当模板（决定温度区间、图标等） */
export function AddItemForm({ items, title, placeholder, onAdd }: Props) {
  const { t, itemName } = useI18n()
  const [name, setName] = useState('')
  const [template, setTemplate] = useState(items[0]?.id ?? '')

  const add = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    onAdd(name.trim(), template)
    setName('')
  }

  return (
    <section className="card">
      <h2>{t(title)}</h2>
      <form onSubmit={add} className="stack">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t(placeholder)} aria-label={t(placeholder)} />
        <label className="muted small stack-tight">
          {t('wardrobe.asType')}
          <select value={template} onChange={(e) => setTemplate(e.target.value)}>
            {items.filter((i) => !i.custom).map((i) => (
              <option key={i.id} value={i.id}>{t(`cat.${i.category}` as Key)} · {itemName(i)}</option>
            ))}
          </select>
        </label>
        <button type="submit" className="primary">{t('wardrobe.add')}</button>
      </form>
    </section>
  )
}
