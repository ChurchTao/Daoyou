# V6 当前实现与退役边界

2026-10-04 整理。本文替代已删除的迁移阶段记录，描述当前代码边界；不代表生产已部署或历史存量已处理。

## 当前入口

| 职责 | 实现 |
| --- | --- |
| 规则无关的确定性回合内核 | `packages/shared/src/engine/combat-v6/core` |
| 当前人物投影 | `projection/project-character.ts` 的 `projectCharacterToCombatV6` |
| 个人装备、功法和炼体 | `projection/project-character-equipment.ts`、`compose-character-manuals.ts`、`body-cultivation-v6.ts` |
| 五宗门内容 | `content/index.ts` 的 `COMBAT_V6_SECT_DEFINITIONS`、`compileCurrentSectCombatV6`、`validateCombatV6SectRegistry` |
| 当前战斗规则 | `rules-daoyou/index.ts` 的 `daoyouRulesetV6` |
| 版本戳 | `version.ts`；只保留基础投影、当前人物构筑及当前模式版本 |
| 模式编排 | `encounter`、`wild`、`sect`、`breakthrough`、`dungeon`、`tower`、`ranking` 和共享擂台模块 |
| 权威装配和入场 | `apps/api/src/combat/application/CombatV6BuildService.ts` 及各模式服务 |
| Redis 运行态 | `CombatV6RuntimeStore.ts` 及各模式运行态，保留 CAS、占用锁与幂等结算 |
| 终局与回放 | `apps/api/src/runtime/messaging/combatV6Messaging.ts`、`combatV6ReplayRepository.ts` |

个人道装、功法和灵兽属于角色，宗门心法和经脉属于成员关系。纯投影允许无宗门输入，战斗入场仍由服务器检查。气血／法力遵守 `full` / `persistent` 策略；属性变化不能隐式回满资源。

阶段投影入口、阶段宗门目录和 V2—V5 ruleset 包装已移除。基础投影和可配置公式仍是当前实现及纯领域测试使用的组件。已保存的当前版本字符串保持原值，不能按名称中的旧版本号随意删除装备实例解析或修改回放版本。

## 保留的旧资产功能

- 主页旧藏宝库：历史物品查询、详情和丢弃。
- 旧法宝焕新：旧法宝兑换当前道装、图纸和对应补偿。
- 旧功法传承：旧功法兑换玉简及对应补偿。

以上仍依赖 `legacy-items`、历史物品仓储、共享旧物品展示及法宝／功法兑换规则。身份、所有权、角色锁、战斗占用、事务和资源提交边界保持原行为。后台旧功法迁移盘点页及 API 已移除。

旧战斗记录接口、旧装配／宗门养成／蜃楼／秘境／榜单战斗兼容接口及旧聊天战报展示已删除。存储中的旧聊天消息不再返回到当前消息流；V6 战绩分享和回放保留。旧宗门任务目标不再解析 V5 战斗快照。

宗门战斗任务、旧法宝交付任务和丹药堆叠修复的三个一次性维护脚本已退役。本轮没有执行这些脚本，也没有修改目标环境任务、库存或资产。

## 数据与发布边界

旧战绩、回放、赌战、AI 蜃楼敌人和消息模板表继续标记弃用。旧藏宝库使用的造物、材料、消耗品表也标记弃用但保留运行依赖。清单及后续删除条件见 [历史表退役边界](combat-v6-legacy-table-retirement.md)。本轮不生成 DROP 迁移，不改写历史 SQL、快照和迁移账本。

代码清理不替代目标环境验收。发布仍需核对实际迁移账本、历史有效货单及托管资产、旧任务、奖励来源配置和旧写入者是否已停止；本地零记录不能证明远程环境没有存量。不得全局清空 Redis/NATS 或丢弃历史邮件附件。本轮退役的脚本不再是发布操作入口，若目标环境仍有待处理存量，应单独确定处置方案。

已发布迁移须按实际账本和备份安排执行；镜像回滚不能撤销数据库或资产变更。保持普通服务的健康检查、启动／排空、认证和消息生命周期。部署与验收说明见 [本地开发](local-development.md)、[测试规范](testing.md)、[多人战斗运行架构](online-battle-architecture-v2.md)、[NATS 领域事件](nats-domain-events.md) 和 [NestJS 迁移记录](nestjs-migration.md)。

迁移前提仍需核对：0036 涉及开发期 V6 回放清理，0039 搬迁装备身份／事实后删除旧装备实例表，0042 校验旧经脉层并导入构筑养成。不能盲目重跑这些 SQL 或手填迁移账本绕过失败；具体行为以保留的迁移文件为准。

具体规则继续以人物面板、功法、道装、宗门、灵兽和数值治理的专题设计及当前代码为准。有效的纯共享领域测试继续保留；删除阶段入口不等于删除确定性、资源和结算覆盖。
