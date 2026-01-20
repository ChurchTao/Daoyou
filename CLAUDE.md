# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

**万界道友（daoyou.org）** 是一个 AIGC 驱动的文字修仙游戏，采用开源协议 GPL-3.0。项目结合 AI 生成内容与严谨的数值系统，提供高自由度的角色塑造体验。

## 常用命令

```bash
# 开发
npm run dev          # 启动开发服务器（Next.js）

# 构建
npm run build        # 生产环境构建
npm run start        # 启动生产服务器

# 代码质量
npm run lint         # ESLint 检查
npm run format       # Prettier 格式化

# 测试
npm test             # 运行 Jest 测试

# 数据库
npx drizzle-kit push # 推送 schema 到数据库
```

## 技术栈

- **前端**: Next.js 16.1.3 (App Router), React 19.2.3, TypeScript 5
- **样式**: Tailwind CSS 4
- **数据库**: PostgreSQL (Supabase), Drizzle ORM
- **缓存**: Upstash Redis
- **AI**: DeepSeek / OpenAI (通过 @ai-sdk)
- **测试**: Jest 30.2.0, ts-jest 29.4.6

## 架构概览

项目采用**三层架构**，职责清晰分离：

```
┌─────────────────────────────────────────┐
│         Presentation Layer              │
│  (Next.js Pages + React Components)     │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│         API Layer (Route Handlers)      │
│         (app/api/*)                     │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│         Service Layer                   │
│  (lib/services/* + lib/repositories/*)  │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│         Engine Layer (Pure Logic)       │
│  (engine/*) - 独立于UI的纯游戏逻辑      │
└─────────────────────────────────────────┘
```

### 关键设计原则

1. **引擎层纯逻辑**: `engine/` 目录完全独立于 UI 和框架，可直接在 Node 环境运行和测试
2. **效果系统驱动**: 游戏中大部分机制通过 Effect 系统实现，包含 17 个触发时机和 20 种效果类型
3. **AI 与规则结合**: AI 负责内容生成（战报、背景、描述），引擎负责数值计算

## 核心目录结构

```
├── app/                      # Next.js App Router
│   ├── (website)/           # 网站展示页面
│   ├── (game)/              # 游戏主界面
│   └── api/                 # API 路由
├── components/              # React 组件
│   └── ui/                 # Ink 组件库（水墨风格基础组件）
├── engine/                 # 核心游戏引擎（纯逻辑）
│   ├── battle/            # 战斗引擎（BattleEngine.v2.ts）
│   ├── buff/              # Buff 系统（BuffManager, BuffTemplateRegistry）
│   ├── effect/            # 效果系统（EffectEngine, 20 种效果类型）
│   ├── creation/          # 创建引擎（角色/技能/法宝，策略模式）
│   └── cultivator/        # 角色引擎
├── lib/                    # 基础设施层
│   ├── drizzle/           # 数据库 schema 和连接
│   ├── repositories/      # 数据仓储层
│   ├── services/          # 业务服务层
│   └── utils/             # 工具函数
├── types/                  # TypeScript 类型定义
│   ├── constants.ts       # 游戏常量（元素、境界、状态效果等）
│   ├── dictionaries.ts    # 显示信息映射
│   └── cultivator.ts      # 角色数据模型
├── utils/                  # 工具函数
│   ├── aiClient.ts        # AI 客户端封装（text, stream_text, object, tool）
│   └── prompts.ts         # AI 提示词
└── config/                 # 配置文件
    └── buffTemplates.ts   # Buff 模板配置（20+ 模板）
```

## 数据库 Schema

**表前缀**: `wanjiedaoyou_`

### 核心表

- **cultivators**: 角色主表，包含基本信息、境界、属性、经济、状态
- **spiritual_roots**: 灵根表（1对多）
- **pre_heaven_fates**: 先天命格（1对多）
- **cultivation_techniques**: 功法（1对多）
- **skills**: 技能（1对多）
- **artifacts**: 法宝（1对多）
- **consumables**: 消耗品（1对多，目前类型只有"丹药"）
- **materials**: 材料（1对多）
- **equipped_items**: 装备状态（1对1）
- **battle_records**: 战斗记录（完整 BattleEngineResult 快照 + AIGC 战报）
- **mails**: 邮件系统
- **dungeon_histories**: 副本历史
- **retreat_records**: 闭关记录
- **breakthrough_history**: 突破历史

### JSONB 字段

大部分表使用 JSONB 存储复杂数据：
- `effects`: EffectConfig[] - 效果配置数组
- `persistent_statuses`: 持久状态
- `cultivation_progress`: 修为进度
- `battle_result`: 完整战斗结果快照

## 游戏常量系统

**文件**: `types/constants.ts`

### 元素系统
8 种元素：金木水火土风雷冰

### 境界系统
9 个境界：炼气→筑基→金丹→元婴→化神→炼虚→合体→大乘→渡劫
每个境界 4 个阶段：初期、中期、后期、圆满

### 属性上限
`REALM_STAGE_CAPS`: 境界+阶段对应的属性上限（圆满与后期共享上限）

### 灵石产出
- `REALM_YIELD_RATES`: 境界历练收益基数
- `RANKING_REWARDS`: 排行榜每日结算奖励

### 状态效果
24 种状态效果，分为三类：
- 战斗状态：Buff/Debuff/Control/DOT
- 持久状态：weakness, enlightenment 等
- 环境状态：scorching, freezing 等

## 效果系统

**文件**: `engine/effect/types.ts`

### 触发时机 (EffectTrigger)
17 个触发时机，包括：
- 属性计算：ON_STAT_CALC
- 战斗流程：ON_TURN_START, ON_TURN_END, ON_BATTLE_START, ON_BATTLE_END
- 命中相关：ON_CALC_HIT_RATE, ON_DODGE, ON_CRITICAL_HIT, ON_BEING_HIT
- 伤害相关：ON_BEFORE_DAMAGE, ON_AFTER_DAMAGE, ON_SKILL_HIT, ON_KILL
- 系统事件：ON_BREAKTHROUGH, ON_HEAL, ON_CONSUME

### 效果类型 (EffectType)
20 种效果类型，包括：
- 基础：StatModifier, Damage, Heal, AddBuff, Shield, LifeSteal 等
- P0（核心）：ElementDamageBonus, HealAmplify, ManaRegen, ManaDrain, Dispel
- P1（进阶）：ExecuteDamage, TrueDamage, CounterAttack, BonusDamage

### 属性修正阶段 (StatModifierType)
4 个阶段，决定属性计算顺序：
1. BASE（基础值）
2. FIXED（固定值加成）
3. PERCENT（百分比加成）
4. FINAL（最终修正）

## Buff 系统

**文件**: `engine/buff/`, `config/buffTemplates.ts`

- **BuffManager**: Buff 管理器，处理添加/移除/触发
- **BuffMaterializer**: Buff 实体化器，将模板转为可执行的 Buff
- **BuffTemplateRegistry**: Buff 模板注册表
- **20+ Buff 模板**: 包括属性加成、状态效果、特殊机制等

## 战斗引擎

**文件**: `engine/battle/BattleEngine.v2.ts`

- 基于时间轴的回合制战斗
- 支持 SSE 流式输出
- 完整的技能执行器（SkillExecutor）
- 伤害管道（DamagePipeline）
- 属性计算系统

## 创建系统

**文件**: `engine/creation/`

策略模式实现：
- **CreationEngine**: 创建引擎主控
- **EffectMaterializer**: 效果实体化器
- **SkillCreationStrategy**: 技能创建策略
- **GongFaCreationStrategy**: 功法创建策略
- **RefiningStrategy**: 炼器策略
- **AlchemyStrategy**: 炼丹策略

## AI 集成

**文件**: `utils/aiClient.ts`

支持的 Provider：
- DeepSeek
- 火山引擎 ARK

主要函数：
- `text()`: 直接生成文本
- `stream_text()`: 流式生成
- `object()`: 生成结构化数据
- `objectArray()`: 生成结构化数组
- `tool()`: 工具调用

AI 应用场景：
- 角色背景生成
- 战斗播报生成（带 HTML 标签）
- 突破故事生成
- 奇遇场景生成
- 物品描述生成

## 消耗品系统

当前消耗品类型（`types/constants.ts`）：
- `CONSUMABLE_TYPE_VALUES = ['丹药']`

**注意**: 用户计划添加"符箓"类型，用于承载系统性能力（如重塑先天命格、随机抽取功法/神通）。

## 代码规范

### 语言使用
- 代码：英文变量名和注释
- UI/内容：简体中文
- 数据库：表前缀 `wanjiedaoyou_`，级联删除 `onDelete: 'cascade'`

### 路径别名
- `@/`: 项目根目录

### 代码风格
- ESLint：Next.js 配置
- Prettier：单引号、分号、Tab 宽度 2
- 插件：prettier-plugin-tailwindcss, prettier-plugin-organize-imports

## 测试策略

- **引擎层**: 12 个测试文件，覆盖战斗、效果、创建系统
- **工具层**: 4 个测试文件，覆盖修炼、排行榜、命格、材料生成
- 测试环境：Node 环境，超时 10 秒

## 各模块 CLAUDE.md

项目包含多个子模块的详细文档：
- `engine/battle/CLAUDE.md`: 战斗系统详解
- `engine/creation/CLAUDE.md`: 创建系统详解
- `engine/effect/CLAUDE.md`: 效果系统详解
- `config/CLAUDE.md`: 配置系统详解
- `types/CLAUDE.md`: 类型定义详解

## 环境变量

必需的环境变量（参考 `.env.example`）：

```bash
# AI 配置
PROVIDER_CHOOSE=ark|deepseek
OPENAI_API_KEY=
OPENAI_BASE_URL=
OPENAI_MODEL=

# Supabase 配置
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
DATABASE_URL=

# Redis 配置
REDIS_URL=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Cron 任务
CRON_SECRET=
```

## 部署

- **平台**: Vercel
- **Cron 任务**：
  - 每日 01:00：刷新坊市
  - 每日 00:00：发放排行榜奖励
