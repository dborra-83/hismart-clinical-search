#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { HiSmartSimpleStack } from '../lib/hismart-simple-stack';

const app = new cdk.App();

const stackProps: cdk.StackProps = {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1'
  },
  tags: {
    Project: 'HISmart',
    Environment: 'dev',
    ManagedBy: 'CDK'
  }
};

new HiSmartSimpleStack(app, 'HISmart-Dev', {
  ...stackProps,
  description: 'HISmart - Sistema de búsqueda inteligente de notas clínicas (ambiente dev)'
});

app.synth();