# 技能释放→命中→伤害应用 全流程流转详解

完全贴合你已搭建的 **TS 事件驱动(EDA)+GAS思想** 架构，严格遵循之前定义的回合时序、优先级规则和5维属性定位，全程用「事件驱动」实现模块完全解耦，每一步都对应你已写的代码结构，无额外侵入性修改。

---

## 一、先明确核心前提与总链路

### 1. 前置场景锁定

- 流程归属：战斗状态机已走完「命格觉醒→回合前置结算→出手顺序判定」，当前进入 **ACTION出手行动阶段**（回合核心执行阶段）
- 战斗类型：PVP镜像自动战斗，施法者为进攻方玩家单元，目标为防守方玩家镜像单元
- 核心规则：全程通过`EventBus`事件总线实现流转，无模块间直接硬调用；所有执行顺序由**事件优先级**严格控制，杜绝时序混乱

### 2. 全链路总览（10步闭环，优先级从高到低）

```
【阶段1：行动阶段触发】→【阶段2：技能筛选与触发条件校验】→【阶段3：施法前摇&打断判定】
→【阶段4：技能正式释放事件广播】→【阶段5：命中/闪避/抵抗判定】→【阶段6：伤害公式计算】
→【阶段7：伤害事件广播&被动响应】→【阶段8：最终伤害应用&属性更新】→【阶段9：后置结算&连锁触发】
→【阶段10：战报输出&流程闭环】
```

### 3. 提前规范：全流程核心事件定义（补充到`src/core/types.ts`）

先锁死事件类型与优先级，保证时序可控，完全兼容你之前的`EventBus`实现：

```typescript
// 补充到 types.ts 中，覆盖全流程事件
export enum EventPriorityLevel {
  ACTION_TRIGGER = 80, // 行动阶段触发（最高）
  SKILL_PRE_CAST = 75, // 施法前摇&打断判定
  SKILL_CAST = 70, // 技能正式释放
  HIT_CHECK = 65, // 命中判定
  DAMAGE_CALC = 60, // 伤害计算
  DAMAGE_APPLY = 55, // 伤害应用
  DAMAGE_TAKEN = 50, // 受击事件（触发被动/反伤）
  POST_SETTLE = 30, // 后置结算
  COMBAT_LOG = 10, // 战报输出（最低，保证逻辑全走完再输出）
}

// 1. 行动阶段触发事件
export interface ActionEvent extends CombatEvent {
  type: 'ActionEvent';
  caster: Unit; // 当前出手的单位
}

// 2. 施法前摇事件（打断判定用）
export interface SkillPreCastEvent extends CombatEvent {
  type: 'SkillPreCastEvent';
  caster: Unit;
  target: Unit;
  ability: Ability;
  isInterrupted: boolean; // 打断标记
}

// 3. 技能正式释放事件
export interface SkillCastEvent extends CombatEvent {
  type: 'SkillCastEvent';
  caster: Unit;
  target: Unit;
  ability: Ability;
}

// 4. 命中判定事件
export interface HitCheckEvent extends CombatEvent {
  type: 'HitCheckEvent';
  caster: Unit;
  target: Unit;
  ability: Ability;
  isHit: boolean; // 命中标记
  isDodged: boolean; // 闪避标记
  isResisted: boolean; // 抵抗标记（控制类用）
}

// 5. 伤害计算事件
export interface DamageCalculateEvent extends CombatEvent {
  type: 'DamageCalculateEvent';
  caster: Unit;
  target: Unit;
  ability: Ability;
  baseDamage: number; // 基础伤害
  finalDamage: number; // 最终伤害（计算后回填）
}

// 6. 伤害应用事件
export interface DamageEvent extends CombatEvent {
  type: 'DamageEvent';
  caster: Unit;
  target: Unit;
  ability: Ability;
  finalDamage: number;
}

// 7. 受击事件（用于被动/反伤/命格触发）
export interface DamageTakenEvent extends CombatEvent {
  type: 'DamageTakenEvent';
  caster: Unit;
  target: Unit;
  damageTaken: number;
  remainHealth: number;
}
```

---

## 二、全流程分步详解（含代码对应+逻辑边界）

我们以你之前写的**火球术主动技能**为例，完整走通整个流转，每一步都对应你已有的代码结构。

### 阶段1：行动阶段触发（回合时序入口）

#### 【核心逻辑】

战斗状态机切换到`CombatPhase.ACTION`出手行动阶段，确认当前出手单位（已通过身法/神识判定好顺序），广播行动触发事件，开启整个技能流程。

#### 【执行主体】`CombatStateMachine.ts` 状态机

#### 【事件流转】发布`ActionEvent`（优先级80，当前阶段最高）

#### 【代码对应】

```typescript
// 补充到 CombatStateMachine.ts 的 ACTION 状态实现
this._states.set(CombatPhase.ACTION, {
  phase: CombatPhase.ACTION,
  onEnter: () => {
    console.log('[状态] 进入出手行动阶段');
    // 1. 获取当前出手单位（已在TURN_ORDER阶段排好序）
    const currentCaster = this._combatContext.currentTurnUnit;
    // 2. 广播行动事件，触发技能系统响应
    EventBus.instance.publish<ActionEvent>({
      type: 'ActionEvent',
      priority: EventPriorityLevel.ACTION_TRIGGER,
      caster: currentCaster,
    });
  },
  onUpdate: () => this._switchTo(CombatPhase.ROUND_POST),
  onExit: () => {},
});
```

#### 【关键校验】

- 仅当前出手单位的技能会响应事件，非出手单位忽略
- 若单位已死亡（气血≤0），直接跳过行动阶段，不发布事件

---

### 阶段2：技能筛选与触发条件校验（自动战斗AI核心）

#### 【核心逻辑】

技能容器订阅`ActionEvent`，遍历当前单位的所有主动技能，按**悟性属性**决定的AI规则，筛选出符合触发条件的最优技能，锁定施法目标。

- 悟性越高，可设置的触发条件越多（比如「气血<30%优先放回血」「敌方有护盾优先放破盾」）
- 无特殊条件时，按技能优先级排序，选择最高优先级的可释放技能

#### 【执行主体】`AbilityContainer.ts` 技能容器 + `Ability.ts` 技能基类

#### 【事件流转】订阅`ActionEvent`，无新事件发布（仅内部校验）

#### 【代码对应】

```typescript
// 补充到 AbilityContainer.ts 中，在构造函数里订阅行动事件
constructor(owner: Unit) {
  this._owner = owner;
  // 订阅行动事件，触发技能筛选
  EventBus.instance.subscribe<ActionEvent>(
    "ActionEvent",
    (event) => this._onActionTrigger(event),
    EventPriorityLevel.ACTION_TRIGGER
  );
}

// 技能筛选核心逻辑
private _onActionTrigger(event: ActionEvent): void {
  // 仅当前出手单位是自己时，才执行筛选
  if (event.caster.id !== this._owner.id) return;

  // 1. 遍历所有主动技能，过滤符合触发条件的技能
  const availableAbilities = Array.from(this._abilities.values())
    .filter(ability => ability instanceof ActiveSkill) // 仅主动技能
    .filter(ability => ability.canTrigger(this._owner, this._getDefaultTarget())); // 触发条件校验

  // 2. 按悟性排序：悟性越高，条件匹配度权重越高，无匹配则按技能优先级排序
  const sortedAbilities = availableAbilities.sort((a, b) => {
    const comprehension = this._owner.attributes.getValue(AttributeType.COMPREHENSION);
    // 悟性>80时，优先匹配目标状态（比如敌方被控则优先输出技能）
    if (comprehension > 80) {
      return this._matchTargetStateWeight(a) - this._matchTargetStateWeight(b);
    }
    return b.priority - a.priority;
  });

  // 3. 锁定最优技能，进入施法流程
  const selectedAbility = sortedAbilities[0];
  if (selectedAbility) {
    this._prepareCast(selectedAbility, this._getDefaultTarget());
  }
}

// 准备施法：进入前摇阶段
private _prepareCast(ability: Ability, target: Unit): void {
  // 发布施法前摇事件，进入打断判定
  EventBus.instance.publish<SkillPreCastEvent>({
    type: "SkillPreCastEvent",
    priority: EventPriorityLevel.SKILL_PRE_CAST,
    caster: this._owner,
    target,
    ability,
    isInterrupted: false
  });
}
```

#### 【关键校验】

- 技能`canTrigger`必须校验核心条件：蓝量/灵力是否足够、冷却是否结束、目标是否存活
- 镜像战斗的目标固定为敌方单位，无需玩家手动选择
- 无可用技能时，默认执行普攻（普攻也做成一个0消耗的基础主动技能）

---

### 阶段3：施法前摇&打断判定（神识属性核心价值）

#### 【核心逻辑】

对应你设定的「神识=控制与反制核心」，所有「施法打断」类被动/命格/BUFF，都会订阅`SkillPreCastEvent`，通过神识对抗判定是否打断施法。

- 打断规则：防守方神识 > 施法方神识30%时，有30%概率触发打断；神识差值越大，打断概率越高
- 若`isInterrupted`被标记为`true`，直接终止流程，不进入技能释放环节

#### 【执行主体】被动技能/命格/BUFF、`EventBus`

#### 【事件流转】订阅`SkillPreCastEvent`，无新事件发布（仅修改打断标记）

#### 【代码对应】

```typescript
// 示例：打断类被动技能「神识封禁」，订阅施法前摇事件
export class SealCastPassive extends Ability {
  onActivate(): void {
    EventBus.instance.subscribe<SkillPreCastEvent>(
      'SkillPreCastEvent',
      (event) => this._onSkillPreCast(event),
      EventPriorityLevel.SKILL_PRE_CAST,
    );
  }

  private _onSkillPreCast(event: SkillPreCastEvent): void {
    // 仅当自己是目标时，才触发打断判定
    if (event.target.id !== this._owner.id) return;

    // 神识对抗：计算打断概率
    const casterConsciousness = event.caster.attributes.getValue(
      AttributeType.CONSCIOUSNESS,
    );
    const ownerConsciousness = this._owner.attributes.getValue(
      AttributeType.CONSCIOUSNESS,
    );
    const interruptChance = Math.max(
      0,
      ((ownerConsciousness - casterConsciousness) / casterConsciousness) * 100,
    );

    // 概率判定，成功则标记为打断
    if (Math.random() * 100 < interruptChance) {
      event.isInterrupted = true;
    }
  }
}
```

#### 【关键校验】

- 同优先级的打断判定，按「神识从高到低」排序执行
- 一旦被标记为打断，后续所有订阅者都能读取到该标记，不可逆转
- 打断后必须发布`SkillInterruptEvent`，供战报系统捕获

---

### 阶段4：技能正式释放事件广播

#### 【核心逻辑】

校验`SkillPreCastEvent`的`isInterrupted`标记，若未被打断，正式发布`SkillCastEvent`，广播技能释放行为。

- 这是整个流程的核心锚点：所有和技能释放相关的被动/命格/BUFF，都通过订阅这个事件触发效果（比如「施法时叠加1层灵力buff」「释放火属性技能时伤害提升20%」）
- 技能本身不写死伤害逻辑，仅负责广播事件，实现完全解耦

#### 【执行主体】`AbilityContainer.ts` 技能容器

#### 【事件流转】发布`SkillCastEvent`（优先级70）

#### 【代码对应】

```typescript
// 补充到 AbilityContainer.ts 的 _prepareCast 方法中，紧接前摇事件发布后
// 用setTimeout模拟事件执行完成后的校验（实际用同步执行即可，EventBus是同步发布）
EventBus.instance.publish<SkillPreCastEvent>(preCastEvent);

// 校验是否被打断
if (preCastEvent.isInterrupted) {
  // 发布打断事件，终止流程
  EventBus.instance.publish({
    type: 'SkillInterruptEvent',
    priority: EventPriorityLevel.COMBAT_LOG,
    caster: preCastEvent.caster,
    ability: preCastEvent.ability,
  });
  return;
}

// 未被打断，正式发布技能释放事件
const castEvent: SkillCastEvent = {
  type: 'SkillCastEvent',
  priority: EventPriorityLevel.SKILL_CAST,
  caster: preCastEvent.caster,
  target: preCastEvent.target,
  ability: preCastEvent.ability,
};
EventBus.instance.publish(castEvent);

// 技能执行自身的核心逻辑（仅做行为触发，不做伤害计算）
preCastEvent.ability.execute(preCastEvent.caster, preCastEvent.target);
```

#### 【关键校验】

- 技能释放事件必须携带完整的施法者、目标、技能信息，供下游订阅者使用
- 技能的`execute`方法仅负责触发行为，不直接修改目标属性，所有属性修改都通过后续事件完成
- 所有「施法时触发」的被动效果，必须在这个阶段执行完毕，比如临时提升灵力的修改器，必须在伤害计算前生效

---

### 阶段5：命中/闪避/抵抗判定（身法+神识属性核心价值）

#### 【核心逻辑】

伤害系统订阅`SkillCastEvent`，先执行命中判定，对应你设定的属性定位：

- 身法：决定闪避概率，目标身法 > 施法者身法30%时，闪避概率大幅提升
- 神识：决定技能命中概率与抵抗概率，控制类技能需额外做神识抵抗判定
- 判定结果写入`HitCheckEvent`，未命中则直接终止流程，不进入伤害计算

#### 【执行主体】`DamageSystem.ts` 伤害计算系统（新建，核心业务系统）

#### 【事件流转】订阅`SkillCastEvent`，发布`HitCheckEvent`（优先级65）

#### 【代码对应】

```typescript
// src/systems/DamageSystem.ts 新建
import { EventBus } from '../core/EventBus';
import { AttributeType } from '../core/types';

export class DamageSystem {
  constructor() {
    // 订阅技能释放事件，先做命中判定
    EventBus.instance.subscribe<SkillCastEvent>(
      'SkillCastEvent',
      (event) => this._hitCheck(event),
      EventPriorityLevel.HIT_CHECK,
    );
  }

  // 命中判定核心逻辑
  private _hitCheck(event: SkillCastEvent): void {
    const { caster, target, ability } = event;
    const hitCheckEvent: HitCheckEvent = {
      type: 'HitCheckEvent',
      priority: EventPriorityLevel.HIT_CHECK,
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
      const casterConsciousness = caster.attributes.getValue(
        AttributeType.CONSCIOUSNESS,
      );
      const targetConsciousness = target.attributes.getValue(
        AttributeType.CONSCIOUSNESS,
      );
      const resistChance = Math.max(
        0,
        ((targetConsciousness - casterConsciousness) / casterConsciousness) *
          100,
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
}
```

#### 【关键校验】

- 闪避和抵抗是互斥的，先判定闪避，再判定抵抗
- 必须设置闪避/抵抗的上下限（比如最低5%闪避，最高80%），避免出现100%必闪/必抵抗的无敌情况
- 普攻也需要做命中判定，不能必中

---

### 阶段6：伤害公式计算（属性系统核心落地）

#### 【核心逻辑】

命中成功后，执行伤害公式计算，完全贴合你的5维属性设定，分为「基础伤害计算→伤害增减修正→最终伤害锁定」三步，所有计算过程都通过事件暴露，供被动/命格/BUFF修改。

#### 【执行主体】`DamageSystem.ts`

#### 【事件流转】发布`DamageCalculateEvent`（优先级60）

#### 【代码对应】

```typescript
// 补充到 DamageSystem.ts 中
private _calculateDamage(castEvent: SkillCastEvent, hitEvent: HitCheckEvent): void {
  const { caster, target, ability } = castEvent;

  // 1. 计算基础伤害（贴合你的属性定位，法术技能吃灵力，体术技能吃体魄）
  let baseDamage = 0;
  if (ability.isMagicAbility) {
    // 法术伤害：灵力 * 技能系数 + 固定值
    const spirit = caster.attributes.getValue(AttributeType.SPIRIT);
    baseDamage = spirit * ability.damageCoefficient + ability.baseDamage;
  } else if (ability.isPhysicalAbility) {
    // 体术伤害：体魄 * 技能系数 + 固定值
    const physique = caster.attributes.getValue(AttributeType.PHYSIQUE);
    baseDamage = physique * ability.damageCoefficient + ability.baseDamage;
  }

  // 2. 发布伤害计算事件，供被动/命格/BUFF修正伤害（比如增伤/减伤）
  const calcEvent: DamageCalculateEvent = {
    type: "DamageCalculateEvent",
    priority: EventPriorityLevel.DAMAGE_CALC,
    caster,
    target,
    ability,
    baseDamage,
    finalDamage: baseDamage // 初始化为基础伤害
  };
  EventBus.instance.publish(calcEvent);

  // 3. 修正最终伤害：计算目标减伤，最低为1点伤害（避免0伤害）
  const targetPhysique = target.attributes.getValue(AttributeType.PHYSIQUE);
  const damageReduction = Math.min(0.7, targetPhysique / (targetPhysique + 1000)); // 最高70%减伤
  calcEvent.finalDamage = Math.max(1, calcEvent.finalDamage * (1 - damageReduction));

  // 4. 进入伤害应用环节
  this._applyDamage(calcEvent);
}
```

#### 【关键校验】

- 伤害计算必须分「基础伤害→增伤修正→减伤修正→最终伤害」的固定顺序，避免数值混乱
- 所有增伤/减伤效果，都通过订阅`DamageCalculateEvent`修改`finalDamage`实现，不硬编码在公式里
- 必须设置伤害下限，避免出现0伤害的无效攻击

---

### 阶段7：伤害事件广播&被动响应

#### 【核心逻辑】

最终伤害锁定后，发布`DamageEvent`，广播即将应用的伤害值，所有「受击前触发」的效果（比如无敌、护盾、伤害免疫）都在这个阶段执行，可拦截/修改最终伤害。

#### 【执行主体】`DamageSystem.ts`、护盾/无敌类被动技能/BUFF

#### 【事件流转】发布`DamageEvent`（优先级55）

#### 【代码对应】

```typescript
// 补充到 DamageSystem.ts 中
private _applyDamage(calcEvent: DamageCalculateEvent): void {
  const { caster, target, ability, finalDamage } = calcEvent;

  // 1. 发布伤害事件，供护盾/无敌/伤害免疫类效果响应
  const damageEvent: DamageEvent = {
    type: "DamageEvent",
    priority: EventPriorityLevel.DAMAGE_APPLY,
    caster,
    target,
    ability,
    finalDamage
  };
  EventBus.instance.publish(damageEvent);

  // 2. 校验伤害是否被免疫/抵消（比如护盾吸收了全部伤害）
  if (damageEvent.finalDamage <= 0) return;

  // 3. 进入最终属性更新环节
  this._updateTargetHealth(damageEvent);
}

// 示例：护盾技能订阅DamageEvent，吸收伤害
export class ShieldBuff extends Buff {
  onActivate(): void {
    EventBus.instance.subscribe<DamageEvent>(
      "DamageEvent",
      (event) => {
        if (event.target.id !== this._owner.id) return;
        // 护盾吸收伤害
        const absorb = Math.min(this.shieldValue, event.finalDamage);
        this.shieldValue -= absorb;
        event.finalDamage -= absorb;
      },
      EventPriorityLevel.DAMAGE_APPLY
    );
  }
}
```

#### 【关键校验】

- 护盾/无敌的执行优先级必须高于伤害应用，保证伤害被正确抵消
- 伤害被完全吸收后，不触发后续的受击事件，避免无效触发被动

---

### 阶段8：最终伤害应用&属性更新

#### 【核心逻辑】

伤害校验完成后，正式修改目标单元的气血属性，更新目标状态，完成伤害的最终落地。

#### 【执行主体】`Unit.ts` 单元属性系统、`DamageSystem.ts`

#### 【事件流转】无新事件发布（仅属性更新）

#### 【代码对应】

```typescript
// 补充到 Unit.ts 中，添加气血管理方法
export class Unit {
  // 新增：当前气血（派生自体魄，战斗中动态修改）
  private _currentHealth: number;

  constructor(...) {
    // 初始化时，当前气血=最大气血
    this._currentHealth = this.maxHealth;
  }

  // 获取最大气血（体魄决定）
  get maxHealth(): number {
    return this.attributes.getValue(AttributeType.PHYSIQUE) * 100;
  }

  // 获取当前气血
  get currentHealth(): number {
    return this._currentHealth;
  }

  // 受到伤害，更新气血
  takeDamage(damage: number): number {
    const finalDamage = Math.min(this._currentHealth, damage);
    this._currentHealth = Math.max(0, this._currentHealth - finalDamage);
    return finalDamage;
  }
}

// 补充到 DamageSystem.ts 的 _updateTargetHealth 方法
private _updateTargetHealth(damageEvent: DamageEvent): void {
  const { target, finalDamage, caster } = damageEvent;
  // 应用伤害，获取实际造成的伤害
  const actualDamage = target.takeDamage(finalDamage);
  // 发布受击事件，触发反伤/濒死被动等
  EventBus.instance.publish<DamageTakenEvent>({
    type: "DamageTakenEvent",
    priority: EventPriorityLevel.DAMAGE_TAKEN,
    caster,
    target,
    damageTaken: actualDamage,
    remainHealth: target.currentHealth
  });
}
```

#### 【关键校验】

- 气血修改必须有唯一入口`takeDamage`，禁止外部直接修改`_currentHealth`，避免数据混乱
- 实际造成的伤害不能超过目标当前气血，避免负气血
- 战斗单元的属性修改仅作用于战斗内的克隆镜像，不修改玩家全局存档数据

---

### 阶段9：后置结算&连锁触发

#### 【核心逻辑】

订阅`DamageTakenEvent`，执行所有受击后的连锁效果，包括：

1.  反伤/吸血类效果
2.  濒死触发的被动/命格（比如「气血低于10%触发无敌」）
3.  击杀判定（目标气血≤0，发布`UnitDeadEvent`）
4.  连击/追击类技能触发

#### 【执行主体】被动技能/命格/BUFF、战斗状态机

#### 【事件流转】订阅`DamageTakenEvent`，发布`UnitDeadEvent`/`ComboTriggerEvent`等

#### 【关键校验】

- 击杀判定必须在所有连锁效果执行完毕后再做，避免出现「目标已死还能反杀」的逻辑bug
- 连锁触发必须设置最大层数（比如最多3层连击），避免出现无限循环

---

### 阶段10：战报输出&流程闭环

#### 【核心逻辑】

`CombatLogSystem`订阅全流程的所有事件，按最低优先级执行，保证所有逻辑走完后，再输出对应战报，完全解耦战斗逻辑与表现层。

#### 【执行主体】`CombatLogSystem.ts`

#### 【事件流转】订阅全流程事件，无新事件发布

#### 【代码对应】

```typescript
// 补充到 CombatLogSystem.ts 中
export class CombatLogSystem {
  private _logs: string[] = [];

  constructor() {
    // 订阅技能打断事件
    EventBus.instance.subscribe<SkillInterruptEvent>(
      'SkillInterruptEvent',
      (e) =>
        this._addLog(
          `【打断】${e.target.name}神识爆发，打断了${e.caster.name}的【${e.ability.name}】！`,
        ),
      EventPriorityLevel.COMBAT_LOG,
    );

    // 订阅闪避/抵抗事件
    EventBus.instance.subscribe<HitCheckEvent>(
      'HitCheckEvent',
      (e) => {
        if (e.isDodged)
          this._addLog(
            `【闪避】${e.target.name}身法灵动，躲开了${e.caster.name}的【${e.ability.name}】！`,
          );
        if (e.isResisted)
          this._addLog(
            `【抵抗】${e.target.name}神识稳固，抵抗了${e.caster.name}的【${e.ability.name}】！`,
          );
      },
      EventPriorityLevel.COMBAT_LOG,
    );

    // 订阅伤害事件
    EventBus.instance.subscribe<DamageTakenEvent>(
      'DamageTakenEvent',
      (e) => {
        this._addLog(
          `【伤害】${e.caster.name}对${e.target.name}造成${e.damageTaken}点伤害，${e.target.name}剩余气血${e.remainHealth}！`,
        );
        if (e.remainHealth <= 0) {
          this._addLog(
            `【击杀】${e.caster.name}击杀了${e.target.name}，战斗胜利！`,
          );
        }
      },
      EventPriorityLevel.COMBAT_LOG,
    );
  }

  private _addLog(log: string): void {
    this._logs.push(log);
    console.log(log); // 控制台输出，也可返回给前端渲染
  }
}
```

#### 【关键校验】

- 战报系统的优先级必须是全流程最低，保证所有逻辑执行完毕后再输出，避免出现「战报先出，伤害后改」的bug
- 分极简/详细两种战报模式，对应纯文字游戏的不同玩家需求

---

## 三、核心避坑指南（TS架构专属）

1.  **事件必须同步执行**：`EventBus`的`publish`必须是同步执行，不能用异步，否则会出现时序混乱（比如伤害已经应用了，打断才触发）
2.  **事件只读原则**：除了专门设计的可修改字段（比如`isInterrupted`、`finalDamage`），事件的其他字段必须设为`readonly`，禁止下游订阅者修改
3.  **属性修改唯一入口**：所有属性修改必须通过`AttributeSet`的`addModifier/removeModifier`和`Unit`的`takeDamage`等方法，禁止外部直接修改属性值
4.  **事件幂等性**：同一个事件多次发布，不能导致逻辑重复执行，必须加唯一ID和执行标记
5.  **内存泄漏防控**：战斗结束后，必须调用`EventBus.unsubscribe`取消所有战斗相关的订阅，避免内存泄漏（尤其是镜像战斗的频繁创建销毁）
