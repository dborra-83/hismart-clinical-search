import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export class HiSmartCognitoStack extends cdk.Stack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;
  public readonly identityPool: cognito.CfnIdentityPool;
  public readonly authenticatedRole: iam.Role;
  public readonly unauthenticatedRole: iam.Role;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // User Pool de Cognito para autenticación
    this.userPool = new cognito.UserPool(this, 'HiSmartUserPool', {
      userPoolName: 'HISmart-UserPool',
      selfSignUpEnabled: false, // Solo administradores pueden crear usuarios
      signInAliases: {
        email: true,
        username: true
      },
      passwordPolicy: {
        minLength: 12,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
        tempPasswordValidity: cdk.Duration.days(3)
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      mfa: cognito.Mfa.REQUIRED,
      mfaSecondFactor: {
        sms: false,
        otp: true // TOTP apps como Google Authenticator
      },
      standardAttributes: {
        email: {
          required: true,
          mutable: true
        },
        givenName: {
          required: true,
          mutable: true
        },
        familyName: {
          required: true,
          mutable: true  
        }
      },
      customAttributes: {
        'especialidad': new cognito.StringAttribute({
          minLen: 3,
          maxLen: 50,
          mutable: true
        }),
        'numero_colegiado': new cognito.StringAttribute({
          minLen: 5,
          maxLen: 20,
          mutable: true
        }),
        'hospital': new cognito.StringAttribute({
          minLen: 3,
          maxLen: 100,
          mutable: true
        }),
        'rol': new cognito.StringAttribute({
          minLen: 3,
          maxLen: 30,
          mutable: true
        })
      },
      userInvitation: {
        emailSubject: 'Bienvenido a HISmart - Credenciales de acceso',
        emailBody: `
          <h2>Bienvenido a HISmart</h2>
          <p>Se ha creado una cuenta para usted en la plataforma de búsqueda clínica inteligente.</p>
          <p><strong>Usuario:</strong> {username}</p>
          <p><strong>Contraseña temporal:</strong> {####}</p>
          <p>Por favor, acceda al sistema y cambie su contraseña temporal.</p>
          <p><a href="https://hismart.example.com">Acceder a HISmart</a></p>
        `
      },
      userVerification: {
        emailSubject: 'Verificación de correo - HISmart',
        emailBody: 'Por favor verifique su cuenta haciendo clic aquí: {##Verify Email##}',
        emailStyle: cognito.VerificationEmailStyle.LINK
      },
      removalPolicy: cdk.RemovalPolicy.RETAIN // Nunca eliminar usuarios médicos
    });

    // Grupos de usuarios para diferentes roles
    const adminGroup = new cognito.CfnUserPoolGroup(this, 'AdminGroup', {
      userPoolId: this.userPool.userPoolId,
      groupName: 'Administradores',
      description: 'Administradores del sistema con acceso completo',
      precedence: 1
    });

    const medicosGroup = new cognito.CfnUserPoolGroup(this, 'MedicosGroup', {
      userPoolId: this.userPool.userPoolId,
      groupName: 'Medicos',
      description: 'Personal médico con acceso a búsquedas y análisis',
      precedence: 2
    });

    const enfermeriaGroup = new cognito.CfnUserPoolGroup(this, 'EnfermeriaGroup', {
      userPoolId: this.userPool.userPoolId,
      groupName: 'Enfermeria',
      description: 'Personal de enfermería con acceso limitado',
      precedence: 3
    });

    // User Pool Client para la aplicación web
    this.userPoolClient = new cognito.UserPoolClient(this, 'HiSmartWebClient', {
      userPool: this.userPool,
      userPoolClientName: 'HISmart-WebApp',
      generateSecret: false, // Para SPAs no usar secret
      authFlows: {
        userSrp: true,
        adminUserPassword: true,
        custom: false,
        userPassword: false
      },
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
          implicitCodeGrant: false
        },
        scopes: [
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.PROFILE
        ],
        callbackUrls: [
          'https://localhost:3000/callback', // Para desarrollo
          'https://hismart.example.com/callback' // Para producción
        ],
        logoutUrls: [
          'https://localhost:3000',
          'https://hismart.example.com'
        ]
      },
      supportedIdentityProviders: [
        cognito.UserPoolClientIdentityProvider.COGNITO
      ],
      readAttributes: new cognito.ClientAttributes()
        .withStandardAttributes({
          email: true,
          givenName: true,
          familyName: true
        })
        .withCustomAttributes('especialidad', 'numero_colegiado', 'hospital', 'rol'),
      writeAttributes: new cognito.ClientAttributes()
        .withStandardAttributes({
          email: true,
          givenName: true,
          familyName: true
        })
        .withCustomAttributes('especialidad', 'numero_colegiado', 'hospital', 'rol'),
      accessTokenValidity: cdk.Duration.hours(1),
      idTokenValidity: cdk.Duration.hours(1),
      refreshTokenValidity: cdk.Duration.days(30),
      preventUserExistenceErrors: true
    });

    // Identity Pool para acceso a recursos AWS
    this.identityPool = new cognito.CfnIdentityPool(this, 'HiSmartIdentityPool', {
      identityPoolName: 'HISmart-IdentityPool',
      allowUnauthenticatedIdentities: false,
      cognitoIdentityProviders: [
        {
          clientId: this.userPoolClient.userPoolClientId,
          providerName: this.userPool.userPoolProviderName,
          serverSideTokenCheck: true
        }
      ]
    });

    // Rol para usuarios autenticados
    this.authenticatedRole = new iam.Role(this, 'AuthenticatedRole', {
      roleName: 'HISmart-AuthenticatedRole',
      assumedBy: new iam.FederatedPrincipal(
        'cognito-identity.amazonaws.com',
        {
          StringEquals: {
            'cognito-identity.amazonaws.com:aud': this.identityPool.ref
          },
          'ForAnyValue:StringLike': {
            'cognito-identity.amazonaws.com:amr': 'authenticated'
          }
        },
        'sts:AssumeRoleWithWebIdentity'
      ),
      inlinePolicies: {
        'HiSmartUserPolicy': new iam.PolicyDocument({
          statements: [
            // Acceso limitado a S3 para subir archivos
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                's3:PutObject',
                's3:PutObjectAcl'
              ],
              resources: [`arn:aws:s3:::hismart-clinical-data-${this.account}-${this.region}/uploads/*`],
              conditions: {
                StringEquals: {
                  's3:x-amz-server-side-encryption': 'AES256'
                }
              }
            }),
            // Acceso para invocar APIs de Lambda a través de API Gateway
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'execute-api:Invoke'
              ],
              resources: [
                `arn:aws:execute-api:${this.region}:${this.account}:*/*/GET/*`,
                `arn:aws:execute-api:${this.region}:${this.account}:*/*/POST/*`
              ]
            })
          ]
        })
      }
    });

    // Rol para usuarios no autenticados (mínimos permisos)
    this.unauthenticatedRole = new iam.Role(this, 'UnauthenticatedRole', {
      roleName: 'HISmart-UnauthenticatedRole',
      assumedBy: new iam.FederatedPrincipal(
        'cognito-identity.amazonaws.com',
        {
          StringEquals: {
            'cognito-identity.amazonaws.com:aud': this.identityPool.ref
          },
          'ForAnyValue:StringLike': {
            'cognito-identity.amazonaws.com:amr': 'unauthenticated'
          }
        },
        'sts:AssumeRoleWithWebIdentity'
      ),
      inlinePolicies: {
        'DenyAllPolicy': new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.DENY,
              actions: ['*'],
              resources: ['*']
            })
          ]
        })
      }
    });

    // Attachment de roles al Identity Pool
    new cognito.CfnIdentityPoolRoleAttachment(this, 'IdentityPoolRoleAttachment', {
      identityPoolId: this.identityPool.ref,
      roles: {
        authenticated: this.authenticatedRole.roleArn,
        unauthenticated: this.unauthenticatedRole.roleArn
      },
      roleMappings: {
        'cognito-idp': {
          type: 'Token',
          ambiguousRoleResolution: 'AuthenticatedRole',
          identityProvider: `cognito-idp.${this.region}.amazonaws.com/${this.userPool.userPoolId}:${this.userPoolClient.userPoolClientId}`
        }
      }
    });

    // Outputs
    new cdk.CfnOutput(this, 'UserPoolId', {
      value: this.userPool.userPoolId,
      description: 'ID del User Pool de Cognito',
      exportName: `${this.stackName}-UserPoolId`
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: this.userPoolClient.userPoolClientId,
      description: 'ID del cliente del User Pool',
      exportName: `${this.stackName}-UserPoolClientId`
    });

    new cdk.CfnOutput(this, 'IdentityPoolId', {
      value: this.identityPool.ref,
      description: 'ID del Identity Pool',
      exportName: `${this.stackName}-IdentityPoolId`
    });

    new cdk.CfnOutput(this, 'AuthenticatedRoleArn', {
      value: this.authenticatedRole.roleArn,
      description: 'ARN del rol para usuarios autenticados',
      exportName: `${this.stackName}-AuthenticatedRoleArn`
    });
  }
}