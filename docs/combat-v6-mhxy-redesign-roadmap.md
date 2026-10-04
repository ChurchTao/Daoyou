# combat-v6 战斗体系设计基线

迁移阶段入口和已完成的过程记录已退役。当前实现、保留的旧资产入口及发布边界见 [V6 当前实现与退役边界](combat-v6-runtime.md)。本篇保留设计基线；功法规则以 [境界功法层数养成](combat-v6-manual-system-design.md) 为准，数值后续调整见 [手游数值治理计划](combat-v6-mobile-numerical-governance-plan.md)。具体实现应核对当前代码。

## 1. 最终目标

在 Daoyou 内建立一套与 battle-v5 完全隔离的 `combat-v6`，以梦幻西游电脑版式的 we-go 回合战斗为核心：

1. 全体单位先提交指令，锁定后按实时速度顺序串行结算。
2. 引擎只提供通用战斗原语，不按宗门、技能、装备或经脉 ID 写分支。
3. 技能、状态、宗门、经脉、功法和装备通过数据与编译器接入。
4. 战斗结果由种子、输入快照和版本号完全决定，可复盘、可对拍。
5. 角色数据库继续保存长期养成事实，不保存可重新计算的战斗面板。
6. 旧 build 系统不迁就 v6；除角色基础事实和明确指定的养成进度外，装备、功法、宗门战斗内容全部重做。

这不是给 battle-v5 增加一种战斗模式，也不是让同一份 `AbilityConfig` 同时兼容两个引擎。combat-v6 是新的战斗领域，battle-v5 只在过渡期维持旧玩法和旧记录。

---

## 2. 已确认的产品决策

### 2.1 继承什么

角色迁移到 v6 时只继承以下权威事实：

- 角色 ID、名称、性别、种族等身份信息。
- 修为境界与境界阶段。
- 六项基础属性：体魄、力道、灵力、根骨、身法、神识。
- 持久气血、法力和允许进入新战斗体系的长期状态。
- 当前炼体五轨的等级；其旧效果不继承，改造成新的修炼系统效果。
- 宗门社会关系中仍有价值的事实，例如所属宗门、职位、贡献等；宗门战斗内容不继承。

### 2.2 不继承什么

以下内容不做语义自动转换，不作为 v6 生产运行时输入：

- battle-v5 `AbilityConfig`、Buff、Listener、Effect 和 GameplayTags 投影。
- creation-v2 生成的旧技能战斗配置。
- 旧功法的战斗属性与被动。
- 旧法宝/装备的战斗属性、能力树和三槽装备规则。
- 旧宗门技能、固定四技能装配和旧经脉战斗投影。
- 旧炼体五轨产生的十类 modifier、Buff 和境界被动。

旧内容后续采用冻结、补偿、兑换或重新生成，不编写一个长期存在的“v5 内容翻译器”。

### 2.3 新体系组成

v6 build 由以下互相独立的来源组成：

- 角色基础面板投影。
- 新修炼系统（由炼体五轨改造）。
- 新装备系统。
- 新功法系统（角色版“魔兽要诀”）。
- 新宗门心法与主动技能。
- 新宗门经脉方案。
- 未来的召唤兽、阵法、药品与特技系统。

所有来源最终只能输出 v6 认识的有限产物：面板贡献、主动技能、被动技能、状态定义、技能覆盖和单位标签。

---

## 3. combat-v6 架构边界

### 3.1 依赖方向

目标依赖方向：

```text
Host / PVE / Online Battle
  ├─ combat-v6/rules-daoyou
  ├─ combat-v6/content
  └─ combat-v6/projection
       ├─ character
       ├─ training
       ├─ equipment
       ├─ manuals
       └─ sect + meridian
              ↓
        combat-v6/core
```

`combat-v6/core` 不依赖任何 Daoyou 具体内容。规则层解释公式族；内容层声明技能和状态；投影层把持久数据编译为入场阵容；Host 只负责编排、提交指令、保存快照和播放事件。

### 3.2 禁止依赖

`packages/shared/src/engine/combat-v6/**` 的生产代码不得导入：

- `packages/shared/src/engine/battle-v5/**`
- `packages/shared/src/engine/creation-v2/**`
- 旧宗门的 v5 战斗投影和编译产物
- v5 `AbilityConfig`、`AttributeModifierConfig`、Buff、Listener、GameplayTags

允许存在独立的开发期对照工具，用相同角色分别运行 v5 和 v6 面板计算；该工具不得进入 v6 生产投影链路。

### 3.3 核心与内容的职责

核心负责：

- 指令提交与锁定。
- 速度排序和回合推进。
- 普攻、技能、防御、保护、逃跑、召唤等通用动作。
- 目标选择、状态生命周期、效果原语、钩子总线。
- 人物倒地、召唤兽/NPC 死亡、胜负判断。
- 确定性 RNG、事件流和可序列化快照。

核心不负责：

- 角色六维如何生成战斗面板。
- 武器如何增加伤害或法伤。
- 哪个宗门拥有什么技能。
- 哪个经脉节点修改哪个技能。
- 哪本功法属于高级版本或与谁冲突。
- 任何玩法奖励、掉落、养成消耗和数据库读写。

### 3.4 引擎扩展准则

只有出现“多个无关内容都需要、现有原语无法表达”的能力时，才扩展 core。单个宗门或单个装备的特殊机制优先通过通用效果、Hook、状态或公式族表达。

严禁出现：

```ts
if (skill.id === '某宗门技能') {
  /* 特判 */
}
if (nodeIds.includes('某经脉节点')) {
  /* 特判 */
}
```

---

## 4. 版本与确定性契约

每一场 v6 战斗及其记录必须携带：

```ts
interface CombatV6VersionStamp {
  engineVersion: 'combat-v6';
  rulesetVersion: string;
  contentVersion: string;
  projectionVersion: string;
}
```

必须共同进入可复盘输入的还有：

- `seed`
- 已编译的入场单位快照
- 技能表与状态表版本或不可变快照
- 初始阵容与资源策略
- 每回合锁定指令
- RNG state

同一输入快照、版本戳和指令序列必须得到相同事件流。新版本不得覆盖旧记录的解释语义；无法继续执行的旧记录至少要能读取其已保存事件。

---

## 5. 角色基础数据兼容层

### 5.1 最小输入边界

基础角色投影器只允许读取：

```ts
type CultivatorBaseCombatInput = Pick<
  Cultivator,
  'id' | 'name' | 'realm' | 'realm_stage' | 'attributes' | 'condition'
>;
```

装备、功法、宗门和修炼由各自的 v6 投影器单独输入，不得通过扩大这个 `Pick` 偷渡旧 build 数据。

### 5.2 正式角色面板投影

角色永久六维、有效六维、裸身面板公式、点数单位和编译顺序以 [`combat-v6 角色六维与战斗面板设计`](./combat-v6-character-panel-design.md) 为准。第一版正式投影版本为 `character_panel_v1`，不得调用 battle-v5 `AttributeSet`：

```text
physicalAtk = floor(40 + strength × 3.5)
physicalDef = floor(10 + endurance × 1.75)
magicAtk    = floor(40 + spirit × 3.5)
magicDef    = floor(10 + willpower × 1.75)
maxHp       = floor(400 + vitality × 20 + endurance × 3)
maxMp       = floor(200 + spirit × 4 + willpower × 10)
speed       = speed
hit         = floor(80 + speed)
dodge       = floor(speed)
healPower   = floor(vitality × 0.25 + willpower)
sealHit     = floor(spirit × 0.5)
sealResist  = floor(willpower × 0.5)
```

道装附灵六维在上述公式之前与永久六维合并为有效六维；其他 build 默认在公式之后输出面板贡献或被动。后续调整系数、职责、取整或贡献顺序必须发布新的 projection version，不得静默改写 `character_panel_v1`。

### 5.3 当前气血与法力

战斗场景必须显式选择资源策略：

```ts
type CombatV6ResourcePolicy = 'full' | 'persistent';
```

- `full`：以编译后的 `maxHp/maxMp` 满状态入场，用于训练、镜像、部分竞技玩法。
- `persistent`：读取 `condition.resources.hp/mp.current`，再夹到新上限内，用于连续世界战斗。

战后是否回写持久资源由玩法 Host 决定，不属于 core。

### 5.4 人物战斗等级

兼容期暂定：

```ts
level = (getRealmStageRank(realm, realmStage) + 1) * 5;
```

现有 36 个境界阶段映射为 5～180 级。该等级只作为 v6 公式、技能开放和目标规则的统一标尺，不替代修为境界，也不改变原有境界持久数据。

### 5.5 裸身属性与暂缺系统默认值

基础投影直接生成六维可派生字段；尚未接入的新系统采用显式默认值：

```text
attackCultivate       = 0
defenseCultivate      = 0
spellCultivate        = 0
resistSpellCultivate  = 0
physicalFuryRate      = 0
critRate              = 0.05
spellCritRate         = 0.05
healPower             = floor(vitality × 0.25 + willpower)
sealHit               = floor(spirit × 0.5)
sealResist            = floor(willpower × 0.5)
hit                    = floor(80 + speed)
dodge                  = floor(speed)
```

core 已统一使用 `physicalFuryRate` 表示物理狂暴概率，不能与器诀使用的战意资源混用。

技能等级规则：

```ts
skillLevels[skillId] = explicitSkillLevel ?? characterLevel;
```

使用 fallback 时必须写入投影诊断，不能无声兜底。宗门技能接入后应由所属心法提供明确等级；功法被动一般不依赖人物技能等级，确有需要时由功法定义明确给出。

### 5.6 投影结果

```ts
interface CombatV6ProjectionResult {
  unit: LineupUnit;
  skills: SkillDef[];
  statusDefs: StatusDef[];
  diagnostics: CombatV6ProjectionDiagnostic[];
  versions: CombatV6VersionStamp;
}
```

投影诊断至少区分 `info`、`warning`、`error`。缺少必需映射、未知装备词条、无等级技能和冲突功法必须被报告；`error` 阻止开战。

---

## 6. 新修炼系统：由炼体五轨原位改造

完整升级、位阶、战斗公式和迁移设计以 [`combat-v6 新版修炼系统设计`](./combat-v6-training-system-design.md) 为准。

### 6.1 迁移原则

当前炼体拥有五条持久轨道：皮肤、筋骨、脏腑、气血、元神。新修炼系统不另起一套从零养成的数据，也不继续使用旧炼体效果。

锁定原则：

1. 玩家五轨的 `level` 一对一继承，任何一轨都不合并、不取平均、不丢失。
2. `progress` 原值保留；新旧继续使用同一升级阈值，不做比例换算。
3. 旧肉身阶位、milestone 和战斗 Buff 停止提供 v6 效果。
4. 新效果只输出 v6 面板贡献或被动，不生成 v5 modifier。
5. 迁移必须幂等并记录 migration version，不能重复换算。

### 6.2 五轨新定义

为完整保留五条等级，v6 采用“四修炼 + 一根基”的人物修炼结构：

| 旧轨道（迁移来源） | 新轨道 | v6 主要输出 | 迁移 |
| --- | --- | --- | --- |
| `sinew_bone` 筋骨 | 攻法修炼 | `attackCultivate` | 等级原值继承 |
| `skin` 皮肤 | 防御修炼 | `defenseCultivate` | 等级原值继承 |
| `organs` 脏腑 | 法术修炼 | `spellCultivate` | 等级原值继承 |
| `primordial_spirit` 元神 | 抗法修炼 | `resistSpellCultivate` | 等级原值继承 |
| `qi_blood` 气血 | 生命根基 | `maxHp`、`healPower` 等有限面板贡献 | 等级原值继承 |

这样既满足 combat-v6 的四项修炼字段，又不吞掉第五条已有养成。生命根基不是第五个伤害修炼差，不参与物理/法术修炼差公式。

玩家界面和持久数据继续使用皮肤、筋骨、脏腑、气血、元神原名称与 track key；“攻法修炼”等只表示 combat-v6 内部战斗作用，不要求改名或迁移丹药方向。

映射名称和效果属于 v6 新规则；旧轨道此前提供的百分比物攻、抗暴、减伤、回蓝、濒死保护等效果全部终止，不做叠加继承。

### 6.3 等级和进度迁移

继续使用现有 `condition.tracks.bodyCultivation` 持久模型，不另建平行修炼状态：

```ts
interface BodyCultivationState {
  version: 1;
  realm: BodyCultivationRealm;
  tracks: Record<BodyCultivationTrackKey, ConditionProgressTrack>;
}
```

五轨等级和进度原值保留。升级阈值继续使用现有公式：

```text
threshold(level) = 100 + 70 × level
```

五轨只通过炼体丹、灵果等合法 `advance_track` 消耗品推进，不提供消耗修为、灵石或贡献的直接修炼入口。现有丹药方向和实例无需映射。

肉身七阶继续作为阶段位阶和单轨上限展示，但取消旧专项轨道条件、材料、丹药、概率、失败和保底。达到人物境界与五轨总等级要求后，由玩家点击无消耗、确定性提升到下一位阶。

### 6.4 新效果边界

- 四项主修直接产生同名 v6 修炼值，`修炼值 = 对应轨道等级`。
- 物法伤害修炼差按 `2% + 5` 公式结算，有效差限制在 `-20～20`。
- 封禁修炼差每级修正 2 个百分点，有效差限制在 `-10～10`。
- 生命根基每级增加 `character_panel_v1` 裸身气血 0.5%，每两级增加 1 点 `healPower`，不直接改六维。
- 修炼不来源于宗门心法；转宗、换装备、换功法不会改变四修炼等级。
- 修炼也不提供宗门主动技能等级。
- 肉身位阶本身不提供 combat-v6 战斗效果，旧七阶战斗被动全部退出。

肉身七阶单轨上限依次为 5、10、15、22、30、45、60；晋升总等级门槛继续为 12、30、55、90、140、220。

---

## 7. 新装备系统

新版装备系统使用修仙世界观名称“道装”，采用梦幻式六部位、器胚白字、附灵六维、器蕴被动和器诀主动结构。完整领域设计以 [`combat-v6 道装系统设计`](./combat-v6-equipment-system-design.md) 为准。

已确认边界：

- 六部位为 `weapon / head / armor / necklace / belt / footwear`，显示为法兵、法冠、法衣、灵佩、腰封、云履。
- 道装从实例、生成、装配到战斗投影均为 v6 独立领域。
- 道装不存在品质、稀有度、颜色档次或系统权威评分。
- 玩家依据实际白字、附灵、器蕴、器诀和阵法灵纹自行评估价值。
- 道装不使用境界衰减，以器阶和御使等级自然换代。
- 附灵六维只在战斗投影期生效，不写回角色持久六维。
- 道装不提供四项修炼等级，不保存运行时 `SkillDef` 或最终角色面板。
- 淬炼永久删除；道装固定为已鉴定，不预留淬炼字段或鉴器流程。
- Phase 4A 实现器胚、附灵、阵法灵纹和完整属性投影；Phase 4B 已实现器蕴、器诀与单场战意；持久化及经济外围进入 Phase 4C。
- “法宝”保留给未来独立系统，不作为六部位装备的名称。

---

## 8. 新功法系统：角色版“魔兽要诀”

功法是跨宗门的有限槽位被动 build，通过参悟功法玉简，将被动铭刻为角色道印。完整领域设计以 [`combat-v6 功法系统设计`](./combat-v6-manual-system-design.md) 为准。

已确认边界：

- 炼气初始 2 个道印位，每提升一个大境界增加 1 个，化神达到 6 个后封顶。
- 首版每个角色只有一套功法构筑，不能保存或切换方案。
- 构筑使用独立值对象设计，保留后期迁移到多构筑方案的技术可行性，但首版不预埋切换接口和 UI。
- 首版没有固印、锁槽和对应材料。
- 槽满后由玩家明确选择改修目标，不做随机覆盖；参悟必定成功。
- 使用本篇/真解同源覆盖，不设计功法等级与经验。
- 功法只编译为 v6 被动、innate、少量白名单面板贡献和通用标签。
- 功法不授予主动技能，不修改宗门技能，不提供四项修炼。
- 首版功法名称、描述、效果、数值、掉落和构筑操作均无 AI 参与。

---

## 9. 新宗门技能系统

完整领域设计以 [`combat-v6 宗门心法、技能与经脉系统设计`](./combat-v6-sect-skill-meridian-system-design.md) 为准。

### 9.1 社会状态与战斗进度拆分

概念上拆为：

```ts
interface SectMembershipState {
  sectId: string;
  rank: string;
  contribution: number;
  // 组织、任务、设施等社会玩法事实
}

interface SectCombatProgressV6 {
  version: 1;
  sectId: string;
  methods: Record<string, number>;
  meridianDepth: number;
  activePathId: string;
  meridianLoadouts: [MeridianLoadoutV6, MeridianLoadoutV6];
}
```

可以暂时共用持久容器，但编译器和领域类型必须区分社会玩法与战斗内容。

### 9.2 六本心法

每个宗门保留六本心法，目标上限 180：

- 心法上限为 `min(180, 人物等级 + 10)`。
- 分支心法不得超过主心法等级。
- 心法决定技能开放条件。
- 宗门技能等级等于其所属心法等级。
- 心法可以提供少量明确的基础面板贡献，但不映射四项人物修炼。
- 取消 v5 `growthProfile` 通用效果倍率，技能通过所属心法等级显式成长。
- 修炼、心法和人物战斗等级是三个独立维度。

### 9.3 技能使用

- 取消“固定装配四个主动技能”的战斗限制。
- 已解锁且满足条件的宗门技能都可在战斗中使用。
- 快捷栏只是一种 UI 偏好，不是战斗能力真相。
- 所有人使用统一普通攻击；宗门可以通过投影结果中的被动或覆盖改变其行为。
- 宗门特色机制必须重建为 v6 状态、资源、被动、反应表和通用效果。
- 特殊战斗资源按机制需要配置，可为空，首版每宗门最多一种。

### 9.4 宗门投影契约

```ts
interface SectCombatProjectionV6 {
  skills: SkillDef[];
  passives: SkillDef[];
  statusDefs: StatusDef[];
  skillLevels: Record<string, number>;
  skillOverrides: SkillDef[];
  resources: CombatResourceDef[];
  panel: CombatV6PanelContribution[];
  unitTags: string[];
  diagnostics: CombatV6ProjectionDiagnostic[];
}
```

宗门内容必须先编译为该结构，再与角色、装备、功法和修炼结果组合。宗门编译器不直接创建战斗 Session。

---

## 10. 新经脉系统

经脉的完整结构、特色机制边界和旧进度迁移以 [`combat-v6 宗门心法、技能与经脉系统设计`](./combat-v6-sect-skill-meridian-system-design.md) 为准。

### 10.1 结构

每个宗门固定两个流派，每个流派采用七层经脉：

- 每层恰好 3 个互斥节点。
- 每个流派保存且只保存 1 套方案，因此每宗门共 2 套。
- 激活流派时自动启用对应方案。
- 节点选择必须满足前置层和心法/人物等级条件。
- 战斗外免费切换流派、重置和修改节点；开战后使用已编译快照。

### 10.2 节点允许输出

经脉节点只能：

- patch 已有技能。
- grant / revoke 技能。
- 授予被动。
- 增加白名单面板贡献。
- 增加单位标签。

不得在 core 按节点 ID 分支，也不得让节点直接修改 BattleSession 内部状态。

### 10.3 编译顺序

```text
宗门基础技能
→ 心法等级与技能解锁
→ 流派基础 patch
→ 经脉节点按层级顺序编译
→ 技能/被动/面板契约校验
→ 最终 SkillDef、passives、skillLevels、skillOverrides
```

同一技能发生多个 patch 时必须有稳定顺序和冲突检测。不可组合的节点在战斗前报错，不允许后写覆盖掩盖内容错误。

---

## 11. 最终入场面板编译

### 11.1 编译管线

```text
角色身份 + 永久六维 + 境界
→ 道装附灵六维合成有效六维
→ character_panel_v1 裸身面板
→ 新修炼贡献
→ 道装器胚与阵法灵纹固定贡献
→ 新功法贡献
→ 宗门心法贡献
→ 经脉 patch 与贡献
→ 长期状态修正
→ 资源策略
→ 校验、诊断、封装 LineupUnit
```

所有贡献先在投影层归并，再把最终 `Attrs` 交给 core。core 不知道属性来自哪里。

### 11.2 面板贡献协议

第一版应采用小而明确的协议，例如：

```ts
interface CombatV6PanelContribution {
  sourceType:
    'training' | 'equipment' | 'manual' | 'sect' | 'meridian' | 'condition';
  sourceId: string;
  attr: AttrName;
  mode: 'flat' | 'percentBase';
  value: number;
  priority?: number;
}
```

不要照搬 v5 的 `BASE/FIXED/ADD/MULTIPLY/FINAL/OVERRIDE` 六阶段体系。若未来确有多乘区需求，应基于 v6 实际公式建立更小的、可审计的贡献规则。

### 11.3 校验

入场前至少校验：

- 必需面板值存在且为有限数。
- `hp/mp` 不超过新上限且不为非法负值。
- 技能 ID 唯一，所有引用均可解析。
- 每个主动技能都有明确等级。
- 被动冲突已解决。
- 经脉 patch 目标存在。
- 装备属性在白名单内。
- 版本戳完整。

---

## 12. 与现有机制的处理原则

| 现有机制 | v6 方向 |
| --- | --- |
| 六维基础属性 | 保留为持久真相，按 `character_panel_v1` 公式投影 |
| 当前 HP/MP | 按场景资源策略读取 |
| 境界 | 保留；兼容期映射 5～180 人物等级 |
| 种族 | 首版不进入 combat-v6 投影，不生成标签、面板、技能或被动 |
| 灵根 | 首版不进入 combat-v6 投影，不生成元素标签、共鸣、失配、技能或被动 |
| 命格 | 首版不进入 combat-v6 投影；战斗外经济、修炼或叙事作用不受影响 |
| 境界压制 | 默认不迁移；若保留，进入 rules-daoyou 且版本化 |
| 物法穿透 | 默认退出通用面板；个别技能可用公式/被动表达 |
| 暴击抵抗/暴伤减免 | 不直接迁移；有明确内容需求再增加通用机制 |
| 旧炼体 modifier/被动 | 全部停止，只有五轨等级迁移到新修炼 |
| 旧装备/法宝 | 不语义迁移，冻结并补偿/兑换 |
| 旧功法 | 不语义迁移，重建功法书系统 |
| 旧宗门战斗内容 | 全部重写为 v6 内容 |
| 宗门社会玩法 | 可保留并与新战斗进度解耦 |
| 旧战斗记录 | 继续由 v5 读取，不强转 v6 |

---
