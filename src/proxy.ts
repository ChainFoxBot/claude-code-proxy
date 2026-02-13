import type { ProviderConfig, RouterConfig } from './types.js';

export interface ProxyContext {
  provider: ProviderConfig;
  modelName: string;
}

export class RequestMapper {
  private providers: ProviderConfig[];
  private router: RouterConfig;

  constructor(providers: ProviderConfig[], router: RouterConfig) {
    this.providers = providers;
    this.router = router;
  }

  /**
   * Parse route string like "zp,glm-4.7" into provider name and model name
   */
  private parseRoute(routeStr: string): { providerName: string; modelName: string } | null {
    const parts = routeStr.split(',');
    if (parts.length !== 2) {
      return null;
    }
    return {
      providerName: parts[0].trim(),
      modelName: parts[1].trim()
    };
  }

  /**
   * Find provider by name
   */
  private findProvider(providerName: string): ProviderConfig | null {
    return this.providers.find(p => p.name === providerName) || null;
  }

  /**
   * Map Claude model to provider and model based on router config
   */
  resolveProvider(claudeModel: string): ProxyContext {
    let routeStr: string;

    // Determine which route to use based on model name
    if (claudeModel.includes('haiku')) {
      routeStr = this.router.haiku;
    } else if (claudeModel.includes('opus')) {
      routeStr = this.router.opus;
    } else {
      // Default to sonnet for anything else
      routeStr = this.router.sonnet;
    }

    const parsed = this.parseRoute(routeStr);
    if (!parsed) {
      throw new Error(`Invalid route configuration: ${routeStr}`);
    }

    const provider = this.findProvider(parsed.providerName);
    if (!provider) {
      throw new Error(`Provider not found: ${parsed.providerName}`);
    }

    return {
      provider,
      modelName: parsed.modelName,
    };
  }
}
