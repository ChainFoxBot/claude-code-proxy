/**
 * Statusline configuration loader
 */

import { loadConfig, getConfig } from '../config.js';
import type { StatuslineConfig } from './types.js';

export function loadStatuslineConfig(): StatuslineConfig {
  const config = loadConfig();

  if (!config?.statusline) {
    // Return defaults
    return {
      enabled: true,
      sessionRetentionHours: 24,
      contextWindows: {},
    };
  }

  return config.statusline;
}

/**
 * Parse context range string to token count
 * Examples: "200K" -> 200000, "128k" -> 128000, "1M" -> 1000000
 */
export function parseContextRange(range: string): number | null {
  const normalized = range.trim().toUpperCase();

  // Match patterns like "200K", "128K", "1M", "1000000"
  const match = normalized.match(/^(\d+(?:\.\d+)?)\s*([KM]?)$/);
  if (!match) {
    return null;
  }

  const value = parseFloat(match[1]);
  const unit = match[2];

  switch (unit) {
    case 'K':
      return Math.round(value * 1000);
    case 'M':
      return Math.round(value * 1000000);
    default:
      return Math.round(value);
  }
}

/**
 * Get context window size for a provider:model combination
 * Priority: provider.info[model].contextRange > statusline.contextWindows > null
 */
export function getContextWindowSize(providerModel: string): number | null {
  const config = loadConfig();

  // Extract provider and model from "provider:model" format
  const parts = providerModel.split(':');
  if (parts.length !== 2) {
    return null;
  }

  const [providerName, modelName] = parts;

  // 1. Check provider.info[model].contextRange (highest priority)
  const provider = config.providers?.find(p => p.name === providerName);
  if (provider?.info?.[modelName]?.contextRange) {
    const size = parseContextRange(provider.info[modelName].contextRange!);
    if (size !== null) {
      return size;
    }
  }

  // 2. Check statusline.contextWindows (fallback)
  const statuslineConfig = loadStatuslineConfig();
  if (statuslineConfig.contextWindows?.[providerModel]?.contextWindowSize) {
    return statuslineConfig.contextWindows[providerModel].contextWindowSize;
  }

  // 3. No configuration found - return null (don't calculate)
  return null;
}

/**
 * Calculate actual context percentage based on provider model's context window
 */
export function calculateActualContextPercent(
  totalTokens: number,
  providerModel: string
): number | null {
  const contextSize = getContextWindowSize(providerModel);

  if (!contextSize || contextSize <= 0) {
    return null;
  }

  return Math.min(100, Math.round((totalTokens / contextSize) * 100));
}

/**
 * Check if weekly limit is approaching (async for performance)
 */
export async function checkWeeklyLimitAsync(
  providerModel: string,
  currentUsage: { inputTokens: number; outputTokens: number },
  warningThreshold: number = 80
): Promise<{ exceeded: boolean; percentage: number; limit?: number } | null> {
  const config = getConfig();
  if (!config) {
    return null;
  }

  // Extract provider and model from "provider:model" format
  const parts = providerModel.split(':');
  if (parts.length !== 2) {
    return null;
  }

  const [providerName, modelName] = parts;

  // Get weekly limit from provider.info[model].weeklyLimit
  const provider = config.providers?.find(p => p.name === providerName);
  const limit = provider?.info?.[modelName]?.weeklyLimit;

  if (!limit || limit.enabled === false) {
    return null;
  }

  const totalTokens = currentUsage.inputTokens + currentUsage.outputTokens;

  if (limit.maxTotalTokens) {
    const percentage = Math.round((totalTokens / limit.maxTotalTokens) * 100);
    return {
      exceeded: percentage >= 100,
      percentage,
      limit: limit.maxTotalTokens,
    };
  }

  if (limit.maxInputTokens) {
    const percentage = Math.round((currentUsage.inputTokens / limit.maxInputTokens) * 100);
    if (percentage >= warningThreshold) {
      return {
        exceeded: percentage >= 100,
        percentage,
        limit: limit.maxInputTokens,
      };
    }
  }

  if (limit.maxOutputTokens) {
    const percentage = Math.round((currentUsage.outputTokens / limit.maxOutputTokens) * 100);
    if (percentage >= warningThreshold) {
      return {
        exceeded: percentage >= 100,
        percentage,
        limit: limit.maxOutputTokens,
      };
    }
  }

  return null;
}
