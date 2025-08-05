import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';
import * as path from 'path';

export class HiSmartSimpleStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // 1. S3 Bucket para datos clínicos
    const clinicalDataBucket = new s3.Bucket(this, 'ClinicalDataBucket', {
      bucketName: `hismart-clinical-data-${this.account}-${this.region}`,
      versioned: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      cors: [
        {
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.PUT, s3.HttpMethods.POST],
          allowedOrigins: ['*'],
          allowedHeaders: ['*'],
          maxAge: 3000
        }
      ]
    });

    // 2. DynamoDB Table para notas clínicas
    const clinicalNotesTable = new dynamodb.Table(this, 'ClinicalNotesTable', {
      tableName: 'clinical-notes-dev',
      partitionKey: {
        name: 'id',
        type: dynamodb.AttributeType.STRING
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN
    });

    // Índices secundarios
    clinicalNotesTable.addGlobalSecondaryIndex({
      indexName: 'paciente-index',
      partitionKey: {
        name: 'paciente_id',
        type: dynamodb.AttributeType.STRING
      }
    });

    // 3. Cognito User Pool
    const userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: 'HISmart-Users-dev',
      selfSignUpEnabled: false,
      signInAliases: {
        email: true,
        username: true
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true
      },
      mfa: cognito.Mfa.REQUIRED,
      mfaSecondFactor: {
        sms: true,
        otp: true
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.RETAIN
    });

    // User Pool Client
    const userPoolClient = new cognito.UserPoolClient(this, 'UserPoolClient', {
      userPool,
      userPoolClientName: 'HISmart-WebApp-dev',
      generateSecret: false,
      authFlows: {
        userPassword: true,
        userSrp: true
      },
      preventUserExistenceErrors: true
    });

    // Grupos de usuarios
    new cognito.CfnUserPoolGroup(this, 'AdminGroup', {
      userPoolId: userPool.userPoolId,
      groupName: 'Administradores',
      description: 'Administradores del sistema'
    });

    new cognito.CfnUserPoolGroup(this, 'MedicosGroup', {
      userPoolId: userPool.userPoolId,
      groupName: 'Medicos',
      description: 'Personal médico'
    });

    // 4. IAM Role para Lambdas con permisos necesarios
    const lambdaRole = new iam.Role(this, 'LambdaExecutionRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')
      ],
      inlinePolicies: {
        DynamoDBAccess: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'dynamodb:GetItem',
                'dynamodb:PutItem',
                'dynamodb:UpdateItem',
                'dynamodb:DeleteItem',
                'dynamodb:Query',
                'dynamodb:Scan'
              ],
              resources: [
                clinicalNotesTable.tableArn,
                `${clinicalNotesTable.tableArn}/index/*`
              ]
            })
          ]
        }),
        S3Access: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                's3:GetObject',
                's3:PutObject',
                's3:DeleteObject',
                's3:GeneratePresignedUrl'
              ],
              resources: [`${clinicalDataBucket.bucketArn}/*`]
            })
          ]
        }),
        BedrockAccess: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'bedrock:InvokeModel'
              ],
              resources: [
                `arn:aws:bedrock:${this.region}::foundation-model/anthropic.claude-3-sonnet-20240229-v1:0`
              ]
            })
          ]
        })
      }
    });

    // 5. Lambda Functions
    const crudApiFunction = new lambda.Function(this, 'CrudApiFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../backend/simple-crud')),
      environment: {
        TABLE_NAME: clinicalNotesTable.tableName,
        BUCKET_NAME: clinicalDataBucket.bucketName,
        USER_POOL_ID: userPool.userPoolId
      },
      role: lambdaRole,
      timeout: cdk.Duration.seconds(30),
      memorySize: 512
    });

    const csvParserFunction = new lambda.Function(this, 'CsvParserFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../backend/csv-parser')),
      environment: {
        TABLE_NAME: clinicalNotesTable.tableName,
        BUCKET_NAME: clinicalDataBucket.bucketName
      },
      role: lambdaRole,
      timeout: cdk.Duration.minutes(5),
      memorySize: 1024
    });

    const aiAnalysisFunction = new lambda.Function(this, 'AiAnalysisFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../backend/ai-analysis')),
      environment: {
        BEDROCK_REGION: this.region,
        MODEL_ID: 'anthropic.claude-3-sonnet-20240229-v1:0'
      },
      role: lambdaRole,
      timeout: cdk.Duration.minutes(10),
      memorySize: 1024
    });

    // 6. API Gateway (sin CORS)
    const api = new apigateway.RestApi(this, 'HiSmartApi', {
      restApiName: 'HISmart API',
      description: 'API para HISmart - Sistema de notas clínicas'
    });

    // Cognito Authorizer
    const cognitoAuthorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'CognitoAuthorizer', {
      cognitoUserPools: [userPool],
      authorizerName: 'HiSmartCognitoAuth'
    });

    // API Resources y Methods
    const notesResource = api.root.addResource('notes');
    notesResource.addMethod('GET', new apigateway.LambdaIntegration(crudApiFunction), {
      authorizationType: apigateway.AuthorizationType.NONE
    });
    notesResource.addMethod('POST', new apigateway.LambdaIntegration(crudApiFunction), {
      authorizationType: apigateway.AuthorizationType.NONE
    });
    notesResource.addMethod('OPTIONS', new apigateway.LambdaIntegration(crudApiFunction), {
      authorizationType: apigateway.AuthorizationType.NONE
    });

    const noteByIdResource = notesResource.addResource('{id}');
    noteByIdResource.addMethod('GET', new apigateway.LambdaIntegration(crudApiFunction), {
      authorizationType: apigateway.AuthorizationType.NONE
    });

    const searchResource = api.root.addResource('search');
    searchResource.addMethod('POST', new apigateway.LambdaIntegration(crudApiFunction), {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO
    });

    const analyzeResource = api.root.addResource('analyze');
    const analyzeNoteResource = analyzeResource.addResource('note');
    analyzeNoteResource.addMethod('POST', new apigateway.LambdaIntegration(aiAnalysisFunction), {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO
    });

    const uploadResource = api.root.addResource('upload');
    const csvUploadResource = uploadResource.addResource('csv');
    csvUploadResource.addMethod('POST', new apigateway.LambdaIntegration(crudApiFunction), {
      authorizationType: apigateway.AuthorizationType.NONE
    });
    csvUploadResource.addMethod('OPTIONS', new apigateway.LambdaIntegration(crudApiFunction), {
      authorizationType: apigateway.AuthorizationType.NONE
    });

    // Create separate test lambda
    const testLambda = new lambda.Function(this, 'TestLambda', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../backend/test-lambda')),
      timeout: cdk.Duration.seconds(10),
      memorySize: 128
    });

    // Add a test endpoint without authentication for debugging
    const testResource = api.root.addResource('test');
    testResource.addMethod('GET', new apigateway.LambdaIntegration(testLambda), {
      authorizationType: apigateway.AuthorizationType.NONE
    });

    // 7. Outputs
    new cdk.CfnOutput(this, 'UserPoolId', {
      value: userPool.userPoolId,
      description: 'User Pool ID'
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: userPoolClient.userPoolClientId,
      description: 'User Pool Client ID'
    });

    new cdk.CfnOutput(this, 'ApiGatewayUrl', {
      value: api.url,
      description: 'API Gateway URL'
    });

    new cdk.CfnOutput(this, 'ClinicalDataBucketName', {
      value: clinicalDataBucket.bucketName,
      description: 'S3 Bucket para datos clínicos'
    });

    new cdk.CfnOutput(this, 'Region', {
      value: this.region,
      description: 'AWS Region'
    });
  }
}