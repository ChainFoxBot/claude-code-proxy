import { ProviderAdapter, AdapterContext, ProviderParams } from './types.js';

export abstract class BaseAdapter implements ProviderAdapter {
  abstract readonly name: string;
  abstract readonly format: string;

  /**
   * Get model-specific params from provider config
   */
  getModelParams(provider: { models?: Record<string, ProviderParams> }, modelName: string): ProviderParams | undefined {
    return provider.models?.[modelName];
  }

  /**
   * Default parameter merging strategy
   * Priority: model-specific params > user request params
   *
   * Model params only override fields that are explicitly set.
   * Fields not in model params keep the original request value.
   *
   * IMPORTANT: Only includes fields with defined, non-null values.
   */
  mergeParams(request: any, modelParams?: ProviderParams): any {
    // Start with original request (only defined, non-null values)
    const merged: any = {};

    for (const key of Object.keys(request)) {
      if (request[key] !== undefined && request[key] !== null) {
        merged[key] = request[key];
      }
    }

    // Model-specific params override original request (higher priority)
    if (modelParams) {
      for (const key of Object.keys(modelParams)) {
        if (modelParams[key] !== undefined && modelParams[key] !== null) {
          merged[key] = modelParams[key];
        }
      }
    }

    return merged;
  }

  abstract prepareRequest(context: AdapterContext): any;
  abstract prepareHeaders(context: AdapterContext): Record<string, string>;
}
