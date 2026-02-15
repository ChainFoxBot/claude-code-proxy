import { BaseAdapter } from './base-adapter.js';
import { AdapterContext } from './types.js';

export class PassThroughAdapter extends BaseAdapter {
  readonly name = 'pass-through';
  readonly format = 'pass-through';

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
