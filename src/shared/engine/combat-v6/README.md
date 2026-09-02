# combat-v6

完整的新体系设计、隔离边界和分阶段迁移路线以
[`docs/combat-v6-mhxy-redesign-roadmap.md`](../../../../docs/combat-v6-mhxy-redesign-roadmap.md)
为 canonical 文档。角色字段的逐项兼容分析见
[`CHARACTER_COMPATIBILITY.md`](./CHARACTER_COMPATIBILITY.md)，新版道装领域见
[`docs/combat-v6-equipment-system-design.md`](../../../../docs/combat-v6-equipment-system-design.md)，
新版功法领域见
[`docs/combat-v6-manual-system-design.md`](../../../../docs/combat-v6-manual-system-design.md)。

`core/` 当前是
`/Users/churcht/Documents/GitHub/mhxy-combat-copy/packages/engine/src`
的完整源码副本，作为梦幻式 we-go 回合战斗的隔离内核。

当前状态：

- 已复制纯战斗核心，包括指令、回合管线、单位、状态、效果、钩子、目标、表达式、确定性随机与战斗会话。
- Phase 0 已建立 ESLint 隔离门禁，阻止 v6 导入 battle-v5 / creation-v2，并阻止 core 反向依赖规则、投影和内容层。
- Phase 1 已交付 `rules-daoyou`、`character_panel_v1`、5～180 人物等级映射、`full/persistent` 资源策略、结构化诊断和版本戳。
- Phase 2 已交付 `character_training_v1`：炼体五轨编译为四修炼与生命根基，并保留裸角色投影入口。
- 肉身位阶已改为只检查人物境界与五轨总等级的确定性逐阶提升；旧材料、概率、失败与保底流程已退出。
- battle-v5 不再读取炼体 modifier、开战 Buff 或位阶 Hook；五轨战斗效果只存在于 combat-v6 新投影。
- 裸角色无需加载旧装备、功法、宗门、经脉或炼体效果即可投影并完成确定性 1v1 战斗。
- 尚未接入正式技能/状态内容、combat-v6 Host、战斗 API、战斗记录或战斗 UI。
- `combat-v6` 不依赖 `battle-v5`、`creation-v2` 或具体宗门内容。
- 复制基线建立后，后续改造只在本目录进行，不反向修改来源仓库。

公开入口：

- `core/`：规则无关的 we-go 战斗内核。
- `rules-daoyou/`：Daoyou 第一版基础公式与死亡/默认指令规则。
- `projection/`：提供 `character_panel_v1` 裸角色投影，以及叠加五轨修炼的 `character_training_v1` 组合投影。
- `version.ts`：Phase 1/2 战斗、快照与回放共同使用的版本戳。
