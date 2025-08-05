# HISmart - Sistema de Búsqueda Inteligente de Notas Clínicas

**🏥 Aplicación web serverless marca blanca para hospitales**

HISmart permite a profesionales médicos buscar y analizar notas clínicas de manera inteligente utilizando IA. Construido completamente en AWS con arquitectura serverless.

## 🚀 Estado del Proyecto: LISTO PARA DESPLIEGUE

✅ **Infraestructura completa**: 4 stacks CDK desplegables  
✅ **Backend funcional**: 3 Lambdas con 15+ endpoints  
✅ **Frontend completo**: React en español con 6 páginas  
✅ **Análisis IA**: Integración con Amazon Bedrock (Claude 3 Sonnet)  
✅ **Autenticación**: Amazon Cognito + MFA configurado  
✅ **White-label**: Sistema de branding personalizable  
✅ **Documentación**: Completa y actualizada  
✅ **Script de despliegue**: `deploy-dev.sh` probado

## 🏛️ Arquitectura Técnica

- **Frontend:** React 18 + TypeScript + Material-UI (interfaz en español)
- **Backend:** AWS Lambda (Node.js 18) + API Gateway + DynamoDB
- **IA:** Amazon Bedrock (Claude 3 Sonnet) para análisis médico
- **Autenticación:** Amazon Cognito con MFA y grupos por roles
- **Almacenamiento:** S3 para archivos CSV + DynamoDB para notas procesadas
- **Infraestructura:** AWS CDK (TypeScript) - Infrastructure as Code
- **Branding:** Sistema white-label completamente personalizable

## Justificación de elección de base de datos

**DynamoDB vs Aurora Serverless:** Se eligió DynamoDB por las siguientes razones:
- **Performance:** Latencia consistente de milisegundos
- **Costo:** Pay-per-use sin capacidad mínima
- **Escalabilidad:** Escala automáticamente según demanda
- **Serverless nativo:** Integración perfecta con Lambda
- **Simplicidad:** No requiere gestión de esquemas complejos para notas clínicas

## 🚀 Despliegue en 1 Comando

```bash
# ¡Listo para despliegue completo!
./deploy-dev.sh
```

### Proceso automático:
1. ✅ Verifica prerrequisitos (AWS CLI, Node.js)
2. ✅ Bootstrap CDK si es necesario
3. ✅ Despliega 4 stacks de infraestructura
4. ✅ Construye y despliega frontend React
5. ✅ Crea usuarios de prueba en Cognito
6. ✅ Configura ambiente dev completo

### Usuarios de prueba incluidos:
- **admin** / TempPass123! (Administrador)
- **medico1** / TempPass123! (Dr. Juan Pérez - Cardiología)

### Después del despliegue:
1. Accede a la URL proporcionada
2. Inicia sesión con credenciales de prueba
3. Sube el archivo CSV de ejemplo incluido
4. Explora funcionalidades de búsqueda y análisis IA

## Customización marca blanca

Puedes editar logo, colores y textos principales en `/branding/branding.json`:

```json
{
  "nombre": "HISmart",
  "logo": "/branding/logo.png",
  "colores": {
    "primario": "#0D47A1",
    "secundario": "#1976D2",
    "fondo": "#F4F6F8",
    "texto": "#333333",
    "exito": "#4CAF50",
    "error": "#F44336"
  },
  "textos": {
    "login": "Bienvenido a HISmart – Plataforma de búsqueda clínica inteligente",
    "descripcion": "Sistema de gestión hospitalaria con búsqueda inteligente de notas clínicas",
    "footer": "© 2024 HISmart. Todos los derechos reservados."
  }
}
```

## 📊 Funcionalidades Implementadas

### 🔐 Sistema de Autenticación
- Login seguro con Amazon Cognito
- MFA (autenticación multifactor) obligatorio
- 3 roles: Administradores, Médicos, Enfermería
- Gestión de sesiones con JWT tokens

### 📤 Carga y Procesamiento de Datos
- Drag & drop de archivos CSV
- Parser flexible para diferentes formatos hospitalarios
- Progreso de carga en tiempo real
- Validación y detección de duplicados
- Mapeo automático de columnas

### 🔍 Búsqueda Inteligente
- Búsqueda de texto completo en notas clínicas
- Filtros por especialidad, médico, fechas
- Resultados con puntuación de relevancia
- Preview de contenido
- Paginación avanzada

### 🤖 Análisis con IA (Bedrock Claude)
- **Análisis Completo**: Evaluación exhaustiva de notas
- **Resumen Ejecutivo**: Síntesis concisa personalizable
- **Evaluación de Riesgos**: Análisis de factores de riesgo del paciente
- **Extracción de Datos**: Información estructurada en JSON

### 📊 Dashboard Médico
- Métricas en tiempo real
- Gráficos por especialidad
- Top médicos más activos
- Estadísticas de uso del sistema

### 🎨 Branding White-Label
- Colores personalizables por institución
- Logo personalizable
- Textos configurables
- Tema responsive adaptable

## 🏗️ Diagrama de Arquitectura

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   API Gateway   │    │   Lambda        │
│   React + MUI   │◄──►│   REST API      │◄──►│   Functions     │
│   (Español)     │    │   + CORS        │    │   (Node.js 18)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Cognito       │    │   CloudFront    │    │   DynamoDB      │
│   Auth + MFA    │    │   Distribution  │    │   NoSQL DB      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │                       │
                                ▼                       ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │   S3 Buckets    │    │   Bedrock       │
                       │   Static + CSV  │    │   Claude 3      │
                       └─────────────────┘    └─────────────────┘
```

## 🔄 Flujos de Trabajo

### 1. Carga de Datos Clínicos
```
CSV Upload → S3 Bucket → Lambda Parser → Validation → DynamoDB → Notification
```

### 2. Búsqueda y Análisis
```
Search Query → API Gateway → Lambda CRUD → DynamoDB → Results + AI Analysis
```

### 3. Análisis con IA
```
Clinical Note → Lambda AI → Bedrock Claude → Structured Analysis → Frontend
```

### 4. Autenticación de Usuario
```
Login → Cognito → MFA → JWT Token → Protected Routes → Dashboard
```

## Estructura del proyecto

```
HISmart/
│
├── infrastructure/         # AWS CDK para infraestructura
│   ├── lib/               # Stacks de CDK
│   ├── package.json
│   └── README.md
├── backend/               # Lambdas Node.js
│   ├── csv-parser/        # Lambda para parsing de CSV
│   ├── crud-api/          # Lambda para operaciones CRUD
│   ├── ai-analysis/       # Lambda para integración Bedrock
│   ├── ejemplo_notas_clinicas.csv  # Datos de prueba
│   └── README.md
├── frontend/              # Aplicación React
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── README.md
├── docs/                  # Documentación técnica
│   ├── BEDROCK_INTEGRATION.md
│   └── ARCHITECTURE.md
├── branding/              # Configuración marca blanca
│   ├── branding.json
│   └── assets/
├── deploy-dev.sh          # Script de despliegue completo
├── master_prompt.txt      # Prompts y configuraciones IA
├── dev-config.json        # Configuración post-despliegue
├── README.md
└── .github/               # GitHub Actions
    └── workflows/
```

## 🛠️ Desarrollo y Personalización

### Comandos Útiles
```bash
# Desarrollo local del frontend
cd frontend && npm start

# Solo infraestructura
cd infrastructure && npx cdk deploy --all

# Solo frontend 
cd frontend && npm run build

# Linting y formato
npm run lint && npm run format
```

### Personalización White-Label
El sistema es completamente personalizable para cada institución:

```json
{
  "nombre": "Hospital San Juan",
  "logo": "/branding/logo-hospital.png",
  "colores": {
    "primario": "#2E7D32",
    "secundario": "#4CAF50",
    "fondo": "#F1F8E9"
  },
  "textos": {
    "bienvenida": "Sistema de Gestión Clínica",
    "descripcion": "Búsqueda inteligente de notas médicas"
  }
}
```

## 📋 Requisitos Técnicos

- **AWS CLI** configurado con permisos adecuados
- **Node.js 18+** y npm
- **CDK v2** instalado globalmente
- **Acceso a Bedrock** en la región us-east-1

## 💰 Estimación de Costos

**Ambiente de desarrollo (100 usuarios, 1000 análisis/mes):**
- DynamoDB: ~$5/mes
- Lambda: ~$10/mes  
- S3 + CloudFront: ~$5/mes
- Bedrock (Claude): ~$15/mes
- **Total estimado: $35-50/mes**

## 🔒 Seguridad y Compliance

- ✅ Autenticación JWT con Cognito
- ✅ MFA obligatorio para usuarios médicos
- ✅ Roles y permisos granulares
- ✅ Encriptación en tránsito y reposo
- ✅ Logs de auditoría completos
- ✅ CORS configurado específicamente
- ✅ No exposición de tokens sensibles

## 📞 Soporte y Documentación

- **Documentación técnica**: Ver carpeta `/docs/`
- **Integración Bedrock**: `docs/BEDROCK_INTEGRATION.md`
- **Master Prompt**: `master_prompt.txt`
- **Troubleshooting**: Ver README de cada componente

## 🚀 Casos de Uso

1. **Hospital Regional**: Búsqueda de notas por especialidad médica
2. **Clínica Privada**: Análisis de riesgo automático de pacientes  
3. **Centro Médico**: Dashboard de métricas por médico/departamento
4. **Consulta Externa**: Resúmenes ejecutivos para derivaciones
5. **Administración**: Reportes y estadísticas de uso del sistema

---

## 📄 Licencia

Este proyecto está bajo licencia MIT. Ver archivo `LICENSE` para más detalles.

**Desarrollado para instituciones de salud - Optimizado para AWS Serverless**

*✨ Proyecto completamente funcional y listo para despliegue en ambiente de desarrollo*