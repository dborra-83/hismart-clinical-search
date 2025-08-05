#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { HiSmartInfrastructureStack } from '../lib/hismart-infrastructure-stack';
import { HiSmartCognitoStack } from '../lib/hismart-cognito-stack';
import { HiSmartBackendStack } from '../lib/hismart-backend-stack';
import { HiSmartFrontendStack } from '../lib/hismart-frontend-stack';

const app = new cdk.App();

// Variables de configuración desde contexto CDK o variables de entorno
const config = {
  account: process.env.CDK_DEFAULT_ACCOUNT || app.node.tryGetContext('account'),
  region: process.env.CDK_DEFAULT_REGION || app.node.tryGetContext('region') || 'us-east-1',
  environment: app.node.tryGetContext('environment') || 'dev',
  projectName: 'HISmart'
};

const stackProps: cdk.StackProps = {
  env: {
    account: config.account,
    region: config.region
  },
  tags: {
    Project: config.projectName,
    Environment: config.environment,
    ManagedBy: 'CDK'
  }
};

// Stack principal con recursos base (S3, DynamoDB, VPC si necesario)
const infraStack = new HiSmartInfrastructureStack(app, `${config.projectName}-Infrastructure-${config.environment}`, {
  ...stackProps,
  description: 'Recursos base para HISmart: S3, DynamoDB, EventBridge'
});

// Stack de autenticación con Cognito
const cognitoStack = new HiSmartCognitoStack(app, `${config.projectName}-Cognito-${config.environment}`, {
  ...stackProps,
  description: 'Autenticación y autorización con Amazon Cognito'
});

// Stack backend con Lambdas y API Gateway
const backendStack = new HiSmartBackendStack(app, `${config.projectName}-Backend-${config.environment}`, {
  ...stackProps,
  description: 'Backend serverless: Lambdas, API Gateway, Bedrock',
  bucket: infraStack.clinicalDataBucket,
  table: infraStack.clinicalNotesTable,
  userPool: cognitoStack.userPool,
  userPoolClient: cognitoStack.userPoolClient
});

// Stack frontend con CloudFront y S3 (comentado para despliegue inicial)
// const frontendStack = new HiSmartFrontendStack(app, `${config.projectName}-Frontend-${config.environment}`, {
//   ...stackProps,
//   description: 'Frontend React con CloudFront y S3',
//   api: backendStack.api,
//   userPool: cognitoStack.userPool,
//   userPoolClient: cognitoStack.userPoolClient
// });

// Dependencias entre stacks
backendStack.addDependency(infraStack);
backendStack.addDependency(cognitoStack);
// frontendStack.addDependency(backendStack);