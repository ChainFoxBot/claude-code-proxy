import { BaseAdapter } from './base-adapter.js';
import { AdapterContext } from './types.js';

export class PassThroughAdapter extends BaseAdapter {
  readonly name = 'pass-through';
  readonly format = 'pass-through';

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
    const { provider, originalHeaders } = context;

    // Forward original headers from context (stateless, thread-safe)
    const headers: Record<string, string> = originalHeaders
      ? { ...originalHeaders }
      : {};

    // Remove hop-by-hop headers
    delete headers['host'];
    delete headers['connection'];
    delete headers['content-length'];

    // Set provider's API key
    if (provider.apiKey) {
      headers['x-api-key'] = provider.apiKey;
    }

    return headers;
  }
}
