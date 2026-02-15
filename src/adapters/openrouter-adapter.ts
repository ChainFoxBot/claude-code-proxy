import { OpenAIAdapter } from './openai-adapter.js';
import { AdapterContext } from './types.js';

/**
 * OpenRouter Adapter
 *
 * OpenRouter uses OpenAI-compatible format but with special headers and features:
 * - HTTP-Referer header for attribution
 * - X-Title header for application name
 * - Supports provider-specific transforms
 * - Supports fallback models
 * - Supports cost optimization features
 */
export class OpenRouterAdapter extends OpenAIAdapter {
  readonly name = 'openrouter';
  readonly format = 'openrouter';

  prepareHeaders(context: AdapterContext): Record<string, string> {
    const { provider } = context;

    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${provider.apiKey}`,
      'HTTP-Referer': 'https://claude.ai',
      'X-Title': 'Claude Code',
    };
  }

  /**
   * OpenRouter-specific parameter handling
   *
   * Supports additional OpenRouter params:
   * - transforms: Array of transforms to apply (e.g., ["middle-out"])
   * - models: Array of fallback models
   * - route: Routing strategy ("fallback" or "cost")
   * - provider: Provider preferences (e.g., { "sort": "throughput" })
   */
  mergeParams(request: any, providerParams?: any): any {
    const merged = super.mergeParams(request, providerParams);

    // OpenRouter-specific: ensure model is properly set
    // OpenRouter accepts model in format "provider/model" or just "model"
    if (!merged.model && request.model) {
      merged.model = request.model;
    }

    return merged;
  }
}
