#!/usr/bin/env bun
// Log query utility for cc-proxy

import { resolve } from 'path';
import { readFileSync, existsSync } from 'fs';

const LOG_FILE = resolve(process.cwd(), 'logs/requests.jsonl');

function printUsage() {
  console.log('Usage: bun scripts/query-logs.ts [command] [options]');
  console.log('');
  console.log('Commands:');
  console.log('  last [n]              Show last n entries (default: 10)');
  console.log('  errors                Show only error entries');
  console.log('  requests              Show only request entries');
  console.log('  responses             Show only response entries');
  console.log('  stream                Show only stream chunk entries');
  console.log('  model <model-name>     Filter by model name');
  console.log('  provider <provider>   Filter by provider name');
  console.log('  id <request-id>       Show entries for specific request ID');
  console.log('  stats                 Show statistics');
  console.log('  tail                  Follow log file in real-time');
  console.log('');
  console.log('Examples:');
  console.log('  bun scripts/query-logs.ts last 20');
  console.log('  bun scripts/query-logs.ts errors');
  console.log('  bun scripts/query-logs.ts model claude-3-5-sonnet-20241022');
  console.log('  bun scripts/query-logs.ts id abc-123-def');
}

interface LogEntry {
  timestamp: string;
  id: string;
  type: string;
  method?: string;
  path?: string;
  statusCode?: number;
  provider?: string;
  originalModel?: string;
  mappedModel?: string;
  duration?: number;
  error?: string;
  body?: any;
}

function loadLogs(): LogEntry[] {
  if (!existsSync(LOG_FILE)) {
    console.error(`Log file not found: ${LOG_FILE}`);
    console.error('Make sure the server has been started with logging enabled.');
    process.exit(1);
  }

  const content = readFileSync(LOG_FILE, 'utf-8');
  const lines = content.trim().split('\n');

  return lines.map(line => {
    try {
      return JSON.parse(line);
    } catch (e) {
      return null;
    }
  }).filter(Boolean) as LogEntry[];
}

function formatEntry(entry: LogEntry, showBody = false): string {
  const parts = [
    `\x1b[36m${entry.timestamp}\x1b[0m`,
    `\x1b[33m[${entry.type}]\x1b[0m`,
    entry.id ? `\x1b[90m(${entry.id.slice(0, 8)})\x1b[0m` : '',
  ];

  if (entry.provider) {
    parts.push(`\x1b[35m@${entry.provider}\x1b[0m`);
  }

  if (entry.originalModel) {
    parts.push(`${entry.originalModel}`);
    if (entry.mappedModel && entry.mappedModel !== entry.originalModel) {
      parts.push(`\x1b[90m→\x1b[0m${entry.mappedModel}`);
    }
  }

  if (entry.statusCode) {
    const color = entry.statusCode >= 500 ? 31 : entry.statusCode >= 400 ? 33 : 32;
    parts.push(`\x1b[${color}m${entry.statusCode}\x1b[0m`);
  }

  if (entry.duration) {
    parts.push(`\x1b[90m${entry.duration}ms\x1b[0m`);
  }

  if (entry.error) {
    parts.push(`\x1b[31mERROR: ${entry.error}\x1b[0m`);
  }

  let result = parts.filter(Boolean).join(' ');

  if (showBody && entry.body) {
    result += '\n' + JSON.stringify(entry.body, null, 2);
  }

  return result;
}

function showLast(count: number, showBody = false) {
  const logs = loadLogs();
  const entries = logs.slice(-count);

  console.log(`\n📋 Last ${entries.length} entries:\n`);

  for (const entry of entries) {
    console.log(formatEntry(entry, showBody));
  }
}

function showErrors() {
  const logs = loadLogs();
  const errors = logs.filter(e => e.type === 'error');

  console.log(`\n❌ Found ${errors.length} error entries:\n`);

  for (const entry of errors) {
    console.log(formatEntry(entry, true));
    console.log('');
  }
}

function showByType(type: string) {
  const logs = loadLogs();
  const entries = logs.filter(e => e.type === type);

  console.log(`\n📋 Found ${entries.length} ${type} entries:\n`);

  for (const entry of entries) {
    console.log(formatEntry(entry));
  }
}

function showByModel(modelName: string) {
  const logs = loadLogs();
  const entries = logs.filter(e =>
    e.originalModel === modelName || e.mappedModel === modelName
  );

  console.log(`\n📋 Found ${entries.length} entries for model ${modelName}:\n`);

  for (const entry of entries) {
    console.log(formatEntry(entry));
  }
}

function showByProvider(providerName: string) {
  const logs = loadLogs();
  const entries = logs.filter(e => e.provider === providerName);

  console.log(`\n📋 Found ${entries.length} entries for provider ${providerName}:\n`);

  for (const entry of entries) {
    console.log(formatEntry(entry));
  }
}

function showById(requestId: string) {
  const logs = loadLogs();
  const entries = logs.filter(e => e.id.startsWith(requestId) || e.id === requestId);

  if (entries.length === 0) {
    console.log(`\n❌ No entries found for ID: ${requestId}`);
    return;
  }

  console.log(`\n📋 Found ${entries.length} entries for ID ${requestId}:\n`);

  for (const entry of entries) {
    console.log(formatEntry(entry, true));
    console.log('');
  }
}

function showStats() {
  const logs = loadLogs();

  const stats = {
    total: logs.length,
    requests: logs.filter(e => e.type === 'request').length,
    responses: logs.filter(e => e.type === 'response').length,
    errors: logs.filter(e => e.type === 'error').length,
    streamChunks: logs.filter(e => e.type === 'stream_chunk').length,
    providers: {} as Record<string, number>,
    models: {} as Record<string, number>,
    avgDuration: 0,
  };

  let totalDuration = 0;
  let durationCount = 0;

  for (const entry of logs) {
    if (entry.provider) {
      stats.providers[entry.provider] = (stats.providers[entry.provider] || 0) + 1;
    }
    if (entry.originalModel) {
      stats.models[entry.originalModel] = (stats.models[entry.originalModel] || 0) + 1;
    }
    if (entry.duration) {
      totalDuration += entry.duration;
      durationCount++;
    }
  }

  stats.avgDuration = durationCount > 0 ? Math.round(totalDuration / durationCount) : 0;

  console.log('\n📊 Statistics:\n');
  console.log(`Total entries:       ${stats.total}`);
  console.log(`Requests:            ${stats.requests}`);
  console.log(`Responses:           ${stats.responses}`);
  console.log(`Errors:              ${stats.errors}`);
  console.log(`Stream chunks:       ${stats.streamChunks}`);

  if (Object.keys(stats.providers).length > 0) {
    console.log('\nProviders:');
    for (const [provider, count] of Object.entries(stats.providers)) {
      console.log(`  ${provider}: ${count}`);
    }
  }

  if (Object.keys(stats.models).length > 0) {
    console.log('\nModels:');
    for (const [model, count] of Object.entries(stats.models)) {
      console.log(`  ${model}: ${count}`);
    }
  }

  console.log(`\nAvg response time:  ${stats.avgDuration}ms\n`);
}

async function tailLogs() {
  const { Tail } = await import('tail' as any);

  const tail = new Tail(LOG_FILE, {
    fromBeginning: false,
    follow: true,
    logger: console,
  });

  console.log('\n📋 Following logs (Ctrl+C to stop):\n');

  tail.on('line', (data: string) => {
    try {
      const entry = JSON.parse(data);
      console.log(formatEntry(entry));
    } catch (e) {
      console.log(data);
    }
  });

  tail.on('error', (error: Error) => {
    console.error('ERROR:', error);
    process.exit(1);
  });
}

// Main
const command = process.argv[2];
const arg = process.argv[3];

switch (command) {
  case 'last':
    showLast(arg ? parseInt(arg, 10) : 10);
    break;

  case 'errors':
    showErrors();
    break;

  case 'requests':
    showByType('request');
    break;

  case 'responses':
    showByType('response');
    break;

  case 'stream':
    showByType('stream_chunk');
    break;

  case 'model':
    if (!arg) {
      console.error('Error: model name required');
      printUsage();
      process.exit(1);
    }
    showByModel(arg);
    break;

  case 'provider':
    if (!arg) {
      console.error('Error: provider name required');
      printUsage();
      process.exit(1);
    }
    showByProvider(arg);
    break;

  case 'id':
    if (!arg) {
      console.error('Error: request ID required');
      printUsage();
      process.exit(1);
    }
    showById(arg);
    break;

  case 'stats':
    showStats();
    break;

  case 'tail':
    await tailLogs();
    break;

  default:
    printUsage();
    process.exit(1);
}
