# Tech Stack

## 核心框架 (Core Frameworks)
- **Next.js 16 (App Router)**: 用于构建全栈 Web 应用，支持 React Server Components (RSC) 和高效路由管理。
- **React 19**: 最新的 React 版本，提供并发渲染特性及增强的性能。
- **TypeScript 5**: 强类型语言支持，确保大型代码库的可维护性与类型安全性。

## 样式与 UI (Styling & UI)
- **Tailwind CSS 4**: 现代 CSS 框架，支持高度定制化的水墨意境设计。
- **Ink 组件库**: 项目内置的 21 个水墨风专用组件，支撑“文字即界面”的交互核心。

## 数据存储 (Data Layer)
- **PostgreSQL (Supabase)**: 核心关系型数据库，处理角色、境界、功法及复杂的战斗持久化数据。
- **Drizzle ORM**: 类型安全的 TypeScript ORM，负责数据库 schema 定义与高效查询。

## 缓存与中间件 (Cache & Middleware)
- **Upstash Redis**: 提供无服务器 Redis 服务，用于状态缓存、请求频率限制及简单任务队列。

## AI 能力 (AI Integration)
- **Vercel AI SDK**: 统一的 AI 接入框架，支持流式输出和多模型 Provider 切换。
- **AI Providers**: 集成 DeepSeek, 火山引擎 ARK, Kimi 等大模型，驱动全流程的 AIGC 叙事与战斗反馈。

## 部署平台 (Deployment & DevOps)
- **Vercel**: 针对 Next.js 的首选托管平台。
- **Cloudflare Workers (OpenNext)**: 通过 OpenNext 技术将应用部署至全球边缘节点，实现极致响应。