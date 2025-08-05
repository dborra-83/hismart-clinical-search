# HISmart - Backend Serverless

Backend serverless para HISmart construido con AWS Lambda, API Gateway y integración con Amazon Bedrock.

## Arquitectura

El backend está compuesto por 3 funciones Lambda principales:

### 1. CSV Parser (`csv-parser/`)
- **Propósito**: Procesa archivos CSV subidos a S3 y extrae notas clínicas
- **Trigger**: S3 Event (ObjectCreated) en archivos .csv
- **Funcionalidades**:
  - Parsing automático de archivos CSV con mapeo flexible de columnas
  - Validación y limpieza de datos
  - Detección de duplicados
  - Extracción de palabras clave
  - Generación de resúmenes con IA (opcional)
  - Almacenamiento en DynamoDB

### 2. CRUD API (`crud-api/`)
- **Propósito**: Operaciones CRUD, búsquedas y gestión de archivos
- **Trigger**: API Gateway HTTP requests
- **Endpoints**:
  - `GET /notes` - Listar notas con filtros
  - `GET /notes/{id}` - Obtener nota específica
  - `POST /notes` - Crear nueva nota manual
  - `PUT /notes/{id}` - Actualizar nota
  - `DELETE /notes/{id}` - Eliminar nota (solo admin)
  - `POST /search` - Búsqueda avanzada
  - `POST /upload/csv` - Generar URL presignada
  - `GET /upload/status/{jobId}` - Estado de procesamiento
  - `GET /stats/dashboard` - Estadísticas del sistema

### 3. AI Analysis (`ai-analysis/`)
- **Propósito**: Análisis inteligente de notas clínicas con Amazon Bedrock
- **Trigger**: API Gateway HTTP requests
- **Endpoints**:
  - `POST /analyze/note` - Análisis completo de nota
  - `POST /analyze/summary` - Generar resumen ejecutivo
  - `POST /analyze/risk` - Evaluación de riesgo
  - `POST /analyze/extract` - Extracción de datos estructurados
  - `POST /analyze/semantic` - Búsqueda semántica

## Estructura de Datos

### DynamoDB Schema

```javascript
{
  "PK": "NOTE#<uuid>",           // Partition Key
  "SK": "METADATA",              // Sort Key
  "id": "unique-note-id",
  "paciente_id": "patient-id",
  "fecha_nota": "2024-01-15",
  "medico": "Dr. Juan Pérez",
  "especialidad": "Cardiología",
  "tipo_nota": "consulta_externa",
  "contenido_original": "Texto completo...",
  "contenido_procesado": "Texto limpio...",
  "diagnosticos": ["Hipertensión", "Diabetes"],
  "medicamentos": ["Losartán 50mg", "Metformina"],
  "palabras_clave": ["hipertension", "diabetes"],
  "resumen_ia": "Resumen generado por Claude...",
  "analisis_ia_completo": "Análisis detallado...",
  "analisis_riesgo": "Evaluación de riesgo...",
  "fecha_carga": "2024-01-15T10:30:00Z",
  "usuario_creacion": "medico1",
  "estado": "procesado"
}
```

### Índices Secundarios Globales (GSI)

1. **GSI-PacienteId-Fecha**: Para búsquedas por paciente
2. **GSI-Medico-Fecha**: Para búsquedas por médico
3. **GSI-Especialidad-Fecha**: Para búsquedas por especialidad

## Configuración de Desarrollo

### Prerrequisitos
- Node.js 18+
- AWS CLI configurado
- Permisos IAM apropiados

### Instalación de dependencias

```bash
# Para cada Lambda
cd csv-parser && npm install
cd ../crud-api && npm install  
cd ../ai-analysis && npm install
```

### Variables de Entorno

Cada Lambda requiere las siguientes variables:

```bash
# Comunes
AWS_REGION=us-east-1
DYNAMODB_TABLE_NAME=HISmart-ClinicalNotes
S3_BUCKET_NAME=hismart-clinical-data-<account>-<region>

# Específicas para Bedrock
BEDROCK_REGION=us-east-1
BEDROCK_MODEL_ID=anthropic.claude-3-sonnet-20240229-v1:0

# Para autenticación
USER_POOL_ID=us-east-1_xxxxxxxxx
```

## Despliegue

### Usando AWS CDK (recomendado)

```bash
cd ../infrastructure
npm run deploy
```

### Manual con AWS CLI

```bash
# Crear packages
cd csv-parser && npm run build
cd ../crud-api && npm run build
cd ../ai-analysis && npm run build

# Desplegar (ejemplo para csv-parser)
aws lambda update-function-code \
  --function-name HISmart-CsvParser \
  --zip-file fileb://function.zip
```

## Ejemplos de Uso

### 1. Subir archivo CSV

```javascript
// 1. Obtener URL presignada
const response = await fetch('/api/upload/csv', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    filename: 'notas_clinicas.csv'
  })
});

const { upload_url, file_key } = await response.json();

// 2. Subir archivo a S3
await fetch(upload_url, {
  method: 'PUT',
  body: csvFile,
  headers: {
    'Content-Type': 'text/csv'
  }
});

// 3. El procesamiento se inicia automáticamente
```

### 2. Buscar notas clínicas

```javascript
const response = await fetch('/api/search', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    query: 'hipertensión diabetes',
    filtros: {
      especialidad: 'Cardiología',
      fecha_desde: '2024-01-01'
    },
    limit: 10
  })
});

const { resultados } = await response.json();
```

### 3. Análisis con IA

```javascript
const response = await fetch('/api/analyze/note', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    note_id: 'uuid-de-la-nota',
    tipo_analisis: 'completo'
  })
});

const { analisis } = await response.json();
```

## Autenticación y Autorización

### Flujo de autenticación
1. Usuario se autentica con Cognito
2. Recibe JWT token
3. Token se incluye en header `Authorization: Bearer <token>`
4. API Gateway valida token con Cognito Authorizer
5. Claims del usuario se pasan a Lambda en `event.requestContext.authorizer.claims`

### Niveles de acceso
- **Administradores**: Acceso completo
- **Médicos**: Acceso a notas de su especialidad
- **Enfermería**: Acceso limitado de solo lectura

## Monitoreo y Logging

### CloudWatch Logs
- `/aws/lambda/HISmart-CsvParser`
- `/aws/lambda/HISmart-CrudApi`
- `/aws/lambda/HISmart-AiAnalysis`

### Métricas importantes
- Errores en procesamiento de CSV
- Latencia de APIs
- Uso de tokens Bedrock
- Carga de archivos por día

### Alertas configuradas
- Error rate > 5%
- Timeout en Lambdas
- Costo Bedrock > umbral

## Seguridad

### Implementaciones de seguridad
- ✅ Autenticación JWT con Cognito
- ✅ Autorización por grupos/roles
- ✅ Encriptación en tránsito (HTTPS)
- ✅ Encriptación en reposo (S3, DynamoDB)
- ✅ Principio de menor privilegio (IAM)
- ✅ Logging de auditoría
- ✅ Validación de entrada
- ✅ Rate limiting (API Gateway)

### Consideraciones PHI (Protected Health Information)
- Datos médicos nunca se logean en texto plano
- Acceso auditado en CloudTrail
- Retención de datos según regulaciones
- Backup automático habilitado

## Testing

### Tests unitarios
```bash
cd csv-parser && npm test
cd ../crud-api && npm test
cd ../ai-analysis && npm test
```

### Tests de integración
```bash
# Usando archivos de ejemplo
curl -X POST https://api.example.com/search \
  -H "Authorization: Bearer <token>" \
  -d '{"query": "test"}'
```

## Troubleshooting

### Errores comunes

**Error: "Access denied to Bedrock"**
- Verificar permisos IAM para bedrock:InvokeModel
- Confirmar que la región soporta Bedrock

**Error: "Note not found in DynamoDB"**
- Verificar que el procesamiento de CSV completó
- Revisar CloudWatch logs del CSV Parser

**Error: "Timeout en Lambda"**
- Aumentar timeout en configuración
- Optimizar queries DynamoDB

### Debug logs
```bash
# Ver logs en tiempo real
aws logs tail /aws/lambda/HISmart-CrudApi --follow

# Buscar errores específicos
aws logs filter-log-events \
  --log-group-name /aws/lambda/HISmart-CsvParser \
  --filter-pattern "ERROR"
```

## Costos Estimados

### Por componente (mensual):
- **Lambda**: $10-30 (basado en invocaciones)
- **DynamoDB**: $5-25 (on-demand)
- **S3**: $2-10 (almacenamiento + requests)
- **Bedrock**: $20-100 (basado en tokens procesados)
- **API Gateway**: $3-15 (requests)

**Total estimado**: $40-180/mes según uso

## Próximas funcionalidades

- [ ] Análisis de sentimientos en notas
- [ ] Integración con HL7 FHIR
- [ ] Reportes automáticos PDF
- [ ] Notificaciones en tiempo real
- [ ] Backup cross-region
- [ ] Métricas avanzadas con X-Ray

---

Para más detalles técnicos, consultar los comentarios en el código de cada Lambda.