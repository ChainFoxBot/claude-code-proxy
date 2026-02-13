// Configuration types
export interface ProviderConfig {
  name: string;
  baseUrl: string;
  apiKey: string;
  format?: string; // "anthropic" | "openai" | undefined (pass-through)
}

export interface RouterConfig {
  haiku: string;    // Format: "providerName,modelName" e.g., "zp,glm-4.7"
  sonnet: string;   // Format: "providerName,modelName"
  opus: string;     // Format: "providerName,modelName"
  image?: string;   // Optional: "providerName,modelName"
  webSearch?: string | number;  // Optional: "providerName,modelName" or threshold
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

export interface Config {
  server: ServerConfig;
  logging: LoggingConfig;
  providers: ProviderConfig[];
  router: RouterConfig;
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
