import { BaseAdapter } from './base-adapter.js';
import { AdapterContext } from './types.js';

export class AnthropicAdapter extends BaseAdapter {
  readonly name = 'anthropic';
  readonly format = 'anthropic';

  prepareRequest(context: AdapterContext): any {
    const { originalRequest, provider, modelName } = context;

    // Start with original request and update model name
    let request = { ...originalRequest, model: modelName };

    // Merge provider params if configured
    if (provider.params) {
      request = this.mergeParams(request, provider.params);
    }

    return request;
  }

  prepareHeaders(context: AdapterContext): Record<string, string> {
    const { provider } = context;
    return {
      'Content-Type': 'application/json',
      'x-api-key': provider.apiKey,
      'anthropic-version': '2023-06-01',
    };
  }
}
