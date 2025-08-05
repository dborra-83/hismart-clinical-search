import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import { Construct } from 'constructs';

interface HiSmartFrontendStackProps extends cdk.StackProps {
  api: apigateway.RestApi;
  userPool: cognito.UserPool;
  userPoolClient: cognito.UserPoolClient;
}

export class HiSmartFrontendStack extends cdk.Stack {
  public readonly websiteBucket: s3.Bucket;
  public readonly distribution: cloudfront.Distribution;

  constructor(scope: Construct, id: string, props: HiSmartFrontendStackProps) {
    super(scope, id, props);

    // S3 Bucket para alojar la aplicación React
    this.websiteBucket = new s3.Bucket(this, 'WebsiteBucket', {
      bucketName: `hismart-frontend-${this.account}-${this.region}`,
      websiteIndexDocument: 'index.html',
      websiteErrorDocument: 'error.html',
      publicReadAccess: false, // CloudFront manejará el acceso
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY // Para desarrollo, en prod usar RETAIN
    });

    // Origin Access Identity para CloudFront
    const originAccessIdentity = new cloudfront.OriginAccessIdentity(this, 'OAI', {
      comment: 'OAI for HISmart website'
    });

    // Dar permisos a CloudFront para acceder al bucket
    this.websiteBucket.grantRead(originAccessIdentity);

    // Función Lambda@Edge para manejo de SPAs (opcional)
    const edgeFunction = new cloudfront.Function(this, 'IndexRewriteFunction', {
      functionName: 'hismart-index-rewrite',
      code: cloudfront.FunctionCode.fromInline(`
        function handler(event) {
          var request = event.request;
          var uri = request.uri;
          
          // Redirigir requests sin extensión a index.html (para React Router)
          if (uri.endsWith('/')) {
            request.uri += 'index.html';
          } else if (!uri.includes('.')) {
            request.uri = '/index.html';
          }
          
          return request;
        }
      `)
    });

    // CloudFront Distribution
    this.distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin: new origins.S3Origin(this.websiteBucket, {
          originAccessIdentity
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
        compress: true,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        functionAssociations: [
          {
            function: edgeFunction,
            eventType: cloudfront.FunctionEventType.VIEWER_REQUEST
          }
        ]
      },
      additionalBehaviors: {
        // Comportamiento específico para API calls
        '/api/*': {
          origin: new origins.RestApiOrigin(props.api),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED, // No cachear APIs
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER
        },
        // Comportamiento para assets estáticos con cache largo
        '/static/*': {
          origin: new origins.S3Origin(this.websiteBucket, {
            originAccessIdentity
          }),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
          compress: true
        }
      },
      defaultRootObject: 'index.html',
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.minutes(30)
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.minutes(30)
        }
      ],
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100, // Solo US, Canada, Europe
      enabled: true,
      comment: 'HISmart Frontend Distribution'
    });

    // Generar archivo de configuración para el frontend
    const configFileContent = JSON.stringify({
      aws_project_region: this.region,
      aws_cognito_region: this.region,
      aws_user_pools_id: props.userPool.userPoolId,
      aws_user_pools_web_client_id: props.userPoolClient.userPoolClientId,
      aws_cognito_identity_pool_id: '', // Se completará después del deploy
      aws_api_gateway: {
        url: props.api.url,
        region: this.region
      },
      aws_cloud_logic_custom: [
        {
          name: 'HiSmartAPI',
          endpoint: props.api.url,
          region: this.region
        }
      ],
      branding: {
        config_path: '/branding/branding.json'
      },
      app_version: '1.0.0',
      build_timestamp: new Date().toISOString()
    }, null, 2);

    // Deployment del frontend (se ejecutará cuando existan los archivos build/)
    const deployment = new s3deploy.BucketDeployment(this, 'DeployWebsite', {
      sources: [
        s3deploy.Source.asset('../frontend/build', {
          bundling: {
            image: cdk.DockerImage.fromRegistry('node:18-alpine'),
            command: [
              'sh', '-c', [
                'echo "Configurando frontend..."',
                `echo '${configFileContent}' > /tmp/aws-config.json`,
                'cp -r /asset-input/* /asset-output/',
                'cp /tmp/aws-config.json /asset-output/aws-config.json'
              ].join(' && ')
            ]
          }
        }),
        s3deploy.Source.jsonData('aws-config.json', JSON.parse(configFileContent))
      ],
      destinationBucket: this.websiteBucket,
      distribution: this.distribution,
      distributionPaths: ['/*']
    });

    // Outputs
    new cdk.CfnOutput(this, 'WebsiteBucketName', {
      value: this.websiteBucket.bucketName,
      description: 'Nombre del bucket S3 para el frontend',
      exportName: `${this.stackName}-WebsiteBucket`
    });

    new cdk.CfnOutput(this, 'DistributionId', {
      value: this.distribution.distributionId,
      description: 'ID de la distribución CloudFront',
      exportName: `${this.stackName}-DistributionId`
    });

    new cdk.CfnOutput(this, 'WebsiteUrl', {
      value: `https://${this.distribution.distributionDomainName}`,
      description: 'URL del sitio web',
      exportName: `${this.stackName}-WebsiteUrl`
    });

    new cdk.CfnOutput(this, 'CloudFrontDomainName', {
      value: this.distribution.distributionDomainName,
      description: 'Nombre de dominio de CloudFront',
      exportName: `${this.stackName}-CloudFrontDomain`
    });

    // Output con las configuraciones para el frontend
    new cdk.CfnOutput(this, 'FrontendConfig', {
      value: configFileContent,
      description: 'Configuración para la aplicación frontend'
    });
  }
}