import { BaseAdapter } from './base-adapter.js';
import { AdapterContext } from './types.js';
import { convertAnthropicToOpenAI } from '../format-converter.js';

export class OpenAIAdapter extends BaseAdapter {
  readonly name = 'openai';
  readonly format = 'openai';

  prepareRequest(context: AdapterContext): any {
    const { originalRequest, provider, modelName } = context;

    // 1. Convert Anthropic format to OpenAI format
    let request = convertAnthropicToOpenAI({
      ...originalRequest,
      model: modelName
    });

    // 2. Merge model-specific params if configured
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
      'Authorization': `Bearer ${provider.apiKey}`,
      'HTTP-Referer': 'https://claude.ai',
      'X-Title': 'Claude Code',
    };
  }

  processResponse(response: any, context: AdapterContext): any {
    const { originalRequest } = context;

    // Convert OpenAI response back to Anthropic format
    if (response.choices) {
      const { convertOpenAIToAnthropic } = require('../format-converter.js');
      return convertOpenAIToAnthropic(response, originalRequest.model);
    }

    return response;
  }
}
