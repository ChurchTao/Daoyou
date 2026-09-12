# 器蕴、器诀与打造配置（G2）

策划编辑 `equipment-special.json` 与 `equipment-forging.json`。两份配置均以 `$schema` 关联编辑器提示，运行时还会检查唯一 ID、引用、概率总和、部位池容量和成本表完整性。未知字段、无效值或缺失引用会使加载失败，不会静默回退。

## G2-A：特殊内容

`essences` 定义器蕴身份、名称、适用部位（省略代表全部）、`stackPolicy`、可选冲突组与一个 `effect`。

| effect.type | 参数 | 生效方式 |
| --- | --- | --- |
| `panelAdd` | `attribute`、`value` | 指定面板属性固定加值；暴击类数值为比例，0.03 表示 3 个百分点 |
| `requiredLevelOffset` | `value` | 御使等级偏移，当前轻灵为 -10；沿用整套装备取最小偏移的规则 |
| `rageGain` | `factor` | 战意获得倍率，当前激昂为 1.2；不同来源取最大倍率，不连乘 |
| `rageCost` | `factor` | 战意消耗倍率，当前归元为 0.8；不同来源取最小倍率，最终消耗向下取整 |

`stack` 允许同 ID 多件贡献；`unique`、`highest` 都会忽略后续相同 ID。`highest` 不代表所有属性都自动取最大值，战意倍率和等级偏移仍按上表规则聚合。相同 `conflictGroup` 下出现不同器蕴 ID 会拒绝装配。

`arts` 定义器诀 ID、名称、技能 ID、战意消耗 `rageCost`、适用部位和一个机制对象；消耗只写一份，编译器同时生成技能成本。当前机制如下：

| effect.type | 参数 | 固定机制 |
| --- | --- | --- |
| `heal` | `ratio` | 单个友方按目标最大气血比例治疗 |
| `restoreMp` | `ratio` | 单个友方按目标最大法力比例恢复 |
| `revive` | `hpRatio` | 单个友方复活，允许选择倒地目标 |
| `dispel` | `side`、`categories` | 单体驱散；阵营为 ally／enemy，类别为 buff／control |
| `defenseBuff` | `attribute`、`ratio`、`duration`、`statusId` | 全体友方提高物防或法防；`floor(目标对应防御 × ratio)`，状态名称沿用器诀名 |
| `physicalHit` | `coefficient`、`defenseIgnore` | 单体敌方物理伤害与防御忽略比例 |
| `spellHit` | `coefficient`、`targetCount` | 敌方补足指定数量的法术攻击 |

这些是现有机制的数值入口。改变目标算法、增加连击／新触发条件、组合多个效果等仍需程序扩展。本轮不接受自由公式或 JavaScript。进入表达式的数值最多六位小数，避免以科学计数法进入现有表达式解析器。

清心诀的 `includeDownedInMultiSect: true` 保留旧的阶段覆盖行为：启用多宗门能力的装配入口允许选择倒地友方，早期入口仍保持原目标范围。该字段仅支持友方驱散；本轮没有合并历史装配入口或改变覆盖顺序。

`rageResource` 配置名称、初始值和上限（当前 0／150）；`rageGain` 配置每次下限／上限（1／20）、伤害百分比尺度（100）及每次行动获得上限（30）。编译器保留双层取整、钩子和限额的执行顺序。

**已核实的既有行为问题：** 当前战意钩子是 `OnBeHit + sourceIsSelf`，实际由伤害来源获得战意，不是受击者。G2 以行为等价迁移为目标，保留并用真实内核测试锁定该行为；如设计意图为受击获得，应单独修正为目标侧触发并重新验收伤害比例、连击上限与回放。不要通过修改倍率掩盖触发对象错误。

## G2-B：产出与打造

`generation.essenceCountProbabilities` 按 0／1／2 条填写，原值 `[0.82, 0.16, 0.02]`；`artChance` 原值为 0.08。每个抽取池是有序 ID 列表：器蕴均匀不放回抽取，器诀均匀抽取一个；不存在隐含稀有度权重。

产出池引用 `equipment-special.json` 中的定义。基础生成与材料重抽都按部位筛选同一池；配置必须保证每个部位都有足够候选内容满足非零数量概率，不会默默降低条数。保留数组顺序才能保留固定种子结果。新增定义不会自动加入产出，需要明确加入池；从池中移除只停止新产出，保留定义仍可支持已有装备。

`forging.boostPerMaterial` 是每份材料的择优重抽概率增量，原值 0.018；范围 0～0.2，最多六位小数。每炉最多五份是现有炉位限制，因而总概率不会超过 1。炼器室 tooltip 与铸器碑读取同一数值。

`forging.costs` 按器阶列出 九个大境界的 9 行（内部器阶 10、30、50、70、90、110、130、150、170），每行填写：

- `spiritStones`：灵石数；`qi`：天地灵气数。
- `quantity`：材料总数，1～5。
- `rank`：最低材料品质，使用游戏现有品质枚举。

材料角色保持原规则：矿石改善器胚、天材地宝改善器蕴数量、辅助与妖兽材料改善已有附灵数值。一次择优只增加一次额外抽样，取两次结果较高者；不保证生成更强装备，也不增加原本没有的附灵。独立随机流、取整、材料归类、图纸消耗一卷、物品命名和事务仍由原代码处理。

## 发布与验收

调整内容递增对应 `contentRevision`，通过重新构建／发布生效；它不是实例版本，也不是自动补偿机制。概率、池和成本变化影响新产出／新打造；器蕴及器诀效果变更会影响引用相同 ID 的已有装备重新装配。删除 ID、缩小适用部位可能使已有实例无法通过校验。生产内容调整必须明确这些影响；本轮不改已有参数、不引入旧数据迁移。

`fixtures/special-before-g2.json` 保存迁移前的完整定义，测试对照全部编译结果；9 种器诀还逐一在相同内核输入下对照状态与事件。G1 的 18 组生成摘要继续覆盖基础、特殊产出和打造流。修改数值属于平衡变更，不应只为测试通过而更新基线。

```bash
bun run test src/shared/engine/combat-v6/equipment src/shared/forging/forging.test.ts
bun run lint
bun run test
bun run build
```

文件职责：`special-pack.ts`／`forging-pack.ts` 加载校验；`special-compiler.ts` 将机制参数转换为内核定义；`special-content.ts`／`forging-content.ts` 提供已验证内容；`special-ids.ts` 保留稳定程序标识。Schema 从相应 `*PackShape` 生成，并由测试检查一致性。

九境界切换后，每境界只有一档图纸和道装，均在该境界初期开放。旧图纸、装备及待领取附件由 `0047_equipment_realm_cutover.sql` 清空；运行时不兼容旧器阶与旧门槛。生成基线已按九境界规则重录。
