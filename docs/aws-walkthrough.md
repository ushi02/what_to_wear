# 从零把「出门穿什么」部署到 AWS：完整过程记录

> 2026-10-13 的实操记录。每一步都写了**做了什么**、**为什么这么做**、**怎么验证的**，以及途中**踩过的坑**。
> 设计思路和方案对比见 [`aws-backend.md`](aws-backend.md)，这里只讲实际怎么一步步搭出来的。

---

## 目录

0. [最终成果一览](#0-最终成果一览)
1. [准备工作](#1-准备工作)
2. [第 2 步：前端上线（S3 + CloudFront）](#2-第-2-步前端上线s3--cloudfront)
3. [第 3 步：后端（DynamoDB + Lambda + API Gateway）](#3-第-3-步后端dynamodb--lambda--api-gateway)
4. [第 4 步：登录（Cognito）](#4-第-4-步登录cognito)
5. [第 5 步：前端接入登录和同步](#5-第-5-步前端接入登录和同步)
6. [安全设计汇总](#6-安全设计汇总)
7. [费用](#7-费用)
8. [踩过的坑](#8-踩过的坑)
9. [常用命令速查](#9-常用命令速查)
10. [术语表](#10-术语表)
11. [第 6 步：基础设施即代码 + CI/CD](#11-第-6-步基础设施即代码--cicd)

---

## 0. 最终成果一览

**网址**：https://dxms6lt12il94.cloudfront.net

```
                       ┌─────────────────────────────────────┐
  浏览器 ── HTTPS ───▶ │ CloudFront（CDN）                    │ ① 下载网页
     │                 │   └─ 用 OAC 签名 ─▶ S3 桶（私有）     │
     │                 └─────────────────────────────────────┘
     │
     ├── 登录 ───────▶ Cognito 托管登录页                     ② 授权码 + PKCE，换到 JWT 令牌
     │
     └── 带令牌 ─────▶ API Gateway ──▶ Lambda ──▶ DynamoDB    ③ 读写自己的衣橱
                       （验证 JWT）    （wtw-state） （wtw-users）

  天气 / 地名：浏览器照旧直接请求 Open-Meteo / BigDataCloud，不经过 AWS
```

所有资源都在 **悉尼（ap-southeast-2）**。这是 project 指定的区域，只能用这一个。CloudFront 是全球服务，它的 API 走 `us-east-1`。

| 层 | 资源 | ID / 名称 |
|---|---|---|
| 网页 | S3 桶 | `wtw-site-<账号ID>` |
| | CloudFront 分发 | `EORJPY4T2JXFT`（`dxms6lt12il94.cloudfront.net`） |
| | OAC | `wtw-site-oac`（`E26VBOU61147GJ`） |
| 后端 | DynamoDB 表 | `wtw-users` |
| | Lambda 函数 | `wtw-state` |
| | Lambda 的 IAM 角色 | `wtw-state-lambda` |
| | 日志组 | `/aws/lambda/wtw-state` |
| | HTTP API | `wtw-api`（`3vq36jfo5i`） |
| 登录 | Cognito 用户池 | `wtw-users`（`ap-southeast-2_ggK9a6xv4`） |
| | 应用客户端 | `wtw-web`（`1jpdh7q27mma1of8afjoh9e7vn`） |
| | 登录页域名 | `wtw-login.auth.ap-southeast-2.amazoncognito.com` |
| | JWT 授权器 | `cognito-jwt`（`xqs2zo`） |
| 管理 | CloudFormation 栈 | `what-to-wear`（上面所有资源都在里面，由 `infra/` 的 CDK 代码管理） |
| 自动部署 | CodeBuild 项目 | `wtw-deploy`（push 到 main 时触发） |
| | GitHub 连接 | `wtw-github`（CodeConnections） |
| | CodeBuild 的 IAM 角色 | `wtw-deploy-codebuild` |

相关代码：

| 文件 | 作用 |
|---|---|
| `backend/state/index.mjs` | Lambda 后端代码 |
| `src/config.ts` | 前端用到的 AWS 地址和 ID |
| `src/lib/auth.ts` | 登录 / 退出 |
| `src/lib/cloud.ts` | 和云端同步 |
| `scripts/deploy.sh` | `npm run deploy`：发布前端 |
| `infra/` | CDK 代码：全部 AWS 资源（`npm run deploy:infra` 部署） |
| `buildspec.yml` | CodeBuild 自动部署的步骤 |
| `.github/workflows/ci.yml` | GitHub Actions 自动测试的步骤 |

---

## 1. 准备工作

### 1.1 AWS 账号的情况

- 用的是 AWS 的"新体验"：用社交账号登录，账号叫 **project**，管理页面在 [AWS Settings](https://settings.aws.com/)（账单、成员、花费上限）。真正的资源在 AWS 管理控制台里看。
- 套餐是 **Free plan**：送 $120 额度，**2027-04-12 到期**。到期或额度用完，账号就会关闭，网站也跟着下线。想长期在线，到期前要升级成 Paid plan。
- 已经有一个 **Zero-Spend Budget**：只要产生 1 分钱费用就发邮件提醒。

### 1.2 本机怎么操作 AWS

| 方式 | 用在哪 | 说明 |
|---|---|---|
| `aws` 命令行（profile `wtw`） | 上传文件、更新 Lambda 代码、部署脚本 | 用 `aws login --profile wtw` 登录，拿到的是**临时凭证**，过期了重新登录就行 |
| AWS MCP 工具 | 大部分建资源的操作 | 在 AWS 托管的沙箱里执行，有审计日志。但沙箱不能读本机文件，也不能打 zip 包 |

> **为什么不用"访问密钥"（Access Key）？** 长期有效的密钥一旦泄露，别人就能一直用你的账号。`aws login` 拿到的是几小时就过期的临时凭证，安全得多。

### 1.3 第一件事：确认现状

```bash
aws sts get-caller-identity          # 我是谁？凭证有效吗？
aws freetier get-account-plan-state  # 什么套餐、剩多少额度、哪天到期
```

确认账号里还没有任何 S3 桶和 CloudFront 分发，然后从第 2 步开始。

---

## 2. 第 2 步：前端上线（S3 + CloudFront）

### 2.1 先理解几个概念

- **静态网站**：`npm run build` 生成的 `dist/` 只是一堆文件（HTML、JS、CSS、字体）。浏览器把它们下载下来，React 在浏览器里运行。服务器不需要执行任何代码，只要把文件原样发出去就行。
- **S3**：AWS 的"文件仓库"（对象存储）。一个仓库叫一个**桶（bucket）**，桶名全球唯一。
- **CloudFront**：AWS 的 **CDN（内容分发网络）**。全球有几百个**边缘节点**，会把文件缓存在离用户最近的节点上，所以快。它还负责 HTTPS 证书，并自带 DDoS 防护。
- **OAC（Origin Access Control）**：CloudFront 去 S3 取文件时出示的"工作证"。有了它，S3 桶就可以完全不公开。

> **为什么不直接用 S3 的"静态网站托管"功能？** 很多旧教程会让你把桶设成公开，再开启"静态网站托管"。缺点有两个：一是**只支持 HTTP，不支持 HTTPS**；二是桶直接暴露在外，别人可以绕过 CloudFront 狂刷你的桶。现在推荐的做法是**私有桶 + CloudFront + OAC**。

### 2.2 构建

```bash
npm test        # 29 个测试通过
npm run build   # 生成 dist/，9 个文件，约 530 KB
```

当时 `dist/` 是两天前构建的，之后还改过样式，所以先重新构建，免得上线的是旧版本。

### 2.3 建 S3 桶

| 设置 | 值 | 为什么 |
|---|---|---|
| 桶名 | `wtw-site-<账号ID>` | 桶名全球唯一，加上账号 ID 基本不会和别人撞名 |
| 区域 | `ap-southeast-2` | project 只能用这个区域 |
| 阻止所有公共访问 | 4 项全开 | 桶绝不对外公开，只让 CloudFront 读 |
| 加密 | SSE-S3（默认） | 存储时自动加密，免费 |

### 2.4 上传文件：两个关键属性

每个文件上传时都设了：

**① `Content-Type`**：告诉浏览器这是什么文件。设错了，浏览器可能不执行 JS，或者不认字体。

| 文件 | Content-Type |
|---|---|
| `.html` | `text/html; charset=utf-8` |
| `.js` | `text/javascript; charset=utf-8` |
| `.css` | `text/css; charset=utf-8` |
| `.woff2` | `font/woff2` |
| `.svg` | `image/svg+xml` |

**② `Cache-Control`**：告诉浏览器（和 CloudFront）这个文件可以缓存多久。

| 文件 | Cache-Control | 原因 |
|---|---|---|
| `assets/*`（例如 `index-ByJzgRGj.js`） | `public, max-age=31536000, immutable` | 文件名里的 `ByJzgRGj` 是**内容哈希**，内容一变名字就变。所以同一个文件名的内容永远不会变，可以放心缓存一年 |
| `index.html`、`favicon.svg` | `no-cache` | 浏览器每次都要回来确认有没有新版。`index.html` 里写着当前该用哪个 JS 文件，所以它必须是最新的 |

> 这个组合是前端部署的经典做法：**入口文件不缓存，带哈希的资源文件永久缓存**。发布新版本时，用户马上就能拿到新的 `index.html`，它指向新的 JS 文件名，旧缓存自然就不用了。

上传方式：MCP 工具生成**预签名 URL**（15 分钟内有效的临时上传链接），本机用 `curl -X PUT` 上传。整个过程本机不需要保存任何密钥。

### 2.5 建 CloudFront 分发

| 设置 | 值 | 说明 |
|---|---|---|
| 源站（Origin） | S3 桶的区域端点 + OAC | 一建好就是锁定状态，不存在"先公开、再加锁"的空窗期 |
| 查看器协议策略 | `redirect-to-https` | 访问 http:// 自动跳到 https:// |
| 默认根对象 | `index.html` | 访问 `/` 时返回 `index.html` |
| 缓存策略 | `Managed-CachingOptimized` | AWS 托管的策略，会尊重源站的 `Cache-Control` |
| 压缩 | 开 | 自动 gzip / brotli，380 KB 的 JS 传输时只有约 115 KB |
| 响应头策略 | `Managed-SecurityHeadersPolicy` | 自动加浏览器安全头（见下） |
| HTTP 版本 | HTTP/2 和 HTTP/3 | 更快 |

`SecurityHeadersPolicy` 加上的安全头：

| 响应头 | 作用 |
|---|---|
| `Strict-Transport-Security` | 告诉浏览器"以后只用 HTTPS 访问我"（HSTS） |
| `X-Frame-Options: SAMEORIGIN` | 禁止别的网站把你的页面嵌进 iframe（防点击劫持） |
| `X-Content-Type-Options: nosniff` | 浏览器严格按 Content-Type 处理，不自己猜文件类型 |
| `Referrer-Policy` | 跳转到别的网站时，少泄露当前网址 |

**有意没开的两项**：

| 功能 | 为什么没开 |
|---|---|
| 访问日志 | 正式项目建议开，方便排查问题和审计。学习项目用处不大，还要多建一个存日志的地方 |
| WAF 防火墙 | 每月约 $5 起，不在免费额度内。纯静态网站有 CloudFront 自带的 Shield Standard 就够了 |

### 2.6 S3 桶策略：只让这一个分发读

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "AllowCloudFrontRead",
    "Effect": "Allow",
    "Principal": { "Service": "cloudfront.amazonaws.com" },
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::wtw-site-<账号ID>/*",
    "Condition": {
      "StringEquals": {
        "AWS:SourceArn": "arn:aws:cloudfront::<账号ID>:distribution/EORJPY4T2JXFT"
      }
    }
  }]
}
```

逐行解释：

- `Effect: Allow`：这是一条"允许"规则
- `Principal`：允许**谁**？CloudFront 服务
- `Action: s3:GetObject`：允许**做什么**？只能读文件，不能写、不能删、不能列出目录
- `Resource`：对**哪些东西**？这个桶里的所有文件（`/*`）
- `Condition`：**附加条件**：请求必须来自 `EORJPY4T2JXFT` 这一个分发。没有这个条件的话，任何人的 CloudFront 分发都能读你的桶

> 这就是 **最小权限原则**：只给刚好够用的权限。这是 IAM 最重要的思想，后面会反复用到。

### 2.7 验证

| 测试 | 结果 | 说明 |
|---|---|---|
| `https://dxms6lt12il94.cloudfront.net/` | 200 | 首页正常 |
| 响应头 | 有 HSTS、X-Frame-Options 等 | 安全头生效 |
| 直接访问 S3 地址 | **403** | 桶确实没有对外公开 |

分发刚建好时状态是 `InProgress`，配置正在同步到全球的边缘节点，要等几分钟。

### 2.8 一键重新部署：`npm run deploy`

`scripts/deploy.sh` 会依次做这几件事：

1. `npm test` + `npm run build`
2. `aws s3 sync dist/assets ... --size-only --delete`：上传带哈希的文件（缓存一年），删掉 S3 上已经没用的旧文件
3. `aws s3 sync dist ... --exclude "assets/*" --delete`：上传 `index.html` 等入口文件（`no-cache`）
4. `aws cloudfront create-invalidation --paths "/index.html" "/"`：让 CloudFront 边缘节点丢掉旧的 `index.html`（每月前 1000 个路径免费）

> `--size-only` 的意思是只比较文件大小，不比较修改时间。带哈希的文件名字相同，内容就一定相同，没必要因为本地重新构建、修改时间变了就重传。

---

## 3. 第 3 步：后端（DynamoDB + Lambda + API Gateway）

### 3.1 概念

- **Serverless（无服务器）**：不用自己租服务器、装系统、打补丁。有请求时 AWS 才启动你的代码，按次计费，没人用就几乎不花钱。
- **Lambda**：放一段函数代码，有请求时 AWS 帮你运行。
- **API Gateway**：后端的"大门"。给 Lambda 一个公开的 HTTPS 网址，还负责限流、CORS 和验证令牌。
- **DynamoDB**：键值型 NoSQL 数据库。按主键读写都是毫秒级，按次计费。
- **IAM 角色**：一张"工作证"，规定**谁能戴**（信任策略）和**戴上能做什么**（权限策略）。
- **CloudWatch Logs**：日志仓库，Lambda 里 `console.log` 的内容都会存到这里。

### 3.2 DynamoDB 表 `wtw-users`

| 设置 | 值 | 为什么 |
|---|---|---|
| 主键（Partition key） | `userId`（字符串） | 每个用户一条记录 |
| 计费模式 | 按需（PAY_PER_REQUEST） | 按读写次数收费，没人用就是 $0，不用预估容量 |
| 删除保护 | 开 | 存的是用户数据，防止误删。代价是以后清理时要先关掉保护 |
| 时间点恢复（PITR） | 暂时不开 | 能把表恢复到 35 天内的任意时刻，但按数据量收费。等真有用户数据再开 |

一条记录长这样：

```
userId: "f99e9498-..."          ← Cognito 用户 ID（sub）
state:  { items: [...], place: {...}, lang: "zh", unit: "metric", theme: "auto" }
updatedAt: 1791853309846        ← 服务器写入的时间（毫秒）
```

### 3.3 IAM 角色 `wtw-state-lambda`

**信任策略**：谁能戴这张工作证？

```json
{
  "Effect": "Allow",
  "Principal": { "Service": "lambda.amazonaws.com" },
  "Action": "sts:AssumeRole",
  "Condition": { "StringEquals": { "aws:SourceAccount": "<账号ID>" } }
}
```

只有 Lambda 服务能戴，而且必须是你这个账号里的 Lambda。`aws:SourceAccount` 条件是为了防一种叫**混淆代理（confused deputy）**的攻击：别人账号里的服务被骗来使用你的角色。

**权限策略**：戴上以后能做什么？

```json
[
  { "Action": ["dynamodb:GetItem", "dynamodb:PutItem"],
    "Resource": "arn:aws:dynamodb:ap-southeast-2:<账号ID>:table/wtw-users" },
  { "Action": ["logs:CreateLogStream", "logs:PutLogEvents"],
    "Resource": "arn:aws:logs:ap-southeast-2:<账号ID>:log-group:/aws/lambda/wtw-state:*" }
]
```

- 数据库：只能对**这一张表**做**读一条**和**写一条**。连删除（DeleteItem）和扫描全表（Scan）都不给
- 日志：只能往**自己的日志组**里写

> 万一 Lambda 代码有漏洞被利用，攻击者也只能读写这张表的单条记录，碰不到账号里的任何其他东西。

### 3.4 日志组 `/aws/lambda/wtw-state`

**提前手动建好，并把保留期设成 14 天**。如果让 Lambda 自动建日志组，日志默认**永久保存**，会一直累积、一直收费。

### 3.5 Lambda 函数 `wtw-state`

| 设置 | 值 | 为什么 |
|---|---|---|
| 运行环境 | Node.js 24 | 最新的 LTS 版本 |
| 架构 | arm64（Graviton） | 比 x86 便宜约 20%，对这段 JS 代码没有任何影响 |
| 内存 | 256 MB | Lambda 分配的 CPU 和内存成正比，256 MB 冷启动更快，费用仍在免费额度内 |
| 超时 | 5 秒 | 正常请求不到 0.1 秒，5 秒足够宽松 |
| 环境变量 | `TABLE_NAME=wtw-users` | 表名不写死在代码里 |
| 日志格式 | JSON | 方便以后用 CloudWatch Logs Insights 查询 |

代码在 `backend/state/index.mjs`，核心逻辑：

```js
// 用户 ID 只从 API Gateway 验证过的令牌里取，绝不信任前端传上来的任何 ID
const userId = event.requestContext?.authorizer?.jwt?.claims?.sub
if (!userId) return json(401, ...)

GET  → GetItem 读出这个人的记录
PUT  → 检查：body ≤ 50 KB、是合法 JSON、items 是数组 → PutItem 整份覆盖
```

> **为什么要检查输入？** 接口是公开的，任何人都可以往里发垃圾数据。限制大小可以防止有人把数据库塞满；检查格式可以防止存进去的数据把前端弄崩。

**为什么没打包 SDK？** Lambda 的 Node.js 运行环境自带 AWS SDK v3，直接 `import` 就能用，所以只要把 `index.mjs` 压成 zip 上传。

> **当时的临时开关**：第 3 步还没有登录功能，所以加了环境变量 `ALLOW_TEST_USER=1`，没有令牌的请求一律当作 `test-user`，方便用 curl 测试。第 4 步接上 Cognito 后删掉了。

### 3.6 HTTP API `wtw-api`

**为什么选 HTTP API 而不是 REST API？** API Gateway 有两种 API。HTTP API 更新、更简单、**便宜约 70%**，还自带 JWT 验证。REST API 功能更多（请求校验、API Key、用量计划），但这个项目用不上。

| 组成部分 | 设置 | 说明 |
|---|---|---|
| 路由（Route） | `GET /state`、`PUT /state` | 只有这两个，其他路径返回 404，根本不会调用 Lambda |
| 集成（Integration） | `AWS_PROXY` → `wtw-state`，payload 2.0 | 把整个 HTTP 请求原样交给 Lambda |
| 阶段（Stage） | `$default`，自动部署 | 改了配置立即生效 |
| 限流 | 每秒 10 个请求，突发最多 20 个 | 超出返回 429，防止被人刷出费用 |
| CORS | 允许的来源：正式网址 + `http://localhost:5173`；允许的方法：GET、PUT；允许的请求头：authorization、content-type | 见下 |
| Lambda 资源策略 | 只允许 `3vq36jfo5i` 这一个 API 调用 `wtw-state` | 别的 API 调不了 |

**CORS（跨域资源共享）是什么？** 网页在 `dxms6lt12il94.cloudfront.net`，接口在 `3vq36jfo5i.execute-api...`，域名不一样。浏览器出于安全考虑，默认会**拦截网页向别的域名发的请求**，除非对方明确说"我允许这个网站调用我"。

浏览器的做法是先发一个 `OPTIONS` **预检请求**问一下："我是某某网站，想用 PUT 方法、带 Authorization 头，可以吗？" API Gateway 回答 `access-control-allow-origin: https://dxms6lt12il94.cloudfront.net` 就是允许。

> CORS 只是**浏览器**的规则，`curl` 不受它限制。所以 CORS 不能代替登录验证，它只能防止**别的网站**借用户的浏览器偷偷调你的接口。

### 3.7 用 curl 测试

| # | 测试 | 结果 |
|---|---|---|
| 1 | GET（表是空的） | 200，`{"state":null}` |
| 2 | PUT 一份测试衣橱 | 200 |
| 3 | 再 GET | 200，读回刚才的数据 ✅ |
| 4 | PUT 不是 JSON 的内容 | 400 `invalid json` |
| 5 | PUT 缺少 `items` | 400 |
| 6 | 访问 `/admin` | 404，没有调用 Lambda |
| 7 | 自己网站的 CORS 预检 | 有 `access-control-allow-origin` ✅ |
| 8 | 陌生网站的 CORS 预检 | 没有 allow 头，浏览器会拦截 ✅ |

**冷启动**：第一次请求花了 476 ms，之后只要 35–75 ms。Lambda 一段时间没被调用时，运行环境会被回收，下次要重新启动，这就是冷启动。

更新后端代码：当时用 `scripts/deploy-api.sh`（zip → `aws lambda update-function-code`）。第 6 步以后 Lambda 代码由 CDK 管理，改成 `npm run deploy:infra`（或 push 到 main 自动部署），这个脚本删掉了。

---

## 4. 第 4 步：登录（Cognito）

### 4.1 概念

**Cognito 用户池（User Pool）**：你网站的**账号数据库加登录服务**，负责注册、登录、找回密码、两步验证。登录成功后发**令牌**。

> 还有一个叫**身份池（Identity Pool）**的东西，容易搞混。它的作用是把令牌换成**临时 AWS 凭证**，让浏览器**直接**访问 S3、DynamoDB。我们的前端只调用自己的 API，所以**不需要身份池**。

**JWT（JSON Web Token）**：令牌的格式。由三段 Base64 文本组成，用 `.` 连接：

```
eyJhbGciOi...  .  eyJzdWIiOiJmOTll...  .  签名
   头部              内容（claims）          Cognito 用私钥签的名
```

内容部分谁都能解码看到（**不是加密的**），但**签名只有 Cognito 能生成**。API Gateway 用 Cognito 公开的公钥验证签名，内容被改动一个字符，签名就对不上。所以令牌**看得到但改不了**。

**三种令牌：**

| 令牌 | 有效期 | 用途 |
|---|---|---|
| **access token**（访问令牌） | 1 小时 | 带着它调用 API，证明"我有权限" |
| **ID token**（身份令牌） | 1 小时 | 告诉前端"我是谁"（邮箱等） |
| **refresh token**（刷新令牌） | 30 天 | access token 过期后，用它换新的，不用重新输密码 |

**OAuth 2.0 授权码 + PKCE 流程**（这是网页登录的标准做法）：

```
 浏览器                                   Cognito
   │ ① 生成随机"暗号" verifier，算出它的哈希 challenge
   │ ② 跳到登录页，带上 challenge 和随机 state ──▶ │
   │                                          │ 用户输入邮箱和密码
   │ ◀── ③ 跳回网站：?code=一次性授权码&state=... │
   │ ④ 检查 state 和发出去的一致（防伪造回调）
   │ ⑤ 用 code + 原始 verifier 换令牌 ──────────▶ │ 验证 hash(verifier) == challenge
   │ ◀──────────────── ⑥ 三种令牌 ──────────────── │
```

**为什么要 PKCE？** 网页代码是公开的，存不住 client secret。PKCE 让每次登录都临时生成一个只有这个浏览器知道的暗号。即使授权码在半路被截走（比如被恶意浏览器插件读到网址），没有暗号也换不到令牌。

### 4.2 用户池 `wtw-users`

| 设置 | 选择 | 原因 |
|---|---|---|
| 档位 | **Essentials** | 每月 1 万活跃用户以内永久免费。**Plus 档没有免费额度，不要开** |
| 登录名 | 邮箱 | 不用另想用户名 |
| 自动验证 | 邮箱 | 注册时发验证码，确认邮箱是本人的。找回密码要靠它 |
| 密码策略 | 至少 8 位，包含大小写字母和数字 | 常见的强度要求 |
| MFA（两步验证） | **可选**，只用验证器 App（TOTP） | 用户想开就开。不用短信，短信要收费 |
| 找回账号 | 通过已验证的邮箱 | |
| 删除保护 | 开 | 防止误删所有账号 |
| 发信 | Cognito 自带 | **每天最多 50 封**，学习阶段够用。用户多了要换成 SES |

### 4.3 应用客户端 `wtw-web`

| 设置 | 值 | 原因 |
|---|---|---|
| client secret | **不生成** | 网页里的 secret 等于公开。公共客户端不能有 secret，否则登录直接报错 |
| OAuth 流程 | 只允许 `code`（授权码） | 旧的 implicit 流程会把令牌直接放在网址里，不安全 |
| scope | `openid email` | 只要用户 ID 和邮箱，不多要 |
| 回调 / 退出地址 | `https://dxms6lt12il94.cloudfront.net/`、`http://localhost:5173/` | 必须和前端传的**完全一致**，包括结尾的 `/` |
| 令牌有效期 | access / ID 1 小时，refresh 30 天 | |
| 令牌吊销 | 开 | 退出登录时 refresh token 立刻作废 |
| 防止用户存在性泄露 | 开 | 登录失败时不提示"这个邮箱没注册"，免得别人用登录页试探哪些邮箱注册过 |
| 刷新令牌轮换 | **没开** | 见第 8 节的坑 |

### 4.4 托管登录页

- 域名：`wtw-login.auth.ap-southeast-2.amazoncognito.com`（Cognito 免费提供的子域名）
- 版本：**managed login v2**，新版，有可视化的品牌设计器，支持通行密钥（passkey）
- 用命令行创建 v2 时，**必须**再给应用客户端建一个品牌样式（`CreateManagedLoginBranding`），否则登录页打不开。用控制台建会自动生成，命令行不会

### 4.5 给 API 加 JWT 授权器

```
授权器 cognito-jwt：
  令牌从哪读：请求头 Authorization
  签发者（issuer）：https://cognito-idp.ap-southeast-2.amazonaws.com/ap-southeast-2_ggK9a6xv4
  受众（audience）：1jpdh7q27mma1of8afjoh9e7vn
挂到：GET /state、PUT /state
```

API Gateway 会自动检查：**签名对不对、是不是你的用户池签发的、是不是 `wtw-web` 这个应用的、有没有过期**。任何一项不对就直接返回 401，**Lambda 根本不会运行**（也就不花钱）。

> 浏览器的 `OPTIONS` 预检请求由 API Gateway 自己回答，不需要令牌，所以 CORS 不受影响。

然后：删掉 Lambda 的 `ALLOW_TEST_USER` 环境变量，删掉 `test-user` 测试数据。

### 4.6 手动走一遍登录流程（用 curl）

这一步是为了**亲眼看到**第 4.1 节那张流程图的每一步：

1. 本机用 `openssl` 生成随机的 `verifier` 和 `state`，算出 `challenge = base64url(sha256(verifier))`
2. 拼出登录链接，你在浏览器里打开、注册、验证邮箱、登录
3. 浏览器跳回 `https://dxms6lt12il94.cloudfront.net/?code=...&state=...`，你把网址复制给我
4. 检查 `state` 一致 ✅
5. `curl POST /oauth2/token`，带上 `code` 和 `verifier` → 拿到三种令牌 ✅
6. 解码 access token 的内容：`token_use: access`、`client_id: 1jpdh7q27...`、`iss: ...ggK9a6xv4` ✅

带令牌测试 API：

| 测试 | 结果 |
|---|---|
| 不带令牌 GET / PUT | 401 |
| 伪造的令牌 | 401 |
| 真实令牌 GET（新用户） | 200，空 |
| 真实令牌 PUT，再 GET | 200，数据存进了 `f99e9498…` 这一条，正是你账号的 ID ✅ |
| 令牌被改动一个字符 | 401 ✅ |
| 用 ID token 代替 access token | 200（两种令牌的 `aud` / `client_id` 是同一个应用，所以都能通过。约定上用 access token） |

**测完清理**：删掉测试数据（否则第 5 步首次登录时，网站会把这份假数据当成你的云端数据），用 `/oauth2/revoke` 作废测试用的 refresh token，删掉本地的令牌文件。

---

## 5. 第 5 步：前端接入登录和同步

### 5.1 选登录库

| | **oidc-client-ts**（选了这个） | Amplify | 自己手写 |
|---|---|---|---|
| 体积 | 小（gzip 约 +19 KB） | 大很多 | 最小 |
| 协议 | 标准 OIDC，换到别家的登录服务也能用 | 和 AWS 绑定 | 标准 |
| 安全细节 | 成熟库，PKCE、state、令牌刷新都处理好了 | 成熟 | 容易漏 |

### 5.2 `src/lib/auth.ts`：登录

- `signIn()` → 库自动生成 PKCE 暗号和 state，跳到 Cognito 登录页
- 页面加载时，如果网址里有 `?code=&state=` → 用 code 换令牌，然后把地址栏收拾干净
- `getAccessToken()` → 拿当前的 access token。过期了就自动用 refresh token 换新的
- `signOut()` → 先吊销 refresh token，再跳到 Cognito 的 `/logout` 清掉登录页记住的会话（否则下次点登录会直接登进去，不问密码）

**令牌存在 localStorage**：库默认存在 sessionStorage，关掉标签页就要重新登录。取舍是：如果网页被注入了恶意脚本（XSS），脚本能读到令牌。这个 app 没有第三方脚本，React 默认也会转义内容，风险较低。

### 5.3 `src/lib/cloud.ts`：同步规则

**登录时（或打开页面时）**，先拉取云端数据，然后由 `pickNewer()` 决定用哪边：

| 情况 | 做法 | 场景 |
|---|---|---|
| 云端没数据 | **上传本地** | 首次登录：把浏览器里原有的衣橱迁移上去 |
| 本地数据上次同步的是**别的账号** | **用云端的** | 共用设备：A 退出后 B 登录，不能把 A 的衣橱传给 B |
| 云端 `updatedAt` > 本地最后修改时间 | 用云端的 | 在另一台设备上改过 |
| 否则 | 上传本地 | 在这台设备上改过 |

**之后：**

- 每次修改停顿 **1.5 秒**再上传（这叫**防抖 debounce**），连续点很多下也只发一次请求
- 内容和上次同步的一样，就不重复上传
- 页面隐藏时（切到别的应用、关标签页）**立刻**补传，用 `fetch(..., { keepalive: true })`，页面关掉后请求也能发完
- 退出登录前先补传：吊销 refresh token 会连带作废 access token，晚了就传不上去了
- 请求返回 401（令牌刚好在路上过期）→ 换新令牌，重试一次

### 5.4 `src/lib/storage.ts` 的改动

- 新增 `wtw:v1:changedAt`：用户**自己**修改时记下时间。云端数据覆盖本地时**不算**修改
- 新增 `wtw:v1:owner`：本地数据最后和哪个账号同步过
- 把"整理存档数据"的逻辑抽成 `normalize()`，云端拉下来的数据也要过一遍：旧的衣物 ID 迁移、补上新加的基础单品等

### 5.5 本地浏览器验证

1. `npx vite` 启动本地开发服务器，用 Chrome 打开 `localhost:5173`
2. 点"登录同步" → 你之前在这个 Chrome 登录过 Cognito，所以**一瞬间完成**了：跳转、换令牌、同步
3. 云端原本是空的 → 走"首次登录迁移"，浏览器里的京都那份衣橱传了上去 ✅
4. 切到 EN → 约 1.5 秒后 DynamoDB 里的 `lang` 变成 `en` ✅；切回中文，云端也变回 `zh` ✅
5. 控制台没有错误 ✅

### 5.6 发布

`npm run deploy` → 正式网址上的 JS 变成 `index-DtoH01tr.js`，里面有 API 地址和 Cognito 配置 ✅

---

## 6. 安全设计汇总

一层层叠起来的防护（**纵深防御**）：

| 层 | 措施 | 防的是什么 |
|---|---|---|
| 网页 | S3 私有 + OAC + 桶策略限定这一个分发 | 绕过 CDN 直接访问或刷桶 |
| | 强制 HTTPS + HSTS | 传输时被窃听或篡改 |
| | 安全响应头 | 点击劫持、浏览器乱猜文件类型 |
| 登录 | 公共客户端没有 secret，授权码 + PKCE | 授权码被截获 |
| | state 校验 | 伪造的登录回调（CSRF） |
| | 令牌吊销、退出时清除 Cognito 会话 | 共用设备上留下登录状态 |
| | 防止用户存在性泄露 | 试探哪些邮箱注册过 |
| API | JWT 授权器（签名、签发者、受众、过期时间） | 伪造或过期的令牌 |
| | CORS 只允许自己的网站 | 别的网站借用户浏览器调接口 |
| | 限流 10 次/秒 | 被刷出费用 |
| 后端 | 用户 ID 只从令牌里取 | A 读写 B 的数据 |
| | 输入检查（大小、格式） | 垃圾数据、塞满数据库 |
| | IAM 最小权限 | 代码被利用后横向扩散到其他资源 |
| 前端 | 记录本地数据属于哪个账号 | 共用设备时把上一个人的数据传给下一个人 |
| 运维 | 日志保留 14 天 | 日志无限累积 |
| | 删除保护（表、用户池） | 误删 |
| | 零花费预算告警 | 意外扣费 |

---

## 7. 费用

| 服务 | 免费额度 | 现在的用量 |
|---|---|---|
| CloudFront | 每月 1 TB 流量、1000 万次请求（永久） | 远低于 |
| S3 | 用新账号额度抵扣 | 约 1 MB |
| Lambda | 每月 100 万次请求（永久） | 几十次 |
| API Gateway | 用新账号额度抵扣 | 几十次 |
| DynamoDB | 25 GB 存储（永久），读写按次收费 | 1 条记录 |
| Cognito Essentials | 每月 1 万活跃用户（永久） | 1 个 |
| CloudWatch Logs | 每月 5 GB | 几 KB |

**目前是 $0**。就算有 1000 个用户，每月也不到 $1。真正要注意的是 Free plan 到期日（2027-04-12）。

---

## 8. 踩过的坑

| # | 现象 | 原因 | 解决 |
|---|---|---|---|
| 1 | CloudFront 网址在本机 `curl` 提示"找不到主机"，`dig` 却能查到 | 分发刚建好时 Mac 查询过一次，把"不存在"的结果缓存了 | 等几分钟，或清 DNS 缓存：`sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder` |
| 2 | MCP 沙箱里不能 `import zipfile` | 沙箱出于安全原因禁用了这个模块 | Lambda 代码改在本机打 zip，用 `aws lambda create-function --zip-file fileb://...` 上传 |
| 3 | `curl $R ...` 报"option is unknown" | zsh **不会**像 bash 那样把变量按空格拆成多个参数 | 把参数直接写在命令里，或者用函数 / 数组 |
| 4 | 创建用户池时，MFA 设成 OPTIONAL 报错"需要短信配置" | 建池时直接设 MFA，Cognito 默认要求配置短信 | 先用 `MFA=OFF` 建池，再用 `SetUserPoolMfaConfig` 单独开启"只用 TOTP 的可选 MFA" |
| 5 | 开刷新令牌轮换报错 | 开轮换后不允许 `ALLOW_REFRESH_TOKEN_AUTH`，而很多前端库刷新令牌用的正是它 | 先不开轮换，令牌吊销照常开着。等确认前端库支持再开 |
| 6 | 测试报 `location is not defined` | 测试在 Node 环境里跑，没有浏览器对象。`auth.ts` 一加载就创建了登录管理器 | 改成第一次用到时才创建 |
| 7 | 开发模式下同一个 `code` 可能被拿去换两次令牌 | React StrictMode 会故意把 effect 执行两次 | 回调处理放在模块级的 Promise 里，只处理一次 |
| 8 | 第一次 `npm run deploy` 卡在 `aws s3 sync`，5 分钟没反应 | 单独测试时一切正常，重跑也成功了，判断是偶发的网络问题 | 重跑 |
| 9 | 调试输出里打印出了本机 AWS 会话的临时令牌 | `aws --debug` 会打印完整请求头 | 运行 `aws logout` + `aws login` 换新会话。以后调试时用 `grep -v` 过滤掉请求头 |
| 10 | GitHub OIDC 报 "explicit deny in a service control policy" | project 的 SCP 禁止 `iam:*Provider*` | 改用 CodeBuild + CodeConnections（见 11.4） |
| 11 | AWS 命令时不时卡住，或者报 `CreateOAuth2Token ... INVALID_REQUEST` | 同时跑多个 AWS 命令时，它们抢着刷新 `aws login` 的会话，其中一个就会失败 | AWS 命令一次只跑一个 |
| 12 | IaC 生成器没扫出 API 阶段、登录页域名和品牌样式 | 扫描不支持这几种资源 | 用 `get-stage`、`describe-user-pool-domain` 等命令查出配置后手写 |
| 13 | 导入要求每个资源都有 DeletionPolicy | CloudFormation 导入的规定 | 所有资源都设成 `RemovalPolicy.RETAIN` |
| 14 | 加 webhook 时 `cdk diff` 说项目 "may be replaced" | CloudFormation 的保守提示 | 文档说加触发器不用替换。部署后看创建时间没变，确实没有替换 |

---

## 9. 常用命令速查

```bash
# 登录 AWS（凭证过期时）
aws login --profile wtw

# 平时：push 到 main（通过 PR 合并）就会自动部署，下面是手动部署的方法

# 发布前端（测试 → 构建 → 上传 → 刷新 CloudFront）
npm run deploy

# 部署 AWS 资源和 Lambda 代码（先在 infra/ 里 npx cdk diff 看会改什么）
npm run deploy:infra

# 看最近的自动部署
aws codebuild list-builds-for-project --project-name wtw-deploy --profile wtw
aws logs tail /aws/codebuild/wtw-deploy --since 1h --profile wtw

# 看 Lambda 最近的日志
aws logs tail /aws/lambda/wtw-state --since 1h --profile wtw

# 看账号还剩多少免费额度、哪天到期
aws freetier get-account-plan-state --profile wtw

# 本地开发（登录回调地址已经登记了 localhost:5173）
npm run dev
```

---

## 10. 术语表

| 术语 | 解释 |
|---|---|
| **ARN** | AWS 资源的"身份证号"，例如 `arn:aws:dynamodb:ap-southeast-2:<账号ID>:table/wtw-users` |
| **区域（Region）** | AWS 数据中心所在的地理区域，本项目是悉尼 `ap-southeast-2` |
| **边缘节点** | CloudFront 分布在全球的缓存服务器 |
| **源站（Origin）** | CloudFront 取原始文件的地方，这里是 S3 桶 |
| **缓存失效（Invalidation）** | 让 CloudFront 丢掉缓存的旧文件 |
| **IAM** | AWS 的权限系统：谁能对什么资源做什么操作 |
| **策略（Policy）** | 一份 JSON，写明允许或拒绝哪些操作 |
| **信任策略** | 角色上的策略，规定谁能"戴上"这个角色 |
| **最小权限原则** | 只给刚好够用的权限 |
| **冷启动** | Lambda 闲置后第一次被调用，要先启动运行环境，会慢几百毫秒 |
| **CORS** | 浏览器的跨域规则。别的域名的接口要明确允许，浏览器才放行 |
| **预检请求** | 浏览器真正发请求前，先用 OPTIONS 问一下"可以吗" |
| **限流（Throttling）** | 限制每秒请求数，超出返回 429 |
| **OAuth 2.0 / OIDC** | 登录授权的标准协议。OIDC 是在 OAuth 2.0 上加了"你是谁"的部分 |
| **JWT** | 签过名的令牌格式，看得到但改不了 |
| **PKCE** | 登录时临时生成的一次性暗号，防止授权码被截获后被滥用 |
| **sub** | JWT 里的用户唯一 ID，也是 DynamoDB 的 `userId` |
| **防抖（Debounce）** | 连续触发时只在停下来以后执行一次 |
| **最后写入者胜** | 两边都改了时，以时间较晚的为准 |

---

## 11. 第 6 步：基础设施即代码 + CI/CD

### 11.1 为什么要做这一步

到第 5 步为止，所有资源都是**手动**一个个建的。好处是每一步都看得清楚；坏处是：

- 换个账号重建一遍，要照着这份文档再操作几十步
- 改了配置没有记录，不知道谁在什么时候改了什么
- 部署要在自己电脑上运行 `npm run deploy`

第 6 步分两半：**① 用 CDK 把资源写成代码**；**② push 代码就自动测试、自动部署（CI/CD）**。

### 11.2 概念

- **基础设施即代码（IaC）**：用代码描述"我要一张什么样的表、一个什么样的 Lambda"，由工具负责创建和更新
- **CloudFormation**：AWS 原生的 IaC 服务。你交给它一份模板（JSON/YAML），它负责把资源建成模板里的样子。一组一起管理的资源叫一个**栈（stack）**
- **CDK**：用 TypeScript 等编程语言写 CloudFormation 模板的工具。`cdk synth` 把代码翻译成模板，`cdk deploy` 交给 CloudFormation 执行
- **逻辑 ID**：资源在模板里的名字（比如 `UsersTable`）。CloudFormation 靠它认出"这是同一个资源"。**改了逻辑 ID，CloudFormation 会以为是新资源，删掉旧的、再建新的**
- **L1 和 L2**：CDK 的两种写法。L1（`Cfn*` 类）和 CloudFormation 一一对应，写什么就是什么；L2（如 `dynamodb.Table`）更简短，但会悄悄加默认设置和额外资源
- **CI（持续集成）**：每次 push 自动跑 lint、测试、构建，尽早发现问题
- **CD（持续部署）**：测试通过后自动发布上线

### 11.3 CDK 接管现有资源（import）

难点在于：表和用户池里**已经有数据**，不能删掉重建。所以要用 **`cdk import`** 把现有资源"登记"到栈里，而不是新建。

**① 扫描出真实配置**：用 CloudFormation 的 **IaC 生成器**扫描账号里的资源，生成一份带真实设置的模板。比照着它写 CDK 代码，比凭记忆手写可靠得多。扫描漏了 3 个资源（API 的 `$default` 阶段、登录页域名、品牌样式），这几个用 `aws ... get/describe` 查出配置后手写。

**② 用 L1 写出一模一样的代码**：`infra/lib/wtw-stack.ts`，共 19 个资源。选 L1 是因为导入时属性要对得上；L2 加的默认设置很容易对不上。

**③ 每个资源都设成"保留"（`RemovalPolicy.RETAIN`）**：CloudFormation 要求被导入的资源必须有删除策略。设成"保留"也最安全：就算以后从代码里删掉某个资源，CloudFormation 也只是不再管它，不会真的删除。再加上栈的**防止删除**（termination protection）和表、用户池本身的删除保护，用户数据有三层保护。

**④ `cdk bootstrap`**：每个账号和区域做一次。CDK 会建一个叫 `CDKToolkit` 的栈，里面有存代码包的 S3 桶、ECR 仓库和几个 IAM 角色（CloudFormation 用它们替你部署）。

**⑤ `cdk import --resource-mapping`**：写一个对照表，告诉 CloudFormation "模板里的 `UsersTable` 就是现有的 `wtw-users` 表"，然后执行导入。导入只登记资源，不创建、不修改、不删除。（对照表含账号 ID，用完就删了，没有提交。）

**⑥ 检查**：

| 检查 | 结果 |
|---|---|
| 漂移检测（drift，代码和实际资源的差别） | 只有 3 处标签不同（手动建的桶、分发、API 阶段没加 `app` 标签），其他设置完全一致 |
| `cdk diff` | 没有任何资源要新建、修改或替换 |
| 第一次 `cdk deploy` 的输出 | 网址、API 地址、client ID 都和原来一模一样，说明没有重建任何东西 |
| 网站和 API | 网站 200；不带令牌访问 API 返回 401，照常工作 |

以后改 AWS 配置的方法：改 `infra/lib/wtw-stack.ts` → `cd infra && npx cdk diff` 看会改什么 → `npm run deploy:infra`。

> ⚠️ **不要改 construct 的 id**（`new CfnXxx(this, '这里', ...)`），它就是逻辑 ID。

### 11.4 原计划行不通：SCP 禁止 OIDC

原计划是让 GitHub Actions 用 **OIDC 联合身份**直接部署：在 AWS 里登记 GitHub 为可信的身份提供商，GitHub 每次部署时拿临时身份证明去 AWS 换临时凭证，全程没有长期密钥。

实际查询时报错：**explicit deny in a service control policy**。查了 [AWS 的文档](https://docs.aws.amazon.com/accounts/latest/reference/scps-and-rcps-for-projects.html)，新体验的 project 在 Free 和 Paid 套餐下都有一条 `DenyIAMRestrictedActions`，禁止所有带 `Provider` 的 IAM 操作（`iam:*Provider*`）。所以没法登记 GitHub 这个身份提供商。

> **SCP（服务控制策略）**是组织层面的"天花板"：就算你的角色有管理员权限，SCP 拒绝的操作也做不了。新体验的 project 由 AWS 托管 SCP，自己改不了。

可选的方案：

| 方案 | 优点 | 缺点 |
|---|---|---|
| **GitHub 跑测试 + AWS CodeBuild 部署**（选了这个） | GitHub 里不放任何 AWS 密钥；AWS 只能访问授权的那一个仓库 | 要在控制台授权一次 GitHub 连接；用到两个平台 |
| GitHub Actions + IAM 用户的访问密钥 | 最常见、最简单 | 长期有效的密钥存在 GitHub 里，仓库又是公开的，泄露风险大 |
| 只做 CI，部署照旧在本机运行 | 最简单 | 不是真正的自动部署 |

### 11.5 最终的 CI/CD 流程

```
你 push 代码到 GitHub
   │
   ├─▶ GitHub Actions（CI，.github/workflows/ci.yml）
   │     lint → 测试 → 构建 → tsc + cdk synth（只生成模板，不连 AWS）
   │     所有分支、所有 PR 都会跑
   │
   └─▶ 只有 main 分支：GitHub webhook 通知 AWS CodeBuild（CD，buildspec.yml）
         CodeBuild 通过 CodeConnections 从 GitHub 拉代码
         → cdk deploy（基础设施和 Lambda 代码）
         → scripts/deploy.sh（测试、构建、上传网页、刷新 CloudFront）
```

**新增的 AWS 资源**（都写在 `infra/lib/wtw-stack.ts` 里）：

| 资源 | 名称 | 说明 |
|---|---|---|
| CodeConnections 连接 | `wtw-github` | AWS 访问 GitHub 的通道（本质是装在 GitHub 上的 "AWS Connector for GitHub" 应用）。建好时是 PENDING，要在控制台授权一次，只授权 `ushi02/what_to_wear` 这一个仓库 |
| CodeBuild 项目 | `wtw-deploy` | 跑部署的机器。ARM 小规格（每月前 100 分钟免费），超时 20 分钟，同一时间只跑一个部署 |
| webhook | 在 GitHub 仓库里 | 只在 push 到 `main` 时触发 |
| IAM 角色 | `wtw-deploy-codebuild` | CodeBuild 的权限，见下 |
| 日志组 | `/aws/codebuild/wtw-deploy` | 部署日志，保留 14 天 |

**CodeBuild 角色的权限**（最小权限）：

| 权限 | 用途 |
|---|---|
| 写自己的日志组 | 记录部署过程 |
| 使用 `wtw-github` 连接 | 从 GitHub 拉代码 |
| `sts:AssumeRole` 到 CDK bootstrap 的 3 个角色 | `cdk deploy` 不直接拿权限，而是借用 bootstrap 建的角色去上传代码包、执行 CloudFormation |
| 网站桶的读、写、删、列出 | 上传网页 |
| `cloudfront:CreateInvalidation`（只限这个分发） | 刷新缓存 |

### 11.6 不把账号 ID 放进公开仓库

仓库是公开的。AWS 账号 ID 不算机密，但没必要公开，所以：

- `infra/bin/app.ts`：账号取当前登录凭证所在的账号（`CDK_DEFAULT_ACCOUNT`）。没有凭证时（比如 GitHub Actions 里只做 synth），就生成不绑定账号的模板
- `scripts/deploy.sh`：桶名和分发 ID 从 CloudFormation 栈的输出里读取，不写死
- 文档里写成 `<账号ID>`
- 推送前**改写了还没推送的 23 个提交**，把历史里的账号 ID 也替换掉了（只改写没推送过的提交是安全的；已经推送的历史不要改写）

Cognito 用户池 ID、client ID、API 地址、CloudFront 域名留在代码里：它们本来就会出现在浏览器里，公开也没关系，安全靠的是令牌验证。

### 11.7 Git 流程

1. 在 `dev` 分支开发、提交
2. `git push origin dev`
3. 开 PR：`dev` → `main`，GitHub Actions 自动跑 CI
4. CI 通过后合并 → push 到 `main` → CodeBuild 自动部署

GitHub 的 `main` 分支就是"线上版本"。
