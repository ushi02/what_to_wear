import { App } from 'aws-cdk-lib'
import { WtwStack } from '../lib/wtw-stack.ts'

const app = new App()

new WtwStack(app, 'WtwStack', {
  stackName: 'what-to-wear',
  // project 只能用悉尼；账号写死，防止凭证指向别的账号时误部署
  env: { account: '<账号ID>', region: 'ap-southeast-2' },
  // 防止整个栈被误删（cdk destroy 会被拒绝）
  terminationProtection: true,
  // 不加 CDKMetadata 资源：导入（cdk import）时变更集里只能有被导入的资源
  analyticsReporting: false,
  description: 'what_to_wear: static site, state API and Cognito sign-in',
})
