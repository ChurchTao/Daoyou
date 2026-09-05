# combat-v6

完整的新体系设计、隔离边界和分阶段迁移路线以
[`docs/combat-v6-mhxy-redesign-roadmap.md`](../../../../docs/combat-v6-mhxy-redesign-roadmap.md)
为 canonical 文档。角色字段的逐项兼容分析见
[`CHARACTER_COMPATIBILITY.md`](./CHARACTER_COMPATIBILITY.md)，新版道装领域见
[`docs/combat-v6-equipment-system-design.md`](../../../../docs/combat-v6-equipment-system-design.md)，
新版功法领域见
[`docs/combat-v6-manual-system-design.md`](../../../../docs/combat-v6-manual-system-design.md)，Phase 5A 数值见
[`docs/combat-v6-manual-phase-5a-balance.md`](../../../../docs/combat-v6-manual-phase-5a-balance.md)，红尘剑宗完整纵切见
[`docs/combat-v6-lingxiao-datang-sect-design.md`](../../../../docs/combat-v6-lingxiao-datang-sect-design.md)。
幽都经典双流派纵切见
[`docs/combat-v6-youdu-classic-sect-design.md`](../../../../docs/combat-v6-youdu-classic-sect-design.md)。
无相禅宗治疗防护纵切见
[`docs/combat-v6-wuxiang-sect-design.md`](../../../../docs/combat-v6-wuxiang-sect-design.md)。
天衍圣地河洛九宫纵切见
[`docs/combat-v6-tianyan-sect-design.md`](../../../../docs/combat-v6-tianyan-sect-design.md)。
九劫天宫经典双流派纵切见
[`docs/combat-v6-jiujie-sect-design.md`](../../../../docs/combat-v6-jiujie-sect-design.md)。
Phase 7A 遭遇与训练 Host 见
[`docs/combat-v6-phase-7a-training-host-design.md`](../../../../docs/combat-v6-phase-7a-training-host-design.md)。
Phase 7B 权威构筑与训练房接入见
[`docs/combat-v6-phase-7b-authoritative-training-design.md`](../../../../docs/combat-v6-phase-7b-authoritative-training-design.md)。
Phase 7C Redis权威运行时与回放归档见
[`docs/combat-v6-phase-7c-redis-runtime-replay-design.md`](../../../../docs/combat-v6-phase-7c-redis-runtime-replay-design.md)。

`core/` 当前是
`/Users/churcht/Documents/GitHub/mhxy-combat-copy/packages/engine/src`
的完整源码副本，作为梦幻式 we-go 回合战斗的隔离内核。

当前状态：

- 已复制纯战斗核心，包括指令、回合管线、单位、状态、效果、钩子、目标、表达式、确定性随机与战斗会话。
- Phase 0 已建立 ESLint 隔离门禁，阻止 v6 导入 battle-v5 / creation-v2，并阻止 core 反向依赖规则、投影和内容层。
- Phase 1 已交付 `rules-daoyou`、`character_panel_v1`、5～180 人物等级映射、`full/persistent` 资源策略、结构化诊断和版本戳。
- Phase 2 已交付 `character_training_v1`：炼体五轨编译为四修炼与生命根基，并保留裸角色投影入口。
- Phase 3 已交付 `character_sect_v1`、红尘剑宗六心法、斩尘证道/万剑归一双流派、42个经脉节点和单场剑意资源。
- Phase 4A 已交付六部位道装、`dao_equipment_generator_v1`、九种阵法灵纹、实例/装配校验、装配比较与 `character_equipment_v1` 完整投影。
- Phase 4B 已交付 `dao_equipment_generator_v2`、七种器蕴、九种器诀、单场战意、特殊装配比较与 `character_equipment_special_v1` 完整投影；Phase 4A 入口仍拒绝特殊引用。
- Phase 5A 已交付唯一功法构筑、十谱系二十定义、三种纯状态操作、统一能力解析与 `character_build_v1` 完整人物投影。
- Phase 6A 已交付多宗门注册表、幽都六心法与“勾魂阎罗/六道魍魉”双流派、42个经脉节点、固定伤害、独立伤势和 `character_build_v2` 完整投影。
- Phase 6B 已交付护盾、疗伤、稳定净化、成功结算段、rules v3 法术公式，以及无相禅宗“慈航渡厄/明王镇狱”双流派、念与无相循环、42个经脉节点和 `character_build_v3` 完整投影。
- Phase 6C 已交付状态消费/复制、有效冲击伤害、通用机制事件、天衍圣地五行法印与十种协同反应、河图演生/洛书制化双流派、42个经脉节点和 `character_build_v4` 完整投影。
- Phase 6D 已交付通用概率分支、非致命打击、状态层数读取、随机物理攻击目标策略，以及九劫天宫“天律镇妖/九霄驭雷”双流派、三封、五雷、电芒协同、42个经脉节点和 `character_build_v5` 完整投影。
- Phase 7A 已交付60/120/180三档独立训练 NPC、六类训练遭遇、三种确定性策略、结构化指令查询、纯逻辑 Encounter Host、结果摘要和非持久调试转录。
- Phase 7B 已交付独立 v6 构筑持久态、五宗门旧心法单次迁移、权威人物装配器、进程内训练会话、训练 API 和 v6 原生练功房页面。
- Phase 7C 已交付可恢复 Redis 权威训练运行时、两小时绝对期限、revision CAS、仅传 battle ID 的通用终局事件/回放流与 PostgreSQL 回放归档。
- 道装固定已鉴定且没有品质、评分或淬炼；重铸、锁灵、持久化、经济和 UI 保留给 Phase 4C。
- core 已支持资源事件与门槛、效果级目标、固定伤害、独立伤势、护盾、疗伤、稳定净化、成功结算段、物法忽防、物理必中、击倒来源归因和数据化概率修改；没有宗门 ID 特判。
- 肉身位阶已改为只检查人物境界与五轨总等级的确定性逐阶提升；旧材料、概率、失败与保底流程已退出。
- battle-v5 不再读取炼体 modifier、开战 Buff 或位阶 Hook；五轨战斗效果只存在于 combat-v6 新投影。
- 裸角色无需加载旧装备、功法、宗门、经脉或炼体效果即可投影并完成确定性 1v1 战斗。
- 已具备共享PVE Host、Redis权威会话、训练/野外逐回合UI、自包含v6回放和野外Condition结算；尚未接入奖励、任务消费者或捕捉。
- `combat-v6` 不依赖 `battle-v5`、`creation-v2` 或旧宗门编译器；core 不反向依赖具体宗门内容。
- 复制基线建立后，后续改造只在本目录进行，不反向修改来源仓库。

公开入口：

- `core/`：规则无关的 we-go 战斗内核。
- `rules-daoyou/`：提供兼容 v1～v4 与承载 Phase 6D 契约的 v5 规则集。
- `content/`：提供红尘剑宗、幽都、无相禅宗、天衍圣地、九劫天宫 v6 内容定义、版本化多宗门注册表、双流派经脉和宗门编译器。
- `equipment/`：提供独立道装类型、六模板、九灵纹、七器蕴、九器诀、v1/v2 确定性生成和两阶段装配编译校验。
- `manuals/`：提供功法状态、参悟/改修/散功、十个本篇/真解谱系、编译与能力解析。
- `projection/`：保留各阶段入口，并提供 `projectCultivatorMultiSectV5ToCombatV6` 五宗门完整人物构筑入口。
- `encounter/`：提供训练 NPC、六类遭遇、内容校验、指令查询编排、确定性 NPC 策略和共享纯逻辑 Host。
- `build-state/`：提供五宗门旧心法显式映射、迁移归一化和一次性初始化读模型。
- `version.ts`：Phase 1～7D 战斗、快照与调试转录共同使用的版本戳。

## Phase 7D 野外遭遇

新增 `wild/`：青溪灵草坡固定物种池、5～15级独立面板、确定性1～3只遭遇、可恢复PVE Host与资源结算纯规则。训练与野外共享中立回合编排，旧投影和rules v5保持兼容。服务端已接入每日20次Redis额度、终局Condition消费者和地图探索页；捕捉、宠物个体、奖励和任务消费尚未接入。

设计见 [Phase 7D专项稿](../../../../docs/combat-v6-phase-7d-wild-encounter-design.md)。部署需执行新增业务迁移并完成认证页面及消息故障验证。
