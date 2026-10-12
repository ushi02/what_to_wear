# 用 AWS 给「出门穿什么」加上登录和云端存储

> 目标：用户登录后，衣橱、待购清单、城市、设置跟着账号走，换设备也能同步。
> 现状：纯前端，数据只在浏览器 localStorage 里，没有自己的后端。

---

## 1. 整体架构

```
                    ┌──────────────────────────────┐
  用户浏览器 ───────▶│ CloudFront（CDN）+ S3         │  ① 下载网页（dist/ 静态文件）
     │              └──────────────────────────────┘
     │
     ├────────────▶ Cognito                           ② 登录，拿到"通行证"（JWT 令牌）
     │
     └─ 带着令牌 ──▶ API Gateway ──▶ Lambda ──▶ DynamoDB   ③ 读写自己的衣橱数据
                    （验令牌）     （后端代码）   （数据库）

  天气、地名：浏览器照旧直接请求 Open-Meteo / BigDataCloud，不经过 AWS
```

这套架构叫 **serverless（无服务器）**：不用租、不用维护服务器。有请求时 Lambda 才运行，按次计费，没人用时几乎不花钱。

## 2. 每个服务的角色

| 服务 | 角色 | 在这个 app 里做什么 |
|---|---|---|
| **S3** | 文件仓库 | 存放 `npm run build` 生成的 `dist/` |
| **CloudFront** | 全球 CDN | 从离用户最近的节点发出网页，提供 HTTPS |
| **Cognito** | 账号系统 | 注册、登录、找回密码、Google 登录，登录后发令牌 |
| **API Gateway** | 后端的大门 | 对外提供 `/state` 接口，先检查令牌是否有效 |
| **Lambda** | 后端代码 | 一个函数：读取或写回当前用户的数据 |
| **DynamoDB** | 数据库 | 每个用户一条记录 |

## 3. 一次请求的完整流程

1. 用户打开网站，CloudFront 从 S3 取出网页，浏览器开始运行 React。
2. 用户点"登录"，跳到 Cognito 的登录页，登录成功后带着**令牌**跳回来。令牌是签过名的 JWT，里面写着用户 ID（`sub`），无法伪造。
3. 前端发出 `GET /state`，请求头带上 `Authorization: Bearer <令牌>`。
4. API Gateway 用 Cognito 的公钥验证令牌：伪造或过期的直接拒绝，返回 401，Lambda 不会运行。
5. Lambda 从令牌里读出用户 ID，到 DynamoDB 取出这个人的数据并返回。
6. 用户修改衣橱，前端发 `PUT /state`，Lambda 写回 DynamoDB。

> **关键安全设计**：用户 ID 只从验证过的令牌里取，绝不信任前端传上来的 ID，所以 A 不可能读到 B 的数据。

### 跨域（CORS）

网页在 `xxx.cloudfront.net`，接口在 `xxx.execute-api.ap-southeast-2.amazonaws.com`，两个域名不同。浏览器默认会拦截这种**跨域请求**，所以前端要写接口的完整地址，例如 `fetch('https://xxx.execute-api.../state')`，不能写 `fetch('/state')`。还要在 API Gateway 里开启 CORS：

- 允许的来源：自己的网址 + `http://localhost:5173`（本地开发用）
- 允许的方法：`GET`、`PUT`
- 允许的请求头：`Authorization`、`Content-Type`

HTTP API 在控制台里就有 CORS 设置项，不用改 Lambda 代码。

### 登录相关的配置

- Cognito 用户池选 **Essentials** 档（默认就是）。Lite 和 Essentials 每月 1 万活跃用户以内免费，而且永久免费；**Plus 档没有免费额度**，不要开。
- 应用客户端选**公共客户端（不生成 client secret）**，登录流程用**授权码 + PKCE**。网页代码谁都看得到，存不住 secret。
- 登录后的回调地址（callback URL）和退出后的跳转地址都填两个：正式网址 + `http://localhost:5173`，否则本地开发时登录不了。

## 4. 数据怎么存

现在的 `AppState`（`src/lib/storage.ts`）本来就是一个小 JSON，所以**每个用户存一条**：

```
表名: wtw-users
┌──────────────────┬───────────────────────────────────────────┬────────────┐
│ userId (主键)     │ state                                     │ updatedAt  │
├──────────────────┼───────────────────────────────────────────┼────────────┤
│ "a1b2-..."       │ { items: [...], place: {...}, lang, ... } │ 1760140000 │
└──────────────────┴───────────────────────────────────────────┴────────────┘
```

### 同步策略

- **localStorage 保留**，作为本地缓存：打开时先显示本地数据，后台再拉云端。不登录也照样能用。
- **延迟上传**：修改后等一两秒再上传，连续点击只发一次请求。
- **关页面前补发**：如果用户改完马上关掉页面，等待中的那次上传就丢了。所以要监听 `visibilitychange`，页面隐藏时立刻上传，`fetch` 带上 `keepalive: true`，页面关掉后请求也能发完。
- **冲突处理**（手机和电脑同时改）：
  - 简单做法：以 `updatedAt` 较新的为准（最后写入者胜）。
  - 严谨做法：DynamoDB **条件写入**。带上版本号，版本对不上就拒绝写入，前端重新拉取后再合并。
- **首次登录迁移**：云端还没有数据时，把浏览器里现有的数据传上去。

## 5. 为什么用 DynamoDB，不用 SQL 数据库

先说结论：**这个 app 用 SQL 也完全可以**，选 DynamoDB 是因为它和这个场景、和 Lambda 都更契合。

### 5.1 数据访问方式决定数据库

这个 app 对数据库只有两种操作：

- 按用户 ID 读出一份 JSON
- 按用户 ID 写回一份 JSON

没有表之间的关联，没有"查所有拥有羽绒服的用户"这种查询，也不需要统计报表。这正是**键值存取**，是 DynamoDB 最擅长的：不管数据量多大，按主键读写都是毫秒级。SQL 擅长的 JOIN、复杂筛选、聚合，在这里用不上。

### 5.2 和 Lambda 搭配更省心

| | DynamoDB | SQL 数据库（RDS / Aurora） |
|---|---|---|
| 连接方式 | HTTPS 请求，没有"连接"的概念 | 要维持数据库连接 |
| Lambda 并发时 | 不受影响 | 每个 Lambda 实例各开一条连接，容易把连接数打满，通常要加 RDS Proxy |
| 网络 | 不需要配置 VPC | 数据库一般放在 VPC 里，Lambda 也得进 VPC，配置变复杂 |
| 权限 | 直接用 IAM：Lambda 角色只能读写这一张表 | 另外管理数据库账号和密码（通常配合 Secrets Manager） |
| 闲置成本 | 按请求计费，没人用就是 0 | RDS 实例按小时收费，空着也收钱；Aurora Serverless v2 可以暂停到 0，但恢复时有冷启动延迟 |
| 运维 | 无：没有版本升级、补丁、备份窗口 | 需要关注实例规格、存储、版本升级 |

### 5.3 DynamoDB 的代价

- **查询能力有限**：只能高效地按主键（或事先建好的索引）查。以后要做"热门单品排行""按城市统计"这类需求，就会很别扭。
- **数据建模思路不同**：要先想清楚"怎么查"再设计表，和 SQL 先设计表结构、再随便查的思路正好相反，需要专门学习。
- **SQL 是更通用的技能**：几乎所有后端岗位都会用到。

### 5.4 什么时候该换成 SQL

- 出现用户之间的关系：关注、分享穿搭、评论
- 需要复杂查询或统计报表
- 需要严格的表结构约束和跨多张表的事务

到那时在 AWS 上可以选 Aurora PostgreSQL。另一条路是 Supabase，它本身就是 Postgres。

## 6. 后端代码示意

整个后端大概就这么多（Node.js / TypeScript）：

```ts
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb'

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}))
const TABLE = process.env.TABLE_NAME!

export const handler = async (event: any) => {
  // 用户 ID 来自 API Gateway 验证过的令牌，不信任前端传的任何 ID
  const userId = event.requestContext.authorizer.jwt.claims.sub

  if (event.requestContext.http.method === 'GET') {
    const { Item } = await db.send(new GetCommand({ TableName: TABLE, Key: { userId } }))
    return { statusCode: 200, body: JSON.stringify(Item?.state ?? null) }
  }

  // PUT：整份覆盖。先检查一下，别人往里塞垃圾数据就直接拒绝
  const body = event.body ?? ''
  if (body.length > 50_000) return { statusCode: 413 }
  let state: any
  try {
    state = JSON.parse(body)
  } catch {
    return { statusCode: 400 }
  }
  if (typeof state !== 'object' || state === null || !Array.isArray(state.items)) return { statusCode: 400 }

  await db.send(new PutCommand({ TableName: TABLE, Item: { userId, state, updatedAt: Date.now() } }))
  return { statusCode: 204 }
}
```

一个人的衣橱 JSON 只有几 KB，50 KB 的上限很宽松；DynamoDB 单条记录本身最多 400 KB。

前端主要改 `src/lib/storage.ts`：写 localStorage 的同时调用接口（完整地址，见第 3 节的 CORS）。登录可以用 AWS 官方的 Amplify 库，也可以用通用的 OIDC 库。

## 7. 权限（IAM）：AWS 学习的重点

AWS 里任何东西想访问别的东西，都要有明确授权，这套机制叫 IAM。

- **Lambda 的角色**只允许对 `wtw-users` 这一张表做 `GetItem` / `PutItem`，叫**最小权限原则**。
- **S3 桶不公开**，只允许 CloudFront 读取，这个机制叫 OAC（Origin Access Control）。
- **你自己**用 IAM 用户或 IAM Identity Center（SSO）操作 AWS，**不用 root 账号**，并且给 root 开启 MFA。

## 8. 怎么把资源搭出来

| 方式 | 说明 |
|---|---|
| 控制台手动点 | 第一次建议这样做，能直观看到每个服务 |
| **AWS CDK** / **SAM** | 用代码描述所有资源，一条命令部署；CDK 可以用 TypeScript 写，和本项目同一种语言 |
| **Terraform** | 跨云通用，以后学 GCP 也能用 |

建议先手动搭一遍，理解之后用 CDK 写成代码，最后用 GitHub Actions 做到 push 就自动部署。AWS 凭证用 OIDC 方式授权，**不要把访问密钥存进 GitHub**。

## 9. 费用

估算前提：每个用户每天打开 3 次、修改 2 次，一个月大约 150 次请求。

| 服务 | 免费额度 | ~20 人（约 3 千次请求/月） | ~1000 人（约 15 万次请求/月） |
|---|---|---|---|
| Cognito（Essentials） | 1 万活跃用户/月，永久免费 | $0 | $0 |
| Lambda | 100 万次请求/月，永久免费 | $0 | $0 |
| DynamoDB（按需模式） | 25 GB 存储，永久免费；读写按次收费 | ≈ $0 | ≈ $0.1–0.4 |
| API Gateway（HTTP API） | 新账号用赠送额度抵扣 | ≈ $0.004 | ≈ $0.2 |
| CloudFront | 有 $0/月的免费方案 | $0 | $0 |
| S3（网页约 1 MB） | 用赠送额度抵扣 | < $0.01 | < $0.01 |
| CloudWatch 日志 | 5 GB/月免费 | $0 | $0 |
| **合计** | | **≈ $0** | **< $1/月** |

**可选的开销**：想用自己的域名，域名大约 $10–15 一年，Route 53 托管再加 $0.5 一个月。不用的话，就用 `xxx.cloudfront.net`。

### 9.1 免费套餐：6 个月后账号会关闭

2025 年 7 月 15 日以后新开的账号，注册时二选一：

- **Free plan**：送 $100，完成新手任务最多再送 $100。不会扣费，但 **6 个月到期或额度用完，账号就关闭**，网站也跟着下线；之后有 90 天可以升级找回。
- **Paid plan**：同样送这些额度，用完以后按量付费。

学习阶段选 Free plan。想让网站长期在线，到期前升级成 Paid plan。上表的服务大多有**永久免费额度**，升级以后照样几乎不花钱。

### 9.2 会让人多花钱的坑

- **NAT Gateway**：Lambda 放进 VPC 又要访问外网时会用到，在悉尼大约 **$45 一个月**，没人用也照样收钱。新手被意外扣费，最常见的原因就是它。本方案不用 VPC。
- **RDS 数据库**：按小时收费，没人用也要付钱。
- **Cognito Plus 档**、**WAF 防火墙**这类额外的安全功能，不要随手打开。
- **日志不设保留期限**会一直累积：Lambda 的日志组保留期设成 7 到 14 天。

> **开账号第一件事：设预算告警。** 建一个 Zero spend budget（出现 1 分钱费用就发邮件），或者超过 $5 就提醒的月预算。

## 10. 和另外两个方案比，AWS 好在哪

先说结论：**单论把这个 app 做出来，AWS 不是最好的选择**，Firebase 和 Supabase 都更快、更省事。AWS 的优势在**学习价值、职业价值和长期的灵活性**。

### 10.1 对比表

| | **AWS**（Cognito + Lambda + DynamoDB） | **Firebase**（GCP） | **Supabase** |
|---|---|---|---|
| 上手难度 | 高：服务多，IAM 概念多，控制台复杂 | 低：前端 SDK 直接读写 | 低：前端 SDK 直接读写 |
| 要写的后端代码 | 要写：Lambda + API | 基本不用写 | 基本不用写 |
| 权限控制 | IAM + 后端代码 | Firestore 安全规则 | Postgres 行级安全（RLS） |
| 多设备同步 | 自己实现（见第 4 节） | **内置**：实时监听 + 离线缓存 | 内置实时订阅，离线需自己处理 |
| 数据库类型 | NoSQL（DynamoDB），可换 SQL | NoSQL（Firestore） | **SQL（Postgres）** |
| 被平台绑定的程度 | 中：架构是通用的，具体服务是 AWS 的 | 高：Firestore 的数据和规则很难迁走 | 低：开源，可以自己部署 |
| 灵活性和上限 | **最高**：200 多个服务，什么都能接 | 中：超出 Firebase 范围就要用 GCP | 中 |
| 市场份额与招聘需求 | **最大** | 主要在移动端和初创公司 | 增长快，但还小 |
| 能学到的东西 | **云的底层概念**：IAM、网络、serverless、基础设施即代码 | 怎么用一个后端服务 | SQL + 一个后端服务 |

### 10.2 AWS 具体好在哪

1. **学到的是可迁移的"云的基本功"**。IAM 权限、API 网关、无服务器函数、CDN、基础设施即代码，这些概念在 GCP、Azure 上都有对应物。学会 AWS 这一套，再看别家很快。Firebase 把这些都藏起来了，用起来爽，但学不到底层。
2. **职业价值最高**。AWS 是市场份额最大的云，招聘要求里出现得最多，认证（Solutions Architect Associate 等）认可度也最高。
3. **没有天花板**。以后想加推送通知（SNS）、定时任务（EventBridge，比如每天早上推送穿搭）、图片识别衣服（Rekognition）、接入 Claude（Bedrock），都在同一个平台上，权限体系也是统一的。
4. **每一层都由你控制**。数据结构、接口设计、权限粒度都由你决定，不受某个 SDK 的限制。

### 10.3 AWS 的代价

- 第一次搭建大概要花几天，Firebase 可能一两个小时就跑通了。
- 多设备同步、冲突处理要自己写；Firestore 自带。
- 控制台和文档对新手不友好，IAM 权限配错时报错也不直观。
- 资源多了以后，要自己留意费用和安全配置。

### 10.4 怎么选

| 你的目标 | 建议 |
|---|---|
| 尽快给朋友用上，顺便看看云是什么 | Firebase |
| 想顺便学 SQL，不想被平台绑定 | Supabase |
| **想系统学云、为工作或认证做准备** | **AWS** |
| 都想学 | 先用 Firebase 一两天跑通，再用 AWS 重做一遍，两边对比印象最深 |

## 11. 建议的学习顺序（AWS）

1. **注册账号**：选 Free plan（见 9.1），给 root 开启 MFA，设预算告警，区域用 project 指定的悉尼（ap-southeast-2），用 IAM Identity Center 建一个日常用的管理员账号。
2. **部署前端**：S3 + CloudFront 托管现在的 `dist/`，网站上线。
3. **后端**：建 DynamoDB 表，写 Lambda，挂到 API Gateway 上。先不加登录，用 `curl` 测通读写。
4. **登录**：加 Cognito，给 API Gateway 配置 JWT 验证。
5. **前端接入**：加登录按钮，接入同步逻辑。
6. **自动化**：用 CDK 把整套资源写成代码，配置 GitHub Actions 自动部署。

前两步一个晚上就能做完。第 3、4 步是核心，大部分 AWS 概念都会在这里碰到。

## 12. 实际部署记录

区域：悉尼 `ap-southeast-2`（CloudFront 是全球服务，API 调用走 `us-east-1`）。

### 前端（第 2 步，2026-10-13）

| 资源 | 名称 / ID | 说明 |
|---|---|---|
| 网址 | https://dxms6lt12il94.cloudfront.net | |
| S3 桶 | `wtw-site-<账号ID>` | 私有，阻止所有公共访问，SSE-S3 加密 |
| OAC | `wtw-site-oac`（`E26VBOU61147GJ`） | CloudFront 用 SigV4 签名读取 S3 |
| CloudFront 分发 | `EORJPY4T2JXFT` | 跳转 HTTPS，`CachingOptimized` 缓存策略，`SecurityHeadersPolicy` 安全头 |
| 桶策略 | — | 只允许这个分发 `s3:GetObject` |

重新发布：`npm run deploy`（见 `scripts/deploy.sh`）。`assets/` 文件名带哈希，缓存一年；`index.html` 设为 `no-cache`，发布后立刻生效。
