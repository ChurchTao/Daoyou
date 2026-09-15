# combat-v6 道装系统设计

> 状态：Phase 4A、Phase 4B 已实现（Canonical）
>
> 更新日期：2026-09-03
>
> 上位设计：[`combat-v6 梦幻式战斗体系设计稿与迁移路线图`](./combat-v6-mhxy-redesign-roadmap.md)

道装是 combat-v6 完全独立的六部位人物装备领域。它不读取或转换旧装备、battle-v5、creation-v2，也不存在品质、评分和淬炼。

## 1. 硬约束

- 六部位固定为法兵、法冠、法衣、灵佩、腰封、云履。
- 器阶为 10、20……180；首版御使等级严格等于器阶。
- 道装价值只由实际器胚、附灵、器蕴、器诀和阵法灵纹组成，系统不输出价值结论。
- 附灵六维只在投影期生效，不修改角色持久六维。
- 道装不提供四项修炼等级，不保存最终面板、`SkillDef` 或其他运行时对象。
- 道装固定为已鉴定；首版没有鉴器流程。
- 淬炼永久删除，不保留字段、接口或未来路线。

禁止进入领域的字段和概念：

```text
quality rarity tierColor itemGrade powerScore equipmentRating
battleProjection SkillDef tempering
```

## 2. 术语与部位

| 代码部位 | 名称 | 器胚字段 |
| --- | --- | --- |
| `weapon` | 法兵 | 物攻、法攻、命中 |
| `head` | 法冠 | 物防、法力 |
| `armor` | 法衣 | 物防、法防 |
| `necklace` | 灵佩 | 法防、法攻 |
| `belt` | 腰封 | 气血、物防 |
| `footwear` | 云履 | 速度、闪避、物防 |

外观不改变槽位规则；每个部位首版只有一个标准战斗规则模板，空槽合法。

## 3. 实例契约

```ts
interface DaoEquipmentInstanceV1 {
  schemaVersion: 1;
  id: string;
  templateId: string;
  name: string;
  slot: DaoEquipmentSlot;
  equipmentLevel: number;
  requiredLevel: number;
  baseStats: DaoEquipmentPanelRoll[];
  attributeBonuses: DaoEquipmentAttributeRoll[];
  essenceIds: string[];
  artId?: string;
  formationInscription?: { patternId: string; level: number };
  appraisalState: 'appraised';
  generatorVersion: 'dao_equipment_generator_v1';
  createdAt: string;
}
```

器蕴最多两个且不可重复，器诀最多一个，二者可共存。Phase 4A 入口仍会拒绝任何非空特殊引用；Phase 4B 仅接受 `dao_equipment_generator_v2` 生成的特殊内容。

## 4. 器胚与确定性生成

每个模板字段固定存在。各字段独立地在以下闭区间内均匀生成：

| 部位 | 字段与系数 |
| --- | --- |
| 法兵 | 物攻 `0.55～0.85`、法攻 `0.25～0.45`、命中 `0.40～0.70` |
| 法冠 | 物防 `0.12～0.18`、法力 `2.0～3.0` |
| 法衣 | 物防 `0.25～0.35`、法防 `0.25～0.35` |
| 灵佩 | 法防 `0.25～0.35`、法攻 `0.25～0.45` |
| 腰封 | 气血 `7.0～9.5`、物防 `0.10～0.16` |
| 云履 | 速度 `0.30～0.50`、闪避 `0.25～0.40`、物防 `0.06～0.10` |

上下界均为 `floor(equipmentLevel × coefficient)`。生成器只接受调用方提供的 `id`、`createdAt`、32 位无符号整数 seed、模板、器阶和固定生成版本，不读取时钟、环境变量或 `Math.random`。

随机顺序固定为：

```text
按模板字段顺序生成器胚
→ 判定附灵条数
→ 每条先加权抽属性
→ 再生成该条数值
```

生成结果的器蕴、器诀和灵纹均为空，且固定为已鉴定。

## 5. 附灵

附灵只允许体魄、力道、灵力、根骨、身法和神识六维：

- 0/1/2 条概率为 50%/40%/10%。
- 单条范围为 `max(1, floor(level × 0.08))` 至 `max(1, floor(level × 0.14))`。
- 同件不重复属性，采用加权不放回抽取。
- 部位倾向属性权重为 2，其他属性权重为 1。
- 不使用总预算、品质门槛或事后纠偏。

| 部位 | 倾向属性 |
| --- | --- |
| 法兵 | 力道、灵力、神识 |
| 法冠 | 体魄、神识、灵力 |
| 法衣 | 体魄、根骨、力道 |
| 灵佩 | 灵力、神识、体魄 |
| 腰封 | 体魄、根骨、身法 |
| 云履 | 身法、神识、根骨 |

## 6. 阵法灵纹

每件最多一槽一纹，等级为 1 至 `equipmentLevel / 10`，最高 18。同纹可跨装备重复；没有多孔、组合阵法或套装联动。

| 灵纹 | 每级贡献 | 合法部位 |
| --- | ---: | --- |
| 玄锋阵纹 | 物攻 +6 | 法兵、法冠 |
| 灵曜阵纹 | 法攻 +6 | 法兵、灵佩 |
| 金刚阵纹 | 物防 +4 | 法冠、法衣、腰封、云履 |
| 玄甲阵纹 | 法防 +4 | 法衣、灵佩 |
| 长生阵纹 | 气血 +80 | 腰封 |
| 沧海阵纹 | 法力 +40 | 法冠 |
| 疾风阵纹 | 速度 +4 | 云履 |
| 洞明阵纹 | 命中 +6 | 法兵 |
| 流云阵纹 | 闪避 +6 | 云履 |

Phase 4A 只实现注册表、校验和属性贡献，不实现获取、替换、升级操作或经济消耗。

## 7. 投影顺序

```text
校验角色和六槽装配
→ 持久六维 + 附灵 = 有效六维
→ character_panel_v1
→ 五轨修炼与生命根基
→ 器胚与阵法灵纹固定面板
→ 红尘剑宗心法、流派与经脉
→ 最终 full/persistent HP/MP
```

生命根基只放大有效六维生成的裸身气血，不放大道装固定气血；宗门比例节点在全部固定贡献之后生效。`persistent` 保留旧 current，仅在最终阶段夹到新上限，不因装备增加上限而补血。

公开投影为 `projectCultivatorWithEquipmentToCombatV6`，版本为：

```text
contentVersion: daoyou_sect_equipment_content_v1
projectionVersion: character_equipment_v1
generatorVersion: dao_equipment_generator_v1
```

装配比较使用同一完整投影计算变更前后，只返回有效六维差值、最终面板逐项差值和双方诊断，不提供评分、价值或推荐结论。

## 8. 校验与诊断

投影前必须校验模板、器阶、御使等级、器胚字段和区间、附灵数量/字段/区间、实例唯一性、装配槽、鉴定状态、灵纹引用/部位/等级以及所有禁止字段。非法结果使用可判别联合返回，不生成伪造实例或战斗单位。

稳定诊断码：

```text
INVALID_EQUIPMENT_IDENTITY
UNKNOWN_EQUIPMENT_TEMPLATE
INVALID_EQUIPMENT_LEVEL
EQUIPMENT_LEVEL_REQUIREMENT
EQUIPMENT_SLOT_MISMATCH
DUPLICATE_EQUIPMENT_INSTANCE
INVALID_EQUIPMENT_BASE_STAT
INVALID_EQUIPMENT_ATTRIBUTE_BONUS
FORBIDDEN_EQUIPMENT_FIELD
UNSUPPORTED_EQUIPMENT_CONTENT
UNKNOWN_FORMATION_INSCRIPTION
FORMATION_INSCRIPTION_SLOT_MISMATCH
FORMATION_INSCRIPTION_LEVEL_INVALID
UNKNOWN_EQUIPMENT_ESSENCE
UNKNOWN_EQUIPMENT_ART
EQUIPMENT_SPECIAL_GENERATOR_MISMATCH
EQUIPMENT_SPECIAL_SLOT_MISMATCH
EQUIPMENT_ESSENCE_CONFLICT
EQUIPMENT_ESSENCE_DUPLICATE_IGNORED
EQUIPMENT_ART_DUPLICATE_IGNORED
EQUIPMENT_SPECIAL_CONTENT_INVALID
CONTENT_ID_CONFLICT
```

## 9. Phase 4B：器蕴、器诀与战意

`dao_equipment_generator_v2` 保持 v1 器胚与附灵随机流不变，再按固定顺序追加特殊内容：器蕴 0/1/2 条概率为 82%/16%/2%，器诀独立出现概率为 8%。器蕴与器诀均为等权抽取，器蕴不放回，二者允许共存。

首批器蕴固定为：藏锋（物暴 +3%）、凝神（法暴 +3%）、破禁（封禁命中 +20）、定魂（封禁抵抗 +20）、轻灵（全身有效御使要求降低 10 级且不叠加）、激昂（直接伤害战意获取 120%）和归元（器诀战意消耗 80%）。编译器支持 `stack`、`unique`、`highest` 和冲突组；重复唯一/最高效果只生效一次并输出 warning，冲突组阻止投影。

所有 `character_equipment_special_v1` 人物获得单场战意资源，初始 0、上限 150，与宗门剑意并存。普攻和主动技能的非 silent 直接伤害按实际气血损失获得战意；单段 1～20，同一行动最多 30。过量伤害、DOT、主动耗血、伤势及钩子派生伤害不提供战意。

首批器诀为回元诀、清心诀、聚灵诀、还魂诀、金刚护法、玄灵护法、破法诀、诛仙式和天雷引。器诀技能等级固定为 0，不读取宗门心法，不接受经脉 patch；归元通过单位专属技能 override 修改消耗。双护法按施放时目标有效防御快照生成三回合状态，同类覆盖刷新而不叠加。

Phase 4B 公开：

```text
compileDaoEquipmentSpecialLoadoutV1
projectCultivatorWithEquipmentSpecialToCombatV6
compareDaoEquipmentSpecialLoadoutsV1

contentVersion: daoyou_sect_equipment_special_content_v1
projectionVersion: character_equipment_special_v1
generatorVersion: dao_equipment_generator_v2
```

特殊装配比较保留六维与最终面板差值，并新增有效器蕴、授予器诀的稳定 ID 增删，不输出评分、价值判断或推荐。

## 10. 阶段边界

Phase 4A 已交付纯共享领域类型、六模板、九灵纹、确定性生成、校验、编译、完整角色投影、装配比较和战斗纵切测试。

Phase 4B 已交付七种器蕴、九种器诀、战意资源、确定性 generator v2、特殊编译/投影/比较与战斗纵切测试。

Phase 4C 保留：重铸、锁灵、持久化、获取、炼器、背包、掉落、市场、灵纹升级服务、经济消耗和 UI；不屈、纳灵、回春、慈航渡世等复杂特殊效果也不回填到 4B。

仍不引入品质、评分、淬炼、套装、耐久、负属性、多孔或宗门专属装备类型。

## 11. 决策记录

| 日期 | 决策 |
| --- | --- |
| 2026-09-02 | 新装备系统定名“道装”，采用梦幻式六部位并完全隔离旧装备。 |
| 2026-09-02 | 道装不设品质、稀有度或权威评分。 |
| 2026-09-03 | Phase 4A 锁定器胚、附灵、九灵纹和完整属性投影。 |
| 2026-09-03 | 淬炼永久删除；首版固定已鉴定。 |
| 2026-09-03 | 器蕴最多两个、器诀最多一个；Phase 4A 非空引用阻止投影。 |
| 2026-09-03 | Phase 4B 发布 generator v2、七器蕴、九器诀和单场战意；外围持久化与经济拆至 Phase 4C。 |
