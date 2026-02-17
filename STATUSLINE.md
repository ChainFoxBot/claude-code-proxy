# Statusline 功能

## 功能特性

cc-proxy 的 statusline 功能提供实时的 token 使用追踪和上下文窗口监控。

### 显示信息

```
[claude-sonnet-4-5] | 18% (实际 29%) | 37k tokens | main ✓ | 3 MCPs | ⚠️ openrouter:glm-4.7: 85%
```

- **模型名称**: 当前请求的 Claude 模型
- **上下文占比**: Claude Code 认为的百分比 + 实际映射模型的百分比（如果不同）
- **Token 统计**: 当前会话消耗的 token 总数
- **Git 状态**: 分支名和状态（✓ 干净 / ✗ 有变更）
- **MCP 数量**: 运行中的 MCP 服务器数量
- **周限额警告**: 当接近周限额时显示（≥80%）

## 配置

### 1. 配置 Provider 模型信息

在 `~/.claude-code-proxy/config.json` 的 provider 配置中添加 `info` 字段：

```json
{
  "providers": [
    {
      "name": "zp_max",
      "baseUrl": "https://api.z.ai/api/anthropic/v1/messages",
      "apiKey": "your-key",
      "format": "anthropic",
      "info": {
        "glm-5": {
          "contextRange": "200K",
          "weeklyLimit": {
            "maxTotalTokens": 1000000,
            "enabled": true
          }
        },
        "glm-4.7": {
          "contextRange": "128K",
          "weeklyLimit": {
            "maxInputTokens": 500000,
            "maxOutputTokens": 200000,
            "enabled": true
          }
        }
      }
    },
    {
      "name": "openrouter",
      "baseUrl": "https://openrouter.ai/api/v1/chat/completions",
      "apiKey": "your-key",
      "format": "openai",
      "info": {
        "anthropic/claude-sonnet-4": {
          "contextRange": "200K"
        }
      }
    }
  ]
}
```

### 配置字段说明

#### `contextRange`（可选）
- **作用**：定义模型的上下文窗口大小
- **格式**：`"200K"`, `"128K"`, `"1M"`, `"1000000"` 等
- **未配置时**：不显示"实际"上下文占比

#### `weeklyLimit`（可选）
- **作用**：设置模型的周限额
- **字段**：
  - `maxTotalTokens`: 总 token 限额
  - `maxInputTokens`: 输入 token 限额
  - `maxOutputTokens`: 输出 token 限额
  - `enabled`: 是否启用（默认 true）
- **未配置时**：不显示周限额警告

### 2. 启用 Statusline

```json
{
  "statusline": {
    "enabled": true,
    "sessionRetentionHours": 24
  }
}
```

### 2. 配置 Claude Code

在 `~/.claude/settings.json` 中设置：

```json
{
  "statusLine": {
    "type": "command",
    "command": "bash -c '~/.bun/bin/bun /path/to/cc-proxy/src/statusline/index.ts'"
  }
}
```

**替换路径**:
```bash
# 获取实际路径
echo "bash -c '\"$(which bun)\" \"$(pwd)/src/statusline/index.ts\"'"
```

### 3. 重启服务

```bash
ccp restart
```

## CLI 命令

### 查看当前状态

```bash
ccp statusline
```

### 测试输出

```bash
echo '{"model":{"display_name":"test"},"context_window":{"used_percentage":50}}' | ccp statusline
```

### 查看详细统计

```bash
curl http://127.0.0.1:3457/statusline
```

## 数据存储

- **数据库**: `~/.claude-code-proxy/data/statusline.db` (SQLite)
- **Session 数据**: 每个会话独立，24小时后自动清理
- **周统计**: 自动按 ISO 周重置

## 架构

### 线程安全
- SQLite WAL 模式支持多进程并发写入
- 原子事务保证数据一致性

### 周限额检查
- 异步后台任务，不阻塞 statusline 输出
- 自动检测周边界并重置

### 上下文窗口映射
- 在 provider 的 `info` 字段中配置
- 支持灵活的格式（200K, 128k, 1M）
- 未配置时不显示"实际"占比，只显示 Claude Code 的占比

## 常见模型上下文窗口配置示例

```json
{
  "providers": [
    {
      "name": "anthropic-direct",
      "info": {
        "claude-opus-4-5-20251101": { "contextRange": "200K" },
        "claude-sonnet-4-5-20250929": { "contextRange": "200K" },
        "claude-haiku-4-5-20251001": { "contextRange": "200K" }
      }
    },
    {
      "name": "openai",
      "info": {
        "gpt-4o": { "contextRange": "128K" },
        "gpt-4-turbo": { "contextRange": "128K" },
        "gpt-4": { "contextRange": "8K" }
      }
    },
    {
      "name": "zhipu",
      "info": {
        "glm-4": { "contextRange": "128K" },
        "glm-4-plus": { "contextRange": "128K" },
        "glm-4.7": { "contextRange": "128K" },
        "glm-5": { "contextRange": "200K" }
      }
    },
    {
      "name": "deepseek",
      "info": {
        "deepseek-chat": { "contextRange": "64K" },
        "deepseek-coder": { "contextRange": "16K" }
      }
    }
  ]
}
```

## 故障排查

### Statusline 显示 0 tokens

**原因**: `StatuslineTracker` 的 `sessionId` 是私有属性，无法通过 `(tracker as any).sessionId` 正确更新

**解决**:
- 将 `sessionId` 改为 getter/setter
- 使用 `tracker.sessionId = value` 而不是 `(tracker as any).sessionId = value`
- 已在 2026-02-17 修复

### Git 状态不显示

**原因**: 当前目录不是 git 仓库

**解决**: `git init` 或忽略此字段

### 周限额警告不显示

**原因**:
1. 未在 `provider.info[model].weeklyLimit` 中配置
2. 使用量未达到 80% 阈值

**解决**: 在 provider 的 info 字段中添加 weeklyLimit 配置

## 性能优化

- **异步检查**: 周限额检查在后台运行，不影响 statusline 响应速度
- **SQLite WAL**: 优化的并发读写性能
- **内存缓存**: Git 状态和 MCP 计数可缓存（待实现）
- **批量写入**: 流式响应的 token 统计在流结束后一次性写入

## API 端点

### GET /statusline

返回详细的 session 和 weekly 统计：

```json
{
  "session": {
    "inputTokens": 25000,
    "outputTokens": 8000,
    "totalTokens": 36500
  },
  "sessionDisplay": "37k tokens",
  "weekly": [
    {
      "providerModel": "openrouter:anthropic/claude-sonnet-4",
      "inputTokens": 15000,
      "outputTokens": 5000
    }
  ],
  "lastProviderModel": "openrouter:anthropic/claude-sonnet-4"
}
```

### POST /session/reset

重置当前会话的 token 统计：

```bash
curl -X POST http://127.0.0.1:3457/session/reset
```

## 未来增强

- [ ] Git 状态缓存（5秒 TTL）
- [ ] MCP 计数缓存
- [ ] Web UI 查看历史统计
- [ ] 导出 CSV 报告
- [ ] 自定义 statusline 格式模板
