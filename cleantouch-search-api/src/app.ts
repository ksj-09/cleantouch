import { randomUUID } from 'node:crypto';
import cors from 'cors';
import express, { type ErrorRequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import multer from 'multer';
import sharp from 'sharp';
import { ProviderNotConfiguredError, ProviderRateLimitError, ProviderUnavailableError, VisualSearchError } from './vision-provider.js';
import type { VisualSearchProvider } from './types.js';

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const acceptedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function createApp(provider: VisualSearchProvider) {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',').map((item) => item.trim()).filter(Boolean) ?? false,
    methods: ['GET', 'POST'],
  }));
  app.use(express.json({ limit: '32kb' }));

  const configuredLimit = Number(process.env.MAX_REQUESTS_PER_MINUTE || 30);
  const scanLimiter = rateLimit({
    windowMs: 60_000,
    limit: Number.isFinite(configuredLimit) && configuredLimit > 0 ? configuredLimit : 30,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { code: 'RATE_LIMITED', message: '검색 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.' },
  });
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_UPLOAD_BYTES, files: 2, fields: 2 },
    fileFilter: (_request, file, callback) => {
      if (!acceptedTypes.has(file.mimetype)) {
        callback(new InvalidImageError('JPEG, PNG, WebP 이미지만 전송할 수 있습니다.'));
        return;
      }
      callback(null, true);
    },
  });

  app.get('/health', (_request, response) => {
    response.json({ ok: true, service: 'cleantouch-search', providerConfigured: provider.configured,
      provider: provider.name, model: provider.model, visualMatchesConfigured: provider.visualMatchesConfigured });
  });

  app.post('/v1/scans', scanLimiter, upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'focus', maxCount: 1 },
  ]), async (request, response, next) => {
    const requestId = safeRequestId(request.header('x-request-id'));
    response.setHeader('x-request-id', requestId);
    response.setHeader('cache-control', 'no-store');
    try {
      const files = request.files as Record<string, Express.Multer.File[]> | undefined;
      const image = files?.image?.[0];
      const focus = files?.focus?.[0];
      if (!image) throw new InvalidImageError('검색할 이미지가 필요합니다.');
      const [normalized, normalizedFocus] = await Promise.all([
        normalizeImage(image.buffer, 1280),
        focus ? normalizeImage(focus.buffer, 1100) : Promise.resolve(undefined),
      ]);
      const search = await provider.search(normalized, normalizedFocus ? [normalizedFocus] : undefined);
      response.status(200).json({
        scanId: requestId,
        queryLabel: search.queryLabel,
        matches: search.matches,
        products: search.products ?? (search.matches.length ? [{ id: requestId, label: search.queryLabel, matches: search.matches }] : []),
        retention: { imageStored: false },
      });
    } catch (error) {
      next(error);
    }
  });

  app.use((_request, response) => response.status(404).json({ code: 'NOT_FOUND', message: '요청한 API가 없습니다.' }));

  const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
    if (error instanceof multer.MulterError) {
      response.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ code: error.code, message: '이미지 업로드 형식을 확인해 주세요.' });
      return;
    }
    if (error instanceof InvalidImageError) {
      response.status(400).json({ code: 'INVALID_IMAGE', message: error.message });
      return;
    }
    if (error instanceof ProviderNotConfiguredError) {
      response.status(503).json({ code: 'PROVIDER_NOT_CONFIGURED', message: error.message });
      return;
    }
    if (error instanceof ProviderRateLimitError) {
      if (error.retryAfterSeconds !== undefined) response.setHeader('retry-after', String(error.retryAfterSeconds));
      response.status(429).json({ code: 'PROVIDER_RATE_LIMITED', message: error.message,
        retryAfterSeconds: error.retryAfterSeconds, limitWindow: error.limitWindow });
      return;
    }
    if (error instanceof ProviderUnavailableError) {
      if (error.retryAfterSeconds !== undefined) response.setHeader('retry-after', String(error.retryAfterSeconds));
      response.status(503).json({ code: 'PROVIDER_UNAVAILABLE', message: error.message,
        retryAfterSeconds: error.retryAfterSeconds });
      return;
    }
    if (error instanceof VisualSearchError) {
      response.status(502).json({ code: 'VISUAL_SEARCH_FAILED', message: '외부 상품 검색 서비스가 응답하지 않았습니다.' });
      return;
    }
    console.error(error);
    response.status(500).json({ code: 'INTERNAL_ERROR', message: '상품 검색 중 오류가 발생했습니다.' });
  };
  app.use(errorHandler);
  return app;
}

class InvalidImageError extends Error {}

async function normalizeImage(buffer: Buffer, maxDimension: number) {
  try {
    return await sharp(buffer, { failOn: 'error', limitInputPixels: 30_000_000 })
      .rotate()
      .resize({ width: maxDimension, height: maxDimension, fit: 'inside', withoutEnlargement: true })
      .flatten({ background: '#ffffff' })
      .jpeg({ quality: 90, mozjpeg: true })
      .toBuffer();
  } catch {
    throw new InvalidImageError('이미지 파일을 읽을 수 없습니다. 다른 화면에서 다시 스캔해 주세요.');
  }
}

function safeRequestId(value?: string) {
  const trimmed = value?.trim();
  return trimmed && /^[a-zA-Z0-9._-]{1,128}$/.test(trimmed) ? trimmed : randomUUID();
}
