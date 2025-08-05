"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HiSmartFrontendStack = void 0;
const cdk = require("aws-cdk-lib");
const s3 = require("aws-cdk-lib/aws-s3");
const s3deploy = require("aws-cdk-lib/aws-s3-deployment");
const cloudfront = require("aws-cdk-lib/aws-cloudfront");
const origins = require("aws-cdk-lib/aws-cloudfront-origins");
class HiSmartFrontendStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        // S3 Bucket para alojar la aplicación React
        this.websiteBucket = new s3.Bucket(this, 'WebsiteBucket', {
            bucketName: `hismart-frontend-${this.account}-${this.region}`,
            websiteIndexDocument: 'index.html',
            websiteErrorDocument: 'error.html',
            publicReadAccess: false,
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
                    cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
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
            priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
            enabled: true,
            comment: 'HISmart Frontend Distribution'
        });
        // Generar archivo de configuración para el frontend
        const configFileContent = JSON.stringify({
            aws_project_region: this.region,
            aws_cognito_region: this.region,
            aws_user_pools_id: props.userPool.userPoolId,
            aws_user_pools_web_client_id: props.userPoolClient.userPoolClientId,
            aws_cognito_identity_pool_id: '',
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
exports.HiSmartFrontendStack = HiSmartFrontendStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaGlzbWFydC1mcm9udGVuZC1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImhpc21hcnQtZnJvbnRlbmQtc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsbUNBQW1DO0FBQ25DLHlDQUF5QztBQUN6QywwREFBMEQ7QUFDMUQseURBQXlEO0FBQ3pELDhEQUE4RDtBQWE5RCxNQUFhLG9CQUFxQixTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBSWpELFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBZ0M7UUFDeEUsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIsNENBQTRDO1FBQzVDLElBQUksQ0FBQyxhQUFhLEdBQUcsSUFBSSxFQUFFLENBQUMsTUFBTSxDQUFDLElBQUksRUFBRSxlQUFlLEVBQUU7WUFDeEQsVUFBVSxFQUFFLG9CQUFvQixJQUFJLENBQUMsT0FBTyxJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUU7WUFDN0Qsb0JBQW9CLEVBQUUsWUFBWTtZQUNsQyxvQkFBb0IsRUFBRSxZQUFZO1lBQ2xDLGdCQUFnQixFQUFFLEtBQUs7WUFDdkIsaUJBQWlCLEVBQUUsRUFBRSxDQUFDLGlCQUFpQixDQUFDLFNBQVM7WUFDakQsYUFBYSxFQUFFLEdBQUcsQ0FBQyxhQUFhLENBQUMsT0FBTyxDQUFDLHVDQUF1QztTQUNqRixDQUFDLENBQUM7UUFFSCx5Q0FBeUM7UUFDekMsTUFBTSxvQkFBb0IsR0FBRyxJQUFJLFVBQVUsQ0FBQyxvQkFBb0IsQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFO1lBQzVFLE9BQU8sRUFBRSx5QkFBeUI7U0FDbkMsQ0FBQyxDQUFDO1FBRUgsbURBQW1EO1FBQ25ELElBQUksQ0FBQyxhQUFhLENBQUMsU0FBUyxDQUFDLG9CQUFvQixDQUFDLENBQUM7UUFFbkQscURBQXFEO1FBQ3JELE1BQU0sWUFBWSxHQUFHLElBQUksVUFBVSxDQUFDLFFBQVEsQ0FBQyxJQUFJ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RCxDQUFDLENBQUM7SUFDTCxDQUFDO0NBQ0Y7QUFyTEQsb0RBcUxDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCAqIGFzIHMzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zMyc7XG5pbXBvcnQgKiBhcyBzM2RlcGxveSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtczMtZGVwbG95bWVudCc7XG5pbXBvcnQgKiBhcyBjbG91ZGZyb250IGZyb20gJ2F3cy1jZGstbGliL2F3cy1jbG91ZGZyb250JztcbmltcG9ydCAqIGFzIG9yaWdpbnMgZnJvbSAnYXdzLWNkay1saWIvYXdzLWNsb3VkZnJvbnQtb3JpZ2lucyc7XG5pbXBvcnQgKiBhcyBhcGlnYXRld2F5IGZyb20gJ2F3cy1jZGstbGliL2F3cy1hcGlnYXRld2F5JztcbmltcG9ydCAqIGFzIGNvZ25pdG8gZnJvbSAnYXdzLWNkay1saWIvYXdzLWNvZ25pdG8nO1xuaW1wb3J0ICogYXMgcm91dGU1MyBmcm9tICdhd3MtY2RrLWxpYi9hd3Mtcm91dGU1Myc7XG5pbXBvcnQgKiBhcyB0YXJnZXRzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1yb3V0ZTUzLXRhcmdldHMnO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5cbmludGVyZmFjZSBIaVNtYXJ0RnJvbnRlbmRTdGFja1Byb3BzIGV4dGVuZHMgY2RrLlN0YWNrUHJvcHMge1xuICBhcGk6IGFwaWdhdGV3YXkuUmVzdEFwaTtcbiAgdXNlclBvb2w6IGNvZ25pdG8uVXNlclBvb2w7XG4gIHVzZXJQb29sQ2xpZW50OiBjb2duaXRvLlVzZXJQb29sQ2xpZW50O1xufVxuXG5leHBvcnQgY2xhc3MgSGlTbWFydEZyb250ZW5kU3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xuICBwdWJsaWMgcmVhZG9ubHkgd2Vic2l0ZUJ1Y2tldDogczMuQnVja2V0O1xuICBwdWJsaWMgcmVhZG9ubHkgZGlzdHJpYnV0aW9uOiBjbG91ZGZyb250LkRpc3RyaWJ1dGlvbjtcblxuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczogSGlTbWFydEZyb250ZW5kU3RhY2tQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xuXG4gICAgLy8gUzMgQnVja2V0IHBhcmEgYWxvamFyIGxhIGFwbGljYWNpw7NuIFJlYWN0XG4gICAgdGhpcy53ZWJzaXRlQnVja2V0ID0gbmV3IHMzLkJ1Y2tldCh0aGlzLCAnV2Vic2l0ZUJ1Y2tldCcsIHtcbiAgICAgIGJ1Y2tldE5hbWU6IGBoaXNtYXJ0LWZyb250ZW5kLSR7dGhpcy5hY2NvdW50fS0ke3RoaXMucmVnaW9ufWAsXG4gICAgICB3ZWJzaXRlSW5kZXhEb2N1bWVudDogJ2luZGV4Lmh0bWwnLFxuICAgICAgd2Vic2l0ZUVycm9yRG9jdW1lbnQ6ICdlcnJvci5odG1sJyxcbiAgICAgIHB1YmxpY1JlYWRBY2Nlc3M6IGZhbHNlLCAvLyBDbG91ZEZyb250IG1hbmVqYXLDoSBlbCBhY2Nlc29cbiAgICAgIGJsb2NrUHVibGljQWNjZXNzOiBzMy5CbG9ja1B1YmxpY0FjY2Vzcy5CTE9DS19BTEwsXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZIC8vIFBhcmEgZGVzYXJyb2xsbywgZW4gcHJvZCB1c2FyIFJFVEFJTlxuICAgIH0pO1xuXG4gICAgLy8gT3JpZ2luIEFjY2VzcyBJZGVudGl0eSBwYXJhIENsb3VkRnJvbnRcbiAgICBjb25zdCBvcmlnaW5BY2Nlc3NJZGVudGl0eSA9IG5ldyBjbG91ZGZyb250Lk9yaWdpbkFjY2Vzc0lkZW50aXR5KHRoaXMsICdPQUknLCB7XG4gICAgICBjb21tZW50OiAnT0FJIGZvciBISVNtYXJ0IHdlYnNpdGUnXG4gICAgfSk7XG5cbiAgICAvLyBEYXIgcGVybWlzb3MgYSBDbG91ZEZyb250IHBhcmEgYWNjZWRlciBhbCBidWNrZXRcbiAgICB0aGlzLndlYnNpdGVCdWNrZXQuZ3JhbnRSZWFkKG9yaWdpbkFjY2Vzc0lkZW50aXR5KTtcblxuICAgIC8vIEZ1bmNpw7NuIExhbWJkYUBFZGdlIHBhcmEgbWFuZWpvIGRlIFNQQXMgKG9wY2lvbmFsKVxuICAgIGNvbnN0IGVkZ2VGdW5jdGlvbiA9IG5ldyBjbG91ZGZyb250LkZ1bmN0aW9uKHRoaXMsICdJbmRleFJld3JpdGVGdW5jdGlvbicsIHtcbiAgICAgIGZ1bmN0aW9uTmFtZTogJ2hpc21hcnQtaW5kZXgtcmV3cml0ZScsXG4gICAgICBjb2RlOiBjbG91ZGZyb250LkZ1bmN0aW9uQ29kZS5mcm9tSW5saW5lKGBcbiAgICAgICAgZnVuY3Rpb24gaGFuZGxlcihldmVudCkge1xuICAgICAgICAgIHZhciByZXF1ZXN0ID0gZXZlbnQucmVxdWVzdDtcbiAgICAgICAgICB2YXIgdXJpID0gcmVxdWVzdC51cmk7XG4gICAgICAgICAgXG4gICAgICAgICAgLy8gUmVkaXJpZ2lyIHJlcXVlc3RzIHNpbiBleHRlbnNpw7NuIGEgaW5kZXguaHRtbCAocGFyYSBSZWFjdCBSb3V0ZXIpXG4gICAgICAgICAgaWYgKHVyaS5lbmRzV2l0aCgnLycpKSB7XG4gICAgICAgICAgICByZXF1ZXN0LnVyaSArPSAnaW5kZXguaHRtbCc7XG4gICAgICAgICAgfSBlbHNlIGlmICghdXJpLmluY2x1ZGVzKCcuJykpIHtcbiAgICAgICAgICAgIHJlcXVlc3QudXJpID0gJy9pbmRleC5odG1sJztcbiAgICAgICAgICB9XG4gICAgICAgICAgXG4gICAgICAgICAgcmV0dXJuIHJlcXVlc3Q7XG4gICAgICAgIH1cbiAgICAgIGApXG4gICAgfSk7XG5cbiAgICAvLyBDbG91ZEZyb250IERpc3RyaWJ1dGlvblxuICAgIHRoaXMuZGlzdHJpYnV0aW9uID0gbmV3IGNsb3VkZnJvbnQuRGlzdHJpYnV0aW9uKHRoaXMsICdEaXN0cmlidXRpb24nLCB7XG4gICAgICBkZWZhdWx0QmVoYXZpb3I6IHtcbiAgICAgICAgb3JpZ2luOiBuZXcgb3JpZ2lucy5TM09yaWdpbih0aGlzLndlYnNpdGVCdWNrZXQsIHtcbiAgICAgICAgICBvcmlnaW5BY2Nlc3NJZGVudGl0eVxuICAgICAgICB9KSxcbiAgICAgICAgdmlld2VyUHJvdG9jb2xQb2xpY3k6IGNsb3VkZnJvbnQuVmlld2VyUHJvdG9jb2xQb2xpY3kuUkVESVJFQ1RfVE9fSFRUUFMsXG4gICAgICAgIGFsbG93ZWRNZXRob2RzOiBjbG91ZGZyb250LkFsbG93ZWRNZXRob2RzLkFMTE9XX0dFVF9IRUFEX09QVElPTlMsXG4gICAgICAgIGNhY2hlZE1ldGhvZHM6IGNsb3VkZnJvbnQuQ2FjaGVkTWV0aG9kcy5DQUNIRV9HRVRfSEVBRF9PUFRJT05TLFxuICAgICAgICBjb21wcmVzczogdHJ1ZSxcbiAgICAgICAgY2FjaGVQb2xpY3k6IGNsb3VkZnJvbnQuQ2FjaGVQb2xpY3kuQ0FDSElOR19PUFRJTUlaRUQsXG4gICAgICAgIGZ1bmN0aW9uQXNzb2NpYXRpb25zOiBbXG4gICAgICAgICAge1xuICAgICAgICAgICAgZnVuY3Rpb246IGVkZ2VGdW5jdGlvbixcbiAgICAgICAgICAgIGV2ZW50VHlwZTogY2xvdWRmcm9udC5GdW5jdGlvbkV2ZW50VHlwZS5WSUVXRVJfUkVRVUVTVFxuICAgICAgICAgIH1cbiAgICAgICAgXVxuICAgICAgfSxcbiAgICAgIGFkZGl0aW9uYWxCZWhhdmlvcnM6IHtcbiAgICAgICAgLy8gQ29tcG9ydGFtaWVudG8gZXNwZWPDrWZpY28gcGFyYSBBUEkgY2FsbHNcbiAgICAgICAgJy9hcGkvKic6IHtcbiAgICAgICAgICBvcmlnaW46IG5ldyBvcmlnaW5zLlJlc3RBcGlPcmlnaW4ocHJvcHMuYXBpKSxcbiAgICAgICAgICB2aWV3ZXJQcm90b2NvbFBvbGljeTogY2xvdWRmcm9udC5WaWV3ZXJQcm90b2NvbFBvbGljeS5IVFRQU19PTkxZLFxuICAgICAgICAgIGFsbG93ZWRNZXRob2RzOiBjbG91ZGZyb250LkFsbG93ZWRNZXRob2RzLkFMTE9XX0FMTCxcbiAgICAgICAgICBjYWNoZVBvbGljeTogY2xvdWRmcm9udC5DYWNoZVBvbGljeS5DQUNISU5HX0RJU0FCTEVELCAvLyBObyBjYWNoZWFyIEFQSXNcbiAgICAgICAgICBvcmlnaW5SZXF1ZXN0UG9saWN5OiBjbG91ZGZyb250Lk9yaWdpblJlcXVlc3RQb2xpY3kuQUxMX1ZJRVdFUl9FWENFUFRfSE9TVF9IRUFERVJcbiAgICAgICAgfSxcbiAgICAgICAgLy8gQ29tcG9ydGFtaWVudG8gcGFyYSBhc3NldHMgZXN0w6F0aWNvcyBjb24gY2FjaGUgbGFyZ29cbiAgICAgICAgJy9zdGF0aWMvKic6IHtcbiAgICAgICAgICBvcmlnaW46IG5ldyBvcmlnaW5zLlMzT3JpZ2luKHRoaXMud2Vic2l0ZUJ1Y2tldCwge1xuICAgICAgICAgICAgb3JpZ2luQWNjZXNzSWRlbnRpdHlcbiAgICAgICAgICB9KSxcbiAgICAgICAgICB2aWV3ZXJQcm90b2NvbFBvbGljeTogY2xvdWRmcm9udC5WaWV3ZXJQcm90b2NvbFBvbGljeS5IVFRQU19PTkxZLFxuICAgICAgICAgIGNhY2hlUG9saWN5OiBjbG91ZGZyb250LkNhY2hlUG9saWN5LkNBQ0hJTkdfT1BUSU1JWkVELFxuICAgICAgICAgIGNvbXByZXNzOiB0cnVlXG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICBkZWZhdWx0Um9vdE9iamVjdDogJ2luZGV4Lmh0bWwnLFxuICAgICAgZXJyb3JSZXNwb25zZXM6IFtcbiAgICAgICAge1xuICAgICAgICAgIGh0dHBTdGF0dXM6IDQwMyxcbiAgICAgICAgICByZXNwb25zZUh0dHBTdGF0dXM6IDIwMCxcbiAgICAgICAgICByZXNwb25zZVBhZ2VQYXRoOiAnL2luZGV4Lmh0bWwnLFxuICAgICAgICAgIHR0bDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoMzApXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBodHRwU3RhdHVzOiA0MDQsXG4gICAgICAgICAgcmVzcG9uc2VIdHRwU3RhdHVzOiAyMDAsXG4gICAgICAgICAgcmVzcG9uc2VQYWdlUGF0aDogJy9pbmRleC5odG1sJyxcbiAgICAgICAgICB0dGw6IGNkay5EdXJhdGlvbi5taW51dGVzKDMwKVxuICAgICAgICB9XG4gICAgICBdLFxuICAgICAgcHJpY2VDbGFzczogY2xvdWRmcm9udC5QcmljZUNsYXNzLlBSSUNFX0NMQVNTXzEwMCwgLy8gU29sbyBVUywgQ2FuYWRhLCBFdXJvcGVcbiAgICAgIGVuYWJsZWQ6IHRydWUsXG4gICAgICBjb21tZW50OiAnSElTbWFydCBGcm9udGVuZCBEaXN0cmlidXRpb24nXG4gICAgfSk7XG5cbiAgICAvLyBHZW5lcmFyIGFyY2hpdm8gZGUgY29uZmlndXJhY2nDs24gcGFyYSBlbCBmcm9udGVuZFxuICAgIGNvbnN0IGNvbmZpZ0ZpbGVDb250ZW50ID0gSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgYXdzX3Byb2plY3RfcmVnaW9uOiB0aGlzLnJlZ2lvbixcbiAgICAgIGF3c19jb2duaXRvX3JlZ2lvbjogdGhpcy5yZWdpb24sXG4gICAgICBhd3NfdXNlcl9wb29sc19pZDogcHJvcHMudXNlclBvb2wudXNlclBvb2xJZCxcbiAgICAgIGF3c191c2VyX3Bvb2xzX3dlYl9jbGllbnRfaWQ6IHByb3BzLnVzZXJQb29sQ2xpZW50LnVzZXJQb29sQ2xpZW50SWQsXG4gICAgICBhd3NfY29nbml0b19pZGVudGl0eV9wb29sX2lkOiAnJywgLy8gU2UgY29tcGxldGFyw6EgZGVzcHXDqXMgZGVsIGRlcGxveVxuICAgICAgYXdzX2FwaV9nYXRld2F5OiB7XG4gICAgICAgIHVybDogcHJvcHMuYXBpLnVybCxcbiAgICAgICAgcmVnaW9uOiB0aGlzLnJlZ2lvblxuICAgICAgfSxcbiAgICAgIGF3c19jbG91ZF9sb2dpY19jdXN0b206IFtcbiAgICAgICAge1xuICAgICAgICAgIG5hbWU6ICdIaVNtYXJ0QVBJJyxcbiAgICAgICAgICBlbmRwb2ludDogcHJvcHMuYXBpLnVybCxcbiAgICAgICAgICByZWdpb246IHRoaXMucmVnaW9uXG4gICAgICAgIH1cbiAgICAgIF0sXG4gICAgICBicmFuZGluZzoge1xuICAgICAgICBjb25maWdfcGF0aDogJy9icmFuZGluZy9icmFuZGluZy5qc29uJ1xuICAgICAgfSxcbiAgICAgIGFwcF92ZXJzaW9uOiAnMS4wLjAnLFxuICAgICAgYnVpbGRfdGltZXN0YW1wOiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKClcbiAgICB9LCBudWxsLCAyKTtcblxuICAgIC8vIERlcGxveW1lbnQgZGVsIGZyb250ZW5kIChzZSBlamVjdXRhcsOhIGN1YW5kbyBleGlzdGFuIGxvcyBhcmNoaXZvcyBidWlsZC8pXG4gICAgY29uc3QgZGVwbG95bWVudCA9IG5ldyBzM2RlcGxveS5CdWNrZXREZXBsb3ltZW50KHRoaXMsICdEZXBsb3lXZWJzaXRlJywge1xuICAgICAgc291cmNlczogW1xuICAgICAgICBzM2RlcGxveS5Tb3VyY2UuYXNzZXQoJy4uL2Zyb250ZW5kL2J1aWxkJywge1xuICAgICAgICAgIGJ1bmRsaW5nOiB7XG4gICAgICAgICAgICBpbWFnZTogY2RrLkRvY2tlckltYWdlLmZyb21SZWdpc3RyeSgnbm9kZToxOC1hbHBpbmUnKSxcbiAgICAgICAgICAgIGNvbW1hbmQ6IFtcbiAgICAgICAgICAgICAgJ3NoJywgJy1jJywgW1xuICAgICAgICAgICAgICAgICdlY2hvIFwiQ29uZmlndXJhbmRvIGZyb250ZW5kLi4uXCInLFxuICAgICAgICAgICAgICAgIGBlY2hvICcke2NvbmZpZ0ZpbGVDb250ZW50fScgPiAvdG1wL2F3cy1jb25maWcuanNvbmAsXG4gICAgICAgICAgICAgICAgJ2NwIC1yIC9hc3NldC1pbnB1dC8qIC9hc3NldC1vdXRwdXQvJyxcbiAgICAgICAgICAgICAgICAnY3AgL3RtcC9hd3MtY29uZmlnLmpzb24gL2Fzc2V0LW91dHB1dC9hd3MtY29uZmlnLmpzb24nXG4gICAgICAgICAgICAgIF0uam9pbignICYmICcpXG4gICAgICAgICAgICBdXG4gICAgICAgICAgfVxuICAgICAgICB9KSxcbiAgICAgICAgczNkZXBsb3kuU291cmNlLmpzb25EYXRhKCdhd3MtY29uZmlnLmpzb24nLCBKU09OLnBhcnNlKGNvbmZpZ0ZpbGVDb250ZW50KSlcbiAgICAgIF0sXG4gICAgICBkZXN0aW5hdGlvbkJ1Y2tldDogdGhpcy53ZWJzaXRlQnVja2V0LFxuICAgICAgZGlzdHJpYnV0aW9uOiB0aGlzLmRpc3RyaWJ1dGlvbixcbiAgICAgIGRpc3RyaWJ1dGlvblBhdGhzOiBbJy8qJ11cbiAgICB9KTtcblxuICAgIC8vIE91dHB1dHNcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnV2Vic2l0ZUJ1Y2tldE5hbWUnLCB7XG4gICAgICB2YWx1ZTogdGhpcy53ZWJzaXRlQnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogJ05vbWJyZSBkZWwgYnVja2V0IFMzIHBhcmEgZWwgZnJvbnRlbmQnLFxuICAgICAgZXhwb3J0TmFtZTogYCR7dGhpcy5zdGFja05hbWV9LVdlYnNpdGVCdWNrZXRgXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnRGlzdHJpYnV0aW9uSWQnLCB7XG4gICAgICB2YWx1ZTogdGhpcy5kaXN0cmlidXRpb24uZGlzdHJpYnV0aW9uSWQsXG4gICAgICBkZXNjcmlwdGlvbjogJ0lEIGRlIGxhIGRpc3RyaWJ1Y2nDs24gQ2xvdWRGcm9udCcsXG4gICAgICBleHBvcnROYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tRGlzdHJpYnV0aW9uSWRgXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnV2Vic2l0ZVVybCcsIHtcbiAgICAgIHZhbHVlOiBgaHR0cHM6Ly8ke3RoaXMuZGlzdHJpYnV0aW9uLmRpc3RyaWJ1dGlvbkRvbWFpbk5hbWV9YCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnVVJMIGRlbCBzaXRpbyB3ZWInLFxuICAgICAgZXhwb3J0TmFtZTogYCR7dGhpcy5zdGFja05hbWV9LVdlYnNpdGVVcmxgXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQ2xvdWRGcm9udERvbWFpbk5hbWUnLCB7XG4gICAgICB2YWx1ZTogdGhpcy5kaXN0cmlidXRpb24uZGlzdHJpYnV0aW9uRG9tYWluTmFtZSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnTm9tYnJlIGRlIGRvbWluaW8gZGUgQ2xvdWRGcm9udCcsXG4gICAgICBleHBvcnROYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tQ2xvdWRGcm9udERvbWFpbmBcbiAgICB9KTtcblxuICAgIC8vIE91dHB1dCBjb24gbGFzIGNvbmZpZ3VyYWNpb25lcyBwYXJhIGVsIGZyb250ZW5kXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0Zyb250ZW5kQ29uZmlnJywge1xuICAgICAgdmFsdWU6IGNvbmZpZ0ZpbGVDb250ZW50LFxuICAgICAgZGVzY3JpcHRpb246ICdDb25maWd1cmFjacOzbiBwYXJhIGxhIGFwbGljYWNpw7NuIGZyb250ZW5kJ1xuICAgIH0pO1xuICB9XG59Il19