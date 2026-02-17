# Statusline 快速配置指南

## 一、配置 Provider 模型信息

编辑 `~/.claude-code-proxy/config.json`：

```json
{
  "providers": [
    {
      "name": "zp_max",
      "baseUrl": "https://api.z.ai/api/anthropic/v1/messages",
      "apiKey": "your-api-key",
      "format": "anthropic",
      "info": {
        "glm-5": {
          "contextRange": "200K",
          "weeklyLimit": {
            "maxTotalTokens": 1000000,
            "enabled": true
          }
        }
      }
    }
  ]
}
```

### 配置字段说明

| 字段 | 位置 | 作用 | 未配置时 |
|------|------|------|----------|
| `contextRange` | `provider.info[model]` | 上下文窗口大小 | 不显示"实际"占比 |
| `weeklyLimit` | `provider.info[model]` | 周限额设置 | 不显示警告 |

### contextRange 格式

```json
"contextRange": "200K"    // 200,000 tokens
"contextRange": "128K"    // 128,000 tokens
"contextRange": "1M"      // 1,000,000 tokens
```

### weeklyLimit 字段

```json
"weeklyLimit": {
  "maxTotalTokens": 1000000,     // 总 token 限额（优先）
  "maxInputTokens": 500000,      // 输入 token 限额
  "maxOutputTokens": 200000,     // 输出 token 限额
  "enabled": true                // 是否启用（默认 true）
}
```

**优先级**：`maxTotalTokens` > `maxInputTokens` > `maxOutputTokens`

## 二、启用 Statusline

```json
{
  "statusline": {
    "enabled": true,
    "sessionRetentionHours": 24
  }
}
```

## 三、配置 Claude Code

编辑 `~/.claude/settings.json`：

```json
{
  "statusLine": {
    "type": "command",
    "command": "bash -c '~/.bun/bin/bun /path/to/cc-proxy/src/statusline/index.ts'"
  }
}
```

**获取路径**：
```bash
cd /path/to/cc-proxy
echo "bash -c '\"$(which bun)\" \"$(pwd)/src/statusline/index.ts\"'"
```

## 四、重启服务

```bash
ccp restart
```

## 五、验证

```bash
# 测试输出
echo '{"model":{"display_name":"test"},"context_window":{"used_percentage":50}}' | ccp statusline

# 查看统计
curl http://127.0.0.1:3456/statusline | jq .
```

## Statusline 输出示例

### 有配置时

```
[claude-sonnet-4-5] | 18% (实际 29%) | 37k tokens | main ✓ | 11 MCPs | ⚠️ zp_max:glm-5: 85%
```

### 无配置时

```
[claude-sonnet-4-5] | 18% | 37k tokens | main ✓ | 11 MCPs
```

## 完整配置示例

```json
{
  "providers": [
    {
      "name": "zhipu",
      "baseUrl": "https://api.z.ai/api/anthropic/v1/messages",
      "apiKey": "your-key",
      "format": "anthropic",
      "info": {
        "glm-4.7": {
          "contextRange": "128K",
          "weeklyLimit": {
            "maxInputTokens": 500000,
            "maxOutputTokens": 200000,
            "enabled": true
          }
        },
        "glm-5": {
          "contextRange": "200K",
          "weeklyLimit": {
            "maxTotalTokens": 2000000,
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
  ],
  "router": {
    "haiku": "zhipu,glm-4.7",
    "sonnet": "zhipu,glm-5",
    "opus": "openrouter,anthropic/claude-opus-4"
  },
  "statusline": {
    "enabled": true,
    "sessionRetentionHours": 24
  }
}
```

## CLI 命令

```bash
ccp statusline    # 显示 statusline 输出
ccp status        # 查看服务器状态
ccp logs          # 查看日志
ccp restart       # 重启服务
```

## 常见问题

### 不显示"实际"占比

**原因**：未配置 `provider.info[model].contextRange`

**解决**：添加 `contextRange` 字段

### 不显示周限额警告

**原因**：
1. 未配置 `provider.info[model].weeklyLimit`
2. 使用量 < 80%

**解决**：添加 `weeklyLimit` 配置并增加使用量

### 显示 0 tokens

**原因**：未通过代理发送请求

**解决**：确保 `ANTHROPIC_BASE_URL=http://127.0.0.1:3456`

## 数据位置

- **数据库**：`~/.claude-code-proxy/data/statusline.db`
- **配置**：`~/.claude-code-proxy/config.json`
- **日志**：`~/.claude-code-proxy/logs/server.log`
