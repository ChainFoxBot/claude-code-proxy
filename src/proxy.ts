import type { ProviderConfig, RouterConfig, RouteConfig, RouteTarget, LoadBalanceStrategy } from './types.js';
import { LoadBalancer } from './load-balancer.js';

export interface ProxyContext {
  provider: ProviderConfig;
  modelName: string;
}

export class RequestMapper {
  private providers: ProviderConfig[];
  private router: RouterConfig;
  private loadBalancer: LoadBalancer;

  constructor(providers: ProviderConfig[], router: RouterConfig) {
    this.providers = providers;
    this.router = router;
    this.loadBalancer = new LoadBalancer();
  }

  /**
   * Parse route string like "zp,glm-4.7" into RouteTarget
   */
  private parseRouteString(routeStr: string): RouteTarget | null {
    const parts = routeStr.split(',');
    if (parts.length !== 2) {
      return null;
    }
    return {
      provider: parts[0].trim(),
      model: parts[1].trim()
    };
  }

  /**
   * Parse RouteConfig into array of RouteTargets and strategy
   * Returns deep copies to prevent mutation of original config
   */
  private parseRouteConfig(routeConfig: RouteConfig): {
    targets: RouteTarget[];
    strategy: LoadBalanceStrategy;
  } {
    // Format 1: Simple string "provider,model"
    if (typeof routeConfig === 'string') {
      const target = this.parseRouteString(routeConfig);
      if (!target) {
        throw new Error(`Invalid route configuration: ${routeConfig}`);
      }
      return { targets: [target], strategy: 'round-robin' };
    }

    // Format 2: Array of strings ["provider1,model1", "provider2,model2"]
    if (Array.isArray(routeConfig)) {
      const targets = routeConfig.map((str) => {
        const target = this.parseRouteString(str);
        if (!target) {
          throw new Error(`Invalid route configuration: ${str}`);
        }
        return target;
      });
      return { targets, strategy: 'round-robin' };
    }

    // Format 3: Full object with targets and strategy
    if (typeof routeConfig === 'object' && routeConfig.targets) {
      // Return deep copy of targets to prevent mutation
      return {
        targets: routeConfig.targets.map(t => ({ ...t })),
        strategy: routeConfig.strategy || 'round-robin',
      };
    }

    throw new Error(`Invalid route configuration format: ${JSON.stringify(routeConfig)}`);
  }

  /**
   * Find provider by name
   */
  private findProvider(providerName: string): ProviderConfig | null {
    return this.providers.find(p => p.name === providerName) || null;
  }

  /**
   * Get route key from Claude model name
   */
  private getRouteKey(claudeModel: string): keyof RouterConfig {
    if (claudeModel.includes('haiku')) {
      return 'haiku';
    } else if (claudeModel.includes('opus')) {
      return 'opus';
    }
    // Default to sonnet for anything else
    return 'sonnet';
  }

  /**
   * Map Claude model to provider and model based on router config
   * Now supports load balancing across multiple providers
   * Returns a copy of provider to prevent mutation
   */
  resolveProvider(claudeModel: string): ProxyContext {
    // Determine which route to use based on model name
    const routeKey = this.getRouteKey(claudeModel);
    const routeConfig = this.router[routeKey];

    if (!routeConfig) {
      throw new Error(`No route configured for model: ${claudeModel}`);
    }

    // Parse route config into targets and strategy
    const { targets, strategy } = this.parseRouteConfig(routeConfig);

    // Use load balancer to select a target
    const selected = this.loadBalancer.select(targets, strategy, routeKey);

    // Find the provider
    const provider = this.findProvider(selected.provider);
    if (!provider) {
      throw new Error(`Provider not found: ${selected.provider}`);
    }

    // Return a copy of provider to prevent mutation of original config
    return {
      provider: { ...provider },
      modelName: selected.model,
    };
  }

  /**
   * Update providers configuration (for hot reload)
   */
  updateProviders(providers: ProviderConfig[]): void {
    this.providers = providers;
  }

  /**
   * Update router configuration (for hot reload)
   */
  updateRouter(router: RouterConfig): void {
    this.router = router;
  }
}
