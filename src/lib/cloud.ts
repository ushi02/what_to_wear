import { useEffect, useRef, useState } from 'react'
import { AWS } from '../config'
import { getAccessToken, type Session } from './auth'
import { getChangedAt, getOwner, normalize, setOwner, type AppState } from './storage'

export interface Remote {
  state: Partial<AppState> | null
  /** 服务器写入时间（毫秒） */
  updatedAt: number | null
}

export type SyncStatus = 'off' | 'syncing' | 'synced' | 'error'

/**
 * 登录时本地和云端谁更新：云端没数据就上传本地（首次登录迁移）；
 * 本地数据属于别的账号就用云端的；否则谁改得晚用谁的（最后写入者胜）
 */
export function pickNewer(remote: Remote, localChangedAt: number, localOwner: string | null, sub: string): 'push' | 'pull' {
  if (!remote.state || remote.updatedAt == null) return 'push'
  if (localOwner && localOwner !== sub) return 'pull'
  return remote.updatedAt > localChangedAt ? 'pull' : 'push'
}

class HttpError extends Error {
  readonly status: number
  constructor(status: number) {
    super(`HTTP ${status}`)
    this.status = status
  }
}

async function call(method: 'GET' | 'PUT', body?: string, keepalive = false): Promise<Response> {
  const send = async () => {
    const token = await getAccessToken()
    if (!token) throw new HttpError(401)
    return fetch(`${AWS.apiUrl}/state`, {
      method,
      body,
      keepalive,
      headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    })
  }
  let res = await send()
  // 令牌刚好在路上过期：getAccessToken 会换新的，再试一次
  if (res.status === 401) res = await send()
  if (!res.ok) throw new HttpError(res.status)
  return res
}

const getRemote = async (): Promise<Remote> => (await call('GET')).json()
const putRemote = (body: string, keepalive = false) => call('PUT', body, keepalive)

/** 登录后把 state 和云端双向同步；没登录时什么也不做 */
export function useCloudSync(session: Session | null, state: AppState, replaceState: (s: AppState) => void) {
  const [status, setStatus] = useState<SyncStatus>('off')
  // 首次拉取完成前不上传，免得旧数据盖掉云端
  const ready = useRef(false)
  // 最后一次和云端一致的内容，相同就不重复上传
  const synced = useRef<string | null>(null)
  const pending = useRef<string | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const latest = useRef(state)
  useEffect(() => {
    latest.current = state
  }, [state])

  /** 立刻上传还没传的改动 */
  const flush = async (keepalive = false) => {
    window.clearTimeout(timer.current)
    const body = pending.current
    if (!body) return
    pending.current = null
    setStatus('syncing')
    await putRemote(body, keepalive)
      .then(() => {
        synced.current = body
        setStatus(pending.current ? 'syncing' : 'synced')
      })
      .catch((e) => {
        console.warn('[sync] upload failed', e)
        pending.current ??= body // 下次改动或切走页面时再试
        setStatus('error')
      })
  }

  // 登录（或换账号）后先拉一次。依赖 sub 而不是令牌：令牌每小时自动换新，不用每次重新拉
  const sub = session?.sub
  useEffect(() => {
    ready.current = false
    synced.current = null
    pending.current = null
    if (!sub) return
    let cancelled = false
    ;(async () => {
      setStatus('syncing')
      const remote = await getRemote()
      if (cancelled) return
      const pull = pickNewer(remote, getChangedAt(), getOwner(), sub) === 'pull'
      if (pull) {
        const next = normalize(remote.state!)
        synced.current = JSON.stringify(next)
        replaceState(next)
      } else {
        const body = JSON.stringify(latest.current)
        await putRemote(body)
        synced.current = body
      }
      setOwner(sub)
      if (cancelled) return
      ready.current = true
      setStatus('synced')
      // 上传期间用户又改了东西：补传一次（拉取时用户的改动已经被云端数据覆盖，不用补）
      const now = JSON.stringify(latest.current)
      if (!pull && now !== synced.current) {
        pending.current = now
        await flush()
      }
    })().catch((e) => {
      console.warn('[sync] initial sync failed', e)
      if (!cancelled) setStatus('error')
    })
    return () => {
      cancelled = true
    }
  }, [sub, replaceState])

  // 改动后停 1.5 秒再上传，连续点击只发一次
  useEffect(() => {
    if (!sub || !ready.current) return
    const body = JSON.stringify(state)
    if (body === synced.current) return
    pending.current = body
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => flush(), 1500)
  }, [state, sub])

  // 切到别的应用或关页面时立刻补发；keepalive 让页面关掉后请求也能发完
  useEffect(() => {
    const onHide = () => document.visibilityState === 'hidden' && void flush(true)
    document.addEventListener('visibilitychange', onHide)
    return () => document.removeEventListener('visibilitychange', onHide)
  }, [])

  return { status: sub ? status : ('off' as SyncStatus), flush }
}
