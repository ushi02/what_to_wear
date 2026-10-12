#!/usr/bin/env bash
# 构建并发布到 S3 + CloudFront（https://dxms6lt12il94.cloudfront.net）
# 凭证过期时先运行：aws login --profile wtw
set -euo pipefail

export AWS_PROFILE=wtw
BUCKET=wtw-site-<账号ID>
DISTRIBUTION=EORJPY4T2JXFT

cd "$(dirname "$0")/.."
npm test
npm run build

# assets/ 的文件名带内容哈希，可以让浏览器缓存一年
aws s3 sync dist/assets "s3://$BUCKET/assets" \
  --cache-control "public, max-age=31536000, immutable" --delete

# index.html 等入口文件每次都要检查有没有新版本
aws s3 sync dist "s3://$BUCKET" --exclude "assets/*" \
  --cache-control "no-cache" --delete

# 让 CloudFront 边缘节点丢掉旧的 index.html（每月前 1000 个路径免费）
aws cloudfront create-invalidation --distribution-id "$DISTRIBUTION" \
  --paths "/index.html" "/" --query 'Invalidation.Status' --output text

echo "已发布：https://dxms6lt12il94.cloudfront.net"
