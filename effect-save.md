这是一个关于**数据持久化（Storage）**与**运行时对象（Runtime Object）**如何映射的问题。

在代码架构设计中，我们需要严格区分 **“静态配置数据” (Config/Data)** 和 **“运行时实例” (Instance)**。

设计核心原则：**所有系统（装备、功法、命格）本质上都是“效果容器（Effect Container）”**，区别在于它们的生命周期、成长方式和触发逻辑不同。

以下是具体的存储与代码结构设计：

### 1. 基础：效果的序列化 (Serialization)

数据库或配置文件（JSON）里无法存储 `new DamageEffect()` 这样的代码。我们需要一种标准格式来存储效果。

### 2. 四大系统的具体存储设计

我们将每个系统分为 **Config (配置表数据)** 和 **Instance (玩家身上的实例)**。

#### A. 装备 (Equipment) - 法宝

特点：有强化等级、品质，属性会随等级成长。

- **Config (Static)**:

```typescript
interface EquipmentConfig {
  id: string; // 如 "sword_fire_01"
  name: string; // 如 "赤炎剑"
  slot: 'weapon' | 'armor' | 'accessory';

  // 基础属性模版 (用于生成 Runtime Effects)
  baseEffects: EffectConfig[];
  // 成长系数 (例如每级增加多少)
  growthPerLevel: number;
}
```

- **Instance (Runtime)**:

```typescript
class EquipmentInstance {
  uid: string; // 实例唯一ID (区分两把相同的剑)
  configId: string; // 关联配置ID
  level: number = 1; // 强化等级
  refinement: number = 0; // 精炼等级

  constructor(public config: EquipmentConfig) {}

  // --- 关键：动态生成效果 ---
  getEffects(): BaseEffect[] {
    // 装备的数值通常 = 基础值 + (等级 * 成长值)
    return this.config.baseEffects.map((effConfig) => {
      // 这里需要一个工厂方法将 Config 转为 Effect 类
      const effect = EffectFactory.create(effConfig);
      // 根据等级修正数值 (这是装备特有的逻辑)
      if (effect instanceof StatModifierEffect) {
        // 假设逻辑：基础值 * (1 + 等级 * 0.1)
        // 注意：这里是对 Effect 内部数值的动态修正，或者在 Effect 内部读取装备 level
        effect.setScaling(this.level);
      }
      return effect;
    });
  }
}
```

#### B. 功法 (Passive Skill) - 被动

特点：通常作为一种“开关”存在，可能有“层数”或“境界”概念（第一层、第二层）。

- **Config**:

```typescript
interface GongfaConfig {
  id: string; // "gongfa_qingyun"
  name: string; // "青云诀"
  maxLevel: number;
  // 每一层对应的效果列表
  // Key: 等级, Value: 效果列表
  levelEffects: Record<number, EffectConfig[]>;
}
```

- **Instance**:

```typescript
class GongfaInstance {
  id: string;
  currentLevel: number = 1; // 当前修炼到了第几层

  constructor(public config: GongfaConfig) {}

  getEffects(): BaseEffect[] {
    // 获取当前等级及之前所有等级的效果 (或者只生效当前等级，看设定)
    // 假设是累加生效：
    const activeEffects: BaseEffect[] = [];
    for (let i = 1; i <= this.currentLevel; i++) {
      const configs = this.config.levelEffects[i];
      if (configs) {
        activeEffects.push(...configs.map((c) => EffectFactory.create(c)));
      }
    }
    return activeEffects;
  }
}
```

#### C. 主动技能 (Active Skill) - 神通

特点：主要在战斗逻辑中通过“释放”来生效

- **Config**:

```typescript
interface SkillConfig {
  id: string;
  name: string;
  cooldown: number;
  cost: number;

  // 1. 主动释放时产生的效果 (伤害、Buff)
  activeEffects: EffectConfig[];
}
```

- **Instance**:

```typescript
class SkillInstance {
  currentCd: number = 0; // 战斗内状态

  constructor(public config: SkillConfig) {}

  // 获取“主动释放”的效果 (传给 BattleEngine 执行)
  getActiveEffects(): BaseEffect[] {
    return this.config.activeEffects.map((c) => EffectFactory.create(c));
  }
}
```

#### D. 先天命格 (Talent)

特点：不可变，开局生成，全局生效。

- **Config**:

```typescript
interface TalentConfig {
  id: string; // "talent_born_strong"
  name: string; // "天生神力"
  effects: EffectConfig[];
}
```

- **Instance**: 通常不需要复杂的 Instance 类，只需要存 Config 引用即可，因为没有状态变化。

---

### 3. 统一管理：PlayerEntity 的存储结构

现在我们将它们组装到 `Entity` 身上。为了方便 `EffectEngine` 收集，我们需要标准化的接口。

```typescript
// 定义一个接口，表明谁能提供效果
interface IEffectProvider {
  getEffects(): BaseEffect[];
}

class PlayerEntity implements Entity {
  id: string;
  attributes: Map<string, number> = new Map();

  // --- 存储容器 ---
  equipments: EquipmentInstance[] = [];
  gongfas: GongfaInstance[] = [];
  skills: SkillInstance[] = []; // 装备在栏位上的技能
  talents: TalentConfig[] = []; // 命格通常直接存配置引用
  buffManager: BuffManager; // 之前设计的

  constructor() {
    this.buffManager = new BuffManager(this);
  }

  // --- 核心：聚合所有效果来源 ---
  // 这是 EffectEngine 唯一需要调用的方法
  public collectAllEffects(): BaseEffect[] {
    const allEffects: BaseEffect[] = [];

    // 1. 装备
    this.equipments.forEach((eq) => allEffects.push(...eq.getEffects()));

    // 2. 功法
    this.gongfas.forEach((gf) => allEffects.push(...gf.getEffects()));

    // 3. 技能 (只取被动部分，主动部分由 BattleEngine 触发)
    this.skills.forEach((sk) => allEffects.push(...sk.getPassiveEffects()));

    // 4. 命格
    this.talents.forEach((t) => {
      allEffects.push(...t.effects.map((c) => EffectFactory.create(c)));
    });

    // 5. Buff
    allEffects.push(...this.buffManager.getAllEffects());

    return allEffects;
  }
}
```

### 4. 数据库存储结构 (参考)

在 MongoDB 或 MySQL 中，玩家数据的存储格式如下：

```json
// Player Document
{
  "_id": "player_123",
  "name": "韩立",
  "level": 10,

  // 只需要存 引用ID 和 动态状态
  "equipments": [
    { "uid": "uuid_1", "configId": "sword_01", "level": 5 },
    { "uid": "uuid_2", "configId": "armor_01", "level": 3 }
  ],

  "gongfas": [{ "configId": "gf_qingyun", "currentLevel": 2 }],

  "skills": ["skill_fireball", "skill_dodge"], // 技能栏位

  "talents": ["talent_lucky", "talent_strong"] // 初始随机生成的ID列表
}
```

### 5. 工厂模式：连接配置与代码

最后，你需要一个 `EffectFactory` 来把 JSON 配置转换成 TypeScript 类实例。

```typescript
class EffectFactory {
  static create(config: EffectConfig): BaseEffect {
    switch (config.type) {
      case 'StatModifier':
        return new StatModifierEffect(
          config.params.stat,
          config.params.type,
          config.params.value,
        );
      case 'Damage':
        return new DamageEffect(config.params);
      case 'AddBuff':
        return new AddBuffEffect(config.params);
      // ... 更多类型
      default:
        console.warn(`Unknown effect type: ${config.type}`);
        return new NoOpEffect();
    }
  }
}
```

### 总结

1. **数据分离**：

- **Config** (JSON) 存静态数据（基础数值、名称）。
- **Instance** (Class) 存动态数据（等级、CD）。

2. **统一接口**：

- 装备、功法、技能、命格都实现（或具备）类似 `getEffects()` 的方法。

3. **聚合收集**：

- `Entity` 提供 `collectAllEffects()` 方法，一次性遍历这四个列表，加上 BuffManager 的内容，打包丢给 `EffectEngine`。

这样设计后，如果后续要加一个“法宝器灵”系统，或者“宠物”系统，你只需要增加一个 `PetInstance` 类，并在 `Entity.collectAllEffects` 里把它加上即可，完全无需重构底层。
