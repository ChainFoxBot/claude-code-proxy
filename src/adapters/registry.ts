import { ProviderAdapter } from './types.js';
import { OpenAIAdapter } from './openai-adapter.js';
import { OpenRouterAdapter } from './openrouter-adapter.js';
import { AnthropicAdapter } from './anthropic-adapter.js';
import { PassThroughAdapter } from './passthrough-adapter.js';

class AdapterRegistry {
  private adapters: Map<string, ProviderAdapter> = new Map();

  constructor() {
    // Register built-in adapters
    this.register(new OpenAIAdapter());
    this.register(new OpenRouterAdapter());
    this.register(new AnthropicAdapter());
    this.register(new PassThroughAdapter());
  }

  register(adapter: ProviderAdapter): void {
    this.adapters.set(adapter.format.toLowerCase(), adapter);
  }

  get(format: string): ProviderAdapter {
    const normalizedFormat = format.toLowerCase();
    const adapter = this.adapters.get(normalizedFormat);

    if (!adapter) {
      // Default to pass-through for unknown formats
      console.warn(`Unknown format "${format}", using pass-through adapter`);
      return this.adapters.get('pass-through')!;
    }

    return adapter;
  }
}

// Singleton instance
let registryInstance: AdapterRegistry | null = null;

export function getAdapterRegistry(): AdapterRegistry {
  if (!registryInstance) {
    registryInstance = new AdapterRegistry();
  }
  return registryInstance;
}

// Reset registry (useful for testing)
export function resetAdapterRegistry(): void {
  registryInstance = null;
}
