# 角色状态、丹药、炼丹系统重构设计稿

## 1. 文档状态

- 状态：定稿
- 日期：2026-05-15
- 适用范围：`角色当前状态`、`PVE 战斗持久化`、`丹药系统`、`炼丹系统`
- 目标：作为后续分阶段实现的唯一设计依据

## 2. 已确认决策

### 2.1 战斗持久化策略

- 采用方案 B。
- `PVE / 副本 / 探索 / 非标准战斗` 使用角色当前状态入场，并在战斗后回写状态。
- `排行榜挑战 / 赌战 / 训练场` 使用标准化战斗，不读取也不回写角色当前状态。

### 2.2 丹药系统方向

- 丹药效果统一改为“状态操作列表”。
- 不保留旧 `effect / effects / useSpec / category 推断` 兼容层。
- 不允许新旧逻辑共存。
- 永久加属性丹全部废弃，统一改为“炼体 / 洗髓进度”。

### 2.3 炼丹系统方向

- 炼丹分为两条线：
- `即兴炼丹`：玩家输入意图，结合材料药性即时出丹。
- `丹方炼制`：玩家使用已掌握丹方，按模式稳定出丹。
- 即兴炼丹可以悟出丹方，丹方炼制可以稳定量产。

### 2.4 角色状态字段方向

- 角色当前状态不再拆成 `persistent_state` 和 `persistent_statuses`。
- 新设计统一合并为单字段：`condition`。
- 但只合并存储，不混淆语义。
- `condition` 内部仍分层组织：`resources / gauges / tracks / counters / statuses / timestamps`。

## 3. 设计目标

### 3.1 核心目标

- 让角色不再每次进入战斗都满状态。
- 让战斗结果真实影响后续游玩节奏。
- 让丹药从“永久加点道具”转为“状态管理系统”。
- 让炼丹结果真正受材料药性和炼丹意图影响。
- 让系统结构足够清晰，便于以后继续扩展伤势、毒性、护脉、心境、特殊药力等机制。

### 3.2 非目标

- 本次设计不重做 `cultivation_progress` 的完整体系。
- 本次设计不把排行榜 PVP 改成生死斗。
- 本次设计不要求第一阶段就上线大量新丹方内容。
- 本次设计不要求第一阶段就实现 AI 直接决定数值。

## 4. 总体架构

系统拆分为 4 层：

1. `角色基础面板`
2. `角色当前状态`
3. `状态模板与操作系统`
4. `战斗 / 丹药 / 炼丹 / 突破` 等玩法结算器

对应边界如下：

- `角色基础面板`：境界、基础属性、灵根、装备、功法、技能、寿元、修为进度。
- `角色当前状态`：当前 HP、当前 MP、丹毒、炼体进度、洗髓进度、长期状态、时间戳、次数计数。
- `状态模板系统`：定义某个状态如何影响战斗、恢复、突破、展示。
- `玩法结算器`：只负责触发操作，不直接写散乱字段。

## 5. 核心术语

- `condition`：角色当前状态总字段。
- `resource`：当前资源值，例如 HP、MP。
- `gauge`：可累积的连续量，例如丹毒。
- `track`：长期成长进度，例如炼体、洗髓。
- `counter`：玩法计数，例如本境长期丹药已服次数。
- `status`：有明确语义、不可直接由其他值推导的持久状态。
- `operation`：丹药或事件对 `condition` 施加的原子操作。

## 6. 角色当前状态模型

### 6.1 顶层结构

```ts
export interface CultivatorCondition {
  version: 1;
  resources: {
    hp: ConditionResourcePoint;
    mp: ConditionResourcePoint;
  };
  gauges: {
    pillToxicity: number;
  };
  tracks: {
    tempering: Record<TemperingTrackKey, ConditionProgressTrack>;
    marrowWash: ConditionProgressTrack;
  };
  counters: {
    longTermPillUsesByRealm: Partial<Record<RealmType, number>>;
  };
  statuses: ConditionStatusInstance[];
  timestamps: {
    lastRecoveryAt?: string;
    lastBattleAt?: string;
    lastPillAt?: string;
    lastBreakthroughAt?: string;
  };
  metrics?: {
    totalRecoveredHp?: number;
    totalRecoveredMp?: number;
  };
}

export interface ConditionResourcePoint {
  current: number;
}

export interface ConditionProgressTrack {
  level: number;
  progress: number;
}

export type TemperingTrackKey =
  | 'vitality'
  | 'spirit'
  | 'wisdom'
  | 'speed'
  | 'willpower';
```

### 6.2 存储原则

以下数据必须持久化：

- `resources.hp.current`
- `resources.mp.current`
- `gauges.pillToxicity`
- `tracks.*`
- `counters.longTermPillUsesByRealm`
- `statuses`
- `timestamps`

以下数据不得持久化，只能运行时派生：

- `hp_deficit`
- `mana_depleted`
- “丹毒轻染 / 丹毒郁结 / 毒火攻心”这类丹毒展示标签
- 当前 HP/MP 百分比
- 由状态和资源共同推导出的前端提示文案

### 6.3 初始默认值

角色创建时：

```ts
condition = {
  version: 1,
  resources: {
    hp: { current: maxHp },
    mp: { current: maxMp }
  },
  gauges: {
    pillToxicity: 0
  },
  tracks: {
    tempering: {
      vitality: { level: 0, progress: 0 },
      spirit: { level: 0, progress: 0 },
      wisdom: { level: 0, progress: 0 },
      speed: { level: 0, progress: 0 },
      willpower: { level: 0, progress: 0 }
    },
    marrowWash: { level: 0, progress: 0 }
  },
  counters: {
    longTermPillUsesByRealm: {}
  },
  statuses: [],
  timestamps: {
    lastRecoveryAt: now
  },
  metrics: {
    totalRecoveredHp: 0,
    totalRecoveredMp: 0
  }
}
```

## 7. 状态实例模型

### 7.1 状态实例结构

```ts
export interface ConditionStatusInstance {
  key: ConditionStatusKey;
  stacks: number;
  source: 'battle' | 'pill' | 'event' | 'system';
  duration: ConditionStatusDuration;
  usesRemaining?: number;
  payload?: Record<string, number | string | boolean>;
  createdAt: string;
  updatedAt: string;
}

export type ConditionStatusDuration =
  | { kind: 'until_removed' }
  | { kind: 'time'; expiresAt: string };
```

### 7.2 第一版状态键

第一版必须支持以下状态：

- `weakness`
- `minor_wound`
- `major_wound`
- `near_death`
- `breakthrough_focus`
- `protect_meridians`
- `clear_mind`

第一版可以预留但不强制首发：

- `medicinal_resonance`
- `detox_guard`
- `body_heat_overflow`
- `impure_elixir_burden`

### 7.3 状态模板注册表

新增统一注册表：`ConditionStatusRegistry`

```ts
export interface ConditionStatusTemplate {
  key: ConditionStatusKey;
  name: string;
  description: string;
  display: {
    icon: string;
    shortDesc: string;
  };
  hooks: {
    onBattleInit?: ConditionBattleInitHook;
    onNaturalRecovery?: ConditionRecoveryHook;
    onBreakthrough?: ConditionBreakthroughHook;
    onDisplay?: ConditionDisplayHook;
  };
}
```

设计要求：

- 不再使用只会 `toBattleInit` 的旧注册表模型。
- 状态模板必须能参与多个生命周期。
- 状态模板只描述状态本身，不描述某个具体丹药。

## 8. `condition` 与其他系统的边界

### 8.1 与基础属性的边界

- `attributes` 仍然保存永久属性。
- `condition.tracks` 只保存永久属性成长的进度，不直接替代永久属性。
- 当某个进度 track 升级时，再结算到 `attributes` 或 `spiritual_roots`。

### 8.2 与 `cultivation_progress` 的边界

以下内容继续留在 `cultivation_progress`：

- `cultivation_exp`
- `exp_cap`
- `comprehension_insight`
- `breakthrough_failures`
- `bottleneck_state`
- `inner_demon`
- `deviation_risk`

以下内容统一迁入 `condition`：

- 当前 HP
- 当前 MP
- 丹毒
- 破境辅助状态
- 炼体 / 洗髓进度
- 长期伤势与虚弱

原则：

- 修炼进度属于“修为系统”。
- 身体与战斗余波属于“当前状态系统”。

## 9. 战斗模式设计

### 9.1 战斗模式枚举

```ts
export type BattleMode =
  | 'persistent_pve'
  | 'standard_pvp'
  | 'training';
```

### 9.2 各模式规则

#### `persistent_pve`

- 战前先执行自然恢复结算。
- 使用 `condition.resources` 和 `condition.statuses` 构造战斗初始状态。
- 战后根据战斗结果回写 `condition`。

适用场景：

- 副本
- 野外探索
- 主线 / 奇遇战斗
- 非标准 PVE

#### `standard_pvp`

- 不读取当前 `condition.resources`。
- 不读取持久伤势状态。
- 角色以标准化满状态入场。
- 战后不回写 `condition`。

适用场景：

- 排行榜挑战
- 赌战

#### `training`

- 默认标准化入场。
- 默认不回写 `condition`。
- 用于测试与训练类玩法。

### 9.3 战斗前流程

`persistent_pve` 的固定流程：

1. 读取角色和 `condition`
2. 执行 `tickNaturalRecovery`
3. 由 `ConditionStatusRegistry` 处理状态对战斗的入场修正
4. 构造 `BattleInitConfig`
5. 进入战斗

### 9.4 战斗后结算规则

#### PVE 失败

- `hp.current = 1`
- `mp.current = 0`
- 伤势状态至少提升到 `near_death`
- 清除低级伤势，保留更高级伤势语义
- 更新时间戳

#### PVE 胜利

- `hp.current`、`mp.current` 取战斗终局快照
- 按最终 `hp / maxHp` 补充伤势判断：
- `<= 15%`：至少为 `major_wound`
- `<= 35%`：至少为 `minor_wound`
- `> 35%`：不新增伤势

规则说明：

- 伤势是长期后果，不是纯展示。
- 只剩一丝血获胜，也应对后续流程产生影响。

#### 标准化 PVP

- 不回写当前状态。
- 只保存战报和排名等玩法结果。

## 10. 自然恢复规则

### 10.1 恢复对象

- 只恢复 `resources.hp.current`
- 只恢复 `resources.mp.current`
- 不自动降低丹毒
- 不自动移除伤势状态

### 10.2 恢复公式

恢复率由以下因素共同决定：

- 基础每小时恢复率
- 丹毒惩罚
- 伤势惩罚

建议保留当前思路，但迁移到 `ConditionService`：

- HP 每小时基础恢复：`maxHp * hpPerHour`
- MP 每小时基础恢复：`maxMp * mpPerHour`
- 丹毒越高，恢复倍率越低
- `minor_wound / major_wound / near_death` 再额外降低恢复倍率

### 10.3 丹毒展示分段

丹毒分段不持久化，只用于展示和规则映射：

- `0 - 199`：无明显丹毒
- `200 - 399`：丹毒轻染
- `400 - 699`：丹毒郁结
- `700 - 1000`：毒火攻心

第一版直接影响：

- 自然恢复倍率
- 突破成功率惩罚

第一版暂不强制直接影响标准 PVP。

## 11. 丹药系统模型

### 11.1 清理原则

以下旧设计全部移除：

- `consumables.effects`
- `ConsumableRegistry` 的名字猜分类逻辑
- `category + quotaKind + useSpec + mechanicKey` 这套过渡结构
- 基于旧丹药名的临时推断与兼容

### 11.2 新的消耗品结构

消耗品改为单 `spec` 字段的判别联合。

```ts
export interface Consumable {
  id?: string;
  name: string;
  type: '丹药' | '符箓';
  quality?: Quality;
  quantity: number;
  description?: string;
  score?: number;
  spec: PillSpec | TalismanSpec;
}
```

### 11.3 丹药结构

```ts
export interface PillSpec {
  kind: 'pill';
  family: PillFamily;
  operations: ConditionOperation[];
  consumeRules: PillConsumeRules;
  alchemyMeta: PillAlchemyMeta;
}

export type PillFamily =
  | 'healing'
  | 'mana'
  | 'detox'
  | 'breakthrough'
  | 'tempering'
  | 'marrow_wash'
  | 'hybrid';

export interface PillConsumeRules {
  scene: 'out_of_battle_only';
  countsTowardLongTermQuota: boolean;
}

export interface PillAlchemyMeta {
  source: 'improvised' | 'formula';
  formulaId?: string;
  sourceMaterials: string[];
  dominantElement?: ElementType;
  stability: number;
  toxicityRating: number;
  tags: string[];
}
```

### 11.4 符箓结构

```ts
export interface TalismanSpec {
  kind: 'talisman';
  scenario: string;
  sessionMode: 'lock_on_enter_settle_on_exit' | 'consume_on_action';
  notes?: string;
}
```

说明：

- 符箓不并入丹药操作系统。
- 符箓保留独立玩法入口校验。
- 本设计稿重点约束丹药，不重做符箓功能。

## 12. 丹药操作模型

### 12.1 原子操作定义

```ts
export type ConditionOperation =
  | RestoreResourceOperation
  | ChangeGaugeOperation
  | AddStatusOperation
  | RemoveStatusOperation
  | AdvanceTrackOperation;
```

#### 恢复资源

```ts
export interface RestoreResourceOperation {
  type: 'restore_resource';
  resource: 'hp' | 'mp';
  mode: 'flat' | 'percent';
  value: number;
}
```

#### 改变量表

```ts
export interface ChangeGaugeOperation {
  type: 'change_gauge';
  gauge: 'pillToxicity';
  delta: number;
}
```

#### 添加状态

```ts
export interface AddStatusOperation {
  type: 'add_status';
  status: ConditionStatusKey;
  stacks?: number;
  duration?: ConditionStatusDuration;
  usesRemaining?: number;
  payload?: Record<string, number | string | boolean>;
}
```

#### 移除状态

```ts
export interface RemoveStatusOperation {
  type: 'remove_status';
  status: ConditionStatusKey;
  removeAll?: boolean;
}
```

#### 推进进度

```ts
export interface AdvanceTrackOperation {
  type: 'advance_track';
  track:
    | 'tempering.vitality'
    | 'tempering.spirit'
    | 'tempering.wisdom'
    | 'tempering.speed'
    | 'tempering.willpower'
    | 'marrow_wash';
  value: number;
}
```

### 12.2 操作执行顺序

同一丹药的操作固定按以下顺序执行：

1. `restore_resource`
2. `change_gauge`
3. `remove_status`
4. `add_status`
5. `advance_track`

原因：

- 先恢复资源，再处理毒性和伤势，语义更稳定。
- 先移除旧状态，再添加新状态，避免伤势升级 / 降级冲突。
- 最后推进长期成长，避免中途状态影响判定。

### 12.3 第一版丹药能力边界

第一版允许的能力：

- 回血
- 回蓝
- 降丹毒
- 增丹毒
- 添加破境辅助状态
- 添加护脉 / 清心类状态
- 缓解伤势
- 推进炼体进度
- 推进洗髓进度

第一版不允许的能力：

- 直接永久加属性
- 直接永久加灵根强度
- 战斗中即时使用
- 绕过长期丹药服用配额

## 13. 长期丹药配额

### 13.1 配额保留

- 保留“每境界长期丹药使用次数限制”。
- 计数位置改为：`condition.counters.longTermPillUsesByRealm`。

### 13.2 计数对象

以下丹药计入长期配额：

- `breakthrough`
- `tempering`
- `marrow_wash`
- 高阶 `hybrid` 中包含 `advance_track` 或长期状态增益的丹药

以下丹药不计入长期配额：

- `healing`
- `mana`
- `detox`
- 不含长期成长与破境辅助的短效丹药

## 14. 炼体与洗髓进度系统

### 14.1 炼体轨道

第一版固定 5 条炼体轨道：

- `tempering.vitality`
- `tempering.spirit`
- `tempering.wisdom`
- `tempering.speed`
- `tempering.willpower`

### 14.2 洗髓轨道

- `marrow_wash`

### 14.3 轨道升级规则

轨道升级由 `TrackConfigRegistry` 配置，不把数值写死在流程里。

```ts
export interface TrackConfig {
  key: string;
  thresholdByLevel: (level: number) => number;
  reward: TrackReward;
}
```

第一版奖励语义：

- `tempering.vitality` 升级：永久增加 `attributes.vitality`
- `tempering.spirit` 升级：永久增加 `attributes.spirit`
- `tempering.wisdom` 升级：永久增加 `attributes.wisdom`
- `tempering.speed` 升级：永久增加 `attributes.speed`
- `tempering.willpower` 升级：永久增加 `attributes.willpower`
- `marrow_wash` 升级：永久强化灵根强度，规则由 `MarrowWashRewardConfig` 控制

### 14.4 设计原则

- 丹药不再“吃下去立刻 +1 属性”。
- 丹药只负责推进修炼身体的长期进度。
- 真正的永久收益由进度跨阈值时结算。

## 15. 突破系统与丹药状态的交互

### 15.1 突破辅助不再使用扁平字段

删除旧思路：

- `pendingBreakthroughBonus`

改为状态化：

- `breakthrough_focus`
- `protect_meridians`
- `clear_mind`

### 15.2 突破时读取规则

突破流程读取 `condition.statuses`：

- `breakthrough_focus`：提高突破成功率
- `protect_meridians`：降低失败惩罚或降低走火入魔风险
- `clear_mind`：提升感悟利用率或降低心魔干扰

### 15.3 突破后消费规则

以下状态在一次突破尝试后消费：

- `breakthrough_focus`
- `protect_meridians`
- `clear_mind`

消费方式：

- 优先使用 `usesRemaining`
- 用完后移除状态

## 16. 炼丹系统总设计

### 16.1 总原则

- 炼丹结果不能只靠 prompt 正则分类。
- 材料必须真正参与药效生成。
- AI 只负责意图解析、命名、文案辅助，不直接决定数值。
- 数值由规则系统解算。

### 16.2 材料药性画像

每个材料新增 `alchemyProfile`，建议存于 `material.details.alchemyProfile`。

```ts
export interface MaterialAlchemyProfile {
  effectTags: Array<
    | 'healing'
    | 'mana'
    | 'detox'
    | 'breakthrough'
    | 'tempering_vitality'
    | 'tempering_spirit'
    | 'tempering_wisdom'
    | 'tempering_speed'
    | 'tempering_willpower'
    | 'marrow_wash'
  >;
  elementBias?: ElementType;
  potency: number;
  toxicity: number;
  stability: number;
}
```

### 16.3 即兴炼丹流程

输入：

- 玩家选择材料
- 玩家输入炼丹意图

流程：

1. 解析玩家意图，抽取目标标签
2. 聚合材料 `alchemyProfile`
3. 选择主药效方向
4. 生成 `operations`
5. 计算稳定度与毒性
6. 根据稳定度决定是否出现副效或衰减
7. 生成丹药名称、描述、评分
8. 判断是否满足“悟出丹方”条件

### 16.4 即兴炼丹的输出约束

即兴炼丹至少产出：

- `family`
- `operations`
- `consumeRules`
- `alchemyMeta`
- `score`
- `description`

### 16.5 丹方炼制流程

输入：

- 已掌握丹方
- 符合丹方要求的材料

流程：

1. 校验材料是否满足丹方模式
2. 按丹方蓝图生成基础 `operations`
3. 按材料拟合度修正强度、稳定度、毒性
4. 按丹方熟练度修正成功质量
5. 产出丹药

### 16.6 即兴炼丹与丹方关系

- 即兴炼丹负责探索。
- 丹方炼制负责稳定量产。
- 即兴炼丹产物若满足稳定度与独特性要求，可以生成新丹方。

## 17. 丹方系统设计

### 17.1 丹方不是精确材料清单

丹方不应强绑定具体材料 ID。

丹方描述的是“材料模式”：

- 需要的标签
- 需要的主次结构
- 最低品质要求
- 五行偏性要求

### 17.2 丹方模型

```ts
export interface AlchemyFormula {
  id: string;
  cultivatorId: string;
  name: string;
  family: PillFamily;
  pattern: {
    requiredTags: string[];
    optionalTags?: string[];
    dominantElement?: ElementType;
    minQuality?: Quality;
    slotCount: number;
  };
  blueprint: {
    operations: ConditionOperation[];
    consumeRules: PillConsumeRules;
    targetStability: number;
    targetToxicity: number;
  };
  mastery: {
    level: number;
    exp: number;
  };
  createdAt: string;
  updatedAt: string;
}
```

### 17.3 丹方悟出条件

第一版建议条件：

- 即兴炼丹 `stability >= discoverThreshold`
- 产物 `operations signature` 具备足够独特性
- 不与已有丹方重复

## 18. 服务层重构建议

### 18.1 新服务

- `ConditionService`
- `ConditionStatusRegistry`
- `PillOperationExecutor`
- `AlchemyIntentResolver`
- `AlchemyFormulaService`

### 18.2 替换关系

- `PersistentStateService` -> `ConditionService`
- `CombatStatusTemplateRegistry` -> `ConditionStatusRegistry`
- 旧 `ConsumableRegistry` 删除，不保留
- `ConsumableUseEngine` 改为直接解释 `consumable.spec`
- `alchemyServiceV2` 重写，不再靠 prompt 正则直接决定整颗丹的固定模板

## 19. 数据库改造建议

### 19.1 角色表

`cultivators`：

- 新增 `condition jsonb not null default '{}'`
- 删除 `persistent_state`
- 删除 `persistent_statuses`

### 19.2 消耗品表

`consumables`：

- 保留：`id / cultivatorId / name / type / quality / quantity / description / score / createdAt`
- 新增：`spec jsonb not null`
- 删除：`effects`
- 删除：`category`
- 删除：`quotaKind`
- 删除：`useSpec`
- 删除：`mechanicKey`
- `prompt` 可保留为炼丹产物描述来源，也可并入 `spec.alchemyMeta`

### 19.3 丹方表

新增 `alchemy_formulas`：

- `id`
- `cultivator_id`
- `name`
- `family`
- `pattern jsonb`
- `blueprint jsonb`
- `mastery jsonb`
- `created_at`
- `updated_at`

## 20. 旧数据处理策略

本次重构不保留旧逻辑兼容层，因此需要一次性迁移。

### 20.1 运行时原则

- 新版本上线后，运行时代码不再识别旧 `effects / useSpec / category`。
- 所有活跃数据必须在迁移阶段转成新结构，或被清理。

### 20.2 建议处理方式

#### 角色状态

- 将 `persistent_state` 与 `persistent_statuses` 合并为 `condition`
- `pendingBreakthroughBonus` 转为 `breakthrough_focus` 状态
- `hp_deficit / mana_depleted` 不迁移，直接丢弃

#### 旧丹药

推荐方案：

- 不根据丹药名字做运行时兼容推断
- 迁移前备份数据库
- 对现有 `type = 丹药` 记录执行一次性离线处理：
- 若项目允许清档，直接删除旧丹药
- 若项目需要补偿，按品质返还材料或灵石

#### 旧符箓

- 旧符箓可迁移到 `spec.kind = talisman`
- 这部分语义比较稳定，可以做一次性数据脚本转换

## 21. 分阶段实施顺序

### Phase 1：状态模型落地

- 新增 `condition` 字段
- 新建 `ConditionService`
- 新建 `ConditionStatusRegistry`
- 删除旧 `persistent_state / persistent_statuses` 读写链路
- 前端角色页改读 `condition`

完成标准：

- 角色加载、展示、保存都只使用 `condition`

### Phase 2：PVE 战斗接入

- 接通 `persistent_pve` 战斗模式
- PVE 战斗前读取 `condition`
- PVE 战斗后回写 `condition`
- 排行榜挑战、赌战显式标记为 `standard_pvp`

完成标准：

- PVE 战后 HP/MP 与伤势可持续保存
- 排行榜和赌战仍保持满状态公平性

### Phase 3：丹药系统重做

- `consumables` 改用 `spec`
- 删除旧 `ConsumableRegistry`
- 新增 `PillOperationExecutor`
- 新增长期丹药配额结算
- 新增突破辅助状态消费逻辑

完成标准：

- 所有新丹药通过 `operations` 执行
- 运行时代码不再识别旧丹药结构

### Phase 4：炼体 / 洗髓轨道

- 新增 `tracks`
- 新增 `TrackConfigRegistry`
- 将原永久属性丹替换为炼体 / 洗髓推进丹

完成标准：

- 再无“直接永久加属性丹”
- 永久收益只通过进度升级产生

### Phase 5：即兴炼丹重做

- 为材料补 `alchemyProfile`
- 重写即兴炼丹逻辑
- 产出真实 `operations`

完成标准：

- 炼丹结果不再只是 prompt 正则分类
- 材料药性对结果有实质影响

### Phase 6：丹方系统上线

- 新增丹方表
- 新增丹方炼制流程
- 支持即兴炼丹悟出丹方

完成标准：

- 即兴炼丹与丹方炼制形成闭环

## 22. 验收标准

满足以下条件时，视为本设计实现完成：

- 角色存在唯一 `condition` 字段，不再维护 `persistent_state` 和 `persistent_statuses`
- PVE 战斗会消耗并回写当前 HP/MP 与伤势
- 排行榜挑战和赌战不受当前伤势影响
- 丹药执行模型统一为 `operations`
- 运行时代码不再保留旧丹药兼容逻辑
- 永久加属性丹被完全替换为炼体 / 洗髓进度丹
- 即兴炼丹能根据材料药性产出不同操作组合
- 丹方炼制可稳定复现丹药蓝图

## 23. 实施备注

- 这份设计稿优先保证“结构可持续”，不在文档内写死所有数值。
- 所有具体倍率、阈值、成长量都应进入配置层，而不是散落在服务逻辑里。
- 若实现时发现某个机制需要临时补充字段，应先判断是否可以并入 `condition` 或 `spec`，避免再次走回“多个近义字段并存”的旧路。
