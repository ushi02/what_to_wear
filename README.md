# 出门穿什么

出门前看一眼：根据当天天气推荐穿搭，只推荐你衣橱里有的东西。

- 天气：[Open-Meteo](https://open-meteo.com/)（免费、无需 key，**仅限非商业使用**），全球城市
- 语言：中文 / English，默认英文，页面上可切换；°C / °F 可切换
- 数据：衣橱、待购清单、城市、语言设置存在浏览器 localStorage，不登录也能用；登录后同步到云端，换设备也在
- 网址：https://dxms6lt12il94.cloudfront.net（AWS 悉尼：S3 + CloudFront、Cognito、API Gateway + Lambda + DynamoDB）

## 开发

```bash
npm install
npm run dev     # 本地开发
npm test        # 推荐规则、i18n、城市搜索单测
npm run build   # 产物在 dist/
```

## 部署

push 到 `main`（通过 PR 合并）后自动部署：GitHub Actions 跑测试，AWS CodeBuild 按 `buildspec.yml` 部署。手动部署：

```bash
aws login --profile wtw
npm run deploy:infra   # AWS 资源和 Lambda 代码（CDK，代码在 infra/）
npm run deploy         # 网页
```

搭建过程和每一步的原因见 [`docs/aws-walkthrough.md`](docs/aws-walkthrough.md)。

## 代码结构

- `src/data/baseWardrobe.ts` — unisex 基础衣橱，每件衣服的适用体感温度、防雨等级等
- `src/data/cities.ts` — 内置约 100 个热门城市的中英文名称（日文名只用于搜索）（Open-Meteo 对中日文别名收录不全）
- `src/i18n/messages.ts` — 中英文案；新增文案时两种语言都要加，测试会检查占位符一致
- `src/lib/recommend.ts` — 推荐规则（纯函数，阈值都在文件顶部）
- `src/lib/weather.ts` — Open-Meteo 地理编码 / 预报 / 历史数据
- `src/lib/storage.ts` — localStorage 状态与缓存
- `src/lib/auth.ts`、`src/lib/cloud.ts` — Cognito 登录、和云端同步
- `backend/state/` — Lambda 后端（读写每个用户的数据）
- `infra/` — CDK：全部 AWS 资源
