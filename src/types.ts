// Configuration types
export interface ProviderParams {
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  stop?: string[];
  stream?: boolean;
  [key: string]: any; // Support any provider-specific parameters
}

export interface WeeklyLimit {
  maxInputTokens?: number;
  maxOutputTokens?: number;
  maxTotalTokens?: number;
  enabled?: boolean; // default: true
}

export interface ModelInfo {
  contextRange?: string; // e.g., "200K", "128k", "1M"
  weeklyLimit?: WeeklyLimit;
}

export interface ProviderConfig {
  name: string;
  baseUrl: string;
  apiKey: string;
  format?: string; // "anthropic" | "openai" | undefined (pass-through)
  models?: Record<string, ProviderParams>; // Model-specific parameters, keyed by model name
  info?: Record<string, ModelInfo>; // Model information (context window, etc.)
}

// Load Balancing Types
export interface RouteTarget {
  provider: string;
  model: string;
  weight?: number; // Weight for weighted strategies, default: 1
}

export type LoadBalanceStrategy = 'round-robin' | 'weighted-round-robin' | 'random';

export type RouteConfig =
  | string // Simple: "provider,model"
  | string[] // Array: ["provider1,model1", "provider2,model2"]
  | {
      targets: RouteTarget[];
      strategy?: LoadBalanceStrategy;
    };

export interface RouterConfig {
  haiku: RouteConfig;
  sonnet: RouteConfig;
  opus: RouteConfig;
  image?: RouteConfig;
  webSearch?: RouteConfig;
}

export interface LoggingConfig {
  enabled: boolean;
  level: 'basic' | 'standard' | 'verbose';
  dir: string;
}

export interface ServerConfig {
  port: number;
  host: string;
}

export interface StatuslineConfig {
  enabled: boolean;
  sessionRetentionHours: number;
  weeklyLimits: Record<string, {
    maxInputTokens?: number;
    maxOutputTokens?: number;
    maxTotalTokens?: number;
    enabled: boolean;
  }>;
  contextWindows: Record<string, {
    contextWindowSize: number;
  }>;
}

export interface Config {
  server: ServerConfig;
  logging: LoggingConfig;
  providers: ProviderConfig[];
  router: RouterConfig;
  statusline?: StatuslineConfig;
}

// Log entry types
export interface LogEntry {
  timestamp: string;
  id: string;
  type: 'request' | 'response' | 'stream_chunk' | 'error' | 'forward';
  method: string;
  path: string;
  statusCode?: number;
  headers?: Record<string, string>;
  body?: any;
  chunkIndex?: number;
  provider?: string;
  mappedModel?: string;
  originalModel?: string;
  duration?: number;
  error?: string;
  // Forward details
  requestFormat?: string;
  actualRequest?: any;
  actualResponse?: any;
}

// Anthropic API types
export interface AnthropicMessageRequest {
  model: string;
  messages: Array<{
    role: string;
    content: string | Array<any>;
  }>;
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  stream?: boolean;
  tools?: any;
  tool_choice?: any;
  system?: string;
}

export interface AnthropicStreamChunk {
  type: string;
  index?: number;
  delta?: any;
  message?: any;
}
