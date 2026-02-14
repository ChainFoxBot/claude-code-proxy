# cc-proxy

[English](README.md) | [简体中文](README.zh-CN.md) | [日本語](README.ja.md)

Lightweight LLM proxy server for Claude Code - route Anthropic API requests to any LLM provider.

## Features

- **Model Routing**: Map Claude models (haiku, sonnet, opus) to any provider model
- **Multi-Provider**: Support multiple LLM providers simultaneously
- **Format Conversion**: Auto-convert between Anthropic and OpenAI formats
- **Hot Reload**: Configuration changes applied automatically without restart
- **Performance Optimized**: Async batch logging for minimal overhead
- **Auto-Start**: Shell integration for silent background startup

## Installation

### Option 1: Bun Global Install (Recommended)

```bash
# From npm registry
bun install -g cc-proxy

# Or from local source
cd cc-proxy
bun link
```

This installs the `ccp` command globally:

```bash
ccp start    # Start proxy server
ccp status   # Check status
ccp config   # Open config file in editor
ccp logs     # View logs
ccp help     # Show all commands
```

Add to `~/.zshrc` or `~/.bashrc` for auto-start on shell open:

```bash
eval "$(ccp activate)"
```

### Option 2: Manual Setup

```bash
# Clone repository
git clone https://github.com/your-username/cc-proxy.git
cd cc-proxy

# Install dependencies
bun install

# Initialize configuration
bun run init
```

## Quick Start

### 1. Initialize Configuration

```bash
bun run init
```

This creates:
- `~/.claude-code-proxy/` directory structure
- Default configuration file
- Logs directory

### 2. Configure Providers

Edit your config at:

```bash
~/.claude-code-proxy/config.json
```

### 3. Start Server

```bash
# Using ccp command (if globally installed)
ccp start

# Or using bun
bun start
```


## Configuration Reference

### Complete Configuration Structure

```json
{
  "server": {
    "port": 3457,
    "host": "127.0.0.1"
  },
  "logging": {
    "enabled": true,
    "level": "verbose",
    "dir": "~/.claude-code-proxy/logs"
  },
  "providers": [
    {
      "name": "zp",
      "baseUrl": "https://api.z.ai/api/anthropic/v1/messages",
      "apiKey": "your-api-key",
      "format": "anthropic"
    }
  ],
  "router": {
    "haiku": "zp,glm-4.7",
    "sonnet": "zp,glm-4.7",
    "opus": "zp,glm-4.7",
    "image": "zp,glm-4.7"
  }
}
```

### Parameters

#### `server`

| Parameter | Type | Default | Description |
|----------|------|---------|-------------|
| `port` | number | `3457` | Port number for the proxy server |
| `host` | string | `"127.0.0.1"` | Host address to bind to |

#### `logging`

| Parameter | Type | Default | Description |
|----------|------|---------|-------------|
| `enabled` | boolean | `true` | Enable/disable logging |
| `level` | string | `"verbose"` | Log detail level: `"basic"`, `"standard"`, or `"verbose"` |
| `dir` | string | `"~/.claude-code-proxy/logs"` | Directory to store log files |

#### `providers`

Array of provider configurations. Each provider object:

| Parameter | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | string | ✅ Yes | Unique provider identifier (used in routing) |
| `baseUrl` | string | ✅ Yes | API endpoint URL |
| `apiKey` | string | ✅ Yes | API key for authentication |
| `format` | string | No | API format: `"anthropic"`, `"openai"`, or omit for pass-through |

**Format Types:**
- `"anthropic"`: Use Anthropic-compatible headers (x-api-key, anthropic-version)
- `"openai"`: Convert to OpenAI format (Authorization: Bearer)
- Omitted: Pass-through mode (forward original headers, only replace API key)

#### `router`

Maps Claude model names to provider endpoints.

Format: `"<claude-model>": "<provider-name>,<actual-model-name>"`

| Parameter | Description | Example |
|----------|-------------|---------|
| `haiku` | Fast/inexpensive model routing | `"zp,glm-4.7"` |
| `sonnet` | Balanced performance model routing | `"zp,glm-4.7"` |
| `opus` | High-performance model routing | `"openrouter,anthropic/claude-opus-4.5"` |
| `image` | Image generation model routing | `"zp,glm-4.7"` |

### Router Syntax

```json
"router": {
  "haiku": "provider-name,model-name"
}
```

**Components:**
- **Provider name**: Must match a provider's `name` field
- **Model name**: Actual model to request from provider

**Examples:**
- `"zp,glm-4.7"`: Use `zp` provider, request `glm-4.7` model
- `"openrouter,anthropic/claude-opus-4.5"`: Use OpenRouter, request Claude Opus 4.5

### Environment Variables Override

The proxy can detect port from `ANTHROPIC_BASE_URL`:

```bash
export ANTHROPIC_BASE_URL="http://127.0.0.1:3456"
```

This will override the `server.port` configuration and use port `3456`.

## Configuration Examples

### Zhipu AI (Anthropic format)

```json
{
  "name": "zp",
  "baseUrl": "https://api.z.ai/api/anthropic/v1/messages",
  "apiKey": "your-key",
  "format": "anthropic"
}
```

### OpenRouter (OpenAI format)

```json
{
  "name": "openrouter",
  "baseUrl": "https://openrouter.ai/api/v1/chat/completions",
  "apiKey": "sk-or-...",
  "format": "openai"
}
```

### Multiple Providers

```json
{
  "providers": [
    {
      "name": "zp",
      "baseUrl": "https://api.z.ai/api/anthropic/v1/messages",
      "apiKey": "your-zpai-key"
    },
    {
      "name": "openrouter",
      "baseUrl": "https://openrouter.ai/api/v1/chat/completions",
      "apiKey": "sk-or-..."
    }
  ],
  "router": {
    "haiku": "zp,glm-4.7",
    "sonnet": "zp,glm-4.7",
    "opus": "openrouter,anthropic/claude-opus-4.5"
  }
}
```

## CLI Commands

```bash
ccp activate    # Silent auto-start (for shell config)
ccp start       # Force restart and start
ccp stop        # Stop the proxy server
ccp restart     # Restart the proxy server
ccp status      # Show running status
ccp config      # Open config file in editor (zed > vscode > vi)
ccp logs        # Tail server logs in real-time
ccp help        # Show help message
```

## Claude Code Integration

Set environment variables to use cc-proxy with Claude Code:

```bash
export ANTHROPIC_BASE_URL="http://127.0.0.1:3456"
export ANTHROPIC_API_KEY="routing-key"
```

For auto-start on shell open, add to your `~/.zshrc`:

```bash
eval "$(ccp activate)"
```

## Performance

The proxy is optimized for high-concurrency scenarios:

- **Async batch logging**: 100ms flush intervals for minimal I/O blocking
- **No per-chunk logging**: Streaming responses bypass per-chunk overhead
- **Efficient memory usage**: ~100KB buffer limit
- **Graceful shutdown**: Flushes logs before exit

Handles 100+ concurrent requests from agent-swarm scenarios.

## License

MIT
