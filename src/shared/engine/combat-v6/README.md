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

当前边界：

- 已复制纯战斗核心，包括指令、回合管线、单位、状态、效果、钩子、目标、表达式、确定性随机与战斗会话。
- 尚未引入 `rules-xyq`、技能/状态数据、Host 或 Daoyou 角色投影。
- `combat-v6` 不依赖 `battle-v5`、`creation-v2` 或具体宗门内容。
- 复制基线建立后，后续改造只在本目录进行，不反向修改来源仓库。
