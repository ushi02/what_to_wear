// AWS 资源的地址和 ID，见 docs/aws-backend.md 第 12 节。
// 都不是秘密：公共客户端没有 secret，安全靠 PKCE 和 API Gateway 验证令牌。
export const AWS = {
  apiUrl: 'https://3vq36jfo5i.execute-api.ap-southeast-2.amazonaws.com',
  issuer: 'https://cognito-idp.ap-southeast-2.amazonaws.com/ap-southeast-2_ggK9a6xv4',
  clientId: '1jpdh7q27mma1of8afjoh9e7vn',
}
