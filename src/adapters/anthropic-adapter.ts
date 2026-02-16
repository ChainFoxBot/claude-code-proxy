import { BaseAdapter } from './base-adapter.js';
import { AdapterContext } from './types.js';

export class AnthropicAdapter extends BaseAdapter {
  readonly name = 'anthropic';
  readonly format = 'anthropic';

  prepareRequest(context: AdapterContext): any {
    const { originalRequest, provider, modelName } = context;

    // Filter out undefined values from original request
    const filteredRequest: any = {};
    for (const key of Object.keys(originalRequest)) {
      if (originalRequest[key] !== undefined) {
        filteredRequest[key] = originalRequest[key];
      }
    }

    // Set model name
    let request = { ...filteredRequest, model: modelName };

    // Merge model-specific params if configured
    const modelParams = this.getModelParams(provider, modelName);
    if (modelParams) {
      request = this.mergeParams(request, modelParams);
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
