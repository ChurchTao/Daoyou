# 环境变量配置说明

## 必需配置

在项目根目录创建 `.env.local` 文件，并添加以下配置：

```bash
# OpenAI API Key（必需）
OPENAI_API_KEY=sk-your-api-key-here
```

## 可选配置

```bash
# 自定义 API 地址（用于兼容其他 OpenAI 兼容的 API）
# 例如：OpenRouter、DeepSeek、Qwen 等
OPENAI_BASE_URL=https://api.openai.com/v1

# 使用的模型名称（默认：gpt-4o-mini）
# 推荐模型：
# - gpt-4o-mini（性价比高，速度快）
# - gpt-4o（质量更高，但更贵）
# - gpt-3.5-turbo（便宜但质量较低）
OPENAI_MODEL=gpt-4o-mini
```

## 获取 API Key

1. **OpenAI 官方**：访问 https://platform.openai.com/api-keys
2. **OpenRouter**：访问 https://openrouter.ai/keys（支持多种模型）
3. **DeepSeek**：访问 https://platform.deepseek.com/api_keys
4. **其他兼容服务**：确保支持 OpenAI 兼容的 API 格式

## 注意事项

- `.env.local` 文件不会被提交到 Git（已在 .gitignore 中）
- 修改环境变量后需要重启开发服务器
- 生产环境需要在部署平台（如 Vercel）配置环境变量
