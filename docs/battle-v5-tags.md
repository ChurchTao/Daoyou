在 **GAS+EDA 架构**中引入 **标签（Tag）系统**是实现「高拓展性技能/BUFF/被动」的核心——GAS 原生的 GameplayTag 体系完美适配纯文字修仙游戏的需求，能彻底解决「技能/BUFF 交互硬编码」「条件判断耦合」的问题。

我们将按照 **「先搭标签系统（底层基建）→ 再实现三类技能（业务逻辑）→ 最后用配置驱动（拓展保障）」** 的顺序落地，全程复用你已有的 TS 架构，无侵入性修改。

---

## 一、第一步：引入标签系统（底层基建，必须先做）

标签是 GAS 的灵魂，本质是**分层的字符串标识符**（如 `Ability.Fire`、`Status.Immune.Stun`、`Buff.Dot.Poison`），用于：

- 技能/BUFF/单位的分类（如「火属性技能」「控制类BUFF」）
- 条件判断（如「免疫所有控制」→ 检查是否有 `Status.Immune.Control` 标签）
- 交互解耦（如「火属性技能对燃烧目标增伤」→ 不用硬编码判断，通过标签匹配即可）

### 1. 标签系统核心实现

```typescript
// src/core/GameplayTag.ts 新建，标签系统核心
export type TagPath = string; // 标签路径，如 "Status.Immune.Stun"

// 标签容器：管理单位/技能/BUFF的所有标签
export class GameplayTagContainer {
  private _tags = new Set<TagPath>();

  // 添加标签（支持批量）
  public addTags(tags: TagPath[]): void {
    tags.forEach((tag) => this._tags.add(tag));
  }

  // 移除标签（支持批量）
  public removeTags(tags: TagPath[]): void {
    tags.forEach((tag) => this._tags.delete(tag));
  }

  // 检查是否有指定标签（支持父标签匹配：有 "Status.Immune" 则匹配 "Status.Immune.Stun"）
  public hasTag(tag: TagPath): boolean {
    // 精确匹配
    if (this._tags.has(tag)) return true;
    // 父标签匹配：如 "Status.Immune.Stun" 的父标签是 "Status.Immune"
    const parentTags = tag
      .split('.')
      .slice(0, -1)
      .reduce((acc, _, i, arr) => {
        acc.push(arr.slice(0, i + 1).join('.'));
        return acc;
      }, [] as TagPath[]);
    return parentTags.some((parent) => this._tags.has(parent));
  }

  // 检查是否有任意一个标签
  public hasAnyTag(tags: TagPath[]): boolean {
    return tags.some((tag) => this.hasTag(tag));
  }

  // 克隆标签容器
  public clone(): GameplayTagContainer {
    const clone = new GameplayTagContainer();
    clone._tags = new Set(this._tags);
    return clone;
  }
}

// 标签事件：标签添加/移除时广播，供其他系统响应
export interface TagAddedEvent extends CombatEvent {
  type: 'TagAddedEvent';
  target: Unit;
  tag: TagPath;
}

export interface TagRemovedEvent extends CombatEvent {
  type: 'TagRemovedEvent';
  target: Unit;
  tag: TagPath;
}
```

### 2. 把标签容器集成到现有架构

修改 `Unit.ts`、`Ability.ts`、`Buff.ts`，让所有核心模块都带标签：

```typescript
// src/units/Unit.ts 补充标签容器
export class Unit {
  readonly tags: GameplayTagContainer; // 单位标签（如 "Unit.Type.Player"、"Status.Immune.Fire"）

  constructor(...) {
    this.tags = new GameplayTagContainer();
    // 初始化默认标签
    this.tags.addTags(["Unit.Type.Combatant"]);
  }

  // 克隆时同步标签
  public clone(): Unit {
    const clone = new Unit(...);
    clone.tags = this.tags.clone();
    return clone;
  }
}

// src/abilities/Ability.ts 补充标签容器
export abstract class Ability {
  readonly tags: GameplayTagContainer; // 技能标签（如 "Ability.Fire"、"Ability.Type.Control"）

  constructor(...) {
    this.tags = new GameplayTagContainer();
  }

  // 克隆时同步标签
  public clone(owner: Unit): Ability {
    const clone = new (this.constructor as any)(...);
    clone.tags = this.tags.clone();
    return clone;
  }
}

// src/buffs/Buff.ts 补充标签容器（新建Buff基类）
export abstract class Buff {
  readonly id: BuffId;
  readonly name: string;
  readonly tags: GameplayTagContainer; // BUFF标签（如 "Buff.Dot.Poison"、"Buff.Type.Control"）
  readonly duration: number; // 持续回合数
  readonly stackRule: StackRule; // 堆叠规则
  protected owner: Unit;

  constructor(id: BuffId, name: string, duration: number, owner: Unit) {
    this.id = id;
    this.name = name;
    this.tags = new GameplayTagContainer();
    this.duration = duration;
    this.stackRule = StackRule.REFRESH_DURATION;
    this.owner = owner;
  }

  // 激活BUFF（订阅事件、添加标签、添加属性修改器）
  abstract onActivate(): void;
  // 移除BUFF（取消订阅、移除标签、移除属性修改器）
  abstract onRemove(): void;
  // 克隆BUFF
  abstract clone(owner: Unit): Buff;
}

// BUFF堆叠规则
export enum StackRule {
  STACK_LAYER, // 叠加层数（如中毒3层）
  REFRESH_DURATION, // 刷新持续时间
  OVERRIDE, // 覆盖旧BUFF
  IGNORE // 忽略新BUFF
}
```

---

## 二、第二步：基于标签系统实现三类核心技能

### 1. BUFF技能（以「持续中毒」为例）

#### 核心设计思路

- BUFF 自带标签（如 `Buff.Dot.Poison`、`Buff.Type.Debuff`）
- 通过标签做施加判定（目标有 `Status.Immune.Poison` 则无法施加）
- 订阅回合事件（如 `RoundPostEvent`）触发伤害
- 用属性修改器实现属性减益

#### 代码实现

```typescript
// src/buffs/PoisonDotBuff.ts 新建
import { Buff } from './Buff';
import { EventBus } from '../core/EventBus';
import { EventPriorityLevel, RoundPostEvent } from '../core/types';

export class PoisonDotBuff extends Buff {
  private _layer: number = 1; // 中毒层数
  private _modifierId: string = `poison_debuff_${this.id}`;

  constructor(
    id: BuffId,
    name: string,
    duration: number,
    owner: Unit,
    layer: number = 1,
  ) {
    super(id, name, duration, owner);
    this._layer = layer;
    this.tags.addTags([
      'Buff.Dot.Poison',
      'Buff.Type.Debuff',
      'Buff.Element.Poison',
    ]);
  }

  onActivate(): void {
    // 1. 给目标添加中毒标签
    this.owner.tags.addTags(['Status.Poisoned']);
    EventBus.instance.publish<TagAddedEvent>({
      type: 'TagAddedEvent',
      priority: EventPriorityLevel.POST_SETTLE,
      target: this.owner,
      tag: 'Status.Poisoned',
    });

    // 2. 添加属性修改器（降低身法20%）
    this.owner.attributes.addModifier({
      id: this._modifierId,
      attrType: AttributeType.AGILITY,
      type: ModifierType.MULTIPLY,
      value: 0.8,
      source: this,
    });

    // 3. 订阅回合后置事件，触发中毒伤害
    EventBus.instance.subscribe<RoundPostEvent>(
      'RoundPostEvent',
      (e) => this._onRoundPost(e),
      EventPriorityLevel.POST_SETTLE,
      this.id,
    );
  }

  private _onRoundPost(event: RoundPostEvent): void {
    if (event.target.id !== this.owner.id) return;
    // 每层造成 体魄*5 的伤害
    const damage =
      this.owner.attributes.getValue(AttributeType.PHYSIQUE) * 5 * this._layer;
    EventBus.instance.publish<DamageEvent>({
      type: 'DamageEvent',
      priority: EventPriorityLevel.DAMAGE_APPLY,
      caster: null, // 无施法者（DOT伤害）
      target: this.owner,
      ability: null,
      finalDamage: damage,
    });
    // 持续时间减1，为0时移除
    this.duration--;
    if (this.duration <= 0) {
      this.owner.buffs.removeBuff(this.id);
    }
  }

  onRemove(): void {
    // 1. 移除中毒标签
    this.owner.tags.removeTags(['Status.Poisoned']);
    EventBus.instance.publish<TagRemovedEvent>({
      type: 'TagRemovedEvent',
      priority: EventPriorityLevel.POST_SETTLE,
      target: this.owner,
      tag: 'Status.Poisoned',
    });
    // 2. 移除属性修改器
    this.owner.attributes.removeModifier(this._modifierId);
    // 3. 取消事件订阅
    EventBus.instance.unsubscribe('RoundPostEvent', this.id);
  }

  // 叠加层数逻辑
  public addLayer(layer: number): void {
    this._layer += layer;
    this.duration = Math.max(this.duration, 3); // 叠加时刷新最低持续时间
  }

  clone(owner: Unit): Buff {
    return new PoisonDotBuff(
      this.id,
      this.name,
      this.duration,
      owner,
      this._layer,
    );
  }
}
```

#### 配套：BUFF容器完善

```typescript
// src/units/BuffContainer.ts 完善
import { Buff, StackRule } from '../buffs/Buff';
import { PoisonDotBuff } from '../buffs/PoisonDotBuff';

export class BuffContainer {
  private _buffs = new Map<BuffId, Buff>();
  private _owner: Unit;

  constructor(owner: Unit) {
    this._owner = owner;
  }

  // 添加BUFF（核心逻辑：标签判定+堆叠规则）
  public addBuff(buff: Buff): void {
    // 1. 标签判定：目标是否免疫该BUFF
    const immuneTags = buff.tags.hasTag('Buff.Type.Debuff')
      ? [
          'Status.Immune.Debuff',
          `Status.Immune.${buff.tags.toArray()[0].split('.').pop()}`,
        ]
      : [];
    if (this._owner.tags.hasAnyTag(immuneTags)) {
      return; // 免疫，不施加
    }

    // 2. 检查是否已有同ID BUFF，应用堆叠规则
    const existingBuff = this._buffs.get(buff.id);
    if (existingBuff) {
      switch (existingBuff.stackRule) {
        case StackRule.STACK_LAYER:
          (existingBuff as PoisonDotBuff).addLayer(1);
          break;
        case StackRule.REFRESH_DURATION:
          existingBuff.duration = Math.max(
            existingBuff.duration,
            buff.duration,
          );
          break;
        case StackRule.OVERRIDE:
          this.removeBuff(buff.id);
          this._addNewBuff(buff);
          break;
        case StackRule.IGNORE:
          break;
      }
      return;
    }

    // 3. 无现有BUFF，添加新BUFF
    this._addNewBuff(buff);
  }

  private _addNewBuff(buff: Buff): void {
    this._buffs.set(buff.id, buff);
    buff.onActivate();
  }

  // 移除BUFF
  public removeBuff(buffId: BuffId): void {
    const buff = this._buffs.get(buffId);
    if (buff) {
      buff.onRemove();
      this._buffs.delete(buffId);
    }
  }

  // 克隆容器
  public clone(owner: Unit): BuffContainer {
    const clone = new BuffContainer(owner);
    this._buffs.forEach((buff) => {
      clone.addBuff(buff.clone(owner));
    });
    return clone;
  }
}
```

---

### 2. 封印/控制技能（以「神识封禁·眩晕」为例）

#### 核心设计思路

- 控制技能是**主动技能**，自带标签（如 `Ability.Type.Control`、`Ability.Element.Mind`）
- 命中后给目标加**控制类BUFF**（如 `StunBuff`，标签 `Buff.Type.Control`、`Status.Stun`）
- 控制BUFF通过**高优先级订阅行动事件**，阻止目标出手
- 用标签做免疫判定（目标有 `Status.Immune.Stun` 则控制失效）

#### 代码实现

```typescript
// src/buffs/StunBuff.ts 新建眩晕BUFF
import { Buff } from './Buff';
import { EventBus } from '../core/EventBus';
import { EventPriorityLevel, ActionEvent } from '../core/types';

export class StunBuff extends Buff {
  constructor(id: BuffId, name: string, duration: number, owner: Unit) {
    super(id, name, duration, owner);
    this.tags.addTags(['Buff.Type.Control', 'Status.Stun']);
    this.stackRule = StackRule.REFRESH_DURATION;
  }

  onActivate(): void {
    // 1. 添加眩晕标签
    this.owner.tags.addTags(['Status.Stunned']);
    // 2. 高优先级订阅行动事件，阻止目标出手
    EventBus.instance.subscribe<ActionEvent>(
      'ActionEvent',
      (e) => this._onAction(e),
      EventPriorityLevel.ACTION_TRIGGER + 10, // 比技能筛选优先级更高，先拦截
      this.id,
    );
  }

  private _onAction(event: ActionEvent): void {
    if (event.caster.id !== this.owner.id) return;
    // 直接终止行动，不发布后续技能事件
    event.isActionSkipped = true;
    // 持续时间减1
    this.duration--;
    if (this.duration <= 0) {
      this.owner.buffs.removeBuff(this.id);
    }
  }

  onRemove(): void {
    this.owner.tags.removeTags(['Status.Stunned']);
    EventBus.instance.unsubscribe('ActionEvent', this.id);
  }

  clone(owner: Unit): Buff {
    return new StunBuff(this.id, this.name, this.duration, owner);
  }
}

// src/abilities/SealStunSkill.ts 新建控制主动技能
import { ActiveSkill } from './Ability';
import { StunBuff } from '../buffs/StunBuff';
import { EventBus } from '../core/EventBus';
import { SkillCastEvent, EventPriorityLevel } from '../core/types';

export class SealStunSkill extends ActiveSkill {
  constructor(id: AbilityId, name: string, priority: number, owner: Unit) {
    super(id, name, priority, owner);
    this.tags.addTags([
      'Ability.Type.Control',
      'Ability.Element.Mind',
      'Ability.Target.Single',
    ]);
  }

  canTrigger(target?: Unit): boolean {
    // 神识>50才能释放
    return (
      this.owner.attributes.getValue(AttributeType.CONSCIOUSNESS) > 50 &&
      target !== undefined
    );
  }

  execute(target?: Unit): void {
    if (!target) return;
    // 发布技能释放事件（命中判定在DamageSystem中做，控制技能也需要命中/抵抗）
    EventBus.instance.publish<SkillCastEvent>({
      type: 'SkillCastEvent',
      priority: EventPriorityLevel.SKILL_CAST,
      caster: this.owner,
      target,
      ability: this,
    });
  }

  // 命中后调用：给目标加眩晕BUFF
  public onHit(target: Unit): void {
    const stunBuff = new StunBuff('buff_stun', '眩晕', 2, target);
    target.buffs.addBuff(stunBuff);
  }

  clone(owner: Unit): Ability {
    return new SealStunSkill(this.id, this.name, this.priority, owner);
  }
}
```

---

### 3. 被动技能（以「火灵之体·火属性增伤+免疫火毒」为例）

#### 核心设计思路

- 被动技能自带标签（如 `Passive.Type.StatBonus`、`Passive.Element.Fire`）
- 通过**订阅事件**实现效果（如订阅 `DamageCalculateEvent` 增伤，订阅 `BuffAddedEvent` 免疫火毒）
- 用**标签匹配**做条件判断（如仅当技能有 `Ability.Fire` 标签时增伤，仅当BUFF有 `Buff.Element.Fire` 时免疫）

#### 代码实现

```typescript
// src/abilities/FireSpiritPassive.ts 新建被动技能
import { PassiveAbility } from './Ability';
import { EventBus } from '../core/EventBus';
import {
  EventPriorityLevel,
  DamageCalculateEvent,
  BuffAddedEvent,
} from '../core/types';

export class FireSpiritPassive extends PassiveAbility {
  constructor(id: AbilityId, name: string, priority: number, owner: Unit) {
    super(id, name, priority, owner);
    this.tags.addTags([
      'Passive.Type.StatBonus',
      'Passive.Element.Fire',
      'Passive.Type.Immunity',
    ]);
  }

  onActivate(): void {
    // 1. 给自己添加「火属性免疫」标签
    this.owner.tags.addTags([
      'Status.Immune.Fire',
      'Status.Immune.Poison.Fire',
    ]);
    // 2. 订阅伤害计算事件：火属性技能增伤30%
    EventBus.instance.subscribe<DamageCalculateEvent>(
      'DamageCalculateEvent',
      (e) => this._onDamageCalc(e),
      EventPriorityLevel.DAMAGE_CALC,
      this.id,
    );
    // 3. 订阅BUFF添加事件：免疫火属性BUFF
    EventBus.instance.subscribe<BuffAddedEvent>(
      'BuffAddedEvent',
      (e) => this._onBuffAdded(e),
      EventPriorityLevel.POST_SETTLE + 10, // 比BUFF激活优先级更高，先拦截
      this.id,
    );
  }

  private _onDamageCalc(event: DamageCalculateEvent): void {
    if (event.caster.id !== this.owner.id) return;
    // 仅当技能有「火属性」标签时增伤
    if (event.ability.tags.hasTag('Ability.Element.Fire')) {
      event.finalDamage *= 1.3;
    }
  }

  private _onBuffAdded(event: BuffAddedEvent): void {
    if (event.target.id !== this.owner.id) return;
    // 仅当BUFF有「火属性」标签时免疫
    if (event.buff.tags.hasTag('Buff.Element.Fire')) {
      event.isBuffCancelled = true;
    }
  }

  onRemove(): void {
    this.owner.tags.removeTags([
      'Status.Immune.Fire',
      'Status.Immune.Poison.Fire',
    ]);
    EventBus.instance.unsubscribe('DamageCalculateEvent', this.id);
    EventBus.instance.unsubscribe('BuffAddedEvent', this.id);
  }

  clone(owner: Unit): Ability {
    return new FireSpiritPassive(this.id, this.name, this.priority, owner);
  }
}
```

---

## 三、第三步：用配置驱动实现高拓展性

为了彻底避免硬编码，把所有技能/BUFF/被动的**标签、触发条件、效果参数**都放到配置文件里，代码只负责解析配置，这样加新内容只需改配置，不用改代码。

### 配置示例（JSON）

```json
// src/data/configs/skills/fire_ball.json
{
  "id": "skill_fire_ball",
  "name": "火球术",
  "type": "ActiveSkill",
  "priority": 50,
  "tags": ["Ability.Element.Fire", "Ability.Type.Damage", "Ability.Target.Single"],
  "triggerConditions": [
    {"type": "AttributeCheck", "attr": "Spirit", "operator": ">", "value": 50}
  ],
  "effects": [
    {"type": "Damage", "formula": "Spirit * 2 + 100", "target": "Enemy"}
  ]
}

// src/data/configs/buffs/poison_dot.json
{
  "id": "buff_poison_dot",
  "name": "中毒",
  "type": "DotBuff",
  "duration": 3,
  "stackRule": "StackLayer",
  "tags": ["Buff.Dot.Poison", "Buff.Type.Debuff", "Buff.Element.Poison"],
  "effects": [
    {"type": "AttributeModifier", "attr": "Agility", "modifierType": "Multiply", "value": 0.8},
    {"type": "DotDamage", "formula": "Physique * 5 * Layer", "phase": "RoundPost"}
  ]
}
```

### 配置加载器（简单实现）

```typescript
// src/data/DataLoader.ts 新建
import { Ability } from '../abilities/Ability';
import { Buff } from '../buffs/Buff';
import { FireBallAbility } from '../abilities/FireBallAbility';
import { PoisonDotBuff } from '../buffs/PoisonDotBuff';

export class DataLoader {
  // 加载技能配置
  public static loadAbility(id: string, owner: Unit): Ability | null {
    // 实际项目中用 fetch/require 加载 JSON 配置
    const config = this._getAbilityConfig(id);
    if (!config) return null;

    // 根据配置类型实例化技能
    switch (config.type) {
      case 'ActiveSkill':
        const skill = new FireBallAbility(
          config.id,
          config.name,
          config.priority,
          owner,
        );
        skill.tags.addTags(config.tags);
        return skill;
      // 其他技能类型同理
      default:
        return null;
    }
  }

  // 加载BUFF配置
  public static loadBuff(id: string, owner: Unit): Buff | null {
    const config = this._getBuffConfig(id);
    if (!config) return null;

    switch (config.type) {
      case 'DotBuff':
        const buff = new PoisonDotBuff(
          config.id,
          config.name,
          config.duration,
          owner,
        );
        buff.tags.addTags(config.tags);
        return buff;
      default:
        return null;
    }
  }

  // 模拟获取配置（实际项目中替换为 JSON 加载）
  private static _getAbilityConfig(id: string) {
    return {
      id,
      name: '火球术',
      type: 'ActiveSkill',
      priority: 50,
      tags: ['Ability.Element.Fire'],
    };
  }
  private static _getBuffConfig(id: string) {
    return {
      id,
      name: '中毒',
      type: 'DotBuff',
      duration: 3,
      stackRule: 'StackLayer',
      tags: ['Buff.Dot.Poison'],
    };
  }
}
```

---

## 四、总结：标签系统的核心价值

1. **彻底解耦**：技能/BUFF/被动之间的交互通过标签完成，无需硬编码判断（如「火克金」只需检查标签，不用写死技能ID）
2. **条件灵活**：父标签匹配机制让条件判断更灵活（如「免疫所有控制」只需加 `Status.Immune.Control`，不用单独写免疫眩晕/沉默/冰冻）
3. **易于拓展**：加新技能/BUFF只需：
   - 定义新标签（如 `Ability.Element.Ice`）
   - 写配置文件
   - （可选）写少量效果实现类（通用效果可复用）
4. **调试友好**：通过查看单位/技能/BUFF的标签，能快速定位问题（如「为什么眩晕没生效？」→ 检查目标是否有 `Status.Immune.Stun` 标签）
