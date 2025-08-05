# HISmart - Infraestructura AWS CDK

Este directorio contiene la infraestructura como código para HISmart usando AWS CDK (Cloud Development Kit).

## Estructura

- `bin/hismart.ts` - Punto de entrada principal de la aplicación CDK
- `lib/` - Stacks de infraestructura:
  - `hismart-infrastructure-stack.ts` - Recursos base (S3, DynamoDB, EventBridge)
  - `hismart-cognito-stack.ts` - Autenticación y autorización
  - `hismart-backend-stack.ts` - Lambdas, API Gateway, Bedrock
  - `hismart-frontend-stack.ts` - Frontend React con CloudFront

## Prerrequisitos

1. **AWS CLI configurado** con credenciales apropiadas
2. **Node.js 18+** instalado
3. **AWS CDK CLI** instalado globalmente:
   ```bash
   npm install -g aws-cdk
   ```

## Configuración inicial

1. Instalar dependencias:
   ```bash
   npm install
   ```

2. Bootstrap CDK (solo primera vez por región):
   ```bash
   cdk bootstrap
   ```

## Despliegue

### Despliegue completo
```bash
# Desplegar todos los stacks
npm run deploy

# O usando CDK directamente
cdk deploy --all
```

### Despliegue por stacks individuales
```bash
# Solo infraestructura base
cdk deploy HISmart-Infrastructure-dev

# Solo autenticación
cdk deploy HISmart-Cognito-dev

# Solo backend
cdk deploy HISmart-Backend-dev

# Solo frontend
cdk deploy HISmart-Frontend-dev
```

## Configuración por ambiente

Puedes configurar diferentes ambientes usando contexto CDK:

```bash
# Desarrollo
cdk deploy --context environment=dev

# Producción
cdk deploy --context environment=prod

# Específico para una región
cdk deploy --context region=us-west-2
```

## Variables de entorno importantes

- `CDK_DEFAULT_ACCOUNT` - Cuenta AWS (opcional, se detecta automáticamente)
- `CDK_DEFAULT_REGION` - Región AWS (por defecto: us-east-1)

## Recursos creados

### Stack de Infraestructura
- **S3 Bucket**: Almacenamiento de archivos Excel y documentos clínicos
- **DynamoDB Table**: Base de datos principal para notas clínicas
- **EventBridge**: Bus de eventos personalizado
- **IAM Policies**: Políticas para acceso a Bedrock

### Stack de Cognito
- **User Pool**: Autenticación de usuarios médicos
- **User Pool Client**: Cliente para aplicación web
- **Identity Pool**: Acceso federado a recursos AWS
- **IAM Roles**: Roles para usuarios autenticados/no autenticados
- **User Groups**: Grupos para diferentes roles (Admin, Médicos, Enfermería)

### Stack de Backend
- **3 Lambda Functions**:
  - `HISmart-ExcelParser`: Procesa archivos Excel
  - `HISmart-CrudApi`: Operaciones CRUD y búsquedas
  - `HISmart-AiAnalysis`: Análisis con Bedrock Claude
- **API Gateway**: REST API con autenticación Cognito
- **S3 Event Notifications**: Triggers para procesar archivos

### Stack de Frontend
- **S3 Website Bucket**: Hospedaje de aplicación React
- **CloudFront Distribution**: CDN global con configuración SPA
- **Lambda@Edge Function**: Reescritura de URLs para React Router

## Endpoints de API

Una vez desplegado, la API estará disponible en:
- Base URL: `https://{api-id}.execute-api.{region}.amazonaws.com/prod`

### Principales endpoints:
- `GET /notes` - Listar notas clínicas
- `POST /notes` - Crear nueva nota
- `GET /notes/{id}` - Obtener nota específica
- `POST /search` - Búsqueda avanzada
- `POST /analyze/note` - Análisis con IA
- `POST /upload/excel` - Generar URL presignada para upload

## Seguridad

### Principios implementados:
- **Least Privilege**: Permisos mínimos necesarios
- **Encryption at Rest**: S3 y DynamoDB encriptados
- **Encryption in Transit**: HTTPS obligatorio
- **Authentication**: Cognito con MFA obligatorio
- **Authorization**: Grupos y roles específicos
- **Audit Trail**: CloudWatch Logs habilitados

### Configuración de seguridad:
- MFA obligatorio para todos los usuarios
- Contraseñas complejas (12+ caracteres)
- Tokens de acceso con validez de 1 hora
- Refresh tokens válidos por 30 días
- CORS configurado solo para dominios específicos

## Monitoreo

### CloudWatch Logs:
- `/aws/lambda/HISmart-ExcelParser`
- `/aws/lambda/HISmart-CrudApi`
- `/aws/lambda/HISmart-AiAnalysis`
- `/aws/apigateway/HISmart-API`

### Métricas importantes:
- Errores en Lambdas
- Latencia de API Gateway
- Uso de tokens Bedrock
- Carga de archivos S3

## Costos estimados

### Componentes principales (estimación mensual):
- **DynamoDB**: $5-20 (on-demand)
- **Lambda**: $10-50 (según uso)
- **S3**: $5-15 (almacenamiento + requests)
- **CloudFront**: $5-20 (CDN)
- **Cognito**: $0.0055 por MAU (primeros 50K gratuitos)
- **Bedrock**: $0.008 por 1K tokens de entrada, $0.024 por 1K tokens de salida

**Total estimado**: $25-130/mes dependiendo del uso

## Comandos útiles

```bash
# Ver diferencias antes de desplegar
cdk diff

# Sintetizar CloudFormation templates
cdk synth

# Destruir todos los recursos (¡CUIDADO!)
cdk destroy --all

# Ver metadata de los stacks
cdk ls

# Ver outputs de un stack específico
aws cloudformation describe-stacks --stack-name HISmart-Backend-dev --query 'Stacks[0].Outputs'
```

## Troubleshooting

### Error: "CDK bootstrap required"
```bash
cdk bootstrap aws://ACCOUNT-NUMBER/REGION
```

### Error: "Insufficient permissions"
Verificar que el usuario/rol AWS tenga permisos para:
- CloudFormation
- IAM
- S3
- DynamoDB
- Lambda
- API Gateway
- Cognito
- CloudFront

### Error en deployment de frontend
Asegurar que existe el directorio `../frontend/build/` con los archivos de React compilados.

## Personalización

### Cambiar región:
```bash
cdk deploy --context region=eu-west-1
```

### Cambiar configuración de branding:
Editar `../branding/branding.json` antes del deploy.

### Habilitar dominio personalizado:
1. Registrar certificado SSL en ACM
2. Configurar Route 53
3. Modificar `hismart-frontend-stack.ts` para usar dominio personalizado

---

Para más información sobre CDK, consultar: https://docs.aws.amazon.com/cdk/