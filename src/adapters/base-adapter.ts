import { ProviderAdapter, AdapterContext, ProviderParams } from './types.js';

export abstract class BaseAdapter implements ProviderAdapter {
  abstract readonly name: string;
  abstract readonly format: string;

  /**
   * Default parameter merging strategy
   * Priority: user request params > provider params > defaults
   *
   * IMPORTANT: Only includes fields with defined values.
   * Undefined/null values are not included in the final request,
   * allowing the provider to use its own defaults.
   */
  mergeParams(request: any, providerParams?: ProviderParams): any {
    // Start with provider params (only defined values)
    const merged: any = {};

    if (providerParams) {
      for (const key of Object.keys(providerParams)) {
        if (providerParams[key] !== undefined && providerParams[key] !== null) {
          merged[key] = providerParams[key];
        }
      }
    }

    // User request parameters override provider params (higher priority)
    // Only include defined values
    for (const key of Object.keys(request)) {
      if (request[key] !== undefined && request[key] !== null) {
        merged[key] = request[key];
      }
    }

    return merged;
  }

  abstract prepareRequest(context: AdapterContext): any;
  abstract prepareHeaders(context: AdapterContext): Record<string, string>;
}
