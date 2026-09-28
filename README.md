# 出门穿什么

出门前看一眼：根据当天天气（参考去年同期）推荐穿搭，只推荐你衣橱里有的东西。

- 天气：[Open-Meteo](https://open-meteo.com/)（免费、无需 key，**仅限非商业使用**），全球城市
- 语言：中文 / 日本語 / English，默认跟随浏览器；°C / °F 可切换
- 数据：衣橱、待购清单、城市、语言设置都存在浏览器 localStorage，不需要登录和后端

## 开发

```bash
npm install
npm run dev     # 本地开发
npm test        # 推荐规则、i18n、城市搜索单测
npm run build   # 产物在 dist/，任何静态托管都能部署（Vercel / Cloudflare Pages）
```

## 代码结构

- `src/data/baseWardrobe.ts` — unisex 基础衣橱，每件衣服的适用体感温度、防雨等级等
- `src/data/cities.ts` — 内置约 100 个热门城市的中日英名称（Open-Meteo 对中日文别名收录不全）
- `src/i18n/messages.ts` — 三语文案；新增文案时三种语言都要加，测试会检查占位符一致
- `src/lib/recommend.ts` — 推荐规则（纯函数，阈值都在文件顶部）
- `src/lib/weather.ts` — Open-Meteo 地理编码 / 预报 / 历史数据
- `src/lib/storage.ts` — localStorage 状态与缓存
