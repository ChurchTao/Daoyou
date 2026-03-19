# Ability 架构重构实施计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 重构 Ability 相关代码，使其符合 GAS+EDA 设计原则，解决基类职责过重、测试 hooks 破坏设计、生命周期不清晰、目标选择简陋等问题。

**Architecture:** 采用 GAS (Gameplay Ability System) 设计原则，将 Ability 基类精简为核心功能，主动技能和被动技能分别扩展各自专属属性。引入 TargetPolicy 设计解决目标选择问题。

**Tech Stack:** TypeScript, Jest, EventBus (EDA)

---

## 文件结构

```
engine/battle-v5/
├── abilities/
│   ├── Ability.ts              # [修改] 精简基类，移除主动技能专属字段
│   ├── ActiveSkill.ts          # [修改] 添加冷却、消耗、伤害相关字段
│   ├── PassiveAbility.ts       # [修改] 优化生命周期
│   ├── TargetPolicy.ts         # [新建] 目标策略定义
│   └── BasicAttack.ts          # [检查] 确保符合新架构
├── units/
│   └── AbilityContainer.ts     # [修改] 简化职责，移除目标选择逻辑
├── systems/
│   ├── ActionExecutionSystem.ts # [修改] 重命名为 AbilityExecutionSystem
│   ├── TargetSelectionSystem.ts # [新建] 目标选择系统
│   └── SkillSelectionSystem.ts  # [新建] 技能筛选系统
└── core/
    └── types.ts                # [修改] 添加 TargetPolicy 相关类型
```

---

## Chunk 1: Ability 基类重构（P0）

### Task 1.1: 移除 Ability 基类中的主动技能专属字段

**Files:**
- Modify: `engine/battle-v5/abilities/Ability.ts`

- [ ] **Step 1: 读取当前 Ability.ts 内容**

- [ ] **Step 2: 重构 Ability 基类**

```typescript
import { AbilityId, AbilityType, CombatEvent } from '../core/types';

export type { AbilityId };
import { Unit } from '../units/Unit';
import { EventBus } from '../core/EventBus';
import { GameplayTagContainer } from '../core/GameplayTags';

type EventHandler = (event: CombatEvent) => void;

/**
 * 能力上下文 - 传递给 canTrigger 和 execute 的参数
 */
export interface AbilityContext {
  caster: Unit;
  target: Unit;
}

/**
 * Ability 基类 - 遵循 GAS 设计原则
 *
 * 职责：
 * - 定义能力的核心接口（canTrigger, execute）
 * - 管理标签系统（用于条件判断和解耦）
 * - 提供事件订阅辅助方法
 *
 * 生命周期：
 * 1. 创建 → constructor()
 * 2. 绑定所有者 → setOwner()
 * 3. 激活 → setActive(true) → 调用 onActivate()
 * 4. 执行 → canTrigger() 检查 → execute() 执行
 * 5. 停用 → setActive(false) → 调用 onDeactivate()
 * 6. 销毁 → destroy()
 *
 * 子类职责：
 * - ActiveSkill: 添加冷却、消耗、目标策略
 * - PassiveAbility: 订阅事件，响应触发
 */
export class Ability {
  readonly id: AbilityId;
  readonly name: string;
  readonly type: AbilityType;

  // 核心属性
  private _owner: Unit | null = null;
  private _active: boolean = false;
  private _priority: number = 0;  // 执行优先级（数值越大越优先）

  // 标签容器
  readonly tags: GameplayTagContainer;

  // 事件订阅管理
  private _eventSubscriptions: Map<string, EventHandler> = new Map();

  constructor(id: AbilityId, name: string, type: AbilityType) {
    this.id = id;
    this.name = name;
    this.type = type;
    this.tags = new GameplayTagContainer();
  }

  // ===== 所有者管理 =====

  setOwner(owner: Unit): void {
    this._owner = owner;
  }

  getOwner(): Unit | null {
    return this._owner;
  }

  // ===== 激活状态管理 =====

  setActive(active: boolean): void {
    if (this._active === active) return;

    this._active = active;

    if (active) {
      this.onActivate();
    } else {
      this.onDeactivate();
    }
  }

  isActive(): boolean {
    return this._active;
  }

  // ===== 生命周期钩子（子类可重写） =====

  /**
   * 激活时调用
   * 子类可重写此方法进行初始化（如订阅事件）
   */
  protected onActivate(): void {
    // 默认空实现，子类可重写
  }

  /**
   * 停用时调用
   * 子类可重写此方法进行清理（如取消订阅）
   * 注意：基类会自动取消所有通过 subscribeEvent 订阅的事件
   */
  protected onDeactivate(): void {
    // 自动取消所有事件订阅
    for (const [eventType, handler] of this._eventSubscriptions) {
      EventBus.instance.unsubscribe(eventType, handler);
    }
    this._eventSubscriptions.clear();
  }

  // ===== 事件订阅辅助 =====

  /**
   * 订阅事件（会在停用时自动取消）
   */
  protected subscribeEvent(
    eventType: string,
    handler: EventHandler,
    priority?: number
  ): void {
    EventBus.instance.subscribe(eventType, handler, priority);
    this._eventSubscriptions.set(eventType, handler);
  }

  // ===== 核心方法（子类必须实现或重写） =====

  /**
   * 检查是否可以触发
   * @param context 包含 caster 和 target 的上下文
   * @returns 是否可以执行
   */
  canTrigger(context: AbilityContext): boolean {
    const owner = this._owner ?? context.caster;
    if (!owner) return false;
    return true;
  }

  /**
   * 执行能力效果
   * @param context 包含 caster 和 target 的上下文
   */
  execute(context: AbilityContext): void {
    // 基类空实现，子类重写
  }

  // ===== 优先级 =====

  get priority(): number {
    return this._priority;
  }

  setPriority(value: number): void {
    this._priority = value;
  }

  // ===== 克隆 =====

  /**
   * 克隆能力实例
   * 注意：不复制 owner 和 active 状态
   */
  clone(): Ability {
    const cloned = new Ability(this.id, this.name, this.type);
    cloned._priority = this._priority;
    cloned.tags.addTags(this.tags.getTags());
    return cloned;
  }

  // ===== 销毁 =====

  /**
   * 销毁能力，释放资源
   */
  destroy(): void {
    this.setActive(false);
    this._owner = null;
  }
}
```

- [ ] **Step 3: 更新导出的 AbilityContext 类型**

在 `engine/battle-v5/core/types.ts` 中添加：

```typescript
// 在文件末尾添加
export interface AbilityContext {
  caster: import('../units/Unit').Unit;
  target: import('../units/Unit').Unit;
}
```

- [ ] **Step 4: 运行测试验证**

Run: `npm test -- --testPathPattern="battle-v5" --passWithNoTests`

Expected: 现有测试应该失败（因为 API 变化），记录失败信息

- [ ] **Step 5: Commit**

```bash
git add engine/battle-v5/abilities/Ability.ts engine/battle-v5/core/types.ts
git commit -m "refactor(ability): 精简 Ability 基类，移除主动技能专属字段

- 移除 _damageCoefficient, _baseDamage, _manaCost 字段
- 移除 public onActivate/onDeactivate 测试 hooks
- 添加 AbilityContext 接口
- 完善生命周期文档"
```

---

### Task 1.2: 重构 ActiveSkill 类

**Files:**
- Modify: `engine/battle-v5/abilities/ActiveSkill.ts`
- Create: `engine/battle-v5/abilities/TargetPolicy.ts`

- [ ] **Step 1: 创建 TargetPolicy 类型定义**

```typescript
// engine/battle-v5/abilities/TargetPolicy.ts

import { Unit } from '../units/Unit';

/**
 * 目标类型
 */
export type TargetTeam = 'enemy' | 'ally' | 'any' | 'self';

/**
 * 目标范围
 */
export type TargetScope = 'single' | 'aoe' | 'random';

/**
 * 目标过滤器
 */
export type TargetFilter =
  | 'lowest_hp'      // 血量最低
  | 'highest_hp'     // 血量最高
  | 'lowest_mp'      // 蓝量最低
  | 'fastest'        // 速度最快
  | 'slowest'        // 速度最慢
  | 'nearest'        // 距离最近
  | 'furthest';      // 距离最远

/**
 * 目标策略配置
 */
export interface TargetPolicyConfig {
  team: TargetTeam;
  scope: TargetScope;
  filters?: TargetFilter[];
  maxTargets?: number;  // AOE 时最多目标数
}

/**
 * 目标策略类
 * 定义技能如何选择目标
 */
export class TargetPolicy {
  readonly team: TargetTeam;
  readonly scope: TargetScope;
  readonly filters: TargetFilter[];
  readonly maxTargets: number;

  constructor(config: TargetPolicyConfig) {
    this.team = config.team;
    this.scope = config.scope;
    this.filters = config.filters ?? [];
    this.maxTargets = config.maxTargets ?? 1;
  }

  /**
   * 默认目标策略：单体敌方
   */
  static default(): TargetPolicy {
    return new TargetPolicy({
      team: 'enemy',
      scope: 'single',
    });
  }

  /**
   * 自身目标策略
   */
  static self(): TargetPolicy {
    return new TargetPolicy({
      team: 'self',
      scope: 'single',
    });
  }

  /**
   * AOE 敌方策略
   */
  static aoeEnemy(maxTargets: number = 5): TargetPolicy {
    return new TargetPolicy({
      team: 'enemy',
      scope: 'aoe',
      maxTargets,
    });
  }
}
```

- [ ] **Step 2: 重构 ActiveSkill 类**

```typescript
// engine/battle-v5/abilities/ActiveSkill.ts

import { AbilityId, AbilityType } from '../core/types';
import { Unit } from '../units/Unit';
import { Ability, AbilityContext } from './Ability';
import { TargetPolicy } from './TargetPolicy';

/**
 * 资源消耗配置
 */
export interface ResourceCost {
  type: 'mp' | 'hp' | 'rage' | 'energy';
  amount: number;
}

/**
 * 主动技能配置
 */
export interface ActiveSkillConfig {
  mpCost?: number;
  hpCost?: number;
  cooldown?: number;
  priority?: number;
  targetPolicy?: TargetPolicy;
}

/**
 * 主动技能基类
 *
 * 职责：
 * - 管理冷却时间
 * - 管理资源消耗
 * - 定义目标策略
 * - 提供伤害计算基础属性
 */
export abstract class ActiveSkill extends Ability {
  // 冷却管理
  private _cooldown: number = 0;
  private _maxCooldown: number = 0;

  // 资源消耗
  private _resourceCosts: ResourceCost[] = [];

  // 伤害属性
  private _baseDamage: number = 0;
  private _damageCoefficient: number = 1.0;

  // 目标策略
  readonly targetPolicy: TargetPolicy;

  constructor(
    id: AbilityId,
    name: string,
    config: ActiveSkillConfig = {}
  ) {
    super(id, name, AbilityType.ACTIVE_SKILL);

    // 初始化冷却
    this._maxCooldown = config.cooldown ?? 0;

    // 初始化资源消耗
    if (config.mpCost) {
      this._resourceCosts.push({ type: 'mp', amount: config.mpCost });
    }
    if (config.hpCost) {
      this._resourceCosts.push({ type: 'hp', amount: config.hpCost });
    }

    // 初始化优先级
    if (config.priority !== undefined) {
      this.setPriority(config.priority);
    }

    // 初始化目标策略
    this.targetPolicy = config.targetPolicy ?? TargetPolicy.default();
  }

  // ===== 冷却管理 =====

  get maxCooldown(): number {
    return this._maxCooldown;
  }

  get currentCooldown(): number {
    return this._cooldown;
  }

  isReady(): boolean {
    return this._cooldown === 0;
  }

  startCooldown(): void {
    this._cooldown = this._maxCooldown;
  }

  tickCooldown(): void {
    if (this._cooldown > 0) {
      this._cooldown--;
    }
  }

  resetCooldown(): void {
    this._cooldown = 0;
  }

  // ===== 资源消耗 =====

  get resourceCosts(): ResourceCost[] {
    return [...this._resourceCosts];
  }

  /**
   * 检查是否有足够资源
   */
  hasEnoughResources(caster: Unit): boolean {
    for (const cost of this._resourceCosts) {
      switch (cost.type) {
        case 'mp':
          if (caster.currentMp < cost.amount) return false;
          break;
        case 'hp':
          if (caster.currentHp <= cost.amount) return false;
          break;
      }
    }
    return true;
  }

  /**
   * 消耗资源
   */
  consumeResources(caster: Unit): void {
    for (const cost of this._resourceCosts) {
      switch (cost.type) {
        case 'mp':
          caster.consumeMp(cost.amount);
          break;
        case 'hp':
          caster.takeDamage(cost.amount);
          break;
      }
    }
  }

  // ===== 伤害属性 =====

  get baseDamage(): number {
    return this._baseDamage;
  }

  setBaseDamage(value: number): void {
    this._baseDamage = value;
  }

  get damageCoefficient(): number {
    return this._damageCoefficient;
  }

  setDamageCoefficient(value: number): void {
    this._damageCoefficient = value;
  }

  // ===== 核心方法重写 =====

  /**
   * 检查是否可以触发
   * 包含冷却检查和资源检查
   */
  override canTrigger(context: AbilityContext): boolean {
    // 基类检查
    if (!super.canTrigger(context)) return false;

    // 冷却检查
    if (!this.isReady()) return false;

    // 资源检查
    const caster = this.getOwner() ?? context.caster;
    if (!this.hasEnoughResources(caster)) return false;

    return true;
  }

  /**
   * 执行技能
   * 负责资源消耗、冷却启动、效果执行
   */
  override execute(context: AbilityContext): void {
    // 消耗资源
    this.consumeResources(context.caster);

    // 启动冷却
    this.startCooldown();

    // 执行技能效果（子类实现）
    this.executeSkill(context.caster, context.target);
  }

  /**
   * 子类实现具体技能效果
   */
  protected abstract executeSkill(caster: Unit, target: Unit): void;

  // ===== 克隆 =====

  override clone(): ActiveSkill {
    const cloned = super.clone() as ActiveSkill;
    cloned._maxCooldown = this._maxCooldown;
    cloned._baseDamage = this._baseDamage;
    cloned._damageCoefficient = this._damageCoefficient;
    cloned._resourceCosts = [...this._resourceCosts];
    return cloned;
  }
}
```

- [ ] **Step 3: 更新 BasicAttack 符合新架构**

读取 `engine/battle-v5/abilities/BasicAttack.ts` 并更新

- [ ] **Step 4: 运行测试验证**

Run: `npm test -- --testPathPattern="battle-v5" --passWithNoTests`

- [ ] **Step 5: Commit**

```bash
git add engine/battle-v5/abilities/
git commit -m "refactor(ability): 重构 ActiveSkill，添加 TargetPolicy

- 新增 TargetPolicy 目标策略类
- 新增 ResourceCost 资源消耗配置
- 将伤害属性从基类移至 ActiveSkill
- 完善冷却和资源检查逻辑"
```

---

### Task 1.3: 重构 PassiveAbility 类

**Files:**
- Modify: `engine/battle-v5/abilities/PassiveAbility.ts`

- [ ] **Step 1: 重构 PassiveAbility 类**

```typescript
// engine/battle-v5/abilities/PassiveAbility.ts

import { Ability } from './Ability';
import { AbilityId, AbilityType, CombatEvent } from '../core/types';
import { AbilityContext } from './Ability';

/**
 * 被动能力基类
 *
 * 特点：
 * - 无冷却、无消耗
 * - 通过事件触发（而非主动释放）
 * - 在激活时自动订阅事件
 *
 * 生命周期：
 * 1. 创建 → constructor()
 * 2. 绑定所有者 → setOwner()
 * 3. 激活 → setActive(true) → setupEventListeners()
 * 4. 触发 → 事件驱动，通过 createEventHandler 包装
 * 5. 停用 → setActive(false) → 自动取消订阅
 */
export abstract class PassiveAbility extends Ability {
  constructor(id: AbilityId, name: string) {
    super(id, name, AbilityType.PASSIVE_SKILL);
  }

  // ===== 生命周期 =====

  protected override onActivate(): void {
    super.onActivate();
    this.setupEventListeners();
  }

  /**
   * 子类实现：设置事件监听
   *
   * 示例：
   * ```ts
   * protected setupEventListeners(): void {
   *   this.subscribeEvent(
   *     'DamageTakenEvent',
   *     this.createEventHandler((e) => this.onDamageTaken(e))
   *   );
   * }
   * ```
   */
  protected abstract setupEventListeners(): void;

  // ===== 事件处理辅助 =====

  /**
   * 创建事件处理包装器
   * 自动检查所有者是否存活
   */
  protected createEventHandler<T extends CombatEvent>(
    handler: (event: T) => void
  ): (event: T) => void {
    return (event: T) => {
      const owner = this.getOwner();
      if (!owner || !owner.isAlive()) return;
      handler(event);
    };
  }

  // ===== 核心方法（被动技能通常不通过 execute 执行） =====

  /**
   * 被动技能永远可以触发（由事件驱动）
   */
  override canTrigger(_context: AbilityContext): boolean {
    return true;
  }

  /**
   * 被动技能通常不通过 execute 执行
   * 而是通过事件订阅直接响应
   */
  override execute(_context: AbilityContext): void {
    // 默认空实现
  }

  // ===== 克隆 =====

  override clone(): PassiveAbility {
    const cloned = super.clone() as PassiveAbility;
    return cloned;
  }
}
```

- [ ] **Step 2: 运行测试验证**

Run: `npm test -- --testPathPattern="battle-v5" --passWithNoTests`

- [ ] **Step 3: Commit**

```bash
git add engine/battle-v5/abilities/PassiveAbility.ts
git commit -m "refactor(ability): 优化 PassiveAbility 生命周期

- 完善生命周期文档
- 优化 createEventHandler 泛型支持
- 明确被动技能通过事件驱动而非 execute"
```

---

## Chunk 2: 系统职责重构（P2）

### Task 2.1: 创建 TargetSelectionSystem

**Files:**
- Create: `engine/battle-v5/systems/TargetSelectionSystem.ts`
- Modify: `engine/battle-v5/units/AbilityContainer.ts`

- [ ] **Step 1: 创建 TargetSelectionSystem**

```typescript
// engine/battle-v5/systems/TargetSelectionSystem.ts

import { EventBus } from '../core/EventBus';
import { EventPriorityLevel, SkillSelectedEvent } from '../core/events';
import { Unit } from '../units/Unit';
import { TargetPolicy, TargetFilter } from '../abilities/TargetPolicy';

/**
 * TargetSelectionSystem - 目标选择系统
 *
 * EDA 架构设计：
 * - 订阅 SkillSelectedEvent
 * - 根据 TargetPolicy 选择目标
 * - 发布 TargetSelectedEvent
 */
export class TargetSelectionSystem {
  private _handlers: Map<string, (event: unknown) => void> = new Map();

  constructor() {
    this._subscribeToEvents();
  }

  private _subscribeToEvents(): void {
    // TODO: 订阅 SkillSelectedEvent
    // const handler = (event: SkillSelectedEvent) => this._onSkillSelected(event);
    // EventBus.instance.subscribe('SkillSelectedEvent', handler, EventPriorityLevel.ACTION_TRIGGER);
    // this._handlers.set('SkillSelectedEvent', handler);
  }

  /**
   * 选择目标
   * @param caster 施法者
   * @param policy 目标策略
   * @param allUnits 所有战斗单位
   * @returns 选中的目标列表
   */
  selectTargets(
    caster: Unit,
    policy: TargetPolicy,
    allUnits: Unit[]
  ): Unit[] {
    // 1. 根据队伍筛选
    let candidates = this._filterByTeam(caster, policy.team, allUnits);

    // 2. 过滤死亡单位
    candidates = candidates.filter(u => u.isAlive());

    // 3. 应用过滤器
    candidates = this._applyFilters(candidates, policy.filters);

    // 4. 根据范围选择
    return this._selectByScope(candidates, policy.scope, policy.maxTargets);
  }

  private _filterByTeam(
    caster: Unit,
    team: TargetPolicy['team'],
    allUnits: Unit[]
  ): Unit[] {
    switch (team) {
      case 'self':
        return [caster];
      case 'enemy':
        return allUnits.filter(u => u.id !== caster.id);
      case 'ally':
        return allUnits.filter(u => u.id === caster.id);
      case 'any':
        return allUnits;
      default:
        return allUnits;
    }
  }

  private _applyFilters(units: Unit[], filters: TargetFilter[]): Unit[] {
    if (filters.length === 0) return units;

    let result = [...units];

    for (const filter of filters) {
      result = this._applyFilter(result, filter);
    }

    return result;
  }

  private _applyFilter(units: Unit[], filter: TargetFilter): Unit[] {
    if (units.length === 0) return units;

    switch (filter) {
      case 'lowest_hp':
        return [units.reduce((min, u) =>
          u.currentHp < min.currentHp ? u : min
        )];
      case 'highest_hp':
        return [units.reduce((max, u) =>
          u.currentHp > max.currentHp ? u : max
        )];
      case 'lowest_mp':
        return [units.reduce((min, u) =>
          u.currentMp < min.currentMp ? u : min
        )];
      case 'fastest':
        return [units.reduce((max, u) =>
          u.attributes.getValue('agility' as any) >
          max.attributes.getValue('agility' as any) ? u : max
        )];
      case 'slowest':
        return [units.reduce((min, u) =>
          u.attributes.getValue('agility' as any) <
          min.attributes.getValue('agility' as any) ? u : min
        )];
      default:
        return units;
    }
  }

  private _selectByScope(
    units: Unit[],
    scope: TargetPolicy['scope'],
    maxTargets: number
  ): Unit[] {
    switch (scope) {
      case 'single':
        return units.slice(0, 1);
      case 'random':
        const shuffled = [...units].sort(() => Math.random() - 0.5);
        return shuffled.slice(0, 1);
      case 'aoe':
        return units.slice(0, maxTargets);
      default:
        return units.slice(0, 1);
    }
  }

  /**
   * 销毁系统
   */
  destroy(): void {
    for (const [eventType, handler] of this._handlers) {
      EventBus.instance.unsubscribe(eventType, handler);
    }
    this._handlers.clear();
  }
}
```

- [ ] **Step 2: 运行测试验证**

Run: `npm test -- --testPathPattern="battle-v5" --passWithNoTests`

- [ ] **Step 3: Commit**

```bash
git add engine/battle-v5/systems/TargetSelectionSystem.ts
git commit -m "feat(battle-v5): 添加 TargetSelectionSystem 目标选择系统

- 根据 TargetPolicy 选择目标
- 支持队伍筛选、过滤器、范围选择"
```

---

### Task 2.2: 简化 AbilityContainer 职责

**Files:**
- Modify: `engine/battle-v5/units/AbilityContainer.ts`

- [ ] **Step 1: 简化 AbilityContainer**

移除目标选择逻辑，只保留技能存储和筛选：

```typescript
// engine/battle-v5/units/AbilityContainer.ts

import { Unit } from './Unit';
import { Ability, AbilityContext } from '../abilities/Ability';
import { EventBus } from '../core/EventBus';
import { ActionEvent, SkillPreCastEvent, EventPriorityLevel } from '../core/events';
import { ActiveSkill } from '../abilities/ActiveSkill';
import { BasicAttack } from '../abilities/BasicAttack';

/**
 * AbilityContainer - 技能容器
 *
 * 职责：
 * - 管理单位的所有技能（存储、添加、移除）
 * - 响应 ActionEvent 进行技能筛选
 * - 发布 SkillPreCastEvent 进入施法流程
 *
 * 不负责：
 * - 目标选择（由 TargetSelectionSystem 处理）
 * - 技能执行（由 AbilityExecutionSystem 处理）
 */
export class AbilityContainer {
  private _abilities = new Map<string, Ability>();
  private _owner: Unit;
  private _defaultTarget: Unit | null = null;
  private _defaultAttack: Ability | null = null;
  private _handlers: Map<string, (event: unknown) => void> = new Map();

  constructor(owner: Unit) {
    this._owner = owner;
    this._subscribeToEvents();
  }

  private _subscribeToEvents(): void {
    const actionEventHandler = (event: ActionEvent) => this._onActionTrigger(event);
    EventBus.instance.subscribe<ActionEvent>(
      'ActionEvent',
      actionEventHandler,
      EventPriorityLevel.ACTION_TRIGGER,
    );
    this._handlers.set('ActionEvent', actionEventHandler);
  }

  /**
   * 响应行动触发事件，执行技能筛选
   */
  private _onActionTrigger(event: ActionEvent): void {
    // 仅当前出手单位是自己时，才执行筛选
    if (event.caster.id !== this._owner.id) return;

    // 获取默认目标（由 BattleEngineV5 设置）
    const target = this._getDefaultTarget();
    if (!target) return;

    // 获取可用技能
    const availableAbilities = this.getAvailableAbilities(target);

    if (availableAbilities.length === 0) {
      // 无可用技能，使用普攻
      this._prepareCast(this._getDefaultAttack(), target);
      return;
    }

    // 按优先级排序，选择最高优先级技能
    const selectedAbility = availableAbilities.reduce((best, current) =>
      current.priority > best.priority ? current : best
    );

    this._prepareCast(selectedAbility, target);
  }

  /**
   * 获取所有可用技能（冷却完毕、资源足够）
   */
  getAvailableAbilities(target: Unit): Ability[] {
    const context: AbilityContext = {
      caster: this._owner,
      target,
    };

    return Array.from(this._abilities.values())
      .filter(ability => ability instanceof ActiveSkill)
      .filter(ability => ability.canTrigger(context));
  }

  /**
   * 准备施法：发布施法前摇事件
   */
  private _prepareCast(ability: Ability, target: Unit): void {
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

  // ===== 目标管理（简化版，由外部设置） =====

  setDefaultTarget(target: Unit): void {
    this._defaultTarget = target;
  }

  clearDefaultTarget(): void {
    this._defaultTarget = null;
  }

  private _getDefaultTarget(): Unit | null {
    return this._defaultTarget;
  }

  private _getDefaultAttack(): Ability {
    if (!this._defaultAttack) {
      this._defaultAttack = new BasicAttack();
      this._defaultAttack.setOwner(this._owner);
      this._defaultAttack.setActive(true);
    }
    return this._defaultAttack;
  }

  // ===== 技能管理 =====

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

  // ===== 克隆 =====

  clone(owner: Unit): AbilityContainer {
    const clonedContainer = new AbilityContainer(owner);

    for (const ability of this._abilities.values()) {
      const clonedAbility = ability.clone();
      clonedContainer._abilities.set(clonedAbility.id, clonedAbility);
      clonedAbility.setOwner(owner);
      clonedAbility.setActive(true);
    }

    return clonedContainer;
  }

  // ===== 销毁 =====

  destroy(): void {
    for (const [eventType, handler] of this._handlers) {
      EventBus.instance.unsubscribe(eventType, handler);
    }
    this._handlers.clear();

    for (const ability of this._abilities.values()) {
      ability.setActive(false);
    }
  }
}
```

- [ ] **Step 2: 运行测试验证**

Run: `npm test -- --testPathPattern="battle-v5" --passWithNoTests`

- [ ] **Step 3: Commit**

```bash
git add engine/battle-v5/units/AbilityContainer.ts
git commit -m "refactor(battle-v5): 简化 AbilityContainer 职责

- 移除目标选择逻辑（由 TargetSelectionSystem 处理）
- 使用 AbilityContext 进行技能筛选
- 添加 destroy 方法清理资源"
```

---

## Chunk 3: 更新现有技能实现

### Task 3.1: 更新现有技能文件

**Files:**
- Modify: `engine/battle-v5/abilities/BasicAttack.ts`
- Check: `engine/battle-v5/buffs/` 下的 Buff 文件

- [ ] **Step 1: 检查并更新 BasicAttack.ts**

读取文件，确保符合新的 Ability 架构

- [ ] **Step 2: 检查 Buff 相关文件**

确保 Buff 系统不受影响

- [ ] **Step 3: 运行完整测试**

Run: `npm test -- --testPathPattern="battle-v5"`

- [ ] **Step 4: Commit**

```bash
git add engine/battle-v5/abilities/BasicAttack.ts
git commit -m "refactor(battle-v5): 更新 BasicAttack 符合新 Ability 架构"
```

---

## 验证与清理

### Task 4.1: 运行完整测试套件

- [ ] **Step 1: 运行所有 battle-v5 测试**

Run: `npm test -- --testPathPattern="battle-v5"`

Expected: 所有测试通过

- [ ] **Step 2: 检查 TypeScript 编译**

Run: `npx tsc --noEmit`

Expected: 无编译错误

- [ ] **Step 3: 最终 Commit**

```bash
git add .
git commit -m "refactor(battle-v5): 完成 Ability 架构重构

- 精简 Ability 基类，移除主动技能专属字段
- 重构 ActiveSkill，添加 TargetPolicy 和 ResourceCost
- 优化 PassiveAbility 生命周期
- 新增 TargetSelectionSystem
- 简化 AbilityContainer 职责"
```

---

## 执行顺序总结

1. **Chunk 1 (P0)**: Ability 基类重构
   - Task 1.1: 移除基类专属字段
   - Task 1.2: 重构 ActiveSkill
   - Task 1.3: 重构 PassiveAbility

2. **Chunk 2 (P2)**: 系统职责重构
   - Task 2.1: 创建 TargetSelectionSystem
   - Task 2.2: 简化 AbilityContainer

3. **Chunk 3**: 更新现有实现
   - Task 3.1: 更新现有技能文件

4. **验证与清理**
   - Task 4.1: 运行完整测试套件
