# Load Balancing Guide

cc-proxy supports load balancing across multiple LLM providers with flexible configuration options.

## Configuration Formats

### 1. Single Provider (Simplest)

```json
{
  "router": {
    "sonnet": "provider-name,model-name"
  }
}
```

All requests go to a single provider.

### 2. Multiple Providers (Round-Robin)

```json
{
  "router": {
    "sonnet": [
      "provider-a,model-a",
      "provider-b,model-b"
    ]
  }
}
```

Requests are distributed evenly across providers in rotation.

### 3. Weighted Distribution (Advanced)

```json
{
  "router": {
    "opus": {
      "targets": [
        { "provider": "provider-a", "model": "model-a", "weight": 70 },
        { "provider": "provider-b", "model": "model-b", "weight": 30 }
      ],
      "strategy": "weighted-round-robin"
    }
  }
}
```

Requests are distributed based on weights (70% to provider-a, 30% to provider-b).

## Load Balancing Strategies

| Strategy | Description | Use Case |
|----------|-------------|----------|
| `round-robin` | Rotate through targets sequentially | Equal distribution, providers have similar performance |
| `weighted-round-robin` | Distribute based on weights | Unequal distribution, providers have different capacities |
| `random` | Random selection | Simple distribution without tracking state |

## Example Configurations

### Scenario 1: Cost Optimization

Use cheaper provider for most requests, premium provider for complex tasks:

```json
{
  "providers": [
    {
      "name": "budget",
      "baseUrl": "https://api.budget-llm.com/v1/messages",
      "apiKey": "key1",
      "format": "anthropic"
    },
    {
      "name": "premium",
      "baseUrl": "https://api.anthropic.com/v1/messages",
      "apiKey": "key2",
      "format": "anthropic"
    }
  ],
  "router": {
    "haiku": "budget,model-haiku",
    "sonnet": [
      "budget,model-sonnet",
      "premium,claude-sonnet-4"
    ],
    "opus": {
      "targets": [
        { "provider": "budget", "model": "model-opus", "weight": 80 },
        { "provider": "premium", "model": "claude-opus-4-5-20251101", "weight": 20 }
      ],
      "strategy": "weighted-round-robin"
    }
  }
}
```

### Scenario 2: Failover Setup

Primary provider with backup:

```json
{
  "router": {
    "sonnet": [
      "primary,claude-sonnet-4",
      "backup,claude-sonnet-4"
    ]
  }
}
```

### Scenario 3: Multi-Cloud Distribution

Distribute across multiple cloud providers:

```json
{
  "router": {
    "sonnet": {
      "targets": [
        { "provider": "aws", "model": "claude-sonnet-4", "weight": 40 },
        { "provider": "gcp", "model": "claude-sonnet-4", "weight": 35 },
        { "provider": "azure", "model": "claude-sonnet-4", "weight": 25 }
      ],
      "strategy": "weighted-round-robin"
    }
  }
}
```

## Hot Reload

All load balancing configurations support hot reload. Edit your `config.json` file and changes take effect immediately without restarting the server.

## Testing

Run the test suite to verify load balancing behavior:

```bash
bun test-load-balancer.ts
```

For weighted round-robin verification:

```bash
bun test-weighted.ts
```

## Implementation Details

- **Stateless**: Load balancer maintains minimal state (only counters for round-robin)
- **Deterministic**: Same configuration produces predictable distribution
- **Thread-Safe**: Each request is independent
- **Performance**: O(n) for weighted selection, O(1) for simple round-robin

## Monitoring

Check current routing configuration:

```bash
ccp status
```

View real-time request distribution in logs:

```bash
tail -f logs/requests.log
```
