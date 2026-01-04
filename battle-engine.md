将 `EffectEngine`（效果引擎）集成到 **战斗引擎（Battle Engine）** 中，核心思想是将战斗流程看作一条**“时间轴”**，在时间轴的关键节点上埋下**“钩子（Hooks）”**。

战斗引擎不再直接写死逻辑（比如 `hp -= atk`），而是负责**调度流程**并**向效果引擎发起询问**。

以下是具体的架构设计与代码实现：

### 1. 架构逻辑图：战斗流程与效果引擎的交互

在 1v1 修仙战斗中，一个回合的流程通常如下，箭头表示战斗引擎调用效果引擎的时机：

```mermaid
graph TD
    Start[回合开始] --> T_Start[触发: ON_TURN_START]
    T_Start --> CheckControl[检测控制状态(眩晕/冰冻)]
    CheckControl -- 被控 --> T_End
    CheckControl -- 未被控 --> SelectSkill[选择/释放技能]

    SelectSkill --> CalcHit[触发: ON_CALC_HIT_RATE (计算命中)]
    CalcHit -- 命中 --> ExecuteSkill[执行技能效果列表]

    subgraph 技能执行循环
        ExecuteSkill --> PreDmg[触发: ON_BEFORE_DAMAGE (计算增伤/暴击)]
        PreDmg --> ApplyDmg[应用实际伤害]
        ApplyDmg --> PostHit[触发: ON_SKILL_HIT (吸血/反伤/附加状态)]
    end

    CalcHit -- 闪避 --> T_Dodge[触发: ON_DODGE]

    ExecuteSkill --> T_End[触发: ON_TURN_END]
    T_Dodge --> T_End
    T_End --> NextTurn[下一回合]

```

### 2. 核心数据结构扩展

为了支持战斗，我们需要扩展之前的定义，引入**技能（Skill）**和**战斗实体（BattleEntity）**的概念。

```typescript
// 扩展触发时机，覆盖战斗全流程
enum EffectTrigger {
  // ... 之前的定义
  ON_TURN_START = 'ON_TURN_START',
  ON_TURN_END = 'ON_TURN_END',
  ON_CALC_HIT_RATE = 'ON_CALC_HIT_RATE', // 计算命中率时
  ON_BEFORE_DAMAGE = 'ON_BEFORE_DAMAGE', // 造成伤害前 (计算暴击、最终伤害修正)
  ON_AFTER_DAMAGE = 'ON_AFTER_DAMAGE', // 造成伤害后 (吸血、反伤)
  ON_DODGE = 'ON_DODGE', // 闪避时
}

// 技能定义：技能本质上是一个“效果容器”
interface Skill {
  id: string;
  name: string;
  description: string;
  // 技能包含的一组基础效果（如：造成100%攻击力的伤害，30%概率施加灼烧）
  effects: BaseEffect[];
}

// 战斗日志 (用于前端展示)
interface BattleLog {
  turn: number;
  message: string;
}
```

### 3. 战斗引擎实现 (BattleEngine)

这是控制战斗流程的指挥官。请注意它如何使用 `effectEngine` 来处理具体数值。

```typescript
class BattleEngine {
  private turnCount: number = 0;
  private isBattleOver: boolean = false;
  private logs: BattleLog[] = [];

  constructor(
    private player: Entity,
    private enemy: Entity,
    private effectEngine: EffectEngine, // 注入之前的效果引擎
  ) {}

  // --- 核心：回合流转 ---
  public async startBattle() {
    while (!this.isBattleOver && this.turnCount < 50) {
      this.turnCount++;
      this.log(`--- 第 ${this.turnCount} 回合 ---`);

      // 1. 玩家行动
      await this.runTurn(this.player, this.enemy);
      if (this.checkWin()) break;

      // 2. 敌人行动
      await this.runTurn(this.enemy, this.player);
      if (this.checkWin()) break;
    }
  }

  // --- 单个角色的回合逻辑 ---
  private async runTurn(attacker: Entity, defender: Entity) {
    // 1. 回合开始阶段 (处理 Dot 伤害，如灼烧、中毒)
    // 这里的 value 传入 0，因为通常 Dot 伤害是效果内部计算的
    this.effectEngine.process(
      EffectTrigger.ON_TURN_START,
      attacker,
      defender,
      0,
    );

    // 检查是否存活
    if (attacker.attributes.get('HP')! <= 0) return;

    // 2. 选择技能 (这里简化为固定普攻，实际可接 AI 或玩家输入)
    const skill = this.selectSkill(attacker);
    this.log(`${attacker.id} 使用了神通 [${skill.name}]`);

    // 3. 执行技能
    this.castSkill(skill, attacker, defender);

    // 4. 回合结束阶段 (处理 Buff 移除等)
    this.effectEngine.process(EffectTrigger.ON_TURN_END, attacker, defender, 0);
  }

  // --- 核心：释放技能 (结合点) ---
  private castSkill(skill: Skill, source: Entity, target: Entity) {
    // A. 命中判定
    // 基础命中率 100% + 自身命中加成 - 目标闪避
    // 我们把这个计算委托给引擎，方便处理“必定命中”等特殊效果
    const baseHitRate = 1.0;
    const finalHitRate = this.effectEngine.process(
      EffectTrigger.ON_CALC_HIT_RATE,
      source,
      target,
      baseHitRate,
    );

    if (Math.random() > finalHitRate) {
      this.log(`但是被 ${target.id} 闪避了！`);
      this.effectEngine.process(EffectTrigger.ON_DODGE, source, target, 0);
      return;
    }

    // B. 命中成功，执行技能携带的所有效果
    // 技能里的效果通常包括：伤害效果、Buff效果
    for (const effect of skill.effects) {
      // 注意：这里我们手动调用 effect.apply
      // 或者，更优雅的方式是把 skill.effects 临时注册到 engine 中统一 process
      // 但为了流程清晰，我们这里直接处理伤害类的效果

      if (effect instanceof DamageEffect) {
        this.resolveDamage(effect, source, target);
      } else {
        // 处理其他效果，如施加 Buff
        // 创建临时的 Context 并在此时立即触发
        const ctx = {
          source,
          target,
          trigger: EffectTrigger.ON_SKILL_HIT,
          value: 0,
        };
        effect.apply(ctx);
      }
    }

    // C. 技能结束后触发 (如：吸血、反伤)
    // 此时不需要特定 value，只是通知系统“技能打完了，有人要触发被动吗？”
    this.effectEngine.process(EffectTrigger.ON_AFTER_DAMAGE, source, target, 0);
  }

  // --- 伤害结算流程 (最复杂的管道) ---
  private resolveDamage(
    damageEffect: BaseEffect,
    source: Entity,
    target: Entity,
  ) {
    // 1. 获取基础伤害 (由技能本身的逻辑决定，比如 150% 攻击力)
    // 我们构造一个上下文让 DamageEffect 算出原始伤害
    const rawCtx = {
      source,
      target,
      trigger: EffectTrigger.ON_SKILL_HIT,
      value: 0,
    };
    damageEffect.apply(rawCtx);
    let damage = rawCtx.value || 0;

    // 2. 伤害修正管道 (暴击、属性克制、穿透)
    // 这里触发 ON_BEFORE_DAMAGE，让双方的 被动/装备 介入修改 damage
    // 例如：装备提供了 +20% 最终伤害，或者敌人有 -10% 的减伤盾
    damage = this.effectEngine.process(
      EffectTrigger.ON_BEFORE_DAMAGE,
      source,
      target,
      damage,
      { damageType: 'fire' }, // 传入元数据
    );

    // 3. 最终扣血
    damage = Math.floor(damage);
    const currentHp = target.attributes.get('HP') || 0;
    target.attributes.set('HP', Math.max(0, currentHp - damage));

    this.log(
      `-> 造成了 ${damage} 点伤害 (剩余HP: ${target.attributes.get('HP')})`,
    );
  }

  // 辅助方法
  private log(msg: string) {
    console.log(msg); // 实际中推入 logs 数组
  }

  private checkWin(): boolean {
    if ((this.player.attributes.get('HP') || 0) <= 0) {
      this.log('玩家 败北');
      this.isBattleOver = true;
      return true;
    }
    if ((this.enemy.attributes.get('HP') || 0) <= 0) {
      this.log('玩家 胜利');
      this.isBattleOver = true;
      return true;
    }
    return false;
  }

  private selectSkill(entity: Entity): Skill {
    // 简化逻辑：返回普攻
    return {
      id: 'attack',
      name: '普通攻击',
      description: '造成 100% 攻击力的伤害',
      effects: [
        // 这里复用了上一轮对话中的 DamageEffect，但需要稍微改造以支持传入倍率
        new DamageEffect({ multiplier: 1.0 }),
      ],
    };
  }
}
```

### 4. 关键点：如何解耦“具体玩法”与“引擎”

在上述代码中，请注意 `resolveDamage` 方法的设计。

1. **原始伤害计算**：由 `Skill` 自身携带的 Effect 决定（我是火球术，我算出来是 500 点火伤）。
2. **全局修正**：由 `effectEngine.process(ON_BEFORE_DAMAGE, ...)` 决定。

- **被动技能**：如果角色有个被动“对火属性伤害免疫 50%”，它会监听 `ON_BEFORE_DAMAGE`，发现 metadata 里是 fire，于是 `ctx.value *= 0.5`。
- **装备词条**：如果武器有个词条“暴击时伤害翻倍”，它监听 `ON_BEFORE_DAMAGE`，判断随机数是否暴击，如果暴击则 `ctx.value *= 2`。
- **Buff**：如果身上有“虚弱” Buff，监听 `ON_BEFORE_DAMAGE`，`ctx.value *= 0.8`。

**战斗引擎不需要知道这些被动、装备的存在，它只是喊了一声：“我要造成伤害了，你们谁要修改数值？”**

### 5. 扩展示例：实现一个复杂的“反伤甲”

如果我们要增加一个“受到伤害时，反射 20% 伤害给攻击者”的效果，完全不需要动 `BattleEngine` 的代码。

```typescript
class ReflectDamageEffect extends BaseEffect {
  id = 'ThornArmor'; // 荆棘甲
  trigger = EffectTrigger.ON_AFTER_DAMAGE; // 监听伤害后

  apply(ctx: EffectContext): void {
    // 上下文中，source 是攻击者，target 是受击者（也就是反伤甲持有者）
    // 注意：在 BattleEngine 调用 process 时，传入的 source 是攻击方
    // 但这个 Effect 是挂在受击方身上的。
    // 在 collectEffects 时，我们需要把双方的效果都收集起来。

    // 假设 metadata 里记录了刚才造成的最终伤害
    const damageTaken = ctx.metadata?.finalDamage || 0;

    if (damageTaken > 0) {
      const reflectDmg = Math.floor(damageTaken * 0.2);

      // 扣除攻击者的血量
      const attackerHp = ctx.source.attributes.get('HP') || 0;
      ctx.source.attributes.set('HP', attackerHp - reflectDmg);

      console.log(`[反伤] 受到攻击，反弹了 ${reflectDmg} 点伤害！`);
    }
  }
}
```

### 总结

这种结合方式的优点：

1. **流程清晰**：`BattleEngine` 只负责大阶段的流转（选技能 -> 算命中 -> 算伤害 -> 结算）。
2. **细节隔离**：具体的数值加减乘除全部在 `Effect` 中完成。
3. **极度灵活**：你想加一个“攻击时 10% 概率偷取对方 10 点灵力”，只需要写一个新的 Effect 监听 `ON_SKILL_HIT`，然后挂在装备或被动列表里即可，战斗核心逻辑一行代码都不用改。
