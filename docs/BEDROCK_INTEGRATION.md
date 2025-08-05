# Integración con Amazon Bedrock (Claude 3 Sonnet)

## Descripción General

HISmart utiliza Amazon Bedrock con el modelo Claude 3 Sonnet de Anthropic para proporcionar análisis inteligente de notas clínicas. Esta integración permite a los profesionales médicos obtener insights valiosos de los datos clínicos de manera automatizada.

## Configuración de Bedrock

### Modelos Soportados

- **Claude 3 Sonnet (`anthropic.claude-3-sonnet-20240229-v1:0`)**: Modelo principal para análisis general
- **Claude 3 Haiku (`anthropic.claude-3-haiku-20240307-v1:0`)**: Modelo alternativo para tareas más ligeras

### Permisos IAM Requeridos

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel"
      ],
      "Resource": [
        "arn:aws:bedrock:*::foundation-model/anthropic.claude-3-sonnet-20240229-v1:0",
        "arn:aws:bedrock:*::foundation-model/anthropic.claude-3-haiku-20240307-v1:0"
      ]
    }
  ]
}
```

### Configuración CDK

En `hismart-backend-stack.ts`, la función Lambda `ai-analysis` está configurada con:

```typescript
const aiAnalysisFunction = new NodejsFunction(this, 'AiAnalysisFunction', {
  entry: path.join(__dirname, '../../backend/ai-analysis/index.js'),
  handler: 'handler',
  runtime: Runtime.NODEJS_18_X,
  timeout: Duration.minutes(10), // Tiempo extendido para análisis IA
  memorySize: 1024,
  environment: {
    BEDROCK_REGION: props.region,
    MODEL_ID: 'anthropic.claude-3-sonnet-20240229-v1:0'
  }
});

// Permisos para Bedrock
aiAnalysisFunction.addToRolePolicy(new PolicyStatement({
  effect: Effect.ALLOW,
  actions: ['bedrock:InvokeModel'],
  resources: [
    `arn:aws:bedrock:${props.region}::foundation-model/anthropic.claude-3-sonnet-20240229-v1:0`,
    `arn:aws:bedrock:${props.region}::foundation-model/anthropic.claude-3-haiku-20240307-v1:0`
  ]
}));
```

## Tipos de Análisis Disponibles

### 1. Análisis Completo (`completo`)

Proporciona un análisis exhaustivo de la nota clínica incluyendo:
- Resumen de hallazgos principales
- Diagnósticos identificados
- Medicamentos mencionados
- Plan de tratamiento
- Recomendaciones adicionales

**Prompt utilizado:**
```
Analiza la siguiente nota clínica de manera exhaustiva:

{contenido}

Proporciona:
1. Resumen de los hallazgos principales
2. Diagnósticos mencionados o sugeridos
3. Medicamentos y tratamientos identificados
4. Estado del paciente
5. Plan de seguimiento
6. Cualquier área que requiera atención especial

Responde en español de manera profesional y estructurada.
```

### 2. Resumen Ejecutivo (`resumen`)

Genera un resumen conciso de la nota clínica:
- Palabras objetivo configurables (50-500 palabras)
- Puntos clave principales
- Estado general del paciente

**Prompt utilizado:**
```
Genera un resumen ejecutivo de máximo {max_palabras} palabras de la siguiente nota clínica:

{contenido}

El resumen debe incluir:
- Diagnóstico principal
- Estado actual del paciente
- Tratamiento prescrito
- Próximos pasos

Mantén un lenguaje médico profesional en español.
```

### 3. Evaluación de Riesgos (`riesgo`)

Evalúa el nivel de riesgo del paciente:
- Nivel de riesgo (Bajo, Medio, Alto, Crítico)
- Factores de riesgo identificados
- Recomendaciones preventivas

**Prompt utilizado:**
```
Evalúa el nivel de riesgo del paciente basado en la siguiente nota clínica:

{contenido}

Factores adicionales a considerar: {factores_adicionales}

Proporciona:
1. Nivel de riesgo (Bajo/Medio/Alto/Crítico)
2. Factores de riesgo identificados
3. Recomendaciones para mitigar riesgos
4. Signos de alerta a monitorear

Responde de manera estructurada en español.
```

### 4. Extracción de Datos Estructurados (`extraccion`)

Extrae información estructurada de las notas:
- Datos demográficos
- Signos vitales
- Medicamentos con dosis
- Fechas importantes
- Diagnósticos codificados

**Prompt utilizado:**
```
Extrae información estructurada de la siguiente nota clínica en formato JSON:

{contenido}

Extrae:
- datos_demograficos: {edad, genero, etc}
- signos_vitales: {presion_arterial, temperatura, etc}
- medicamentos: [{nombre, dosis, frecuencia}]
- diagnosticos: [lista de diagnósticos]
- fechas_importantes: [fechas relevantes]
- examenes_solicitados: [lista de exámenes]

Responde solo con el JSON válido, sin texto adicional.
```

## Implementación Backend

### Función Lambda `ai-analysis`

Ubicada en `/backend/ai-analysis/index.js`, maneja todas las solicitudes de análisis IA:

```javascript
const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');

const bedrockClient = new BedrockRuntimeClient({
  region: process.env.BEDROCK_REGION || 'us-east-1'
});

const invokeBedrockModel = async (prompt, maxTokens = 4000) => {
  const modelId = process.env.MODEL_ID || 'anthropic.claude-3-sonnet-20240229-v1:0';
  
  const params = {
    modelId,
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: maxTokens,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    })
  };

  const command = new InvokeModelCommand(params);
  const response = await bedrockClient.send(command);
  
  const responseBody = JSON.parse(new TextDecoder().decode(response.body));
  return responseBody.content[0].text;
};
```

### Endpoints de API

#### POST `/analyze/note`
- **Función**: Análisis completo de nota clínica
- **Body**: `{ note_id?, contenido?, tipo_analisis, max_palabras?, factores_adicionales? }`
- **Response**: `{ tipo_analisis, contenido_analizado?, analisis, timestamp, usuario }`

#### POST `/analyze/summary`
- **Función**: Generar resumen ejecutivo
- **Body**: `{ contenido, max_palabras? }`
- **Response**: `{ resumen, palabras_objetivo, contenido_original_chars, timestamp }`

#### POST `/analyze/risk`
- **Función**: Evaluar riesgo del paciente
- **Body**: `{ contenido, factores_adicionales? }`
- **Response**: `{ nivel_riesgo, analisis_completo, factores_considerados, timestamp, evaluado_por }`

#### POST `/analyze/extract`
- **Función**: Extraer datos estructurados
- **Body**: `{ contenido }`
- **Response**: `{ datos_estructurados, contenido_chars, timestamp }`

## Integración Frontend

### Hooks Personalizados

```typescript
// useApi.ts
export const useAnalyzeNote = () => {
  return useMutation(api.analyzeNote, {
    onSuccess: (data) => {
      console.log('Análisis completado:', data.tipo_analisis);
    },
  });
};

export const useGenerateSummary = () => {
  return useMutation(api.generateSummary);
};

export const useAnalyzeRisk = () => {
  return useMutation(api.analyzeRisk);
};

export const useExtractData = () => {
  return useMutation(api.extractStructuredData);
};
```

### Servicios API

```typescript
// api.ts
export const analyzeNote = async (request: AnalysisRequest): Promise<AnalysisResult> => {
  const config = await getRequestConfig();
  config.body = request;
  
  return await API.post(API_NAME, '/analyze/note', config);
};
```

## Página de Análisis

La página `/analysis` proporciona una interfaz completa para:

1. **Editor de Texto**: Para ingresar contenido de notas clínicas
2. **Selección de Tipo**: 4 tipos de análisis disponibles
3. **Configuración**: Parámetros específicos por tipo de análisis
4. **Resultados**: Visualización formateada de resultados
5. **Historial**: Últimos 10 análisis realizados

### Componentes Principales

- **Tabs de Análisis**: Navegación entre tipos de análisis
- **Editor Rico**: Campo de texto con validación
- **Cards de Resultados**: Visualización profesional de resultados
- **Ejemplos Predefinidos**: Textos de ejemplo para pruebas

## Configuración de Seguridad

### Autenticación y Autorización

- **JWT Tokens**: Validación de usuario autenticado
- **Roles**: Solo usuarios con permisos médicos pueden usar IA
- **Auditoria**: Registro de todos los análisis realizados

### Límites y Cuotas

```javascript
// Configuración de límites
const ANALYSIS_LIMITS = {
  MAX_CONTENT_LENGTH: 50000, // 50KB máximo por análisis
  MAX_DAILY_REQUESTS: 100,   // 100 análisis por usuario/día
  TIMEOUT: 300000,           // 5 minutos timeout
  MAX_TOKENS: 4000          // Máximo tokens de respuesta
};
```

## Manejo de Errores

### Errores Comunes

1. **AccessDeniedException**: Falta de permisos para Bedrock
2. **ValidationException**: Formato incorrecto de prompt
3. **ThrottlingException**: Límite de requests excedido
4. **InternalServerException**: Error interno de Bedrock

### Implementación de Retry

```javascript
const retryWithBackoff = async (fn, maxRetries = 3) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      
      const delay = Math.pow(2, i) * 1000; // Backoff exponencial
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};
```

## Métricas y Monitoreo

### CloudWatch Logs

Cada invocación de Bedrock registra:
- Timestamp de la solicitud
- Usuario que realizó el análisis
- Tipo de análisis
- Tiempo de procesamiento
- Tokens utilizados
- Estado de la respuesta

### Métricas Personalizadas

```javascript
// Ejemplo de métricas
const putMetric = async (metricName, value, unit = 'Count') => {
  const cloudWatch = new CloudWatchClient({});
  
  await cloudWatch.send(new PutMetricDataCommand({
    Namespace: 'HISmart/Analysis',
    MetricData: [{
      MetricName: metricName,
      Value: value,
      Unit: unit,
      Timestamp: new Date()
    }]
  }));
};
```

## Costos y Optimización

### Estimación de Costos

- **Claude 3 Sonnet**: ~$3.00 por millón de tokens de entrada
- **Claude 3 Haiku**: ~$0.25 por millón de tokens de entrada
- **Análisis promedio**: 1000-2000 tokens por análisis
- **Costo estimado**: $0.003-$0.006 por análisis con Sonnet

### Optimizaciones Implementadas

1. **Cache de Resultados**: Evitar análisis duplicados
2. **Modelo Apropiado**: Haiku para tareas simples, Sonnet para complejas
3. **Límites de Contenido**: Máximo 50KB por análisis
4. **Timeout Configurado**: Evitar análisis eternos

## Testing

### Tests de Integración

```javascript
// Ejemplo de test
const testBedrockIntegration = async () => {
  const sampleNote = "Paciente de 45 años con dolor torácico...";
  
  const result = await analyzeNote({
    contenido: sampleNote,
    tipo_analisis: 'completo'
  });
  
  expect(result.analisis).toBeDefined();
  expect(result.timestamp).toBeDefined();
  expect(result.tipo_analisis).toBe('completo');
};
```

### Validación de Prompts

- **Longitud**: Prompts optimizados para eficiencia
- **Claridad**: Instrucciones específicas para mejor calidad
- **Contexto**: Información médica contextual incluida

## Troubleshooting

### Problemas Comunes

1. **Error 403 Forbidden**
   - Verificar permisos IAM para Bedrock
   - Confirmar región donde está disponible Claude

2. **Timeout Errors**
   - Verificar configuración de timeout en Lambda
   - Reducir tamaño del contenido a analizar

3. **Invalid JSON Response**
   - Verificar format de prompt para extracción
   - Agregar validación adicional en respuesta

### Logs de Debug

```javascript
console.log('Bedrock Request:', {
  modelId,
  contentLength: prompt.length,
  maxTokens,
  timestamp: new Date().toISOString()
});
```

## Roadmap Futuro

### Mejoras Planificadas

1. **Análisis por Lotes**: Procesar múltiples notas simultáneamente
2. **Modelos Especializados**: Integrar modelos específicos por especialidad
3. **Machine Learning**: Entrenar modelos personalizados con datos históricos
4. **API de Feedback**: Mejorar calidad con retroalimentación médica
5. **Análisis Predictivo**: Identificar patrones y tendencias

### Integración con Otros Servicios

- **Amazon Comprehend Medical**: Análisis adicional de entidades médicas
- **Amazon Translate**: Soporte multiidioma
- **Amazon Textract**: Procesamiento de documentos escaneados

---

Esta integración proporciona capacidades avanzadas de IA médica manteniendo estándares de seguridad y compliance requeridos en el sector salud.