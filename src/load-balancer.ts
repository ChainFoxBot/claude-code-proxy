import type { RouteTarget, LoadBalanceStrategy } from './types.js';

/**
 * Load Balancer for distributing requests across multiple providers
 */
export class LoadBalancer {
  private counters: Map<string, number> = new Map();

  /**
   * Select a target from the list based on the specified strategy
   */
  select(
    targets: RouteTarget[],
    strategy: LoadBalanceStrategy,
    routeKey: string
  ): RouteTarget {
    if (targets.length === 0) {
      throw new Error('No targets available for load balancing');
    }

    // Single target - no balancing needed
    if (targets.length === 1) {
      return targets[0];
    }

    switch (strategy) {
      case 'round-robin':
        return this.roundRobin(targets, routeKey);
      case 'weighted-round-robin':
        return this.weightedRoundRobin(targets, routeKey);
      case 'random':
        return this.random(targets);
      default:
        // Fallback to round-robin
        return this.roundRobin(targets, routeKey);
    }
  }

  /**
   * Round-robin strategy: cycle through targets in order
   */
  private roundRobin(targets: RouteTarget[], routeKey: string): RouteTarget {
    const count = this.counters.get(routeKey) || 0;
    const index = count % targets.length;
    this.counters.set(routeKey, count + 1);
    return targets[index];
  }

  /**
   * Weighted round-robin strategy: distribute based on weights
   * Higher weight = more requests
   * Example: weights [70, 30] → first target gets 70% of requests
   */
  private weightedRoundRobin(
    targets: RouteTarget[],
    routeKey: string
  ): RouteTarget {
    // Normalize weights (default to 1 if not specified)
    const normalizedTargets = targets.map((t) => ({
      ...t,
      weight: t.weight ?? 1,
    }));

    // Calculate total weight
    const totalWeight = normalizedTargets.reduce(
      (sum, t) => sum + t.weight!,
      0
    );

    // Get current counter and increment
    const count = this.counters.get(routeKey) || 0;
    this.counters.set(routeKey, count + 1);

    // Find target based on cumulative weight
    let cumulative = 0;
    const position = count % totalWeight;

    for (const target of normalizedTargets) {
      cumulative += target.weight!;
      if (position < cumulative) {
        return target;
      }
    }

    // Fallback to last target
    return normalizedTargets[normalizedTargets.length - 1];
  }

  /**
   * Random strategy: select randomly
   */
  private random(targets: RouteTarget[]): RouteTarget {
    const index = Math.floor(Math.random() * targets.length);
    return targets[index];
  }

  /**
   * Reset counter for a specific route (useful for testing)
   */
  resetCounter(routeKey: string): void {
    this.counters.delete(routeKey);
  }

  /**
   * Reset all counters
   */
  resetAllCounters(): void {
    this.counters.clear();
  }
}
