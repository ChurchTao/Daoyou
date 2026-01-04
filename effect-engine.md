针对修仙类游戏（属性繁杂、机制多变）并要求高扩展性和统一管理，最适合的架构模式是 **“事件驱动（Event-Driven）” + “管道/中间件模式（Pipeline/Middleware）”** 的结合。

为了满足你的三个核心需求，我们需要将“效果（Effect）”抽象为系统中最小的原子单位，不仅用于战斗伤害，也用于属性修正和系统判定。

以下是设计方案：

### 核心设计理念：一切皆效果 (Everything is an Effect)

我们将“攻击造成伤害”、“装备增加暴击”、“命格增加突破率”统一抽象为 `Effect`。引擎的核心工作是：**在特定的时机（Trigger），收集所有相关的效果，并传入当前的上下文（Context）进行计算。**

### 1. 核心数据结构设计 (Type Definitions)

首先定义基础的枚举和上下文，这是“动态数值”和“统一引擎”的基础。

```typescript
// 1. 触发时机 (Trigger)：决定效果何时生效
enum EffectTrigger {
  ON_STAT_CALC = 'ON_STAT_CALC', // 计算属性时 (被动、装备词条)
  ON_SKILL_HIT = 'ON_SKILL_HIT', // 技能命中时 (主动技能)
  ON_TURN_START = 'ON_TURN_START', // 回合开始 (Dot伤害)
  ON_BREAKTHROUGH = 'ON_BREAKTHROUGH', // 突破时 (先天命格)
}

// 2. 运行时上下文 (Context)：包含来源、目标、当前数值
// 满足需求3：通过Context获取属性，实现动态数值
interface EffectContext {
  source: Entity; // 施法者/装备持有者
  target?: Entity; // 目标 (如果是自身强化，target=source)
  trigger: EffectTrigger;

  // 动态数据：用于管道传递，比如当前正在计算的“攻击力”数值，或者造成的“初始伤害”
  value?: number;
  metadata?: any; // 额外参数，如技能ID、突破境界等级等
}

// 3. 实体接口 (简化版)
interface Entity {
  id: string;
  attributes: Map<string, number>;
  // ... 其他属性
}
```

### 2. 抽象基类：BaseEffect (满足需求 2)

这是所有效果的父类。只需要继承它，就能扩展新功能。

```typescript
abstract class BaseEffect {
  // 效果的唯一标识，用于配置表或调试
  abstract id: string;
  // 该效果监听的触发时机
  abstract trigger: EffectTrigger;
  // 优先级：决定计算顺序（例如：先加固定数值，再乘百分比）
  priority: number = 0;

  constructor(protected config: any = {}) {}

  // 核心逻辑：是否满足触发条件（例如：只有火属性技能才触发）
  shouldTrigger(ctx: EffectContext): boolean {
    return true;
  }

  // 核心逻辑：执行效果
  // 满足需求3：具体的数值逻辑在这里编写
  abstract apply(ctx: EffectContext): void;
}
```

### 3. 具体效果实现 (满足需求 1 & 3)

我们来看看不同来源的效果是如何通过同一个基类实现的。

#### A. 被动/装备词条：属性修正 (Stat Modifier)

例如：增加暴击率 10%，或根据力量增加攻击力。

```typescript
class StatModifierEffect extends BaseEffect {
  id = 'StatModifier';
  trigger = EffectTrigger.ON_STAT_CALC;

  constructor(
    private targetStat: string, // 要修改的属性，如 'CritRate'
    private valType: 'fixed' | 'percent', // 固定值还是百分比
    private valueOrFormula: number | ((ctx: EffectContext) => number), // 支持固定值或函数
  ) {
    super();
  }

  shouldTrigger(ctx: EffectContext): boolean {
    // 只有在计算指定属性时才触发
    return ctx.metadata?.statName === this.targetStat;
  }

  apply(ctx: EffectContext): void {
    // 满足需求3：动态计算数值
    let addValue = 0;
    if (typeof this.valueOrFormula === 'function') {
      addValue = this.valueOrFormula(ctx);
    } else {
      addValue = this.valueOrFormula;
    }

    // 修改上下文中的值
    if (this.valType === 'fixed') {
      ctx.value = (ctx.value || 0) + addValue;
    } else {
      ctx.value = (ctx.value || 0) * (1 + addValue);
    }

    console.log(
      `[Effect] ${this.targetStat} 修正: ${addValue}, 当前值: ${ctx.value}`,
    );
  }
}
```

#### B. 主动技能：命中后效果 (Active Skill Effect)

例如：命中后造成基于攻击力的火属性伤害，并施加灼烧。

```typescript
class DamageEffect extends BaseEffect {
  id = 'FireDamage';
  trigger = EffectTrigger.ON_SKILL_HIT;

  apply(ctx: EffectContext): void {
    // 需求3：伤害基于来源的攻击力 * 1.5 + 火属性亲和 * 2
    const sourceAtk = ctx.source.attributes.get('ATK') || 0;
    const fireMastery = ctx.source.attributes.get('FIRE_MASTERY') || 0;

    const damage = sourceAtk * 1.5 + fireMastery * 2.0;

    // 扣除目标血量 (简化逻辑)
    const currentHp = ctx.target?.attributes.get('HP') || 0;
    ctx.target?.attributes.set('HP', currentHp - damage);

    console.log(`[Effect] 造成火属性伤害: ${damage}`);
  }
}

// 施加状态效果（灼烧）
class AddStatusEffect extends BaseEffect {
  id = 'AddBurnStatus';
  trigger = EffectTrigger.ON_SKILL_HIT;

  apply(ctx: EffectContext): void {
    console.log(`[Effect] 目标被施加了 [灼烧] 状态`);
    // 逻辑：向目标身上的 EffectManager 添加一个 DoT 效果
  }
}
```

#### C. 先天命格：系统机制修正 (System Mechanic)

例如：增加突破成功率。

```typescript
class BreakthroughRateEffect extends BaseEffect {
  id = 'Destiny_LuckyStar';
  trigger = EffectTrigger.ON_BREAKTHROUGH;

  apply(ctx: EffectContext): void {
    // 增加 5% 成功率
    ctx.value = (ctx.value || 0) + 0.05;
    console.log(`[Effect] 天赋触发，突破成功率提升至: ${ctx.value}`);
  }
}
```

### 4. 统一效果引擎 (Effect Engine)

这是整个系统的大脑。它不关心效果是来自装备还是技能，它只关心 `Trigger`。

```typescript
class EffectEngine {
  // 存储所有注册的效果，按 Trigger 分类
  // Key: Trigger, Value: List of Effects associated with entities
  // 在实际项目中，这里通常会从 Entity 身上获取 effects

  /**
   * 核心处理函数
   * @param trigger 触发时机
   * @param source 来源实体
   * @param target 目标实体
   * @param initialValue 初始值 (比如基础攻击力，或基础突破概率)
   * @param metadata 额外数据
   */
  process(
    trigger: EffectTrigger,
    source: Entity,
    target: Entity | undefined,
    initialValue: number,
    metadata: any = {},
  ): number {
    // 1. 构建上下文
    const ctx: EffectContext = {
      source,
      target,
      trigger,
      value: initialValue,
      metadata,
    };

    // 2. 收集所有相关的效果列表
    // 这里需要根据游戏逻辑收集：来源身上的被动、装备词条、Buff + 目标身上的抗性、盾牌等
    const effects = this.collectEffects(source, target);

    // 3. 筛选与排序
    const activeEffects = effects
      .filter((e) => e.trigger === trigger && e.shouldTrigger(ctx))
      .sort((a, b) => a.priority - b.priority); // 比如先加算后乘算

    // 4. 依次执行
    for (const effect of activeEffects) {
      effect.apply(ctx);
    }

    return ctx.value || 0;
  }

  // 模拟：从实体身上收集所有效果
  private collectEffects(source: Entity, target?: Entity): BaseEffect[] {
    // 实际项目中，这里会遍历 source.equipments.effects, source.passives, source.buffs 等
    // 为了演示，我们硬编码返回一些效果
    return [
      // 假设这是装备上的词条
      new StatModifierEffect('ATK', 'percent', 0.1),
      // 假设这是先天命格：当灵力>100时，攻击力额外+50
      new StatModifierEffect('ATK', 'fixed', (ctx) => {
        const mana = ctx.source.attributes.get('MANA') || 0;
        return mana > 100 ? 50 : 0;
      }),
    ];
  }
}
```

### 5. 使用演示

看看这个架构如何运作：

```typescript
// --- 初始化 ---
const engine = new EffectEngine();

const player: Entity = {
  id: 'p1',
  attributes: new Map([
    ['ATK_BASE', 100],
    ['MANA', 150],
  ]),
};

const enemy: Entity = {
  id: 'e1',
  attributes: new Map([['HP', 1000]]),
};

// --- 场景 1: 计算面板攻击力 ---
// 需求：基础100 + 装备10% + 天赋(蓝量>100则+50)
// 预期：(100 + 50) * 1.1 = 165 (假设优先级控制得当，或者全乘/全加)
// 或者是 (100 * 1.1) + 50，看 priority 设定

console.log('--- 开始计算攻击力 ---');
const finalAtk = engine.process(
  EffectTrigger.ON_STAT_CALC,
  player,
  undefined,
  player.attributes.get('ATK_BASE')!,
  { statName: 'ATK' }, // 告诉效果我们在算 ATK
);
console.log(`最终攻击力: ${finalAtk}`);

// --- 场景 2: 扩展新效果 (不需要改引擎) ---
// 策划需求：新增一个“雷劫”机制，突破时如果罪恶值>10，成功率降低20%

class ThunderTribulationEffect extends BaseEffect {
  id = 'ThunderTribulation';
  trigger = EffectTrigger.ON_BREAKTHROUGH;

  apply(ctx: EffectContext): void {
    const sin = ctx.source.attributes.get('SIN') || 0;
    if (sin > 10) {
      ctx.value = (ctx.value || 0) - 0.2;
      console.log('罪恶值过高，雷劫降临，成功率大幅下降！');
    }
  }
}

// 只需要将这个 Effect 挂载到角色身上即可，engine.process(ON_BREAKTHROUGH...) 会自动执行它。
```

### 架构优势总结

1. **统一性 (Unified):** 无论是计算属性面板（数值修正），还是战斗中的技能效果（逻辑执行），还是系统层面的突破概率，全部走 `engine.process`。
2. **高扩展 (Extensible):** 新增一个“根据天气增加水属性伤害”的效果，只需要写一个类继承 `BaseEffect`，并在 `apply` 里写逻辑。完全不需要修改 `EffectEngine` 或战斗流程代码。
3. **动态性 (Dynamic):** 通过 `(ctx) => number` 的回调函数形式，词条的数值可以是固定的，也可以是基于任何运行时状态（如对手血量、当前回合数）计算出来的。
