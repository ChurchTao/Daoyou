# 野外内容配置

`wild.json` 管理地图节点的野外寻觅配置。编辑器使用同目录 JSON Schema，加载时检查物种引用、重复节点及数值范围。

- `regions[]`：`nodeId` 关联地图节点，`id` 对应地图的 `wild_encounter_id`；名称、场景描述和寻觅中的文案直接驱动页面。所有节点自动使用统一传承灵印掉落池。
- `species[]`：逐项配置 `speciesId` 与成年 `minLevel/maxLevel`，支持同地区不同物种使用不同等级。最低成年等级不得低于物种携带等级，区域开放境界不得低于物种携带境界。常规种群使用携带等级至携带等级 +10，深层成熟种群整体再提高 10 级。资质、成长、出生技能和战斗面板复用灵兽领域规则。
- `scenery`：草坡、矿道、地火、湖泊、石原、暗河、密林、地穴、雷崖的轻量背景类型，复用同一寻觅页面；formatVersion 为 4。
- `encounter.minCount/maxCount`：每次寻觅数量，当前支持 1–3 只；物种允许重复，每只个体分别生成。
- `encounter.cubChance`：每只灵兽独立成为 0 级幼崽的概率，当前暂定 5%。
- `encounter.mutantChance`：每只灵兽独立变异的概率，当前 0.8%，幼崽与成年一致。变异使用独立随机流；预览、战斗与捕获保留身份，资质和成长按灵兽领域规则提高 10%。
- `encounter.allocationSpread`：成年五维加点相对均值的波动范围，当前 30%，上下界按整数点数取整；总点数始终等于等级乘每级点数。幼崽五维额外加点和待分配点均为 0。
- `activity.explorationCooldownMs`：两次成功寻觅的最短间隔，当前 1 秒；不再设置每日次数上限。
- 消耗统一维护于 `src/shared/config/qiSystem.ts` 的 `wild_search`，当前每次 2 点天地灵气。

寻觅成功即保存完整个体。开战投影和捕获结算沿用这些事实，不再次随机生成。掉落单独维护于 `src/shared/rewards/data/wild.json`。完整流程见 [野外寻觅](../../../../../../docs/combat-v6-wild-seeking.md)。
