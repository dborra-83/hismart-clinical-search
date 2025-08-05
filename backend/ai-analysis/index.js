const AWS = require('aws-sdk');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');

// Configuración de clientes AWS
const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const bedrockClient = new BedrockRuntimeClient({ region: process.env.BEDROCK_REGION || process.env.AWS_REGION });

// Variables de entorno
const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME;
const BEDROCK_MODEL_ID = process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-sonnet-20240229-v1:0';

// Prompts predefinidos
const PROMPTS = {
    resumen_ejecutivo: `Analiza la siguiente nota clínica y genera un resumen ejecutivo de máximo 150 palabras, enfocándote en:
1. Diagnóstico principal
2. Síntomas y hallazgos clave  
3. Tratamiento recomendado
4. Seguimiento necesario

Responde SOLO en español y mantén un formato profesional médico.

Nota clínica:
{contenido}

Resumen:`,

    analisis_completo: `Eres un asistente médico especializado. Analiza la siguiente nota clínica y devuelve:

1. **Diagnóstico principal:** Identifica el diagnóstico más relevante
2. **Problemas asociados:** Lista problemas médicos secundarios o comorbilidades  
3. **Medicamentos mencionados:** Lista fármacos con dosis si están disponibles
4. **Recomendaciones clave:** Sugiere acciones específicas para el staff médico
5. **Seguimiento requerido:** Indica controles o procedimientos necesarios

**IMPORTANTE:** 
- Responde SOLO en español
- Mantén un formato estructurado y profesional
- No inventes información que no esté en la nota
- Si algo no está claro, indícalo explícitamente

Nota clínica:
{contenido}

Análisis:`,

    analisis_riesgo: `Evalúa los factores de riesgo presentes en esta nota clínica y clasifica el nivel de riesgo del paciente.

Clasifica como:
- **ALTO**: Riesgo vital inmediato, requiere atención urgente
- **MEDIO**: Factores de riesgo significativos, requiere seguimiento cercano
- **BAJO**: Riesgo mínimo, seguimiento rutinario

Justifica tu respuesta mencionando los factores específicos encontrados.

Nota clínica:
{contenido}

Evaluación de riesgo:`,

    extraccion_datos: `Extrae la siguiente información de la nota clínica en formato JSON válido:

{
  "edad_paciente": "extraer si está disponible",
  "sexo": "extraer si está disponible", 
  "diagnostico_principal": "diagnóstico más importante",
  "diagnosticos_secundarios": ["lista de diagnósticos adicionales"],
  "medicamentos_actuales": ["lista de medicamentos con dosis si disponible"],
  "alergias": ["lista de alergias mencionadas"],
  "signos_vitales": {
    "presion_arterial": "si está disponible",
    "frecuencia_cardiaca": "si está disponible",
    "temperatura": "si está disponible"
  },
  "procedimientos": ["procedimientos realizados"],
  "plan_tratamiento": ["pasos del plan de tratamiento"]
}

Si algún dato no está disponible, usa null o [] según corresponda.

Nota clínica:
{contenido}

JSON:`,

    busqueda_semantica: `Evalúa qué tan relevante es esta nota clínica para la siguiente consulta de búsqueda.

Consulta: {query}

Nota clínica: {contenido}

Responde con:
1. **Puntuación de relevancia:** Un número del 0 al 100 (0 = no relevante, 100 = muy relevante)
2. **Justificación:** Explica por qué es o no es relevante
3. **Términos coincidentes:** Lista los términos clave que coinciden

Evaluación:`
};

/**
 * Handler principal de Lambda
 */
exports.handler = async (event, context) => {
    console.log('AI Analysis Lambda iniciado:', JSON.stringify(event, null, 2));
    
    try {
        // Parsear el evento
        const httpMethod = event.httpMethod;
        const path = event.path;
        const body = event.body ? JSON.parse(event.body) : {};
        
        // Extraer información del usuario
        const userInfo = extractUserInfo(event);
        
        // Enrutar la solicitud
        let response;
        
        if (path.includes('/analyze/note')) {
            response = await analyzeNote(body, userInfo);
        } else if (path.includes('/analyze/summary')) {
            response = await generateSummary(body, userInfo);
        } else if (path.includes('/analyze/risk')) {
            response = await analyzeRisk(body, userInfo);
        } else if (path.includes('/analyze/extract')) {
            response = await extractStructuredData(body, userInfo);
        } else if (path.includes('/analyze/semantic')) {
            response = await semanticSearch(body, userInfo);
        } else {
            response = createResponse(404, { error: 'Endpoint de análisis no encontrado' });
        }
        
        return response;
        
    } catch (error) {
        console.error('Error en AI Analysis Lambda:', error);
        
        return createResponse(500, {
            error: 'Error en análisis de IA',
            details: error.message
        });
    }
};

/**
 * Análisis completo de una nota clínica
 */
async function analyzeNote(body, userInfo) {
    try {
        const { note_id, contenido, tipo_analisis = 'completo' } = body;
        
        let noteContent = contenido;
        
        // Si se proporciona note_id, obtener contenido de DynamoDB
        if (note_id && !contenido) {
            const note = await getNoteFromDB(note_id);
            if (!note) {
                return createResponse(404, { error: 'Nota no encontrada' });
            }
            noteContent = note.contenido_original || note.contenido_procesado;
        }
        
        if (!noteContent || noteContent.trim().length < 10) {
            return createResponse(400, { error: 'Contenido de nota insuficiente para análisis' });
        }
        
        // Seleccionar prompt según tipo de análisis
        let prompt;
        switch (tipo_analisis) {
            case 'resumen':
                prompt = PROMPTS.resumen_ejecutivo;
                break;
            case 'riesgo':
                prompt = PROMPTS.analisis_riesgo;
                break;
            case 'extraccion':
                prompt = PROMPTS.extraccion_datos;
                break;
            default:
                prompt = PROMPTS.analisis_completo;
        }
        
        // Reemplazar placeholder
        const finalPrompt = prompt.replace('{contenido}', noteContent);
        
        // Llamar a Bedrock
        const analysis = await callBedrock(finalPrompt);
        
        // Si tenemos note_id, actualizar la nota con el análisis
        if (note_id) {
            await updateNoteWithAnalysis(note_id, analysis, tipo_analisis, userInfo);
        }
        
        return createResponse(200, {
            tipo_analisis: tipo_analisis,
            contenido_analizado: noteContent.substring(0, 200) + '...',
            analisis: analysis,
            timestamp: new Date().toISOString(),
            usuario: userInfo.username
        });
        
    } catch (error) {
        console.error('Error en análisis de nota:', error);
        return createResponse(500, { error: 'Error ejecutando análisis de nota' });
    }
}

/**
 * Genera resumen ejecutivo
 */
async function generateSummary(body, userInfo) {
    try {
        const { contenido, max_palabras = 150 } = body;
        
        if (!contenido || contenido.trim().length < 50) {
            return createResponse(400, { error: 'Contenido insuficiente para generar resumen' });
        }
        
        const prompt = `Crea un resumen ejecutivo de máximo ${max_palabras} palabras de la siguiente nota clínica, enfocándote en los puntos más críticos para la toma de decisiones médicas:

${contenido}

Resumen (máximo ${max_palabras} palabras):`;
        
        const summary = await callBedrock(prompt);
        
        return createResponse(200, {
            resumen: summary,
            palabras_objetivo: max_palabras,
            contenido_original_chars: contenido.length,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Error generando resumen:', error);
        return createResponse(500, { error: 'Error generando resumen' });
    }
}

/**
 * Análisis de riesgo del paciente
 */
async function analyzeRisk(body, userInfo) {
    try {
        const { contenido, factores_adicionales = [] } = body;
        
        if (!contenido) {
            return createResponse(400, { error: 'Contenido requerido para análisis de riesgo' });
        }
        
        let prompt = PROMPTS.analisis_riesgo.replace('{contenido}', contenido);
        
        // Agregar factores adicionales si se proporcionan
        if (factores_adicionales.length > 0) {
            prompt += `\n\nFactores adicionales a considerar: ${factores_adicionales.join(', ')}`;
        }
        
        const riskAnalysis = await callBedrock(prompt);
        
        // Extraer nivel de riesgo del análisis
        const riskLevel = extractRiskLevel(riskAnalysis);
        
        return createResponse(200, {
            nivel_riesgo: riskLevel,
            analisis_completo: riskAnalysis,
            factores_considerados: factores_adicionales,
            timestamp: new Date().toISOString(),
            evaluado_por: userInfo.username
        });
        
    } catch (error) {
        console.error('Error en análisis de riesgo:', error);
        return createResponse(500, { error: 'Error ejecutando análisis de riesgo' });
    }
}

/**
 * Extrae datos estructurados de la nota
 */
async function extractStructuredData(body, userInfo) {
    try {
        const { contenido } = body;
        
        if (!contenido) {
            return createResponse(400, { error: 'Contenido requerido para extracción de datos' });
        }
        
        const prompt = PROMPTS.extraccion_datos.replace('{contenido}', contenido);
        
        const structuredData = await callBedrock(prompt);
        
        // Intentar parsear como JSON
        let parsedData;
        try {
            parsedData = JSON.parse(structuredData);
        } catch (parseError) {
            console.warn('No se pudo parsear como JSON, devolviendo texto crudo');
            parsedData = {
                raw_response: structuredData,
                parsing_error: 'No se pudo convertir a JSON'
            };
        }
        
        return createResponse(200, {
            datos_estructurados: parsedData,
            contenido_chars: contenido.length,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Error extrayendo datos estructurados:', error);
        return createResponse(500, { error: 'Error extrayendo datos estructurados' });
    }
}

/**
 * Búsqueda semántica
 */
async function semanticSearch(body, userInfo) {
    try {
        const { query, contenido } = body;
        
        if (!query || !contenido) {
            return createResponse(400, { error: 'Query y contenido requeridos para búsqueda semántica' });
        }
        
        const prompt = PROMPTS.busqueda_semantica
            .replace('{query}', query)
            .replace('{contenido}', contenido);
        
        const semanticAnalysis = await callBedrock(prompt);
        
        // Extraer puntuación de relevancia
        const relevanceScore = extractRelevanceScore(semanticAnalysis);
        
        return createResponse(200, {
            query: query,
            puntuacion_relevancia: relevanceScore,
            analisis_semantico: semanticAnalysis,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Error en búsqueda semántica:', error);
        return createResponse(500, { error: 'Error ejecutando búsqueda semántica' });
    }
}

/**
 * Llama a Amazon Bedrock (Claude)
 */
async function callBedrock(prompt, maxTokens = 1000, temperature = 0.1) {
    try {
        const body = {
            anthropic_version: 'bedrock-2023-05-31',
            max_tokens: maxTokens,
            temperature: temperature,
            top_p: 0.9,
            messages: [
                {
                    role: 'user',
                    content: prompt
                }
            ]
        };
        
        const command = new InvokeModelCommand({
            modelId: BEDROCK_MODEL_ID,
            contentType: 'application/json',
            accept: '*/*',
            body: JSON.stringify(body)
        });
        
        console.log(`Llamando a Bedrock con modelo: ${BEDROCK_MODEL_ID}`);
        
        const response = await bedrockClient.send(command);
        const responseBody = JSON.parse(new TextDecoder().decode(response.body));
        
        if (responseBody.content && responseBody.content[0] && responseBody.content[0].text) {
            return responseBody.content[0].text.trim();
        } else {
            throw new Error('Respuesta inesperada de Bedrock');
        }
        
    } catch (error) {
        console.error('Error llamando a Bedrock:', error);
        
        // Manejar errores específicos de Bedrock
        if (error.name === 'AccessDeniedException') {
            throw new Error('Sin permisos para acceder a Bedrock');
        } else if (error.name === 'ValidationException') {
            throw new Error('Parámetros de solicitud inválidos');
        } else if (error.name === 'ThrottlingException') {
            throw new Error('Límite de velocidad excedido');
        } else {
            throw new Error(`Error de Bedrock: ${error.message}`);
        }
    }
}

/**
 * Obtiene una nota de DynamoDB
 */
async function getNoteFromDB(noteId) {
    try {
        const command = new GetCommand({
            TableName: TABLE_NAME,
            Key: {
                PK: `NOTE#${noteId}`,
                SK: 'METADATA'
            }
        });
        
        const result = await docClient.send(command);
        return result.Item || null;
        
    } catch (error) {
        console.error('Error obteniendo nota de DB:', error);
        return null;
    }
}

/**
 * Actualiza una nota con análisis de IA
 */
async function updateNoteWithAnalysis(noteId, analysis, tipoAnalisis, userInfo) {
    try {
        const updateFields = {};
        const expressionAttributeValues = {};
        
        // Determinar qué campo actualizar según el tipo de análisis
        switch (tipoAnalisis) {
            case 'completo':
                updateFields['analisis_ia_completo'] = analysis;
                expressionAttributeValues[':analisis_completo'] = analysis;
                break;
            case 'resumen':
                updateFields['resumen_ia'] = analysis;
                expressionAttributeValues[':resumen'] = analysis;
                break;
            case 'riesgo':
                updateFields['analisis_riesgo'] = analysis;
                expressionAttributeValues[':riesgo'] = analysis;
                break;
        }
        
        // Metadatos de análisis
        updateFields['ultimo_analisis_ia'] = new Date().toISOString();
        updateFields['usuario_analisis'] = userInfo.username;
        expressionAttributeValues[':ultimo_analisis'] = new Date().toISOString();
        expressionAttributeValues[':usuario_analisis'] = userInfo.username;
        
        const updateExpression = `SET ${Object.keys(updateFields).map(key => 
            `${key} = :${key.replace('_', '')}`).join(', ')}`;
        
        const command = new UpdateCommand({
            TableName: TABLE_NAME,
            Key: {
                PK: `NOTE#${noteId}`,
                SK: 'METADATA'
            },
            UpdateExpression: updateExpression,
            ExpressionAttributeValues: expressionAttributeValues
        });
        
        await docClient.send(command);
        console.log(`Nota ${noteId} actualizada con análisis ${tipoAnalisis}`);
        
    } catch (error) {
        console.error('Error actualizando nota con análisis:', error);
        // No fallar la respuesta si no se puede actualizar
    }
}

// Funciones de utilidad

/**
 * Extrae información del usuario del evento
 */
function extractUserInfo(event) {
    const claims = event.requestContext?.authorizer?.claims || {};
    
    return {
        username: claims['cognito:username'] || claims.username || 'unknown',
        email: claims.email || '',
        name: claims.name || claims['given_name'] || '',
        groups: claims['cognito:groups'] ? claims['cognito:groups'].split(',') : [],
        especialidad: claims['custom:especialidad'] || '',
        rol: claims['custom:rol'] || 'medico'
    };
}

/**
 * Extrae nivel de riesgo del análisis
 */
function extractRiskLevel(analysis) {
    const text = analysis.toLowerCase();
    
    if (text.includes('alto') || text.includes('crítico') || text.includes('urgente')) {
        return 'ALTO';
    } else if (text.includes('medio') || text.includes('moderado')) {
        return 'MEDIO';
    } else if (text.includes('bajo') || text.includes('mínimo')) {
        return 'BAJO';
    } else {
        return 'INDETERMINADO';
    }
}

/**
 * Extrae puntuación de relevancia
 */
function extractRelevanceScore(analysis) {
    // Buscar números entre 0-100 en el análisis
    const scoreMatch = analysis.match(/\b(\d{1,3})\b/g);
    
    if (scoreMatch) {
        for (const score of scoreMatch) {
            const num = parseInt(score);
            if (num >= 0 && num <= 100) {
                return num;
            }
        }
    }
    
    return 0; // Score por defecto si no se encuentra
}

/**
 * Crea respuesta HTTP estándar
 */
function createResponse(statusCode, body, headers = {}) {
    return {
        statusCode,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
            'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
            ...headers
        },
        body: JSON.stringify(body)
    };
}