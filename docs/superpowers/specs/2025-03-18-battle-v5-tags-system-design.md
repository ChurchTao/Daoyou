# Battle V5 Tags 系统重构设计

**日期**: 2025-03-18
**作者**: Claude Code
**状态**: 设计阶段

---

## 一、概述

### 1.1 背景

当前 Battle V5 系统已实现 GAS + EDA 核心架构，但缺少标签（Tag）系统。技能/BUFF 之间的交互依赖硬编码的属性判断（如 `isMagicAbility`），缺乏灵活性和可扩展性。

### 1.2 目标

引入 GAS 风格的 GameplayTag 系统，实现：

1. **解耦交互逻辑** - 通过标签而非硬编码判断条件
2. **父标签匹配** - 实现「免疫所有控制」这类灵活条件
3. **统一堆叠规则** - 规范 BUFF 的堆叠行为
4. **保留扩展性** - 为未来配置驱动预留接口

### 1.3 范围

- ✅ 完整实现标签系统
- ✅ 直接重构（移除旧属性）
- ✅ 代码优先（配置系统后续迭代）
- ✅ 集中式标签管理
- ✅ 模块集成测试

---

## 二、架构设计

### 2.1 文件结构

```
engine/battle-v5/
├── core/
│   ├── GameplayTags.ts       # [新建] 标签系统核心（包含 GamepalyTagContainer + 常量）
│   ├── types.ts              # [修改] 添加 TagPath 类型导出
│   └── events.ts             # [修改] 添加标签事件
├── units/
│   ├── Unit.ts               # [修改] 添加 tags 属性
│   └── BuffContainer.ts      # [重构] 基于标签的堆叠逻辑
├── abilities/
│   └── Ability.ts            # [修改] 添加 tags，移除旧属性
├── buffs/
│   └── Buff.ts               # [修改] 添加 tags + stackRule
└── tests/
    ├── core/
    │   └── GameplayTags.test.ts      # [新建]
    ├── integration/
    │   └── TagSystemIntegration.test.ts  # [新建]
    ├── examples/
    │   └── TaggedSkills.test.ts       # [新建]
    └── performance/
        └── TagPerformance.test.ts    # [新建]
```

### 2.2 类型定义位置

**`TagPath` 类型** 定义在 `core/types.ts` 中统一管理：

```typescript
// core/types.ts
export type TagPath = string;
```

**`core/GameplayTags.ts`** 重新导出该类型以方便使用：

```typescript
// core/GameplayTags.ts
export type { TagPath } from './types';
```

### 2.2 依赖关系

```
GameplayTagContainer (独立核心)
    ↓ 被使用
Unit → tags
Ability → tags
Buff → tags + stackRule
    ↓ 影响
BuffContainer.addBuff() (基于标签判定)
```

---

## 三、核心模块设计

### 3.1 GameplayTagContainer

**职责**：管理标签集合，提供查询、匹配、克隆功能

**文件**: `core/GameplayTags.ts`

**核心 API**:

```typescript
export type TagPath = string;

export class GameplayTagContainer {
  // 基础操作
  addTags(tags: TagPath[]): void;
  removeTags(tags: TagPath[]): void;
  hasTag(tag: TagPath): boolean;        // 支持父标签匹配
  hasAnyTag(tags: TagPath[]): boolean;
  hasAllTags(tags: TagPath[]): boolean;
  getTags(): TagPath[];
  clear(): void;
  clone(): GameplayTagContainer;
}
```

**父标签匹配规则**:
- 路径分隔符为 `.`
- 查询 `Status.Immune.Stun` 时，如有 `Status.Immune` 则返回 `true`
- 查询 `Ability.Element.Fire` 时，如有 `Ability.Element` 则返回 `true`

**实现要点**:

```typescript
private _getParentTags(tag: TagPath): TagPath[] {
  const parts = tag.split('.');
  const parents: TagPath[] = [];
  for (let i = 1; i < parts.length; i++) {
    parents.push(parts.slice(0, i).join('.'));
  }
  return parents;
}
```

**事件发布机制**:

`GameplayTagContainer` 负责自动发布标签变更事件。但为了避免依赖 `Unit` 和 `EventBus`，事件发布由调用方（如 `Unit.tags.addTags()` 后）负责，保持容器独立。

**使用方式**:

```typescript
// Unit 中使用示例
unit.tags.addTags([GameplayTags.STATUS.IMMUNE_FIRE]);
// 由 Unit 负责发布事件（如需要）
EventBus.instance.publish<TagAddedEvent>({
  type: 'TagAddedEvent',
  priority: EventPriorityLevel.TAG_CHANGE,
  timestamp: Date.now(),
  target: unit,
  tag: GameplayTags.STATUS.IMMUNE_FIRE,
  source: buff,
});
```

### 3.2 GameplayTags 常量对象

**职责**：提供预定义标签常量，避免拼写错误

**文件**: `core/GameplayTags.ts`

**结构**:

```typescript
export const GameplayTags = {
  // 单位类型
  UNIT: {
    TYPE: 'Unit.Type',
    PLAYER: 'Unit.Type.Player',
    ENEMY: 'Unit.Type.Enemy',
    COMBATANT: 'Unit.Type.Combatant',
  },

  // 状态标签
  STATUS: {
    IMMUNE: 'Status.Immune',
    IMMUNE_CONTROL: 'Status.Immune.Control',
    IMMUNE_DEBUFF: 'Status.Immune.Debuff',
    IMMUNE_FIRE: 'Status.Immune.Fire',
    STUNNED: 'Status.Stunned',
    POISONED: 'Status.Poisoned',
  },

  // 技能标签
  ABILITY: {
    TYPE: 'Ability.Type',
    TYPE_DAMAGE: 'Ability.Type.Damage',
    TYPE_CONTROL: 'Ability.Type.Control',
    TYPE_HEAL: 'Ability.Type.Heal',
    TYPE_MAGIC: 'Ability.Type.Magic',
    TYPE_PHYSICAL: 'Ability.Type.Physical',

    ELEMENT: 'Ability.Element',
    ELEMENT_FIRE: 'Ability.Element.Fire',
    ELEMENT_WATER: 'Ability.Element.Water',
    ELEMENT_POISON: 'Ability.Element.Poison',

    TARGET: 'Ability.Target',
    TARGET_SINGLE: 'Ability.Target.Single',
    TARGET_AOE: 'Ability.Target.AoE',
  },

  // BUFF 标签
  BUFF: {
    TYPE: 'Buff.Type',
    TYPE_BUFF: 'Buff.Type.Buff',
    TYPE_DEBUFF: 'Buff.Type.Debuff',
    TYPE_CONTROL: 'Buff.Type.Control',

    DOT: 'Buff.Dot',
    DOT_POISON: 'Buff.Dot.Poison',
    DOT_BURN: 'Buff.Dot.Burn',
  },
} as const;
```

---

## 四、标签事件设计

### 4.1 新增事件类型

**文件**: `core/events.ts`

```typescript
// 标签添加事件
export interface TagAddedEvent extends CombatEvent {
  type: 'TagAddedEvent';
  target: Unit;
  tag: TagPath;
  source?: unknown;
}

// 标签移除事件
export interface TagRemovedEvent extends CombatEvent {
  type: 'TagRemovedEvent';
  target: Unit;
  tag: TagPath;
  source?: unknown;
}

// BUFF 添加拦截事件
export interface BuffAddEvent extends CombatEvent {
  type: 'BuffAddEvent';
  target: Unit;
  buff: Buff;
  isCancelled?: boolean;  // 设置为 true 可取消添加
}
```

### 4.2 事件优先级

在 `EventPriorityLevel` 枚举中添加：

```typescript
export enum EventPriorityLevel {
  // ... 现有 ...

  // 标签相关（高于普通结算）
  BUFF_INTERCEPT = POST_SETTLE + 10,  // BUFF 拦截
  TAG_CHANGE = POST_SETTLE + 5,       // 标签变更
}
```

---

## 五、单元/能力/BUFF 集成

### 5.1 Unit.ts 修改

```typescript
import { GameplayTagContainer } from '../core/GameplayTags';

export class Unit {
  // 新增
  readonly tags: GameplayTagContainer;

  constructor(...) {
    // ... 现有代码 ...
    this.tags = new GameplayTagContainer();
    this.tags.addTags([GameplayTags.UNIT.COMBATANT]);
  }

  clone(): Unit {
    // ... 现有代码 ...
    clone.tags = this.tags.clone();
    return clone;
  }
}
```

### 5.2 Ability.ts 修改

**移除的属性**:
- `isMagicAbility` → `tags.hasTag(GameplayTags.ABILITY.TYPE_MAGIC)`
- `isPhysicalAbility` → `tags.hasTag(GameplayTags.ABILITY.TYPE_PHYSICAL)`
- `isDebuffAbility` → `tags.hasTag(GameplayTags.ABILITY.TYPE_DAMAGE)` + Debuff 标签

```typescript
import { GameplayTagContainer } from '../core/GameplayTags';

export class Ability {
  // 新增
  readonly tags: GameplayTagContainer;

  // 移除
  // private _isMagicAbility: boolean
  // private _isPhysicalAbility: boolean
  // private _isDebuffAbility: boolean

  constructor(id: AbilityId, name: string, type: AbilityType) {
    // ... 现有代码 ...
    this.tags = new GameplayTagContainer();
  }

  // 移除的 setter
  // setIsMagicAbility(value: boolean) { ... }
}
```

### 5.3 Buff.ts 修改

```typescript
import { GameplayTagContainer } from '../core/GameplayTags';

export class Buff {
  // 新增
  readonly tags: GameplayTagContainer;
  readonly stackRule: StackRule;

  // 堆叠规则枚举
  static readonly StackRule = {
    STACK_LAYER: 'stack_layer',
    REFRESH_DURATION: 'refresh_duration',
    OVERRIDE: 'override',
    IGNORE: 'ignore',
  } as const;

  // 堆叠规则类型定义
  export type StackRule = typeof Buff.StackRule[keyof typeof Buff.StackRule];

  constructor(
    id: BuffId,
    name: string,
    type: BuffType,
    duration: number,
    stackRule: StackRule = Buff.StackRule.REFRESH_DURATION
  ) {
    this.tags = new GameplayTagContainer();
    this.stackRule = stackRule;
    // ... 现有代码 ...
  }

  clone(): Buff {
    const cloned = /* ... */;
    cloned.tags = this.tags.clone();
    return cloned;
  }
}
```

### 5.4 Ability 初始化时的标签设置

**方案**：在子类构造函数中设置标签

```typescript
export class FireballSkill extends ActiveSkill {
  constructor() {
    super('fireball' as AbilityId, '火球术', 30, 3);

    // 设置标签
    this.tags.addTags([
      GameplayTags.ABILITY.TYPE_DAMAGE,
      GameplayTags.ABILITY.TYPE_MAGIC,
      GameplayTags.ABILITY.ELEMENT_FIRE,
      GameplayTags.ABILITY.TARGET_SINGLE,
    ]);
  }
}
```

---

## 六、BuffContainer 重构

### 6.1 新的 addBuff 流程

```typescript
import { BuffAddEvent } from '../core/events';
import { EventBus } from '../core/EventBus';

export class BuffContainer {
  addBuff(buff: Buff): void {
    // 1. 发布拦截事件
    const event: BuffAddEvent = {
      type: 'BuffAddEvent',
      priority: EventPriorityLevel.BUFF_INTERCEPT,
      timestamp: Date.now(),
      target: this._owner,
      buff,
    };
    EventBus.instance.publish(event);
    if (event.isCancelled) return;

    // 2. 标签免疫检查
    if (this._checkImmune(buff)) return;

    // 3. 堆叠规则处理
    const existing = this._buffs.get(buff.id);
    if (existing) {
      this._applyStackRule(existing, buff);
      return;
    }

    // 4. 添加新 BUFF
    this._buffs.set(buff.id, buff);
    buff.onApply(this._owner);
    this._owner.updateDerivedStats();
  }

  private _checkImmune(buff: Buff): boolean {
    const isDebuff = buff.tags.hasTag(GameplayTags.BUFF.TYPE_DEBUFF);
    if (!isDebuff) return false;

    return this._owner.tags.hasAnyTag([
      GameplayTags.STATUS.IMMUNE_DEBUFF,
      GameplayTags.STATUS.IMMUNE,
    ]);
  }

  private _applyStackRule(existing: Buff, newBuff: Buff): void {
    switch (newBuff.stackRule) {
      case Buff.StackRule.STACK_LAYER:
        if ('addLayer' in existing && typeof existing.addLayer === 'function') {
          (existing as any).addLayer(1);
        }
        break;

      case Buff.StackRule.REFRESH_DURATION:
        existing.refreshDuration();
        break;

      case Buff.StackRule.OVERRIDE:
        this.removeBuff(existing.id);
        this.addBuff(newBuff);
        break;

      case Buff.StackRule.IGNORE:
        break;
    }
  }

  clone(owner: Unit): BuffContainer {
    const clone = new BuffContainer(owner);
    for (const buff of this._buffs.values()) {
      const clonedBuff = buff.clone();
      clone._buffs.set(clonedBuff.id, clonedBuff);
      clonedBuff.onApply(owner);
    }
    return clone;
  }
}
```

---

## 七、迁移路径

### 7.1 现有代码迁移清单

| 文件 | 迁移内容 | 破坏性 |
|-----|---------|--------|
| `core/types.ts` | 添加 `TagPath` 类型 | 无 |
| `core/events.ts` | 添加标签事件 | 无 |
| `core/GameplayTags.ts` | 新建 | 无 |
| `units/Unit.ts` | 添加 `tags` 属性 | 无 |
| `abilities/Ability.ts` | 添加 `tags`，移除 `isMagicAbility` 等 | **有** |
| `buffs/Buff.ts` | 添加 `tags` + `stackRule` | 有 |
| `units/BuffContainer.ts` | 重构 `addBuff` | 无 |
| `abilities/examples/FireballSkill.ts` | 添加标签 | 无 |
| `buffs/examples/StrengthBuff.ts` | 添加标签 + 堆叠规则 | 无 |

### 7.2 API 变更示例

#### Ability 属性迁移对照表

| 旧 API | 新 API | 说明 |
|--------|--------|------|
| `ability.isMagicAbility` | `ability.tags.hasTag(GameplayTags.ABILITY.TYPE_MAGIC)` | 精确匹配 |
| `ability.isPhysicalAbility` | `ability.tags.hasTag(GameplayTags.ABILITY.TYPE_PHYSICAL)` | 精确匹配 |
| `ability.isDebuffAbility` | `ability.tags.hasTag(GameplayTags.ABILITY.TYPE_CONTROL)` 或组合标签 | 控制类技能 |
| `ability.setIsMagicAbility(true)` | `ability.tags.addTags([GameplayTags.ABILITY.TYPE_MAGIC])` | 设置标签 |

#### DamageSystem 迁移示例

**现有代码** (`systems/DamageSystem.ts` 第 68 行):
```typescript
if (ability.isDebuffAbility && hitCheckEvent.isHit) {
  // ...
}
```

**迁移后**:
```typescript
if (ability.tags.hasTag(GameplayTags.ABILITY.TYPE_CONTROL) && hitCheckEvent.isHit) {
  // ...
}
```

**现有代码** (`systems/DamageSystem.ts` 第 110-114 行):
```typescript
if (ability.isMagicAbility) {
  elementBonus = 1.2;
} else if (ability.isPhysicalAbility) {
  elementBonus = 1.0;
}
```

**迁移后**:
```typescript
if (ability.tags.hasTag(GameplayTags.ABILITY.TYPE_MAGIC)) {
  elementBonus = 1.2;
} else if (ability.tags.hasTag(GameplayTags.ABILITY.TYPE_PHYSICAL)) {
  elementBonus = 1.0;
}
```

### 7.3 API 变更示例

```typescript
// 旧方式
if (ability.isMagicAbility) { ... }
if (ability.isPhysicalAbility) { ... }

// 新方式
if (ability.tags.hasTag(GameplayTags.ABILITY.TYPE_MAGIC)) { ... }
if (ability.tags.hasTag(GameplayTags.ABILITY.TYPE_PHYSICAL)) { ... }
```

```typescript
// 旧方式
new Buff(id, name, type, duration)

// 新方式（stackRule 有默认值，向后兼容）
new Buff(id, name, type, duration, Buff.StackRule.REFRESH_DURATION)
```

---

## 八、测试策略

### 8.1 单元测试

**文件**: `tests/core/GameplayTags.test.ts`

- 精确匹配测试
- 父标签匹配测试
- 批量操作测试
- 克隆功能测试

### 8.2 集成测试

**文件**: `tests/integration/TagSystemIntegration.test.ts`

- 通过标签拦截 BUFF 添加
- 堆叠规则正确应用
- 标签事件正确触发
- Unit 克隆保留标签状态

### 8.3 示例测试

**文件**: `tests/examples/TaggedSkills.test.ts`

- 火球术带有火属性标签
- 力量 BUFF 正确设置标签
- 免疫标签拦截 DEBUFF

### 8.4 性能测试

**文件**: `tests/performance/TagPerformance.test.ts`

```typescript
describe('标签系统性能测试', () => {
  it('父标签匹配应在 1ms 内完成', () => {
    const container = new GameplayTagContainer();
    container.addTags(['A.B.C.D.E.F']);

    const start = performance.now();
    container.hasTag('A.B.C.D.E.F');
    const end = performance.now();

    expect(end - start).toBeLessThan(1);
  });

  it('大量标签查询不应有明显性能衰减', () => {
    const container = new GameplayTagContainer();
    for (let i = 0; i < 100; i++) {
      container.addTags([`Tag.${i}.A.B.C`]);
    }

    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      container.hasTag(`Tag.${Math.floor(Math.random() * 100)}.A`);
    }
    const end = performance.now();

    expect(end - start).toBeLessThan(10); // 10ms 内完成 1000 次查询
  });
});
```

### 8.5 边界情况测试

**文件**: `tests/core/GameplayTags.test.ts`

```typescript
describe('标签系统边界测试', () => {
  it('应处理空标签路径', () => {
    const container = new GameplayTagContainer();
    expect(container.hasTag('')).toBe(false);
  });

  it('应忽略重复添加的标签', () => {
    const container = new GameplayTagContainer();
    container.addTags(['A.B']);
    container.addTags(['A.B']);
    expect(container.getTags()).toEqual(['A.B']);
  });

  it('应处理格式错误的标签路径', () => {
    const container = new GameplayTagContainer();
    container.addTags(['A..B']); // 可能是错误格式
    expect(container.hasTag('A..B')).toBe(true); // 容错处理
  });
});
```

---

## 九、后续扩展

### 9.1 配置驱动（未来）

保留接口扩展性，未来可从 JSON 配置加载：

```json
{
  "id": "skill_fire_ball",
  "tags": ["Ability.Element.Fire", "Ability.Type.Damage"],
  "effects": [...]
}
```

### 9.2 标签查询优化（未来）

- 添加标签查询缓存
- 支持标签通配符匹配

---

## 十、风险与缓解

| 风险 | 缓解措施 |
|-----|---------|
| 破坏性变更影响现有代码 | `stackRule` 参数提供默认值，保持向后兼容 |
| 标签命名冲突 | 使用 `GameplayTags` 常量对象集中管理 |
| 性能影响 | 标签查询使用 Set，时间复杂度 O(1) |
| 测试覆盖不足 | 模块集成测试覆盖关键路径 |
