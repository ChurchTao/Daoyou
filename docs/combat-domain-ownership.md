# 战斗数据的领域归属与硬切换方案

2026-09-10。结构已实施，功能验收进展见 [验收记录](combat-domain-cutover-acceptance.md)。

## 判断

装备、个人功法、灵兽属于角色，应直接关联 `cultivator_id`。宗门心法与经脉属于角色在某个宗门的修行关系，应关联 `membership_id`。完整战斗构筑是这两类数据加角色基础属性的读取结果，不需要再建一张持有所有数据的 build/profile 根表。

旧 `combat_v6_build_profiles` 的实际职责混合了两件事：它以 `membership_id` 唯一绑定宗门成员，保存当前流派、经脉深度与修订号；同时它又成为装备和个人功法的父记录。因此个人资产被间接绑定到宗门生命周期，转宗必须处理本来不该移动的数据，个人修改也容易让整个宗门构筑失效。

把 profile 的外键改成角色只能消除部分问题，仍会混合个人资产和宗门成长的状态、修订与服务边界。本次直接移除该中间层。

## 表结构

下表省略共同前缀 `wanjiedaoyou_`。

| 旧表 | 当前表 | 归属与用途 |
| --- | --- | --- |
| `combat_v6_build_profiles` | `sect_combat_states` | `membership_id` 主键；只存当前宗门流派、共用经脉深度、宗门修订号 |
| `combat_v6_method_progress` + 原 `sect_method_progress` | `sect_method_progress` | 成员 + 心法唯一；保存宗门心法等级，合并重复权威 |
| `combat_v6_meridian_loadouts` + 原 `sect_meridian_loadouts` | `sect_meridian_loadouts` | 成员 + 流派唯一；保存各流派方案修订号 |
| `combat_v6_meridian_nodes` | `sect_meridian_nodes` | 关联方案；每层最多一个节点，同一方案节点不重复 |
| `combat_v6_manual_states` | `cultivator_manual_states` | `cultivator_id` 主键；保存已学个人功法与个人功法修订号 |
| `combat_v6_manual_slots` | `cultivator_manual_slots` | 角色 + 槽位主键；保存激活功法，角色内同一功法不重复占槽 |
| `combat_v6_equipment_loadouts` | `cultivator_equipment_slots` | 角色 + 装备槽主键；指向背包中真实装备实例 |
| `combat_v6_beasts` | `cultivator_beasts` | 灵兽 ID 主键、角色外键；JSON 存个体成长数据 |
| `combat_v6_beast_lineups` | `cultivator_beast_lineups` | `cultivator_id` 主键；编组、首发与首次领取时间 |
| 旧 V6 回放归档及参与者表 | `combat_replay_archives`、`combat_replay_participants` | 历史快照与访问者索引；角色删除不级联删除历史参与记录 |
| 旧 `sect_path_progress`、`sect_ability_loadouts` | 删除 | 经脉深度改为成员共用，神通由当前心法和节点推导，无需另一套持久化进度或技能槽 |

`sect_memberships` 继续负责组织身份、贡献、成员状态；`inventory_items` 继续负责物品实例、归属、背包位置和数量。它们不复制宗门战斗进度或装备槽信息。

## 个人功法如何存

旧 `combat_v6_manual_states` 并非功法定义库，也不是战斗中临时状态。每个 profile 一行，`learned` 是 JSONB 数组，保存已学功法的 ID、当前等级及已解锁上限；激活哪些功法另存 slots 表。新表保留这一数据形状，只把权威归属改为角色：

```json
{
  "cultivator_id": "角色 UUID",
  "revision": 6,
  "learned": [
    { "manualId": "character_manual.changchun", "level": 3, "unlockedLevel": 6 },
    { "manualId": "character_manual.qingfeng", "level": 1, "unlockedLevel": 3 }
  ]
}
```

功法名称、效果、费用等静态定义继续来自共享内容注册表；不把它们复制到角色存档。`level` 表示已修炼等级，`unlockedLevel` 表示玉简已解锁的等级上限，二者不能合并。

现有玩法按角色整体读取、在角色锁和事务内修改，数组规模有限，因此暂时保留 JSONB 能保持代码简单。如果未来需要跨角色查询“修炼某功法的人”、批量调整或数据库外键约束激活槽必须指向已学功法，再将 learned 拆为 `(cultivator_id, manual_id)` 行表。当前槽位合法性、功法已学及等级规则由领域校验保证；数据库本身不验证 JSON 内的功法引用。

## 一致性与生命周期

- 个人装备、功法和灵兽不要求先选宗门流派。人物投影接受可空的宗门修行数据。
- 装备槽用 `(cultivator_id, equipment_instance_id)` 组合外键引用背包的 `(cultivator_id, id)`，防止穿戴其他角色的装备；装备实例在槽表全局唯一。已穿戴物品的转移仍须经过背包服务的卸装规则。
- 经脉深度是同一成员的共用成长；每条流派只保存自己的节点方案。切换流派不复制个人资产，也不复制解锁深度。
- 转宗只折算宗门心法与共用深度、清空节点并处理成员身份。旧成员的战斗进度清除；返回旧宗不会读回陈旧进度。个人资产没有转移代码。
- 灵兽 JSON 不再重复 `id` 和 `ownerCultivatorId`；读取时从关系列组装。首次领取用 `starter_claimed_at`，不会因初始灵兽放生而重新开放领取。
- 修订号按各自修改单元管理：个人功法、宗门状态、流派方案、灵兽与编组，不保留一个容易误用的全局 buildRevision。
- 构筑就绪状态由成员和流派选择推导，不保存可相互矛盾的 profile status/schemaVersion。
- 回放保存开战时的历史事实，不能重读当前装备或宗门来“还原”过去的战斗。

## 代码边界与发布方式

角色资产读取位于 `characterLoadoutRepository.ts`，宗门战斗进度位于 `sectCombatRepository.ts`。最终战斗投影按需组装，两类数据各自变更与失效；角色构筑展示同时订阅个人资料和宗门状态。

宗门流派接口为 `/api/combat-v6/sect/path`，宗门状态接口为 `/api/combat-v6/sect/state`，资源主题为 `player.sect-combat`。删除旧 build 初始化接口和旧宗门 progression 接口，不保留别名兼容。

迁移 `0044_domain_ownership_cutover.sql` 一次性创建新表、删除旧 V6 表并清空重用表的旧进度。不迁移旧 V6 数据、不双写、不运行时兼容。保留共享角色、库存、认证和非此次范围的历史数据。表名按领域命名，战斗引擎版本不再决定持久化表的名称；回放协议自身仍可保留必要的版本标识。

回放只接受 `combat_v6_replay_v2`，必须含时间线与展示快照；删除旧协议静态展示和竞技场缺失时间线恢复分支。`0045_replay_protocol_cutover.sql` 删除冗余 `playable` 列，所有新归档都使用可播放协议，不保留历史格式兼容。

这次没有扩展为多套个人配装预设。若将来确实需要多套方案，角色资产仍属于角色，预设只能保存对资产的选择，不能重新成为资产父级。
