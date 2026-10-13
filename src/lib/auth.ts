import { UserManager, WebStorageStateStore, type User } from 'oidc-client-ts'
import { useEffect, useState } from 'react'
import { AWS } from '../config'

// 回调地址必须和 Cognito 应用客户端里登记的完全一致（包括结尾的 /）
const home = () => `${location.origin}/`

// 用到时才创建：测试环境里没有 location / localStorage
let instance: UserManager | undefined
const mgr = () =>
  (instance ??= new UserManager({
    authority: AWS.issuer,
    client_id: AWS.clientId,
    redirect_uri: home(),
    post_logout_redirect_uri: home(),
    response_type: 'code', // 授权码 + PKCE，库会自动生成暗号
    scope: 'openid email',
    // 默认存 sessionStorage，关掉标签页就得重新登录；存 localStorage 换来 30 天免登录
    userStore: new WebStorageStateStore({ store: localStorage }),
    // access token 快过期时用 refresh token 自动换新的
    automaticSilentRenew: true,
  }))

export interface Session {
  /** 用户 ID，和 DynamoDB 里的 userId 一样 */
  sub: string
  email?: string
}

const toSession = (u: User | null): Session | null => (u && !u.expired ? { sub: u.profile.sub, email: u.profile.email } : null)

/** 当前的 access token；过期了就先用 refresh token 换一个，换不到返回 undefined */
export async function getAccessToken(): Promise<string | undefined> {
  const u = await mgr().getUser()
  if (!u) return undefined
  if (!u.expired) return u.access_token
  try {
    return (await mgr().signinSilent())?.access_token
  } catch {
    await mgr().removeUser()
    return undefined
  }
}

export const signIn = () => mgr().signinRedirect()

export async function signOut() {
  // 先作废 refresh token，再跳到 Cognito 清掉登录页记住的会话，否则下次点登录会直接登进去
  await mgr().revokeTokens(['refresh_token']).catch(() => {})
  await mgr().signoutRedirect({ extraQueryParams: { client_id: AWS.clientId, logout_uri: home() } })
}

// code 只能用一次；StrictMode 下 effect 会跑两次，所以放在模块级只处理一回
let callback: Promise<void> | undefined

async function handleCallback() {
  const params = new URLSearchParams(location.search)
  if (!params.has('state') || !(params.has('code') || params.has('error'))) return
  // 从 Cognito 登录页跳回来：用 ?code= 和本地存的 PKCE 暗号换令牌，然后把地址栏收拾干净
  try {
    await mgr().signinRedirectCallback()
  } catch (e) {
    console.warn('[auth] sign-in callback failed', e)
  }
  history.replaceState(null, '', location.pathname)
}

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const onLoaded = (u: User) => setSession(toSession(u))
    const onUnloaded = () => setSession(null)
    const { events } = mgr()
    events.addUserLoaded(onLoaded)
    events.addUserUnloaded(onUnloaded)

    let cancelled = false
    ;(async () => {
      await (callback ??= handleCallback())
      const token = await getAccessToken()
      const u = token ? await mgr().getUser() : null
      if (!cancelled) {
        setSession(toSession(u))
        setReady(true)
      }
    })()

    return () => {
      cancelled = true
      events.removeUserLoaded(onLoaded)
      events.removeUserUnloaded(onUnloaded)
    }
  }, [])

  return { session, ready }
}
