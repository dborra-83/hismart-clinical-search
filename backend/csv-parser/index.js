const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
const csv = require('csv-parser');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const { Readable } = require('stream');

// Configuración de clientes AWS
const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const s3Client = new S3Client({ region: process.env.AWS_REGION });
const bedrockClient = new BedrockRuntimeClient({ region: process.env.BEDROCK_REGION || process.env.AWS_REGION });

// Variables de entorno
const TABLE_NAME = process.env.TABLE_NAME;
const BUCKET_NAME = process.env.BUCKET_NAME;
const BEDROCK_MODEL_ID = 'anthropic.claude-3-sonnet-20240229-v1:0';

/**
 * Handler principal de Lambda
 */
exports.handler = async (event, context) => {
    console.log('CSV Parser Lambda iniciado:', JSON.stringify(event, null, 2));
    
    try {
        // Procesar cada record del evento S3
        const results = [];
        
        for (const record of event.Records) {
            if (record.eventSource === 'aws:s3' && record.eventName.startsWith('ObjectCreated')) {
                const bucketName = record.s3.bucket.name;
                const objectKey = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));
                
                console.log(`Procesando archivo: ${objectKey} del bucket: ${bucketName}`);
                
                const result = await processCsvFile(bucketName, objectKey);
                results.push(result);
            }
        }
        
        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Archivos CSV procesados exitosamente',
                results: results
            })
        };
        
    } catch (error) {
        console.error('Error en CSV Parser Lambda:', error);
        
        return {
            statusCode: 500,
            body: JSON.stringify({
                error: 'Error procesando archivos CSV',
                details: error.message
            })
        };
    }
};

/**
 * Procesa un archivo CSV desde S3
 */
async function processCsvFile(bucketName, objectKey) {
    try {
        console.log(`Descargando archivo CSV: ${objectKey}`);
        
        // Descargar archivo de S3
        const command = new GetObjectCommand({
            Bucket: bucketName,
            Key: objectKey
        });
        
        const response = await s3Client.send(command);
        const csvContent = await streamToString(response.Body);
        
        // Parsear CSV
        const csvData = await parseCsvContent(csvContent);
        
        if (csvData.length < 1) {
            throw new Error('El archivo CSV debe tener al menos una fila de datos además del encabezado');
        }
        
        console.log(`Procesando ${csvData.length} filas de datos CSV`);
        
        // Obtener encabezados del primer objeto
        const headers = Object.keys(csvData[0]);
        console.log('Encabezados encontrados:', headers);
        
        // Mapear columnas esperadas
        const columnMapping = mapCsvColumns(headers);
        console.log('Mapeo de columnas:', columnMapping);
        
        const processedNotes = [];
        const errors = [];
        
        // Procesar cada fila
        for (let i = 0; i < csvData.length; i++) {
            try {
                const row = csvData[i];
                const noteData = await processCsvRow(row, columnMapping, objectKey, i + 2); // +2 porque empezamos en fila 2
                
                if (noteData) {
                    processedNotes.push(noteData);
                }
                
            } catch (error) {
                console.error(`Error procesando fila ${i + 2}:`, error);
                errors.push({
                    row: i + 2,
                    data: csvData[i],
                    error: error.message
                });
            }
        }
        
        console.log(`Procesamiento completado: ${processedNotes.length} notas exitosas, ${errors.length} errores`);
        
        return {
            file: objectKey,
            processed: processedNotes.length,
            errors: errors.length,
            errorDetails: errors
        };
        
    } catch (error) {
        console.error(`Error procesando archivo ${objectKey}:`, error);
        throw error;
    }
}

/**
 * Detecta automáticamente el separador CSV
 */
function detectCsvSeparator(csvContent) {
    const lines = csvContent.split('\n').slice(0, 3); // Analizar primeras 3 líneas
    const separators = [',', ';', '\t', '|'];
    
    for (const separator of separators) {
        let consistentCount = null;
        let isConsistent = true;
        
        for (const line of lines) {
            if (line.trim() === '') continue;
            
            const count = line.split(separator).length - 1;
            if (consistentCount === null) {
                consistentCount = count;
            } else if (count !== consistentCount || count === 0) {
                isConsistent = false;
                break;
            }
        }
        
        if (isConsistent && consistentCount > 0) {
            console.log(`Separador detectado: "${separator}" (${consistentCount} columnas)`);
            return separator;
        }
    }
    
    console.log('Separador no detectado, usando coma por defecto');
    return ',';
}

/**
 * Parsea el contenido CSV usando csv-parser con detección automática de separador
 */
function parseCsvContent(csvContent) {
    return new Promise((resolve, reject) => {
        const results = [];
        const separator = detectCsvSeparator(csvContent);
        const stream = Readable.from([csvContent]);
        
        console.log(`Usando separador: "${separator}"`);
        
        stream
            .pipe(csv({
                separator: separator,
                skipEmptyLines: true,
                trim: true
            }))
            .on('data', (data) => {
                // Limpiar datos de la fila
                const cleanedData = {};
                for (const [key, value] of Object.entries(data)) {
                    cleanedData[key.trim()] = value ? String(value).trim() : '';
                }
                results.push(cleanedData);
            })
            .on('end', () => {
                console.log(`CSV parseado exitosamente: ${results.length} filas con separador "${separator}"`);
                resolve(results);
            })
            .on('error', (error) => {
                console.error('Error parseando CSV:', error);
                reject(error);
            });
    });
}

/**
 * Mapea las columnas del CSV a nuestro esquema
 */
function mapCsvColumns(headers) {
    const mapping = {};
    
    // Mapeo flexible de columnas (case insensitive)
    const columnMappings = {
        'ID_Paciente': ['id_paciente', 'paciente_id', 'patient_id', 'id', 'id_pac', 'paciente'],
        'Fecha_Nota': ['fecha_nota', 'fecha', 'date', 'fecha_consulta', 'fecha_atencion'],
        'Medico': ['medico', 'doctor', 'physician', 'médico', 'profesional'],
        'Especialidad': ['especialidad', 'specialty', 'especiality', 'area'],
        'Tipo_Consulta': ['tipo_consulta', 'tipo', 'type', 'consultation_type', 'modalidad'],
        'Contenido_Nota': ['contenido_nota', 'nota', 'note', 'content', 'contenido', 'observaciones', 'descripcion'],
        'Diagnosticos': ['diagnosticos', 'diagnósticos', 'diagnosis', 'diagnostico', 'dx'],
        'Medicamentos': ['medicamentos', 'medications', 'drugs', 'fármacos', 'farmacos', 'tratamiento']
    };
    
    // Buscar cada columna en los headers (case insensitive)
    for (const [standardName, variations] of Object.entries(columnMappings)) {
        for (const header of headers) {
            const headerLower = header.toLowerCase().trim();
            
            if (variations.some(variation => 
                headerLower.includes(variation.toLowerCase()) || 
                variation.toLowerCase().includes(headerLower)
            )) {
                mapping[standardName] = header; // Usar el header original exacto
                break;
            }
        }
    }
    
    return mapping;
}

/**
 * Procesa una fila individual del CSV
 */
async function processCsvRow(row, columnMapping, sourceFile, rowNumber) {
    // Extraer datos de la fila usando el mapeo
    const pacienteId = getCsvValue(row, columnMapping.ID_Paciente);
    const fechaNota = getCsvValue(row, columnMapping.Fecha_Nota);
    const medico = getCsvValue(row, columnMapping.Medico);
    const especialidad = getCsvValue(row, columnMapping.Especialidad);
    const tipoConsulta = getCsvValue(row, columnMapping.Tipo_Consulta);
    const contenidoNota = getCsvValue(row, columnMapping.Contenido_Nota);
    const diagnosticos = getCsvValue(row, columnMapping.Diagnosticos);
    const medicamentos = getCsvValue(row, columnMapping.Medicamentos);
    
    // Validar campos obligatorios
    if (!pacienteId || !fechaNota || !contenidoNota) {
        throw new Error(`Campos obligatorios faltantes: pacienteId=${!!pacienteId}, fechaNota=${!!fechaNota}, contenidoNota=${!!contenidoNota}`);
    }
    
    // Generar ID único para la nota
    const noteId = uuidv4();
    const fechaNormalizada = normalizarFecha(fechaNota);
    
    // Verificar duplicados
    const isDuplicate = await checkForDuplicate(pacienteId, fechaNormalizada, contenidoNota);
    if (isDuplicate) {
        console.log(`Nota duplicada encontrada para paciente ${pacienteId} en fecha ${fechaNormalizada}, omitiendo...`);
        return null;
    }
    
    // Limpiar y procesar contenido
    const contenidoLimpio = limpiarTexto(contenidoNota);
    const palabrasClave = extraerPalabrasClave(contenidoLimpio);
    
    // Generar resumen con IA (opcional, puede fallar sin afectar el proceso)
    let resumenIA = '';
    try {
        resumenIA = await generarResumenIA(contenidoLimpio);
    } catch (error) {
        console.warn('Error generando resumen IA:', error.message);
    }
    
    // Crear objeto de nota clínica (schema simplificado)
    const notaClinica = {
        id: noteId,
        paciente_id: String(pacienteId),
        fecha_nota: fechaNormalizada,
        medico: medico || 'No especificado',
        especialidad: especialidad || 'General',
        tipo_nota: tipoConsulta || 'consulta_externa',
        contenido_original: contenidoNota,
        contenido_procesado: contenidoLimpio,
        diagnosticos: procesarListaSeparada(diagnosticos),
        medicamentos: procesarListaSeparada(medicamentos),
        palabras_clave: palabrasClave,
        resumen_ia: resumenIA,
        fuente_archivo: sourceFile,
        fila_origen: rowNumber,
        fecha_carga: new Date().toISOString(),
        estado: 'procesado',
        timestamp: new Date().toISOString()
    };
    
    // Guardar en DynamoDB
    await saveNoteToDynamoDB(notaClinica);
    
    console.log(`Nota procesada exitosamente: ${noteId} para paciente ${pacienteId}`);
    return notaClinica;
}

/**
 * Obtiene el valor de una columna del CSV
 */
function getCsvValue(row, columnName) {
    if (!columnName || !row.hasOwnProperty(columnName)) {
        return null;
    }
    
    const value = row[columnName];
    return value !== null && value !== undefined && String(value).trim() !== '' 
        ? String(value).trim() 
        : null;
}

/**
 * Normaliza fechas a formato ISO
 */
function normalizarFecha(fecha) {
    if (!fecha) return null;
    
    // Intentar varios formatos de fecha
    const formatos = [
        'YYYY-MM-DD',
        'DD/MM/YYYY',
        'MM/DD/YYYY',
        'DD-MM-YYYY',
        'YYYY/MM/DD',
        'DD.MM.YYYY',
        'YYYY.MM.DD'
    ];
    
    for (const formato of formatos) {
        const momentDate = moment(fecha, formato, true);
        if (momentDate.isValid()) {
            return momentDate.format('YYYY-MM-DD');
        }
    }
    
    // Intentar parseado automático con moment
    const autoDate = moment(fecha);
    if (autoDate.isValid() && autoDate.year() > 1900 && autoDate.year() < 2100) {
        return autoDate.format('YYYY-MM-DD');
    }
    
    throw new Error(`Formato de fecha no reconocido: ${fecha}`);
}

/**
 * Limpia y normaliza texto
 */
function limpiarTexto(texto) {
    if (!texto) return '';
    
    return String(texto)
        .replace(/\s+/g, ' ') // Normalizar espacios
        .replace(/[^\w\sáéíóúñüÁÉÍÓÚÑÜ.,;:()\-]/g, '') // Remover caracteres especiales
        .trim();
}

/**
 * Extrae palabras clave del contenido
 */
function extraerPalabrasClave(contenido) {
    if (!contenido) return [];
    
    const palabrasComunes = new Set([
        'el', 'la', 'de', 'que', 'y', 'a', 'en', 'un', 'es', 'se', 'no', 'te', 'lo', 'le', 'da', 'su', 'por', 'son', 'con', 'para', 'al', 'del', 'los', 'las', 'una', 'nos', 'me', 'mi', 'si', 'ya', 'muy', 'más', 'pero', 'todo', 'sin', 'dos', 'bien', 'hacer', 'como', 'va', 'vez', 'vida', 'día', 'otro', 'ser', 'sobre', 'este', 'esta', 'sus', 'tiene', 'años', 'puede', 'cada', 'entre', 'durante', 'hace', 'había', 'hasta', 'donde', 'fue', 'sido'
    ]);
    
    const palabras = contenido
        .toLowerCase()
        .split(/\W+/)
        .filter(palabra => palabra.length > 3 && !palabrasComunes.has(palabra))
        .slice(0, 20); // Limitar a 20 palabras clave
    
    return [...new Set(palabras)]; // Remover duplicados
}

/**
 * Procesa listas separadas por ; o ,
 */
function procesarListaSeparada(texto) {
    if (!texto) return [];
    
    return String(texto)
        .split(/[;,\|]/) // Agregar | como separador adicional
        .map(item => item.trim())
        .filter(item => item.length > 0);
}

/**
 * Verifica duplicados en DynamoDB
 */
async function checkForDuplicate(pacienteId, fecha, contenido) {
    try {
        const command = new QueryCommand({
            TableName: TABLE_NAME,
            IndexName: 'paciente-index',
            KeyConditionExpression: 'paciente_id = :paciente_id',
            FilterExpression: 'fecha_nota = :fecha_nota',
            ExpressionAttributeValues: {
                ':paciente_id': String(pacienteId),
                ':fecha_nota': fecha
            }
        });
        
        const result = await docClient.send(command);
        
        // Si hay notas en la misma fecha, verificar contenido similar
        if (result.Items && result.Items.length > 0) {
            for (const item of result.Items) {
                if (calcularSimilitudTexto(contenido, item.contenido_original) > 0.8) {
                    return true; // Es duplicado
                }
            }
        }
        
        return false;
        
    } catch (error) {
        console.warn('Error verificando duplicados:', error);
        return false; // En caso de error, proceder con la inserción
    }
}

/**
 * Calcula similitud entre dos textos (algoritmo simple)
 */
function calcularSimilitudTexto(texto1, texto2) {
    if (!texto1 || !texto2) return 0;
    
    const palabras1 = new Set(texto1.toLowerCase().split(/\W+/));
    const palabras2 = new Set(texto2.toLowerCase().split(/\W+/));
    
    const interseccion = new Set([...palabras1].filter(x => palabras2.has(x)));
    const union = new Set([...palabras1, ...palabras2]);
    
    return interseccion.size / union.size;
}

/**
 * Genera resumen usando Bedrock Claude
 */
async function generarResumenIA(contenido) {
    if (!contenido || contenido.length < 50) {
        return 'Contenido insuficiente para generar resumen';
    }
    
    const prompt = `Analiza la siguiente nota clínica y genera un resumen ejecutivo de máximo 150 palabras, enfocándote en:
1. Diagnóstico principal
2. Síntomas clave
3. Tratamiento recomendado
4. Seguimiento necesario

Nota clínica:
${contenido}

Resumen:`;
    
    const body = {
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 500,
        temperature: 0.1,
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
    
    try {
        const response = await bedrockClient.send(command);
        const responseBody = JSON.parse(new TextDecoder().decode(response.body));
        
        return responseBody.content[0].text || 'No se pudo generar resumen';
        
    } catch (error) {
        console.error('Error llamando a Bedrock:', error);
        throw new Error('Error generando resumen con IA');
    }
}

/**
 * Guarda nota en DynamoDB
 */
async function saveNoteToDynamoDB(notaClinica) {
    const command = new PutCommand({
        TableName: TABLE_NAME,
        Item: notaClinica,
        ConditionExpression: 'attribute_not_exists(id)' // Evitar sobrescribir usando id como PK
    });
    
    try {
        await docClient.send(command);
        console.log(`Nota guardada en DynamoDB: ${notaClinica.id}`);
        
    } catch (error) {
        if (error.name === 'ConditionalCheckFailedException') {
            console.warn(`Nota ya existe en DynamoDB: ${notaClinica.id}`);
        } else {
            console.error('Error guardando en DynamoDB:', error);
            throw error;
        }
    }
}

/**
 * Convierte stream a string
 */
async function streamToString(stream) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        stream.on('data', chunk => chunks.push(chunk));
        stream.on('error', reject);
        stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    });
}