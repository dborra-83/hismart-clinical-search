"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HiSmartBackendStack = void 0;
const cdk = require("aws-cdk-lib");
const lambda = require("aws-cdk-lib/aws-lambda");
const apigateway = require("aws-cdk-lib/aws-apigateway");
const s3 = require("aws-cdk-lib/aws-s3");
const s3n = require("aws-cdk-lib/aws-s3-notifications");
const iam = require("aws-cdk-lib/aws-iam");
const logs = require("aws-cdk-lib/aws-logs");
class HiSmartBackendStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        // Rol común para todas las Lambdas
        const lambdaExecutionRole = new iam.Role(this, 'LambdaExecutionRole', {
            roleName: 'HISmart-LambdaExecutionRole',
            assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')
            ],
            inlinePolicies: {
                'HiSmartLambdaPolicy': new iam.PolicyDocument({
                    statements: [
                        // Acceso a DynamoDB
                        new iam.PolicyStatement({
                            effect: iam.Effect.ALLOW,
                            actions: [
                                'dynamodb:PutItem',
                                'dynamodb:GetItem',
                                'dynamodb:UpdateItem',
                                'dynamodb:DeleteItem',
                                'dynamodb:Query',
                                'dynamodb:Scan'
                            ],
                            resources: [
                                props.table.tableArn,
                                `${props.table.tableArn}/index/*`
                            ]
                        }),
                        // Acceso a S3
                        new iam.PolicyStatement({
                            effect: iam.Effect.ALLOW,
                            actions: [
                                's3:GetObject',
                                's3:PutObject',
                                's3:DeleteObject'
                            ],
                            resources: [`${props.bucket.bucketArn}/*`]
                        }),
                        // Acceso a Bedrock para IA
                        new iam.PolicyStatement({
                            effect: iam.Effect.ALLOW,
                            actions: [
                                'bedrock:InvokeModel',
                                'bedrock:InvokeModelWithResponseStream'
                            ],
                            resources: [
                                `arn:aws:bedrock:${this.region}::foundation-model/anthropic.claude-3-sonnet-20240229-v1:0`,
                                `arn:aws:bedrock:${this.region}::foundation-model/anthropic.claude-3-haiku-20240307-v1:0`
                            ]
                        }),
                        // CloudWatch Logs
                        new iam.PolicyStatement({
                            effect: iam.Effect.ALLOW,
                            actions: [
                                'logs:CreateLogGroup',
                                'logs:CreateLogStream',
                                'logs:PutLogEvents'
                            ],
                            resources: [`arn:aws:logs:${this.region}:${this.account}:*`]
                        })
                    ]
                })
            }
        });
        // Lambda para parsear archivos CSV
        this.excelParserFunction = new lambda.Function(this, 'CsvParserFunction', {
            functionName: 'HISmart-CsvParser',
            runtime: lambda.Runtime.NODEJS_18_X,
            handler: 'index.handler',
            code: lambda.Code.fromAsset('../backend/csv-parser'),
            timeout: cdk.Duration.minutes(5),
            memorySize: 512,
            role: lambdaExecutionRole,
            environment: {
                DYNAMODB_TABLE_NAME: props.table.tableName,
                S3_BUCKET_NAME: props.bucket.bucketName,
                BEDROCK_REGION: this.region
            },
            logRetention: logs.RetentionDays.ONE_MONTH
        });
        // Lambda para operaciones CRUD via API
        this.crudApiFunction = new lambda.Function(this, 'CrudApiFunction', {
            functionName: 'HISmart-CrudApi',
            runtime: lambda.Runtime.NODEJS_18_X,
            handler: 'index.handler',
            code: lambda.Code.fromAsset('../backend/crud-api'),
            timeout: cdk.Duration.seconds(30),
            memorySize: 256,
            role: lambdaExecutionRole,
            environment: {
                DYNAMODB_TABLE_NAME: props.table.tableName,
                S3_BUCKET_NAME: props.bucket.bucketName,
                USER_POOL_ID: props.userPool.userPoolId
            },
            logRetention: logs.RetentionDays.ONE_MONTH
        });
        // Lambda para análisis con IA (Bedrock Claude)
        this.aiAnalysisFunction = new lambda.Function(this, 'AiAnalysisFunction', {
            functionName: 'HISmart-AiAnalysis',
            runtime: lambda.Runtime.NODEJS_18_X,
            handler: 'index.handler',
            code: lambda.Code.fromAsset('../backend/ai-analysis'),
            timeout: cdk.Duration.minutes(2),
            memorySize: 512,
            role: lambdaExecutionRole,
            environment: {
                DYNAMODB_TABLE_NAME: props.table.tableName,
                BEDROCK_REGION: this.region,
                BEDROCK_MODEL_ID: 'anthropic.claude-3-sonnet-20240229-v1:0'
            },
            logRetention: logs.RetentionDays.ONE_MONTH
        });
        // Trigger S3 → Lambda para procesar archivos CSV
        props.bucket.addEventNotification(s3.EventType.OBJECT_CREATED, new s3n.LambdaDestination(this.excelParserFunction), {
            prefix: 'uploads/',
            suffix: '.csv'
        });
        // Cognito Authorizer para API Gateway
        const cognitoAuthorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'CognitoAuthorizer', {
            cognitoUserPools: [props.userPool],
            authorizerName: 'HiSmartAuthorizer',
            identitySource: 'method.request.header.Authorization'
        });
        // API Gateway REST API
        this.api = new apigateway.RestApi(this, 'HiSmartApi', {
            restApiName: 'HISmart-API',
            description: 'API para HISmart - Sistema de búsqueda clínica inteligente',
            defaultCorsPreflightOptions: {
                allowOrigins: ['http://localhost:3000', 'https://hismart.example.com'],
                allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
                allowHeaders: [
                    'Content-Type',
                    'X-Amz-Date',
                    'Authorization',
                    'X-Api-Key',
                    'X-Amz-Security-Token'
                ]
            },
            binaryMediaTypes: ['multipart/form-data'],
            endpointConfiguration: {
                types: [apigateway.EndpointType.REGIONAL]
            }
        });
        // Integración Lambda para CRUD operations
        const crudIntegration = new apigateway.LambdaIntegration(this.crudApiFunction, {
            proxy: true
        });
        // Integración Lambda para análisis IA
        const aiIntegration = new apigateway.LambdaIntegration(this.aiAnalysisFunction, {
            proxy: true
        });
        // Recursos y métodos de la API
        // /notes - Operaciones CRUD con notas clínicas
        const notesResource = this.api.root.addResource('notes');
        // GET /notes - Listar notas (con filtros)
        notesResource.addMethod('GET', crudIntegration, {
            authorizer: cognitoAuthorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO
        });
        // POST /notes - Crear nueva nota
        notesResource.addMethod('POST', crudIntegration, {
            authorizer: cognitoAuthorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO
        });
        // GET /notes/{id}
        const noteByIdResource = notesResource.addResource('{id}');
        noteByIdResource.addMethod('GET', crudIntegration, {
            authorizer: cognitoAuthorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO
        });
        // PUT /notes/{id}
        noteByIdResource.addMethod('PUT', crudIntegration, {
            authorizer: cognitoAuthorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO
        });
        // DELETE /notes/{id}
        noteByIdResource.addMethod('DELETE', crudIntegration, {
            authorizer: cognitoAuthorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO
        });
        // /search - Búsquedas avanzadas
        const searchResource = this.api.root.addResource('search');
        searchResource.addMethod('POST', crudIntegration, {
            authorizer: cognitoAuthorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO
        });
        // /analyze - Análisis con IA
        const analyzeResource = this.api.root.addResource('analyze');
        // POST /analyze/note - Analizar una nota específica
        const analyzeNoteResource = analyzeResource.addResource('note');
        analyzeNoteResource.addMethod('POST', aiIntegration, {
            authorizer: cognitoAuthorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO
        });
        // POST /analyze/summary - Generar resumen
        const analyzeSummaryResource = analyzeResource.addResource('summary');
        analyzeSummaryResource.addMethod('POST', aiIntegration, {
            authorizer: cognitoAuthorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO
        });
        // POST /analyze/risk - Análisis de riesgo
        const analyzeRiskResource = analyzeResource.addResource('risk');
        analyzeRiskResource.addMethod('POST', aiIntegration, {
            authorizer: cognitoAuthorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO
        });
        // /upload - Gestión de archivos
        const uploadResource = this.api.root.addResource('upload');
        // POST /upload/csv - Generar URL presignada para subir CSV
        const uploadCsvResource = uploadResource.addResource('csv');
        uploadCsvResource.addMethod('POST', crudIntegration, {
            authorizer: cognitoAuthorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO
        });
        // GET /upload/status/{jobId} - Verificar estado de procesamiento
        const uploadStatusResource = uploadResource.addResource('status').addResource('{jobId}');
        uploadStatusResource.addMethod('GET', crudIntegration, {
            authorizer: cognitoAuthorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO
        });
        // /stats - Estadísticas y métricas
        const statsResource = this.api.root.addResource('stats');
        // GET /stats/dashboard - Métricas para dashboard
        const statsDashboardResource = statsResource.addResource('dashboard');
        statsDashboardResource.addMethod('GET', crudIntegration, {
            authorizer: cognitoAuthorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO
        });
        // Logs de API Gateway
        const apiLogGroup = new logs.LogGroup(this, 'ApiGatewayLogGroup', {
            logGroupName: `/aws/apigateway/HISmart-API`,
            retention: logs.RetentionDays.ONE_MONTH
        });
        // Deployment con logging habilitado
        const deployment = new apigateway.Deployment(this, 'ApiDeployment', {
            api: this.api
        });
        const stage = new apigateway.Stage(this, 'ApiStage', {
            deployment,
            stageName: 'prod',
            accessLogDestination: new apigateway.LogGroupLogDestination(apiLogGroup),
            accessLogFormat: apigateway.AccessLogFormat.jsonWithStandardFields({
                caller: false,
                httpMethod: true,
                ip: true,
                protocol: true,
                requestTime: true,
                resourcePath: true,
                responseLength: true,
                status: true,
                user: true
            })
        });
        // Outputs
        new cdk.CfnOutput(this, 'ApiGatewayUrl', {
            value: this.api.url,
            description: 'URL base de la API Gateway',
            exportName: `${this.stackName}-ApiUrl`
        });
        new cdk.CfnOutput(this, 'CsvParserFunctionArn', {
            value: this.excelParserFunction.functionArn,
            description: 'ARN de la Lambda para procesar CSV',
            exportName: `${this.stackName}-CsvParserArn`
        });
        new cdk.CfnOutput(this, 'CrudApiFunctionArn', {
            value: this.crudApiFunction.functionArn,
            description: 'ARN de la Lambda para operaciones CRUD',
            exportName: `${this.stackName}-CrudApiArn`
        });
        new cdk.CfnOutput(this, 'AiAnalysisFunctionArn', {
            value: this.aiAnalysisFunction.functionArn,
            description: 'ARN de la Lambda para análisis IA',
            exportName: `${this.stackName}-AiAnalysisArn`
        });
    }
}
exports.HiSmartBackendStack = HiSmartBackendStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaGlzbWFydC1iYWNrZW5kLXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiaGlzbWFydC1iYWNrZW5kLXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLG1DQUFtQztBQUNuQyxpREFBaUQ7QUFDakQseURBQXlEO0FBQ3pELHlDQUF5QztBQUd6Qyx3REFBd0Q7QUFDeEQsMkNBQTJDO0FBQzNDLDZDQUE2QztBQVU3QyxNQUFhLG1CQUFvQixTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBTWhELFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBK0I7UUFDdkUsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIsbUNBQW1DO1FBQ25DLE1BQU0sbUJBQW1CLEdBQUcsSUFBSSxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxxQkFBcUIsRUFBRTtZQUNwRSxRQUFRLEVBQUUsNkJBQTZCO1lBQ3ZDLFNBQVMsRUFBRSxJQUFJLEdBQUcsQ0FBQyxnQkFBZ0IsQ0FBQyxzQkFBc0IsQ0FBQztZQUMzRCxlQUFlLEVBQUU7Z0JBQ2YsR0FBRyxDQUFDLGFBQWEsQ0FBQyx3QkFBd0IsQ0FBQywwQ0FBMEMsQ0FBQzthQUN2RjtZQUNELGNBQWMsRUFBRTtnQkFDZCxxQkFBcUIsRUFBRSxJQUFJLEdBQUcsQ0FBQyxjQUFjLENBQUM7b0JBQzVDLFVBQVUsRUFBRTt3QkFDVixvQkFBb0I7d0JBQ3BCLElBQUksR0FBRyxDQUFDLGVBQWUsQ0FBQzs0QkFDdEIsTUFBTSxFQUFFLEdBQUcsQ0FBQyxNQUFNLENBQUMsS0FBSzs0QkFDeEIsT0FBTyxFQUFFO2dDQUNQLGtCQUFrQjtnQ0FDbEIsa0JBQWtCO2dDQUNsQixxQkFBcUI7Z0NBQ3JCLHFCQUFxQjtnQ0FDckIsZ0JBQWdCO2dDQUNoQixlQUFlOzZCQUNoQjs0QkFDRCxTQUFTLEVBQUU7Z0NBQ1QsS0FBSyxDQUFDLEtBQUssQ0FBQyxRQUFRO2dDQUNwQixH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QUFFLHdDQUF3QztZQUNyRCxVQUFVLEVBQUUsR0FBRyxJQUFJLENBQUMsU0FBUyxhQUFhO1NBQzNDLENBQUMsQ0FBQztRQUVILElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsdUJBQXVCLEVBQUU7WUFDL0MsS0FBSyxFQUFFLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxXQUFXO1lBQzFDLFdBQVcsRUFBRSxtQ0FBbUM7WUFDaEQsVUFBVSxFQUFFLEdBQUcsSUFBSSxDQUFDLFNBQVMsZ0JBQWdCO1NBQzlDLENBQUMsQ0FBQztJQUNMLENBQUM7Q0FDRjtBQTlURCxrREE4VEMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0ICogYXMgbGFtYmRhIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sYW1iZGEnO1xuaW1wb3J0ICogYXMgYXBpZ2F0ZXdheSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtYXBpZ2F0ZXdheSc7XG5pbXBvcnQgKiBhcyBzMyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtczMnO1xuaW1wb3J0ICogYXMgZHluYW1vZGIgZnJvbSAnYXdzLWNkay1saWIvYXdzLWR5bmFtb2RiJztcbmltcG9ydCAqIGFzIGNvZ25pdG8gZnJvbSAnYXdzLWNkay1saWIvYXdzLWNvZ25pdG8nO1xuaW1wb3J0ICogYXMgczNuIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zMy1ub3RpZmljYXRpb25zJztcbmltcG9ydCAqIGFzIGlhbSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtaWFtJztcbmltcG9ydCAqIGFzIGxvZ3MgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxvZ3MnO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5cbmludGVyZmFjZSBIaVNtYXJ0QmFja2VuZFN0YWNrUHJvcHMgZXh0ZW5kcyBjZGsuU3RhY2tQcm9wcyB7XG4gIGJ1Y2tldDogczMuQnVja2V0O1xuICB0YWJsZTogZHluYW1vZGIuVGFibGU7XG4gIHVzZXJQb29sOiBjb2duaXRvLlVzZXJQb29sO1xuICB1c2VyUG9vbENsaWVudDogY29nbml0by5Vc2VyUG9vbENsaWVudDtcbn1cblxuZXhwb3J0IGNsYXNzIEhpU21hcnRCYWNrZW5kU3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xuICBwdWJsaWMgcmVhZG9ubHkgYXBpOiBhcGlnYXRld2F5LlJlc3RBcGk7XG4gIHB1YmxpYyByZWFkb25seSBleGNlbFBhcnNlckZ1bmN0aW9uOiBsYW1iZGEuRnVuY3Rpb247XG4gIHB1YmxpYyByZWFkb25seSBjcnVkQXBpRnVuY3Rpb246IGxhbWJkYS5GdW5jdGlvbjtcbiAgcHVibGljIHJlYWRvbmx5IGFpQW5hbHlzaXNGdW5jdGlvbjogbGFtYmRhLkZ1bmN0aW9uO1xuXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBIaVNtYXJ0QmFja2VuZFN0YWNrUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcblxuICAgIC8vIFJvbCBjb23Dum4gcGFyYSB0b2RhcyBsYXMgTGFtYmRhc1xuICAgIGNvbnN0IGxhbWJkYUV4ZWN1dGlvblJvbGUgPSBuZXcgaWFtLlJvbGUodGhpcywgJ0xhbWJkYUV4ZWN1dGlvblJvbGUnLCB7XG4gICAgICByb2xlTmFtZTogJ0hJU21hcnQtTGFtYmRhRXhlY3V0aW9uUm9sZScsXG4gICAgICBhc3N1bWVkQnk6IG5ldyBpYW0uU2VydmljZVByaW5jaXBhbCgnbGFtYmRhLmFtYXpvbmF3cy5jb20nKSxcbiAgICAgIG1hbmFnZWRQb2xpY2llczogW1xuICAgICAgICBpYW0uTWFuYWdlZFBvbGljeS5mcm9tQXdzTWFuYWdlZFBvbGljeU5hbWUoJ3NlcnZpY2Utcm9sZS9BV1NMYW1iZGFCYXNpY0V4ZWN1dGlvblJvbGUnKVxuICAgICAgXSxcbiAgICAgIGlubGluZVBvbGljaWVzOiB7XG4gICAgICAgICdIaVNtYXJ0TGFtYmRhUG9saWN5JzogbmV3IGlhbS5Qb2xpY3lEb2N1bWVudCh7XG4gICAgICAgICAgc3RhdGVtZW50czogW1xuICAgICAgICAgICAgLy8gQWNjZXNvIGEgRHluYW1vREJcbiAgICAgICAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgICAgICAgICBhY3Rpb25zOiBbXG4gICAgICAgICAgICAgICAgJ2R5bmFtb2RiOlB1dEl0ZW0nLFxuICAgICAgICAgICAgICAgICdkeW5hbW9kYjpHZXRJdGVtJyxcbiAgICAgICAgICAgICAgICAnZHluYW1vZGI6VXBkYXRlSXRlbScsXG4gICAgICAgICAgICAgICAgJ2R5bmFtb2RiOkRlbGV0ZUl0ZW0nLFxuICAgICAgICAgICAgICAgICdkeW5hbW9kYjpRdWVyeScsXG4gICAgICAgICAgICAgICAgJ2R5bmFtb2RiOlNjYW4nXG4gICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgIHJlc291cmNlczogW1xuICAgICAgICAgICAgICAgIHByb3BzLnRhYmxlLnRhYmxlQXJuLFxuICAgICAgICAgICAgICAgIGAke3Byb3BzLnRhYmxlLnRhYmxlQXJufS9pbmRleC8qYFxuICAgICAgICAgICAgICBdXG4gICAgICAgICAgICB9KSxcbiAgICAgICAgICAgIC8vIEFjY2VzbyBhIFMzXG4gICAgICAgICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgICAgICAgYWN0aW9uczogW1xuICAgICAgICAgICAgICAgICdzMzpHZXRPYmplY3QnLFxuICAgICAgICAgICAgICAgICdzMzpQdXRPYmplY3QnLFxuICAgICAgICAgICAgICAgICdzMzpEZWxldGVPYmplY3QnXG4gICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgIHJlc291cmNlczogW2Ake3Byb3BzLmJ1Y2tldC5idWNrZXRBcm59LypgXVxuICAgICAgICAgICAgfSksXG4gICAgICAgICAgICAvLyBBY2Nlc28gYSBCZWRyb2NrIHBhcmEgSUFcbiAgICAgICAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgICAgICAgICBhY3Rpb25zOiBbXG4gICAgICAgICAgICAgICAgJ2JlZHJvY2s6SW52b2tlTW9kZWwnLFxuICAgICAgICAgICAgICAgICdiZWRyb2NrOkludm9rZU1vZGVsV2l0aFJlc3BvbnNlU3RyZWFtJ1xuICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgICByZXNvdXJjZXM6IFtcbiAgICAgICAgICAgICAgICBgYXJuOmF3czpiZWRyb2NrOiR7dGhpcy5yZWdpb259Ojpmb3VuZGF0aW9uLW1vZGVsL2FudGhyb3BpYy5jbGF1ZGUtMy1zb25uZXQtMjAyNDAyMjktdjE6MGAsXG4gICAgICAgICAgICAgICAgYGFybjphd3M6YmVkcm9jazoke3RoaXMucmVnaW9ufTo6Zm91bmRhdGlvbi1tb2RlbC9hbnRocm9waWMuY2xhdWRlLTMtaGFpa3UtMjAyNDAzMDctdjE6MGBcbiAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgfSksXG4gICAgICAgICAgICAvLyBDbG91ZFdhdGNoIExvZ3NcbiAgICAgICAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgICAgICAgICBhY3Rpb25zOiBbXG4gICAgICAgICAgICAgICAgJ2xvZ3M6Q3JlYXRlTG9nR3JvdXAnLFxuICAgICAgICAgICAgICAgICdsb2dzOkNyZWF0ZUxvZ1N0cmVhbScsXG4gICAgICAgICAgICAgICAgJ2xvZ3M6UHV0TG9nRXZlbnRzJ1xuICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgICByZXNvdXJjZXM6IFtgYXJuOmF3czpsb2dzOiR7dGhpcy5yZWdpb259OiR7dGhpcy5hY2NvdW50fToqYF1cbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgXVxuICAgICAgICB9KVxuICAgICAgfVxuICAgIH0pO1xuXG4gICAgLy8gTGFtYmRhIHBhcmEgcGFyc2VhciBhcmNoaXZvcyBDU1ZcbiAgICB0aGlzLmV4Y2VsUGFyc2VyRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdDc3ZQYXJzZXJGdW5jdGlvbicsIHtcbiAgICAgIGZ1bmN0aW9uTmFtZTogJ0hJU21hcnQtQ3N2UGFyc2VyJyxcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxuICAgICAgaGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCcuLi9iYWNrZW5kL2Nzdi1wYXJzZXInKSxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgICAgbWVtb3J5U2l6ZTogNTEyLFxuICAgICAgcm9sZTogbGFtYmRhRXhlY3V0aW9uUm9sZSxcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIERZTkFNT0RCX1RBQkxFX05BTUU6IHByb3BzLnRhYmxlLnRhYmxlTmFtZSxcbiAgICAgICAgUzNfQlVDS0VUX05BTUU6IHByb3BzLmJ1Y2tldC5idWNrZXROYW1lLFxuICAgICAgICBCRURST0NLX1JFR0lPTjogdGhpcy5yZWdpb25cbiAgICAgIH0sXG4gICAgICBsb2dSZXRlbnRpb246IGxvZ3MuUmV0ZW50aW9uRGF5cy5PTkVfTU9OVEhcbiAgICB9KTtcblxuICAgIC8vIExhbWJkYSBwYXJhIG9wZXJhY2lvbmVzIENSVUQgdmlhIEFQSVxuICAgIHRoaXMuY3J1ZEFwaUZ1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnQ3J1ZEFwaUZ1bmN0aW9uJywge1xuICAgICAgZnVuY3Rpb25OYW1lOiAnSElTbWFydC1DcnVkQXBpJyxcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxuICAgICAgaGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCcuLi9iYWNrZW5kL2NydWQtYXBpJyksXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXG4gICAgICBtZW1vcnlTaXplOiAyNTYsXG4gICAgICByb2xlOiBsYW1iZGFFeGVjdXRpb25Sb2xlLFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgRFlOQU1PREJfVEFCTEVfTkFNRTogcHJvcHMudGFibGUudGFibGVOYW1lLFxuICAgICAgICBTM19CVUNLRVRfTkFNRTogcHJvcHMuYnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICAgIFVTRVJfUE9PTF9JRDogcHJvcHMudXNlclBvb2wudXNlclBvb2xJZFxuICAgICAgfSxcbiAgICAgIGxvZ1JldGVudGlvbjogbG9ncy5SZXRlbnRpb25EYXlzLk9ORV9NT05USFxuICAgIH0pO1xuXG4gICAgLy8gTGFtYmRhIHBhcmEgYW7DoWxpc2lzIGNvbiBJQSAoQmVkcm9jayBDbGF1ZGUpXG4gICAgdGhpcy5haUFuYWx5c2lzRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdBaUFuYWx5c2lzRnVuY3Rpb24nLCB7XG4gICAgICBmdW5jdGlvbk5hbWU6ICdISVNtYXJ0LUFpQW5hbHlzaXMnLFxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE4X1gsXG4gICAgICBoYW5kbGVyOiAnaW5kZXguaGFuZGxlcicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJy4uL2JhY2tlbmQvYWktYW5hbHlzaXMnKSxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5taW51dGVzKDIpLFxuICAgICAgbWVtb3J5U2l6ZTogNTEyLFxuICAgICAgcm9sZTogbGFtYmRhRXhlY3V0aW9uUm9sZSxcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIERZTkFNT0RCX1RBQkxFX05BTUU6IHByb3BzLnRhYmxlLnRhYmxlTmFtZSxcbiAgICAgICAgQkVEUk9DS19SRUdJT046IHRoaXMucmVnaW9uLFxuICAgICAgICBCRURST0NLX01PREVMX0lEOiAnYW50aHJvcGljLmNsYXVkZS0zLXNvbm5ldC0yMDI0MDIyOS12MTowJ1xuICAgICAgfSxcbiAgICAgIGxvZ1JldGVudGlvbjogbG9ncy5SZXRlbnRpb25EYXlzLk9ORV9NT05USFxuICAgIH0pO1xuXG4gICAgLy8gVHJpZ2dlciBTMyDihpIgTGFtYmRhIHBhcmEgcHJvY2VzYXIgYXJjaGl2b3MgQ1NWXG4gICAgcHJvcHMuYnVja2V0LmFkZEV2ZW50Tm90aWZpY2F0aW9uKFxuICAgICAgczMuRXZlbnRUeXBlLk9CSkVDVF9DUkVBVEVELFxuICAgICAgbmV3IHMzbi5MYW1iZGFEZXN0aW5hdGlvbih0aGlzLmV4Y2VsUGFyc2VyRnVuY3Rpb24pLFxuICAgICAge1xuICAgICAgICBwcmVmaXg6ICd1cGxvYWRzLycsXG4gICAgICAgIHN1ZmZpeDogJy5jc3YnXG4gICAgICB9XG4gICAgKTtcblxuICAgIC8vIENvZ25pdG8gQXV0aG9yaXplciBwYXJhIEFQSSBHYXRld2F5XG4gICAgY29uc3QgY29nbml0b0F1dGhvcml6ZXIgPSBuZXcgYXBpZ2F0ZXdheS5Db2duaXRvVXNlclBvb2xzQXV0aG9yaXplcih0aGlzLCAnQ29nbml0b0F1dGhvcml6ZXInLCB7XG4gICAgICBjb2duaXRvVXNlclBvb2xzOiBbcHJvcHMudXNlclBvb2xdLFxuICAgICAgYXV0aG9yaXplck5hbWU6ICdIaVNtYXJ0QXV0aG9yaXplcicsXG4gICAgICBpZGVudGl0eVNvdXJjZTogJ21ldGhvZC5yZXF1ZXN0LmhlYWRlci5BdXRob3JpemF0aW9uJ1xuICAgIH0pO1xuXG4gICAgLy8gQVBJIEdhdGV3YXkgUkVTVCBBUElcbiAgICB0aGlzLmFwaSA9IG5ldyBhcGlnYXRld2F5LlJlc3RBcGkodGhpcywgJ0hpU21hcnRBcGknLCB7XG4gICAgICByZXN0QXBpTmFtZTogJ0hJU21hcnQtQVBJJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQVBJIHBhcmEgSElTbWFydCAtIFNpc3RlbWEgZGUgYsO6c3F1ZWRhIGNsw61uaWNhIGludGVsaWdlbnRlJyxcbiAgICAgIGRlZmF1bHRDb3JzUHJlZmxpZ2h0T3B0aW9uczoge1xuICAgICAgICBhbGxvd09yaWdpbnM6IFsnaHR0cDovL2xvY2FsaG9zdDozMDAwJywgJ2h0dHBzOi8vaGlzbWFydC5leGFtcGxlLmNvbSddLFxuICAgICAgICBhbGxvd01ldGhvZHM6IFsnR0VUJywgJ1BPU1QnLCAnUFVUJywgJ0RFTEVURScsICdPUFRJT05TJ10sXG4gICAgICAgIGFsbG93SGVhZGVyczogW1xuICAgICAgICAgICdDb250ZW50LVR5cGUnLFxuICAgICAgICAgICdYLUFtei1EYXRlJyxcbiAgICAgICAgICAnQXV0aG9yaXphdGlvbicsXG4gICAgICAgICAgJ1gtQXBpLUtleScsXG4gICAgICAgICAgJ1gtQW16LVNlY3VyaXR5LVRva2VuJ1xuICAgICAgICBdXG4gICAgICB9LFxuICAgICAgYmluYXJ5TWVkaWFUeXBlczogWydtdWx0aXBhcnQvZm9ybS1kYXRhJ10sXG4gICAgICBlbmRwb2ludENvbmZpZ3VyYXRpb246IHtcbiAgICAgICAgdHlwZXM6IFthcGlnYXRld2F5LkVuZHBvaW50VHlwZS5SRUdJT05BTF1cbiAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIEludGVncmFjacOzbiBMYW1iZGEgcGFyYSBDUlVEIG9wZXJhdGlvbnNcbiAgICBjb25zdCBjcnVkSW50ZWdyYXRpb24gPSBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbih0aGlzLmNydWRBcGlGdW5jdGlvbiwge1xuICAgICAgcHJveHk6IHRydWVcbiAgICB9KTtcblxuICAgIC8vIEludGVncmFjacOzbiBMYW1iZGEgcGFyYSBhbsOhbGlzaXMgSUFcbiAgICBjb25zdCBhaUludGVncmF0aW9uID0gbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24odGhpcy5haUFuYWx5c2lzRnVuY3Rpb24sIHtcbiAgICAgIHByb3h5OiB0cnVlXG4gICAgfSk7XG5cbiAgICAvLyBSZWN1cnNvcyB5IG3DqXRvZG9zIGRlIGxhIEFQSVxuXG4gICAgLy8gL25vdGVzIC0gT3BlcmFjaW9uZXMgQ1JVRCBjb24gbm90YXMgY2zDrW5pY2FzXG4gICAgY29uc3Qgbm90ZXNSZXNvdXJjZSA9IHRoaXMuYXBpLnJvb3QuYWRkUmVzb3VyY2UoJ25vdGVzJyk7XG4gICAgXG4gICAgLy8gR0VUIC9ub3RlcyAtIExpc3RhciBub3RhcyAoY29uIGZpbHRyb3MpXG4gICAgbm90ZXNSZXNvdXJjZS5hZGRNZXRob2QoJ0dFVCcsIGNydWRJbnRlZ3JhdGlvbiwge1xuICAgICAgYXV0aG9yaXplcjogY29nbml0b0F1dGhvcml6ZXIsXG4gICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ2F0ZXdheS5BdXRob3JpemF0aW9uVHlwZS5DT0dOSVRPXG4gICAgfSk7XG5cbiAgICAvLyBQT1NUIC9ub3RlcyAtIENyZWFyIG51ZXZhIG5vdGFcbiAgICBub3Rlc1Jlc291cmNlLmFkZE1ldGhvZCgnUE9TVCcsIGNydWRJbnRlZ3JhdGlvbiwge1xuICAgICAgYXV0aG9yaXplcjogY29nbml0b0F1dGhvcml6ZXIsXG4gICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ2F0ZXdheS5BdXRob3JpemF0aW9uVHlwZS5DT0dOSVRPXG4gICAgfSk7XG5cbiAgICAvLyBHRVQgL25vdGVzL3tpZH1cbiAgICBjb25zdCBub3RlQnlJZFJlc291cmNlID0gbm90ZXNSZXNvdXJjZS5hZGRSZXNvdXJjZSgne2lkfScpO1xuICAgIG5vdGVCeUlkUmVzb3VyY2UuYWRkTWV0aG9kKCdHRVQnLCBjcnVkSW50ZWdyYXRpb24sIHtcbiAgICAgIGF1dGhvcml6ZXI6IGNvZ25pdG9BdXRob3JpemVyLFxuICAgICAgYXV0aG9yaXphdGlvblR5cGU6IGFwaWdhdGV3YXkuQXV0aG9yaXphdGlvblR5cGUuQ09HTklUT1xuICAgIH0pO1xuXG4gICAgLy8gUFVUIC9ub3Rlcy97aWR9XG4gICAgbm90ZUJ5SWRSZXNvdXJjZS5hZGRNZXRob2QoJ1BVVCcsIGNydWRJbnRlZ3JhdGlvbiwge1xuICAgICAgYXV0aG9yaXplcjogY29nbml0b0F1dGhvcml6ZXIsXG4gICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ2F0ZXdheS5BdXRob3JpemF0aW9uVHlwZS5DT0dOSVRPXG4gICAgfSk7XG5cbiAgICAvLyBERUxFVEUgL25vdGVzL3tpZH1cbiAgICBub3RlQnlJZFJlc291cmNlLmFkZE1ldGhvZCgnREVMRVRFJywgY3J1ZEludGVncmF0aW9uLCB7XG4gICAgICBhdXRob3JpemVyOiBjb2duaXRvQXV0aG9yaXplcixcbiAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBhcGlnYXRld2F5LkF1dGhvcml6YXRpb25UeXBlLkNPR05JVE9cbiAgICB9KTtcblxuICAgIC8vIC9zZWFyY2ggLSBCw7pzcXVlZGFzIGF2YW56YWRhc1xuICAgIGNvbnN0IHNlYXJjaFJlc291cmNlID0gdGhpcy5hcGkucm9vdC5hZGRSZXNvdXJjZSgnc2VhcmNoJyk7XG4gICAgc2VhcmNoUmVzb3VyY2UuYWRkTWV0aG9kKCdQT1NUJywgY3J1ZEludGVncmF0aW9uLCB7XG4gICAgICBhdXRob3JpemVyOiBjb2duaXRvQXV0aG9yaXplcixcbiAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBhcGlnYXRld2F5LkF1dGhvcml6YXRpb25UeXBlLkNPR05JVE9cbiAgICB9KTtcblxuICAgIC8vIC9hbmFseXplIC0gQW7DoWxpc2lzIGNvbiBJQVxuICAgIGNvbnN0IGFuYWx5emVSZXNvdXJjZSA9IHRoaXMuYXBpLnJvb3QuYWRkUmVzb3VyY2UoJ2FuYWx5emUnKTtcbiAgICBcbiAgICAvLyBQT1NUIC9hbmFseXplL25vdGUgLSBBbmFsaXphciB1bmEgbm90YSBlc3BlY8OtZmljYVxuICAgIGNvbnN0IGFuYWx5emVOb3RlUmVzb3VyY2UgPSBhbmFseXplUmVzb3VyY2UuYWRkUmVzb3VyY2UoJ25vdGUnKTtcbiAgICBhbmFseXplTm90ZVJlc291cmNlLmFkZE1ldGhvZCgnUE9TVCcsIGFpSW50ZWdyYXRpb24sIHtcbiAgICAgIGF1dGhvcml6ZXI6IGNvZ25pdG9BdXRob3JpemVyLFxuICAgICAgYXV0aG9yaXphdGlvblR5cGU6IGFwaWdhdGV3YXkuQXV0aG9yaXphdGlvblR5cGUuQ09HTklUT1xuICAgIH0pO1xuXG4gICAgLy8gUE9TVCAvYW5hbHl6ZS9zdW1tYXJ5IC0gR2VuZXJhciByZXN1bWVuXG4gICAgY29uc3QgYW5hbHl6ZVN1bW1hcnlSZXNvdXJjZSA9IGFuYWx5emVSZXNvdXJjZS5hZGRSZXNvdXJjZSgnc3VtbWFyeScpO1xuICAgIGFuYWx5emVTdW1tYXJ5UmVzb3VyY2UuYWRkTWV0aG9kKCdQT1NUJywgYWlJbnRlZ3JhdGlvbiwge1xuICAgICAgYXV0aG9yaXplcjogY29nbml0b0F1dGhvcml6ZXIsXG4gICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ2F0ZXdheS5BdXRob3JpemF0aW9uVHlwZS5DT0dOSVRPXG4gICAgfSk7XG5cbiAgICAvLyBQT1NUIC9hbmFseXplL3Jpc2sgLSBBbsOhbGlzaXMgZGUgcmllc2dvXG4gICAgY29uc3QgYW5hbHl6ZVJpc2tSZXNvdXJjZSA9IGFuYWx5emVSZXNvdXJjZS5hZGRSZXNvdXJjZSgncmlzaycpO1xuICAgIGFuYWx5emVSaXNrUmVzb3VyY2UuYWRkTWV0aG9kKCdQT1NUJywgYWlJbnRlZ3JhdGlvbiwge1xuICAgICAgYXV0aG9yaXplcjogY29nbml0b0F1dGhvcml6ZXIsXG4gICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ2F0ZXdheS5BdXRob3JpemF0aW9uVHlwZS5DT0dOSVRPXG4gICAgfSk7XG5cbiAgICAvLyAvdXBsb2FkIC0gR2VzdGnDs24gZGUgYXJjaGl2b3NcbiAgICBjb25zdCB1cGxvYWRSZXNvdXJjZSA9IHRoaXMuYXBpLnJvb3QuYWRkUmVzb3VyY2UoJ3VwbG9hZCcpO1xuICAgIFxuICAgIC8vIFBPU1QgL3VwbG9hZC9jc3YgLSBHZW5lcmFyIFVSTCBwcmVzaWduYWRhIHBhcmEgc3ViaXIgQ1NWXG4gICAgY29uc3QgdXBsb2FkQ3N2UmVzb3VyY2UgPSB1cGxvYWRSZXNvdXJjZS5hZGRSZXNvdXJjZSgnY3N2Jyk7XG4gICAgdXBsb2FkQ3N2UmVzb3VyY2UuYWRkTWV0aG9kKCdQT1NUJywgY3J1ZEludGVncmF0aW9uLCB7XG4gICAgICBhdXRob3JpemVyOiBjb2duaXRvQXV0aG9yaXplcixcbiAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBhcGlnYXRld2F5LkF1dGhvcml6YXRpb25UeXBlLkNPR05JVE9cbiAgICB9KTtcblxuICAgIC8vIEdFVCAvdXBsb2FkL3N0YXR1cy97am9iSWR9IC0gVmVyaWZpY2FyIGVzdGFkbyBkZSBwcm9jZXNhbWllbnRvXG4gICAgY29uc3QgdXBsb2FkU3RhdHVzUmVzb3VyY2UgPSB1cGxvYWRSZXNvdXJjZS5hZGRSZXNvdXJjZSgnc3RhdHVzJykuYWRkUmVzb3VyY2UoJ3tqb2JJZH0nKTtcbiAgICB1cGxvYWRTdGF0dXNSZXNvdXJjZS5hZGRNZXRob2QoJ0dFVCcsIGNydWRJbnRlZ3JhdGlvbiwge1xuICAgICAgYXV0aG9yaXplcjogY29nbml0b0F1dGhvcml6ZXIsXG4gICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ2F0ZXdheS5BdXRob3JpemF0aW9uVHlwZS5DT0dOSVRPXG4gICAgfSk7XG5cbiAgICAvLyAvc3RhdHMgLSBFc3RhZMOtc3RpY2FzIHkgbcOpdHJpY2FzXG4gICAgY29uc3Qgc3RhdHNSZXNvdXJjZSA9IHRoaXMuYXBpLnJvb3QuYWRkUmVzb3VyY2UoJ3N0YXRzJyk7XG4gICAgXG4gICAgLy8gR0VUIC9zdGF0cy9kYXNoYm9hcmQgLSBNw6l0cmljYXMgcGFyYSBkYXNoYm9hcmRcbiAgICBjb25zdCBzdGF0c0Rhc2hib2FyZFJlc291cmNlID0gc3RhdHNSZXNvdXJjZS5hZGRSZXNvdXJjZSgnZGFzaGJvYXJkJyk7XG4gICAgc3RhdHNEYXNoYm9hcmRSZXNvdXJjZS5hZGRNZXRob2QoJ0dFVCcsIGNydWRJbnRlZ3JhdGlvbiwge1xuICAgICAgYXV0aG9yaXplcjogY29nbml0b0F1dGhvcml6ZXIsXG4gICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ2F0ZXdheS5BdXRob3JpemF0aW9uVHlwZS5DT0dOSVRPXG4gICAgfSk7XG5cbiAgICAvLyBMb2dzIGRlIEFQSSBHYXRld2F5XG4gICAgY29uc3QgYXBpTG9nR3JvdXAgPSBuZXcgbG9ncy5Mb2dHcm91cCh0aGlzLCAnQXBpR2F0ZXdheUxvZ0dyb3VwJywge1xuICAgICAgbG9nR3JvdXBOYW1lOiBgL2F3cy9hcGlnYXRld2F5L0hJU21hcnQtQVBJYCxcbiAgICAgIHJldGVudGlvbjogbG9ncy5SZXRlbnRpb25EYXlzLk9ORV9NT05USFxuICAgIH0pO1xuXG4gICAgLy8gRGVwbG95bWVudCBjb24gbG9nZ2luZyBoYWJpbGl0YWRvXG4gICAgY29uc3QgZGVwbG95bWVudCA9IG5ldyBhcGlnYXRld2F5LkRlcGxveW1lbnQodGhpcywgJ0FwaURlcGxveW1lbnQnLCB7XG4gICAgICBhcGk6IHRoaXMuYXBpXG4gICAgfSk7XG5cbiAgICBjb25zdCBzdGFnZSA9IG5ldyBhcGlnYXRld2F5LlN0YWdlKHRoaXMsICdBcGlTdGFnZScsIHtcbiAgICAgIGRlcGxveW1lbnQsXG4gICAgICBzdGFnZU5hbWU6ICdwcm9kJyxcbiAgICAgIGFjY2Vzc0xvZ0Rlc3RpbmF0aW9uOiBuZXcgYXBpZ2F0ZXdheS5Mb2dHcm91cExvZ0Rlc3RpbmF0aW9uKGFwaUxvZ0dyb3VwKSxcbiAgICAgIGFjY2Vzc0xvZ0Zvcm1hdDogYXBpZ2F0ZXdheS5BY2Nlc3NMb2dGb3JtYXQuanNvbldpdGhTdGFuZGFyZEZpZWxkcyh7XG4gICAgICAgIGNhbGxlcjogZmFsc2UsXG4gICAgICAgIGh0dHBNZXRob2Q6IHRydWUsXG4gICAgICAgIGlwOiB0cnVlLFxuICAgICAgICBwcm90b2NvbDogdHJ1ZSxcbiAgICAgICAgcmVxdWVzdFRpbWU6IHRydWUsXG4gICAgICAgIHJlc291cmNlUGF0aDogdHJ1ZSxcbiAgICAgICAgcmVzcG9uc2VMZW5ndGg6IHRydWUsXG4gICAgICAgIHN0YXR1czogdHJ1ZSxcbiAgICAgICAgdXNlcjogdHJ1ZVxuICAgICAgfSlcbiAgICB9KTtcblxuICAgIC8vIE91dHB1dHNcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQXBpR2F0ZXdheVVybCcsIHtcbiAgICAgIHZhbHVlOiB0aGlzLmFwaS51cmwsXG4gICAgICBkZXNjcmlwdGlvbjogJ1VSTCBiYXNlIGRlIGxhIEFQSSBHYXRld2F5JyxcbiAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1BcGlVcmxgXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQ3N2UGFyc2VyRnVuY3Rpb25Bcm4nLCB7XG4gICAgICB2YWx1ZTogdGhpcy5leGNlbFBhcnNlckZ1bmN0aW9uLmZ1bmN0aW9uQXJuLFxuICAgICAgZGVzY3JpcHRpb246ICdBUk4gZGUgbGEgTGFtYmRhIHBhcmEgcHJvY2VzYXIgQ1NWJyxcbiAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1Dc3ZQYXJzZXJBcm5gXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQ3J1ZEFwaUZ1bmN0aW9uQXJuJywge1xuICAgICAgdmFsdWU6IHRoaXMuY3J1ZEFwaUZ1bmN0aW9uLmZ1bmN0aW9uQXJuLFxuICAgICAgZGVzY3JpcHRpb246ICdBUk4gZGUgbGEgTGFtYmRhIHBhcmEgb3BlcmFjaW9uZXMgQ1JVRCcsXG4gICAgICBleHBvcnROYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tQ3J1ZEFwaUFybmBcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdBaUFuYWx5c2lzRnVuY3Rpb25Bcm4nLCB7XG4gICAgICB2YWx1ZTogdGhpcy5haUFuYWx5c2lzRnVuY3Rpb24uZnVuY3Rpb25Bcm4sXG4gICAgICBkZXNjcmlwdGlvbjogJ0FSTiBkZSBsYSBMYW1iZGEgcGFyYSBhbsOhbGlzaXMgSUEnLFxuICAgICAgZXhwb3J0TmFtZTogYCR7dGhpcy5zdGFja05hbWV9LUFpQW5hbHlzaXNBcm5gXG4gICAgfSk7XG4gIH1cbn0iXX0=