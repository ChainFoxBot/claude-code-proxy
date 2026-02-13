# cc-proxy

[English](README.md) | [简体中文](README.zh-CN.md) | [日本語](README.ja.md)

轻量级 LLM 代理服务器，用于 Claude Code - 将 Anthropic API 请求路由到任意 LLM 提供商。

## 功能特性

- **模型路由**：将 Claude 模型（haiku、sonnet、opus）映射到任意提供商的模型
- **多提供商**：同时支持多个 LLM 提供商
- **格式转换**：自动在 Anthropic 和 OpenAI 格式之间转换
- **热重载**：配置更改自动应用，无需重启
- **性能优化**：异步批量日志记录，最小化开销
- **自动启动**：Shell 集成，静默后台启动

## 安装方式

### 方式 1：Bun 全局安装（推荐）

```bash
# 从 npm 安装
bun install -g cc-proxy

# 或从本地源码安装
cd cc-proxy
bun link
```

这将全局安装 `ccp` 命令：

```bash
ccp start    # 启动代理服务器
ccp status   # 检查状态
ccp logs     # 查看日志
ccp help     # 显示所有命令
```

添加到 `~/.zshrc` 或 `~/.bashrc` 以实现 shell 打开时自动启动：

```bash
eval "$(ccp activate)"
```

### 方式 2：手动安装

```bash
# 克隆仓库
git clone https://github.com/your-username/cc-proxy.git
cd cc-proxy

# 安装依赖
bun install

# 初始化配置
bun run init
```

## 快速开始

### 1. 初始化配置

```bash
bun run init
```

这将创建：
- `~/.claude-code-proxy/` 目录结构
- 默认配置文件
- 日志目录

### 2. 配置提供商

编辑配置文件：

```bash
~/.claude-code-proxy/config.json
```

### 3. 启动服务器

```bash
# 使用 ccp 命令（如果已全局安装）
ccp start

# 或使用 bun
bun start
```


## 配置参考

### 完整配置结构

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

### 参数说明

#### `server`

| 参数 | 类型 | 默认值 | 说明 |
|------|------|---------|------|
| `port` | number | `3457` | 代理服务器端口号 |
| `host` | string | `"127.0.0.1"` | 绑定的主机地址 |

#### `logging`

| 参数 | 类型 | 默认值 | 说明 |
|------|------|---------|------|
| `enabled` | boolean | `true` | 启用/禁用日志 |
| `level` | string | `"verbose"` | 日志级别：`"basic"`、`"standard"` 或 `"verbose"` |
| `dir` | string | `"~/.claude-code-proxy/logs"` | 日志文件存储目录 |

#### `providers`

提供商配置数组。每个提供商对象：

| 参数 | 类型 | 必需 | 说明 |
|------|------|--------|------|
| `name` | string | ✅ 是 | 提供商唯一标识符（用于路由） |
| `baseUrl` | string | ✅ 是 | API 端点 URL |
| `apiKey` | string | ✅ 是 | API 认证密钥 |
| `format` | string | 否 | API 格式：`"anthropic"`、`"openai"` 或省略（透传模式） |

**格式类型：**
- `"anthropic"`：使用 Anthropic 兼容头（x-api-key, anthropic-version）
- `"openai"`：转换为 OpenAI 格式（Authorization: Bearer）
- 省略：透传模式（仅替换 API 密钥，转发原始头）

#### `router`

将 Claude 模型名映射到提供商端点。

格式：`"<claude-model>": "<provider-name>,<actual-model-name>"`

| 参数 | 说明 | 示例 |
|------|------|------|
| `haiku` | 快速/经济模型路由 | `"zp,glm-4.7"` |
| `sonnet` | 均衡性能模型路由 | `"zp,glm-4.7"` |
| `opus` | 高性能模型路由 | `"openrouter,anthropic/claude-opus-4.5"` |
| `image` | 图像生成模型路由 | `"zp,glm-4.7"` |

### 路由语法

```json
"router": {
  "haiku": "provider-name,model-name"
}
```

**组成部分：**
- **提供商名称**：必须匹配提供商的 `name` 字段
- **模型名称**：向提供商请求的实际模型

**示例：**
- `"zp,glm-4.7"`：使用 `zp` 提供商，请求 `glm-4.7` 模型
- `"openrouter,anthropic/claude-opus-4.5"`：使用 OpenRouter，请求 Claude Opus 4.5

### 环境变量覆盖

代理可以从 `ANTHROPIC_BASE_URL` 检测端口：

```bash
export ANTHROPIC_BASE_URL="http://127.0.0.1:3456"
```

这将覆盖 `server.port` 配置并使用端口 `3456`。

服务器将：
- 从 `~/.claude-code-proxy/` 加载配置
- 在 `~/.claude-code-proxy/logs/` 存储日志
- 监听配置文件更改并热重载

## 配置示例

### 智谱 AI（Anthropic 格式）

```json
{
  "name": "zp",
  "baseUrl": "https://api.z.ai/api/anthropic/v1/messages",
  "apiKey": "your-key",
  "format": "anthropic"
}
```

### OpenRouter（OpenAI 格式）

```json
{
  "name": "openrouter",
  "baseUrl": "https://openrouter.ai/api/v1/chat/completions",
  "apiKey": "sk-or-...",
  "format": "openai"
}
```

### 多提供商配置

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

## CLI 命令

```bash
ccp activate    # 静默自动启动（用于 shell 配置）
ccp start       # 强制重启并启动
ccp stop        # 停止代理服务器
ccp restart     # 重启代理服务器
ccp status      # 显示运行状态
ccp logs        # 实时查看服务器日志
ccp help        # 显示帮助信息
```

## Claude Code 集成

设置环境变量以在 Claude Code 中使用 cc-proxy：

```bash
export ANTHROPIC_BASE_URL="http://127.0.0.1:3456"
export ANTHROPIC_API_KEY="routing-key"
```

如需在 shell 打开时自动启动，添加到 `~/.zshrc`：

```bash
eval "$(ccp activate)"
```

## 日志管理

### 查看最新日志

```bash
# 服务器日志
ccp logs

# 请求日志（JSONL 格式）
tail -f ~/.claude-code-proxy/logs/requests.jsonl | jq '.'
```

### 过滤日志

```bash
# 按提供商过滤
cat ~/.claude-code-proxy/logs/requests.jsonl | jq 'select(.provider == "zp")'

# 按类型过滤
cat ~/.claude-code-proxy/logs/requests.jsonl | jq 'select(.type == "forward")'
cat ~/.claude-code-proxy/logs/requests.jsonl | jq 'select(.type == "response")'
```

## 性能

代理针对高并发场景进行了优化：

- **异步批量日志**：100ms 刷新间隔，最小化 I/O 阻塞
- **无 per-chunk 日志**：流式响应绕过 per-chunk 开销
- **高效内存使用**：约 100KB 缓冲区限制
- **优雅关闭**：退出前刷新日志

可处理来自 agent-swarm 场景的 100+ 并发请求。

## 故障排除

### 服务器无法启动

```bash
# 检查是否已运行
ccp status

# 查看日志
ccp logs

# 尝试强制重启
ccp restart
```

### 配置未加载

```bash
# 验证配置文件存在
cat ~/.claude-code-proxy/config.json

# 重新初始化
bun run init
```

## 许可证

MIT
