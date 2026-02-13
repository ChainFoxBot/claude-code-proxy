import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger as honoLogger } from 'hono/logger';
import { streamText } from 'hono/streaming';
import { loadConfig, getDataDir, getDefaultConfigPath } from './config.js';
import { Logger } from './logger.js';
import { RequestMapper } from './proxy.js';
import { convertAnthropicToOpenAI, convertOpenAIToAnthropic } from './format-converter.js';
import { join } from 'path';

const app = new Hono();

let config;
try {
  config = loadConfig();
} catch (error) {
  console.error('❌ Failed to load configuration:');
  console.error((error as Error).message);
  console.error('\nPlease create a config.json file. See config.example.json for reference.');
  process.exit(1);
}

const appLogger = new Logger(config.logging);
const requestMapper = new RequestMapper(
  config.providers,
  config.router
);

// Hot reload configuration
let configWatcher: any = null;

function setupConfigWatcher() {
  const configPath = getDefaultConfigPath();

  try {
    // Use Bun.watch if available, otherwise warn
    if (typeof Bun !== 'undefined' && Bun.watch) {
      configWatcher = Bun.watch(configPath, async () => {
        console.log('🔄 Config file changed, reloading...');
        try {
          const newConfig = await require('./config.js').reloadConfig();
          if (newConfig) {
            // Update providers and router
            (requestMapper as any).updateProviders(newConfig.providers);
            (requestMapper as any).updateRouter(newConfig.router);

            // Update logger
            (appLogger as any).updateConfig(newConfig.logging);

            config = newConfig;
            console.log('✅ Configuration reloaded successfully');
          }
        } catch (err) {
          console.error('❌ Failed to reload config:', err);
        }
      });
      console.log(`👀 Watching config file: ${configPath}`);
    } else {
      console.warn('⚠️  File watching not available in this environment, hot reload disabled');
    }
  } catch (err) {
    console.warn('⚠️  Could not watch config file, hot reload disabled:', err);
  }
}

// Middleware
app.use('*', cors({
  origin: '*',
  allowHeaders: ['*'],
  allowMethods: ['POST', 'GET', 'OPTIONS'],
  credentials: true,
}));

app.use('*', honoLogger());

// Health check endpoint
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    providers: config.providers.length,
    logging: config.logging.enabled,
  });
});

// Status endpoint
app.get('/status', (c) => {
  return c.json({
    server: config.server,
    providers: config.providers.map(p => ({
      name: p.name,
      baseUrl: p.baseUrl,
    })),
    router: config.router,
    logging: config.logging,
  });
});

// Main proxy endpoint for Anthropic Messages API
app.post('/v1/messages', async (c) => {
  let requestId: string | null = null;

  try {
    const body = await c.req.json();
    const headers = Object.fromEntries(c.req.raw.headers);

    // Log request
    requestId = appLogger.startRequest(
      'POST',
      '/v1/messages',
      headers,
      body
    );

    // Resolve provider and model mapping
    const context = requestMapper.resolveProvider(body.model);
    const { provider, modelName } = context;

    // Normalize format to lowercase
    const format = provider.format?.toLowerCase();

    // Prepare request body and headers based on provider format
    let providerRequest: any;
    let fetchHeaders: Record<string, string>;

    if (format === 'openai') {
      // Convert Anthropic → OpenAI format
      providerRequest = convertAnthropicToOpenAI({ ...body, model: modelName });
      fetchHeaders = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${provider.apiKey}`,
        'HTTP-Referer': 'https://claude.ai',
        'X-Title': 'Claude Code',
      };
    } else if (format === 'anthropic') {
      // Explicit Anthropic format headers
      providerRequest = { ...body, model: modelName };
      fetchHeaders = {
        'Content-Type': 'application/json',
        'x-api-key': provider.apiKey,
        'anthropic-version': '2023-06-01',
      };
    } else {
      // No format specified: pass-through proxy
      // Forward original headers, only replace api key and model
      const originalHeaders = Object.fromEntries(c.req.raw.headers);
      fetchHeaders = { ...originalHeaders };
      // Remove hop-by-hop headers
      delete fetchHeaders['host'];
      delete fetchHeaders['connection'];
      delete fetchHeaders['content-length'];
      // Set provider's API key
      if (provider.apiKey) {
        fetchHeaders['x-api-key'] = provider.apiKey;
      }
      providerRequest = { ...body, model: modelName };
    }

    // Forward request to provider
    // Log forward details before sending (only once, not verbose for streaming)
    if (!body.stream) {
      appLogger.logForward(
        provider.name,
        modelName,
        format || 'pass-through',
        providerRequest
      );
    }

    const response = await fetch(provider.baseUrl, {
      method: 'POST',
      headers: fetchHeaders,
      body: JSON.stringify(providerRequest),
    });

    if (!response.ok) {
      const errorText = await response.text();
      appLogger.logError(
        `Provider error: ${response.status} ${response.statusText}`,
        errorText
      );
      return c.json(
        {
          type: 'error',
          error: {
            type: 'api_error',
            message: `Provider returned ${response.status}: ${errorText}`,
          },
        },
        response.status
      );
    }

    // Handle streaming response
    if (body.stream) {
      // Performance optimization: Skip per-chunk logging for streaming
      // Each SSE chunk would trigger disk I/O, killing performance
      // Instead, log a single summary after stream completes
      return streamText(c, async (stream) => {
        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('No response body');
        }

        const decoder = new TextDecoder();
        let chunkCount = 0;

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            chunkCount++;

            // Stream directly without logging each chunk
            await stream.write(chunk);
          }
        } finally {
          reader.releaseLock();

          // Log streaming summary (only if verbose)
          if (config.logging.level === 'verbose') {
            appLogger.logForward(
              provider.name,
              modelName,
              format || 'pass-through',
              providerRequest,
              { streaming: true, chunks: chunkCount }
            );
          }
        }
      });
    }

    // Handle non-streaming response
    let responseBody = await response.json();

    // Convert OpenAI format to Anthropic format if needed
    if (format === 'openai' && responseBody.choices) {
      responseBody = convertOpenAIToAnthropic(responseBody, body.model);
    }

    // Log response details (combine forward + response into one call)
    appLogger.logResponse(
      response.status,
      Object.fromEntries(response.headers.entries()),
      responseBody,
      provider.name,
      modelName,
      body.model
    );

    return c.json(responseBody);

  } catch (error) {
    if (requestId) {
      appLogger.logError(
        error instanceof Error ? error.message : String(error)
      );
    }

    return c.json(
      {
        type: 'error',
        error: {
          type: 'api_error',
          message: error instanceof Error ? error.message : 'Internal server error',
        },
      },
      500
    );
  }
});

// Parse port from ANTHROPIC_BASE_URL, fallback to config
function resolvePort(): number {
  const baseUrl = process.env.ANTHROPIC_BASE_URL;
  if (baseUrl) {
    try {
      const url = new URL(baseUrl);
      const port = parseInt(url.port, 10);
      if (port) return port;
    } catch {}
  }
  return config.server.port;
}

const PORT = resolvePort();
const HOST = config.server.host || '127.0.0.1';

const server = Bun.serve({
  port: PORT,
  hostname: HOST,
  fetch: app.fetch,
});

console.log(`🚀 cc-proxy server running on http://${HOST}:${PORT}`);
console.log(`📊 Status: http://${HOST}:${PORT}/status`);
console.log(`🔍 Health: http://${HOST}:${PORT}/health`);
console.log(`📝 Logging: ${config.logging.enabled ? 'enabled' : 'disabled'} (${config.logging.level})`);
console.log(`⚙️  Providers: ${config.providers.length} configured`);
console.log(`📁 Config: ${require('./config.js').getDefaultConfigPath()}`);

// Setup config watcher for hot reload (only once)
setupConfigWatcher();

// Graceful shutdown: flush log buffer on exit
process.on('exit', () => (appLogger as any).destroy?.());
process.on('SIGINT', () => {
  (appLogger as any).destroy?.();
  process.exit(0);
});
process.on('SIGTERM', () => {
  (appLogger as any).destroy?.();
  process.exit(0);
});
