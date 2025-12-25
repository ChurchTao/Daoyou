# 角色临时状态引擎设计文档

## 1. 背景与问题

### 1.1 当前问题

现有系统在战斗引擎(`battleEngine.ts`)和副本系统(`service_v2.ts`)中对临时状态的处理存在以下问题:

1. **状态管理分散**: 状态效果硬编码在战斗引擎中,缺乏统一的状态管理机制
2. **扩展性差**: 新增状态类型需要修改多处代码,维护成本高
3. **状态数据不一致**: 战斗引擎中的`StatusInstance`与副本系统中的状态损耗(`ResourceLossSchema`)缺乏统一模型
4. **副本状态无法持久**: 副本中产生的虚弱、法宝损坏等状态无法传递到战斗引擎
5. **状态效果计算耦合**: 状态的效果计算逻辑直接嵌入战斗流程,难以复用

### 1.2 设计目标

设计一个通用的角色临时状态引擎,满足以下目标:

1. **统一状态模型**: 建立跨系统的统一状态数据结构
2. **高扩展性**: 支持灵活定义新状态类型及其效果
3. **生命周期管理**: 统一管理状态的创建、持续、消退全流程
4. **效果计算解耦**: 将状态效果计算从业务逻辑中分离
5. **跨场景适用**: 同时支持战斗、副本、世界探索等多种场景

## 2. 核心设计

### 2.1 状态分类体系

临时状态按影响范围分为三大类:

#### 2.1.1 战斗状态 (Combat Status)

仅在战斗中生效,战斗结束后自动清除。

**增益类(Buff)**:
- 护体(armor_up): 减伤提升
- 疾行(speed_up): 速度提升,影响出手顺序和闪避
- 锋锐(crit_rate_up): 暴击率提升
- 灵力澎湃(spirit_surge): 法术伤害提升
- 神识清明(wisdom_boost): 暴击伤害提升

**减益类(Debuff)**:
- 破防(armor_down): 减伤降低
- 迟缓(speed_down): 速度降低
- 暴击压制(crit_rate_down): 暴击率降低
- 灵力紊乱(spirit_chaos): 法术伤害降低

**控制类(Control)**:
- 眩晕(stun): 无法行动
- 沉默(silence): 无法使用技能
- 定身(root): 无法闪避

**持续伤害类(DOT)**:
- 灼烧(burn): 火元素持续伤害
- 流血(bleed): 物理持续伤害
- 中毒(poison): 毒素持续伤害
- 腐蚀(corrosion): 防御降低并持续伤害

#### 2.1.2 持久状态 (Persistent Status)

跨战斗保持,可在多个场景中生效。

**虚弱类**:
- 轻伤(minor_wound): 全属性降低5%-10%
- 重伤(major_wound): 全属性降低15%-30%
- 濒死(near_death): 全属性降低40%-60%
- 虚弱(weakness): 气血和灵力上限降低

**资源损耗类**:
- 法宝损坏(artifact_damaged): 特定法宝无法使用或效果降低
- 灵力枯竭(mana_depleted): 初始灵力降低
- 气血亏损(hp_deficit): 初始气血降低

**增益类**:
- 顿悟(enlightenment): 修炼速度提升
- 神识强化(willpower_enhanced): 抗性提升
- 命数加持(fate_blessing): 特定属性临时提升

#### 2.1.3 环境状态 (Environmental Status)

由外部环境触发,影响角色在特定场景中的表现。

- 高温(scorching): 火元素伤害增加,冰元素减弱
- 严寒(freezing): 冰元素伤害增加,速度降低
- 毒雾(toxic_air): 持续中毒,抗性降低
- 禁制压制(formation_suppressed): 法术威力降低
- 天地灵气充沛(abundant_qi): 灵力恢复加快

### 2.2 统一状态数据模型

#### 2.2.1 核心状态定义

| 字段 | 类型 | 说明 |
|------|------|------|
| statusId | string | 状态唯一标识 |
| statusType | StatusType | 状态类型(buff/debuff/control/dot/persistent/environmental) |
| statusKey | StatusEffect | 状态效果键(对应constants中的枚举) |
| displayName | string | 显示名称 |
| description | string | 状态描述 |
| source | StatusSource | 状态来源信息 |
| duration | StatusDuration | 持续时间配置 |
| potency | number | 强度值(用于伤害、效果计算) |
| stackable | boolean | 是否可叠加 |
| maxStack | number | 最大叠加层数 |
| currentStack | number | 当前叠加层数 |
| metadata | Record&lt;string, any&gt; | 扩展元数据 |

#### 2.2.2 状态来源(StatusSource)

记录状态的产生源,用于计算和日志追溯。

| 字段 | 类型 | 说明 |
|------|------|------|
| sourceType | SourceType | 来源类型(skill/artifact/consumable/environment/system) |
| sourceId | string | 来源实体ID |
| sourceName | string | 来源名称 |
| casterSnapshot | CasterSnapshot(可选) | 施放者快照(用于DOT等计算) |

**CasterSnapshot结构**:

| 字段 | 类型 | 说明 |
|------|------|------|
| casterId | string | 施放者ID |
| casterName | string | 施放者名称 |
| attributes | Attributes | 施放时的属性快照 |
| elementMultipliers | Record&lt;ElementType, number&gt; | 元素加成快照 |

#### 2.2.3 持续时间(StatusDuration)

灵活的时间管理模型,支持多种计时方式。

| 字段 | 类型 | 说明 |
|------|------|------|
| durationType | DurationType | 时间类型(turn/realtime/permanent/conditional) |
| remaining | number | 剩余时长 |
| total | number | 总时长 |
| tickInterval | number(可选) | 触发间隔(用于DOT等) |
| condition | StatusCondition(可选) | 消退条件 |

**DurationType说明**:
- turn: 回合制计时,每回合递减
- realtime: 真实时间计时(秒),用于副本等场景
- permanent: 永久,需手动清除或满足条件
- conditional: 条件触发消退

**StatusCondition结构**:

| 字段 | 类型 | 说明 |
|------|------|------|
| conditionType | ConditionType | 条件类型(combat_end/heal_above/dispel/time_expired) |
| conditionValue | any | 条件参数 |

### 2.3 状态效果计算器(Status Effect Calculator)

将状态的效果计算从业务逻辑中抽离,形成独立的计算层。

#### 2.3.1 效果计算器接口

每种状态类型对应一个效果计算器,负责:
- 状态应用时的初始效果计算
- 每回合/每秒的持续效果计算
- 状态消退时的清理计算

**计算器职责**:

| 计算器类型 | 职责 | 输入 | 输出 |
|------------|------|------|------|
| AttributeModifierCalculator | 属性修正计算 | 状态实例+基础属性 | 修正后属性 |
| DamageOverTimeCalculator | 持续伤害计算 | 状态实例+目标快照 | 伤害值 |
| ActionBlockerCalculator | 行动限制判定 | 状态实例 | 是否可行动 |
| ResistanceCalculator | 抗性计算 | 攻击者属性+防御者属性 | 抵抗成功率 |

#### 2.3.2 效果应用管道

状态效果应用遵循标准管道流程:

```
状态创建请求 
  → 抵抗判定(ResistanceCalculator) 
  → 叠加规则检查 
  → 状态实例生成 
  → 初始效果应用(AttributeModifierCalculator等) 
  → 注册到状态容器
```

#### 2.3.3 效果刷新管道

每回合/每秒触发:

```
遍历所有活动状态 
  → 持续效果计算(DOT/属性修正等) 
  → 时长递减 
  → 消退检查 
  → 清理过期状态
```

### 2.4 状态生命周期管理

#### 2.4.1 状态容器(StatusContainer)

每个角色拥有一个状态容器,负责管理其所有临时状态。

**容器职责**:
- 维护状态列表
- 处理状态添加/移除
- 触发状态效果刷新
- 提供状态查询接口

**核心方法**:

| 方法 | 参数 | 返回 | 说明 |
|------|------|------|------|
| addStatus | statusRequest, targetUnit | ApplyResult | 添加状态,包含抵抗判定 |
| removeStatus | statusId | boolean | 移除指定状态 |
| hasStatus | statusKey | boolean | 检查是否存在某状态 |
| getStatus | statusKey | StatusInstance(可选) | 获取状态实例 |
| tickStatuses | context | TickResult | 触发一次状态刷新 |
| clearStatusesByType | statusType | number | 按类型清除状态 |
| clearAllStatuses | - | void | 清除所有状态 |
| getActiveStatuses | - | StatusInstance[] | 获取所有活动状态 |

#### 2.4.2 状态添加流程

1. **创建请求**: 构建StatusApplicationRequest,包含状态定义、来源、目标等
2. **抵抗判定**: 根据施放者和目标属性计算抵抗概率
3. **叠加检查**: 检查是否与现有状态冲突或叠加
4. **实例化**: 生成StatusInstance并赋予唯一ID
5. **注册**: 添加到容器并触发初始效果

#### 2.4.3 状态刷新流程

每回合(或每秒)触发一次:

1. **遍历状态**: 按优先级遍历所有活动状态
2. **执行效果**: 调用对应计算器计算DOT、属性修正等
3. **时长递减**: 根据durationType更新remaining
4. **条件检查**: 判断是否满足消退条件
5. **清理过期**: 移除已过期的状态并触发消退效果

#### 2.4.4 状态清除规则

| 清除触发器 | 清除范围 | 场景 |
|------------|----------|------|
| 战斗结束 | 所有战斗状态(Combat Status) | 战斗流程结束 |
| 手动驱散 | 指定debuff/控制 | 使用净化技能/道具 |
| 时长耗尽 | 单个状态 | 自然流逝 |
| 死亡 | 所有状态 | 角色死亡 |
| 条件满足 | 条件状态 | 气血恢复至80%等 |

### 2.5 与战斗引擎集成

#### 2.5.1 集成点设计

在战斗引擎中集成状态引擎需要修改以下关键节点:

**初始化阶段**:
- BattleUnit增加statusContainer字段
- 支持从外部传入初始状态(来自副本等场景)

**回合开始阶段**:
- 触发statusContainer.tickStatuses()
- 应用DOT伤害到HP
- 检查行动限制(stun/root)

**技能执行阶段**:
- 技能命中后调用statusContainer.addStatus()应用状态效果
- 法宝特效触发状态

**属性计算阶段**:
- 调用AttributeModifierCalculator获取修正后属性
- 暴击率、减伤等受状态影响的计算纳入状态系统

**战斗结束阶段**:
- 清除所有Combat Status
- 保留Persistent Status返回给上层系统

#### 2.5.2 现有代码改造映射

| 现有逻辑 | 改造方案 |
|----------|----------|
| statuses: Map&lt;StatusEffect, StatusInstance&gt; | 替换为statusContainer: StatusContainer |
| tickStatusEffects()函数 | 调用statusContainer.tickStatuses() |
| applyStatus()函数 | 调用statusContainer.addStatus() |
| calculateDotDamage()函数 | 移入DamageOverTimeCalculator |
| isActionBlocked()函数 | 调用ActionBlockerCalculator |
| 属性修正逻辑(armor_up/down等) | 移入AttributeModifierCalculator |

#### 2.5.3 副本状态传递

副本系统产生的持久状态需要传递到战斗引擎:

**传递流程**:
1. 副本系统在`handleAction`中处理costs时,生成对应的StatusInstance
2. 将StatusInstance存入DungeonState的persistentStatuses字段
3. 创建战斗会话时,将persistentStatuses传递给BattleSession
4. 战斗引擎初始化BattleUnit时,加载persistentStatuses到statusContainer
5. 战斗结束后,将剩余的Persistent Status回写到DungeonState

**状态转换示例**:

| 副本Cost类型 | 状态类型 | 状态效果 |
|--------------|----------|----------|
| weak(value=5) | persistent:weakness | 全属性降低5% |
| hp_loss(value=3) | persistent:hp_deficit | 初始HP降低30% |
| artifact_damage | persistent:artifact_damaged | 特定法宝无法使用 |

### 2.6 扩展性设计

#### 2.6.1 新增状态类型

新增状态只需:
1. 在StatusEffect枚举中添加新状态键
2. 实现对应的EffectCalculator
3. 在StatusRegistry中注册状态定义和计算器

无需修改容器或引擎核心代码。

#### 2.6.2 自定义计算逻辑

支持通过metadata字段传递自定义参数,计算器可读取并应用特殊逻辑。

示例:法宝诅咒"每次使用消耗气血"
- 状态类型: persistent
- statusKey: blood_cost_curse
- metadata: { costPerUse: 50, artifactId: "xxx" }
- 计算器: 在技能使用时检查artifactId并扣除HP

#### 2.6.3 多状态协同

支持定义状态间的协同关系:

- **互斥**: 某些buff/debuff不可共存(如护体与破防)
- **转化**: 叠加到上限后转化为更强状态(如中毒→剧毒)
- **触发**: 某状态存在时触发特殊效果(如灼烧+中毒→爆炸伤害)

通过StatusRegistry配置协同规则,容器在添加状态时自动处理。

## 3. 数据结构定义

### 3.1 TypeScript类型定义

#### 状态类型枚举

```
StatusType: 
  - 'buff'(增益)
  - 'debuff'(减益)
  - 'control'(控制)
  - 'dot'(持续伤害)
  - 'persistent'(持久)
  - 'environmental'(环境)
```

#### 来源类型枚举

```
SourceType:
  - 'skill'(技能)
  - 'artifact'(法宝)
  - 'consumable'(消耗品)
  - 'environment'(环境)
  - 'system'(系统)
```

#### 时间类型枚举

```
DurationType:
  - 'turn'(回合)
  - 'realtime'(实时)
  - 'permanent'(永久)
  - 'conditional'(条件)
```

#### 条件类型枚举

```
ConditionType:
  - 'combat_end'(战斗结束)
  - 'heal_above'(治疗至阈值以上)
  - 'dispel'(驱散)
  - 'time_expired'(时间到期)
  - 'custom'(自定义)
```

### 3.2 状态实例完整结构

#### StatusInstance

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| statusId | string | 是 | - | 唯一标识(UUID) |
| statusType | StatusType | 是 | - | 状态类型 |
| statusKey | StatusEffect | 是 | - | 状态键(关联常量) |
| displayName | string | 是 | - | 显示名称 |
| description | string | 否 | "" | 状态描述 |
| source | StatusSource | 是 | - | 来源信息 |
| duration | StatusDuration | 是 | - | 持续时间 |
| potency | number | 否 | 0 | 强度(用于伤害计算) |
| stackable | boolean | 否 | false | 是否可叠加 |
| maxStack | number | 否 | 1 | 最大叠加层数 |
| currentStack | number | 否 | 1 | 当前层数 |
| element | ElementType | 否 | - | 关联元素(用于DOT) |
| metadata | Record&lt;string, any&gt; | 否 | {} | 扩展数据 |
| createdAt | number | 是 | - | 创建时间戳 |

#### StatusSource

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| sourceType | SourceType | 是 | 来源类型 |
| sourceId | string | 否 | 来源实体ID |
| sourceName | string | 是 | 来源名称 |
| casterSnapshot | CasterSnapshot | 否 | 施放者快照 |

#### CasterSnapshot

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| casterId | string | 是 | 施放者ID |
| casterName | string | 是 | 施放者名称 |
| attributes | Attributes | 是 | 属性快照 |
| elementMultipliers | Record&lt;ElementType, number&gt; | 否 | 元素加成 |

#### StatusDuration

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| durationType | DurationType | 是 | 时间类型 |
| remaining | number | 是 | 剩余时长 |
| total | number | 是 | 总时长 |
| tickInterval | number | 否 | 触发间隔(秒或回合) |
| condition | StatusCondition | 否 | 消退条件 |

#### StatusCondition

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| conditionType | ConditionType | 是 | 条件类型 |
| conditionValue | any | 否 | 条件参数 |

### 3.3 状态应用请求

#### StatusApplicationRequest

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| statusKey | StatusEffect | 是 | 要应用的状态键 |
| source | StatusSource | 是 | 来源信息 |
| durationOverride | Partial&lt;StatusDuration&gt; | 否 | 覆盖默认时长 |
| potency | number | 否 | 强度(覆盖默认) |
| stackToAdd | number | 否 | 叠加层数 |
| metadata | Record&lt;string, any&gt; | 否 | 自定义数据 |

#### ApplyResult

| 字段 | 类型 | 说明 |
|------|------|------|
| success | boolean | 是否成功应用 |
| statusId | string(可选) | 生成的状态ID |
| resistedByWillpower | boolean | 是否被抵抗 |
| conflictedWith | StatusEffect(可选) | 冲突的状态 |
| message | string | 结果描述 |

### 3.4 状态刷新上下文

#### TickContext

| 字段 | 类型 | 说明 |
|------|------|------|
| currentTurn | number | 当前回合数(战斗场景) |
| currentTime | number | 当前时间戳(实时场景) |
| unitSnapshot | UnitSnapshot | 目标单位快照 |
| battleContext | BattleContext(可选) | 战斗上下文 |

#### UnitSnapshot

| 字段 | 类型 | 说明 |
|------|------|------|
| unitId | string | 单位ID |
| currentHp | number | 当前HP |
| currentMp | number | 当前MP |
| baseAttributes | Attributes | 基础属性 |

#### TickResult

| 字段 | 类型 | 说明 |
|------|------|------|
| damageDealt | number | 造成的伤害(DOT) |
| healingDone | number | 恢复的HP |
| expiredStatuses | string[] | 本次过期的状态ID |
| effectLogs | string[] | 效果日志 |

## 4. 核心流程

### 4.1 状态应用流程

```
[开始] 创建StatusApplicationRequest
  ↓
[步骤1] 从StatusRegistry获取状态定义
  ↓
[步骤2] 检查目标是否已有相同状态键
  ↓
  └→ 是,且不可叠加 → [检查互斥规则] → 移除冲突状态或拒绝
  └→ 是,且可叠加 → 增加currentStack(不超过maxStack)
  └→ 否 → [继续]
  ↓
[步骤3] 抵抗判定(Debuff/Control类型)
  ↓
  └→ 调用ResistanceCalculator计算抵抗率
  └→ 随机判定是否抵抗
  └→ 抵抗成功 → 返回ApplyResult(success=false, resistedByWillpower=true)
  ↓
[步骤4] 生成StatusInstance
  ↓
  └→ 赋予唯一statusId(UUID)
  └→ 填充duration、potency、source等字段
  └→ 记录createdAt时间戳
  ↓
[步骤5] 添加到StatusContainer
  ↓
[步骤6] 触发初始效果(如属性修正立即生效)
  ↓
[结束] 返回ApplyResult(success=true, statusId=xxx)
```

### 4.2 状态刷新流程(每回合)

```
[开始] battleEngine调用statusContainer.tickStatuses(context)
  ↓
[步骤1] 遍历所有活动状态(按优先级排序)
  ↓
[步骤2] 对每个状态执行:
  ↓
  ├→ [2.1] 检查durationType
  │   └→ turn: remaining -= 1
  │   └→ realtime: remaining -= (currentTime - lastTickTime)
  │   └→ conditional: 检查condition是否满足
  ↓
  ├→ [2.2] 触发持续效果
  │   └→ dot类型: 调用DamageOverTimeCalculator计算伤害
  │   └→ buff/debuff: 属性修正已在计算属性时应用,此处无需额外操作
  │   └→ control: 行动限制已在isActionBlocked中判定
  ↓
  ├→ [2.3] 记录效果日志
  │   └→ "角色X受到灼烧影响,损失Y点气血"
  ↓
  ├→ [2.4] 检查是否过期
  │   └→ remaining <= 0 或 condition满足 → 标记为待移除
  ↓
[步骤3] 移除所有过期状态
  ↓
[步骤4] 构建TickResult
  ↓
  └→ 汇总damageDealt、expiredStatuses、effectLogs
  ↓
[结束] 返回TickResult给战斗引擎
```

### 4.3 副本状态生成与传递流程

```
[副本系统] 玩家选择选项,触发costs
  ↓
[步骤1] 遍历chosenOption.costs
  ↓
  └→ type='weak': 
      └→ 创建StatusApplicationRequest
      └→ statusKey='weakness'
      └→ potency=value(影响属性降低百分比)
      └→ durationType='permanent'
      └→ 添加到DungeonState.persistentStatuses
  ↓
  └→ type='artifact_damage':
      └→ statusKey='artifact_damaged'
      └→ metadata={ artifactId: "xxx" }
      └→ 添加到persistentStatuses
  ↓
  └→ type='hp_loss':
      └→ statusKey='hp_deficit'
      └→ potency=value * 30(HP损失量)
      └→ 添加到persistentStatuses
  ↓
[步骤2] 保存DungeonState到Redis
  ↓
[步骤3] 若触发battle:
  ↓
  └→ 创建BattleSession
  └→ 传递persistentStatuses到session
  ↓
[战斗引擎] 初始化BattleUnit
  ↓
  └→ 从BattleSession加载persistentStatuses
  └→ 调用statusContainer.addStatus()逐个添加
  ↓
[战斗进行] 状态生效
  ↓
  └→ hp_deficit: 初始化时HP = maxHp - potency
  └→ weakness: 计算属性时应用百分比减值
  └→ artifact_damaged: 无法使用对应法宝
  ↓
[战斗结束] 清理战斗状态,保留持久状态
  ↓
  └→ clearStatusesByType('buff'|'debuff'|'control'|'dot')
  └→ 保留type='persistent'的状态
  ↓
[返回副本] 将剩余persistentStatuses回写DungeonState
  ↓
[副本继续] 后续战斗继续携带这些状态
```

### 4.4 属性计算流程(集成状态修正)

```
[开始] 计算角色最终属性
  ↓
[步骤1] 获取基础属性(base attributes)
  ↓
[步骤2] 应用装备加成
  ↓
[步骤3] 应用功法加成
  ↓
[步骤4] 应用命格加成
  ↓
[步骤5] 调用statusContainer.getActiveStatuses()
  ↓
[步骤6] 对每个状态调用AttributeModifierCalculator
  ↓
  └→ armor_up: vitality修正 +15%
  └→ armor_down: vitality修正 -15%
  └→ speed_up: speed修正 +20
  └→ weakness(persistent): 全属性修正 -potency%
  └→ ...
  ↓
[步骤7] 汇总所有修正值
  ↓
[步骤8] 应用上下限约束(如减伤不超过70%)
  ↓
[结束] 返回最终属性
```

## 5. 实现要点

### 5.1 状态注册表(StatusRegistry)

维护所有状态的元信息,作为状态引擎的配置中心。

**职责**:
- 存储状态定义(默认duration、效果类型等)
- 映射statusKey到EffectCalculator
- 定义状态间的互斥、协同关系
- 提供查询接口

**数据结构示例**:

| statusKey | statusType | defaultDuration | calculator | conflictsWith | 说明 |
|-----------|------------|-----------------|------------|---------------|------|
| burn | dot | {type:'turn',total:3} | DotCalculator | - | 灼烧 |
| armor_up | buff | {type:'turn',total:2} | AttributeModifier | armor_down | 护体 |
| weakness | persistent | {type:'permanent'} | AttributeModifier | - | 虚弱 |

### 5.2 计算器实现策略

#### 5.2.1 属性修正计算器(AttributeModifierCalculator)

接受状态实例和基础属性,返回修正后属性。

**逻辑示例**:
- armor_up: vitality增加15%(乘法修正)
- weakness: 全属性降低potency%(potency=5表示降低5%)
- spirit_surge: spirit增加20%(加法修正)

**修正顺序**: 先加法 → 再乘法 → 最后应用上下限

#### 5.2.2 持续伤害计算器(DamageOverTimeCalculator)

计算DOT每回合伤害,复用battleEngine中的calculateDotDamage逻辑。

**输入**:
- status: StatusInstance(包含potency、element、source.casterSnapshot)
- target: UnitSnapshot(包含当前HP、属性)

**输出**:
- damage: number

**关键逻辑**:
- 基于casterSnapshot的spirit和elementMultipliers计算
- 受target的vitality(减伤)影响
- 不同DOT类型(burn/bleed/poison)的系数不同

#### 5.2.3 行动限制计算器(ActionBlockerCalculator)

判断是否可行动,替代battleEngine中的isActionBlocked。

**输入**: statusContainer

**输出**: { canAct: boolean, canUseSkill: boolean, canDodge: boolean }

**逻辑**:
- stun: 全部为false
- silence: canUseSkill=false,其他为true
- root: canDodge=false,其他为true

#### 5.2.4 抗性计算器(ResistanceCalculator)

计算状态抵抗成功率,替代battleEngine中的calculateStatusHitChance。

**输入**:
- attackerWillpower: number
- defenderWillpower: number
- statusPotency: number

**输出**: resistChance: number(0-1)

**逻辑**:
- baseHit = min(0.8, max(0.2, potency / 250))
- resist = min(0.7, defenderWillpower / 3000)
- resistChance = resist * (1 - baseHit)

### 5.3 状态容器实现细节

#### 5.3.1 内部数据结构

使用Map存储状态,支持按ID和按Key快速查询:

- statusesById: Map&lt;string, StatusInstance&gt;(按statusId索引)
- statusesByKey: Map&lt;StatusEffect, StatusInstance[]&gt;(按statusKey索引,支持叠加)

#### 5.3.2 叠加逻辑

**不可叠加**:
- 添加相同statusKey时,比较potency
- 保留potency更高的,或刷新duration

**可叠加**:
- currentStack += stackToAdd
- 限制currentStack <= maxStack
- 各层独立计时或共享duration(可配置)

#### 5.3.3 优先级排序

tickStatuses时按优先级处理:
1. 控制类(control) - 最高优先级,影响后续行动
2. 属性修正类(buff/debuff) - 中优先级
3. 持续伤害类(dot) - 低优先级

### 5.4 性能优化考虑

#### 5.4.1 缓存机制

- 缓存属性修正结果,避免每次技能判定时重复计算
- 状态变化时(添加/移除/刷新)使缓存失效

#### 5.4.2 批量操作

- tickStatuses一次处理所有状态,减少遍历次数
- 批量添加状态(如环境debuff应用到所有单位)时合并抵抗判定

#### 5.4.3 懒加载

- EffectCalculator按需加载,减少初始化开销
- StatusRegistry支持动态注册,无需一次性加载所有定义

## 6. 接口设计

### 6.1 StatusContainer接口

#### 添加状态

```
输入:
  - request: StatusApplicationRequest
  - target: UnitSnapshot

输出:
  - result: ApplyResult

行为:
  1. 验证statusKey合法性
  2. 执行抵抗判定
  3. 检查叠加规则
  4. 生成并注册StatusInstance
  5. 返回结果
```

#### 移除状态

```
输入:
  - statusId: string

输出:
  - success: boolean

行为:
  1. 从statusesById中移除
  2. 从statusesByKey中移除
  3. 触发清理回调(如属性重新计算)
```

#### 检查状态存在

```
输入:
  - statusKey: StatusEffect

输出:
  - exists: boolean

行为:
  查询statusesByKey是否有对应key
```

#### 获取状态实例

```
输入:
  - statusKey: StatusEffect

输出:
  - status: StatusInstance | undefined

行为:
  返回第一个匹配的实例(若可叠加则返回数组)
```

#### 刷新状态

```
输入:
  - context: TickContext

输出:
  - result: TickResult

行为:
  1. 遍历所有状态
  2. 递减duration
  3. 执行持续效果
  4. 清理过期状态
  5. 返回汇总结果
```

#### 清除特定类型状态

```
输入:
  - statusType: StatusType | StatusType[]

输出:
  - removedCount: number

行为:
  移除所有匹配类型的状态
```

#### 清除所有状态

```
输入: 无

输出: 无

行为:
  清空statusesById和statusesByKey
```

#### 获取活动状态列表

```
输入: 无

输出:
  - statuses: StatusInstance[]

行为:
  返回所有未过期的状态实例数组
```

### 6.2 EffectCalculator接口

所有计算器实现统一接口:

#### 计算效果

```
输入:
  - status: StatusInstance
  - context: CalculationContext(可包含target、caster、battleContext等)

输出:
  - effect: EffectResult(具体结构依计算器类型而定)

行为:
  根据status的potency、element、metadata等字段计算效果
```

### 6.3 StatusRegistry接口

#### 注册状态定义

```
输入:
  - statusKey: StatusEffect
  - definition: StatusDefinition

输出: 无

行为:
  将状态定义存入内部映射表
```

#### 获取状态定义

```
输入:
  - statusKey: StatusEffect

输出:
  - definition: StatusDefinition | undefined

行为:
  查询并返回状态定义
```

#### 注册计算器

```
输入:
  - statusKey: StatusEffect
  - calculator: EffectCalculator

输出: 无

行为:
  将计算器与状态键关联
```

#### 获取计算器

```
输入:
  - statusKey: StatusEffect

输出:
  - calculator: EffectCalculator | undefined

行为:
  返回关联的计算器实例
```

## 7. 测试策略

### 7.1 单元测试

#### StatusContainer测试

测试场景:
- 添加单个状态
- 添加可叠加状态并验证层数
- 添加互斥状态并验证冲突处理
- 抵抗判定正确性(高意志力目标)
- 状态刷新时长递减
- DOT伤害计算
- 过期状态自动清除

#### EffectCalculator测试

测试场景:
- AttributeModifierCalculator: 验证armor_up提升15%减伤
- DamageOverTimeCalculator: 验证burn伤害计算公式
- ActionBlockerCalculator: 验证stun禁止所有行动
- ResistanceCalculator: 验证抵抗率计算

### 7.2 集成测试

#### 战斗引擎集成

测试场景:
- 技能施放后正确应用状态
- 法宝特效触发状态
- 状态影响伤害计算(属性修正)
- 控制状态禁止行动
- DOT持续扣血
- 战斗结束后清除战斗状态

#### 副本系统集成

测试场景:
- 副本costs正确转化为状态
- 状态传递到战斗会话
- 战斗中状态生效
- 战斗后状态回写副本
- 多次战斗状态累积

### 7.3 边界测试

测试场景:
- 同时拥有10+种状态
- 叠加层数达到maxStack
- duration=0立即过期
- 永久状态(permanent)不被自动清除
- 条件状态在条件未满足时不消退

## 8. 迁移方案

### 8.1 阶段划分

#### 第一阶段:基础框架搭建

- 实现StatusContainer、StatusInstance数据结构
- 实现StatusRegistry
- 实现基础EffectCalculator(Attribute、DOT、ActionBlocker)

#### 第二阶段:战斗引擎改造

- BattleUnit集成statusContainer
- 替换现有状态逻辑为statusContainer调用
- 迁移属性修正计算
- 迁移DOT计算
- 迁移行动限制判定

#### 第三阶段:副本系统集成

- 实现副本costs到状态的转换
- 实现状态传递机制
- 实现战斗后状态回写

#### 第四阶段:扩展与优化

- 添加新状态类型(环境状态等)
- 实现状态协同规则
- 性能优化(缓存、批量操作)

### 8.2 兼容性处理

在迁移期间保持向后兼容:

- 保留battleEngine中现有的状态相关函数作为wrapper
- wrapper内部调用新的statusContainer接口
- 逐步迁移调用方到新接口
- 完全迁移后移除旧函数

### 8.3 数据迁移

现有战斗记录中的状态快照:

- TurnSnapshot中的statuses字段从StatusEffect[]改为StatusInstance[]
- 历史数据查询时做兼容转换
- 新记录直接使用新格式

## 9. 扩展方向

### 9.1 状态可视化

为前端提供状态查询接口,支持:
- 显示当前所有状态图标和剩余时间
- 鼠标悬停显示状态详情(来源、效果描述)
- 状态刷新时播放特效动画

### 9.2 状态历史记录

记录状态的添加、刷新、移除历史,用于:
- 战报生成
- 调试分析
- 玩家复盘

数据结构:

| 字段 | 类型 | 说明 |
|------|------|------|
| timestamp | number | 时间戳 |
| action | 'add'/'tick'/'remove' | 动作类型 |
| statusKey | StatusEffect | 状态键 |
| details | Record&lt;string, any&gt; | 详细信息 |

### 9.3 状态预测

在技能选择阶段预测施放后的状态变化,辅助AI决策:
- 若施放此技能,预期添加哪些状态
- 当前状态下,哪些技能被禁用
- 下一回合将有哪些状态过期

### 9.4 自定义状态

支持通过配置文件或AI生成动态定义新状态:
- 读取JSON格式的状态定义
- 运行时注册到StatusRegistry
- 支持副本、奇遇等特殊场景的临时状态

示例:副本中的"古修禁制"状态
- statusKey: 动态生成
- 效果: 法术威力降低30%,持续到离开副本
- 通过metadata传递配置参数

## 10. 风险与约束

### 10.1 性能风险

**风险**: 大量状态同时存在时,每回合刷新可能产生性能瓶颈

**缓解措施**:
- 限制单个单位同时存在的状态数量(如上限20个)
- 优化tickStatuses内部循环,避免重复计算
- 对长时间不触发效果的状态(如permanent类型)设置skipTick标记

### 10.2 兼容性风险

**风险**: 现有战斗记录和存档数据可能与新结构不兼容

**缓解措施**:
- 提供数据迁移脚本
- 在读取旧数据时做格式转换
- 保留旧字段作为fallback

### 10.3 复杂度风险

**风险**: 引入新系统增加代码复杂度,学习曲线陡峭

**缓解措施**:
- 提供详细文档和示例
- 封装常用操作为高级API
- 编写单元测试作为使用示例

### 10.4 扩展约束

**约束**: 状态效果必须能用纯函数计算,不能依赖外部可变状态

**影响**: 某些复杂效果(如"下次攻击必定暴击")需要通过metadata传递标记,由外部逻辑处理

**解决**: 定义标准化的metadata约定,确保计算器能正确解析

## 11. 关键决策记录

### 11.1 为何不使用ECS(实体组件系统)

**考虑**: ECS在游戏引擎中常用于管理状态

**决策**: 不采用ECS,而使用容器+计算器模式

**理由**:
- 项目规模较小,ECS的复杂度收益比不高
- 现有代码结构以对象为中心,迁移成本大
- 容器模式更符合团队技术栈(TypeScript OOP)

### 11.2 状态叠加策略

**考虑**: 同种状态可独立多次添加 vs. 合并为单个实例

**决策**: 采用可配置策略,部分状态可叠加(如中毒),部分不可(如眩晕)

**理由**:
- 灵活性更高,符合修仙世界观(多次中毒可叠加)
- 通过stackable和maxStack字段控制,易于扩展

### 11.3 时间管理方式

**考虑**: 纯回合制 vs. 支持实时计时

**决策**: 支持两种时间类型(turn和realtime)

**理由**:
- 战斗系统使用回合制,副本可能使用实时
- durationType字段统一抽象,计算器按需处理

### 11.4 状态持久化

**考虑**: 状态是否需要存入数据库

**决策**: 战斗状态不持久化,持久状态序列化后存入Redis/数据库

**理由**:
- 战斗状态生命周期短,无需持久化
- 持久状态需要跨会话保持,通过DungeonState等载体序列化
- 减少数据库写入压力

## 12. 参考文献与灵感来源

- Dota 2状态系统: 叠加规则、驱散机制
- World of Warcraft Buff/Debuff系统: 持续时间管理、优先级
- Path of Exile状态异常机制: 元素关联、DOT计算
- 《凡人修仙传》小说: 法宝诅咒、禁制压制等概念
- 现有项目battleEngine.ts: DOT计算公式、抗性机制

---

**设计版本**: v1.0  
**设计时间**: 2025-12-24  
**设计目标**: 构建通用、可扩展的角色临时状态引擎,支持战斗、副本等多场景应用
