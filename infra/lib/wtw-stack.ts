// 「出门穿什么」的全部 AWS 资源。
//
// 这些资源最早是手动建的（过程见 docs/aws-walkthrough.md），后来用 `cdk import` 交给 CDK 管理。
// 所以这里用的是 L1（Cfn* 类）：属性和 CloudFormation 一一对应，和手动建时的设置完全一致。
// L2 会悄悄加上默认设置和额外资源，导入时容易对不上。
//
// ⚠️ 不要改 construct 的 id（new CfnXxx(this, '这里', ...)）：id 决定 CloudFormation 的逻辑 ID，
//    改了 CloudFormation 会以为是新资源，删掉旧的再建新的。表和用户池里有用户数据。
import { Aws, CfnOutput, CfnResource, RemovalPolicy, Stack, Tags, type StackProps } from 'aws-cdk-lib'
import * as apigw from 'aws-cdk-lib/aws-apigatewayv2'
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront'
import * as cognito from 'aws-cdk-lib/aws-cognito'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as logs from 'aws-cdk-lib/aws-logs'
import * as s3 from 'aws-cdk-lib/aws-s3'
import { Asset } from 'aws-cdk-lib/aws-s3-assets'
import type { Construct } from 'constructs'
import path from 'node:path'

const SITE_URL = 'https://dxms6lt12il94.cloudfront.net'
const DEV_URL = 'http://localhost:5173'

export class WtwStack extends Stack {
  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props)
    Tags.of(this).add('app', 'what_to_wear')

    // ───────────── 网页：S3 + CloudFront ─────────────

    const siteBucket = new s3.CfnBucket(this, 'SiteBucket', {
      bucketName: `wtw-site-${Aws.ACCOUNT_ID}`,
      // 桶完全不公开，只让 CloudFront 通过 OAC 读取
      publicAccessBlockConfiguration: {
        blockPublicAcls: true,
        ignorePublicAcls: true,
        blockPublicPolicy: true,
        restrictPublicBuckets: true,
      },
      ownershipControls: { rules: [{ objectOwnership: 'BucketOwnerEnforced' }] },
      bucketEncryption: {
        serverSideEncryptionConfiguration: [{ serverSideEncryptionByDefault: { sseAlgorithm: 'AES256' }, bucketKeyEnabled: false }],
      },
    })
    siteBucket.applyRemovalPolicy(RemovalPolicy.RETAIN)

    const oac = new cloudfront.CfnOriginAccessControl(this, 'SiteOac', {
      originAccessControlConfig: {
        name: 'wtw-site-oac',
        description: 'CloudFront -> wtw-site bucket',
        originAccessControlOriginType: 's3',
        signingBehavior: 'always',
        signingProtocol: 'sigv4',
      },
    })

    const distribution = new cloudfront.CfnDistribution(this, 'SiteDistribution', {
      distributionConfig: {
        comment: 'what_to_wear static site',
        enabled: true,
        defaultRootObject: 'index.html',
        httpVersion: 'http2and3',
        ipv6Enabled: true,
        priceClass: 'PriceClass_All',
        origins: [
          {
            id: 's3-wtw-site',
            domainName: siteBucket.attrRegionalDomainName,
            originAccessControlId: oac.attrId,
            s3OriginConfig: { originAccessIdentity: '' },
          },
        ],
        defaultCacheBehavior: {
          targetOriginId: 's3-wtw-site',
          viewerProtocolPolicy: 'redirect-to-https',
          compress: true,
          allowedMethods: ['GET', 'HEAD'],
          cachedMethods: ['GET', 'HEAD'],
          // AWS 托管的策略，这里只引用它们的 ID，不会新建资源
          cachePolicyId: cloudfront.CachePolicy.CACHING_OPTIMIZED.cachePolicyId,
          responseHeadersPolicyId: cloudfront.ResponseHeadersPolicy.SECURITY_HEADERS.responseHeadersPolicyId,
        },
      },
    })

    // 只允许这一个分发读取桶里的文件
    new s3.CfnBucketPolicy(this, 'SiteBucketPolicy', {
      bucket: siteBucket.ref,
      policyDocument: {
        Version: '2012-10-17',
        Statement: [
          {
            Sid: 'AllowCloudFrontRead',
            Effect: 'Allow',
            Principal: { Service: 'cloudfront.amazonaws.com' },
            Action: 's3:GetObject',
            Resource: `${siteBucket.attrArn}/*`,
            Condition: { StringEquals: { 'AWS:SourceArn': `arn:aws:cloudfront::${Aws.ACCOUNT_ID}:distribution/${distribution.ref}` } },
          },
        ],
      },
    })

    // ───────────── 数据：DynamoDB ─────────────

    const table = new dynamodb.CfnTable(this, 'UsersTable', {
      tableName: 'wtw-users',
      attributeDefinitions: [{ attributeName: 'userId', attributeType: 'S' }],
      keySchema: [{ attributeName: 'userId', keyType: 'HASH' }],
      billingMode: 'PAY_PER_REQUEST',
      deletionProtectionEnabled: true,
    })
    // 存着用户数据：就算从代码里删掉，CloudFormation 也只是放手不管，不会删表
    table.applyRemovalPolicy(RemovalPolicy.RETAIN)

    // ───────────── 后端：Lambda ─────────────

    const logGroup = new logs.CfnLogGroup(this, 'StateLogGroup', {
      logGroupName: '/aws/lambda/wtw-state',
      retentionInDays: 14,
    })
    logGroup.applyRemovalPolicy(RemovalPolicy.RETAIN)

    // 最小权限：只能读写这一张表的单条记录，只能写自己的日志
    const role = new iam.CfnRole(this, 'StateRole', {
      roleName: 'wtw-state-lambda',
      description: 'Execution role for the wtw-state Lambda',
      assumeRolePolicyDocument: {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: { Service: 'lambda.amazonaws.com' },
            Action: 'sts:AssumeRole',
            Condition: { StringEquals: { 'aws:SourceAccount': Aws.ACCOUNT_ID } },
          },
        ],
      },
      policies: [
        {
          policyName: 'wtw-state-access',
          policyDocument: {
            Version: '2012-10-17',
            Statement: [
              { Sid: 'ReadWriteUsersTable', Effect: 'Allow', Action: ['dynamodb:GetItem', 'dynamodb:PutItem'], Resource: table.attrArn },
              {
                Sid: 'WriteOwnLogs',
                Effect: 'Allow',
                Action: ['logs:CreateLogStream', 'logs:PutLogEvents'],
                Resource: `arn:aws:logs:${Aws.REGION}:${Aws.ACCOUNT_ID}:log-group:${logGroup.logGroupName}:*`,
              },
            ],
          },
        },
      ],
    })

    // backend/state/ 打成 zip 上传到 CDK 的资源桶，Lambda 从那里取代码
    const code = new Asset(this, 'StateCode', { path: path.join(import.meta.dirname, '../../backend/state') })

    const fn = new lambda.CfnFunction(this, 'StateFunction', {
      functionName: 'wtw-state',
      runtime: 'nodejs24.x',
      architectures: ['arm64'],
      handler: 'index.handler',
      memorySize: 256,
      timeout: 5,
      role: role.attrArn,
      code: { s3Bucket: code.s3BucketName, s3Key: code.s3ObjectKey },
      environment: { variables: { TABLE_NAME: table.ref } },
      loggingConfig: { logFormat: 'JSON', logGroup: logGroup.ref },
    })

    // ───────────── 登录：Cognito ─────────────

    const userPool = new cognito.CfnUserPool(this, 'UserPool', {
      userPoolName: 'wtw-users',
      userPoolTier: 'ESSENTIALS',
      usernameAttributes: ['email'],
      autoVerifiedAttributes: ['email'],
      usernameConfiguration: { caseSensitive: false },
      policies: {
        passwordPolicy: {
          minimumLength: 8,
          requireUppercase: true,
          requireLowercase: true,
          requireNumbers: true,
          requireSymbols: false,
          temporaryPasswordValidityDays: 7,
        },
      },
      // 两步验证可选，只用验证器 App（TOTP），不用收费的短信
      mfaConfiguration: 'OPTIONAL',
      enabledMfas: ['SOFTWARE_TOKEN_MFA'],
      accountRecoverySetting: { recoveryMechanisms: [{ name: 'verified_email', priority: 1 }] },
      adminCreateUserConfig: { allowAdminCreateUserOnly: false },
      emailConfiguration: { emailSendingAccount: 'COGNITO_DEFAULT' },
      verificationMessageTemplate: { defaultEmailOption: 'CONFIRM_WITH_CODE' },
      deletionProtection: 'ACTIVE',
    })
    // 存着所有账号：同样只放手、不删除
    userPool.applyRemovalPolicy(RemovalPolicy.RETAIN)

    const appUrls = [`${SITE_URL}/`, `${DEV_URL}/`]
    const client = new cognito.CfnUserPoolClient(this, 'WebClient', {
      userPoolId: userPool.ref,
      clientName: 'wtw-web',
      // 公共客户端：网页代码谁都看得到，存不住 secret；安全靠授权码 + PKCE
      generateSecret: false,
      allowedOAuthFlowsUserPoolClient: true,
      allowedOAuthFlows: ['code'],
      allowedOAuthScopes: ['openid', 'email'],
      supportedIdentityProviders: ['COGNITO'],
      callbackUrLs: appUrls,
      logoutUrLs: appUrls,
      // 刷新令牌轮换没开：开了就不能用 ALLOW_REFRESH_TOKEN_AUTH，前端库刷新令牌靠它
      explicitAuthFlows: ['ALLOW_REFRESH_TOKEN_AUTH'],
      accessTokenValidity: 60,
      idTokenValidity: 60,
      refreshTokenValidity: 30,
      tokenValidityUnits: { accessToken: 'minutes', idToken: 'minutes', refreshToken: 'days' },
      authSessionValidity: 5,
      enableTokenRevocation: true,
      preventUserExistenceErrors: 'ENABLED',
    })

    // 托管登录页：wtw-login.auth.ap-southeast-2.amazoncognito.com（新版 managed login）
    new cognito.CfnUserPoolDomain(this, 'LoginDomain', {
      userPoolId: userPool.ref,
      domain: 'wtw-login',
      managedLoginVersion: 2,
    })
    // 新版登录页要给每个应用客户端配一个样式，否则打不开
    new cognito.CfnManagedLoginBranding(this, 'LoginBranding', {
      userPoolId: userPool.ref,
      clientId: client.ref,
      useCognitoProvidedValues: true,
    })

    // ───────────── 接口：API Gateway（HTTP API） ─────────────

    const api = new apigw.CfnApi(this, 'Api', {
      name: 'wtw-api',
      protocolType: 'HTTP',
      // 浏览器跨域：只允许正式网址和本地开发
      corsConfiguration: {
        allowOrigins: [SITE_URL, DEV_URL],
        allowMethods: ['GET', 'PUT'],
        allowHeaders: ['authorization', 'content-type'],
        maxAge: 3600,
      },
    })

    const integration = new apigw.CfnIntegration(this, 'StateIntegration', {
      apiId: api.ref,
      integrationType: 'AWS_PROXY',
      integrationUri: fn.attrArn,
      payloadFormatVersion: '2.0',
      timeoutInMillis: 6000,
    })

    // 只认 Cognito 签发给 wtw-web 的令牌；不合格的请求直接 401，到不了 Lambda
    const authorizer = new apigw.CfnAuthorizer(this, 'JwtAuthorizer', {
      apiId: api.ref,
      name: 'cognito-jwt',
      authorizerType: 'JWT',
      identitySource: ['$request.header.Authorization'],
      jwtConfiguration: {
        issuer: `https://cognito-idp.${Aws.REGION}.amazonaws.com/${userPool.ref}`,
        audience: [client.ref],
      },
    })

    for (const [id, routeKey] of [
      ['GetStateRoute', 'GET /state'],
      ['PutStateRoute', 'PUT /state'],
    ]) {
      new apigw.CfnRoute(this, id, {
        apiId: api.ref,
        routeKey,
        target: `integrations/${integration.ref}`,
        authorizationType: 'JWT',
        authorizerId: authorizer.ref,
      })
    }

    new apigw.CfnStage(this, 'DefaultStage', {
      apiId: api.ref,
      stageName: '$default',
      autoDeploy: true,
      // 限流：防止被刷出费用
      defaultRouteSettings: { throttlingRateLimit: 10, throttlingBurstLimit: 20 },
    })

    // 只允许这个 API 调用这个函数
    new lambda.CfnPermission(this, 'ApiInvokePermission', {
      functionName: fn.attrArn,
      action: 'lambda:InvokeFunction',
      principal: 'apigateway.amazonaws.com',
      sourceArn: `arn:aws:execute-api:${Aws.REGION}:${Aws.ACCOUNT_ID}:${api.ref}/*/*/state`,
    })

    // ───────────── 输出（前端 src/config.ts 用到的值） ─────────────

    new CfnOutput(this, 'SiteUrl', { value: `https://${distribution.attrDomainName}` })
    new CfnOutput(this, 'ApiUrl', { value: api.attrApiEndpoint })
    new CfnOutput(this, 'Issuer', { value: `https://cognito-idp.${Aws.REGION}.amazonaws.com/${userPool.ref}` })
    new CfnOutput(this, 'ClientId', { value: client.ref })
    new CfnOutput(this, 'DistributionId', { value: distribution.ref })
    new CfnOutput(this, 'SiteBucketName', { value: siteBucket.ref })

    // 所有资源都设成"保留"：导入时 CloudFormation 要求每个资源都有删除策略；
    // 平时就算从代码里删掉某个资源，CloudFormation 也只是不再管它，不会真的删除
    for (const c of this.node.findAll()) {
      if (c instanceof CfnResource) c.applyRemovalPolicy(RemovalPolicy.RETAIN)
    }
  }
}
