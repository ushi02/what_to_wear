import { describe, expect, it } from 'vitest'
import { pickNewer } from './cloud'

describe('pickNewer', () => {
  const items = { items: [] }

  it('云端还没数据：上传本地（首次登录迁移）', () => {
    expect(pickNewer({ state: null, updatedAt: null }, 0, null, 'me')).toBe('push')
    expect(pickNewer({ state: null, updatedAt: null }, 1000, 'me', 'me')).toBe('push')
  })

  it('新设备从没改过：用云端的', () => {
    expect(pickNewer({ state: items, updatedAt: 1000 }, 0, null, 'me')).toBe('pull')
  })

  it('谁改得晚用谁的', () => {
    expect(pickNewer({ state: items, updatedAt: 2000 }, 1000, 'me', 'me')).toBe('pull')
    expect(pickNewer({ state: items, updatedAt: 1000 }, 2000, 'me', 'me')).toBe('push')
  })

  it('本地是上一个账号的数据：不管多新都用云端的', () => {
    expect(pickNewer({ state: items, updatedAt: 1000 }, 2000, 'someone-else', 'me')).toBe('pull')
  })
})
