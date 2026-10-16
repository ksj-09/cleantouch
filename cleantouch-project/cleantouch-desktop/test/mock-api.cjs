const http = require('node:http');

function createMockServer() { return http.createServer((request, response) => {
  response.setHeader('content-type', 'application/json; charset=utf-8');
  if (request.url === '/health') {
    response.end(JSON.stringify({ ok: true, providerConfigured: true, provider: 'gemini', model: 'smoke-test' }));
    return;
  }
  if (request.url === '/v1/scans' && request.method === 'POST') {
    let size = 0;
    request.on('data', chunk => { size += chunk.length; });
    request.on('end', () => {
      if (size < 1000) { response.statusCode = 400; response.end(JSON.stringify({ message: '이미지가 비어 있어요.' })); return; }
      response.end(JSON.stringify({ products: [{
        id: 'mock-product', label: '테스트 상품', box: [0.25, 0.25, 0.75, 0.75],
        matches: [{ source: '테스트 쇼핑', url: 'https://example.com/search?q=clean-touch' }],
      }] }));
    });
    return;
  }
  response.statusCode = 404;
  response.end(JSON.stringify({ message: 'Not found' }));
}); }

module.exports = { createMockServer };
if (require.main === module) createMockServer().listen(8791, '127.0.0.1', () => console.log('Mock CleanTouch API: http://127.0.0.1:8791'));
