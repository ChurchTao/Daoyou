# V5 战斗引擎设计文档

**日期**: 2026-03-17
**作者**: Claude
**状态**: 设计阶段

---

## 一、概述

### 1.1 目标

基于 `docs/battle-b5.md` 的设计理念，构建全新的 V5 战斗引擎，采用**事件驱动架构（EDA）+ GAS 思想**，解决现有战斗引擎的时序控制、状态管理、扩展性问题。

### 1.2 核心设计理念

1. **事件驱动架构（EDA）**：所有战斗动作通过事件传递，模块通过订阅-发布模式交互
2. **GAS 思想借鉴**：
   - AttributeSet（属性修改器系统）
   - Ability（能力系统：技能/命格）
   - Effect（效果系统）
3. **状态机控制时序**：严格的回合阶段控制
4. **原型模式**：镜像 PVP 通过克隆生成

### 1.3 实现策略

- **并行开发**：在 `engine/battle-v5/` 新目录下开发，与现有引擎并存
- **完全独立**：独立的 Effect/Buff/Attribute 系统，不依赖现有引擎模块
- **适配器对接**：通过 `CultivatorAdapter` 与现有 `Cultivator` 数据模型对接
- **核心框架优先**：EDA + 状态机 + GAS 框架完整实现，技能/命格可扩展
- **TDD 独立测试**：完整的独立测试套件

---

## 二、架构设计

### 2.1 架构图

```
┌─────────────────────────────────────────────────────────┐
│                    CombatStateMachine                    │
│              (战斗状态机 - 时序控制核心)                  │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│                      EventBus                           │
│           (事件总线 - 优先级队列 + 订阅发布)              │
└─────┬─────────┬─────────┬─────────┬─────────┬─────────┘
      │         │         │         │         │
      ▼         ▼         ▼         ▼         ▼
  Unit    AbilitySystem  BuffSystem  DamageSystem  LogSystem
```

### 2.2 核心模块

| 模块 | 职责 | 文件 |
|------|------|------|
| **EventBus** | 事件订阅-发布，优先级队列 | `core/EventBus.ts` |
| **CombatStateMachine** | 7个战斗阶段的状态转换 | `core/CombatStateMachine.ts` |
| **Unit** | 战斗单元，原型克隆 | `units/Unit.ts` |
| **AttributeSet** | 5维属性 + 修改器叠加 | `units/AttributeSet.ts` |
| **Ability** | 能力系统（技能/命格） | `abilities/Ability.ts` |
| **Buff** | BUFF 系统 | `buffs/Buff.ts` |
| **CombatLogSystem** | 战报生成 | `systems/CombatLogSystem.ts` |
| **DamageSystem** | 伤害计算 | `systems/DamageSystem.ts` |
| **CultivatorAdapter** | 数据适配器 | `adapters/CultivatorAdapter.ts` |

---

## 三、文件结构

```
engine/battle-v5/
├── core/
│   ├── EventBus.ts              # 事件总线（单例 + 优先级队列）
│   ├── CombatStateMachine.ts    # 战斗状态机（7个状态）
│   └── types.ts                 # 核心类型定义
├── data/
│   ├── configs/                 # 技能/命格/BUFF 配置（JSON）
│   └── DataLoader.ts            # 配置加载器
├── units/
│   ├── Unit.ts                  # 战斗单元（原型模式）
│   ├── AttributeSet.ts          # 属性集（GAS 修改器）
│   ├── AbilityContainer.ts      # 能力容器
│   └── BuffContainer.ts         # BUFF 容器
├── abilities/
│   ├── Ability.ts               # 能力基类
│   ├── ActiveSkill.ts           # 主动技能基类
│   ├── PassiveAbility.ts        # 被动能力基类
│   └── examples/
│       └── FireballSkill.ts     # 示例：火球术
├── buffs/
│   ├── Buff.ts                  # BUFF 基类
│   └── examples/
│       └── StrengthBuff.ts      # 示例：力量BUFF
├── systems/
│   ├── CombatLogSystem.ts       # 战报系统
│   ├── DamageSystem.ts          # 伤害计算系统
│   └── VictorySystem.ts         # 胜负判定系统
├── adapters/
│   └── CultivatorAdapter.ts     # 适配器（Cultivator → Unit）
├── tests/                       # 独立测试套件
│   ├── core/
│   ├── units/
│   └── integration/
└── index.ts                     # 战斗系统入口
```

---

## 四、核心类型定义

### 4.1 战斗阶段枚举

```typescript
export enum CombatPhase {
  INIT = 'init',                      // 初始化
  DESTINY_AWAKEN = 'destiny_awaken',  // 开局命格觉醒（仅第1回合）
  ROUND_PRE = 'round_pre',            // 回合前置结算
  TURN_ORDER = 'turn_order',          // 出手顺序判定
  ACTION = 'action',                  // 出手行动
  ROUND_POST = 'round_post',          // 回合后置结算
  VICTORY_CHECK = 'victory_check',    // 胜负判定
  END = 'end',                        // 战斗结束
}
```

### 4.2 5维属性类型

```typescript
export enum AttributeType {
  SPIRIT = 'spirit',              // 灵力 - 法系输出核心
  PHYSIQUE = 'physique',          // 体魄 - 生存与体修输出核心
  AGILITY = 'agility',            // 身法 - 先手与暴击核心
  CONSCIOUSNESS = 'consciousness', // 神识 - 控制与反制核心
  COMPREHENSION = 'comprehension', // 悟性 - 策略与上限核心
}
```

**注意**：V5 引擎使用统一的属性命名，与现有 `Cultivator` 属性的映射关系见第 6.1 节。

### 4.3 属性修改器类型

V5 引擎采用 **4 阶段属性修正**（与现有 Effect 系统一致）：

```typescript
export enum ModifierType {
  BASE = 'base',           // 基础值阶段
  FIXED = 'fixed',         // 固定值加成
  ADD = 'add',             // 加法叠加（百分比）
  MULTIPLY = 'multiply',   // 乘法叠加
  FINAL = 'final',         // 最终修正
  OVERRIDE = 'override',   // 覆盖（特殊用途）
}

export interface AttributeModifier {
  readonly id: string;
  readonly attrType: AttributeType;
  readonly type: ModifierType;
  readonly value: number;
  readonly source: object;
}
```

**4 阶段叠加顺序**：
1. **BASE**：基础属性值（来自 Cultivator）
2. **FIXED**：固定值加成（如装备、境界）
3. **ADD**：百分比加成（如 BUFF、技能）
4. **MULTIPLY**：乘法叠加（如特殊效果）
5. **FINAL**：最终修正（如封印、限制）
6. **OVERRIDE**：直接覆盖（特殊用途）

---

## 五、关键设计

### 5.1 事件总线（EventBus）

**核心功能：**
1. 单例模式，全局唯一
2. 订阅-发布模式
3. 优先级队列（高优先级先处理）
4. 事件历史记录（用于调试）

**使用示例：**
```typescript
// 订阅事件
EventBus.instance.subscribe('DamageEvent', handler, 50);

// 发布事件
EventBus.instance.publish({
  type: 'DamageEvent',
  priority: 50,
  timestamp: Date.now(),
  data: { damage: 100 },
});
```

### 5.2 战斗状态机（CombatStateMachine）

**7个状态：**

| 状态 | 描述 | 触发事件 |
|------|------|----------|
| INIT | 战斗初始化 | BattleInitEvent |
| DESTINY_AWAKEN | 命格觉醒（仅第1回合） | DestinyAwakenEvent |
| ROUND_PRE | 回合前置结算 | RoundPreEvent |
| TURN_ORDER | 出手顺序判定 | TurnOrderEvent |
| ACTION | 出手行动 | ActionEvent |
| ROUND_POST | 回合后置结算 | RoundPostEvent |
| VICTORY_CHECK | 胜负判定 | VictoryCheckEvent |
| END | 战斗结束 | BattleEndEvent |

**状态转换规则：**
- 第1回合：INIT → DESTINY_AWAKEN → ROUND_PRE → ... → VICTORY_CHECK → ROUND_PRE
- 第2回合起：VICTORY_CHECK → ROUND_PRE（跳过命格觉醒）
- 战斗结束：VICTORY_CHECK → END

### 5.3 属性集（AttributeSet）

**修改器叠加顺序：**
按 **BASE → FIXED → ADD → MULTIPLY → FINAL → OVERRIDE** 顺序计算

**派生属性计算（基础公式）：**
- **最大HP**：`100 + 体魄 * 10 + 灵力 * 2`
- **最大MP**：`100 + 灵力 * 5 + 悟性 * 3`
- **暴击率**：`5% + 身法 * 0.1% + 悟性 * 0.05%`（上限60%）
- **闪避率**：`身法 * 0.05%`（上限30%）

**注意**：上述为基础公式，实际计算时会考虑：
- 境界系数（参考 `types/constants.ts` 中的 `REALM_STAGE_CAPS`）
- 装备加成
- 功法效果
- 特殊状态修正

与现有系统保持一致的数值平衡策略。

### 5.4 战斗单元（Unit）

**核心功能：**
1. 管理属性、技能、BUFF
2. 原型克隆生成 PVP 镜像
3. 战斗操作方法（伤害、治疗、MP消耗）
4. 快照生成（用于战报）

### 5.5 能力系统（Ability）

**能力类型：**
- **ActiveSkill**：主动技能（有MP消耗、冷却时间）
- **PassiveAbility**：被动技能/命格（事件触发）

**生命周期：**
1. `onActivate()`：订阅事件
2. `canTrigger()`：检查触发条件
3. `execute()`：执行效果
4. `onDeactivate()`：取消订阅

### 5.6 BUFF 系统

**BUFF 生命周期（与现有 Buff 系统的 TickMoment 对应）：**

| V5 钩子 | 对应 TickMoment | 触发时机 |
|---------|----------------|----------|
| `onBattleStart()` | BATTLE_START | 战斗开始 |
| `onBattleEnd()` | BATTLE_END | 战斗结束 |
| `onTurnStart()` | TURN_START | 回合开始 |
| `onTurnEnd()` | TURN_END | 回合结束 |
| `onBeforeAct()` | BEFORE_ACT | 行动前 |
| `onAfterAct()` | AFTER_ACT | 行动后 |
| `onRoundPre()` | - | 回合前置结算 |
| `onRoundPost()` | - | 回合后置结算 |
| `onHit()` | ON_HIT | 命中目标 |
| `onBeingHit()` | ON_BEING_HIT | 被命中 |
| `onApply()` | - | BUFF 应用时 |
| `onRemove()` | - | BUFF 移除时 |

**持续时间管理：**
- 每回合递减
- 过期自动移除
- 同名BUFF刷新持续时间
- 支持永久BUFF（持续时间为 -1）

### 5.7 伤害系统

**伤害计算流程：**

```
基础伤害 → 暴击判定 → 闪避判定 → 伤害减免 → 元素克制 → 最终伤害
```

**详细步骤：**

1. **基础伤害计算**：根据技能/攻击类型计算基础伤害值
2. **暴击判定**：基于暴击率判定是否暴击，暴击伤害 × 1.5
3. **闪避判定**：基于闪避率判定是否闪避，闪避则伤害为 0
4. **伤害减免**：基于体魄、减伤BUFF计算最终减免比例
5. **元素克制**：应用元素克制关系（参考 `ELEMENT_WEAKNESS`）
6. **最终伤害**：`Math.max(1, floor(基础伤害 × 暴击 × (1 - 减伤) × 元素系数))`

**伤害事件结构：**
```typescript
interface DamageEvent {
  type: 'DamageEvent';
  priority: number;
  timestamp: number;
  data: {
    attackerId: UnitId;
    targetId: UnitId;
    baseDamage: number;
    finalDamage: number;
    isCritical: boolean;
    isDodged: boolean;
    damageType: 'physical' | 'magic';
    element?: ElementType;
    breakdown: {
      critMultiplier: number;
      damageReduction: number;
      elementBonus: number;
    };
  };
}
```

### 5.8 战报系统

**两种模式：**
- **极简模式**：只显示高光时刻（命格觉醒、大招、暴击）
- **详细模式**：显示所有战斗细节

**高光时刻标记：**
- 命格觉醒
- 终极技能释放
- 战斗结束

---

## 六、数据对接

### 6.1 属性映射

V5 引擎与现有 `Cultivator` 数据模型的属性映射：

| V5 属性 | Cultivator 属性 | 说明 |
|---------|-----------------|------|
| SPIRIT（灵力） | spirit | 法系输出核心 |
| PHYSIQUE（体魄） | vitality | 生存与体修输出核心 |
| AGILITY（身法） | speed | 先手与暴击核心 |
| CONSCIOUSNESS（神识） | willpower | 控制与反制核心 |
| COMPREHENSION（悟性） | wisdom | 策略与上限核心 |

**适配器转换**：
```typescript
private static _mapAttributes(cultivator: Cultivator): Partial<Record<AttributeType, number>> {
  const attrs = cultivator.attributes;

  return {
    [AttributeType.SPIRIT]: attrs.spirit || 10,
    [AttributeType.PHYSIQUE]: attrs.vitality || 10,
    [AttributeType.AGILITY]: attrs.speed || 10,
    [AttributeType.CONSCIOUSNESS]: attrs.willpower || 10,
    [AttributeType.COMPREHENSION]: attrs.wisdom || 10,
  };
}
```

### 6.2 适配器接口

**主要转换内容：**

```typescript
class CultivatorAdapter {
  /**
   * Cultivator → Unit（战斗前转换）
   */
  static cultVatorToUnit(cultivator: Cultivator, unitId: string): Unit;

  /**
   * Unit → Cultivator 更新数据（战斗后同步）
   */
  static unitToCultivatorUpdate(unit: Unit, cultivator: Cultivator): Partial<Cultivator>;

  /**
   * EffectConfig → Ability（技能配置转换）
   */
  static effectToAbility(effectConfig: EffectConfig, owner: Unit): Ability | null;

  /**
   * BuffConfig → Buff（BUFF配置转换）
   */
  static buffConfigToBuff(buffConfig: BuffConfig, owner: Unit): Buff | null;
}
```

**需要转换的数据字段：**

| Cultivator 字段 | V5 对应 | 转换方式 |
|-----------------|---------|----------|
| attributes | AttributeSet.attributes | 属性映射 |
| skills | AbilityContainer.abilities | EffectConfig → Ability |
| preHeavenFates | AbilityContainer.destinies | EffectConfig → Destiny |
| equipped.weapon/equipment | AttributeModifiers | 固定值修改器 |
| realm | 境界系数 | 派生属性计算 |
| spiritualRoots | 元素亲和 | 元素伤害加成 |

**双向转换支持：**
- 战斗前：Cultivator → Unit（完整转换）
- 战斗后：Unit → Cultivator（仅更新 HP/MP/持久BUFF）

---

## 七、测试策略

### 7.1 单元测试

**测试覆盖：**
- `core/EventBus.test.ts`：事件订阅、发布、优先级
- `core/CombatStateMachine.test.ts`：状态转换
- `units/AttributeSet.test.ts`：属性计算、修改器叠加
- `units/Unit.test.ts`：克隆、战斗操作
- `abilities/Ability.test.ts`：触发条件、执行效果
- `buffs/Buff.test.ts`：生命周期、持续时间

### 7.2 集成测试

**测试场景：**
- 完整战斗流程
- 技能释放
- BUFF 叠加
- 伤害计算
- 胜负判定

### 7.3 对比测试

将 V5 引擎与现有引擎使用相同输入进行对比，验证：
- 胜负结果一致
- 伤害计算合理
- 时序正确

---

## 八、实施计划

### 阶段一：核心框架（预计 5-7 天）

1. **基础结构**
   - 创建目录结构
   - 实现核心类型定义（含4阶段修改器）
   - 实现 EventBus（优先级队列 + 事件历史）

2. **状态机**
   - 实现 CombatStateMachine
   - 实现 7-9 个状态（增加细粒度状态）
   - 状态转换逻辑

3. **单元测试**
   - EventBus 测试（订阅、发布、优先级、历史）
   - CombatStateMachine 测试（状态转换、时序）

### 阶段二：属性与单元（预计 5-7 天）

1. **属性系统**
   - 实现 AttributeSet（4阶段修改器）
   - 实现派生属性计算（考虑境界系数）
   - 实现属性缓存机制

2. **战斗单元**
   - 实现 Unit
   - 实现原型克隆（深拷贝）
   - 实现战斗操作（伤害、治疗、MP）

3. **容器系统**
   - 实现 AbilityContainer
   - 实现 BuffContainer

4. **单元测试**
   - AttributeSet 测试（修改器叠加、派生属性）
   - Unit 测试（克隆、战斗操作）
   - 容器测试

### 阶段三：能力与BUFF（预计 7-10 天）

1. **能力系统**
   - 实现 Ability 基类
   - 实现 ActiveSkill（MP消耗、冷却、触发条件）
   - 实现 PassiveAbility（事件触发）
   - 示例技能（火球术）

2. **BUFF系统**
   - 实现 Buff 基类（含完整生命周期钩子）
   - 实现持续时间管理
   - 示例 BUFF（力量提升）

3. **效果转换**
   - EffectConfig → Ability 转换器
   - BuffConfig → Buff 转换器

4. **单元测试**
   - Ability 测试（触发条件、执行效果）
   - Buff 测试（生命周期、持续时间）

### 阶段四：系统模块（预计 5-7 天）

1. **战报系统**
   - 实现 CombatLogSystem
   - 极简/详细模式
   - 高光时刻标记

2. **伤害系统**
   - 实现 DamageSystem（完整管道）
   - 暴击、闪避、减伤、元素克制

3. **适配器**
   - 实现 CultivatorAdapter（双向转换）
   - 数据字段映射

4. **胜负判定**
   - 实现 VictorySystem
   - 多种胜负条件

5. **集成测试**
   - 完整战斗流程测试
   - 与现有引擎对比测试

### 阶段五：入口与优化（预计 3-5 天）

1. **入口实现**
   - 实现 BattleEngineV5
   - 暴露公共 API

2. **文档完善**
   - 代码注释
   - 使用示例
   - 迁移指南

3. **性能优化**
   - 事件处理优化
   - 对象池（减少GC）
   - 事件历史环形缓冲区

4. **调试工具**
   - 事件流可视化
   - 状态机追踪

**总计：25-36 天**

---

## 九、与现有系统对比

| 特性 | 现有引擎 (V2) | V5 引擎 |
|------|--------------|---------|
| 架构 | 回调函数 + 管道 | 事件驱动 + 状态机 |
| 时序控制 | 相对灵活 | 严格固定 |
| 扩展性 | 中等 | 高 |
| 可测试性 | 中等 | 高 |
| 模块解耦 | 中等 | 高 |
| 学习曲线 | 中等 | 较高 |
| 代码量 | 中等 | 较大 |

---

## 十、风险与缓解

### 10.1 风险分析

| 风险类别 | 具体风险 | 影响 | 概率 |
|----------|----------|------|------|
| **开发风险** | 开发周期较长（25-36天） | 高 | 高 |
| **学习风险** | EDA + GAS 思想学习曲线陡峭 | 中 | 高 |
| **集成风险** | 与现有 Effect/Buff 系统兼容性 | 高 | 中 |
| **性能风险** | 事件驱动可能导致大量对象创建 | 中 | 中 |
| **内存风险** | 原型克隆、事件历史可能导致内存泄漏 | 高 | 低 |
| **调试风险** | 事件链路追踪困难 | 中 | 中 |
| **数据风险** | EffectConfig 配置迁移成本高 | 高 | 中 |
| **平衡性风险** | 新旧引擎数值不一致 | 高 | 中 |

### 10.2 缓解措施

**1. 分阶段实施**
- 阶段一完成后：验证状态机 + 事件总线核心功能
- 阶段二完成后：验证属性计算 + 单元克隆
- 阶段三完成后：验证能力/BUFF 系统可扩展性
- 每个阶段都有独立的交付物和验收标准

**2. 并行开发 + 渐进迁移**
- 新旧引擎并行运行
- 通过特性开关控制使用哪个引擎
- 先在非关键功能上验证 V5
- 确认稳定后再逐步迁移

**3. 性能优化**
- 使用对象池减少 GC 压力
- 事件历史使用环形缓冲区（限制大小）
- 限制事件订阅者数量
- 性能基准测试（每阶段）

**4. 调试工具**
- 事件流可视化工具
- 状态机状态追踪
- 性能分析工具
- 详细的事件日志

**5. 数据兼容**
- 适配器支持双向转换
- 保留 EffectConfig 配置格式
- 提供配置迁移工具
- 新旧引擎对比测试

**6. 文档与培训**
- 详细的设计文档
- 代码注释完善
- 使用示例丰富
- 团队培训（EDA + GAS 概念）

**7. 回滚计划**
- 保留现有引擎 V2
- 特性开关可快速切换
- 数据备份机制
- 回滚测试演练

---

## 十一、后续扩展

完成核心框架后，可扩展：

1. **配置驱动**：将技能/命格配置改为 JSON
2. **AI 系统**：实现技能释放条件自定义
3. **环境系统**：地形加成、境界压制
4. **组队战斗**：5v5 宗门战
5. **特殊战斗**：天劫、心魔战

---

**文档版本**: 1.1
**最后更新**: 2026-03-17
**更新内容**：
- 修正属性映射（使用实际属性名）
- 扩展属性修改器为4阶段（BASE/FIXED/ADD/MULTIPLY/FINAL/OVERRIDE）
- 补充完整伤害计算流程
- 扩展BUFF生命周期钩子（12个钩子）
- 补充适配器详细设计
- 调整实施计划时间估算（25-36天）
- 补充完整风险分析和缓解措施
