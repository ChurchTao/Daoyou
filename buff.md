在的架构中，**Buff（状态）本质上是一个“带有生命周期（Duration）和层数（Stack）的效果容器”**。

它不仅仅是一个简单的标记，而是连接战斗时间轴和效果引擎的桥梁。

### 1. 核心概念：Buff 只是容器

我们需要明确 `Buff` 和 `Effect` 的关系：

- **Effect (原子效果)**：增加 10 攻击力 / 每回合扣 50 血。
- **Buff (容器)**：名字叫“狂暴”，持续 3 回合，包含 [增加攻击力 Effect, 降低防御力 Effect]。

### 2. 代码设计：Buff 系统

首先定义 Buff 的配置和运行时实例。

```typescript
// --- 1. Buff 的静态配置 (策划填表) ---
interface BuffConfig {
  id: string;
  name: string;
  maxStacks: number; // 最大叠加层数
  duration: number; // 持续回合数
  // 叠加策略: 'refresh' (刷新时间), 'stack' (叠加层数), 'independent' (独立存在)
  stackType: 'refresh' | 'stack';
  // Buff 携带的效果列表
  effects: BaseEffect[];
}

// --- 2. Buff 的运行时实例 (内存对象) ---
class BuffInstance {
  public currentStacks: number = 1;
  public remainingTurns: number;

  constructor(
    public config: BuffConfig,
    public caster: Entity, // 施法者 (用于结算伤害来源，比如这是谁下的毒)
    public owner: Entity, // 持有者 (谁身上挂着这个Buff)
  ) {
    this.remainingTurns = config.duration;
  }

  // 刷新逻辑
  addStack() {
    if (this.config.stackType === 'stack') {
      this.currentStacks = Math.min(
        this.currentStacks + 1,
        this.config.maxStacks,
      );
    }
    // 无论如何，通常都会刷新持续时间
    this.remainingTurns = this.config.duration;
  }
}
```

### 3. 核心逻辑：BuffManager

每个 `Entity` 都会持有一个 `BuffManager`，负责管理增删改查。

```typescript
class BuffManager {
  // 存储当前生效的 Buff，Key 为 BuffID
  private buffs: Map<string, BuffInstance> = new Map();

  constructor(private owner: Entity) {}

  /**
   * 施加 Buff
   * @param config Buff配置
   * @param caster 施法者 (如果是自己喝药，caster就是自己)
   */
  addBuff(config: BuffConfig, caster: Entity) {
    const existingBuff = this.buffs.get(config.id);

    if (existingBuff) {
      // 已存在：执行叠加/刷新逻辑
      existingBuff.addStack();
      console.log(
        `[Buff] ${this.owner.id} 的 [${config.name}] 刷新/叠加. 当前层数: ${existingBuff.currentStacks}`,
      );
    } else {
      // 新增
      const newBuff = new BuffInstance(config, caster, this.owner);
      this.buffs.set(config.id, newBuff);
      console.log(`[Buff] ${this.owner.id} 获得了状态 [${config.name}]`);
    }
  }

  /**
   * 移除指定 Buff
   */
  removeBuff(buffId: string) {
    if (this.buffs.delete(buffId)) {
      console.log(`[Buff] ${this.owner.id} 的 [${buffId}] 消失了`);
    }
  }

  /**
   * 回合流逝 (Tick)
   * 通常在回合结束时调用
   */
  tick() {
    // 遍历所有 Buff，减少持续时间
    for (const [id, buff] of this.buffs) {
      buff.remainingTurns--;
      if (buff.remainingTurns <= 0) {
        this.removeBuff(id);
      }
    }
  }

  /**
   * --- 关键集成点 ---
   * 获取当前所有 Buff 提供的所有 Effect
   * 供 EffectEngine 收集使用
   */
  getAllEffects(): BaseEffect[] {
    const allEffects: BaseEffect[] = [];

    for (const buff of this.buffs.values()) {
      // 这里有个精妙的处理：
      // Buff 里的 Effect 可能需要知道当前的层数 (stacks)
      // 我们可以在这里对 Effect 做一层动态代理，或者在 Effect.apply 里读取 buff 信息
      // 为了简单，我们直接把 Buff 里的 Effect 拿出来

      // *高级技巧*：如果 Effect 需要根据层数变强（如每层增加10攻击），
      // 我们可以在 Context 里通过 metadata 传递层数，或者由 BuffInstance 生成临时的 Effect

      allEffects.push(
        ...buff.config.effects.map((effect) => {
          // 给 Effect 打上标记，让它知道自己来自哪个 Buff (方便后续逻辑获取层数)
          // 注意：JS中对象是引用，实际工程中最好 clone 一份或者使用 Context 传递
          return effect;
        }),
      );
    }
    return allEffects;
  }

  // 获取指定 Buff 的实例 (供 Effect 内部查询层数用)
  getBuff(buffId: string): BuffInstance | undefined {
    return this.buffs.get(buffId);
  }
}
```

### 4. 融合：修改 EffectEngine 与 BattleEngine

现在我们需要把这个 Manager 接入到之前的系统中。

#### A. 修改 EffectEngine 的收集逻辑

引擎不再是“凭空”收集效果，而是去问 BuffManager 要。

```typescript
// class EffectEngine ...

  // 修改之前的 collectEffects 方法
  private collectEffects(source: Entity, target?: Entity): BaseEffect[] {
    const effects: BaseEffect[] = [];

    // 1. 收集 Source (施法者/攻击者) 身上的效果
    // 包括：装备、被动技能、**Buff**
    if (source.buffManager) {
      effects.push(...source.buffManager.getAllEffects());
    }
    // ... push source.equipments ... source.passives ...

    // 2. 收集 Target (受击者/目标) 身上的效果
    // 包括：防御型Buff (护盾)、抗性被动等
    if (target && target.buffManager) {
       effects.push(...target.buffManager.getAllEffects());
    }

    return effects;
  }

```

#### B. 修改 BattleEngine 的流程

在合适的时间点驱动 BuffManager。

```typescript
// class BattleEngine ...

  private async runTurn(attacker: Entity, defender: Entity) {
    // 1. 回合开始：触发 DOT (Damage Over Time)
    // 此时 Buff 还在，EffectEngine 会收集到 "中毒" Effect 并执行
    this.effectEngine.process(EffectTrigger.ON_TURN_START, attacker, defender, 0);

    // ... 技能释放流程 ...

    // 2. 回合结束：驱动时间流逝
    // 减少 Buff 回合数，移除过期 Buff
    attacker.buffManager.tick();

    // 触发回合结束效果 (如回血 Buff)
    this.effectEngine.process(EffectTrigger.ON_TURN_END, attacker, defender, 0);
  }

```

### 5. 实战演示：设计一个“叠毒” Buff

我们要实现：**【剧毒】**：每回合开始扣除 `(层数 * 10)` 点血量，最多叠 5 层，持续 3 回合。

这个需求完美展示了架构的动态性。

#### 第一步：编写毒的效果 (PoisonEffect)

```typescript
class PoisonDamageEffect extends BaseEffect {
  id = 'PoisonDamage';
  trigger = EffectTrigger.ON_TURN_START;

  apply(ctx: EffectContext): void {
    // 1. 获取 Buff 实例以读取层数
    // 注意：ctx.source 是当前行动的角色（中毒者）
    const buff = ctx.source.buffManager.getBuff('buff_poison');

    if (buff) {
      const stacks = buff.currentStacks;
      const damage = stacks * 10; // 伤害公式

      const currentHp = ctx.source.attributes.get('HP') || 0;
      ctx.source.attributes.set('HP', currentHp - damage);

      console.log(`[Buff生效] 剧毒发作 (${stacks}层)，扣除 ${damage} 血量`);
    }
  }
}
```

#### 第二步：配置 Buff

```typescript
const poisonBuffConfig: BuffConfig = {
  id: 'buff_poison',
  name: '剧毒',
  maxStacks: 5,
  duration: 3,
  stackType: 'stack',
  effects: [new PoisonDamageEffect()], // 将效果装入容器
};
```

#### 第三步：在战斗中应用

当某个技能命中时：

```typescript
// 假设这是技能命中后的逻辑
// 施法者是 enemy, 目标是 player
player.buffManager.addBuff(poisonBuffConfig, enemy);
```

### 6. 进阶：如何处理“属性加成”随“层数”变化？

如果 Buff 是【战意】：每层增加 10 点攻击力。

之前的 `StatModifierEffect` 是固定的数值，怎么让它读取 Buff 层数？我们利用 `valueOrFormula` 的函数特性。

```typescript
// 定义战意 Buff 的效果
const battleSpiritEffect = new StatModifierEffect(
  'ATK',
  'fixed',
  (ctx: EffectContext) => {
    // 在计算属性时，去查询自身 Buff 状态
    const buff = ctx.source.buffManager.getBuff('buff_battle_spirit');
    const stacks = buff ? buff.currentStacks : 0;
    return stacks * 10; // 动态返回数值：层数 * 10
  },
);

const battleSpiritBuff: BuffConfig = {
  id: 'buff_battle_spirit',
  name: '战意',
  maxStacks: 10,
  duration: 5,
  stackType: 'stack',
  effects: [battleSpiritEffect],
};
```

### 架构全景图

现在你的架构非常完整：

1. **EffectEngine**: 纯粹的计算器，处理 `Trigger` 和 `Effect`。
2. **Entity**: 拥有 `Attributes` 和 `BuffManager`。
3. **BuffManager**: 维护 `Buff` 生命周期，并向引擎提供 `Effect`。
4. **BattleEngine**: 推动时间轴，在关键节点调用 `EffectEngine`。
