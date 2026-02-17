/**
 * Statusline type definitions
 */

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

export interface ProviderModelUsage extends TokenUsage {
  providerModel: string;
  requestCount: number;
}

export interface SessionTotals {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  totalTokens: number;
}

export interface StatuslineConfig {
  enabled: boolean;
  sessionRetentionHours: number;
  // Note: weeklyLimits and contextWindows are now in provider.info[model]
  // Keep contextWindows for backward compatibility only
  contextWindows?: Record<string, { contextWindowSize: number }>;
}

/**
 * Claude Code stdin data structure
 */
export interface StdinData {
  transcript_path?: string;
  cwd?: string;
  model?: {
    id?: string;
    display_name?: string;
  };
  context_window?: {
    context_window_size?: number;
    total_input_tokens?: number;
    total_output_tokens?: number;
    current_usage?: {
      input_tokens?: number;
      output_tokens?: number;
      cache_creation_input_tokens?: number;
      cache_read_input_tokens?: number;
    } | null;
    used_percentage?: number | null;
    remaining_percentage?: number | null;
  };
}

export interface GitStatus {
  branch: string;
  states: string[]; // ['待提交', '未跟踪', 'merge', 'detached' 等]
}

export interface StatuslineOutput {
  model: string;
  claudeContextPercent: number;
  actualContextPercent: number | null;
  sessionTokens: string;
  gitStatus: GitStatus | null;
  mcpCount: number;
  weeklyWarning: string | null;
}
