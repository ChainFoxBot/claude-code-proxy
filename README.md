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
