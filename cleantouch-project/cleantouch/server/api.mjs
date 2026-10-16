import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, appendFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const projectDirectory = dirname(currentDirectory);
const dataDirectory = join(projectDirectory, 'data');
const contentFile = join(dataDirectory, 'contents.json');
const analyticsFile = join(dataDirectory, 'analytics.ndjson');
const sdkFile = join(projectDirectory, 'dist-sdk', 'cleantouch.js');
const port = Number(process.env.CLEANTOUCH_API_PORT || 8787);
const studioKey = process.env.CLEANTOUCH_STUDIO_KEY || 'ct_demo_studio_key';

const seedContent = {
  'morrow-fall-026': {
    contentId: 'morrow-fall-026',
    title: '가을 데일리룩 01',
    published: true,
    updatedAt: new Date().toISOString(),
    products: [
      {
        id: 'bag-014',
        name: '시그니처 숄더백',
        price: 89000,
        currency: 'KRW',
        productUrl: 'https://shop.example.com/products/bag-014',
        activeFrom: 0,
        activeTo: 30,
        keyframes: [
          { time: 0, x: 50.8, y: 46.8, width: 36, height: 25.5 },
          { time: 30, x: 50.8, y: 46.8, width: 36, height: 25.5 }
        ]
      }
    ]
  }
};

await mkdir(dataDirectory, { recursive: true });
try {
  await readFile(contentFile, 'utf8');
} catch {
  await writeJson(contentFile, seedContent);
}

function setCors(response) {
  response.setHeader('access-control-allow-origin', '*');
  response.setHeader('access-control-allow-methods', 'GET, PUT, POST, OPTIONS');
  response.setHeader('access-control-allow-headers', 'content-type, x-cleantouch-key');
  response.setHeader('access-control-max-age', '86400');
}

function sendJson(response, status, body) {
  setCors(response);
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store'
  });
  response.end(JSON.stringify(body));
}

async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function readContents() {
  return JSON.parse(await readFile(contentFile, 'utf8'));
}

async function readBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 1_000_000) throw new Error('PAYLOAD_TOO_LARGE');
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function isValidProduct(product) {
  return product
    && typeof product.id === 'string'
    && typeof product.name === 'string'
    && Number.isFinite(product.price)
    && typeof product.productUrl === 'string'
    && Number.isFinite(product.activeFrom)
    && Number.isFinite(product.activeTo)
    && Array.isArray(product.keyframes)
    && product.keyframes.length > 0
    && product.keyframes.every((frame) => ['time', 'x', 'y', 'width', 'height'].every((key) => Number.isFinite(frame[key])));
}

function isAuthorized(request) {
  return request.headers['x-cleantouch-key'] === studioKey;
}

async function analyticsSummary(contentId) {
  let raw = '';
  try {
    raw = await readFile(analyticsFile, 'utf8');
  } catch {
    return { contentId, total: 0, counts: {}, events: [] };
  }
  const events = raw.trim().split('\n').filter(Boolean).flatMap((line) => {
    try { return [JSON.parse(line)]; } catch { return []; }
  }).filter((event) => event.contentId === contentId);
  const counts = events.reduce((result, event) => {
    result[event.type] = (result[event.type] || 0) + 1;
    return result;
  }, {});
  return { contentId, total: events.length, counts, events: events.slice(-20).reverse() };
}

const server = createServer(async (request, response) => {
  try {
    setCors(response);
    if (request.method === 'OPTIONS') {
      response.writeHead(204);
      response.end();
      return;
    }

    const url = new URL(request.url || '/', `http://${request.headers.host || '127.0.0.1'}`);

    if (request.method === 'GET' && url.pathname === '/health') {
      sendJson(response, 200, { ok: true, service: 'cleantouch-api', version: '0.3.0' });
      return;
    }

    if (request.method === 'GET' && url.pathname === '/v1/cleantouch.js') {
      const sdk = await readFile(sdkFile);
      response.writeHead(200, {
        'content-type': 'text/javascript; charset=utf-8',
        'cache-control': 'public, max-age=60',
        'access-control-allow-origin': '*'
      });
      response.end(sdk);
      return;
    }

    const contentMatch = url.pathname.match(/^\/v1\/content\/([a-zA-Z0-9_-]+)$/);
    if (contentMatch && request.method === 'GET') {
      const contentId = contentMatch[1];
      const content = (await readContents())[contentId];
      if (!content) {
        sendJson(response, 404, { error: 'CONTENT_NOT_FOUND' });
        return;
      }
      sendJson(response, 200, {
        contentId,
        published: content.published,
        updatedAt: content.updatedAt,
        products: content.published ? content.products : []
      });
      return;
    }

    if (contentMatch && request.method === 'PUT') {
      if (!isAuthorized(request)) {
        sendJson(response, 401, { error: 'INVALID_STUDIO_KEY' });
        return;
      }
      const body = await readBody(request);
      if (!Array.isArray(body.products) || !body.products.every(isValidProduct) || typeof body.published !== 'boolean') {
        sendJson(response, 400, { error: 'INVALID_CONTENT_DATA' });
        return;
      }
      const contentId = contentMatch[1];
      const contents = await readContents();
      contents[contentId] = {
        contentId,
        title: typeof body.title === 'string' ? body.title : contentId,
        published: body.published,
        updatedAt: new Date().toISOString(),
        products: body.products
      };
      await writeJson(contentFile, contents);
      sendJson(response, 200, contents[contentId]);
      return;
    }

    if (request.method === 'POST' && url.pathname === '/v1/events') {
      const event = await readBody(request);
      const allowedTypes = ['impression', 'product_select', 'add_to_cart', 'purchase_click', 'close'];
      if (!allowedTypes.includes(event.type) || typeof event.contentId !== 'string') {
        sendJson(response, 400, { error: 'INVALID_EVENT' });
        return;
      }
      const storedEvent = {
        type: event.type,
        contentId: event.contentId,
        productId: typeof event.productId === 'string' ? event.productId : undefined,
        videoTime: Number.isFinite(event.videoTime) ? event.videoTime : 0,
        occurredAt: typeof event.occurredAt === 'string' ? event.occurredAt : new Date().toISOString(),
        receivedAt: new Date().toISOString()
      };
      await appendFile(analyticsFile, `${JSON.stringify(storedEvent)}\n`, 'utf8');
      sendJson(response, 202, { accepted: true });
      return;
    }

    const analyticsMatch = url.pathname.match(/^\/v1\/analytics\/([a-zA-Z0-9_-]+)$/);
    if (analyticsMatch && request.method === 'GET') {
      if (!isAuthorized(request)) {
        sendJson(response, 401, { error: 'INVALID_STUDIO_KEY' });
        return;
      }
      sendJson(response, 200, await analyticsSummary(analyticsMatch[1]));
      return;
    }

    sendJson(response, 404, { error: 'NOT_FOUND' });
  } catch (error) {
    const status = error instanceof Error && error.message === 'PAYLOAD_TOO_LARGE' ? 413 : 500;
    sendJson(response, status, { error: status === 413 ? 'PAYLOAD_TOO_LARGE' : 'INTERNAL_SERVER_ERROR' });
    console.error(error);
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`[CleanTouch API] http://127.0.0.1:${port}`);
});
