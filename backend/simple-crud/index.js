const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand } = require('@aws-sdk/lib-dynamodb');

const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
const ddbClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(ddbClient);

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