#!/bin/bash

# Script de despliegue para ambiente de desarrollo de HISmart
# Autor: HISmart Team
# Fecha: 2024

set -e  # Salir en caso de error

echo "🚀 Iniciando despliegue de HISmart en ambiente DEV..."

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuración de ambiente
AWS_REGION="${AWS_REGION:-us-east-1}"
ENVIRONMENT="dev"
PROJECT_NAME="HISmart"

# Verificar prerrequisitos
echo -e "${BLUE}🔍 Verificando prerrequisitos...${NC}"

if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ AWS CLI no está instalado${NC}"
    exit 1
fi

if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js no está instalado${NC}"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm no está instalado${NC}"
    exit 1
fi

# Verificar credenciales AWS
if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}❌ No se encontraron credenciales válidas de AWS${NC}"
    echo "Configura tus credenciales con: aws configure"
    exit 1
fi

echo -e "${GREEN}✅ Prerrequisitos verificados${NC}"

# Función para manejar errores
handle_error() {
    echo -e "${RED}❌ Error en línea $1${NC}"
    echo -e "${YELLOW}🔄 Ejecutando rollback si es necesario...${NC}"
    exit 1
}

trap 'handle_error $LINENO' ERR

# 1. Instalar dependencias de infraestructura
echo -e "${BLUE}📦 Instalando dependencias de infraestructura...${NC}"
cd infrastructure
npm install
echo -e "${GREEN}✅ Dependencias de infraestructura instaladas${NC}"

# 2. Bootstrap CDK si es necesario
echo -e "${BLUE}🏗️  Verificando bootstrap de CDK...${NC}"
if ! aws cloudformation describe-stacks --stack-name CDKToolkit --region $AWS_REGION &> /dev/null; then
    echo -e "${YELLOW}⚡ Ejecutando bootstrap de CDK...${NC}"
    npx cdk bootstrap aws://$(aws sts get-caller-identity --query Account --output text)/$AWS_REGION
    echo -e "${GREEN}✅ CDK bootstrap completado${NC}"
else
    echo -e "${GREEN}✅ CDK ya está configurado${NC}"
fi

# 3. Sintetizar y desplegar infraestructura
echo -e "${BLUE}🏗️  Sintetizando infraestructura...${NC}"
npx cdk synth

echo -e "${BLUE}🚀 Desplegando infraestructura...${NC}"
npx cdk deploy --all --require-approval never --context environment=$ENVIRONMENT

# Capturar outputs importantes
echo -e "${BLUE}📋 Capturando información de despliegue...${NC}"
API_URL=$(aws cloudformation describe-stacks \
    --stack-name ${PROJECT_NAME}-Backend-${ENVIRONMENT} \
    --region $AWS_REGION \
    --query 'Stacks[0].Outputs[?OutputKey==`ApiGatewayUrl`].OutputValue' \
    --output text 2>/dev/null || echo "")

USER_POOL_ID=$(aws cloudformation describe-stacks \
    --stack-name ${PROJECT_NAME}-Cognito-${ENVIRONMENT} \
    --region $AWS_REGION \
    --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' \
    --output text 2>/dev/null || echo "")

USER_POOL_CLIENT_ID=$(aws cloudformation describe-stacks \
    --stack-name ${PROJECT_NAME}-Cognito-${ENVIRONMENT} \
    --region $AWS_REGION \
    --query 'Stacks[0].Outputs[?OutputKey==`UserPoolClientId`].OutputValue' \
    --output text 2>/dev/null || echo "")

S3_BUCKET=$(aws cloudformation describe-stacks \
    --stack-name ${PROJECT_NAME}-Infrastructure-${ENVIRONMENT} \
    --region $AWS_REGION \
    --query 'Stacks[0].Outputs[?OutputKey==`ClinicalDataBucketName`].OutputValue' \
    --output text 2>/dev/null || echo "")

WEBSITE_BUCKET=$(aws cloudformation describe-stacks \
    --stack-name ${PROJECT_NAME}-Frontend-${ENVIRONMENT} \
    --region $AWS_REGION \
    --query 'Stacks[0].Outputs[?OutputKey==`WebsiteBucketName`].OutputValue' \
    --output text 2>/dev/null || echo "")

WEBSITE_URL=$(aws cloudformation describe-stacks \
    --stack-name ${PROJECT_NAME}-Frontend-${ENVIRONMENT} \
    --region $AWS_REGION \
    --query 'Stacks[0].Outputs[?OutputKey==`WebsiteUrl`].OutputValue' \
    --output text 2>/dev/null || echo "")

echo -e "${GREEN}✅ Infraestructura desplegada exitosamente${NC}"

# 4. Instalar dependencias del backend
echo -e "${BLUE}📦 Instalando dependencias del backend...${NC}"
cd ../backend

# Instalar dependencias para cada Lambda
for lambda_dir in csv-parser crud-api ai-analysis; do
    if [ -d "$lambda_dir" ]; then
        echo -e "${YELLOW}  📁 Procesando $lambda_dir...${NC}"
        cd $lambda_dir
        npm install
        cd ..
    fi
done

echo -e "${GREEN}✅ Dependencias del backend instaladas${NC}"

# 5. Construir y desplegar frontend
echo -e "${BLUE}🎨 Construyendo frontend...${NC}"
cd ../frontend

# Instalar dependencias
npm install

# Crear archivo de configuración dinámica
cat > public/aws-config.json << EOF
{
  "aws_project_region": "$AWS_REGION",
  "aws_cognito_region": "$AWS_REGION",
  "aws_user_pools_id": "$USER_POOL_ID",
  "aws_user_pools_web_client_id": "$USER_POOL_CLIENT_ID",
  "aws_api_gateway": {
    "url": "$API_URL",
    "region": "$AWS_REGION"
  },
  "aws_s3_bucket": "$S3_BUCKET",
  "app_version": "1.0.0-dev",
  "build_timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
}
EOF

# Construir aplicación
REACT_APP_AWS_REGION=$AWS_REGION \
REACT_APP_USER_POOL_ID=$USER_POOL_ID \
REACT_APP_USER_POOL_CLIENT_ID=$USER_POOL_CLIENT_ID \
REACT_APP_API_URL=$API_URL \
REACT_APP_S3_BUCKET=$S3_BUCKET \
npm run build

echo -e "${GREEN}✅ Frontend construido exitosamente${NC}"

# 6. Desplegar frontend a S3
if [ ! -z "$WEBSITE_BUCKET" ]; then
    echo -e "${BLUE}🌐 Desplegando frontend a S3...${NC}"
    aws s3 sync build/ s3://$WEBSITE_BUCKET --delete --region $AWS_REGION
    echo -e "${GREEN}✅ Frontend desplegado a S3${NC}"
    
    # Invalidar cache de CloudFront si existe
    DISTRIBUTION_ID=$(aws cloudformation describe-stacks \
        --stack-name ${PROJECT_NAME}-Frontend-${ENVIRONMENT} \
        --region $AWS_REGION \
        --query 'Stacks[0].Outputs[?OutputKey==`DistributionId`].OutputValue' \
        --output text 2>/dev/null || echo "")
    
    if [ ! -z "$DISTRIBUTION_ID" ]; then
        echo -e "${BLUE}🔄 Invalidando cache de CloudFront...${NC}"
        aws cloudfront create-invalidation \
            --distribution-id $DISTRIBUTION_ID \
            --paths "/*" > /dev/null
        echo -e "${GREEN}✅ Cache de CloudFront invalidado${NC}"
    fi
fi

# 7. Crear usuarios de prueba en Cognito
echo -e "${BLUE}👥 Creando usuarios de prueba...${NC}"

if [ ! -z "$USER_POOL_ID" ]; then
    # Usuario admin
    aws cognito-idp admin-create-user \
        --user-pool-id $USER_POOL_ID \
        --username "admin" \
        --user-attributes Name=email,Value=admin@hismart.dev Name=name,Value="Administrador HISmart" Name=custom:rol,Value=admin \
        --temporary-password "TempPass123!" \
        --message-action SUPPRESS \
        --region $AWS_REGION 2>/dev/null || echo "Usuario admin ya existe"
    
    # Agregar admin al grupo
    aws cognito-idp admin-add-user-to-group \
        --user-pool-id $USER_POOL_ID \
        --username "admin" \
        --group-name "Administradores" \
        --region $AWS_REGION 2>/dev/null || echo "Admin ya está en el grupo"
    
    # Usuario médico de prueba
    aws cognito-idp admin-create-user \
        --user-pool-id $USER_POOL_ID \
        --username "medico1" \
        --user-attributes Name=email,Value=medico1@hismart.dev Name=name,Value="Dr. Juan Pérez" Name=custom:especialidad,Value="Cardiología" Name=custom:rol,Value=medico \
        --temporary-password "TempPass123!" \
        --message-action SUPPRESS \
        --region $AWS_REGION 2>/dev/null || echo "Usuario medico1 ya existe"
    
    # Agregar médico al grupo
    aws cognito-idp admin-add-user-to-group \
        --user-pool-id $USER_POOL_ID \
        --username "medico1" \
        --group-name "Medicos" \
        --region $AWS_REGION 2>/dev/null || echo "Medico1 ya está en el grupo"
    
    echo -e "${GREEN}✅ Usuarios de prueba creados${NC}"
fi

# 8. Subir archivo CSV de ejemplo
echo -e "${BLUE}📄 Subiendo archivo CSV de ejemplo...${NC}"

if [ ! -z "$S3_BUCKET" ] && [ -f "../backend/ejemplo_notas_clinicas.csv" ]; then
    aws s3 cp ../backend/ejemplo_notas_clinicas.csv s3://$S3_BUCKET/uploads/examples/ --region $AWS_REGION
    echo -e "${GREEN}✅ Archivo CSV de ejemplo subido${NC}"
fi

# 9. Mostrar información de despliegue
echo -e "\n${GREEN}🎉 ¡Despliegue completado exitosamente!${NC}\n"

echo -e "${BLUE}📊 INFORMACIÓN DEL DESPLIEGUE:${NC}"
echo -e "  🌍 Región: $AWS_REGION"
echo -e "  🏷️  Ambiente: $ENVIRONMENT"
echo -e "  🌐 URL de la aplicación: ${WEBSITE_URL:-'Pendiente'}"
echo -e "  🔌 API Gateway URL: ${API_URL:-'Pendiente'}"
echo -e "  👥 User Pool ID: ${USER_POOL_ID:-'Pendiente'}"
echo -e "  📦 S3 Bucket (datos): ${S3_BUCKET:-'Pendiente'}"
echo -e "  🌐 S3 Bucket (web): ${WEBSITE_BUCKET:-'Pendiente'}"

echo -e "\n${YELLOW}👥 USUARIOS DE PRUEBA:${NC}"
echo -e "  🔑 Admin: admin / TempPass123!"
echo -e "  🩺 Médico: medico1 / TempPass123!"
echo -e "  ⚠️  Nota: Deberás cambiar las contraseñas en el primer login"

echo -e "\n${BLUE}📋 PRÓXIMOS PASOS:${NC}"
echo -e "  1. Accede a la aplicación en: $WEBSITE_URL"
echo -e "  2. Inicia sesión con las credenciales de prueba"
echo -e "  3. Cambia las contraseñas temporales"
echo -e "  4. Sube el archivo CSV de ejemplo desde la sección 'Subir Archivos'"
echo -e "  5. Explora las funcionalidades de búsqueda y análisis IA"

echo -e "\n${GREEN}✨ ¡HISmart está listo para usar en ambiente de desarrollo!${NC}"

# Guardar información en archivo de configuración
cat > ../dev-config.json << EOF
{
  "environment": "$ENVIRONMENT",
  "region": "$AWS_REGION",
  "websiteUrl": "$WEBSITE_URL",
  "apiUrl": "$API_URL",
  "userPoolId": "$USER_POOL_ID",
  "userPoolClientId": "$USER_POOL_CLIENT_ID",
  "s3Bucket": "$S3_BUCKET",
  "websiteBucket": "$WEBSITE_BUCKET",
  "deployedAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "testUsers": {
    "admin": {
      "username": "admin",
      "temporaryPassword": "TempPass123!",
      "role": "Administrador"
    },
    "medico1": {
      "username": "medico1", 
      "temporaryPassword": "TempPass123!",
      "role": "Médico - Cardiología"
    }
  }
}
EOF

echo -e "${BLUE}💾 Configuración guardada en dev-config.json${NC}"