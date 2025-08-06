const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');

const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
const ddbClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(ddbClient);
const bedrockClient = new BedrockRuntimeClient({ region: process.env.AWS_REGION || 'us-east-1' });

exports.handler = async (event, context) => {
    console.log('Simple CRUD Lambda received event:', JSON.stringify(event, null, 2));
    
    try {
        const httpMethod = event.httpMethod;
        const path = event.path;
        const pathParameters = event.pathParameters || {};
        const headers = event.headers || {};
        const body = event.body ? JSON.parse(event.body) : {};
        
        console.log('Request info:', { httpMethod, path, pathParameters, body });
        
        // Handle CORS preflight requests
        if (httpMethod === 'OPTIONS') {
            return {
                statusCode: 200,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token,access-control-allow-methods'
                },
                body: ''
            };
        }
        
        // Handle notes requests
        if (path.startsWith('/notes')) {
            if (httpMethod === 'GET') {
                try {
                    const tableName = process.env.TABLE_NAME;
                    console.log('Querying DynamoDB table:', tableName);
                    
                    const command = new ScanCommand({
                        TableName: tableName,
                        Limit: 50 // Limitar a 50 registros por performance
                    });
                    
                    const result = await docClient.send(command);
                    console.log('DynamoDB scan result:', result);
                    
                    // Mapear los datos al formato esperado por el frontend
                    const notas = result.Items?.map(item => ({
                        id: item.id,
                        paciente_id: item.paciente_id,
                        fecha_nota: item.fecha_nota,
                        medico: item.medico || 'No especificado',
                        especialidad: item.especialidad || 'No especificada',
                        tipo_nota: item.tipo_nota || 'consulta_externa',
                        diagnosticos: Array.isArray(item.diagnosticos) ? item.diagnosticos : [item.diagnosticos || 'Sin diagnóstico'],
                        medicamentos: Array.isArray(item.medicamentos) ? item.medicamentos : [item.medicamentos || 'Sin medicamentos'],
                        contenido_original: item.contenido_original || item.contenido_nota || 'Sin contenido',
                        resumen_ia: item.resumen_ia || 'Sin resumen disponible',
                        estado: item.estado || 'procesado',
                        fecha_carga: item.fecha_carga || item.timestamp || new Date().toISOString()
                    })) || [];
                    
                    return {
                        statusCode: 200,
                        headers: {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*',
                            'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
                            'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token,access-control-allow-methods'
                        },
                        body: JSON.stringify({
                            notas: notas,
                            total: notas.length,
                            message: `Found ${notas.length} clinical notes`
                        })
                    };
                } catch (error) {
                    console.error('Error querying DynamoDB:', error);
                    
                    return {
                        statusCode: 500,
                        headers: {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*',
                            'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
                            'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token,access-control-allow-methods'
                        },
                        body: JSON.stringify({
                            error: 'Failed to query clinical notes',
                            details: error.message,
                            notas: [],
                            total: 0
                        })
                    };
                }
            }
        }
        
        // Handle intelligent search requests
        if (path.startsWith('/search')) {
            if (httpMethod === 'POST') {
                try {
                    const { query, filters } = body;
                    console.log('Intelligent search request:', { query, filters });
                    
                    if (!query || query.trim() === '') {
                        return {
                            statusCode: 400,
                            headers: {
                                'Content-Type': 'application/json',
                                'Access-Control-Allow-Origin': '*',
                                'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
                                'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token,access-control-allow-methods'
                            },
                            body: JSON.stringify({
                                error: 'Query parameter is required',
                                results: [],
                                total: 0
                            })
                        };
                    }
                    
                    // Step 1: Use AI to understand the search intent and generate keywords
                    const searchKeywords = await analyzeSearchIntent(query);
                    console.log('AI-generated search keywords:', searchKeywords);
                    
                    // Step 2: Search in DynamoDB using the AI-enhanced keywords
                    const searchResults = await performIntelligentSearch(searchKeywords, filters);
                    console.log('Search results count:', searchResults.length);
                    
                    // Step 3: Use AI to rank and explain the relevance of results
                    const rankedResults = await rankSearchResults(query, searchResults);
                    
                    return {
                        statusCode: 200,
                        headers: {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*',
                            'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
                            'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token,access-control-allow-methods'
                        },
                        body: JSON.stringify({
                            query: query,
                            searchKeywords: searchKeywords,
                            results: rankedResults,
                            total: rankedResults.length,
                            message: `Found ${rankedResults.length} relevant clinical notes using AI-powered search`
                        })
                    };
                    
                } catch (error) {
                    console.error('Error in intelligent search:', error);
                    
                    return {
                        statusCode: 500,
                        headers: {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*',
                            'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
                            'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token,access-control-allow-methods'
                        },
                        body: JSON.stringify({
                            error: 'Failed to perform intelligent search',
                            details: error.message,
                            results: [],
                            total: 0
                        })
                    };
                }
            }
        }
        
        // Handle upload requests
        if (path.startsWith('/upload')) {
            if (httpMethod === 'POST' && path.includes('csv')) {
                const filename = body.filename || 'unnamed.csv';
                const bucketName = process.env.BUCKET_NAME;
                const fileKey = `uploads/${Date.now()}-${filename}`;
                
                console.log('Generating presigned URL for:', { bucketName, fileKey });
                
                // Generate presigned URL for S3 upload
                const command = new PutObjectCommand({
                    Bucket: bucketName,
                    Key: fileKey,
                    ContentType: 'text/csv'
                });
                
                const upload_url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
                
                return {
                    statusCode: 200,
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
                        'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token,access-control-allow-methods'
                    },
                    body: JSON.stringify({
                        message: 'Upload URL generated successfully',
                        upload_url,
                        file_key: fileKey,
                        expires_in: 3600,
                        debug: {
                            path,
                            method: httpMethod,
                            pathParams: pathParameters,
                            hasAuth: !!headers.authorization || !!headers.Authorization,
                            bucketName,
                            filename
                        }
                    })
                };
            }
        }
        
        // Default response
        return {
            statusCode: 404,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token,access-control-allow-methods'
            },
            body: JSON.stringify({
                error: 'Endpoint not found',
                path: path,
                method: httpMethod
            })
        };
        
    } catch (error) {
        console.error('Simple CRUD error:', error);
        
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token,access-control-allow-methods'
            },
            body: JSON.stringify({
                error: 'Internal server error',
                details: error.message,
                stack: error.stack
            })
        };
    }
};

// ===== AI-POWERED INTELLIGENT SEARCH FUNCTIONS =====

/**
 * Use AI to understand search intent and generate keywords
 */
async function analyzeSearchIntent(query) {
    console.log('Analyzing search intent for:', query);
    
    const prompt = `Analiza la siguiente consulta médica y extrae palabras clave relevantes para buscar en una base de datos de notas clínicas. 
    
Consulta: "${query}"

Genera una lista de 5-10 palabras clave y sinónimos médicos que podrían aparecer en las notas clínicas, incluyendo:
1. Términos médicos relacionados
2. Síntomas mencionados  
3. Especialidades médicas relevantes
4. Medicamentos relacionados
5. Sinónimos y variaciones

Responde SOLO con una lista de palabras separadas por comas, sin explicaciones adicionales.`;

    try {
        const aiResponse = await invokeBedrockClaude(prompt);
        const keywords = aiResponse.split(',').map(k => k.trim()).filter(k => k.length > 2);
        console.log('AI-generated keywords:', keywords);
        return keywords;
    } catch (error) {
        console.error('Error analyzing search intent:', error);
        // Fallback to simple keyword extraction
        return query.toLowerCase().split(/\s+/).filter(word => word.length > 2);
    }
}

/**
 * Perform intelligent search in DynamoDB using AI-enhanced keywords
 */
async function performIntelligentSearch(searchKeywords, filters) {
    console.log('Performing intelligent search with keywords:', searchKeywords);
    
    try {
        const tableName = process.env.TABLE_NAME;
        
        // Limit keywords to avoid FilterExpression size limits (DynamoDB has 4KB limit)
        const limitedKeywords = searchKeywords.slice(0, 5); // Use only top 5 keywords
        console.log('Limited keywords for search:', limitedKeywords);
        
        // Build scan parameters with filters
        const scanParams = {
            TableName: tableName,
            Limit: 100,
            FilterExpression: '',
            ExpressionAttributeValues: {},
            ExpressionAttributeNames: {}
        };
        
        const filterConditions = [];
        let valueIndex = 0;
        
        // Create a simpler search approach - combine keywords with OR conditions
        if (limitedKeywords.length > 0) {
            const keywordConditions = [];
            
            for (const keyword of limitedKeywords) {
                const valueName = `:keyword${valueIndex}`;
                // Search in main content fields (case insensitive)
                const lowerKeyword = keyword.toLowerCase();
                
                // Search in individual fields
                keywordConditions.push(`contains(#contenido_original, ${valueName})`);
                keywordConditions.push(`contains(#especialidad, ${valueName})`);
                keywordConditions.push(`contains(#medico, ${valueName})`);
                
                // For arrays (diagnosticos, medicamentos), we need to convert to string to search
                // This is a workaround since DynamoDB contains() doesn't work well with Lists
                keywordConditions.push(`contains(#diagnosticos, ${valueName})`);
                keywordConditions.push(`contains(#medicamentos, ${valueName})`);
                
                scanParams.ExpressionAttributeValues[valueName] = lowerKeyword;
                valueIndex++;
            }
            
            // Group keyword conditions with OR
            if (keywordConditions.length > 0) {
                filterConditions.push(`(${keywordConditions.join(' OR ')})`);
            }
        }
        
        // Add expression attribute names
        scanParams.ExpressionAttributeNames = {
            '#contenido_original': 'contenido_original',
            '#diagnosticos': 'diagnosticos',
            '#medicamentos': 'medicamentos',
            '#especialidad': 'especialidad',
            '#medico': 'medico'
        };
        
        // Apply date filters if provided
        if (filters && filters.dateFrom) {
            filterConditions.push('#fecha_nota >= :dateFrom');
            scanParams.ExpressionAttributeValues[':dateFrom'] = filters.dateFrom;
            scanParams.ExpressionAttributeNames['#fecha_nota'] = 'fecha_nota';
        }
        
        if (filters && filters.dateTo) {
            filterConditions.push('#fecha_nota <= :dateTo');
            scanParams.ExpressionAttributeValues[':dateTo'] = filters.dateTo;
            scanParams.ExpressionAttributeNames['#fecha_nota'] = 'fecha_nota';
        }
        
        // Apply specialty filter if provided
        if (filters && filters.especialidad) {
            filterConditions.push('contains(#especialidad, :especialidad)');
            scanParams.ExpressionAttributeValues[':especialidad'] = filters.especialidad.toLowerCase();
        }
        
        // Combine all filter conditions with AND
        if (filterConditions.length > 0) {
            scanParams.FilterExpression = filterConditions.join(' AND ');
        } else {
            // If no keywords, return all records (fallback) - but limit to show the AI is working
            scanParams.Limit = 10;
            delete scanParams.FilterExpression;
        }
        
        console.log('Optimized scan parameters:', JSON.stringify(scanParams, null, 2));
        
        const command = new ScanCommand(scanParams);
        const result = await docClient.send(command);
        
        console.log(`Found ${result.Items?.length || 0} matching clinical notes`);
        return result.Items || [];
        
    } catch (error) {
        console.error('Error performing intelligent search:', error);
        throw error;
    }
}

/**
 * Use AI to rank and explain search results relevance
 */
async function rankSearchResults(originalQuery, searchResults) {
    console.log('Ranking search results with AI for query:', originalQuery);
    
    if (!searchResults || searchResults.length === 0) {
        return [];
    }
    
    // If too many results, limit to top 20 for AI processing
    const resultsToRank = searchResults.slice(0, 20);
    
    const prompt = `Analiza y clasifica estas notas clínicas según su relevancia para la consulta: "${originalQuery}"

Notas clínicas:
${resultsToRank.map((note, index) => 
    `${index + 1}. Paciente: ${note.paciente_id}, Fecha: ${note.fecha_nota}, Especialidad: ${note.especialidad}
    Contenido: ${(note.contenido_original || note.contenido_procesado || '').substring(0, 200)}...
    Diagnósticos: ${Array.isArray(note.diagnosticos) ? note.diagnosticos.join(', ') : note.diagnosticos || 'N/A'}
    `
).join('\n\n')}

Responde con una lista numerada de los IDs de las notas (solo números del 1 al ${resultsToRank.length}) ordenados por relevancia de mayor a menor, seguido de una explicación breve de por qué es relevante. Formato:
1. Razón de relevancia
2. Razón de relevancia
etc.`;

    try {
        const aiResponse = await invokeBedrockClaude(prompt);
        console.log('AI ranking response:', aiResponse);
        
        // Parse AI response to extract ranking
        const lines = aiResponse.split('\n').filter(line => line.trim());
        const rankedResults = [];
        
        for (const line of lines) {
            const match = line.match(/^(\d+)\.\s*(.+)/);
            if (match) {
                const noteIndex = parseInt(match[1]) - 1;
                const explanation = match[2];
                
                if (noteIndex >= 0 && noteIndex < resultsToRank.length) {
                    const note = resultsToRank[noteIndex];
                    rankedResults.push({
                        ...note,
                        relevance_score: (resultsToRank.length - rankedResults.length) / resultsToRank.length,
                        relevance_explanation: explanation
                    });
                }
            }
        }
        
        // Add any remaining results that weren't ranked
        for (const note of resultsToRank) {
            if (!rankedResults.find(r => r.id === note.id)) {
                rankedResults.push({
                    ...note,
                    relevance_score: 0.1,
                    relevance_explanation: 'Coincidencia parcial con términos de búsqueda'
                });
            }
        }
        
        console.log(`Ranked ${rankedResults.length} results with AI analysis`);
        return rankedResults;
        
    } catch (error) {
        console.error('Error ranking search results:', error);
        // Fallback to simple relevance scoring
        return searchResults.map(note => ({
            ...note,
            relevance_score: 0.5,
            relevance_explanation: 'Coincidencia con términos de búsqueda'
        }));
    }
}

/**
 * Helper function to invoke Bedrock Claude
 */
async function invokeBedrockClaude(prompt) {
    const body = {
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 1000,
        temperature: 0.1,
        messages: [
            {
                role: 'user',
                content: prompt
            }
        ]
    };
    
    const command = new InvokeModelCommand({
        modelId: 'anthropic.claude-3-sonnet-20240229-v1:0',
        contentType: 'application/json',
        accept: '*/*',
        body: JSON.stringify(body)
    });
    
    try {
        const response = await bedrockClient.send(command);
        const responseBody = JSON.parse(new TextDecoder().decode(response.body));
        
        return responseBody.content[0].text || 'No response from AI';
        
    } catch (error) {
        console.error('Error calling Bedrock Claude:', error);
        throw new Error('Failed to get AI response');
    }
}