import { UserCircle } from '@phosphor-icons/react'
import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../i18n'
import { signIn, signOut, type Session } from '../lib/auth'
import type { SyncStatus } from '../lib/cloud'

interface Props {
  session: Session | null
  status: SyncStatus
  /** 退出会作废令牌，退出前先把还没传的改动发出去 */
  flush: () => Promise<void>
}

/** 右上角的账号按钮：没登录是人像图标，登录后是邮箱首字母 + 同步状态点；点开是个小面板 */
export function AccountMenu({ session, status, flush }: Props) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // 点面板外面或按 Esc 关掉
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const initial = session?.email?.[0]?.toUpperCase()

  return (
    <div className="account" ref={ref}>
      <button
        className={`icon-btn${session ? ' signed-in' : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-label={t('account.menu')}
        aria-expanded={open}
        title={session ? t(`sync.${status}`) : t('account.signIn')}
      >
        {initial ? <span className="avatar">{initial}</span> : <UserCircle size={18} weight={session ? 'fill' : 'regular'} />}
        {session && <span className={`sync-dot ${status}`} />}
      </button>

      {open && (
        <div className="account-panel" role="dialog" aria-label={t('account.menu')}>
          {session ? (
            <>
              <div className="account-email">{session.email}</div>
              <div className="account-status">
                <span className={`sync-dot ${status}`} />
                {t(`sync.${status}`)}
              </div>
              <button
                className="ghost"
                onClick={async () => {
                  await flush().catch(() => {})
                  await signOut()
                }}
              >
                {t('account.signOut')}
              </button>
            </>
          ) : (
            <>
              <p className="account-pitch">{t('account.pitch')}</p>
              <button className="primary" onClick={() => signIn()}>
                {t('account.signIn')}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
