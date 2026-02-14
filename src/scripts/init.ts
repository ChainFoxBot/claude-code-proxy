#!/usr/bin/env bun
/**
 * Initialize cc-proxy configuration in user home directory
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

interface Config {
  server: {
    port: number;
    host: string;
  };
  logging: {
    enabled: boolean;
    level: 'basic' | 'standard' | 'verbose';
    dir: string;
  };
  providers: Array<{
    name: string;
    baseUrl: string;
    apiKey: string;
    format?: string;
  }>;
  router: {
    haiku: string;
    sonnet: string;
    opus: string;
    image?: string;
    webSearch?: string | number;
  };
}

function getOldConfigPath(): string {
  return join(process.cwd(), 'config.json');
}

function getNewConfigPath(): string {
  const home = process.env.HOME || process.env.USERPROFILE || '';
  return join(home, '.claude-code-proxy', 'config.json');
}

function getNewLogsDir(): string {
  const home = process.env.HOME || process.env.USERPROFILE || '';
  return join(home, '.claude-code-proxy', 'logs');
}

function migrateConfig(): void {
  const oldConfigPath = getOldConfigPath();
  const newConfigPath = getNewConfigPath();

  // Check if new config already exists - protect existing config
  if (existsSync(newConfigPath)) {
    console.log('✅ Config already exists at:', newConfigPath);
    console.log('   Server is using this config file.\n');

    // Migrate old config if it exists
    if (existsSync(oldConfigPath)) {
      console.log('📖 Project config.json found at:', oldConfigPath);
      console.log('💡 You can delete project config.json - it\'s no longer used');
      console.log('   Server uses: ~/.claude-code-proxy/config.json\n');
    }
    return;
  }

  // Check if old config exists
  if (!existsSync(oldConfigPath)) {
    console.log('❌ No config.json found in current directory');
    console.log('Creating default config in user directory...');
    createDefaultConfig(newConfigPath);
    return;
  }

  // Read old config
  console.log(`📖 Reading config from: ${oldConfigPath}`);
  const oldConfig: Config = JSON.parse(readFileSync(oldConfigPath, 'utf-8'));

  // Ensure new directory exists
  const newDir = dirname(newConfigPath);
  if (!existsSync(newDir)) {
    mkdirSync(newDir, { recursive: true });
  }

  // Ensure logs directory exists
  const newLogsDir = getNewLogsDir();
  if (!existsSync(newLogsDir)) {
    mkdirSync(newLogsDir, { recursive: true });
  }

  // Write new config
  writeFileSync(newConfigPath, JSON.stringify(oldConfig, null, 2), 'utf-8');
  console.log(`✅ Config migrated to: ${newConfigPath}`);

  // Ask if user wants to delete old config
  console.log('\n⚠️  Old config.json still exists in project directory');
  console.log('You can now delete the project config.json and use the one in ~/.claude-code-proxy');
}

function createDefaultConfig(configPath: string): void {
  const defaultConfig: Config = {
    server: {
      port: 3457,
      host: '127.0.0.1'
    },
    logging: {
      enabled: true,
      level: 'verbose',
      dir: join(process.env.HOME || process.env.USERPROFILE || '', '.claude-code-proxy', 'logs')
    },
    providers: [
      {
        name: 'openrouter',
        baseUrl: 'https://openrouter.ai/api/v1/chat/completions',
        apiKey: ''
      },
      {
        name: 'zp',
        baseUrl: 'https://api.z.ai/api/anthropic/v1/messages',
        apiKey: ''
      },
      {
        name: 'yescode',
        baseUrl: 'https://co.yes.vg/v1/messages',
        apiKey: ''
      }
    ],
    router: {
      haiku: 'zp,glm-4.7',
      sonnet: 'zp,glm-4.7',
      opus: 'zp,glm-4.7',
      image: 'zp,glm-4.7',
      webSearch: 200000
    }
  };

  writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2), 'utf-8');
  console.log(`✅ Default config created at: ${configPath}`);
}

function main() {
  console.log('🚀 Initializing cc-proxy...\n');

  try {
    migrateConfig();

    console.log('\n✅ Initialization complete!');
    console.log('\n📝 Next steps:');
    console.log('1. Review your config at: ~/.claude-code-proxy/config.json');
    console.log('2. Add your API keys to provider configurations');
    console.log('3. Start the server: npm start');
    console.log('\n💡 Config hot reload is enabled - changes will be applied automatically!');
  } catch (error) {
    console.error('❌ Initialization failed:', error);
    process.exit(1);
  }
}

main();
