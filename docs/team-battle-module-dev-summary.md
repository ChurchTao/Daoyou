# 多人战斗模块（battle-team）开发总结

> 面向共同开发者的工作交接说明。本文记录 2026-08-07 当日完成的全部开发工作，包括新增/修改的目录与文件、架构设计、运行方式与后续建议。

## 一、工作概述

当日从零搭建了一套**多人团队战斗引擎**（`battle-team`），与现有单人 `battle-v5` 引擎并行存在、互不干扰。引擎支持可变队伍规模（已验证 2v2 与 5v5），实现了三种技能类型（光环 / 概率触发 / 条件响应）加主动技能与追击，去除了法力系统，引入阵型站位、出手顺序、嘲讽/蓄力等机制，并配套完整的可视化测试页面与战后统计图表。

**已验证能力**：lint 通过、build（client + server）通过、浏览器运行 2v2/5v5 演武均可正常推进至胜负判定，五种技能（恢复光环 / 连击光环 / 追击 / 蓄力 / 嘲讽）均按预期触发。

## 二、新增目录

以下目录均为当日新建，不覆盖任何既有代码：

### 1. 共享引擎层（纯逻辑，可单元测试）

- [src/shared/engine/battle-team/](file:///c:/Users/Administrator/Desktop/Daoyou-master/src/shared/engine/battle-team) — 多人战斗引擎根目录
  - [abilities/](file:///c:/Users/Administrator/Desktop/Daoyou-master/src/shared/engine/battle-team/abilities) — 技能基类：光环、概率触发、条件响应、普攻
  - [library/](file:///c:/Users/Administrator/Desktop/Daoyou-master/src/shared/engine/battle-team/library) — **可扩展技能库**：5 个实现技能 + 普攻助手 + 2v2/5v5 预设单位
  - [presets/](file:///c:/Users/Administrator/Desktop/Daoyou-master/src/shared/engine/battle-team/presets) — 基础预设技能与单位（2v2 默认预设用）

### 2. 前端展示层

- [src/react-app/components/feature/team-battle/](file:///c:/Users/Administrator/Desktop/Daoyou-master/src/react-app/components/feature/team-battle) — 团队战斗可视化组件集（9 个文件）
- [src/react-app/routes/team-battle-test/](file:///c:/Users/Administrator/Desktop/Daoyou-master/src/react-app/routes/team-battle-test) — 演武测试页面路由

### 3. 文档

- [.trae/documents/team-battle-2v2-test-module.md](file:///c:/Users/Administrator/Desktop/Daoyou-master/.trae/documents/team-battle-2v2-test-module.md) — 2v2 模块设计文档
- [.trae/documents/team-battle-skill-library.md](file:///c:/Users/Administrator/Desktop/Daoyou-master/.trae/documents/team-battle-skill-library.md) — 技能库设计文档

## 三、新增文件清单（按层分组）

### 共享引擎层 `src/shared/engine/battle-team/`

| 文件 | 职责 |
| --- | --- |
| [types.ts](file:///c:/Users/Administrator/Desktop/Daoyou-master/src/shared/engine/battle-team/types.ts) | 全部类型定义：`TeamBattleRecord`、`TeamBattleLogEvent`（含 damage/heal/charge/taunt 等）、`TeamBattleFrame`、`TeamUnitSnapshot` |
| [TeamBattleEngine.ts](file:///c:/Users/Administrator/Desktop/Daoyou-master/src/shared/engine/battle-team/TeamBattleEngine.ts) | 引擎主循环：INIT → ROUND_START → ACTION → VICTORY_CHECK，每回合按实时身法重排出手顺序 |
| [TeamUnit.ts](file:///c:/Users/Administrator/Desktop/Daoyou-master/src/shared/engine/battle-team/TeamUnit.ts) | 单位实体：六维属性、气血/护盾、存活判定、嘲讽/蓄力状态读写 |
| [Team.ts](file:///c:/Users/Administrator/Desktop/Daoyou-master/src/shared/engine/battle-team/Team.ts) | 队伍聚合：前排/后排分组、幸存单位查询 |
| [Formation.ts](file:///c:/Users/Administrator/Desktop/Daoyou-master/src/shared/engine/battle-team/Formation.ts) | 阵型：前排 70% / 后排 30% 命中权重（技能可声明忽略站位） |
| [TargetSelection.ts](file:///c:/Users/Administrator/Desktop/Daoyou-master/src/shared/engine/battle-team/TargetSelection.ts) | 目标选择：按策略 + 站位权重 + 嘲讽强制重定向 |
| [DamageResolver.ts](file:///c:/Users/Administrator/Desktop/Daoyou-master/src/shared/engine/battle-team/DamageResolver.ts) | 伤害结算：属性×系数 / 固定伤害（蓄力）、暴击、护盾吸收、AfterDealDamage 回调 |
| [TeamVictorySystem.ts](file:///c:/Users/Administrator/Desktop/Daoyou-master/src/shared/engine/battle-team/TeamVictorySystem.ts) | 胜负判定：一方全灭即结束，不再依赖单主将 |
| [TeamBattleRecorder.ts](file:///c:/Users/Administrator/Desktop/Daoyou-master/src/shared/engine/battle-team/TeamBattleRecorder.ts) | 事件流水 + 状态时间线录制（前端回放数据源） |
| [TeamBattleEventBus.ts](file:///c:/Users/Administrator/Desktop/Daoyou-master/src/shared/engine/battle-team/TeamBattleEventBus.ts) | 实例级事件总线（避免单例冲突，支持多场战斗并行） |
| [TeamAbility.ts](file:///c:/Users/Administrator/Desktop/Daoyou-master/src/shared/engine/battle-team/TeamAbility.ts) | 技能抽象基类 + `TeamAbilityContext` + `TeamBattleEngineApi`（setPendingCast/setTaunt 等） |
| [mockPresets.ts](file:///c:/Users/Administrator/Desktop/Daoyou-master/src/shared/engine/battle-team/mockPresets.ts) | `runPresetTeamBattle` 入口，支持 `default` / `library` / `library5v5` 三种预设 |
| [index.ts](file:///c:/Users/Administrator/Desktop/Daoyou-master/src/shared/engine/battle-team/index.ts) | 统一导出（引擎类、技能库、类型） |

**abilities/** 基类：

| 文件 | 职责 |
| --- | --- |
| [BasicStrike.ts](file:///c:/Users/Administrator/Desktop/Daoyou-master/src/shared/engine/battle-team/abilities/BasicStrike.ts) | 普攻技能（kind: `basic`） |
| [AuraAbility.ts](file:///c:/Users/Administrator/Desktop/Daoyou-master/src/shared/engine/battle-team/abilities/AuraAbility.ts) | 光环基类：存活即生效，回合结束触发 |
| [ChanceTriggerAbility.ts](file:///c:/Users/Administrator/Desktop/Daoyou-master/src/shared/engine/battle-team/abilities/ChanceTriggerAbility.ts) | 概率触发基类：友方普攻后按概率追加普攻 |
| [ConditionalResponseAbility.ts](file:///c:/Users/Administrator/Desktop/Daoyou-master/src/shared/engine/battle-team/abilities/ConditionalResponseAbility.ts) | 条件响应基类：自身普攻后触发追击 |

**library/** 可扩展技能库（新增技能请放这里）：

| 文件 | 职责 |
| --- | --- |
| [RecoveryAura.ts](file:///c:/Users/Administrator/Desktop/Daoyou-master/src/shared/engine/battle-team/library/RecoveryAura.ts) | 恢复光环：回合结束治疗全体幸存友军 100 HP |
| [ComboAura.ts](file:///c:/Users/Administrator/Desktop/Daoyou-master/src/shared/engine/battle-team/library/ComboAura.ts) | 连击光环：友方普攻后 30% 概率追加普攻（可触发追击，不递归） |
| [Pursuit.ts](file:///c:/Users/Administrator/Desktop/Daoyou-master/src/shared/engine/battle-team/library/Pursuit.ts) | 追击：自身普攻后 60% 概率对原目标追加 3 倍普攻伤害 |
| [ChargeAbility.ts](file:///c:/Users/Administrator/Desktop/Daoyou-master/src/shared/engine/battle-team/library/ChargeAbility.ts) | 蓄力：80% 概率发动，准备一回合后对敌方全体造成 300 真实伤害 |
| [TauntAbility.ts](file:///c:/Users/Administrator/Desktop/Daoyou-master/src/shared/engine/battle-team/library/TauntAbility.ts) | 嘲讽：70% 概率发动，本回合敌方所有普攻只能以自己为目标 |
| [basicAttackHelpers.ts](file:///c:/Users/Administrator/Desktop/Daoyou-master/src/shared/engine/battle-team/library/basicAttackHelpers.ts) | 普攻执行助手（选目标 + 结算 + 日志） |
| [presetLibraryUnits.ts](file:///c:/Users/Administrator/Desktop/Daoyou-master/src/shared/engine/battle-team/library/presetLibraryUnits.ts) | 2v2 与 5v5 预设单位（十角色不对称阵容 + Roster 信息导出） |
| [index.ts](file:///c:/Users/Administrator/Desktop/Daoyou-master/src/shared/engine/battle-team/library/index.ts) | 技能库统一导出 |

### 前端层 `src/react-app/`

| 文件 | 职责 |
| --- | --- |
| [routes/team-battle-test/route.tsx](file:///c:/Users/Administrator/Desktop/Daoyou-master/src/react-app/routes/team-battle-test/route.tsx) | 测试页主组件：控制台 / 阵容一览 / 战斗结果 / 战后统计 |
| [components/feature/team-battle/TeamBattleControls.tsx](file:///c:/Users/Administrator/Desktop/Daoyou-master/src/react-app/components/feature/team-battle/TeamBattleControls.tsx) | 种子输入 + 阵容选择 + 开战按钮（使用 InkUI 组件） |
| [components/feature/team-battle/TeamBattleArena.tsx](file:///c:/Users/Administrator/Desktop/Daoyou-master/src/react-app/components/feature/team-battle/TeamBattleArena.tsx) | 战场区域：甲乙双方单位卡片 + 回合标识（支持 5v5 紧凑布局） |
| [components/feature/team-battle/TeamUnitCard.tsx](file:///c:/Users/Administrator/Desktop/Daoyou-master/src/react-app/components/feature/team-battle/TeamUnitCard.tsx) | 单位卡片：血条/护盾/状态标记，支持 compact 模式 |
| [components/feature/team-battle/TeamBattlePlayback.tsx](file:///c:/Users/Administrator/Desktop/Daoyou-master/src/react-app/components/feature/team-battle/TeamBattlePlayback.tsx) | 回放控制：播放/暂停/步进/重置/倍速 |
| [components/feature/team-battle/useTeamBattlePlayback.ts](file:///c:/Users/Administrator/Desktop/Daoyou-master/src/react-app/components/feature/team-battle/useTeamBattlePlayback.ts) | 回放状态 hook：帧索引、进度、自动播放定时器 |
| [components/feature/team-battle/TeamBattleLog.tsx](file:///c:/Users/Administrator/Desktop/Daoyou-master/src/react-app/components/feature/team-battle/TeamBattleLog.tsx) | 战斗日志：按 seq 滚动高亮当前行 |
| [components/feature/team-battle/combatLogPresentation.ts](file:///c:/Users/Administrator/Desktop/Daoyou-master/src/react-app/components/feature/team-battle/combatLogPresentation.ts) | 日志事件 → 显示行映射（颜色/加粗，处理 charge 等事件） |
| [components/feature/team-battle/TeamBattleRoster.tsx](file:///c:/Users/Administrator/Desktop/Daoyou-master/src/react-app/components/feature/team-battle/TeamBattleRoster.tsx) | 阵容一览面板：十角色六维属性 + 技能说明 |
| [components/feature/team-battle/TeamBattleStats.tsx](file:///c:/Users/Administrator/Desktop/Daoyou-master/src/react-app/components/feature/team-battle/TeamBattleStats.tsx) | **战后统计**：SVG 折线图（X 回合 / Y 可切换伤害·治疗）+ 汇总卡片 + 单位明细表 |

### 服务端层 `src/server/`

| 文件 | 职责 |
| --- | --- |
| [routes/api/team-battle-test.router.ts](file:///c:/Users/Administrator/Desktop/Daoyou-master/src/server/routes/api/team-battle-test.router.ts) | `POST /api/team-battle-test/run` 路由：接收 seed/preset/maxTurns，调用 `runPresetTeamBattle` 返回 `TeamBattleRecord` |

### 共享契约 `src/shared/contracts/`

| 文件 | 职责 |
| --- | --- |
| [teamBattleTest.ts](file:///c:/Users/Administrator/Desktop/Daoyou-master/src/shared/contracts/teamBattleTest.ts) | 请求/响应 Zod schema（`TeamBattlePreset` 含 `default`/`library`/`library5v5`） |

## 四、修改的已有文件

仅触及 3 个既有文件，均为接入新模块所需的最小改动：

| 文件 | 改动内容 |
| --- | --- |
| [src/server/routes/api/index.ts](file:///c:/Users/Administrator/Desktop/Daoyou-master/src/server/routes/api/index.ts) | 注册 `team-battle-test.router` 到 API 路由树 |
| [src/react-app/router.tsx](file:///c:/Users/Administrator/Desktop/Daoyou-master/src/react-app/router.tsx) | 新增 `/team-battle-test` 懒加载路由 |
| [src/shared/contracts/teamBattleTest.ts](file:///c:/Users/Administrator/Desktop/Daoyou-master/src/shared/contracts/teamBattleTest.ts) | 扩展 Zod schema 支持 `library5v5` 预设 |

> 注：当日未修改任何 `battle-v5` 既有代码，两个引擎完全独立。

## 五、架构与关键设计

### 1. 与 battle-v5 的关系
`battle-team` 是**并行新模块**，不继承、不依赖 `battle-v5` 的战斗循环；仅复用 `battle-v5/core/types` 中的 `AttributeType`/`DamageType`/`DamageSource` 基础枚举。原有单人战斗不受影响。

### 2. 技能系统分层
- `TeamAbility`（基类）→ `abilities/*`（四类基类：光环/概率触发/条件响应/普攻）→ `library/*`（具体实现）
- **新增技能的正确位置**：`library/` 目录，实现对应基类并在 `library/index.ts` 与 `mockPresets.ts` 中注册即可被前端选用。
- 技能通过 `TeamAbilityContext` 读写引擎状态（`setPendingCast`/`clearPendingCast`/`setTaunt`/`getEnemyTaunt`/`releasePendingCast`/`clearRoundTaunts`）。

### 3. 事件驱动 + 实例级总线
- `TeamBattleEventBus` 为**实例级**（非全局单例），避免多场战斗并发时事件串台。
- 技能订阅内部事件（`BeforeDealDamage`/`AfterDealDamage`/`RoundEnded` 等）实现被动触发。
- 内置反递归保护：连击光环触发的普攻可再触发追击，但连击不自身递归。

### 4. 去法力 + 阵型站位
- 移除法力消耗系统，技能改由概率/冷却/次数限制。
- 前排 70% / 后排 30% 命中权重；嘲讽可强制重定向；技能可声明忽略站位直接锁定目标。
- 出手顺序每回合按实时身法重排（身法可被 Buff/Debuff 动态改变）。

### 5. 前端回放与统计
- `TeamBattleRecorder` 同时录制事件流水（`events`）与状态时间线（`stateTimeline.frames`），前端按帧回放。
- `TeamBattleStats` 从 `events` 聚合每回合伤害/治疗（按 `actorId` 归属阵营），用内联 SVG 绘制双曲线（甲队 crimson / 乙队 teal），无第三方图表库依赖。
- UI 统一采用项目 ink/paper 设计系统（`bg-paper`/`text-ink`/`text-crimson`/虚线边框），复用 `InkInput`/`InkSelect`/`InkButton`。

## 六、运行与验证

### 启动
```bash
# 需先启动 Docker 依赖（PostgreSQL/Redis/NATS）
docker compose -f docker-compose.dev.yml up -d
bun run dev
```

### 访问测试页
浏览器打开 `http://localhost:5173/team-battle-test`，选择阵容（推荐「五五技能库」），点击「开战」。

### 验证清单
- [x] `bun run lint` 通过
- [x] `bun run build`（client + server）通过
- [x] 2v2 / 5v5 浏览器可视化均能推进至胜负判定
- [x] 五种技能均按预期触发（嘲讽重定向、蓄力 300 AoE、追击+连击链、恢复光环）
- [x] 战后统计图表可切换伤害/治疗曲线，数据与日志一致

## 七、后续开发建议

1. **新增技能**：在 [library/](file:///c:/Users/Administrator/Desktop/Daoyou-master/src/shared/engine/battle-team/library) 新建文件实现 `TeamAbility` 子类，于 `library/index.ts` 与 `library/presetLibraryUnits.ts` 注册。技能建议携带 `description` 字段供 Roster 面板展示。
2. **接入真实角色数据**：当前 `presetLibraryUnits.ts` 为硬编码测试单位；后续可将 `cultivators` 真实属性映射为 `TeamUnitOptions`，由玩家组队进入战斗。
3. **持久化战斗记录**：`TeamBattleRecord` 目前仅内存返回；如需战报回看，可落库到 `wanjiedaoyou_battle_records_v2` 或新建团队战报表。
4. **统计维度扩展**：`TeamBattleStats` 目前按阵营聚合；可增加按单位筛选、伤害类型分布（物理/法术/真实）等维度。
5. **平衡性调整**：`Formation` 命中权重、`DamageResolver` 系数、技能概率/数值均集中在引擎层，便于统一调参。
6. **单元测试**：引擎为纯共享逻辑（`src/shared`），符合项目单元测试规则，可为 `TargetSelection`/`DamageResolver`/技能触发补测。

## 八、注意事项

- 本仓库**非 git 仓库**（无 `.git`），以上变更无 commit 记录，请接手者通过文件修改时间或本说明定位。
- 引擎事件 `round` 从 1 开始；`TeamBattleStats` 聚合时已处理边界。
- 嘲讽效果仅持续一回合，`clearRoundTaunts` 在回合结束自动清理。
- 蓄力使用 `DamagePayload.fixedAmount` 跳过属性计算，直接以固定值作为攻击基数。
