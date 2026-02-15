import { ProviderConfig } from '../types.js';

// Provider-specific parameters that can be configured
export interface ProviderParams {
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  stop?: string[];
  stream?: boolean;
  [key: string]: any; // Support any provider-specific parameters
}

// Context passed to adapters
export interface AdapterContext {
  originalRequest: any;
  provider: ProviderConfig;
  modelName: string;
  originalHeaders?: Record<string, string>; // For pass-through adapter
}

// Base adapter interface
export interface ProviderAdapter {
  readonly name: string;
  readonly format: string;

  // Prepare the request body to send to the provider
  prepareRequest(context: AdapterContext): any;

  // Prepare headers for the provider request
  prepareHeaders(context: AdapterContext): Record<string, string>;

  // Process the response from the provider (optional)
  processResponse?(response: any, context: AdapterContext): any;

  // Merge provider params with request params (optional)
  mergeParams?(request: any, providerParams?: ProviderParams): any;
}
