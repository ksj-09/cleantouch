import { createApp } from './app.js';
import { GeminiVisionProvider } from './gemini-provider.js';
import { GroqVisionProvider } from './groq-provider.js';
import { GoogleVisionProvider } from './vision-provider.js';
import { VisualMatchProvider } from './visual-match-provider.js';
import type { VisualSearchProvider } from './types.js';

const port = Number(process.env.PORT || 8790);
const provider = createProvider();
const app = createApp(provider);

const server = app.listen(port, '0.0.0.0', () => {
  console.log(`[CleanTouch Search API] http://127.0.0.1:${port}`);
  console.log(`[CleanTouch Search API] provider=${provider.name ?? 'google'} model=${provider.model ?? 'web-detection'}`);
  if (!provider.configured) console.warn('[CleanTouch Search API] Search provider credentials are not configured; scan requests return 503.');
});

server.requestTimeout = 30_000;
server.headersTimeout = 10_000;
server.keepAliveTimeout = 5_000;

function shutdown(signal: string) {
  console.log(`[CleanTouch Search API] ${signal} received; closing.`);
  server.close((error) => {
    if (error) {
      console.error(error);
      process.exitCode = 1;
    }
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

function createProvider(): VisualSearchProvider {
  const selected = process.env.SEARCH_PROVIDER?.trim().toLowerCase();
  if (selected === 'google') return new GoogleVisionProvider();
  if (selected === 'gemini') return withVisualMatches(new GeminiVisionProvider());
  if (selected === 'groq') return new GroqVisionProvider();
  if (process.env.GEMINI_API_KEY?.trim()) return withVisualMatches(new GeminiVisionProvider());
  if (process.env.GROQ_API_KEY?.trim()) return new GroqVisionProvider();
  return new GoogleVisionProvider();
}

function withVisualMatches(recognizer: VisualSearchProvider): VisualSearchProvider {
  if (process.env.VISUAL_SEARCH_ENABLED === 'false') return recognizer;
  const matcher = new GoogleVisionProvider();
  return matcher.configured ? new VisualMatchProvider(recognizer, matcher) : recognizer;
}
