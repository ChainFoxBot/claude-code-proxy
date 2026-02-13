import { readFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { Config } from './types.js';

let configCache: Config | null = null;
let configPath: string | null = null;

// Get user home directory
function getUserHome(): string {
  return process.env.HOME || process.env.USERPROFILE || '';
}

// Get the proxy data directory in user home
function getDataDir(): string {
  return join(getUserHome(), '.claude-code-proxy');
}

// Ensure all necessary directories exist
function ensureDirectories(): void {
  const dataDir = getDataDir();
  const logsDir = join(dataDir, 'logs');

  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }

  if (!existsSync(logsDir)) {
    mkdirSync(logsDir, { recursive: true });
  }
}

// Get default config path
export function getDefaultConfigPath(): string {
  return join(getDataDir(), 'config.json');
}

export function loadConfig(customConfigPath?: string): Config {
  if (configCache && configPath === (customConfigPath || null)) {
    return configCache;
  }

  const path = customConfigPath || getDefaultConfigPath();
  configPath = path;

  ensureDirectories();

  try {
    const content = readFileSync(path, 'utf-8');
    configCache = JSON.parse(content);
    return configCache;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(
        `Config file not found: ${path}\n` +
        `Please create a config.json file. See config.example.json for reference.`
      );
    }
    throw error;
  }
}

export function reloadConfig(customConfigPath?: string): Config {
  const path = customConfigPath || getDefaultConfigPath();

  try {
    const content = readFileSync(path, 'utf-8');
    configCache = JSON.parse(content);
    return configCache;
  } catch (error) {
    console.error('Failed to reload config:', error);
    return configCache || {} as Config;
  }
}

export function getConfig(): Config | null {
  return configCache;
}

export function getConfigDir(): string {
  return getDataDir();
}

export function getLogsDir(): string {
  return join(getDataDir(), 'logs');
}
