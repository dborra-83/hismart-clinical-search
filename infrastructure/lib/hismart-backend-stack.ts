import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

interface HiSmartBackendStackProps extends cdk.StackProps {
  bucket: s3.Bucket;
  table: dynamodb.Table;
  userPool: cognito.UserPool;
  userPoolClient: cognito.UserPoolClient;
}

export class HiSmartBackendStack extends cdk.Stack {
  public readonly api: apigateway.RestApi;
  public readonly excelParserFunction: lambda.Function;
  public readonly crudApiFunction: lambda.Function;
  public readonly aiAnalysisFunction: lambda.Function;

  constructor(scope: Construct, id: string, props: HiSmartBackendStackProps) {
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
    props.bucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(this.excelParserFunction),
      {
        prefix: 'uploads/',
        suffix: '.csv'
      }
    );

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