import { mkdirSync, appendFileSync, existsSync } from 'fs';
import { appendFile } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';
import type { LogEntry, LoggingConfig } from './types.js';
import { getLogsDir } from './config.js';

export class Logger {
  private config: LoggingConfig;
  private requestId: string | null = null;
  private requestStartTime: number = 0;
  private logFile: string;
  private logBuffer: string[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;

  constructor(config: LoggingConfig) {
    this.config = config;
    const logsDir = getLogsDir();
    this.logFile = join(logsDir, 'requests.jsonl');

    if (config.enabled) {
      this.ensureLogDir();
      this.setupBufferFlush();
    }
  }

  private ensureLogDir(): void {
    const logsDir = getLogsDir();
    if (!existsSync(logsDir)) {
      mkdirSync(logsDir, { recursive: true });
    }
  }

  private setupBufferFlush(): void {
    // Flush buffer every 100ms to batch writes
    this.flushTimer = setInterval(() => {
      this.flush();
    }, 100);
  }

  private flush(): void {
    if (this.logBuffer.length === 0) return;

    const lines = this.logBuffer.splice(0);
    const logData = lines.join('');

    // Use async write in Bun for better performance
    if (typeof Bun !== 'undefined') {
      appendFile(this.logFile, logData).catch(() => {});
    } else {
      // Fallback to sync for Node.js
      appendFileSync(this.logFile, logData, 'utf-8');
    }
  }

  private writeLog(entry: LogEntry): void {
    if (!this.config.enabled) return;

    const logLine = JSON.stringify(entry) + '\n';
    this.logBuffer.push(logLine);

    // Flush immediately if buffer gets too large (prevent memory bloat)
    if (this.logBuffer.length >= 50) {
      this.flush();
    }
  }

  startRequest(method: string, path: string, headers: Record<string, string>, body?: any): string {
    this.requestId = randomUUID();
    this.requestStartTime = Date.now();

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      id: this.requestId,
      type: 'request',
      method,
      path,
      headers: this.config.level === 'verbose' ? headers : this.sanitizeHeaders(headers),
      body: this.config.level === 'verbose' ? body : undefined,
    };

    this.writeLog(entry);
    return this.requestId;
  }

  logForward(
    providerName: string,
    modelName: string,
    requestFormat: string,
    actualRequest: any,
    actualResponse?: any
  ): void {
    if (!this.requestId || !this.config.enabled) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      id: this.requestId,
      type: 'forward',
      method: 'POST',
      path: '/v1/messages',
      provider: providerName,
      mappedModel: modelName,
      requestFormat,
      actualRequest: this.config.level === 'verbose' ? actualRequest : undefined,
      actualResponse: this.config.level === 'verbose' ? actualResponse : undefined,
    };

    this.writeLog(entry);
  }

  logResponse(
    statusCode: number,
    headers: Record<string, string>,
    body?: any,
    provider?: string,
    mappedModel?: string,
    originalModel?: string
  ): void {
    if (!this.requestId) return;

    const duration = Date.now() - this.requestStartTime;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      id: this.requestId,
      type: 'response',
      method: 'POST',
      path: '/v1/messages',
      statusCode,
      headers: this.config.level === 'verbose' ? headers : this.sanitizeHeaders(headers),
      body: this.config.level === 'verbose' ? body : undefined,
      provider,
      mappedModel,
      originalModel,
      duration,
    };

    this.writeLog(entry);
    this.requestId = null;
  }

  logStreamChunk(
    chunkIndex: number,
    chunkType: string,
    data: any,
    provider?: string
  ): void {
    if (!this.requestId) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      id: this.requestId,
      type: 'stream_chunk',
      method: 'POST',
      path: '/v1/messages',
      chunkIndex,
      headers: { 'x-chunk-type': chunkType },
      body: this.config.level === 'verbose' ? data : undefined,
      provider,
    };

    this.writeLog(entry);
  }

  logError(error: string, details?: any): void {
    if (!this.requestId) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      id: this.requestId,
      type: 'error',
      method: 'POST',
      path: '/v1/messages',
      error,
      body: details,
    };

    this.writeLog(entry);
    this.requestId = null;
  }

  private sanitizeHeaders(headers: Record<string, string>): Record<string, string> {
    const sanitized: Record<string, string> = {};

    for (const [key, value] of Object.entries(headers)) {
      if (key.toLowerCase() === 'authorization') {
        sanitized[key] = 'Bearer ***REDACTED***';
      } else if (key.toLowerCase() === 'x-api-key') {
        sanitized[key] = '***REDACTED***';
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  // Flush buffer on cleanup
  destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    this.flush();
  }
}
