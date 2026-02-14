#!/usr/bin/env bun
import { readFileSync } from 'fs';

async function main() {
  const chunks = [];
  for await (const chunk of Bun.stdin.stream()) {
    chunks.push(chunk);
  }

  const data = JSON.parse(Buffer.concat(chunks).toString());

  console.log('📊 Model Routing:');
  console.log('');

  const models = ['haiku', 'sonnet', 'opus', 'image'];
  for (const key of models) {
    if (data.router[key]) {
      console.log(`  ${key.toUpperCase()} → ${data.router[key]}`);
    }
  }

  console.log('');
  console.log('📡 Providers:');
  for (const p of data.providers) {
    console.log(`  • ${p.name} - ${p.baseUrl}`);
  }

  console.log('');
  console.log(`🔗 Endpoint: http://${data.server.host}:${data.server.port}`);
}

main().catch(console.error);
