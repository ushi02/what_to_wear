// GET /state：读出当前用户的数据；PUT /state：整份覆盖写回
// 部署在 Lambda（Node.js），由 API Gateway HTTP API 调用（payload 2.0）
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb'

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}))
const TABLE = process.env.TABLE_NAME
const MAX_BODY = 50_000

const json = (statusCode, data) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data),
})

export const handler = async (event) => {
  // 用户 ID 只来自 API Gateway 验证过的令牌，不信任前端传的任何 ID。
  // 接入 Cognito 之前，用 ALLOW_TEST_USER=1 让没有令牌的请求当作 test-user。
  const sub = event.requestContext?.authorizer?.jwt?.claims?.sub
  const userId = sub ?? (process.env.ALLOW_TEST_USER === '1' ? 'test-user' : null)
  if (!userId) return json(401, { error: 'unauthorized' })

  const method = event.requestContext.http.method

  if (method === 'GET') {
    const { Item } = await db.send(new GetCommand({ TableName: TABLE, Key: { userId } }))
    return json(200, { state: Item?.state ?? null, updatedAt: Item?.updatedAt ?? null })
  }

  if (method === 'PUT') {
    const raw = event.isBase64Encoded ? Buffer.from(event.body ?? '', 'base64').toString() : (event.body ?? '')
    if (raw.length > MAX_BODY) return json(413, { error: 'too large' })
    let state
    try {
      state = JSON.parse(raw)
    } catch {
      return json(400, { error: 'invalid json' })
    }
    if (typeof state !== 'object' || state === null || !Array.isArray(state.items)) {
      return json(400, { error: 'state.items must be an array' })
    }
    const updatedAt = Date.now()
    await db.send(new PutCommand({ TableName: TABLE, Item: { userId, state, updatedAt } }))
    return json(200, { updatedAt })
  }

  return json(405, { error: 'method not allowed' })
}
