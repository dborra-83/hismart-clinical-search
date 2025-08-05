import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as events from 'aws-cdk-lib/aws-events';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export class HiSmartInfrastructureStack extends cdk.Stack {
  public readonly clinicalDataBucket: s3.Bucket;
  public readonly clinicalNotesTable: dynamodb.Table;
  public readonly eventBus: events.EventBus;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // S3 Bucket para almacenar archivos Excel y otros documentos clínicos
    this.clinicalDataBucket = new s3.Bucket(this, 'ClinicalDataBucket', {
      bucketName: `hismart-clinical-data-${this.account}-${this.region}`,
      versioned: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      lifecycleRules: [
        {
          id: 'ArchiveOldFiles',
          expiration: cdk.Duration.days(2555), // 7 años para cumplir regulaciones médicas
          transitions: [
            {
              storageClass: s3.StorageClass.INFREQUENT_ACCESS,
              transitionAfter: cdk.Duration.days(30)
            },
            {
              storageClass: s3.StorageClass.GLACIER,
              transitionAfter: cdk.Duration.days(90)
            }
          ]
        }
      ],
      cors: [
        {
          allowedMethods: [
            s3.HttpMethods.GET,
            s3.HttpMethods.POST,
            s3.HttpMethods.PUT
          ],
          allowedOrigins: ['*'], // En producción, especificar dominio exacto
          allowedHeaders: ['*'],
          maxAge: 3000
        }
      ],
      removalPolicy: cdk.RemovalPolicy.RETAIN // Importante: nunca eliminar datos médicos
    });

    // DynamoDB Table para almacenar notas clínicas procesadas
    this.clinicalNotesTable = new dynamodb.Table(this, 'ClinicalNotesTable', {
      tableName: 'HISmart-ClinicalNotes',
      partitionKey: {
        name: 'PK',
        type: dynamodb.AttributeType.STRING
      },
      sortKey: {
        name: 'SK', 
        type: dynamodb.AttributeType.STRING
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST, // Pay-per-use
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecovery: true, // Backup continuo
      removalPolicy: cdk.RemovalPolicy.RETAIN, // Nunca eliminar datos médicos
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES // Para triggers y auditoría
    });

    // Índices secundarios globales para búsquedas optimizadas
    this.clinicalNotesTable.addGlobalSecondaryIndex({
      indexName: 'GSI-PacienteId-Fecha',
      partitionKey: {
        name: 'paciente_id',
        type: dynamodb.AttributeType.STRING
      },
      sortKey: {
        name: 'fecha_nota',
        type: dynamodb.AttributeType.STRING
      }
    });

    this.clinicalNotesTable.addGlobalSecondaryIndex({
      indexName: 'GSI-Medico-Fecha',
      partitionKey: {
        name: 'medico',
        type: dynamodb.AttributeType.STRING
      },
      sortKey: {
        name: 'fecha_nota', 
        type: dynamodb.AttributeType.STRING
      }
    });

    this.clinicalNotesTable.addGlobalSecondaryIndex({
      indexName: 'GSI-Especialidad-Fecha',
      partitionKey: {
        name: 'especialidad',
        type: dynamodb.AttributeType.STRING
      },
      sortKey: {
        name: 'fecha_nota',
        type: dynamodb.AttributeType.STRING
      }
    });

    // EventBridge custom bus para eventos del sistema
    this.eventBus = new events.EventBus(this, 'HiSmartEventBus', {
      eventBusName: 'HISmart-Events'
    });

    // Política IAM para acceso a Bedrock (Claude 4)
    const bedrockPolicy = new iam.ManagedPolicy(this, 'BedrockAccessPolicy', {
      managedPolicyName: 'HISmart-BedrockAccess',
      statements: [
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
        })
      ]
    });

    // Outputs para usar en otros stacks
    new cdk.CfnOutput(this, 'ClinicalDataBucketName', {
      value: this.clinicalDataBucket.bucketName,
      description: 'Nombre del bucket S3 para datos clínicos',
      exportName: `${this.stackName}-ClinicalDataBucket`
    });

    new cdk.CfnOutput(this, 'ClinicalNotesTableName', {
      value: this.clinicalNotesTable.tableName,
      description: 'Nombre de la tabla DynamoDB para notas clínicas',
      exportName: `${this.stackName}-ClinicalNotesTable`
    });

    new cdk.CfnOutput(this, 'EventBusName', {
      value: this.eventBus.eventBusName,
      description: 'Nombre del EventBus personalizado',
      exportName: `${this.stackName}-EventBus`
    });

    new cdk.CfnOutput(this, 'BedrockPolicyArn', {
      value: bedrockPolicy.managedPolicyArn,
      description: 'ARN de la política para acceso a Bedrock',
      exportName: `${this.stackName}-BedrockPolicy`
    });

    // Tags adicionales para recursos críticos
    cdk.Tags.of(this.clinicalDataBucket).add('DataClassification', 'PHI'); // Protected Health Information
    cdk.Tags.of(this.clinicalNotesTable).add('DataClassification', 'PHI');
    cdk.Tags.of(this.clinicalDataBucket).add('Backup', 'Required');
    cdk.Tags.of(this.clinicalNotesTable).add('Backup', 'Required');
  }
}