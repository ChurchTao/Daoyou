# 蜃楼幻境逐层策略存储

2026-09-19。当前 schema 3 / combat-v6-tower-v7 / generator v2。第二阶段采用硬切，不转换旧结构。

## 权威与边界

- PostgreSQL `tower_weeks` 每周一行，JSON 保存版本、赛季及有序的 20 层策略。
- 每层保存 `floor`、`kind`、`budget.hpScale` 和 1–3 名敌人；每敌人保存层内 `id`、`archetype`、`role`、`behaviorId`、独立 `traits`、`budgetShare.hp/output`。
- 原型提供基础属性；行动由明确的 `behaviorId` 决定，编译器不根据楼层或词条猜周期。护卫关系通过 `targetEnemyId` 指向同层成员。
- 周记录不保存完整 NPC、技能、状态或预览副本。开战按当层策略和境界编译；Redis 单场快照冻结真实单位、技能、状态与行动计划，刷新不重编译。
- `tower_reward_states` 仍每角色一行，仅保存本周最多四档领取事实。硬切保留 SQL 领奖记录与已发资产，不重发奖励。

## 配置与编译

仓库内容位于 `src/shared/engine/combat-v6/tower/data/`：

- `enemies.json`：原型修正、独立词条、兼容规则、行动周期、备用动作、说明。
- `mechanics.json` / `skills.ts`：既有 V6 技能和状态及其参数。
- `generation.json`：组合池、辅助配置、普通层、铺垫映射、15/20 层变体、阵容限制。

境界基准及楼层增长继续复用 `src/shared/lib/tower/data/encounters.json`；祝福节点保存在同目录 `blessings.json`；整组份额保存在 `formations.ts`。

`strategy-templates.ts` 只负责发布时展开。先选关键层，再生成 4/9/14/19 层铺垫，最终保存全部策略。`weekly.ts` 保留有限枚举、周序套路轮转、同周不重复、至少一个多敌关键层及近三周软避重。

`strategy.ts` 校验人数、唯一主敌、份额、内容引用、行为与词条兼容、关系目标和循环。策略签名包含行动定义、关系与份额，忽略局部敌人 ID 及词条顺序。编译器不依赖生成模板白名单，模板之外的合法策略仍可编译。

`strategy-compiler.ts` 通用应用属性乘加、预算份额、技能周期及关系绑定。气血折扣只应用一次；成员不自动继承主敌词条。技能资源与控制检查交给公共引擎，法力不足按配置备用动作执行。预览也从策略与同一内容配置生成。

## 硬切与发布

只接受当前 schema/content。旧周读取为不可用，本周首次请求重新发布，SQL 冲突更新仅允许覆盖不同 contentVersion 的行；并发发布者重读同一最终行。当前版本的周行不会被普通读取覆盖。无需新增表或迁移。

塔挑战和榜单切换至 `tower:v6:configured-v7:*` 命名空间；旧塔挑战不续接。塔占用由其模式内 run key 判断，不存在另需迁移的公共战局占用记录。未执行公共 Redis 清空或旧数据批量删除。SQL 领奖幂等及资源事务保持原路径，移除了更早 Redis 领奖数据的导入逻辑。

部署时全部 API 实例应一起切换，不混跑新旧内容。仓库内容变更需构建/重启并更新内容标识；不支持同版本周中热改。未来是否保留历史解释器不在本次未发布玩法范围内。

验证与限制见 [第二阶段实施记录](tower-phase-two-design.md) 和 [数值检查](tower-scaling-design.md)。
