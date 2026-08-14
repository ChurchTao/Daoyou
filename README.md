# 万界道友

<p align="center">
  <img src="public/assets/daoyou_logo.webp" alt="万界道友 Logo" width="200" />
</p>

<p align="center">
  <strong>一款 AIGC 驱动、高自由度文字体验、修仙世界观的开源游戏项目。</strong>
</p>

> 本仓库当前实现为 `Hono + React SPA`。这里的说明以现有代码为准，已不再适用于旧版 Next.js 架构。

---

## 项目愿景

**《万界道友》** 旨在打造一套"修仙宇宙的开源骨架"。它不仅是一个可以直接游玩的文字修仙游戏，更是一套高度结构化、AIGC 友好的底层架构。我们希望通过**高自由度的输入 + AIGC 反馈**，结合**严格的数值与战斗模型**，让创作者能够在此基础上快速搭建属于自己的修仙世界。

- **玩法层面**：鼓励玩家通过文字描述塑造角色，AI 实时生成反馈，带来"千人千面"的体验。
- **系统层面**：保持系统的稳定、正交与可组合性，确保数值平衡与逻辑自洽。
- **表现层面**：坚持"文字即界面"，采用水墨意境 UI，适配移动端体验。

## 核心特色

- 🤖 **AIGC 深度集成**：角色背景、战斗播报、奇遇故事、物品描述全流程 AI 生成，每一次体验都独一无二。当前统一使用 DeepSeek。
- ⚔️ **深度战斗引擎**：基于时间轴的回合制战斗，支持神通、法宝、状态效果（Buff/Debuff）、五行克制、伤害管道等复杂机制。
- ☯️ **严谨修仙体系**：完整的境界（炼气至渡劫）、灵根（金木水火土风雷冰）、功法、命格、炼丹炼器系统。
- 📱 **水墨风 UI**：基于 `Ink` 组件库（21 个组件）打造的纯文字 UI，简洁优雅，沉浸感强。
- 🛠️ **开发者友好**：清晰的分层架构（Engine/Service/API），TypeScript 全栈开发，易于扩展与二创。

## 🖼 游戏画面

<p align="center">
  <img src="https://page-r2.daoyou.org/index/Xnip2026-02-02_18-45-05.png" alt="游戏主界面" width="260" />
  <img src="https://page-r2.daoyou.org/index/Xnip2026-02-02_18-50-45.png" alt="主界面下方信息" width="260" />
  <img src="https://page-r2.daoyou.org/index/Xnip2026-02-02_19-03-00.png" alt="修仙界大地图" width="260" />
</p>

<p align="center">
  <img src="https://page-r2.daoyou.org/index/Xnip2026-02-02_19-01-06.png" alt="造物仙炉" width="260" />
  <img src="https://page-r2.daoyou.org/index/Xnip2026-02-02_19-01-32.png" alt="藏经阁" width="260" />
  <img src="https://page-r2.daoyou.org/index/Xnip2026-02-02_19-02-21.png" alt="云游坊市" width="260" />
</p>

## 技术概览

- 服务端：`Hono 4` + `Bun`
- 前端：`React 19` + `React Router 7` + `Vite 8`
- 样式：`Tailwind CSS 4`
- 数据库：`PostgreSQL` + `Drizzle ORM`
- 缓存 / 分布式协调：`Redis`
- 消息与实时广播：`NATS JetStream` + `NATS Core`
- 认证：`Better Auth`
- AI 能力：`AI SDK` + `DeepSeek`

## 仓库布局

```text
.
├── src/index.ts                 # Bun 后端入口，导出 Hono API 与 WebSocket 配置
├── src/server/                  # Hono API、认证、服务层、数据库访问
├── src/react-app/               # React SPA
├── src/shared/                  # 共享引擎、配置、类型、契约
├── drizzle/                     # 业务表 Drizzle migrations
├── drizzle-auth/                # Better Auth Drizzle migrations
├── scripts/                     # 部署脚本与生产/NATS Compose
├── docker/Dockerfile.app        # Bun 主服务镜像
└── vite.config.ts
```

## 本地开发与部署

环境要求、环境变量、数据库初始化、本地开发、构建、Docker、生产 cron 与部署脚本说明已整理到 [docs/development.md](docs/development.md)。

## 贡献指南

欢迎道友们共建这个修仙世界！

1. Fork 本仓库。
2. 创建特性分支 (`git checkout -b feature/NewFeature`)。
3. 提交更改 (`git commit -m 'Add some NewFeature'`)。
4. 推送到分支 (`git push origin feature/NewFeature`)。
5. 提交 Pull Request。

开发与部署的完整约定请参见 [本地开发与部署](#本地开发与部署)。

## 💬 交流群

欢迎加入《万界道友》QQ交流群，与其他道友共同探讨修仙大计:

- 1群: 1107586928

## 💖 赞助与鸣谢

感谢每一位帮助《万界道友》持续维护与成长的道友。新的赞助统一通过 [爱发电](https://afdian.com/u/baef2b20501311f09da252540025c377) 进行；具体规则请见 [赞助说明](SPONSORING.md)，公开赞助人名单与历史鸣谢请见 [SPONSORS.md](SPONSORS.md)。

<p align="center">
  <a href="https://afdian.com/u/baef2b20501311f09da252540025c377">
    <img src="sponsorkit/sponsors.svg" alt="爱发电赞助人名单" width="720" />
  </a>
</p>

赞助名单不会展示支付信息或具体金额，赞助不会影响游戏数值、账号权益或项目决策权。

## 🤝 致谢

特别鸣谢以下贡献者：

- [tpoisonooo](https://github.com/tpoisonooo)：在 [Issue #25](https://github.com/ChurchTao/Daoyou/issues/25) 中提供了宝贵的 LLM 优化思路与方法论，极大地提升了游戏的 AIGC 体验。

## 开源协议

本项目采用 [GNU General Public License v3.0](LICENSE) 协议开源。

这意味着你可以自由地：

- 共享：在任何媒介或格式下复制和分发材料
- 改编：混合、转换和构建材料

但必须遵守以下条款：

- **署名**：必须提供适当的归属。
- **相同方式共享**：如果你混合、转换或基于该材料进行构建，你必须在相同的协议下分发你的贡献。

详情请查阅 [LICENSE](LICENSE) 文件。

---

<p align="center">
  愿你在万界中得一二知己，共证长生。
</p>
