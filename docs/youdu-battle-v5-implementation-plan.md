# 幽都 × battle-v5 机制实现分析

> 配套设计：`docs/youdu-sect-design.md`
>
> 本文确定实现边界、V1 降级方案和验收依据，不单独声明幽都的生产接入状态。
>
> 分析基线：2026-07-22 的 battle-v5 能力审计。`controlHitBonus`、`statusVisibility` 与 `stackPriority` 等既有通用能力按可复用接口计入；实施时仍须以当前代码和测试复核，不得复制接口或覆盖其他宗门的实现。
>
> `docs/youdu-sect-design.md` 已按本文结论收敛。下文“原设计”仅指收敛前提案；实施时以主设计稿中的玩家规则和本文的引擎依据共同验收。

## 1. 结论

幽都可以建立在 battle-v5 现有的 AbilityConfig、Buff、Listener、CombatResource 和 Effect 链上，不需要推翻战斗架构，但不能把设计稿逐字直接翻译成现有配置。

推荐边界如下：

- 保留：蚀魂五层、非线性层级削弱、失魂、归窍、受治疗削弱、魂火、首次解控、术伤与魂伤混合技能、四层终结。
- 做通用小扩展：分层状态变更事件、一次添加多层、按层取值、逐层驱散、受治疗削弱、不可暴击/不可吸血伤害、按目标状态层数缩放伤害、主动技能必然命中。
- 改为近似效果：魂伤使用现有真实伤害管道，只绕过物法防御，不绕过统一百分比减伤；混合技能产生两次伤害请求；忘川 DOT 使用实时法术攻击而非施加时快照。
- V1 删除：三目标忘川、向其他敌人扩散蚀魂、百鬼同哭影响全体。当前 BattleEngineV5 的生产主流程是严格 1v1，为一个宗门扩建队伍战斗会波及回合、目标、AI、胜负、日志和快照，不应在本次实现。
- 暂不实现：设计稿已经标记为暂缓的动画与声音表现。

这套方案新增的是通用原语，不让 battle-v5 认识“幽都”“蚀魂”“忘川”或“魂火”。

### 1.1 引擎变更准入

后续实施先按变更等级判断，不以“能做出来”作为接入理由：

| 等级 | 定义 | 幽都 V1 处理 |
| --- | --- | --- |
| 内容配置 | 复用 Ability、Buff、Listener、Effect、CombatResource 和标签组合，不改变通用语义 | 优先采用，幽都专属 ID 只允许出现在宗门内容目录 |
| 通用原语扩展 | 为现有模型补充可复用参数、事件或属性；默认值保持旧内容行为不变 | 允许，但必须使用中性命名、无宗门特判，并先有不引用幽都 ID 的原子测试 |
| 架构级改造 | 改变单位模型、行动流、目标选择、胜负、持久化或伤害主管道 | V1 禁止；用近似效果替代，等待对应系统统一升级 |

每项机制的实施顺序固定为：检查现有原语 → 能组合则只写内容配置 → 确有通用缺口才扩展 → 无法保持兼容则采用本文降级方案。禁止在 `battle-v5` 中判断 `sectId === 'youdu'`、幽都能力 ID 或幽都状态 ID。

## 2. 实施前 battle-v5 能力基线

本节记录的是判断“直接复用、通用扩展或降级”的审计基线。若表中的缺口已经在当前分支由通用实现补齐，应把它视为复用与回归验证项，不得再次新增平行字段或专属接口。

| 领域 | 当前事实 | 对幽都的影响 |
| --- | --- | --- |
| 战斗人数 | `BattleEngineV5` 只持有 `player` 与 `opponent`，目标选择系统未接入主行动流 | `aoe/maxTargets` 目前主要是元数据，不能真的攻击三名敌人 |
| 技能命中 | 一次 `SkillCastEvent` 决定整条主动效果链是否执行 | 术伤、魂伤、加层和控制天然共用一次命中 |
| 多段伤害 | 每个 `damage` effect 分别发布 `DamageRequestEvent` | 混合伤害可以实现，但术伤与魂伤是两个伤害包，不是一个混合包 |
| 真实伤害 | `DamageType.TRUE` 不读取物防/法防，仍进入统一增减伤、境界、暴击、随机浮动和护盾管道 | 不能直接满足“无视一切减伤、不可暴击” |
| Buff 层数 | `STACK_LAYER`、`maxLayers`、层数修改与刷新持续时间已存在 | 能承载蚀魂，但一次 Apply 默认只加 1 层，且没有层变更事件 |
| 分层属性 | `scaleByLayer` 只支持线性倍率 | 无法直接表达 3%/5%/8%/12% 的非线性曲线 |
| 驱散 | 普通驱散会移除整个 Buff | 无法直接表达“一次净化一层蚀魂” |
| 持续时间 | Buff 在宿主每次行动后减 1；当次行动新施加的 Buff 由运行时标记阻止立即 tick | 与“按目标自身行动计 3 回合”一致，1 回合保护状态无需配置成 2 |
| DOT | Buff 可监听 `ActionPreEvent` 造成伤害 | 忘川两次结算可直接实现，但默认读取实时施术属性 |
| 治疗 | `HEAL_AMPLIFY` 只读取治疗者；所有气血恢复最终都会调用 `Unit.heal()` | 没有受治疗削弱，但适合在 `Unit.heal()` 统一补齐 |
| 控制 | `BuffType.CONTROL` 会读取控制命中/抗性；`NO_ACTION`、`NO_SKILL` 已接入行动流 | 失魂与镇魂钉可复用现有控制体系 |
| 控制加值 | 当前工作区已有 `ApplyBuffParams.controlHitBonus` | “幽都铁律”可直接使用，无需临时修改施术者属性 |
| 监听预算 | 支持每行动、来源行动、回合、战斗和 Buff 生命周期预算 | 魂火每行动一次、首次解控和节点每场一次都可实现 |
| 战斗资源 | 支持定义、增减、全部消费、溢出和事件 | 魂火无需新资源系统 |
| 条件与计划 | 支持 Buff 层数、资源、血量等条件；effect plan 在准备施法时快照 | 镇魂按施法前层数决定 1/2 回合可直接实现 |
| 技能命中策略 | 引擎事件支持 `guaranteed`，但普通 AbilityConfig 不能声明 | 《照影》必然命中需要一个很小的配置扩展 |

## 3. 已纳入主设计稿的 V1 契约

### 3.1 魂伤改用“标准真实伤害”

主设计稿已经收敛为：

> 魂伤属于真实伤害，忽略物理防御与法术防御；仍受统一百分比减伤、境界威压、伤害免疫、护盾与免死影响。魂伤不可暴击，也不能被吸血。

原因：

- 现有真实伤害已经稳定经过统一伤害、护盾、日志和免死管道。
- 新增“绕过所有减伤”会要求每个 DamageRequest 继续区分哪些规则是普通减伤、哪些是规则级保护，很容易出现部分监听先减伤、部分监听后减伤的顺序漏洞。
- 幽都已经同时拥有防御绕过、属性削弱、禁疗和控制，不需要再取消通用减伤这一层反制。

不要新增 `DamageType.SOUL`。魂伤用 `DamageType.TRUE`，并以幽都能力机制标签加 `damageType === TRUE` 共同识别。这样 battle-v5 不需要理解宗门专属伤害枚举。

### 3.2 混合技能允许两个伤害包

《夺魄》《镇魂》的术伤与魂伤建议按两个连续 `damage` effect 实现：

1. 术伤发布一次 `DamageRequestEvent(MAGICAL)`。
2. 魂伤发布一次 `DamageRequestEvent(TRUE)`。
3. 两者共享同一次命中；任一技能闪避时整条效果链不执行。
4. 日志聚合器按同一 ability span 合并展示。

V1 不实现“一个 DamageRequest 内同时具有法术与真实两种结算方式”。那会要求 `DamageComponent` 自己携带 damageType，并重写防御、减伤、暴击、免疫和日志归类，属于不必要的伤害管道重构。

主设计稿已经明确混合技能的监听边界：

- 每个伤害包可以分别触发现有通用受击监听。
- 幽都自己的魂火、节点和每行动效果必须用 listener budget 保证只触发一次。
- 若将来出现多段触发滥用，再为所有多段技能统一设计 trigger group，而不是只为幽都加例外。

### 3.3 忘川改为单体、实时取值

V1《忘川潮》：

- 目标由“最多 3 名敌人”改为敌方单体。
- 持续 2 回合，每次目标行动前结算。
- 每次结算读取施术者当时的法术攻击，不做施加时数值快照。

真实三目标战斗需要同时改造：

- `BattleEngineV5` 的 player/opponent 模型
- 行动排序和默认目标
- AbilityContainer 的候选目标
- TargetSelectionSystem 接入
- 胜负判定
- 战斗状态快照和日志聚合
- 宗门自动战术的多目标上下文

这不是内容层扩展，本轮明确不做。

### 3.4 单目标替代条款

| 原设计 | V1 替代 |
| --- | --- |
| 《忘川潮》最多三目标 | 单体 |
| `tide-spread` 分摊多个目标 | 改为 `tide-cycle`，优先维持忘川与 3 层蚀魂 |
| `long-night` 同时维持两个目标 | 改为延后终结，维持单目标 4 层压力 |
| 「渡口回声」向随机另一敌人加层 | 每回合第一次对至少 4 层目标结算忘川时，追加 `0.12 × 法攻`魂伤 |
| 「百鬼同哭」给其余敌人加层 | 每场第一次触发失魂时，对该目标追加 `0.30 × 法攻`魂伤 |
| 「末渡无舟」失去 15%当前法力 | 改为失去 10%最大法力，复用现有 `targetMaxMpRatio` |
| 镇魄司命对照影目标绝对命中 | 改为自身对照影目标的魂伤每层额外提高 1%，最多 5% |
| 「名落幽都」击杀返还 | 改为终结后目标气血低于 20%时获得 3 魂火并返还 2 回合冷却，每场一次 |

这些替代保留流派意图，同时避免队伍战斗、动态命中改写、当前法力比例和精确击杀归因四项额外扩展。

## 4. 需要补齐或复用的通用原语

以下字段名和事件语义是幽都的兼容契约。若当前 battle-v5 已有同名能力，直接复用；若尚无，才按本节做最小通用扩展。所有新增字段必须给出保持旧行为的默认值。

### 4.1 分层状态原语

这是幽都最重要、也最值得做成通用能力的一组扩展。

#### A. 一次施加多层

为 `ApplyBuffParams` 增加：

```ts
layers?: number
```

- 新状态以该层数入场。
- 已有 `STACK_LAYER` 状态增加该层数，而不是固定增加 1。
- 仍受 `maxLayers` 限制。
- 省去在一个技能里重复写两次 `apply_buff`，也避免重复应用日志与阈值监听。

#### B. 层数变化事件

新增通用事件：

```ts
interface BuffLayerChangedEvent extends CombatEvent {
  type: 'BuffLayerChangedEvent';
  target: Unit;
  buff: Buff;
  source?: Unit;
  ability?: Ability;
  previousLayer: number;
  currentLayer: number;
  delta: number;
  reason: 'apply' | 'stack' | 'effect' | 'dispel';
}
```

要求：

- 只在层数实际变化时发布；5→5 的刷新不发布。
- 初次施加按 0→初始层数发布。
- `BuffContainer` 成为层变更的统一出口；`BuffLayerModifyEffect` 和逐层驱散都要透传来源与 ability。
- Buff 监听器必须在初次 0→N 事件发布前完成挂载。

用途：

- 4→5 时触发失魂。
- 实际加层时获取魂火，满层刷新不获取。
- 归窍将 5 层钳制回 4 层。
- 洗魂有价识别驱散掉层。
- 战斗日志精确显示旧层数与新层数。

这是事件模型的自然补全，不是幽都专属钩子。

#### C. 非线性按层属性

为 `AttributeModifierConfig` 增加一种互斥配置：

```ts
valueByLayer?: readonly number[]
```

约定数组下标 0 对应 1 层，超过数组长度沿用末项。不能与 `scaleByLayer` 同时使用。

蚀魂可直接配置：

```ts
ATK/MAGIC_ATK/DEF/MAGIC_DEF/SPEED:
[-0.03, -0.05, -0.08, -0.12, -0.12]
```

`DataDrivenBuff.onLayerChanged()` 已经会重新挂载线性层数 modifier，只需把取值策略从“value × layer”扩展为“按层取值”。

注意：降低 `SPEED` 会按现有派生公式间接影响物攻、物防、暴击和闪避，因此玩家实际面板中的攻击、防御变化会略大于表格名义值。这是当前五维属性架构的自然结果，不应为幽都新增独立“行动速度”属性。

#### D. 逐层驱散

为 `BuffConfig` 增加：

```ts
dispelMode?: 'whole' | 'one_layer'
```

缺省 `whole` 保持兼容。`one_layer` 且当前层数大于 1 时：

- 普通驱散只减 1 层。
- 发布 `BuffLayerChangedEvent(reason: 'dispel')` 与成功的 `DispelEvent`。
- 降到 0 时才真正发布 `BuffRemovedEvent`。
- 明确写“净化全部层数”的能力继续通过 `buff_layer_modify clear` 完整移除。

不要把蚀魂拆成五个独立 Buff。那会把加层、持续时间、状态栏、阈值和终结技读取都变成五状态组合问题。

### 4.2 受治疗削弱

新增外部注入型二级属性：

```ts
AttributeType.HEAL_RECEIVED_REDUCTION
```

- 底座为 0。
- 所有状态以 `ModifierType.FIXED` 写入削弱值，modifier 相加后在 `[0, 1]` 截断；不能使用会乘在零底座上的 `ADD`。
- 只影响气血恢复，不影响法力与护盾。

在 `Unit.heal(amount)` 统一应用：

```text
requested = 治疗效果根据施术者 HEAL_AMPLIFY 计算后的值
reduction = clamp(target.HEAL_RECEIVED_REDUCTION, 0, 1)
received = round(requested × (1 - reduction))
applied = min(缺失气血, received)
```

这样可以自然覆盖当前所有气血恢复来源：

- `HealEffect`
- `LifestealEffect`
- `DamageMemoryEffect` 的治疗释放
- `ResourceDrainEffect` 的气血恢复
- 后续新增但正确调用 `Unit.heal()` 的恢复

免死继续调用 `setHp(..., 'death_prevent')`，不受禁疗影响。现有 `HealEvent.healAmount/appliedAmount` 已能分别表达请求值与实得值，无需新增一条 HealingSystem 管道。

各状态配置：

| 状态 | 受治疗削弱 |
| --- | --- |
| 蚀魂 | `[0, 0.15, 0.30, 0.50, 1.00]` 按层取值 |
| 忘川 | `+0.20` |
| 不归 | `+0.80` |
| 镇魂钉 | `+1.00` |

统一在 100% 封顶，符合设计稿的叠加规则。

### 4.3 伤害行为开关

为 `DamageParams` 和对应伤害事件增加并透传：

```ts
canCrit?: boolean       // 缺省 true
canLifesteal?: boolean  // 缺省 true
```

- 魂伤配置 `false/false`。
- `DamageSystem` 在 `canCrit === false` 时跳过暴击。
- `DamageTakenEvent` 继续携带 `canLifesteal`，`LifestealEffect` 在 false 时退出。
- 不修改现有其他真实伤害的默认行为。

不要全局规定所有 `DamageType.TRUE` 都不能暴击或吸血；那会无意改变现有造物、命格和其他宗门内容。

### 4.4 按目标状态层数缩放单次伤害

为 `DamageParams` 增加通用动态分量：

```ts
buffLayerScalar?: {
  match: BuffMatchParams;
  attribute: AttributeType;
  coefficientPerLayer: number;
  minLayers?: number;
  maxLayers?: number;
}
```

《魂兮不归》按以下顺序：

1. `damage` 读取当前蚀魂层数，一次性计算 `0.70 + 0.20 × layer`。
2. 统一发布一个真实伤害请求。
3. completion effect 清除蚀魂；“不归亦不散”则改为设置到 2 层。
4. 施加不归。

这样不会产生四到五个独立伤害包，也不会重复触发护盾、反伤、吸血和受击监听。

伤害应在清层前结算，使《照影》仍能按终结前的蚀魂层数放大本次伤害。

### 4.5 主动技能命中策略

为 `AbilityConfig`、`ActiveSkillConfig` 和 `SectAbilityFactory` 增加：

```ts
hitPolicy?: 'normal' | 'guaranteed'
```

由 `AbilityContainer._prepareCast()` 写入 `SkillPreCastEvent`。现有 DamageSystem 已支持 `guaranteed`，后续无需改动命中公式。

V1 仅《照影》本身使用必然命中。照影将目标 `EVASION_RATE` 以 OVERRIDE 置 0，但其他能力仍遵守全局最低 3%闪避；因此玩家文案必须写成“闪避属性按 0 计算，仍保留最低闪避”，不能写成“后续攻击必定命中”。镇魄司命不再额外改写后续技能命中，采用第 3.4 节的近似增伤。

## 5. 各核心机制实现

### 5.1 蚀魂

Buff 配置要点：

- `type: DEBUFF`
- `duration: 3`
- `stackRule: STACK_LAYER`
- `maxLayers: 5`
- `dispelMode: one_layer`
- 层级 modifier 使用 `valueByLayer`
- 治疗削弱使用 `HEAL_RECEIVED_REDUCTION.valueByLayer`
- 运行时标签由 `GameplayTags.BUFF.SECT.namespace('youdu', 'soul-erosion')` 和对应状态构造器产生

技能添加 2 层时使用 `apply_buff.layers = 2`，不要重复两个 ApplyBuffEffect。

### 5.2 失魂与归窍

推荐事件流程：

```text
BuffLayerChangedEvent(蚀魂 4→5)
  ├─ 若目标有归窍：高优先级把蚀魂设为4，结束
  └─ 否则施加失魂控制
       ├─ 成功：目标下一行动因 NO_ACTION 跳过
       │        ControlledSkipEvent 时蚀魂设为3，并施加归窍保护窗口
       ├─ 控制抵抗：onResistEffects 将蚀魂设为3，并施加归窍
       ├─ 控制免疫：监听 BuffImmuneEvent，将蚀魂设为3，并施加归窍
       └─ 被心死神活解除：监听失魂 BuffRemovedEvent，将蚀魂设为3，并施加归窍
```

失魂 Buff：

- `type: CONTROL`
- `statusTags: [NO_ACTION]`
- `duration: 1`
- `HEAL_RECEIVED_REDUCTION +1.0`
- `dispelPolicy: protected`

失魂不再接受普通净化直接移除。它的主要反制是：在 5 层前逐层净化蚀魂、控制抵抗、控制免疫，以及《心死神活》这类明确的控制解除。这样避免为一个控制状态新增通用 `onRemoveEffects` 生命周期协议。

归窍 Buff：

- 内部保护状态，玩家可见，语义上持续 1 个完整反制窗口。
- 运行时 duration 配置为 1。`BuffContainer` 会调用 `markBuffAppliedAtCurrentAction`，`shouldTickBuffDuration` 会阻止新状态在施加它的同一次行动中立刻扣减，因此无需通过 duration 加一补偿。控制抵抗、免疫和首次解控分支统一使用同一配置。
- 监听蚀魂的 `BuffLayerChangedEvent`，优先级高于失魂触发器。
- 若当前层数超过 4，立即设回 4。
- 不直接免疫蚀魂，因此 3→5 的技能仍能实际推进到 4，而不是整次加层被拒绝。

### 5.3 魂火

定义：

```ts
{ id: 'sect.youdu.soul-fire', initial: 0, max: 3 }
```

获取：

- 蚀魂监听 `BuffLayerChangedEvent`。
- `delta > 0` 时将上下文 caster 映射为该 Buff 来源。
- listener budget 使用 `source_action: 1`，无论一次加 1 层还是 2 层都只获得 1 点。
- 5→5 刷新没有 layer event，因此不获取。

消费与增伤：

- 指定消费技能带幽都 `soul-fire-consumer` 机制标签。
- 常驻被动监听自身 `DamageRequestEvent`。
- 条件：魂火至少 3、伤害类型 TRUE、能力带 consumer 标签。
- 写入 `percent_damage_modifier increase 0.25`，节点可改为 0.35。
- 加层消费技在直接魂伤请求之后、施加蚀魂之前执行 `consume_all`；终结技在伤害后执行。这样施法前 2 点魂火不会被本技能刚产生的第 3 点无增伤地误消费，而施法前满魂火的技能可在消费后由本次加层重新开始积累。
- 忘川不带 consumer 标签，因此不会误消费。

### 5.4 心死神活

控制抗性 `+0.30 FIXED` 已可直接作为被动 modifier。

首次解控无需新增“解除最近控制”效果，可以由数据驱动监听组成：

1. 被动监听 `BuffAppliedEvent`，scope 为 owner_as_target。
2. 分别匹配三类功能控制标签：`NO_ACTION`、`NO_SKILL`、`NO_BASIC`。
3. 条件要求自身没有隐藏的永久 marker `heart-dead-used`。
4. 用 `buff_layer_modify clear` 清除刚落地的对应控制；该操作可明确越过普通 dispelPolicy。
5. 添加 marker，确保三个分类监听共享“每场一次”。
6. 添加持续 1 回合的分类免疫 Buff；其 `BuffAddEvent` 监听使用现有 `buff_immunity` 拦截相同功能标签。

分类免疫运行时配置 `duration: 1`；复用 `markBuffAppliedAtCurrentAction` 的当次行动免 tick 规则，对玩家也显示 1 回合，不额外延长。

“同类控制”在 V1 按行动限制语义定义：

- 眩晕、失魂等不能行动效果归为 `NO_ACTION`。
- 封印、沉默等不能施法效果归为 `NO_SKILL`。
- 不能普攻效果归为 `NO_BASIC`。

不增加睡眠、定身等只有名称没有行动语义的新控制枚举。若未来确实出现位移或站位系统，再扩充标准控制轴。

### 5.5 忘川

忘川是标准 DataDrivenBuff：

- 单体、`duration: 2`、`REFRESH_DURATION`
- 监听宿主 `ActionPreEvent`
- 造成 `0.14 × source.MAGIC_ATK` 的 TRUE 伤害
- `canCrit: false`、`canLifesteal: false`
- 增加 20%受治疗削弱
- 不加蚀魂，不触发主动加层魂火

招魂渡夜的“长夜回潮”不再刷新蚀魂持续时间，改为：

> 忘川对至少 3 层蚀魂目标造成的魂伤提高 20%；每回合第一次造成有效气血伤害时获得 1 点魂火。

这样完全复用伤害条件、百分比修正和回合预算，不新增“直接刷新任意现有 Buff 时长”的效果。

### 5.6 镇魂钉

- 控制 Buff 使用 `NO_SKILL`，AbilityContainer 会自动回退到默认攻击。
- 受治疗削弱为 100%，与控制 Buff 同生共灭。
- 控制被抵抗时不会添加 Buff，所以没有禁疗。
- 1/2 回合版本放入两个 effect layer；effect plan 在施法准备阶段按目标施法前蚀魂层数选择其中一个。
- 节点“幽都铁律”直接使用当前工作区已有的 `controlHitBonus: 0.15`。

若同一次《镇魂》先令目标进入 5 层：

- 失魂提供一次 NO_ACTION。
- 镇魂钉提供 NO_SKILL。
- 目标被跳过的行动结束后，两种状态都各自按宿主行动计时；2 回合镇魂钉最多在下一次实际行动继续迫使目标普攻。
- 不把两个控制合并为一个“三回合硬控”。

### 5.7 魂兮不归

- `castConditions`: 目标蚀魂至少 4 层。
- 单次 damage 使用 `buffLayerScalar`。
- 基础系数与每层系数由 Build Facade 提供，节点只改参数。
- 伤害后基础态 clear；“不归亦不散” set 到 2。
- 最后添加不归的速度与受治疗 modifier。

“名落幽都”采用目标结算后低于 20%气血的替代条件，不监听击杀。当前 `UnitDeadEvent` 没有完整 ability 归因和 listener mapping；为了一个终极节点扩充死亡归因收益太低。

### 5.8 照影

- 能力本身 `hitPolicy: guaranteed`。
- 照影 Buff 对 `EVASION_RATE` 使用 `OVERRIDE 0`。
- 蚀魂 Buff 监听宿主受到的 `DamageRequestEvent`；目标同时有照影时，用现有 `percent_damage_modifier` 和 `scaleByBuffLayer` 增加 `0.02 × 蚀魂层数`伤害。
- 镇魄司命额外为自身魂伤追加 `0.01 × 蚀魂层数`，不改变队友收益。
- 蚀魂清除后，其监听随 Buff 移除，易伤自然立即消失。

### 5.9 夺魄与层级属性

夺魄的独立降攻直接使用 ATK/MAGIC_ATK 的 ADD modifier。它会与蚀魂的同类 ADD modifier在现有属性阶段相加。

不要修改五项持久化基础属性，也不要给蚀魂创建旧式 `persistent_statuses`。

## 6. 36 个节点的实现评估

### 6.1 招魂渡夜

| 节点 | 结论 | 实现方式 |
| --- | --- | --- |
| 一水忘川 | 直接支持 | 编译时修改忘川两个伤害系数 |
| 唤名成痕 | 直接支持 | 《一叹》条件伤害或 DamageRequest listener |
| 魂灯初照 | 直接支持 | BattleInit/首次 layer event + battle marker |
| 潮声不歇 | 直接支持 | 忘川 duration 2→3 |
| 彼岸无医 | 依赖受治疗扩展 | modifier 0.20→0.30 |
| 黑水浸魄 | 直接支持 | 忘川增加 SPEED ADD -0.08 |
| 三魂皆远 | 依赖按层取值 | 替换蚀魂 valueByLayer 曲线 |
| 药石难入 | 依赖按层取值与受治疗扩展 | 替换治疗削弱曲线 |
| 渡口回声 | 原效果不支持 | 改为单目标每回合一次追加魂伤 |
| 江流不返 | 直接支持 | DOT 按目标层数条件增伤 |
| 洗魂有价 | 依赖层变更事件 | reason=dispel 时每行动一次伤害 |
| 两岸俱失 | 直接支持 | 不归 SPEED -0.30→-0.40 |
| 百鬼同哭 | 原效果不支持 | 改为首次失魂对当前目标追加魂伤 |
| 魂梦相侵 | 直接支持 | 失魂触发时重施 REFRESH_DURATION 忘川 |
| 末渡无舟 | 使用近似 | `mana_burn` 按 10%最大法力 |
| 不归亦不散 | 依赖单次层数缩放 | 伤害后 set 蚀魂为2 |
| 楚些成悲 | 依赖单次层数缩放 | perLayer 0.20→0.24 |
| 黑潮送行 | 直接支持 | 终结 completion 添加忘川 |

### 6.2 镇魄司命

| 节点 | 结论 | 实现方式 |
| --- | --- | --- |
| 铁入其影 | 直接支持 | 修改两个伤害 effect 系数 |
| 见影知名 | 直接支持 | 照影 duration 3→4 |
| 守神如城 | 直接支持 | CONTROL_RESISTANCE FIXED +0.10 |
| 一魄先夺 | 直接支持 | 夺魄 duration 2→3 |
| 钉下无声 | 直接支持 | Build Facade 修改 MP 55→45 |
| 狱火照名 | 直接支持 | 魂火 listener 0.25→0.35 |
| 三魂离座 | 直接支持 | 离魂引高层条件系数 0.78→0.884 |
| 先定其形 | 依赖层变更原语 | 每场一次 marker 后 apply 额外1层 |
| 心寂反照 | 直接支持 | 首次解控资源 +1→+2 |
| 四门皆闭 | 直接支持 | 高层镇魂额外 SPEED -0.20 Buff |
| 魂刑有度 | 直接支持 | `onResistEffects` 添加攻速减益 |
| 幽都铁律 | 当前工作区已支持 | `controlHitBonus: 0.15` |
| 五魄俱散 | 直接支持 | 失魂回落 effect 添加降攻 Buff |
| 神归有垣 | 直接支持 | 首次解控添加 10%最大气血护盾 |
| 一名一判 | 当前工作区已支持近似 | 终结后 `refund_paid_cost` 返还 20 法力并消费 marker |
| 司命判词 | 依赖单次层数缩放 | base 0.70→0.85 |
| 七寸断魂 | 依赖单次层数缩放 | perLayer 0.20→0.25 |
| 名落幽都 | 原击杀归因不便 | 改为终结后目标低于20%气血时触发 |

## 7. 不应采用的实现方式

- 不在 DamageSystem 中判断能力或宗门 ID 来绕过减伤。
- 不新增第二条灵魂生命值或在 Unit 上保存 soulHp。
- 不把蚀魂拆成五个独立状态。
- 不用五套 if/switch 在宗门编译器集中判断节点；参数进入 Build Facade，行为节点使用独立插件。
- 不为忘川接入一个只认识幽都的多目标列表。
- 不把 `battleProjection`、蚀魂层数、魂火或首次解控 marker 写入持久化模型。
- 不用负 `HEAL_AMPLIFY` 冒充受治疗削弱；它读取的是治疗者，在未来队伍战斗中语义会错误。
- 不用 `resolved_final` 实现魂伤；它会连统一增伤、境界、随机与标准计算管道一起绕过。
- 不让《照影》通过给目标写入超大负闪避来突破全局最低闪避；能力自身使用 guaranteed，后续能力遵守全局规则。
- 不在幽都实现期间整理、回滚或补完当前天衍工作区的无关改动。

## 8. 开发顺序

### 阶段一：通用原语

1. 分层状态：layers、BuffLayerChangedEvent、valueByLayer、one_layer dispel。
2. `HEAL_RECEIVED_REDUCTION` 与 `Unit.heal()` 统一应用。
3. `canCrit/canLifesteal`。
4. `buffLayerScalar`。
5. AbilityConfig hitPolicy。

每项先补 battle-v5 原子测试，不引用幽都 ID。

### 阶段二：幽都基础态

1. definition、ids、六心法、魂火。
2. 蚀魂、失魂、归窍和心死神活。
3. 七门神通。
4. 1v1 自动战术。

先完成无节点基础战斗矩阵，再进入道途。

### 阶段三：双道途

1. Build Facade 收集数值和行为特征。
2. 招魂渡夜 18 节点。
3. 镇魄司命 18 节点。
4. 节点代表组合和固定种子平衡模拟。

### 阶段四：展示与注册

1. 入门演出和现有本地资产。
2. 宗门地图、设施主题和组织主题。
3. 生产 Runtime 注册。
4. 状态栏、日志和能力详情；动画与声音按设计稿暂缓。

## 9. 验证矩阵

### 9.1 通用引擎测试

- 一次 apply 2 层只发布一次 layer change，delta=2。
- 5 层刷新不发布 layer change。
- valueByLayer 在增层、减层和 clone 后正确重挂 modifier。
- one_layer 驱散 4→3，不移除 Buff；1→0 才移除。
- 受治疗削弱覆盖 Heal、Lifesteal、DamageMemory 和 ResourceDrain，MP/护盾/免死不受影响。
- canCrit=false 在高暴击率下仍不暴击。
- canLifesteal=false 不触发吸血。
- buffLayerScalar 只发布一次 DamageRequest。
- guaranteed 能从 AbilityConfig 走完整施法流程。

### 9.2 幽都基础测试

- 蚀魂完整状态矩阵：0→1、1→3、3→5、归窍期3→5钳制为4、5→3。
- 失魂成功、控制抵抗、控制免疫和心死神活解除四条收束路径都回到3层并进入归窍。
- 心死神活只触发一次，按 NO_ACTION/NO_SKILL/NO_BASIC 免疫同类控制。
- 魂火只在实际加层时获得，每来源行动最多1点，满层刷新不获取。
- 混合技能共用命中，但发布魔法与真实两个伤害包。
- 镇魂钉被抵抗时不产生禁疗。
- 终结技按4层/5层读取系数并在伤害后正确 clear/set2。
- 照影易伤实时跟随蚀魂层数。

### 9.3 暂不测试

- 三目标忘川与多敌扩散：当前 1v1 架构无生产语义。
- 双幽都共享蚀魂：当前生产战斗没有同队多单位。
- 动画、音效和受击表现：设计稿已明确暂缓。

### 9.4 完整实现后的命令

```bash
bunx vitest run src/shared/engine/battle-v5/tests
bunx vitest run src/shared/engine/sect/content/youdu
bunx vitest run src/shared/engine/sect
bun run lint
bun run test
bun run build
```

## 10. 最终判断

幽都真正需要 battle-v5 补齐的是“通用分层状态”和“受治疗削弱”两块基础能力；它们都与现有 Buff/Attribute 架构一致，属于自然扩展。

魂伤绕过全部减伤、真实多目标、施加时 DOT 快照、一个事件混合两种伤害通道、按击杀精确返还等设计，不值得在 V1 为单宗门扩大战斗引擎。采用本文近似效果后，幽都仍然完整保留“越防、蚕食、禁疗、失魂、终结”的核心体验，同时不会让 battle-v5 永久背负宗门专属语义。
