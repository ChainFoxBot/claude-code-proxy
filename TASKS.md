# CC-Proxy 遗留任务

## 功能完善

### 1. Image 路由功能
**优先级:** 中

**描述:** 当请求用于图像识别时，使用 `router.image` 配置的provider和模型。

**实现方案:** 参考liteLLM，检测请求内容是否包含图像（`content` 类型为 `image`），如果是则使用 `image` 路由配置。

```json
// 当前配置
"router": {
  "image": "zp,glm-4.7"  // 图像识别请求路由到此
}
```

---

### 2. WebSearch 路由功能
**优先级:** 中

**描述:** 当Claude Code调用web search tool时，使用 `router.webSearch` 配置的provider和模型。

**实现方案:** 检测请求中的 `tools` 字段，判断是否包含web search相关的tool（如 `web_search`、`browser` 等），如果是则使用 `webSearch` 路由配置。

```json
// 当前配置
"router": {
  "webSearch": "op,google/gemini-2.5-flash"  // web search请求路由到此
}
```

---

### 3. OpenAI格式Provider支持
**优先级:** 低

**描述:** 当前代码只支持Anthropic格式的provider。需要支持OpenAI兼容格式的provider（如OpenRouter）。

**实现方案:**
1. 在 `ProviderConfig` 中添加 `format` 字段：`"anthropic"` 或 `"openai"`
2. 根据provider格式选择不同的请求/响应处理逻辑
3. OpenAI格式需要：
   - 请求头: `Authorization: Bearer ${apiKey}`
   - 请求体转换：Anthropic → OpenAI格式
   - 响应体转换：OpenAI → Anthropic格式
   - 流式响应转换

```json
// 预期配置
"providers": [
  {
    "name": "openrouter",
    "baseUrl": "https://openrouter.ai/api/v1/chat/completions",
    "apiKey": "...",
    "format": "openai"  // 新增字段
  },
  {
    "name": "zp",
    "baseUrl": "https://api.z.ai/api/anthropic/v1/messages",
    "apiKey": "...",
    "format": "anthropic"
  }
]
```

---

## 优化改进

### 4. 配置热重载
**优先级:** 低

**描述:** 修改config.json后无需重启服务，自动加载新配置。

---

### 5. 健康检查增强
**优先级:** 低

**描述:** `/status` 端点增加provider连通性检测。

---

### 6. 日志查询工具
**优先级:** 低

**描述:** 提供 `ccp logs --filter` 等命令，方便查询特定请求的日志。

---

## 文档

### 7. README更新
**优先级:** 中

**描述:** 更新README.md文档，包含：
- 新的配置格式说明
- 路由配置示例
- CCP命令使用说明
