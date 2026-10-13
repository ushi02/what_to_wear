import { App } from 'aws-cdk-lib'
import { WtwStack } from '../lib/wtw-stack.ts'

const app = new App()

new WtwStack(app, 'WtwStack', {
  stackName: 'what-to-wear',
  // project 只能用悉尼。账号取当前登录凭证所在的账号（仓库是公开的，不把账号 ID 写进代码）；
  // 没有凭证时（比如 GitHub Actions 里只做 synth）就生成不绑定账号的模板
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: 'ap-southeast-2' },
  // 防止整个栈被误删（cdk destroy 会被拒绝）
  terminationProtection: true,
  // 不加 CDKMetadata 资源：导入（cdk import）时变更集里只能有被导入的资源
  analyticsReporting: false,
  description: 'what_to_wear: static site, state API and Cognito sign-in',
})
