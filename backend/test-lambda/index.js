exports.handler = async (event, context) => {
    console.log('Test Lambda received event:', JSON.stringify(event, null, 2));
    
    return {
        statusCode: 200,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type,Authorization'
        },
        body: JSON.stringify({
            message: 'Test Lambda is working!',
            timestamp: new Date().toISOString(),
            eventReceived: true,
            path: event.path,
            method: event.httpMethod
        })
    };
};