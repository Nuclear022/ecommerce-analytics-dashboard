const http = require('http');

const data = JSON.stringify({
    username: "admin",
    password: "password123"
});

const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/register',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
    }
};

const req = http.request(options, (res) => {
    let responseBody = '';
    res.on('data', (chunk) => { responseBody += chunk; });
    res.on('end', () => {
        console.log('Respuesta del servidor:', JSON.parse(responseBody));
    });
});

req.on('error', (error) => {
    console.error('Error conectando a la API:', error.message);
});

req.write(data);
req.end();