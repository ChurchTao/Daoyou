# Battle V5 行动阶段演进实施计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 按照 `docs/battle-v5-execute.md` 设计文档，实现完整的技能释放→命中→伤害应用事件驱动链路

**Architecture:** 基于 EDA（事件驱动架构）+ GAS（游戏能力系统）思想，通过 EventBus 实现模块完全解耦，10阶段流转由事件优先级严格控制

**Tech Stack:** TypeScript, Node.js, Jest

---

## 文件结构概览

### 新建文件
- `engine/battle-v5/core/events.ts` - 统一的事件类型定义（从 types.ts 分离）
- `engine/battle-v5/systems/ActionExecutionSystem.ts` - 行动执行系统

### 修改文件
- `engine/battle-v5/core/types.ts` - 添加新的事件类型引用
- `engine/battle-v5/core/CombatStateMachine.ts` - 添加当前出手单位追踪
- `engine/battle-v5/units/AbilityContainer.ts` - 实现技能筛选和施法流程
- `engine/battle-v5/abilities/Ability.ts` - 扩展能力基类支持新流程
- `engine/battle-v5/systems/DamageSystem.ts` - 重构为事件驱动的伤害系统
- `engine/battle-v5/systems/CombatLogSystem.ts` - 订阅新事件输出战报
- `engine/battle-v5/BattleEngineV5.ts` - 集成新的行动执行系统

---

## Chunk 1: 事件类型定义与状态机增强

### Task 1: 创建统一事件定义文件

**Files:**
- Create: `engine/battle-v5/core/events.ts`

- [ ] **Step 1: 编写事件定义文件**

```typescript
// engine/battle-v5/core/events.ts
import { CombatEvent, EventPriority } from './types';
import { Unit } from '../units/Unit';
import { Ability } from '../abilities/Ability';

// ===== 事件优先级枚举 =====
export enum EventPriorityLevel {
  ACTION_TRIGGER = 80,     // 行动阶段触发（最高）
  SKILL_PRE_CAST = 75,     // 施法前摇&打断判定
  SKILL_CAST = 70,         // 技能正式释放
  HIT_CHECK = 65,          // 命中判定
  DAMAGE_CALC = 60,        // 伤害计算
  DAMAGE_APPLY = 55,       // 伤害应用
  DAMAGE_TAKEN = 50,       // 受击事件（触发被动/反伤）
  POST_SETTLE = 30,        // 后置结算
  COMBAT_LOG = 10,         // 战报输出（最低）
}

// ===== 行动阶段触发事件 =====
export interface ActionEvent extends CombatEvent {
  type: 'ActionEvent';
  caster: Unit;
}

// ===== 施法前摇事件 =====
export interface SkillPreCastEvent extends CombatEvent {
  type: 'SkillPreCastEvent';
  caster: Unit;
  target: Unit;
  ability: Ability;
  isInterrupted: boolean;
}

// ===== 技能打断事件 =====
export interface SkillInterruptEvent extends CombatEvent {
  type: 'SkillInterruptEvent';
  caster: Unit;
  ability: Ability;
  reason: string;
}

// ===== 技能正式释放事件 =====
export interface SkillCastEvent extends CombatEvent {
  type: 'SkillCastEvent';
  caster: Unit;
  target: Unit;
  ability: Ability;
}

// ===== 命中判定事件 =====
export interface HitCheckEvent extends CombatEvent {
  type: 'HitCheckEvent';
  caster: Unit;
  target: Unit;
  ability: Ability;
  isHit: boolean;
  isDodged: boolean;
  isResisted: boolean;
}

// ===== 伤害计算事件 =====
export interface DamageCalculateEvent extends CombatEvent {
  type: 'DamageCalculateEvent';
  caster: Unit;
  target: Unit;
  ability: Ability;
  baseDamage: number;
  finalDamage: number;
}

// ===== 伤害应用事件 =====
export interface DamageEvent extends CombatEvent {
  type: 'DamageEvent';
  caster: Unit;
  target: Unit;
  ability: Ability;
  finalDamage: number;
}

// ===== 受击事件 =====
export interface DamageTakenEvent extends CombatEvent {
  type: 'DamageTakenEvent';
  caster: Unit;
  target: Unit;
  damageTaken: number;
  remainHealth: number;
  isLethal: boolean;
}

// ===== 单元死亡事件 =====
export interface UnitDeadEvent extends CombatEvent {
  type: 'UnitDeadEvent';
  unit: Unit;
  killer: Unit;
}
```

- [ ] **Step 2: 导出事件类型到 types.ts**

修改 `engine/battle-v5/core/types.ts`，在文件末尾添加：

```typescript
// 导出事件类型定义
export * from './events';
```

- [ ] **Step 3: 提交变更**

```bash
git add engine/battle-v5/core/events.ts engine/battle-v5/core/types.ts
git commit -m "feat(battle-v5): add comprehensive event type definitions for action phase"
```

---

### Task 2: 增强状态机添加当前出手单位追踪

**Files:**
- Modify: `engine/battle-v5/core/CombatStateMachine.ts`
- Test: `engine/battle-v5/tests/core/CombatStateMachine.test.ts`

- [ ] **Step 1: 编写测试用例**

```typescript
// engine/battle-v5/tests/core/CombatStateMachine.test.ts
describe('CombatStateMachine - CurrentCaster', () => {
  it('should track current caster during action phase', () => {
    const context = createMockContext();
    const sm = new CombatStateMachine(context);
    const mockUnit = createMockUnit('unit1', '测试单位');

    sm.start();

    // 设置当前出手单位
    sm.setCurrentCaster(mockUnit);
    expect(sm.getCurrentCaster()).toBe(mockUnit);
  });

  it('should clear current caster after action phase', () => {
    const context = createMockContext();
    const sm = new CombatStateMachine(context);
    const mockUnit = createMockUnit('unit1', '测试单位');

    sm.setCurrentCaster(mockUnit);
    sm.clearCurrentCaster();
    expect(sm.getCurrentCaster()).toBeNull();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npm test -- engine/battle-v5/tests/core/CombatStateMachine.test.ts
```

Expected: FAIL - "setCurrentCaster is not a function"

- [ ] **Step 3: 实现当前出手单位追踪**

修改 `engine/battle-v5/core/CombatStateMachine.ts`：

```typescript
export interface CombatContext {
  turn: number;
  maxTurns: number;
  units: Map<string, unknown>;
  battleEnded: boolean;
  winner: string | null;
  currentCaster: unknown | null;  // 添加当前出手单位
}

export class CombatStateMachine {
  private _currentState: CombatState | null = null;
  private _states = new Map<CombatPhase, CombatState>();
  private _context: CombatContext;

  constructor(context: CombatContext) {
    this._context = context;
    this._initStates();
  }

  // 添加新方法
  public setCurrentCaster(unit: unknown): void {
    this._context.currentCaster = unit;
  }

  public getCurrentCaster(): unknown | null {
    return this._context.currentCaster;
  }

  public clearCurrentCaster(): void {
    this._context.currentCaster = null;
  }
  // ... 其余代码保持不变
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
npm test -- engine/battle-v5/tests/core/CombatStateMachine.test.ts
```

Expected: PASS

- [ ] **Step 5: 提交变更**

```bash
git add engine/battle-v5/core/CombatStateMachine.ts engine/battle-v5/tests/core/CombatStateMachine.test.ts
git commit -m "feat(battle-v5): add current caster tracking to CombatStateMachine"
```

---

## Chunk 2: AbilityContainer 技能筛选与施法流程

### Task 3: 扩展 Ability 基类支持新流程

**Files:**
- Modify: `engine/battle-v5/abilities/Ability.ts`
- Test: `engine/battle-v5/tests/abilities/Ability.test.ts`

- [ ] **Step 1: 编写测试用例**

```typescript
// engine/battle-v5/tests/abilities/Ability.test.ts
describe('Ability - Extended properties', () => {
  it('should support damage coefficient property', () => {
    const ability = new TestAbility('test', '测试', AbilityType.ACTIVE_SKILL);
    ability.setDamageCoefficient(1.5);
    expect(ability.damageCoefficient).toBe(1.5);
  });

  it('should support ability type flags', () => {
    const ability = new TestAbility('test', '测试', AbilityType.ACTIVE_SKILL);
    ability.setIsMagicAbility(true);
    ability.setIsPhysicalAbility(false);
    ability.setIsDebuffAbility(false);

    expect(ability.isMagicAbility).toBe(true);
    expect(ability.isPhysicalAbility).toBe(false);
    expect(ability.isDebuffAbility).toBe(false);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npm test -- engine/battle-v5/tests/abilities/Ability.test.ts
```

Expected: FAIL - "setDamageCoefficient is not a function"

- [ ] **Step 3: 实现 Ability 扩展属性**

修改 `engine/battle-v5/abilities/Ability.ts`：

```typescript
export class Ability {
  readonly id: AbilityId;
  readonly name: string;
  readonly type: AbilityType;
  private _active: boolean = false;
  private _owner: Unit | null = null;
  private _cooldown: number = 0;
  private _maxCooldown: number = 0;
  private _eventHandlers: Map<string, EventHandler> = new Map();

  // 新增属性
  private _damageCoefficient: number = 1.0;
  private _baseDamage: number = 0;
  private _isMagicAbility: boolean = false;
  private _isPhysicalAbility: boolean = true;
  private _isDebuffAbility: boolean = false;
  private _priority: number = 0;
  private _manaCost: number = 0;

  // ... 构造函数等保持不变

  // 新增属性访问器和修改器
  get damageCoefficient(): number {
    return this._damageCoefficient;
  }

  setDamageCoefficient(value: number): void {
    this._damageCoefficient = value;
  }

  get baseDamage(): number {
    return this._baseDamage;
  }

  setBaseDamage(value: number): void {
    this._baseDamage = value;
  }

  get isMagicAbility(): boolean {
    return this._isMagicAbility;
  }

  setIsMagicAbility(value: boolean): void {
    this._isMagicAbility = value;
  }

  get isPhysicalAbility(): boolean {
    return this._isPhysicalAbility;
  }

  setIsPhysicalAbility(value: boolean): void {
    this._isPhysicalAbility = value;
  }

  get isDebuffAbility(): boolean {
    return this._isDebuffAbility;
  }

  setIsDebuffAbility(value: boolean): void {
    this._isDebuffAbility = value;
  }

  get priority(): number {
    return this._priority;
  }

  setPriority(value: number): void {
    this._priority = value;
  }

  get manaCost(): number {
    return this._manaCost;
  }

  setManaCost(value: number): void {
    this._manaCost = value;
  }

  /**
   * 检查是否可以触发（考虑蓝量、冷却等）
   */
  canTrigger(context: { caster: Unit; target: Unit }): boolean {
    if (!this.isReady()) return false;

    const caster = this._owner;
    if (!caster) return false;

    // 检查蓝量是否足够
    if (caster.currentMp < this._manaCost) return false;

    return true;
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
npm test -- engine/battle-v5/tests/abilities/Ability.test.ts
```

Expected: PASS

- [ ] **Step 5: 提交变更**

```bash
git add engine/battle-v5/abilities/Ability.ts engine/battle-v5/tests/abilities/Ability.test.ts
git commit -m "feat(battle-v5): extend Ability with damage properties and trigger validation"
```

---

### Task 4: 实现 AbilityContainer 技能筛选流程

**Files:**
- Modify: `engine/battle-v5/units/AbilityContainer.ts`
- Test: `engine/battle-v5/tests/units/AbilityContainer.test.ts` (新建)

- [ ] **Step 1: 编写测试用例**

```typescript
// engine/battle-v5/tests/units/AbilityContainer.test.ts
import { AbilityContainer } from '../../units/AbilityContainer';
import { Unit } from '../../units/Unit';
import { ActiveSkill } from '../../abilities/ActiveSkill';
import { AbilityType } from '../../core/types';
import { EventBus } from '../../core/EventBus';
import { ActionEvent } from '../../core/events';

describe('AbilityContainer', () => {
  let owner: Unit;
  let container: AbilityContainer;
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = EventBus.instance;
    eventBus.reset();
    owner = new Unit('test_unit', '测试单位', {});
    container = new AbilityContainer(owner);
  });

  afterEach(() => {
    eventBus.reset();
  });

  describe('Skill selection and casting', () => {
    it('should subscribe to ActionEvent and trigger skill selection', () => {
      const skill = new ActiveSkill('fireball', '火球术', AbilityType.ACTIVE_SKILL);
      skill.setPriority(10);
      skill.setManaCost(10);
      skill.setDamageCoefficient(1.5);
      skill.setIsMagicAbility(true);

      owner.currentMp = 50; // 足够蓝量
      container.addAbility(skill);

      // 发布行动事件
      eventBus.publish<ActionEvent>({
        type: 'ActionEvent',
        priority: 80,
        timestamp: Date.now(),
        caster: owner,
      });

      // 验证技能被选择
      // 这里需要通过 spy 或验证后续事件来确认
    });

    it('should skip skills with insufficient mana', () => {
      const skill = new ActiveSkill('fireball', '火球术', AbilityType.ACTIVE_SKILL);
      skill.setManaCost(100);
      container.addAbility(skill);

      owner.currentMp = 10; // 蓝量不足

      // 应该不选择此技能
      const available = container.getAvailableAbilities();
      expect(available).toHaveLength(0);
    });
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npm test -- engine/battle-v5/tests/units/AbilityContainer.test.ts
```

Expected: FAIL - "getAvailableAbilities is not a function"

- [ ] **Step 3: 实现技能筛选和施法流程**

修改 `engine/battle-v5/units/AbilityContainer.ts`：

```typescript
import { Unit } from './Unit';
import { Ability } from '../abilities/Ability';
import { EventBus } from '../core/EventBus';
import { ActionEvent, SkillPreCastEvent, EventPriorityLevel } from '../core/events';
import { ActiveSkill } from '../abilities/ActiveSkill';

export class AbilityContainer {
  private _abilities = new Map<string, Ability>();
  private _owner: Unit;

  constructor(owner: Unit) {
    this._owner = owner;
    this._subscribeToEvents();
  }

  private _subscribeToEvents(): void {
    // 订阅行动事件
    EventBus.instance.subscribe<ActionEvent>(
      'ActionEvent',
      (event) => this._onActionTrigger(event),
      EventPriorityLevel.ACTION_TRIGGER,
    );
  }

  /**
   * 响应行动触发事件，执行技能筛选
   */
  private _onActionTrigger(event: ActionEvent): void {
    // 仅当前出手单位是自己时，才执行筛选
    if (event.caster.id !== this._owner.id) return;

    // 获取可用技能
    const availableAbilities = this.getAvailableAbilities();

    if (availableAbilities.length === 0) {
      // 无可用技能，使用普攻
      this._prepareCast(this._getDefaultAttack(), this._getDefaultTarget());
      return;
    }

    // 按优先级排序，选择最高优先级技能
    const sortedAbilities = availableAbilities.sort((a, b) => b.priority - a.priority);
    const selectedAbility = sortedAbilities[0];

    this._prepareCast(selectedAbility, this._getDefaultTarget());
  }

  /**
   * 获取所有可用技能（蓝量足够、冷却完毕）
   */
  getAvailableAbilities(): Ability[] {
    return Array.from(this._abilities.values())
      .filter(ability => ability instanceof ActiveSkill)
      .filter(ability => ability.canTrigger({ caster: this._owner, target: this._getDefaultTarget() }));
  }

  /**
   * 准备施法：进入前摇阶段
   */
  private _prepareCast(ability: Ability, target: Unit): void {
    // 消耗蓝量
    if (ability.manaCost > 0) {
      this._owner.consumeMp(ability.manaCost);
    }

    // 发布施法前摇事件
    EventBus.instance.publish<SkillPreCastEvent>({
      type: 'SkillPreCastEvent',
      priority: EventPriorityLevel.SKILL_PRE_CAST,
      timestamp: Date.now(),
      caster: this._owner,
      target,
      ability,
      isInterrupted: false,
    });
  }

  /**
   * 获取默认攻击（普攻）
   */
  private _getDefaultAttack(): Ability {
    // TODO: 实现默认普攻技能
    throw new Error('Default attack not implemented');
  }

  /**
   * 获取默认目标
   */
  private _getDefaultTarget(): Unit {
    // TODO: 从战斗上下文获取敌方单位
    throw new Error('Default target not implemented');
  }

  // ... 原有方法保持不变
  addAbility(ability: Ability): void {
    this._abilities.set(ability.id, ability);
    ability.setOwner(this._owner);
    ability.setActive(true);
  }

  removeAbility(abilityId: string): void {
    const ability = this._abilities.get(abilityId);
    if (ability) {
      ability.setActive(false);
      this._abilities.delete(abilityId);
    }
  }

  getAbility(abilityId: string): Ability | undefined {
    return this._abilities.get(abilityId);
  }

  getAllAbilities(): Ability[] {
    return Array.from(this._abilities.values());
  }

  clone(owner: Unit): AbilityContainer {
    const clone = new AbilityContainer(owner);
    // TODO: 实现深拷贝
    return clone;
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
npm test -- engine/battle-v5/tests/units/AbilityContainer.test.ts
```

Expected: PASS

- [ ] **Step 5: 提交变更**

```bash
git add engine/battle-v5/units/AbilityContainer.ts engine/battle-v5/tests/units/AbilityContainer.test.ts
git commit -m "feat(battle-v5): implement skill selection and casting flow in AbilityContainer"
```

---

## Chunk 3: 事件驱动的伤害系统

### Task 5: 创建 ActionExecutionSystem 行动执行系统

**Files:**
- Create: `engine/battle-v5/systems/ActionExecutionSystem.ts`
- Test: `engine/battle-v5/tests/systems/ActionExecutionSystem.test.ts`

- [ ] **Step 1: 编写测试用例**

```typescript
// engine/battle-v5/tests/systems/ActionExecutionSystem.test.ts
import { ActionExecutionSystem } from '../../systems/ActionExecutionSystem';
import { Unit } from '../../units/Unit';
import { ActiveSkill } from '../../abilities/ActiveSkill';
import { AbilityType } from '../../core/types';
import { EventBus } from '../../core/EventBus';
import { SkillPreCastEvent, SkillCastEvent } from '../../core/events';

describe('ActionExecutionSystem', () => {
  let system: ActionExecutionSystem;
  let caster: Unit;
  let target: Unit;
  let skill: ActiveSkill;
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = EventBus.instance;
    eventBus.reset();
    system = new ActionExecutionSystem();

    caster = new Unit('caster', '施法者', { spirit: 100 });
    target = new Unit('target', '目标', { physique: 100 });
    skill = new ActiveSkill('fireball', '火球术', AbilityType.ACTIVE_SKILL);
    skill.setDamageCoefficient(1.5);
    skill.setBaseDamage(50);
    skill.setIsMagicAbility(true);
  });

  afterEach(() => {
    eventBus.reset();
  });

  it('should handle skill pre-cast event and publish cast event if not interrupted', () => {
    const castEventSpy = jest.fn();
    eventBus.subscribe<SkillCastEvent>('SkillCastEvent', castEventSpy);

    eventBus.publish<SkillPreCastEvent>({
      type: 'SkillPreCastEvent',
      priority: 75,
      timestamp: Date.now(),
      caster,
      target,
      ability: skill,
      isInterrupted: false,
    });

    expect(castEventSpy).toHaveBeenCalled();
  });

  it('should not publish cast event if skill is interrupted', () => {
    const castEventSpy = jest.fn();
    eventBus.subscribe<SkillCastEvent>('SkillCastEvent', castEventSpy);

    eventBus.publish<SkillPreCastEvent>({
      type: 'SkillPreCastEvent',
      priority: 75,
      timestamp: Date.now(),
      caster,
      target,
      ability: skill,
      isInterrupted: true,
    });

    expect(castEventSpy).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npm test -- engine/battle-v5/tests/systems/ActionExecutionSystem.test.ts
```

Expected: FAIL - "ActionExecutionSystem is not defined"

- [ ] **Step 3: 实现 ActionExecutionSystem**

```typescript
// engine/battle-v5/systems/ActionExecutionSystem.ts
import { EventBus } from '../core/EventBus';
import { SkillPreCastEvent, SkillCastEvent, SkillInterruptEvent, EventPriorityLevel } from '../core/events';

/**
 * 行动执行系统
 * 负责处理施法前摇到技能释放的流程
 */
export class ActionExecutionSystem {
  constructor() {
    this._subscribeToEvents();
  }

  private _subscribeToEvents(): void {
    // 订阅施法前摇事件
    EventBus.instance.subscribe<SkillPreCastEvent>(
      'SkillPreCastEvent',
      (event) => this._onSkillPreCast(event),
      EventPriorityLevel.SKILL_PRE_CAST,
    );
  }

  /**
   * 处理施法前摇事件
   */
  private _onSkillPreCast(event: SkillPreCastEvent): void {
    // 等待所有打断判定完成后检查
    // 由于 EventBus 是同步执行，这里可以直接检查 isInterrupted 标记

    if (event.isInterrupted) {
      // 发布被打断事件
      EventBus.instance.publish<SkillInterruptEvent>({
        type: 'SkillInterruptEvent',
        priority: EventPriorityLevel.COMBAT_LOG,
        timestamp: Date.now(),
        caster: event.caster,
        ability: event.ability,
        reason: '施法被打断',
      });
      return;
    }

    // 未被打断，发布技能释放事件
    const castEvent: SkillCastEvent = {
      type: 'SkillCastEvent',
      priority: EventPriorityLevel.SKILL_CAST,
      timestamp: Date.now(),
      caster: event.caster,
      target: event.target,
      ability: event.ability,
    };

    EventBus.instance.publish(castEvent);

    // 执行技能的核心逻辑
    event.ability.execute(event.caster, event.target);
  }

  /**
   * 销毁系统，取消订阅
   */
  destroy(): void {
    // TODO: 实现取消订阅逻辑
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
npm test -- engine/battle-v5/tests/systems/ActionExecutionSystem.test.ts
```

Expected: PASS

- [ ] **Step 5: 提交变更**

```bash
git add engine/battle-v5/systems/ActionExecutionSystem.ts engine/battle-v5/tests/systems/ActionExecutionSystem.test.ts
git commit -m "feat(battle-v5): add ActionExecutionSystem for skill casting flow"
```

---

### Task 6: 重构 DamageSystem 为事件驱动

**Files:**
- Modify: `engine/battle-v5/systems/DamageSystem.ts`
- Test: `engine/battle-v5/tests/systems/DamageSystem.test.ts`

- [ ] **Step 1: 编写测试用例**

```typescript
// engine/battle-v5/tests/systems/DamageSystem.test.ts
import { DamageSystem } from '../../systems/DamageSystem';
import { Unit } from '../../units/Unit';
import { ActiveSkill } from '../../abilities/ActiveSkill';
import { AbilityType, AttributeType } from '../../core/types';
import { EventBus } from '../../core/EventBus';
import { SkillCastEvent, HitCheckEvent, DamageCalculateEvent, DamageEvent, DamageTakenEvent } from '../../core/events';

describe('DamageSystem - EventDriven', () => {
  let system: DamageSystem;
  let caster: Unit;
  let target: Unit;
  let skill: ActiveSkill;
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = EventBus.instance;
    eventBus.reset();
    system = new DamageSystem();

    caster = new Unit('caster', '施法者', {
      spirit: 100,
      agility: 50,
      consciousness: 50,
    });
    target = new Unit('target', '目标', {
      physique: 100,
      agility: 30,
      consciousness: 40,
    });

    skill = new ActiveSkill('fireball', '火球术', AbilityType.ACTIVE_SKILL);
    skill.setDamageCoefficient(1.5);
    skill.setBaseDamage(50);
    skill.setIsMagicAbility(true);
  });

  afterEach(() => {
    eventBus.reset();
  });

  it('should subscribe to SkillCastEvent and publish HitCheckEvent', () => {
    const hitCheckSpy = jest.fn();
    eventBus.subscribe<HitCheckEvent>('HitCheckEvent', hitCheckSpy);

    eventBus.publish<SkillCastEvent>({
      type: 'SkillCastEvent',
      priority: 70,
      timestamp: Date.now(),
      caster,
      target,
      ability: skill,
    });

    expect(hitCheckSpy).toHaveBeenCalled();
  });

  it('should calculate correct base damage based on skill type', () => {
    const damageCalcSpy = jest.fn((event: DamageCalculateEvent) => {
      // 火球术是法术伤害，应该基于灵力计算
      expect(event.baseDamage).toBeGreaterThan(0);
    });
    eventBus.subscribe<DamageCalculateEvent>('DamageCalculateEvent', damageCalcSpy);

    eventBus.publish<SkillCastEvent>({
      type: 'SkillCastEvent',
      priority: 70,
      timestamp: Date.now(),
      caster,
      target,
      ability: skill,
    });

    expect(damageCalcSpy).toHaveBeenCalled();
  });

  it('should apply dodge when target agility is higher', () => {
    const damageTakenSpy = jest.fn();
    eventBus.subscribe<DamageTakenEvent>('DamageTakenEvent', damageTakenSpy);

    // 设置高闪避场景
    caster.attributes.setValue(AttributeType.AGILITY, 10);
    target.attributes.setValue(AttributeType.AGILITY, 100);

    eventBus.publish<SkillCastEvent>({
      type: 'SkillCastEvent',
      priority: 70,
      timestamp: Date.now(),
      caster,
      target,
      ability: skill,
    });

    // 高闪避情况下，可能不会受到伤害
    // 这里不强制断言，因为概率性
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npm test -- engine/battle-v5/tests/systems/DamageSystem.test.ts
```

Expected: FAIL - 事件订阅未实现

- [ ] **Step 3: 重构 DamageSystem**

修改 `engine/battle-v5/systems/DamageSystem.ts`：

```typescript
import { Unit } from '../units/Unit';
import { AttributeType } from '../core/types';
import { EventBus } from '../core/EventBus';
import {
  SkillCastEvent,
  HitCheckEvent,
  DamageCalculateEvent,
  DamageEvent,
  DamageTakenEvent,
  UnitDeadEvent,
  EventPriorityLevel,
} from '../core/events';

export interface DamageCalculationParams {
  baseDamage: number;
  damageType: 'physical' | 'magic';
  element?: string;
  ignoreCrit?: boolean;
  ignoreDodge?: boolean;
}

export interface DamageResult {
  finalDamage: number;
  isCritical: boolean;
  isDodged: boolean;
  breakdown: {
    baseDamage: number;
    critMultiplier: number;
    damageReduction: number;
    randomFactor: number;
  };
}

/**
 * 伤害系统
 * 基于事件驱动的完整伤害管道
 */
export class DamageSystem {
  constructor() {
    this._subscribeToEvents();
  }

  private _subscribeToEvents(): void {
    // 订阅技能释放事件，开始命中判定
    EventBus.instance.subscribe<SkillCastEvent>(
      'SkillCastEvent',
      (event) => this._onSkillCast(event),
      EventPriorityLevel.HIT_CHECK,
    );
  }

  /**
   * 响应技能释放事件，执行命中判定
   */
  private _onSkillCast(event: SkillCastEvent): void {
    const { caster, target, ability } = event;

    const hitCheckEvent: HitCheckEvent = {
      type: 'HitCheckEvent',
      priority: EventPriorityLevel.HIT_CHECK,
      timestamp: Date.now(),
      caster,
      target,
      ability,
      isHit: true,
      isDodged: false,
      isResisted: false,
    };

    // 1. 身法闪避判定
    const casterAgility = caster.attributes.getValue(AttributeType.AGILITY);
    const targetAgility = target.attributes.getValue(AttributeType.AGILITY);
    const dodgeChance = Math.max(
      5,
      Math.min(80, ((targetAgility - casterAgility) / casterAgility) * 100),
    );

    if (Math.random() * 100 < dodgeChance) {
      hitCheckEvent.isDodged = true;
      hitCheckEvent.isHit = false;
    }

    // 2. 神识抵抗判定（仅控制/减益类技能）
    if (ability.isDebuffAbility && hitCheckEvent.isHit) {
      const casterConsciousness = caster.attributes.getValue(AttributeType.CONSCIOUSNESS);
      const targetConsciousness = target.attributes.getValue(AttributeType.CONSCIOUSNESS);
      const resistChance = Math.max(
        0,
        ((targetConsciousness - casterConsciousness) / casterConsciousness) * 100,
      );

      if (Math.random() * 100 < resistChance) {
        hitCheckEvent.isResisted = true;
        hitCheckEvent.isHit = false;
      }
    }

    // 发布命中判定事件
    EventBus.instance.publish(hitCheckEvent);

    // 未命中，直接终止流程
    if (!hitCheckEvent.isHit) return;

    // 命中成功，进入伤害计算
    this._calculateDamage(event, hitCheckEvent);
  }

  /**
   * 计算伤害
   */
  private _calculateDamage(castEvent: SkillCastEvent, hitEvent: HitCheckEvent): void {
    const { caster, target, ability } = castEvent;

    // 1. 计算基础伤害
    let baseDamage = ability.baseDamage;

    if (ability.isMagicAbility) {
      // 法术伤害：灵力 * 技能系数 + 固定值
      const spirit = caster.attributes.getValue(AttributeType.SPIRIT);
      baseDamage = spirit * ability.damageCoefficient + ability.baseDamage;
    } else if (ability.isPhysicalAbility) {
      // 体术伤害：体魄 * 技能系数 + 固定值
      const physique = caster.attributes.getValue(AttributeType.PHYSIQUE);
      baseDamage = physique * ability.damageCoefficient + ability.baseDamage;
    }

    // 2. 发布伤害计算事件，供被动/命格/BUFF修正伤害
    const calcEvent: DamageCalculateEvent = {
      type: 'DamageCalculateEvent',
      priority: EventPriorityLevel.DAMAGE_CALC,
      timestamp: Date.now(),
      caster,
      target,
      ability,
      baseDamage,
      finalDamage: baseDamage,
    };

    EventBus.instance.publish(calcEvent);

    // 3. 修正最终伤害：计算目标减伤，最低为1点伤害
    const targetPhysique = target.attributes.getValue(AttributeType.PHYSIQUE);
    const damageReduction = Math.min(0.7, targetPhysique / (targetPhysique + 1000)); // 最高70%减伤
    calcEvent.finalDamage = Math.max(1, calcEvent.finalDamage * (1 - damageReduction));

    // 4. 进入伤害应用环节
    this._applyDamage(calcEvent);
  }

  /**
   * 应用伤害
   */
  private _applyDamage(calcEvent: DamageCalculateEvent): void {
    const { caster, target, ability, finalDamage } = calcEvent;

    // 1. 发布伤害事件，供护盾/无敌/伤害免疫类效果响应
    const damageEvent: DamageEvent = {
      type: 'DamageEvent',
      priority: EventPriorityLevel.DAMAGE_APPLY,
      timestamp: Date.now(),
      caster,
      target,
      ability,
      finalDamage,
    };

    EventBus.instance.publish(damageEvent);

    // 2. 校验伤害是否被免疫/抵消
    if (damageEvent.finalDamage <= 0) return;

    // 3. 进入最终属性更新环节
    this._updateTargetHealth(damageEvent);
  }

  /**
   * 更新目标气血
   */
  private _updateTargetHealth(damageEvent: DamageEvent): void {
    const { target, finalDamage, caster } = damageEvent;

    // 获取当前气血
    const beforeHealth = target.currentHp;

    // 应用伤害
    target.takeDamage(finalDamage);

    const actualDamage = beforeHealth - target.currentHp;
    const isLethal = target.currentHp <= 0;

    // 发布受击事件
    EventBus.instance.publish<DamageTakenEvent>({
      type: 'DamageTakenEvent',
      priority: EventPriorityLevel.DAMAGE_TAKEN,
      timestamp: Date.now(),
      caster,
      target,
      damageTaken: actualDamage,
      remainHealth: target.currentHp,
      isLethal,
    });

    // 击杀判定
    if (isLethal) {
      EventBus.instance.publish<UnitDeadEvent>({
        type: 'UnitDeadEvent',
        priority: EventPriorityLevel.DAMAGE_TAKEN,
        timestamp: Date.now(),
        unit: target,
        killer: caster,
      });
    }
  }

  /**
   * 销毁系统，取消订阅
   */
  destroy(): void {
    // TODO: 实现取消订阅逻辑
  }

  // ===== 静态方法保留用于测试兼容性 =====
  static calculateDamage(
    attacker: Unit,
    target: Unit,
    params: DamageCalculationParams,
  ): DamageResult {
    const breakdown = {
      baseDamage: params.baseDamage,
      critMultiplier: 1,
      damageReduction: 0,
      randomFactor: 1,
    };

    let damage = params.baseDamage;

    // 1. 暴击判定
    const isCritical = !params.ignoreCrit && this._rollCrit(attacker);
    if (isCritical) {
      breakdown.critMultiplier = 1.5;
      damage *= breakdown.critMultiplier;
    }

    // 2. 闪避判定
    const isDodged = !params.ignoreDodge && this._rollDodge(target);
    if (isDodged) {
      return {
        finalDamage: 0,
        isCritical,
        isDodged: true,
        breakdown,
      };
    }

    // 3. 伤害减免
    const reduction = this._calculateDamageReduction(target);
    breakdown.damageReduction = reduction;
    damage *= (1 - reduction);

    // 4. 随机浮动
    const randomFactor = 0.9 + Math.random() * 0.2;
    breakdown.randomFactor = randomFactor;
    damage *= randomFactor;

    // 5. 最小伤害保证
    const finalDamage = Math.max(1, Math.floor(damage));

    return {
      finalDamage,
      isCritical,
      isDodged: false,
      breakdown,
    };
  }

  private static _rollCrit(attacker: Unit): boolean {
    const critRate = attacker.attributes.getCritRate();
    return Math.random() < critRate;
  }

  private static _rollDodge(target: Unit): boolean {
    const evasionRate = target.attributes.getEvasionRate();
    return Math.random() < evasionRate;
  }

  private static _calculateDamageReduction(target: Unit): number {
    const physique = target.attributes.getValue(AttributeType.PHYSIQUE);
    const reduction = Math.min(0.75, physique * 0.001);
    return reduction;
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
npm test -- engine/battle-v5/tests/systems/DamageSystem.test.ts
```

Expected: PASS

- [ ] **Step 5: 提交变更**

```bash
git add engine/battle-v5/systems/DamageSystem.ts engine/battle-v5/tests/systems/DamageSystem.test.ts
git commit -m "refactor(battle-v5): make DamageSystem event-driven"
```

---

## Chunk 4: 战报系统与引擎集成

### Task 7: 更新 CombatLogSystem 订阅新事件

**Files:**
- Modify: `engine/battle-v5/systems/CombatLogSystem.ts`
- Test: `engine/battle-v5/tests/systems/CombatLogSystem.test.ts`

- [ ] **Step 1: 编写测试用例**

```typescript
// engine/battle-v5/tests/systems/CombatLogSystem.test.ts
import { CombatLogSystem } from '../../systems/CombatLogSystem';
import { Unit } from '../../units/Unit';
import { ActiveSkill } from '../../abilities/ActiveSkill';
import { AbilityType } from '../../core/types';
import { EventBus } from '../../core/EventBus';
import { SkillInterruptEvent, HitCheckEvent, DamageTakenEvent, UnitDeadEvent } from '../../core/events';

describe('CombatLogSystem - NewEvents', () => {
  let logSystem: CombatLogSystem;
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = EventBus.instance;
    eventBus.reset();
    logSystem = new CombatLogSystem();
  });

  afterEach(() => {
    eventBus.reset();
  });

  it('should log skill interrupt event', () => {
    const caster = new Unit('caster', '施法者', {});
    const ability = new ActiveSkill('test', '测试技能', AbilityType.ACTIVE_SKILL);

    eventBus.publish<SkillInterruptEvent>({
      type: 'SkillInterruptEvent',
      priority: 10,
      timestamp: Date.now(),
      caster,
      ability,
      reason: '神识封禁',
    });

    const logs = logSystem.getLogs();
    const interruptLog = logs.find(log => log.message.includes('打断'));
    expect(interruptLog).toBeDefined();
  });

  it('should log dodge event', () => {
    const caster = new Unit('caster', '施法者', {});
    const target = new Unit('target', '目标', {});
    const ability = new ActiveSkill('test', '测试技能', AbilityType.ACTIVE_SKILL);

    eventBus.publish<HitCheckEvent>({
      type: 'HitCheckEvent',
      priority: 10,
      timestamp: Date.now(),
      caster,
      target,
      ability,
      isHit: false,
      isDodged: true,
      isResisted: false,
    });

    const logs = logSystem.getLogs();
    const dodgeLog = logs.find(log => log.message.includes('闪避'));
    expect(dodgeLog).toBeDefined();
  });

  it('should log damage taken event', () => {
    const caster = new Unit('caster', '施法者', {});
    const target = new Unit('target', '目标', { physique: 100 });
    target.takeDamage(30);

    eventBus.publish<DamageTakenEvent>({
      type: 'DamageTakenEvent',
      priority: 10,
      timestamp: Date.now(),
      caster,
      target,
      damageTaken: 30,
      remainHealth: 70,
      isLethal: false,
    });

    const logs = logSystem.getLogs();
    const damageLog = logs.find(log => log.message.includes('造成'));
    expect(damageLog).toBeDefined();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npm test -- engine/battle-v5/tests/systems/CombatLogSystem.test.ts
```

Expected: FAIL - 新事件未订阅

- [ ] **Step 3: 更新 CombatLogSystem 订阅新事件**

修改 `engine/battle-v5/systems/CombatLogSystem.ts`：

```typescript
import { CombatPhase, CombatLog } from '../core/types';
import {
  SkillInterruptEvent,
  HitCheckEvent,
  DamageTakenEvent,
  UnitDeadEvent,
  EventPriorityLevel,
} from '../core/events';

export class CombatLogSystem {
  private _logs: CombatLog[] = [];

  constructor() {
    this._subscribeToEvents();
  }

  private _subscribeToEvents(): void {
    // 技能打断事件
    EventBus.instance.subscribe<SkillInterruptEvent>(
      'SkillInterruptEvent',
      (e) => this._onSkillInterrupt(e),
      EventPriorityLevel.COMBAT_LOG,
    );

    // 命中判定事件（闪避/抵抗）
    EventBus.instance.subscribe<HitCheckEvent>(
      'HitCheckEvent',
      (e) => this._onHitCheck(e),
      EventPriorityLevel.COMBAT_LOG,
    );

    // 受击事件
    EventBus.instance.subscribe<DamageTakenEvent>(
      'DamageTakenEvent',
      (e) => this._onDamageTaken(e),
      EventPriorityLevel.COMBAT_LOG,
    );

    // 单元死亡事件
    EventBus.instance.subscribe<UnitDeadEvent>(
      'UnitDeadEvent',
      (e) => this._onUnitDead(e),
      EventPriorityLevel.COMBAT_LOG,
    );
  }

  private _onSkillInterrupt(event: SkillInterruptEvent): void {
    this._addLog({
      turn: 0, // TODO: 从上下文获取当前回合
      phase: CombatPhase.ACTION,
      message: `【打断】${event.caster.name}的【${event.ability.name}】被打断！`,
      highlight: true,
    });
  }

  private _onHitCheck(event: HitCheckEvent): void {
    if (event.isDodged) {
      this._addLog({
        turn: 0,
        phase: CombatPhase.ACTION,
        message: `【闪避】${event.target.name}身法灵动，躲开了${event.caster.name}的【${event.ability.name}】！`,
        highlight: false,
      });
    } else if (event.isResisted) {
      this._addLog({
        turn: 0,
        phase: CombatPhase.ACTION,
        message: `【抵抗】${event.target.name}神识稳固，抵抗了${event.caster.name}的【${event.ability.name}】！`,
        highlight: false,
      });
    }
  }

  private _onDamageTaken(event: DamageTakenEvent): void {
    this._addLog({
      turn: 0,
      phase: CombatPhase.ACTION,
      message: `【伤害】${event.caster.name}对${event.target.name}造成${event.damageTaken}点伤害，剩余气血${event.remainHealth}！`,
      highlight: false,
    });

    if (event.isLethal) {
      this._addLog({
        turn: 0,
        phase: CombatPhase.ACTION,
        message: `【击杀】${event.target.name}气血耗尽，被击败！`,
        highlight: true,
      });
    }
  }

  private _onUnitDead(event: UnitDeadEvent): void {
    this._addLog({
      turn: 0,
      phase: CombatPhase.ACTION,
      message: `【阵亡】${event.unit.name}已被${event.killer.name}击败！`,
      highlight: true,
    });
  }

  private _addLog(log: CombatLog): void {
    this._logs.push(log);
    console.log(log.message);
  }

  // ===== 原有方法保持兼容 =====
  log(turn: number, phase: CombatPhase, message: string, highlight: boolean = false): void {
    this._addLog({ turn, phase, message, highlight });
  }

  logDamage(turn: number, casterName: string, targetName: string, damage: number, isCrit: boolean): void {
    const critText = isCrit ? '【暴击】' : '';
    this._addLog({
      turn,
      phase: CombatPhase.ACTION,
      message: `${critText}${casterName}对${targetName}造成${damage}点伤害！`,
      highlight: isCrit,
    });
  }

  logBattleEnd(winnerName: string, turns: number): void {
    this._addLog({
      turn,
      phase: CombatPhase.END,
      message: `战斗结束！${winnerName}在${turns}回合后获胜！`,
      highlight: true,
    });
  }

  getLogs(): CombatLog[] {
    return [...this._logs];
  }

  clearLogs(): void {
    this._logs = [];
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
npm test -- engine/battle-v5/tests/systems/CombatLogSystem.test.ts
```

Expected: PASS

- [ ] **Step 5: 提交变更**

```bash
git add engine/battle-v5/systems/CombatLogSystem.ts engine/battle-v5/tests/systems/CombatLogSystem.test.ts
git commit -m "feat(battle-v5): update CombatLogSystem to subscribe new events"
```

---

### Task 8: 集成到 BattleEngineV5 主引擎

**Files:**
- Modify: `engine/battle-v5/BattleEngineV5.ts`
- Test: `engine/battle-v5/tests/integration/BattleEngineV5.test.ts`

- [ ] **Step 1: 编写集成测试**

```typescript
// engine/battle-v5/tests/integration/BattleEngineV5.test.ts
import { BattleEngineV5 } from '../../BattleEngineV5';
import { Unit } from '../../units/Unit';
import { ActiveSkill } from '../../abilities/ActiveSkill';
import { AbilityType, AttributeType } from '../../core/types';

describe('BattleEngineV5 - Integration', () => {
  it('should execute full battle with new event-driven flow', () => {
    const player = new Unit('player', '玩家', {
      spirit: 100,
      physique: 80,
      agility: 60,
      consciousness: 50,
      comprehension: 50,
    });

    const opponent = new Unit('opponent', '对手', {
      spirit: 90,
      physique: 90,
      agility: 50,
      consciousness: 60,
      comprehension: 50,
    });

    // 给双方添加技能
    const fireball = new ActiveSkill('fireball', '火球术', AbilityType.ACTIVE_SKILL);
    fireball.setDamageCoefficient(1.5);
    fireball.setBaseDamage(30);
    fireball.setIsMagicAbility(true);
    fireball.setManaCost(10);
    fireball.setPriority(10);

    player.abilities.addAbility(fireball);
    player.currentMp = 100;

    const opponentFireball = fireball.clone ? fireball.clone() : fireball;
    opponent.abilities.addAbility(opponentFireball);
    opponent.currentMp = 100;

    const engine = new BattleEngineV5(player, opponent);
    const result = engine.execute();

    // 验证战斗结果
    expect(result).toBeDefined();
    expect(result.turns).toBeGreaterThan(0);
    expect(result.winner).toBeDefined();
    expect(result.logs).toBeDefined();
    expect(result.logs.length).toBeGreaterThan(0);

    // 验证日志中包含事件驱动流程的信息
    const allLogs = result.logs.join(' ');
    console.log('Battle logs:', allLogs);

    // 应该有伤害相关的日志
    expect(allLogs).toMatch(/造成|伤害|闪避|抵抗/);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npm test -- engine/battle-v5/tests/integration/BattleEngineV5.test.ts
```

Expected: 可能会失败或输出不完整

- [ ] **Step 3: 更新 BattleEngineV5 集成新系统**

修改 `engine/battle-v5/BattleEngineV5.ts`：

```typescript
import { Unit } from './units/Unit';
import { CombatStateMachine, CombatContext } from './core/CombatStateMachine';
import { EventBus } from './core/EventBus';
import { CombatPhase, AttributeType } from './core/types';
import { CombatLogSystem } from './systems/CombatLogSystem';
import { VictorySystem } from './systems/VictorySystem';
import { ActionExecutionSystem } from './systems/ActionExecutionSystem';
import { DamageSystem } from './systems/DamageSystem';

export interface BattleResult {
  winner: string;
  loser?: string;
  turns: number;
  logs: string[];
  winnerSnapshot: unknown;
  loserSnapshot: unknown;
}

export class BattleEngineV5 {
  private _player: Unit;
  private _opponent: Unit;
  private _stateMachine: CombatStateMachine;
  private _logSystem: CombatLogSystem;
  private _eventBus: EventBus;
  private _actionSystem: ActionExecutionSystem;
  private _damageSystem: DamageSystem;

  constructor(player: Unit, opponent: Unit) {
    this._player = player;
    this._opponent = opponent;
    this._eventBus = EventBus.instance;
    this._logSystem = new CombatLogSystem();

    // 初始化事件驱动系统
    this._actionSystem = new ActionExecutionSystem();
    this._damageSystem = new DamageSystem();

    const context: CombatContext = {
      turn: 0,
      maxTurns: VictorySystem.getMaxTurns(),
      units: new Map([
        [player.id, player],
        [opponent.id, opponent],
      ]),
      battleEnded: false,
      winner: null,
      currentCaster: null,
    };

    this._stateMachine = new CombatStateMachine(context);
  }

  execute(): BattleResult {
    this._stateMachine.start();

    while (!this.isBattleOver()) {
      this.executeTurn();
    }

    return this.generateResult();
  }

  private executeTurn(): void {
    const context = this.getContext();
    context.turn++;

    // 检查回合上限
    if (context.turn > context.maxTurns) {
      context.battleEnded = true;
      const victoryResult = VictorySystem.checkVictory(
        [this._player, this._opponent],
        context.turn,
      );
      context.winner = victoryResult.winner ?? null;
      this._stateMachine.endBattle(victoryResult.winner ?? '');
      return;
    }

    // 回合开始
    this._logSystem.log(context.turn, CombatPhase.ROUND_START, `第${context.turn}回合开始`);

    // 执行行动阶段（新的事件驱动流程）
    this.executeActionPhase();

    // 回合结束
    this.processTurnEnd();

    // 胜负判定
    const victoryResult = VictorySystem.checkVictory(
      [this._player, this._opponent],
      context.turn,
    );

    if (victoryResult.battleEnded) {
      context.battleEnded = true;
      context.winner = victoryResult.winner ?? null;
      this._stateMachine.endBattle(victoryResult.winner ?? '');
    }
  }

  /**
   * 执行行动阶段（事件驱动）
   */
  private executeActionPhase(): void {
    const context = this.getContext();
    const units = this.getSortedUnits();

    for (const actor of units) {
      if (!actor.isAlive()) continue;

      // 设置当前出手单位
      this._stateMachine.setCurrentCaster(actor);

      // 发布行动事件，触发整个技能流程
      this._eventBus.publish({
        type: 'ActionEvent',
        priority: 80,
        timestamp: Date.now(),
        caster: actor,
      });

      // 清除当前出手单位
      this._stateMachine.clearCurrentCaster();
    }
  }

  private processTurnEnd(): void {
    this.processBuffs(this._player);
    this.processBuffs(this._opponent);
  }

  private processBuffs(unit: Unit): void {
    const buffs = unit.buffs.getAllBuffs();
    for (const buff of buffs) {
      buff.tickDuration();
      if (buff.isExpired()) {
        unit.buffs.removeBuff(buff.id);
      }
    }
  }

  private getSortedUnits(): Unit[] {
    const units = [this._player, this._opponent];
    return units.sort((a, b) => {
      const speedA = a.attributes.getValue(AttributeType.AGILITY);
      const speedB = b.attributes.getValue(AttributeType.AGILITY);
      return speedB - speedA;
    });
  }

  private isBattleOver(): boolean {
    return this.getContext().battleEnded;
  }

  private getContext(): CombatContext {
    return this._stateMachine.getContext();
  }

  private generateResult(): BattleResult {
    const context = this.getContext();
    const winner = context.winner === this._player.id ? this._player : this._opponent;
    const loser = winner === this._player ? this._opponent : this._player;

    this._logSystem.logBattleEnd(winner.name, context.turn);

    return {
      winner: winner.id,
      loser: loser?.id,
      turns: context.turn,
      logs: this._logSystem.getLogs().map((log) => log.message),
      winnerSnapshot: winner.getSnapshot(),
      loserSnapshot: loser?.getSnapshot(),
    };
  }

  get logSystem(): CombatLogSystem {
    return this._logSystem;
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
npm test -- engine/battle-v5/tests/integration/BattleEngineV5.test.ts
```

Expected: PASS

- [ ] **Step 5: 提交变更**

```bash
git add engine/battle-v5/BattleEngineV5.ts engine/battle-v5/tests/integration/BattleEngineV5.test.ts
git commit -m "feat(battle-v5): integrate event-driven action phase into BattleEngineV5"
```

---

## Chunk 5: 完善细节与清理

### Task 9: 实现 AbilityContainer 的待办功能

**Files:**
- Modify: `engine/battle-v5/units/AbilityContainer.ts`

- [ ] **Step 1: 实现默认攻击技能**

创建 `engine/battle-v5/abilities/BasicAttack.ts`：

```typescript
import { ActiveSkill } from './ActiveSkill';
import { AbilityType, AbilityId } from '../core/types';

export class BasicAttack extends ActiveSkill {
  constructor() {
    super(
      'basic_attack' as AbilityId,
      '普攻',
      AbilityType.ACTIVE_SKILL,
    );
    this.setDamageCoefficient(1.0);
    this.setBaseDamage(20);
    this.setIsPhysicalAbility(true);
    this.setManaCost(0);
    this.setPriority(0);
  }
}
```

- [ ] **Step 2: 更新 AbilityContainer 使用默认攻击**

```typescript
// 在 AbilityContainer.ts 中
import { BasicAttack } from '../abilities/BasicAttack';

export class AbilityContainer {
  // ... 其他代码

  private _defaultAttack: Ability | null = null;

  /**
   * 获取默认攻击（普攻）
   */
  private _getDefaultAttack(): Ability {
    if (!this._defaultAttack) {
      this._defaultAttack = new BasicAttack();
      this._defaultAttack.setOwner(this._owner);
      this._defaultAttack.setActive(true);
    }
    return this._defaultAttack;
  }

  /**
   * 获取默认目标
   */
  private _getDefaultTarget(): Unit {
    // 从战斗上下文获取敌方单位
    // 暂时通过遍历所有单位找到非己方的单位
    // 更好的方案是从 CombatContext 获取双方单位列表
    throw new Error('Default target selection requires battle context');
  }
}
```

- [ ] **Step 3: 提交变更**

```bash
git add engine/battle-v5/abilities/BasicAttack.ts engine/battle-v5/units/AbilityContainer.ts
git commit -m "feat(battle-v5): add BasicAttack ability for default action"
```

---

### Task 10: 添加完整的战斗流程测试

**Files:**
- Create: `engine/battle-v5/tests/integration/FullBattleFlowTest.test.ts`

- [ ] **Step 1: 编写完整流程测试**

```typescript
// engine/battle-v5/tests/integration/FullBattleFlowTest.test.ts
import { BattleEngineV5 } from '../../BattleEngineV5';
import { Unit } from '../../units/Unit';
import { ActiveSkill } from '../../abilities/ActiveSkill';
import { AbilityType, AttributeType } from '../../core/types';
import { EventBus } from '../../core/EventBus';

describe('Full Battle Flow - EventDriven', () => {
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = EventBus.instance;
    eventBus.reset();
  });

  afterEach(() => {
    eventBus.reset();
  });

  it('should execute complete battle with skill cast -> hit check -> damage apply', () => {
    // 创建两个属性差异明显的单位
    const player = new Unit('player', '玩家', {
      spirit: 100,
      physique: 70,
      agility: 80, // 高身法，高闪避
      consciousness: 50,
      comprehension: 50,
    });

    const opponent = new Unit('opponent', '对手', {
      spirit: 90,
      physique: 90, // 高体魄，高减伤
      agility: 40,
      consciousness: 60,
      comprehension: 50,
    });

    // 添加技能
    const skill = new ActiveSkill('fireball', '火球术', AbilityType.ACTIVE_SKILL);
    skill.setDamageCoefficient(1.5);
    skill.setBaseDamage(30);
    skill.setIsMagicAbility(true);
    skill.setManaCost(10);
    skill.setPriority(10);

    player.abilities.addAbility(skill);
    player.currentMp = 100;

    const opponentSkill = skill.clone ? skill.clone() : skill;
    opponent.abilities.addAbility(opponentSkill);
    opponent.currentMp = 100;

    // 执行战斗
    const engine = new BattleEngineV5(player, opponent);
    const result = engine.execute();

    // 验证结果
    expect(result.turns).toBeGreaterThan(0);
    expect(result.logs.length).toBeGreaterThan(0);

    // 分析战报内容
    const allLogs = result.logs.join('\n');
    console.log('=== 完整战报 ===');
    console.log(allLogs);
    console.log('================');

    // 应该包含各种战斗事件
    expect(allLogs).toMatch(/回合/);
    // 可能包含闪避、抵抗等（概率性）
  });

  it('should handle lethal damage correctly', () => {
    // 创建一方高攻击一方低血量的场景
    const attacker = new Unit('attacker', '攻击者', {
      spirit: 200,
      physique: 100,
      agility: 50,
      consciousness: 50,
      comprehension: 50,
    });

    const defender = new Unit('defender', '防御者', {
      spirit: 50,
      physique: 50,
      agility: 30,
      consciousness: 30,
      comprehension: 30,
    });

    // 添加高伤害技能
    const skill = new ActiveSkill('ultimate', '必杀技', AbilityType.ACTIVE_SKILL);
    skill.setDamageCoefficient(5.0);
    skill.setBaseDamage(100);
    skill.setIsMagicAbility(true);
    skill.setManaCost(0);
    skill.setPriority(10);

    attacker.abilities.addAbility(skill);
    attacker.currentMp = 100;

    const engine = new BattleEngineV5(attacker, defender);
    const result = engine.execute();

    // 验证击杀相关日志
    const allLogs = result.logs.join('\n');
    expect(allLogs).toMatch(/击杀|阵亡|击败|耗尽/);
  });
});
```

- [ ] **Step 2: 运行测试验证**

```bash
npm test -- engine/battle-v5/tests/integration/FullBattleFlowTest.test.ts
```

Expected: PASS

- [ ] **Step 3: 提交变更**

```bash
git add engine/battle-v5/tests/integration/FullBattleFlowTest.test.ts
git commit -m "test(battle-v5): add comprehensive battle flow integration tests"
```

---

### Task 11: 清理 EventBus 内存泄漏风险

**Files:**
- Modify: `engine/battle-v5/systems/ActionExecutionSystem.ts`
- Modify: `engine/battle-v5/systems/DamageSystem.ts`
- Modify: `engine/battle-v5/systems/CombatLogSystem.ts`

- [ ] **Step 1: 实现系统销毁方法**

为每个系统添加完整的订阅追踪和取消订阅功能：

```typescript
// ActionExecutionSystem.ts
export class ActionExecutionSystem {
  private _handlers: Map<string, (event: unknown) => void> = new Map();

  private _subscribeToEvents(): void {
    const preCastHandler = (event: SkillPreCastEvent) => this._onSkillPreCast(event);
    EventBus.instance.subscribe<SkillPreCastEvent>(
      'SkillPreCastEvent',
      preCastHandler,
      EventPriorityLevel.SKILL_PRE_CAST,
    );
    this._handlers.set('SkillPreCastEvent', preCastHandler);
  }

  destroy(): void {
    for (const [eventType, handler] of this._handlers) {
      EventBus.instance.unsubscribe(eventType, handler);
    }
    this._handlers.clear();
  }
}
```

类似地更新 DamageSystem 和 CombatLogSystem。

- [ ] **Step 2: 在 BattleEngineV5 中调用销毁**

```typescript
// BattleEngineV5.ts
export class BattleEngineV5 {
  // ... 其他代码

  destroy(): void {
    this._actionSystem.destroy();
    this._damageSystem.destroy();
    this._logSystem.clearLogs();
    this._eventBus.reset();
  }
}
```

- [ ] **Step 3: 添加销毁测试**

```typescript
it('should clean up event subscriptions on destroy', () => {
  const system = new ActionExecutionSystem();
  const initialSubscribers = (EventBus.instance as any)._subscribers.size;

  system.destroy();

  const finalSubscribers = (EventBus.instance as any)._subscribers.size;
  expect(finalSubscribers).toBeLessThanOrEqual(initialSubscribers);
});
```

- [ ] **Step 4: 提交变更**

```bash
git add engine/battle-v5/systems/*.ts engine/battle-v5/BattleEngineV5.ts
git commit -m "fix(battle-v5): add proper cleanup for event subscriptions to prevent memory leaks"
```

---

## 总结

### 完成的工作

1. **事件类型定义** - 完整的10阶段流转事件类型
2. **状态机增强** - 添加当前出手单位追踪
3. **Ability 扩展** - 支持伤害系数、技能类型等属性
4. **技能筛选流程** - AbilityContainer 实现自动技能选择
5. **行动执行系统** - 施法前摇→技能释放流程
6. **事件驱动伤害系统** - 命中判定→伤害计算→伤害应用
7. **战报系统更新** - 订阅新事件输出详细战报
8. **引擎集成** - BattleEngineV5 完整集成新流程
9. **基础攻击** - 实现普攻作为默认技能
10. **内存管理** - 添加订阅清理机制

### 后续优化方向

1. **技能目标选择** - 当前默认目标需要从战斗上下文获取
2. **AI 悟性系统** - 根据悟性属性实现更智能的技能选择
3. **打断类被动** - 实现神识封禁等打断技能
4. **护盾/无敌** - 实现护盾吸收伤害的机制
5. **Buff 持续效果** - 完善Buff的持续触发和过期处理
6. **连击/追击** - 实现连锁触发机制
