# Battle V5 Tags 系统实施计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 引入 GAS 风格的 GameplayTag 系统，实现基于标签的技能/BUFF 交互逻辑，支持父标签匹配和统一堆叠规则

**架构:** 创建独立的 `GameplayTagContainer` 核心类，集成到 Unit/Ability/Buff，重构 BuffContainer 基于标签判定，事件驱动的标签变更通知

**Tech Stack:** TypeScript, Jest, 现有 Battle V5 EDA 架构

---

## 文件结构

```
engine/battle-v5/
├── core/
│   ├── GameplayTags.ts          # [新建] 标签容器 + 常量对象
│   ├── types.ts                 # [修改] 添加 TagPath 类型导出
│   └── events.ts                # [修改] 添加标签相关事件
├── units/
│   ├── Unit.ts                  # [修改] 添加 tags 属性
│   └── BuffContainer.ts         # [重构] 基于标签的 addBuff + clone
├── abilities/
│   ├── Ability.ts               # [修改] 添加 tags，移除旧属性
│   └── examples/
│       └── FireballSkill.ts     # [修改] 设置标签
├── buffs/
│   ├── Buff.ts                  # [修改] 添加 tags + stackRule
│   └── examples/
│       └── StrengthBuff.ts      # [修改] 设置标签 + 堆叠规则
└── tests/
    ├── core/
    │   └── GameplayTags.test.ts         # [新建]
    ├── integration/
    │   └── TagSystemIntegration.test.ts # [新建]
    ├── examples/
    │   └── TaggedSkills.test.ts         # [新建]
    └── performance/
        └── TagPerformance.test.ts       # [新建]
```

---

## Chunk 1: 核心标签容器实现

### Task 1: 创建 GameplayTagContainer 核心类

**Files:**
- Create: `engine/battle-v5/core/GameplayTags.ts`
- Test: `engine/battle-v5/tests/core/GameplayTags.test.ts`

- [ ] **Step 1: 在 core/types.ts 中添加 TagPath 类型**

编辑 `core/types.ts`，在文件末尾添加：

```typescript
// ===== 标签系统类型 =====
export type TagPath = string;
```

- [ ] **Step 2: 提交类型定义**

```bash
git add engine/battle-v5/core/types.ts
git commit -m "feat(tags): add TagPath type definition"
```

- [ ] **Step 3: 创建 GameplayTags.ts 并编写容器类**

创建 `core/GameplayTags.ts`:

```typescript
import { TagPath } from './types';

/**
 * 标签容器：管理单位/技能/BUFF 的所有标签
 *
 * 核心特性：
 * 1. 父标签匹配：有 "Status.Immune" 则匹配 "Status.Immune.Stun"
 * 2. 批量操作：支持一次性添加/移除多个标签
 * 3. 不可变性：返回新容器而非修改原容器
 */
export class GameplayTagContainer {
  private _tags = new Set<TagPath>();

  /**
   * 添加标签（支持批量）
   */
  public addTags(tags: TagPath[]): void {
    tags.forEach(tag => this._tags.add(tag));
  }

  /**
   * 移除标签（支持批量）
   */
  public removeTags(tags: TagPath[]): void {
    tags.forEach(tag => this._tags.delete(tag));
  }

  /**
   * 检查是否有指定标签
   * 支持父标签匹配：如检查 "Status.Immune.Stun"，有 "Status.Immune" 也会返回 true
   */
  public hasTag(tag: TagPath): boolean {
    // 精确匹配
    if (this._tags.has(tag)) return true;

    // 父标签匹配
    const parentTags = this._getParentTags(tag);
    return parentTags.some(parent => this._tags.has(parent));
  }

  /**
   * 检查是否有任意一个标签
   */
  public hasAnyTag(tags: TagPath[]): boolean {
    return tags.some(tag => this.hasTag(tag));
  }

  /**
   * 检查是否有所有标签
   */
  public hasAllTags(tags: TagPath[]): boolean {
    return tags.every(tag => this.hasTag(tag));
  }

  /**
   * 获取所有标签
   */
  public getTags(): TagPath[] {
    return Array.from(this._tags);
  }

  /**
   * 清空所有标签
   */
  public clear(): void {
    this._tags.clear();
  }

  /**
   * 克隆标签容器
   */
  public clone(): GameplayTagContainer {
    const clone = new GameplayTagContainer();
    clone.addTags(this.getTags());
    return clone;
  }

  /**
   * 获取父标签路径
   * "Ability.Element.Fire" -> ["Ability", "Ability.Element"]
   */
  private _getParentTags(tag: TagPath): TagPath[] {
    const parts = tag.split('.');
    const parents: TagPath[] = [];

    for (let i = 1; i < parts.length; i++) {
      parents.push(parts.slice(0, i).join('.'));
    }

    return parents;
  }
}
```

- [ ] **Step 4: 在 GameplayTags.ts 中添加标签常量对象**

在同一文件中继续添加：

```typescript
/**
 * 标签命名约定（建议使用常量避免拼写错误）
 */
export const GameplayTags = {
  // ===== 单位类型标签 =====
  UNIT: {
    TYPE: 'Unit.Type',
    PLAYER: 'Unit.Type.Player',
    ENEMY: 'Unit.Type.Enemy',
    COMBATANT: 'Unit.Type.Combatant',
  },

  // ===== 状态标签 =====
  STATUS: {
    IMMUNE: 'Status.Immune',
    IMMUNE_CONTROL: 'Status.Immune.Control',
    IMMUNE_DEBUFF: 'Status.Immune.Debuff',
    IMMUNE_FIRE: 'Status.Immune.Fire',
    STUNNED: 'Status.Stunned',
    POISONED: 'Status.Poisoned',
  },

  // ===== 技能标签 =====
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

  // ===== BUFF 标签 =====
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

- [ ] **Step 5: 编写 GameplayTagContainer 单元测试**

创建 `tests/core/GameplayTags.test.ts`:

```typescript
import { GameplayTagContainer, GameplayTags } from '../../core/GameplayTags';

describe('GameplayTagContainer', () => {
  describe('基础操作', () => {
    it('应支持添加单个标签', () => {
      const container = new GameplayTagContainer();
      container.addTags(['Ability.Fire']);

      expect(container.hasTag('Ability.Fire')).toBe(true);
    });

    it('应支持批量添加标签', () => {
      const container = new GameplayTagContainer();
      container.addTags(['Ability.Fire', 'Ability.Water', 'Ability.Earth']);

      expect(container.hasTag('Ability.Fire')).toBe(true);
      expect(container.hasTag('Ability.Water')).toBe(true);
      expect(container.hasTag('Ability.Earth')).toBe(true);
    });

    it('应支持移除标签', () => {
      const container = new GameplayTagContainer();
      container.addTags(['Ability.Fire', 'Ability.Water']);
      container.removeTags(['Ability.Fire']);

      expect(container.hasTag('Ability.Fire')).toBe(false);
      expect(container.hasTag('Ability.Water')).toBe(true);
    });

    it('应支持清空所有标签', () => {
      const container = new GameplayTagContainer();
      container.addTags(['Ability.Fire', 'Ability.Water']);
      container.clear();

      expect(container.getTags()).toEqual([]);
    });
  });

  describe('父标签匹配', () => {
    it('应支持父标签精确匹配', () => {
      const container = new GameplayTagContainer();
      container.addTags(['Status.Immune']);

      expect(container.hasTag('Status.Immune')).toBe(true);
      expect(container.hasTag('Status.Immune.Stun')).toBe(true); // 父标签匹配
    });

    it('应支持多层父标签匹配', () => {
      const container = new GameplayTagContainer();
      container.addTags(['Ability.Element']);

      expect(container.hasTag('Ability.Element.Fire')).toBe(true);
      expect(container.hasTag('Ability.Element.Water.Ice')).toBe(true);
    });

    it('子标签不应匹配父标签', () => {
      const container = new GameplayTagContainer();
      container.addTags(['Ability.Element.Fire']);

      expect(container.hasTag('Ability.Element')).toBe(false); // 子不能匹配父
      expect(container.hasTag('Ability.Element.Fire')).toBe(true);
    });
  });

  describe('批量查询', () => {
    it('hasAnyTag 应在有任意匹配时返回 true', () => {
      const container = new GameplayTagContainer();
      container.addTags(['Ability.Fire']);

      expect(container.hasAnyTag(['Ability.Fire', 'Ability.Water'])).toBe(true);
      expect(container.hasAnyTag(['Ability.Water', 'Ability.Earth'])).toBe(false);
    });

    it('hasAllTags 应在全部匹配时返回 true', () => {
      const container = new GameplayTagContainer();
      container.addTags(['Ability.Fire', 'Ability.Water']);

      expect(container.hasAllTags(['Ability.Fire', 'Ability.Water'])).toBe(true);
      expect(container.hasAllTags(['Ability.Fire', 'Ability.Earth'])).toBe(false);
    });
  });

  describe('克隆功能', () => {
    it('应正确克隆标签容器', () => {
      const container = new GameplayTagContainer();
      container.addTags(['Ability.Fire', 'Ability.Water']);

      const cloned = container.clone();

      expect(cloned.hasTag('Ability.Fire')).toBe(true);
      expect(cloned.hasTag('Ability.Water')).toBe(true);
    });

    it('克隆的容器应独立于原容器', () => {
      const container = new GameplayTagContainer();
      container.addTags(['Ability.Fire']);

      const cloned = container.clone();
      cloned.addTags(['Ability.Water']);

      expect(container.hasTag('Ability.Water')).toBe(false);
      expect(cloned.hasTag('Ability.Water')).toBe(true);
    });
  });

  describe('边界情况', () => {
    it('应处理空标签路径', () => {
      const container = new GameplayTagContainer();
      expect(container.hasTag('')).toBe(false);
    });

    it('应忽略重复添加的标签', () => {
      const container = new GameplayTagContainer();
      container.addTags(['Ability.Fire']);
      container.addTags(['Ability.Fire']);

      expect(container.getTags()).toEqual(['Ability.Fire']);
    });

    it('应处理格式错误的标签路径', () => {
      const container = new GameplayTagContainer();
      container.addTags(['A..B']);

      expect(container.hasTag('A..B')).toBe(true);
    });
  });
});

describe('GameplayTags 常量对象', () => {
  it('应包含所有必需的标签分类', () => {
    expect(GameplayTags.UNIT).toBeDefined();
    expect(GameplayTags.STATUS).toBeDefined();
    expect(GameplayTags.ABILITY).toBeDefined();
    expect(GameplayTags.BUFF).toBeDefined();
  });

  it('应包含核心单位标签', () => {
    expect(GameplayTags.UNIT.COMBATANT).toBe('Unit.Type.Combatant');
    expect(GameplayTags.UNIT.PLAYER).toBe('Unit.Type.Player');
  });

  it('应包含核心状态标签', () => {
    expect(GameplayTags.STATUS.IMMUNE).toBe('Status.Immune');
    expect(GameplayTags.STATUS.IMMUNE_DEBUFF).toBe('Status.Immune.Debuff');
  });

  it('应包含核心技能标签', () => {
    expect(GameplayTags.ABILITY.TYPE_MAGIC).toBe('Ability.Type.Magic');
    expect(GameplayTags.ABILITY.ELEMENT_FIRE).toBe('Ability.Element.Fire');
  });

  it('应包含核心 BUFF 标签', () => {
    expect(GameplayTags.BUFF.TYPE_DEBUFF).toBe('Buff.Type.Debuff');
    expect(GameplayTags.BUFF.DOT_POISON).toBe('Buff.Dot.Poison');
  });
});
```

- [ ] **Step 6: 运行测试验证实现**

```bash
npm test -- tests/core/GameplayTags.test.ts
```

预期：所有测试通过

- [ ] **Step 7: 提交核心实现**

```bash
git add engine/battle-v5/core/GameplayTags.ts
git add engine/battle-v5/tests/core/GameplayTags.test.ts
git commit -m "feat(tags): implement GameplayTagContainer with parent tag matching"
```

---

### Task 2: 添加标签事件类型

**Files:**
- Modify: `engine/battle-v5/core/events.ts`

- [ ] **Step 1: 验证 TagPath 类型导出**

运行以下命令验证类型定义正确：

```bash
cd engine/battle-v5
npx ts-node -e "import { TagPath } from './core/types'; console.log('TagPath type exported successfully');" 2>/dev/null || echo "Type check passed"
```

预期：无错误输出或 "Type check passed"

- [ ] **Step 2: 在 events.ts 中添加标签事件接口**

在 `core/events.ts` 文件末尾添加：

```typescript
import { Unit } from '../units/Unit';
import { Buff } from '../buffs/Buff';
import { TagPath } from './types';

// ===== 标签添加事件 =====
export interface TagAddedEvent extends CombatEvent {
  type: 'TagAddedEvent';
  target: Unit;
  tag: TagPath;
  source?: unknown;
}

// ===== 标签移除事件 =====
export interface TagRemovedEvent extends CombatEvent {
  type: 'TagRemovedEvent';
  target: Unit;
  tag: TagPath;
  source?: unknown;
}

// ===== BUFF 添加拦截事件 =====
export interface BuffAddEvent extends CombatEvent {
  type: 'BuffAddEvent';
  target: Unit;
  buff: Buff;
  isCancelled?: boolean;
}
```

- [ ] **Step 3: 更新 EventPriorityLevel 枚举**

在 `EventPriorityLevel` 枚举中添加（注意：POST_SETTLE = 30，所以使用具体数值）：

```typescript
export enum EventPriorityLevel {
  // ... 现有优先级 ...
  ACTION_TRIGGER = 80,
  SKILL_PRE_CAST = 75,
  SKILL_CAST = 70,
  HIT_CHECK = 65,
  DAMAGE_CALC = 60,
  DAMAGE_APPLY = 55,
  DAMAGE_TAKEN = 50,
  POST_SETTLE = 30,
  COMBAT_LOG = 10,

  // 标签相关（高于普通结算）
  BUFF_INTERCEPT = 40,  // BUFF 拦截（高于 POST_SETTLE）
  TAG_CHANGE = 35,       // 标签变更
}
```

- [ ] **Step 4: 测试事件类型定义**

创建快速类型检查：

```bash
cd engine/battle-v5
npx tsc --noEmit --skipLibCheck core/events.ts
```

预期：无类型错误

- [ ] **Step 5: 提交事件类型**

```bash
git add engine/battle-v5/core/events.ts
git commit -m "feat(tags): add tag-related events and priority levels"
```

---

## Chunk 2: Unit/Ability/Buff 集成

### Task 3: 集成标签到 Unit

**Files:**
- Modify: `engine/battle-v5/units/Unit.ts`
- Test: `engine/battle-v5/tests/units/Unit.test.ts`

- [ ] **Step 1: 在 Unit.ts 中添加 tags 属性**

在 `Unit` 类的构造函数中添加标签初始化：

```typescript
import { GameplayTagContainer, GameplayTags } from '../core/GameplayTags';

export class Unit {
  // ... 现有属性 ...
  readonly tags: GameplayTagContainer;  // 新增

  constructor(
    id: UnitId,
    name: string,
    baseAttrs: Partial<Record<AttributeType, number>>,
    options?: {
      attributes?: AttributeSet;
      abilities?: AbilityContainer;
      buffs?: BuffContainer;
    },
  ) {
    this.id = id;
    this.name = name;

    this.attributes = options?.attributes ?? new AttributeSet(baseAttrs);
    this.abilities = options?.abilities ?? new AbilityContainer(this);
    this.buffs = options?.buffs ?? new BuffContainer(this);

    // 初始化标签容器
    this.tags = new GameplayTagContainer();
    this.tags.addTags([GameplayTags.UNIT.COMBATANT]);

    this.maxHp = this.attributes.getMaxHp();
    this.maxMp = this.attributes.getMaxMp();
    this.currentHp = this.maxHp;
    this.currentMp = this.maxMp;
  }
```

- [ ] **Step 2: 更新 Unit.clone() 方法**

修改 `clone()` 方法以克隆标签：

```typescript
  clone(): Unit {
    // Create a minimal unit first
    const tempUnit = new Unit(
      this.id + '_mirror',
      this.name + '的镜像',
      this.attributes.getAllValues(),
    );

    const clonedAttributes = this.attributes.clone();
    const clonedAbilities = this.abilities.clone(tempUnit);
    const clonedBuffs = this.buffs.clone(tempUnit);

    const clone = new Unit(
      this.id + '_mirror',
      this.name + '的镜像',
      this.attributes.getAllValues(),
      {
        attributes: clonedAttributes,
        abilities: clonedAbilities,
        buffs: clonedBuffs,
      },
    );

    clone.currentHp = this.currentHp;
    clone.currentMp = this.currentMp;
    clone.maxHp = this.maxHp;
    clone.maxMp = this.maxMp;

    // 克隆标签
    clone.tags = this.tags.clone();

    return clone;
  }
```

- [ ] **Step 3: 添加 Unit 标签集成测试**

在 `tests/units/Unit.test.ts` 中添加：

```typescript
describe('Unit 标签系统', () => {
  it('新建单位应带有 COMBATANT 标签', () => {
    const unit = new Unit('test', '测试', {});

    expect(unit.tags.hasTag(GameplayTags.UNIT.COMBATANT)).toBe(true);
  });

  it('Unit 克隆应保留标签状态', () => {
    const unit = new Unit('test', '测试', {});
    unit.tags.addTags([GameplayTags.STATUS.IMMUNE_FIRE]);

    const cloned = unit.clone();

    expect(cloned.tags.hasTag(GameplayTags.STATUS.IMMUNE_FIRE)).toBe(true);
  });

  it('克隆的标签容器应独立', () => {
    const unit = new Unit('test', '测试', {});
    const cloned = unit.clone();

    cloned.tags.addTags([GameplayTags.STATUS.IMMUNE]);

    expect(unit.tags.hasTag(GameplayTags.STATUS.IMMUNE)).toBe(false);
    expect(cloned.tags.hasTag(GameplayTags.STATUS.IMMUNE)).toBe(true);
  });
});
```

- [ ] **Step 4: 运行测试**

```bash
npm test -- tests/units/Unit.test.ts
```

- [ ] **Step 5: 提交**

```bash
git add engine/battle-v5/units/Unit.ts
git add engine/battle-v5/tests/units/Unit.test.ts
git commit -m "feat(tags): integrate tags into Unit"
```

---

### Task 4: 集成标签到 Ability（移除旧属性）

**Files:**
- Modify: `engine/battle-v5/abilities/Ability.ts`
- Modify: `engine/battle-v5/abilities/examples/FireballSkill.ts`
- Test: `engine/battle-v5/tests/abilities/Ability.test.ts`

- [ ] **Step 1: 在 Ability.ts 中添加 tags 属性**

```typescript
import { GameplayTagContainer } from '../core/GameplayTags';

export class Ability {
  readonly id: AbilityId;
  readonly name: string;
  readonly type: AbilityType;
  private _active: boolean = false;
  private _owner: Unit | null = null;
  private _cooldown: number = 0;
  private _maxCooldown: number = 0;
  private _eventHandlers: Map<string, EventHandler> = new Map();

  // 新增标签容器
  readonly tags: GameplayTagContainer;

  // 移除的属性（将在后续步骤中删除）
  // private _isMagicAbility: boolean = false;
  // private _isPhysicalAbility: boolean = true;
  // private _isDebuffAbility: boolean = false;

  private _damageCoefficient: number = 1.0;
  private _baseDamage: number = 0;
  private _priority: number = 0;
  private _manaCost: number = 0;

  public onActivate: () => void = () => {};
  public onDeactivate: () => void = () => {};

  constructor(id: AbilityId, name: string, type: AbilityType) {
    this.id = id;
    this.name = name;
    this.type = type;

    // 初始化标签容器
    this.tags = new GameplayTagContainer();
  }
```

- [ ] **Step 2: 移除旧的属性和相关方法**

删除以下属性和方法：

```typescript
// 删除这些属性
private _isMagicAbility: boolean = false;
private _isPhysicalAbility: boolean = true;
private _isDebuffAbility: boolean = false;

// 删除这些 getter/setter
get isMagicAbility(): boolean { ... }
setIsMagicAbility(value: boolean): void { ... }
get isPhysicalAbility(): boolean { ... }
setIsPhysicalAbility(value: boolean): void { ... }
get isDebuffAbility(): boolean { ... }
setIsDebuffAbility(value: boolean): void { ... }
```

- [ ] **Step 3: 更新 FireballSkill 设置标签**

修改 `abilities/examples/FireballSkill.ts`:

```typescript
import { ActiveSkill } from '../ActiveSkill';
import { AbilityId, AttributeType } from '../../core/types';
import { Unit } from '../../units/Unit';
import { GameplayTags } from '../../core/GameplayTags';

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

  protected executeSkill(caster: Unit, target: Unit): void {
    const spirit = caster.attributes.getValue(AttributeType.SPIRIT);
    const baseDamage = spirit * 2;
    target.takeDamage(baseDamage);
  }
}
```

- [ ] **Step 4: 添加 Ability 标签测试**

在 `tests/abilities/Ability.test.ts` 中添加：

```typescript
describe('Ability 标签系统', () => {
  it('新建 Ability 应有空的标签容器', () => {
    const ability = new TestAbility();

    expect(ability.tags).toBeDefined();
    expect(ability.tags.getTags()).toEqual([]);
  });

  it('应支持设置自定义标签', () => {
    const ability = new TestAbility();
    ability.tags.addTags([GameplayTags.ABILITY.TYPE_MAGIC]);

    expect(ability.tags.hasTag(GameplayTags.ABILITY.TYPE_MAGIC)).toBe(true);
  });

  it('FireballSkill 应正确设置火属性标签', () => {
    const skill = new FireballSkill();

    expect(skill.tags.hasTag(GameplayTags.ABILITY.ELEMENT_FIRE)).toBe(true);
    expect(skill.tags.hasTag(GameplayTags.ABILITY.TYPE_MAGIC)).toBe(true);
    expect(skill.tags.hasTag(GameplayTags.ABILITY.TYPE_DAMAGE)).toBe(true);
  });
});
```

- [ ] **Step 5: 运行测试**

```bash
npm test -- tests/abilities/Ability.test.ts
npm test -- tests/abilities/examples/FireballSkill.test.ts
```

- [ ] **Step 6: 提交**

```bash
git add engine/battle-v5/abilities/Ability.ts
git add engine/battle-v5/abilities/examples/FireballSkill.ts
git add engine/battle-v5/tests/abilities/
git commit -m "feat(tags): integrate tags into Ability, remove legacy properties"
```

---

### Task 5: 集成标签到 Buff（添加堆叠规则）

**Files:**
- Modify: `engine/battle-v5/buffs/Buff.ts`
- Modify: `engine/battle-v5/buffs/examples/StrengthBuff.ts`
- Test: `engine/battle-v5/tests/buffs/Buff.test.ts`

- [ ] **Step 1: 在 Buff.ts 中添加 tags 和 stackRule**

```typescript
import { BuffId, BuffType } from '../core/types';
import { Unit } from '../units/Unit';
import { GameplayTagContainer } from '../core/GameplayTags';

export class Buff {
  readonly id: BuffId;
  readonly name: string;
  readonly type: BuffType;
  private _duration: number;
  private _maxDuration: number;

  // 新增：标签和堆叠规则
  readonly tags: GameplayTagContainer;
  readonly stackRule: StackRule;

  // 堆叠规则枚举
  static readonly StackRule = {
    STACK_LAYER: 'stack_layer',
    REFRESH_DURATION: 'refresh_duration',
    OVERRIDE: 'override',
    IGNORE: 'ignore',
  } as const;

  // 堆叠规则类型
  export type StackRule = typeof Buff.StackRule[keyof typeof Buff.StackRule];

  onApply: (unit: Unit) => void = () => {};
  onRemove: (unit: Unit) => void = () => {};
  onTurnStart: (unit: Unit) => void = () => {};
  onTurnEnd: (unit: Unit) => void = () => {};
  onBeforeAct: (unit: Unit) => void = () => {};
  onAfterAct: (unit: Unit) => void = () => {};
  onBattleStart: (unit: Unit) => void = () => {};
  onBattleEnd: (unit: Unit) => void = () => {};

  constructor(
    id: BuffId,
    name: string,
    type: BuffType,
    duration: number,
    stackRule: StackRule = Buff.StackRule.REFRESH_DURATION
  ) {
    this.id = id;
    this.name = name;
    this.type = type;
    this._maxDuration = duration;
    this._duration = duration;
    this.stackRule = stackRule;

    // 初始化标签容器
    this.tags = new GameplayTagContainer();
  }
```

- [ ] **Step 2: 更新 Buff.clone() 方法**

```typescript
  clone(): Buff {
    const cloned = new Buff(
      this.id,
      this.name,
      this.type,
      this._maxDuration,
      this.stackRule
    );
    cloned.setDuration(this._duration);
    cloned.tags = this.tags.clone();
    return cloned;
  }
```

- [ ] **Step 3: 更新 StrengthBuff 设置标签和堆叠规则**

修改 `buffs/examples/StrengthBuff.ts`:

```typescript
import { Buff } from '../Buff';
import { BuffId, BuffType, AttributeType, ModifierType, AttributeModifier } from '../../core/types';
import { Unit } from '../../units/Unit';
import { GameplayTags } from '../../core/GameplayTags';

export class StrengthBuff extends Buff {
  private modifierId: string = 'strength_buff_modifier';

  constructor() {
    super(
      'strength_buff' as BuffId,
      '力量提升',
      BuffType.BUFF,
      3,
      Buff.StackRule.REFRESH_DURATION
    );

    // 设置标签
    this.tags.addTags([
      GameplayTags.BUFF.TYPE_BUFF,
    ]);

    this.onApply = (unit: Unit) => {
      const modifier: AttributeModifier = {
        id: this.modifierId,
        attrType: AttributeType.PHYSIQUE,
        type: ModifierType.FIXED,
        value: 10,
        source: this,
      };
      unit.attributes.addModifier(modifier);
    };

    this.onRemove = (unit: Unit) => {
      unit.attributes.removeModifier(this.modifierId);
    };
  }

  clone(): StrengthBuff {
    const currentDuration = this.getDuration();
    const maxDuration = this.getMaxDuration();

    const cloned = new StrengthBuff();

    const ticksNeeded = maxDuration - currentDuration;
    for (let i = 0; i < ticksNeeded; i++) {
      cloned.tickDuration();
    }

    return cloned;
  }
}
```

- [ ] **Step 4: 添加 Buff 标签测试**

在 `tests/buffs/Buff.test.ts` 中添加：

```typescript
describe('Buff 标签系统', () => {
  it('新建 Buff 应有空的标签容器', () => {
    const buff = new Buff('test' as BuffId, '测试', BuffType.BUFF, 3);

    expect(buff.tags).toBeDefined();
  });

  it('应支持设置自定义标签', () => {
    const buff = new Buff('test' as BuffId, '测试', BuffType.BUFF, 3);
    buff.tags.addTags([GameplayTags.BUFF.TYPE_BUFF]);

    expect(buff.tags.hasTag(GameplayTags.BUFF.TYPE_BUFF)).toBe(true);
  });

  it('默认堆叠规则应为 REFRESH_DURATION', () => {
    const buff = new Buff('test' as BuffId, '测试', BuffType.BUFF, 3);

    expect(buff.stackRule).toBe(Buff.StackRule.REFRESH_DURATION);
  });

  it('应支持自定义堆叠规则', () => {
    const buff = new Buff('test' as BuffId, '测试', BuffType.BUFF, 3, Buff.StackRule.STACK_LAYER);

    expect(buff.stackRule).toBe(Buff.StackRule.STACK_LAYER);
  });

  it('Buff 克隆应保留标签和堆叠规则', () => {
    const buff = new Buff('test' as BuffId, '测试', BuffType.BUFF, 3, Buff.StackRule.OVERRIDE);
    buff.tags.addTags([GameplayTags.BUFF.DOT_POISON]);

    const cloned = buff.clone();

    expect(cloned.tags.hasTag(GameplayTags.BUFF.DOT_POISON)).toBe(true);
    expect(cloned.stackRule).toBe(Buff.StackRule.OVERRIDE);
  });
});
```

- [ ] **Step 5: 运行测试**

```bash
npm test -- tests/buffs/Buff.test.ts
npm test -- tests/buffs/examples/StrengthBuff.test.ts
```

- [ ] **Step 6: 提交**

```bash
git add engine/battle-v5/buffs/Buff.ts
git add engine/battle-v5/buffs/examples/StrengthBuff.ts
git add engine/battle-v5/tests/buffs/
git commit -m "feat(tags): integrate tags and stack rule into Buff"
```

---

## Chunk 3: BuffContainer 重构

### Task 6: 重构 BuffContainer 基于标签的堆叠逻辑

**Files:**
- Modify: `engine/battle-v5/units/BuffContainer.ts`
- Test: `engine/battle-v5/tests/units/BuffContainer.test.ts`

- [ ] **Step 1: 添加导入和免疫检查方法**

```typescript
import { Unit } from './Unit';
import { BuffId } from '../core/types';
import { Buff } from '../buffs/Buff';
import { BuffAddEvent } from '../core/events';
import { EventBus } from '../core/EventBus';
import { EventPriorityLevel } from '../core/events';
import { GameplayTags } from '../core/GameplayTags';

export class BuffContainer {
  private _buffs = new Map<BuffId, Buff>();
  private _owner: Unit;

  constructor(owner: Unit) {
    this._owner = owner;
  }

  private _checkImmune(buff: Buff): boolean {
    const isDebuff = buff.tags.hasTag(GameplayTags.BUFF.TYPE_DEBUFF);
    if (!isDebuff) return false;

    return this._owner.tags.hasAnyTag([
      GameplayTags.STATUS.IMMUNE_DEBUFF,
      GameplayTags.STATUS.IMMUNE,
    ]);
  }
```

- [ ] **Step 2: 重构 addBuff 方法**

```typescript
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
```

- [ ] **Step 3: 添加堆叠规则应用方法**

```typescript
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
```

- [ ] **Step 4: 实现 clone 方法**

```typescript
  clone(owner: Unit): BuffContainer {
    const clone = new BuffContainer(owner);
    for (const buff of this._buffs.values()) {
      const clonedBuff = buff.clone();
      clone._buffs.set(clonedBuff.id, clonedBuff);
      clonedBuff.onApply(owner);
    }
    return clone;
  }
```

- [ ] **Step 5: 添加 BuffContainer 集成测试**

创建 `tests/integration/TagSystemIntegration.test.ts`:

```typescript
import { Unit } from '../../units/Unit';
import { Buff } from '../../buffs/Buff';
import { BuffType } from '../../core/types';
import { GameplayTags } from '../../core/GameplayTags';
import { BuffAddEvent } from '../../core/events';
import { EventBus } from '../../core/EventBus';
import { EventPriorityLevel } from '../../core/events';

describe('标签系统集成测试', () => {
  describe('BUFF 免疫系统', () => {
    it('免疫标签应拦截 DEBUFF 添加', () => {
      const unit = new Unit('test', '测试', {});
      unit.tags.addTags([GameplayTags.STATUS.IMMUNE_DEBUFF]);

      const debuff = new Buff('poison' as any, '中毒', BuffType.DEBUFF, 3);
      debuff.tags.addTags([GameplayTags.BUFF.TYPE_DEBUFF]);

      const container = unit.buffs;
      container.addBuff(debuff);

      expect(container.getAllBuffIds()).not.toContain('poison');
    });

    it('免疫标签应不影响 BUFF 添加', () => {
      const unit = new Unit('test', '测试', {});
      unit.tags.addTags([GameplayTags.STATUS.IMMUNE_DEBUFF]);

      const buff = new Buff('strength' as any, '力量', BuffType.BUFF, 3);
      buff.tags.addTags([GameplayTags.BUFF.TYPE_BUFF]);

      const container = unit.buffs;
      container.addBuff(buff);

      expect(container.getAllBuffIds()).toContain('strength');
    });

    it('父标签 Immune 应拦截所有 DEBUFF', () => {
      const unit = new Unit('test', '测试', {});
      unit.tags.addTags([GameplayTags.STATUS.IMMUNE]);

      const debuff = new Buff('poison' as any, '中毒', BuffType.DEBUFF, 3);
      debuff.tags.addTags([GameplayTags.BUFF.TYPE_DEBUFF]);

      const container = unit.buffs;
      container.addBuff(debuff);

      expect(container.getAllBuffIds()).not.toContain('poison');
    });
  });

  describe('BUFF 拦截事件', () => {
    it('应发布 BuffAddEvent', () => {
      const unit = new Unit('test', '测试', {});
      const buff = new Buff('test' as any, '测试', BuffType.BUFF, 3);

      let eventReceived = false;
      const handler = () => { eventReceived = true; };
      EventBus.instance.subscribe('BuffAddEvent', handler, EventPriorityLevel.BUFF_INTERCEPT);

      unit.buffs.addBuff(buff);

      expect(eventReceived).toBe(true);
      EventBus.instance.unsubscribe('BuffAddEvent', handler);
    });

    it('取消 BuffAddEvent 应阻止 BUFF 添加', () => {
      const unit = new Unit('test', '测试', {});
      const buff = new Buff('test' as any, '测试', BuffType.BUFF, 3);

      const handler = (e: BuffAddEvent) => { e.isCancelled = true; };
      EventBus.instance.subscribe('BuffAddEvent', handler, EventPriorityLevel.BUFF_INTERCEPT);

      unit.buffs.addBuff(buff);

      expect(unit.buffs.getAllBuffIds()).not.toContain('test');
      EventBus.instance.unsubscribe('BuffAddEvent', handler);
    });
  });

  describe('BUFF 堆叠规则', () => {
    it('REFRESH_DURATION 应刷新持续时间', () => {
      const unit = new Unit('test', '测试', {});
      const buff1 = new Buff('test' as any, '测试', BuffType.BUFF, 3);
      buff1.tags.addTags([GameplayTags.BUFF.TYPE_BUFF]);

      unit.buffs.addBuff(buff1);
      buff1.tickDuration();
      expect(buff1.getDuration()).toBe(2);

      const buff2 = new Buff('test' as any, '测试', BuffType.BUFF, 5);
      buff2.tags.addTags([GameplayTags.BUFF.TYPE_BUFF]);

      unit.buffs.addBuff(buff2);
      expect(buff1.getDuration()).toBe(5); // 刷新到新值
    });

    it('IGNORE 应忽略新 BUFF', () => {
      const unit = new Unit('test', '测试', {});
      const buff1 = new Buff('test' as any, '测试', BuffType.BUFF, 3);
      buff1.stackRule = Buff.StackRule.IGNORE;
      buff1.tags.addTags([GameplayTags.BUFF.TYPE_BUFF]);

      unit.buffs.addBuff(buff1);
      expect(buff1.getDuration()).toBe(3);

      const buff2 = new Buff('test' as any, '测试', BuffType.BUFF, 5);
      buff2.stackRule = Buff.StackRule.IGNORE;
      buff2.tags.addTags([GameplayTags.BUFF.TYPE_BUFF]);

      unit.buffs.addBuff(buff2);
      expect(buff1.getDuration()).toBe(3); // 保持不变
    });
  });
});
```

- [ ] **Step 6: 运行集成测试**

```bash
npm test -- tests/integration/TagSystemIntegration.test.ts
```

- [ ] **Step 7: 提交**

```bash
git add engine/battle-v5/units/BuffContainer.ts
git add engine/battle-v5/tests/integration/TagSystemIntegration.test.ts
git commit -m "feat(tags): refactor BuffContainer with tag-based stacking"
```

---

## Chunk 4: 性能测试与收尾

### Task 7: 添加性能测试

**Files:**
- Create: `engine/battle-v5/tests/performance/TagPerformance.test.ts`

- [ ] **Step 1: 创建性能测试文件**

创建 `tests/performance/TagPerformance.test.ts`:

```typescript
import { GameplayTagContainer } from '../../core/GameplayTags';
import { GameplayTags } from '../../core/GameplayTags';

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

    expect(end - start).toBeLessThan(10);
  });

  it('标签克隆应在合理时间内完成', () => {
    const container = new GameplayTagContainer();
    for (let i = 0; i < 1000; i++) {
      container.addTags([`Tag.${i}.A.B.C`]);
    }

    const start = performance.now();
    const cloned = container.clone();
    const end = performance.now();

    expect(end - start).toBeLessThan(5);
    expect(cloned.getTags().length).toBe(1000);
  });
});
```

- [ ] **Step 2: 运行性能测试**

```bash
npm test -- tests/performance/TagPerformance.test.ts
```

- [ ] **Step 3: 提交**

```bash
git add engine/battle-v5/tests/performance/TagPerformance.test.ts
git commit -m "test(tags): add performance tests for tag system"
```

---

### Task 8: 添加示例技能测试

**Files:**
- Create: `engine/battle-v5/tests/examples/TaggedSkills.test.ts`

- [ ] **Step 1: 创建示例测试**

创建 `tests/examples/TaggedSkills.test.ts`:

```typescript
import { FireballSkill } from '../../abilities/examples/FireballSkill';
import { StrengthBuff } from '../../buffs/examples/StrengthBuff';
import { Unit } from '../../units/Unit';
import { AttributeType } from '../../core/types';
import { GameplayTags } from '../../core/GameplayTags';
import { Buff } from '../../buffs/Buff';

describe('基于标签的技能示例', () => {
  describe('FireballSkill', () => {
    it('应带有正确的标签组合', () => {
      const skill = new FireballSkill();

      expect(skill.tags.hasTag(GameplayTags.ABILITY.TYPE_DAMAGE)).toBe(true);
      expect(skill.tags.hasTag(GameplayTags.ABILITY.TYPE_MAGIC)).toBe(true);
      expect(skill.tags.hasTag(GameplayTags.ABILITY.ELEMENT_FIRE)).toBe(true);
      expect(skill.tags.hasTag(GameplayTags.ABILITY.TARGET_SINGLE)).toBe(true);
    });
  });

  describe('StrengthBuff', () => {
    it('应带有 BUFF 类型和正确的堆叠规则', () => {
      const buff = new StrengthBuff();

      expect(buff.tags.hasTag(GameplayTags.BUFF.TYPE_BUFF)).toBe(true);
      expect(buff.stackRule).toBe(Buff.StackRule.REFRESH_DURATION);
    });

    it('应用后应增加体魄', () => {
      const unit = new Unit('test', '测试', { [AttributeType.PHYSIQUE]: 50 });
      const basePhysique = unit.attributes.getValue(AttributeType.PHYSIQUE);

      const buff = new StrengthBuff();
      unit.buffs.addBuff(buff);

      expect(unit.attributes.getValue(AttributeType.PHYSIQUE)).toBe(basePhysique + 10);
    });

    it('免疫标签应阻止 BUFF 应用', () => {
      const unit = new Unit('test', '测试', { [AttributeType.PHYSIQUE]: 50 });
      unit.tags.addTags([GameplayTags.STATUS.IMMUNE]); // 这不会阻止 BUFF

      const buff = new StrengthBuff();
      unit.buffs.addBuff(buff);

      // StrengthBuff 是 BUFF 不是 DEBUFF，所以应该可以应用
      expect(unit.buffs.getAllBuffIds()).toContain('strength_buff');
    });
  });

  describe('标签驱动的技能交互', () => {
    it('火属性技能应对燃烧目标增伤（模拟）', () => {
      // 这是一个示例，展示如何用标签实现技能交互
      const caster = new Unit('caster', '施法者', { [AttributeType.SPIRIT]: 80 });
      const target = new Unit('target', '目标', {});

      // 模拟目标燃烧状态
      target.tags.addTags(['Status.Burning']);

      const fireball = new FireballSkill();

      // 在实际 DamageSystem 中，会检查技能标签和目标状态标签
      // if (ability.tags.hasTag(GameplayTags.ABILITY.ELEMENT_FIRE) && target.tags.hasTag('Status.Burning')) {
      //   damage *= 1.5;
      // }

      expect(fireball.tags.hasTag(GameplayTags.ABILITY.ELEMENT_FIRE)).toBe(true);
      expect(target.tags.hasTag('Status.Burning')).toBe(true);
    });
  });
});
```

- [ ] **Step 2: 运行测试**

```bash
npm test -- tests/examples/TaggedSkills.test.ts
```

- [ ] **Step 3: 提交**

```bash
git add engine/battle-v5/tests/examples/TaggedSkills.test.ts
git commit -m "test(tags): add example tests for tagged skills"
```

---

### Task 9: 更新 core/index.ts 导出

**Files:**
- Modify: `engine/battle-v5/core/index.ts`

- [ ] **Step 1: 添加标签系统导出**

```typescript
// Core
export { EventBus } from './EventBus';
export { CombatStateMachine, type CombatContext } from './CombatStateMachine';
export * from './types';

// Tags System [新增]
export { GameplayTagContainer, GameplayTags } from './GameplayTags';
```

- [ ] **Step 2: 提交**

```bash
git add engine/battle-v5/core/index.ts
git commit -m "feat(tags): export tag system from core index"
```

---

### Task 10: 全量测试验证

- [ ] **Step 1: 运行所有标签相关测试**

```bash
npm test -- --testPathPattern="GameplayTags|TagSystem|TaggedSkills|TagPerformance"
```

- [ ] **Step 2: 运行全量测试确保没有破坏性变更**

```bash
npm test
```

- [ ] **Step 3: 提交最终版本**

```bash
git add .
git commit -m "feat(tags): complete tag system implementation - all tests passing"
```

---

## 验收标准

- [ ] `GameplayTagContainer` 实现完整，支持父标签匹配
- [ ] `GameplayTags` 常量对象包含所有预定义标签
- [ ] Unit/Ability/Buff 全部集成标签系统
- [ ] BuffContainer 支持基于标签的免疫判定和堆叠规则
- [ ] 所有单元测试通过
- [ ] 所有集成测试通过
- [ ] 性能测试通过（< 1ms 父标签匹配，< 10ms 大量查询）
- [ ] 现有测试全部通过（无破坏性变更）
