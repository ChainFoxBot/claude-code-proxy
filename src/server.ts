import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger as honoLogger } from 'hono/logger';
import { streamText } from 'hono/streaming';
import { loadConfig, getDataDir, getDefaultConfigPath } from './config.js';
import { Logger } from './logger.js';
import { RequestMapper } from './proxy.js';
import { getAdapterRegistry } from './adapters/registry.js';
import type { AdapterContext } from './adapters/types.js';
import { join } from 'path';
import chokidar from 'chokidar';

const app = new Hono();

// Strip thinking blocks from messages to avoid signature mismatch errors
// when switching between different Claude models
function stripThinkingBlocks(body: any): any {
  if (!body.messages || !Array.isArray(body.messages)) {
    return body;
  }

  const processed = {
    ...body,
    messages: body.messages.map((msg: any) => {
      if (!msg.content || !Array.isArray(msg.content)) {
        return msg;
      }
      return {
        ...msg,
        content: msg.content.filter((item: any) => item.type !== 'thinking')
      };
    })
  };

  return processed;
}

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

// Hot reload configuration with chokidar
let configWatcher: chokidar.FSWatcher | null = null;

function setupConfigWatcher() {
  const configPath = getDefaultConfigPath();

  // Reload function
  const reloadConfig = async () => {
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
        console.log(`   OPUS → ${config.router.opus}`);
        console.log(`   SONNET → ${config.router.sonnet}`);
        console.log(`   HAIKU → ${config.router.haiku}`);
      }
    } catch (err) {
      console.error('❌ Failed to reload config:', err);
    }
  };

  try {
    // Use chokidar for reliable file watching across platforms
    configWatcher = chokidar.watch(configPath, {
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 50,
      },
    });

    configWatcher.on('change', reloadConfig);
    configWatcher.on('error', (error) => {
      console.error('❌ Watcher error:', error);
    });

    console.log(`👀 Watching config file: ${configPath}`);
    console.log('💡 Edit config file to automatically reload configuration');
  } catch (err) {
    console.warn('⚠️  Could not setup config watcher:', err);
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

    // Strip thinking blocks to avoid signature mismatch when switching models
    const processedBody = stripThinkingBlocks(body);

    // Log request
    requestId = appLogger.startRequest(
      'POST',
      '/v1/messages',
      headers,
      processedBody
    );

    // Resolve provider and model mapping
    const context = requestMapper.resolveProvider(processedBody.model);
    const { provider, modelName } = context;

    // Normalize format to lowercase
    const format = provider.format?.toLowerCase() || 'pass-through';

    // Get adapter from registry (stateless, thread-safe)
    const registry = getAdapterRegistry();
    const adapter = registry.get(format);

    // Prepare adapter context with all necessary data (including headers for pass-through)
    const adapterContext: AdapterContext = {
      originalRequest: processedBody,
      provider,
      modelName,
      originalHeaders: format === 'pass-through'
        ? Object.fromEntries(c.req.raw.headers)
        : undefined
    };

    // Use adapter to prepare request and headers (stateless operations)
    const providerRequest = adapter.prepareRequest(adapterContext);
    const fetchHeaders = adapter.prepareHeaders(adapterContext);

    // Forward request to provider
    // Log forward details before sending (only once, not verbose for streaming)
    if (!processedBody.stream) {
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
    if (processedBody.stream) {
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

    // Process response through adapter (e.g., convert OpenAI → Anthropic)
    if (adapter.processResponse) {
      responseBody = adapter.processResponse(responseBody, adapterContext);
    }

    // Log response details (combine forward + response into one call)
    appLogger.logResponse(
      response.status,
      Object.fromEntries(response.headers.entries()),
      responseBody,
      provider.name,
      modelName,
      processedBody.model
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

// Parse port from config (highest priority), then ANTHROPIC_BASE_URL, then default
function resolvePort(): number {
  // Config file has highest priority
  if (config.server?.port) {
    return config.server.port;
  }
  // Environment variable as fallback
  const baseUrl = process.env.ANTHROPIC_BASE_URL;
  if (baseUrl) {
    try {
      const url = new URL(baseUrl);
      const port = parseInt(url.port, 10);
      if (port) return port;
    } catch {}
  }
  return 3457; // Default port
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
