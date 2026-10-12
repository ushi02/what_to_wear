#!/usr/bin/env bash
# 把 backend/state/ 的代码更新到 Lambda 函数 wtw-state
# 凭证过期时先运行：aws login --profile wtw
set -euo pipefail

export AWS_PROFILE=wtw
cd "$(dirname "$0")/.."

ZIP=$(mktemp -d)/state.zip
(cd backend/state && zip -q -X "$ZIP" index.mjs)

aws lambda update-function-code --function-name wtw-state \
  --zip-file "fileb://$ZIP" --query 'LastUpdateStatus' --output text
aws lambda wait function-updated-v2 --function-name wtw-state

echo "已更新：https://3vq36jfo5i.execute-api.ap-southeast-2.amazonaws.com/state"
