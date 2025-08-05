const AWS = require('aws-sdk');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, DeleteCommand, QueryCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');

// Configuración de clientes AWS
const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const s3Client = new S3Client({ region: process.env.AWS_REGION });

// Variables de entorno
const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME;
const BUCKET_NAME = process.env.S3_BUCKET_NAME;
const USER_POOL_ID = process.env.USER_POOL_ID;

/**
 * Handler principal de Lambda
 */
exports.handler = async (event, context) => {
    console.log('CRUD API Lambda iniciado:', JSON.stringify(event, null, 2));
    
    try {
        // Parsear el evento
        const httpMethod = event.httpMethod;
        const path = event.path;
        const pathParameters = event.pathParameters || {};
        const queryStringParameters = event.queryStringParameters || {};
        const body = event.body ? JSON.parse(event.body) : {};
        const headers = event.headers || {};
        
        // Extraer información del usuario autenticado
        const userInfo = extractUserInfo(event);
        console.log('Usuario autenticado:', userInfo);
        
        // Enrutar la solicitud
        let response;
        
        if (path.startsWith('/notes')) {
            response = await handleNotesRequests(httpMethod, pathParameters, queryStringParameters, body, userInfo);
        } else if (path.startsWith('/search')) {
            response = await handleSearchRequests(httpMethod, body, userInfo);
        } else if (path.startsWith('/upload')) {
            response = await handleUploadRequests(httpMethod, pathParameters, body, userInfo);
        } else if (path.startsWith('/stats')) {
            response = await handleStatsRequests(httpMethod, userInfo);
        } else {
            response = createResponse(404, { error: 'Endpoint no encontrado' });
        }
        
        return response;
        
    } catch (error) {
        console.error('Error en CRUD API Lambda:', error);
        
        return createResponse(500, {
            error: 'Error interno del servidor',
            details: error.message
        });
    }
};

/**
 * Maneja requests a /notes
 */
async function handleNotesRequests(method, pathParams, queryParams, body, userInfo) {
    switch (method) {
        case 'GET':
            if (pathParams.id) {
                return await getNoteById(pathParams.id, userInfo);
            } else {
                return await listNotes(queryParams, userInfo);
            }
            
        case 'POST':
            return await createNote(body, userInfo);
            
        case 'PUT':
            if (pathParams.id) {
                return await updateNote(pathParams.id, body, userInfo);
            } else {
                return createResponse(400, { error: 'ID de nota requerido para actualización' });
            }
            
        case 'DELETE':
            if (pathParams.id) {
                return await deleteNote(pathParams.id, userInfo);
            } else {
                return createResponse(400, { error: 'ID de nota requerido para eliminación' });
            }
            
        default:
            return createResponse(405, { error: 'Método no permitido' });
    }
}

/**
 * Maneja requests a /search
 */
async function handleSearchRequests(method, body, userInfo) {
    if (method !== 'POST') {
        return createResponse(405, { error: 'Solo se permite POST para búsquedas' });
    }
    
    return await searchNotes(body, userInfo);
}

/**
 * Maneja requests a /upload
 */
async function handleUploadRequests(method, pathParams, body, userInfo) {
    if (method === 'POST' && pathParams.csv !== undefined) {
        return await generatePresignedUploadUrl(body, userInfo);
    } else if (method === 'GET' && pathParams.jobId) {
        return await getUploadStatus(pathParams.jobId, userInfo);
    } else {
        return createResponse(400, { error: 'Endpoint de upload no válido' });
    }
}

/**
 * Maneja requests a /stats
 */
async function handleStatsRequests(method, userInfo) {
    if (method === 'GET') {
        return await getDashboardStats(userInfo);
    } else {
        return createResponse(405, { error: 'Solo se permite GET para estadísticas' });
    }
}

/**
 * Obtiene una nota por ID
 */
async function getNoteById(noteId, userInfo) {
    try {
        const command = new GetCommand({
            TableName: TABLE_NAME,
            Key: {
                PK: `NOTE#${noteId}`,
                SK: 'METADATA'
            }
        });
        
        const result = await docClient.send(command);
        
        if (!result.Item) {
            return createResponse(404, { error: 'Nota no encontrada' });
        }
        
        // Verificar permisos de acceso
        if (!canAccessNote(result.Item, userInfo)) {
            return createResponse(403, { error: 'Sin permisos para acceder a esta nota' });
        }
        
        return createResponse(200, {
            nota: formatNoteForResponse(result.Item)
        });
        
    } catch (error) {
        console.error('Error obteniendo nota:', error);
        return createResponse(500, { error: 'Error obteniendo nota' });
    }
}

/**
 * Lista notas con filtros
 */
async function listNotes(queryParams, userInfo) {
    try {
        const {
            paciente_id,
            medico,
            especialidad,
            fecha_desde,
            fecha_hasta,
            limit = 20,
            last_key
        } = queryParams;
        
        let command;
        
        // Construir query basada en filtros
        if (paciente_id) {
            // Buscar por paciente usando GSI
            command = new QueryCommand({
                TableName: TABLE_NAME,
                IndexName: 'GSI-PacienteId-Fecha',
                KeyConditionExpression: 'paciente_id = :paciente_id',
                ExpressionAttributeValues: {
                    ':paciente_id': paciente_id
                },
                Limit: parseInt(limit)
            });
            
            // Filtrar por fechas si se especifican
            if (fecha_desde || fecha_hasta) {
                let filterExpression = '';
                if (fecha_desde && fecha_hasta) {
                    command.FilterExpression = 'fecha_nota BETWEEN :fecha_desde AND :fecha_hasta';
                    command.ExpressionAttributeValues[':fecha_desde'] = fecha_desde;
                    command.ExpressionAttributeValues[':fecha_hasta'] = fecha_hasta;
                } else if (fecha_desde) {
                    command.FilterExpression = 'fecha_nota >= :fecha_desde';
                    command.ExpressionAttributeValues[':fecha_desde'] = fecha_desde;
                } else if (fecha_hasta) {
                    command.FilterExpression = 'fecha_nota <= :fecha_hasta';
                    command.ExpressionAttributeValues[':fecha_hasta'] = fecha_hasta;
                }
            }
            
        } else if (medico) {
            // Buscar por médico usando GSI
            command = new QueryCommand({
                TableName: TABLE_NAME,
                IndexName: 'GSI-Medico-Fecha',
                KeyConditionExpression: 'medico = :medico',
                ExpressionAttributeValues: {
                    ':medico': medico
                },
                Limit: parseInt(limit)
            });
            
        } else if (especialidad) {
            // Buscar por especialidad usando GSI
            command = new QueryCommand({
                TableName: TABLE_NAME,
                IndexName: 'GSI-Especialidad-Fecha',
                KeyConditionExpression: 'especialidad = :especialidad',
                ExpressionAttributeValues: {
                    ':especialidad': especialidad
                },
                Limit: parseInt(limit)
            });
            
        } else {
            // Scan general (costoso, usar con limite)
            command = new ScanCommand({
                TableName: TABLE_NAME,
                FilterExpression: 'begins_with(PK, :pk_prefix)',
                ExpressionAttributeValues: {
                    ':pk_prefix': 'NOTE#'
                },
                Limit: parseInt(limit)
            });
        }
        
        // Paginación
        if (last_key) {
            command.ExclusiveStartKey = JSON.parse(Buffer.from(last_key, 'base64').toString());
        }
        
        const result = await docClient.send(command);
        
        // Filtrar notas según permisos del usuario
        const filteredNotes = result.Items
            ? result.Items.filter(note => canAccessNote(note, userInfo))
            : [];
        
        return createResponse(200, {
            notas: filteredNotes.map(formatNoteForResponse),
            total: filteredNotes.length,
            last_key: result.LastEvaluatedKey 
                ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64')
                : null
        });
        
    } catch (error) {
        console.error('Error listando notas:', error);
        return createResponse(500, { error: 'Error listando notas' });
    }
}

/**
 * Crea una nueva nota
 */
async function createNote(body, userInfo) {
    try {
        const { paciente_id, contenido, diagnosticos, medicamentos, tipo_nota } = body;
        
        // Validar campos obligatorios
        if (!paciente_id || !contenido) {
            return createResponse(400, { 
                error: 'Campos obligatorios: paciente_id, contenido' 
            });
        }
        
        const noteId = uuidv4();
        const now = new Date().toISOString();
        
        const nota = {
            PK: `NOTE#${noteId}`,
            SK: 'METADATA',
            id: noteId,
            paciente_id: String(paciente_id),
            fecha_nota: moment().format('YYYY-MM-DD'),
            medico: userInfo.name || 'Usuario desconocido',
            especialidad: userInfo.especialidad || 'General',
            tipo_nota: tipo_nota || 'consulta_externa',
            contenido_original: contenido,
            contenido_procesado: limpiarTexto(contenido),
            diagnosticos: diagnosticos || [],
            medicamentos: medicamentos || [],
            palabras_clave: extraerPalabrasClave(contenido),
            resumen_ia: '', // Se completará con análisis IA posterior
            fecha_carga: now,
            usuario_creacion: userInfo.username,
            estado: 'manual',
            version: '1.0'
        };
        
        const command = new PutCommand({
            TableName: TABLE_NAME,
            Item: nota
        });
        
        await docClient.send(command);
        
        return createResponse(201, {
            message: 'Nota creada exitosamente',
            nota: formatNoteForResponse(nota)
        });
        
    } catch (error) {
        console.error('Error creando nota:', error);
        return createResponse(500, { error: 'Error creando nota' });
    }
}

/**
 * Actualiza una nota existente
 */
async function updateNote(noteId, body, userInfo) {
    try {
        // Verificar que la nota existe y el usuario tiene permisos
        const getCommand = new GetCommand({
            TableName: TABLE_NAME,
            Key: {
                PK: `NOTE#${noteId}`,
                SK: 'METADATA'
            }
        });
        
        const existingNote = await docClient.send(getCommand);
        
        if (!existingNote.Item) {
            return createResponse(404, { error: 'Nota no encontrada' });
        }
        
        if (!canEditNote(existingNote.Item, userInfo)) {
            return createResponse(403, { error: 'Sin permisos para editar esta nota' });
        }
        
        // Construir expression de actualización
        const updateExpressions = [];
        const expressionAttributeValues = {};
        
        if (body.contenido) {
            updateExpressions.push('contenido_original = :contenido');
            updateExpressions.push('contenido_procesado = :contenido_procesado');
            updateExpressions.push('palabras_clave = :palabras_clave');
            expressionAttributeValues[':contenido'] = body.contenido;
            expressionAttributeValues[':contenido_procesado'] = limpiarTexto(body.contenido);
            expressionAttributeValues[':palabras_clave'] = extraerPalabrasClave(body.contenido);
        }
        
        if (body.diagnosticos) {
            updateExpressions.push('diagnosticos = :diagnosticos');
            expressionAttributeValues[':diagnosticos'] = body.diagnosticos;
        }
        
        if (body.medicamentos) {
            updateExpressions.push('medicamentos = :medicamentos');
            expressionAttributeValues[':medicamentos'] = body.medicamentos;
        }
        
        if (body.tipo_nota) {
            updateExpressions.push('tipo_nota = :tipo_nota');
            expressionAttributeValues[':tipo_nota'] = body.tipo_nota;
        }
        
        // Agregar metadatos de actualización
        updateExpressions.push('fecha_actualizacion = :fecha_actualizacion');
        updateExpressions.push('usuario_actualizacion = :usuario_actualizacion');
        expressionAttributeValues[':fecha_actualizacion'] = new Date().toISOString();
        expressionAttributeValues[':usuario_actualizacion'] = userInfo.username;
        
        const updateCommand = new UpdateCommand({
            TableName: TABLE_NAME,
            Key: {
                PK: `NOTE#${noteId}`,
                SK: 'METADATA'
            },
            UpdateExpression: `SET ${updateExpressions.join(', ')}`,
            ExpressionAttributeValues: expressionAttributeValues,
            ReturnValues: 'ALL_NEW'
        });
        
        const result = await docClient.send(updateCommand);
        
        return createResponse(200, {
            message: 'Nota actualizada exitosamente',
            nota: formatNoteForResponse(result.Attributes)
        });
        
    } catch (error) {
        console.error('Error actualizando nota:', error);
        return createResponse(500, { error: 'Error actualizando nota' });
    }
}

/**
 * Elimina una nota
 */
async function deleteNote(noteId, userInfo) {
    try {
        // Verificar permisos (solo admin puede eliminar)
        if (!isAdmin(userInfo)) {
            return createResponse(403, { error: 'Solo administradores pueden eliminar notas' });
        }
        
        const command = new DeleteCommand({
            TableName: TABLE_NAME,
            Key: {
                PK: `NOTE#${noteId}`,
                SK: 'METADATA'
            },
            ConditionExpression: 'attribute_exists(PK)'
        });
        
        await docClient.send(command);
        
        return createResponse(200, {
            message: 'Nota eliminada exitosamente'
        });
        
    } catch (error) {
        if (error.name === 'ConditionalCheckFailedException') {
            return createResponse(404, { error: 'Nota no encontrada' });
        }
        
        console.error('Error eliminando nota:', error);
        return createResponse(500, { error: 'Error eliminando nota' });
    }
}

/**
 * Búsqueda avanzada de notas
 */
async function searchNotes(body, userInfo) {
    try {
        const { 
            query, 
            filtros = {}, 
            limit = 20,
            include_content = false 
        } = body;
        
        if (!query || query.trim().length < 3) {
            return createResponse(400, { 
                error: 'Query de búsqueda debe tener al menos 3 caracteres' 
            });
        }
        
        // Búsqueda por palabras clave
        const searchTerms = query.toLowerCase().split(/\s+/);
        
        let scanCommand = new ScanCommand({
            TableName: TABLE_NAME,
            FilterExpression: 'begins_with(PK, :pk_prefix)',
            ExpressionAttributeValues: {
                ':pk_prefix': 'NOTE#'
            },
            Limit: parseInt(limit) * 3 // Buscar más para filtrar después
        });
        
        // Agregar filtros adicionales
        const filterExpressions = ['begins_with(PK, :pk_prefix)'];
        
        if (filtros.especialidad) {
            filterExpressions.push('especialidad = :especialidad');
            scanCommand.ExpressionAttributeValues[':especialidad'] = filtros.especialidad;
        }
        
        if (filtros.fecha_desde) {
            filterExpressions.push('fecha_nota >= :fecha_desde');
            scanCommand.ExpressionAttributeValues[':fecha_desde'] = filtros.fecha_desde;
        }
        
        if (filtros.fecha_hasta) {
            filterExpressions.push('fecha_nota <= :fecha_hasta');
            scanCommand.ExpressionAttributeValues[':fecha_hasta'] = filtros.fecha_hasta;
        }
        
        scanCommand.FilterExpression = filterExpressions.join(' AND ');
        
        const result = await docClient.send(scanCommand);
        
        // Filtrar y puntuar resultados
        const scoredResults = [];
        
        if (result.Items) {
            for (const item of result.Items) {
                if (!canAccessNote(item, userInfo)) continue;
                
                const score = calculateRelevanceScore(item, searchTerms);
                if (score > 0) {
                    scoredResults.push({
                        ...formatNoteForResponse(item, include_content),
                        relevance_score: score
                    });
                }
            }
        }
        
        // Ordenar por relevancia y limitar resultados
        scoredResults.sort((a, b) => b.relevance_score - a.relevance_score);
        const finalResults = scoredResults.slice(0, parseInt(limit));
        
        return createResponse(200, {
            query: query,
            resultados: finalResults,
            total_encontrados: finalResults.length,
            tiempo_busqueda: Date.now() // Simple timestamp
        });
        
    } catch (error) {
        console.error('Error en búsqueda:', error);
        return createResponse(500, { error: 'Error ejecutando búsqueda' });
    }
}

/**
 * Genera URL presignada para subir CSV
 */
async function generatePresignedUploadUrl(body, userInfo) {
    try {
        const { filename } = body;
        
        if (!filename || !filename.endsWith('.csv')) {
            return createResponse(400, { 
                error: 'Nombre de archivo requerido y debe ser .csv' 
            });
        }
        
        const fileKey = `uploads/${userInfo.username}/${Date.now()}-${filename}`;
        
        const command = new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: fileKey,
            ContentType: 'text/csv',
            Metadata: {
                'uploaded-by': userInfo.username,
                'upload-date': new Date().toISOString()
            }
        });
        
        const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 }); // 1 hora
        
        return createResponse(200, {
            upload_url: presignedUrl,
            file_key: fileKey,
            expires_in: 3600
        });
        
    } catch (error) {
        console.error('Error generando URL presignada:', error);
        return createResponse(500, { error: 'Error generando URL de carga' });
    }
}

/**
 * Obtiene estadísticas para dashboard
 */
async function getDashboardStats(userInfo) {
    try {
        // Escanear para obtener estadísticas básicas
        const scanCommand = new ScanCommand({
            TableName: TABLE_NAME,
            FilterExpression: 'begins_with(PK, :pk_prefix)',
            ExpressionAttributeValues: {
                ':pk_prefix': 'NOTE#'
            },
            ProjectionExpression: 'especialidad, medico, fecha_nota, estado'
        });
        
        const result = await docClient.send(scanCommand);
        
        if (!result.Items) {
            return createResponse(200, { estadisticas: {} });
        }
        
        // Calcular estadísticas
        const stats = {
            total_notas: result.Items.length,
            notas_por_especialidad: {},
            notas_por_medico: {},
            notas_por_mes: {},
            estados: {}
        };
        
        for (const item of result.Items) {
            if (!canAccessNote(item, userInfo)) continue;
            
            // Por especialidad
            stats.notas_por_especialidad[item.especialidad] = 
                (stats.notas_por_especialidad[item.especialidad] || 0) + 1;
            
            // Por médico
            stats.notas_por_medico[item.medico] = 
                (stats.notas_por_medico[item.medico] || 0) + 1;
            
            // Por mes
            const mes = item.fecha_nota ? item.fecha_nota.substring(0, 7) : 'desconocido';
            stats.notas_por_mes[mes] = (stats.notas_por_mes[mes] || 0) + 1;
            
            // Por estado
            stats.estados[item.estado] = (stats.estados[item.estado] || 0) + 1;
        }
        
        return createResponse(200, { estadisticas: stats });
        
    } catch (error) {
        console.error('Error obteniendo estadísticas:', error);
        return createResponse(500, { error: 'Error obteniendo estadísticas' });
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
        hospital: claims['custom:hospital'] || '',
        rol: claims['custom:rol'] || 'medico'
    };
}

/**
 * Verifica si el usuario puede acceder a una nota
 */
function canAccessNote(note, userInfo) {
    // Admin puede ver todo
    if (isAdmin(userInfo)) return true;
    
    // El creador puede ver sus notas
    if (note.usuario_creacion === userInfo.username) return true;
    
    // Médicos pueden ver notas de su especialidad
    if (note.especialidad === userInfo.especialidad) return true;
    
    // En el futuro: implementar lógica más compleja
    return true; // Por ahora, acceso general
}

/**
 * Verifica si el usuario puede editar una nota
 */
function canEditNote(note, userInfo) {
    // Admin puede editar todo
    if (isAdmin(userInfo)) return true;
    
    // El creador puede editar sus notas
    if (note.usuario_creacion === userInfo.username) return true;
    
    return false;
}

/**
 * Verifica si el usuario es administrador
 */
function isAdmin(userInfo) {
    return userInfo.groups.includes('Administradores') || 
           userInfo.rol === 'admin';
}

/**
 * Calcula score de relevancia para búsqueda
 */
function calculateRelevanceScore(note, searchTerms) {
    let score = 0;
    const searchText = [
        note.contenido_procesado || '',
        note.diagnosticos?.join(' ') || '',
        note.medicamentos?.join(' ') || '',
        note.palabras_clave?.join(' ') || ''
    ].join(' ').toLowerCase();
    
    for (const term of searchTerms) {
        if (term.length < 3) continue;
        
        // Coincidencia exacta vale más
        const exactMatches = (searchText.match(new RegExp(term, 'g')) || []).length;
        score += exactMatches * 10;
        
        // Coincidencia parcial
        const partialMatches = (searchText.match(new RegExp(term.substring(0, term.length - 1), 'g')) || []).length;
        score += partialMatches * 5;
    }
    
    return score;
}

/**
 * Formatea nota para respuesta
 */
function formatNoteForResponse(note, includeContent = true) {
    const formatted = {
        id: note.id,
        paciente_id: note.paciente_id,
        fecha_nota: note.fecha_nota,
        medico: note.medico,
        especialidad: note.especialidad,
        tipo_nota: note.tipo_nota,
        diagnosticos: note.diagnosticos || [],
        medicamentos: note.medicamentos || [],
        palabras_clave: note.palabras_clave || [],
        fecha_carga: note.fecha_carga,
        estado: note.estado
    };
    
    if (includeContent) {
        formatted.contenido = note.contenido_original;
        formatted.resumen_ia = note.resumen_ia;
    }
    
    return formatted;
}

/**
 * Limpia texto
 */
function limpiarTexto(texto) {
    if (!texto) return '';
    
    return String(texto)
        .replace(/\s+/g, ' ')
        .replace(/[^\w\sáéíóúñüÁÉÍÓÚÑÜ.,;:()\-]/g, '')
        .trim();
}

/**
 * Extrae palabras clave
 */
function extraerPalabrasClave(contenido) {
    if (!contenido) return [];
    
    const palabrasComunes = new Set(['el', 'la', 'de', 'que', 'y', 'a', 'en', 'un', 'es', 'se', 'no', 'te', 'lo', 'le', 'da', 'su', 'por', 'son', 'con', 'para', 'al', 'del', 'los', 'las', 'una', 'nos', 'me', 'mi', 'si', 'ya', 'muy', 'más', 'pero', 'todo', 'sin', 'dos', 'bien', 'hacer', 'como', 'va', 'vez', 'vida', 'día', 'otro', 'ser', 'sobre', 'este', 'esta', 'sus', 'tiene', 'años', 'puede', 'cada', 'entre', 'durante', 'hace', 'había', 'hasta', 'donde', 'fue', 'sido']);
    
    return contenido
        .toLowerCase()
        .split(/\W+/)
        .filter(palabra => palabra.length > 3 && !palabrasComunes.has(palabra))
        .slice(0, 20);
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