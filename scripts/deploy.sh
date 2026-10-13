#!/usr/bin/env bash
# 构建并发布到 S3 + CloudFront（https://dxms6lt12il94.cloudfront.net）
# 本机运行时用 wtw 的登录凭证（过期了先 aws login --profile wtw）；
# CodeBuild 里运行时用项目角色 wtw-deploy-codebuild 自带的凭证
set -euo pipefail

if [ -z "${CODEBUILD_BUILD_ID:-}" ]; then
  export AWS_PROFILE=wtw
fi
# 桶名和分发 ID 从 CDK 栈的输出里读，不写死在代码里
output() {
  aws cloudformation describe-stacks --stack-name what-to-wear --region ap-southeast-2 \
    --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" --output text
}
BUCKET=$(output SiteBucketName)
DISTRIBUTION=$(output DistributionId)

cd "$(dirname "$0")/.."
npm test
npm run build

# assets/ 的文件名带内容哈希，可以让浏览器缓存一年；名字一样内容就一样，只比大小不比时间
aws s3 sync dist/assets "s3://$BUCKET/assets" \
  --cache-control "public, max-age=31536000, immutable" --size-only --delete

# index.html 等入口文件每次都要检查有没有新版本
aws s3 sync dist "s3://$BUCKET" --exclude "assets/*" \
  --cache-control "no-cache" --delete

# 让 CloudFront 边缘节点丢掉旧的 index.html（每月前 1000 个路径免费）
aws cloudfront create-invalidation --distribution-id "$DISTRIBUTION" \
  --paths "/index.html" "/" --query 'Invalidation.Status' --output text

echo "已发布：https://dxms6lt12il94.cloudfront.net"
