**在 AIGC 驱动的高自由度系统中，必须有一套稳定、正交、可组合的底层机制作为“修仙宇宙的物理法则”**。否则，每一次新创意都会导致数据模型和战斗逻辑的连锁重构。

下面我将为你设计一套 **完整、自洽、面向未来的文字修仙游戏底层架构**，涵盖：

- ✅ **六大核心维度**（属性、灵根、境界、技能体系、状态系统、物品体系）  
- ✅ **严格的数据模型**（JSON Schema 友好）  
- ✅ **战斗引擎可解析的语义结构**  
- ✅ **AIGC 生成时的约束与自由边界**

---

## 一、整体设计原则

| 原则 | 说明 |
|------|------|
| **正交性** | 每个机制只负责一件事 |
| **可组合性** | 属性 + 灵根 + 功法 + 法宝 → 最终战力 |
| **可枚举性** | 所有类型（元素、状态、技能类型）必须预定义白名单 |
| **可扩展性** | 新增内容只需往列表追加，不改核心逻辑 |
| **AIGC 友好** | LLM 生成时只需从枚举值中选择，无需发明新概念 |

---

## 二、核心机制定义（基石）

### 1. 🌿 元素体系（Element System）
```python
ELEMENTS = ["金", "木", "水", "火", "土", "风", "雷", "冰", "无"]
```
- 所有技能、法宝、灵根必须指定 `element` ∈ ELEMENTS
- 克制关系单独维护（见后文）

---

### 2. 🧬 基础属性（Base Attributes）
每个角色必须拥有以下 **5 项基础属性**（整数，建议范围 10~200）：

| 属性 | 作用 |
|------|------|
| `vitality`（体魄） | 决定伤害减免系数；血量上限 |
| `spirit`（灵力） | 决定法术伤害系数；蓝量上限 |
| `wisdom`（悟性） | 暴击率 = min(10%, (wisdom - 50) / 200)；突破成功率 |
| `speed`（速度） | 决定出手顺序；闪避率 = speed / 400（上限 25%） |
| `willpower`（神识） | 状态抗性 = willpower / 200（如抵抗眩晕、魅惑） |

> 💡 **注意**：不再用“气血/灵力”作为独立资源，而是由属性动态计算。

---

### 3. 🔮 灵根系统（Spiritual Roots）
- 每个角色有 **1~3 个灵根**，每个灵根包含：
  ```json
  {
    "element": "火",
    "strength": 85   // 0~100，影响该元素技能伤害
  }
  ```
- 技能伤害加成公式：
  ```
  element_bonus = 1.0 + (灵根强度 / 100) * 0.5
  ```

---

### 4. 🧘 境界体系（Cultivation Realm）
```python
REALMS = [
  "炼气", "筑基", "金丹", "元婴", "化神",
  "炼虚", "合体", "大乘", "渡劫"
]
```
- 每个境界有：
  - **属性上限**（如筑基期 vitality ≤ 120）
  - **寿命**（如金丹 500 年）
  - **可学习技能等级限制**
- 角色数据中存储：
  ```json
  "realm": "筑基",
  "realm_stage": "后期",  // 初/中/后/圆满
  "age": 42,
  "lifespan": 200        // 当前境界最大寿命
  ```

---

### 5. 📜 技能体系（Abilities）

#### 分为两类：
| 类型 | 说明 | 存储位置 |
|------|------|--------|
| **神通**（Active） | 主动技能，战斗中使用 | `skills` 列表 |
| **功法**（Passive） | 被动加成，永久生效 | `cultivations` 列表 |

#### 神通（Skill）结构：
```json
{
  "id": "sk_001",
  "name": "九霄雷引",
  "type": "attack",          // attack / heal / control / debuff / buff
  "element": "雷",
  "power": 85,               // 基础威力
  "cost": 20,                // 灵力消耗
  "cooldown": 0              // 冷却回合（0=无）
}
```

#### 功法（Cultivation）结构：
```json
{
  "name": "太上忘情诀",
  "bonus": {
    "wisdom": 15,
    "willpower": 10
  },
  "required_realm": "金丹"   // 学习前提
}
```

---

### 6. ⚔️ 状态系统（Status Effects）

#### 增益状态（Buffs）：
- `armor_up`（防御提升）
- `speed_up`
- `crit_rate_up`
- `element_affinity_fire`（火系亲和）

#### 控制状态（Controls）：
- `stun`（眩晕，跳过回合）
- `silence`（禁言，无法使用技能）
- `root`（定身）

#### 异常状态（Debuffs）：
- `burn`（每回合掉血）
- `bleed`
- `poison`
- `armor_down`

> 所有状态名必须来自预定义列表，战斗引擎才能处理。

---

### 7. 🎒 物品体系（Items）

#### 消耗品（Consumables）：
```json
{
  "name": "九转金丹",
  "type": "heal",            // heal / buff / revive / breakthrough
  "effect": {
    "hp_restore": 100,
    "temporary_bonus": { "wisdom": 20, "duration": 3 }  // 持续3回合
  }
}
```

#### 法宝（Artifacts）：
```json
{
  "id": "eq_001",
  "name": "焚天剑",
  "slot": "weapon",          // weapon / armor / accessory
  "element": "火",
  "bonus": { "spirit": 15 },
  "special_effects": [       // 结构化效果（见下文）
    { "type": "on_hit_add_effect", "effect": "burn", "chance": 30 }
  ],
  "curses": [                // 负面效果（可选）
    { "type": "on_use_cost_hp", "amount": 5 }
  ]
}
```

---

## 三、战斗引擎可执行的效果类型（白名单）

为确保 `special_effects` 和 `curses` 可执行，定义以下 **效果类型枚举**：

```python
EFFECT_TYPES = {
  # 伤害相关
  "damage_bonus": {"element", "bonus"},
  "ignore_resistance": {"element", "ratio"},
  
  # 触发式
  "on_hit_add_effect": {"effect", "chance"},
  "on_use_cost_hp": {"amount"},
  "on_low_hp_trigger": {"threshold", "action"},  # action 可是 "self_destruct"
  
  # 环境
  "environment_change": {"env_type"},  # 如 "fire_field"
  
  # 冷却
  "cooldown_reduce": {"skill_type", "reduction"}
}
```

> ✅ LLM 在生成法宝时，只能从这些类型中选择组合。

---

## 四、角色完整数据模型（JSON Schema 核心）

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "title": "Cultivator",
  "required": [
    "name", "gender", "realm", "realm_stage", "age", "lifespan",
    "attributes", "spiritual_roots", "pre_heaven_fates",
    "cultivations", "skills", "inventory", "equipped", "max_skills"
  ],
  "properties": {
    "name": { "type": "string", "minLength": 1 },
    "gender": { "type": "string", "enum": ["男", "女", "无"] },
    "origin": { "type": "string" },
    "personality": { "type": "string" },

    "realm": {
      "type": "string",
      "enum": ["炼气", "筑基", "金丹", "元婴", "化神", "炼虚", "合体", "大乘", "渡劫"]
    },
    "realm_stage": {
      "type": "string",
      "enum": ["初期", "中期", "后期", "圆满"]
    },
    "age": { "type": "integer", "minimum": 0 },
    "lifespan": { "type": "integer", "minimum": 1 },

    "attributes": {
      "type": "object",
      "required": ["vitality", "spirit", "wisdom", "speed", "willpower"],
      "properties": {
        "vitality": { "type": "integer", "minimum": 10, "maximum": 300 },
        "spirit": { "type": "integer", "minimum": 10, "maximum": 300 },
        "wisdom": { "type": "integer", "minimum": 10, "maximum": 300 },
        "speed": { "type": "integer", "minimum": 10, "maximum": 300 },
        "willpower": { "type": "integer", "minimum": 10, "maximum": 300 }
      },
      "additionalProperties": false
    },

    "spiritual_roots": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["element", "strength"],
        "properties": {
          "element": {
            "type": "string",
            "enum": ["金", "木", "水", "火", "土", "风", "雷", "冰", "无"]
          },
          "strength": { "type": "integer", "minimum": 0, "maximum": 100 }
        },
        "additionalProperties": false
      },
      "minItems": 1,
      "maxItems": 3
    },

    "pre_heaven_fates": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["name", "type", "attribute_mod"],
        "properties": {
          "name": { "type": "string" },
          "type": { "type": "string", "enum": ["吉", "凶"] },
          "attribute_mod": {
            "type": "object",
            "properties": {
              "vitality": { "type": "integer" },
              "spirit": { "type": "integer" },
              "wisdom": { "type": "integer" },
              "speed": { "type": "integer" },
              "willpower": { "type": "integer" }
            },
            "additionalProperties": false
          },
          "description": { "type": "string" }
        },
        "additionalProperties": false
      }
    },

    "cultivations": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["name", "bonus"],
        "properties": {
          "name": { "type": "string" },
          "bonus": {
            "type": "object",
            "properties": {
              "vitality": { "type": "integer" },
              "spirit": { "type": "integer" },
              "wisdom": { "type": "integer" },
              "speed": { "type": "integer" },
              "willpower": { "type": "integer" }
            },
            "additionalProperties": false
          },
          "required_realm": {
            "type": "string",
            "enum": ["炼气", "筑基", "金丹", "元婴", "化神", "炼虚", "合体", "大乘", "渡劫"]
          }
        },
        "additionalProperties": false
      }
    },

    "skills": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["id", "name", "type", "element", "power"],
        "properties": {
          "id": { "type": "string" },
          "name": { "type": "string" },
          "type": {
            "type": "string",
            "enum": ["attack", "heal", "control", "debuff", "buff"]
          },
          "element": {
            "type": "string",
            "enum": ["金", "木", "水", "火", "土", "风", "雷", "冰", "无"]
          },
          "power": { "type": "integer", "minimum": 30, "maximum": 150 },
          "cost": { "type": "integer", "minimum": 0 },
          "cooldown": { "type": "integer", "minimum": 0 }
        },
        "additionalProperties": false
      }
    },

    "inventory": {
      "type": "object",
      "required": ["artifacts", "consumables"],
      "properties": {
        "artifacts": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["id", "name", "slot", "element", "bonus"],
            "properties": {
              "id": { "type": "string" },
              "name": { "type": "string" },
              "slot": {
                "type": "string",
                "enum": ["weapon", "armor", "accessory"]
              },
              "element": {
                "type": "string",
                "enum": ["金", "木", "水", "火", "土", "风", "雷", "冰", "无"]
              },
              "bonus": {
                "type": "object",
                "properties": {
                  "vitality": { "type": "integer" },
                  "spirit": { "type": "integer" },
                  "wisdom": { "type": "integer" },
                  "speed": { "type": "integer" },
                  "willpower": { "type": "integer" }
                },
                "additionalProperties": false
              },
              "special_effects": {
                "type": "array",
                "items": { "$ref": "#/$defs/effect" }
              },
              "curses": {
                "type": "array",
                "items": { "$ref": "#/$defs/effect" }
              }
            },
            "additionalProperties": false
          }
        },
        "consumables": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["name", "type"],
            "properties": {
              "name": { "type": "string" },
              "type": { "type": "string", "enum": ["heal", "buff", "revive", "breakthrough"] },
              "effect": {
                "type": "object",
                "properties": {
                  "hp_restore": { "type": "integer" },
                  "temporary_bonus": {
                    "type": "object",
                    "properties": {
                      "vitality": { "type": "integer" },
                      "spirit": { "type": "integer" },
                      "wisdom": { "type": "integer" },
                      "speed": { "type": "integer" },
                      "willpower": { "type": "integer" },
                      "duration": { "type": "integer", "minimum": 1 }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },

    "equipped": {
      "type": "object",
      "properties": {
        "weapon": { "type": ["string", "null"] },
        "armor": { "type": ["string", "null"] },
        "accessory": { "type": ["string", "null"] }
      },
      "additionalProperties": false
    },

    "max_skills": { "type": "integer", "minimum": 2, "maximum": 6 },

    "background": { "type": "string" }
  },

  "$defs": {
    "effect": {
      "type": "object",
      "required": ["type"],
      "oneOf": [
        {
          "properties": {
            "type": { "const": "damage_bonus" },
            "element": { "enum": ["金", "木", "水", "火", "土", "风", "雷", "冰", "无"] },
            "bonus": { "type": "integer", "minimum": 1 }
          },
          "required": ["element", "bonus"]
        },
        {
          "properties": {
            "type": { "const": "on_hit_add_effect" },
            "effect": {
              "enum": ["burn", "bleed", "poison", "stun", "silence", "root", "armor_up", "speed_up"]
            },
            "chance": { "type": "integer", "minimum": 1, "maximum": 100 }
          },
          "required": ["effect", "chance"]
        },
        {
          "properties": {
            "type": { "const": "on_use_cost_hp" },
            "amount": { "type": "integer", "minimum": 1 }
          },
          "required": ["amount"]
        },
        {
          "properties": {
            "type": { "const": "environment_change" },
            "env_type": { "type": "string" }
          },
          "required": ["env_type"]
        }
      ]
    }
  }
}
```

---

## 五、战斗流程（基于新架构）

1. **初始化**：
   - 计算最终属性 = 基础 + 功法 + 气运 + 装备
   - 应用境界属性上限裁剪

2. **每回合**：
   - 处理持续状态（burn 掉血等）
   - 判定出手顺序（speed）
   - 执行技能 → 检查装备 `special_effects` → 应用状态
   - 检查低血量触发（如器灵自爆）

3. **结束**：
   - 检查寿命（若 age ≥ lifespan → 坐化）

---

## 六、AIGC 生成约束（Prompt 设计要点）

所有 LLM Prompt 必须包含：

> “请从以下预定义列表中选择：  
> - 元素：金、木、水、火、土、风、雷、冰、无  
> - 技能类型：attack / heal / control / debuff / buff  
> - 状态效果：burn, stun, armor_up, ...（列出全部）  
> - 效果类型：damage_bonus, on_hit_add_effect, ...”

这样，**创意在框架内绽放，系统在边界内稳定**。

---

## ✅ 战斗引擎修正版：修仙战斗引擎（Node.js / TypeScript 风格）

```ts
// =============== 类型定义 ===============
type Element = '金' | '木' | '水' | '火' | '土' | '风' | '雷' | '冰' | '无';
type SkillType = 'attack' | 'heal' | 'control' | 'debuff' | 'buff';
type StatusEffect = 
  | 'burn' | 'bleed' | 'poison'
  | 'stun' | 'silence' | 'root'
  | 'armor_up' | 'speed_up' | 'crit_rate_up';

interface Attributes {
  vitality: number;
  spirit: number;
  wisdom: number;
  speed: number;
  willpower: number;
}

interface Cultivator {
  name: string;
  realm: string;
  attributes: Attributes;
  spiritual_roots: { element: Element; strength: number }[];
  cultivations: { bonus: Partial<Attributes> }[];
  skills: Skill[];
  equipped: {
    weapon?: Artifact;
    armor?: Artifact;
    accessory?: Artifact;
  };
}

interface Skill {
  id: string;
  name: string;
  type: SkillType;
  element: Element;
  power: number;          // 所有技能均有 power（攻击=伤害基数，控制=命中强度）
  effect?: StatusEffect;  // debuff/control/buff 必填
  duration?: number;      // 状态持续回合
  cooldown: number;
  target_self?: boolean;
}

interface Artifact {
  id: string;
  name: string;
  element: Element;
  bonus: Partial<Attributes>;
  special_effects: EffectTrigger[];
  curses: EffectTrigger[];
}

interface EffectTrigger {
  type: 'on_hit_add_effect';
  effect: StatusEffect;
  chance: number; // 1~100
}

interface BattleUnit {
  id: 'player' | 'opponent';
  data: Cultivator;
  hp: number;
  statuses: Map<StatusEffect, number>;
  skillCooldowns: Map<string, number>;
}

interface BattleState {
  player: BattleUnit;
  opponent: BattleUnit;
  turn: number;
  log: string[];
}

// =============== 全局配置 ===============
const ELEMENT_WEAKNESS: Record<Element, Element[]> = {
  '金': ['火', '雷'], '木': ['金', '雷'], '水': ['土', '风'],
  '火': ['水', '冰'], '土': ['木', '风'], '风': ['雷', '冰'],
  '雷': ['土', '水'], '冰': ['火', '雷'], '无': []
};

const STATUS_EFFECTS = new Set<StatusEffect>([
  'burn', 'bleed', 'poison', 'stun', 'silence', 'root',
  'armor_up', 'speed_up', 'crit_rate_up'
]);

// =============== 核心函数 ===============

function calculateFinalAttributes(c: Cultivator): Required<Attributes> {
  const base = { ...c.attributes };
  for (const cult of c.cultivations) {
    for (const [k, v] of Object.entries(cult.bonus)) {
      base[k as keyof Attributes] += v;
    }
  }
  for (const equip of [c.equipped.weapon, c.equipped.armor, c.equipped.accessory]) {
    if (!equip) continue;
    for (const [k, v] of Object.entries(equip.bonus)) {
      base[k as keyof Attributes] += v;
    }
  }
  const cap = getRealmAttributeCap(c.realm);
  for (const key in base) {
    base[key as keyof Attributes] = Math.min(base[key as keyof Attributes], cap);
  }
  return base;
}

function getRealmAttributeCap(realm: string): number {
  const caps: Record<string, number> = {
    '炼气': 100, '筑基': 120, '金丹': 150, '元婴': 180,
    '化神': 210, '炼虚': 240, '合体': 270, '大乘': 300, '渡劫': 300
  };
  return caps[realm] || 100;
}

function getElementMultiplier(attacker: Cultivator, defender: Cultivator, el: Element): number {
  let mult = 1.0;
  const root = attacker.spiritual_roots.find(r => r.element === el);
  if (root) mult *= (1.0 + root.strength / 200);
  if (ELEMENT_WEAKNESS[el]?.includes(defender.spiritual_roots[0]?.element)) {
    mult *= 1.5;
  }
  return mult;
}

// ✅ 新增：状态命中率计算（核心修正）
function calculateStatusHitChance(
  attackerPower: number,
  defenderWillpower: number
): number {
  const baseHit = Math.min(0.9, Math.max(0.3, attackerPower / 100)); // power=30 → 30%, power=90 → 90%
  const resist = Math.min(0.7, defenderWillpower / 250);            // willpower=175 → 70% 抗性上限
  return Math.max(0.1, baseHit * (1 - resist));                    // 最低10%命中保底
}

function applyStatus(unit: BattleUnit, effect: StatusEffect, duration: number): boolean {
  if (!STATUS_EFFECTS.has(effect)) return false;
  unit.statuses.set(effect, duration);
  return true;
}

function tickStatusEffects(unit: BattleUnit, log: string[]): void {
  const toRemove: StatusEffect[] = [];
  const finalAttrs = calculateFinalAttributes(unit.data);

  for (const [effect, dur] of unit.statuses.entries()) {
    if (dur <= 0) {
      toRemove.push(effect);
      continue;
    }

    if (effect === 'burn') {
      const dmg = 5 + Math.floor(finalAttrs.spirit / 20);
      unit.hp -= dmg;
      log.push(`${unit.data.name} 被灼烧，受到 ${dmg} 点伤害！`);
    } else if (effect === 'bleed') {
      unit.hp -= 4;
      log.push(`${unit.data.name} 流血不止，受到 4 点伤害！`);
    } else if (effect === 'poison') {
      const dmg = 3 + Math.floor(finalAttrs.vitality / 30);
      unit.hp -= dmg;
      log.push(`${unit.data.name} 中毒，受到 ${dmg} 点伤害！`);
    }

    unit.statuses.set(effect, dur - 1);
  }

  for (const e of toRemove) unit.statuses.delete(e);
}

function isActionBlocked(unit: BattleUnit): boolean {
  return unit.statuses.has('stun') || unit.statuses.has('root');
}

function canUseSkill(unit: BattleUnit, skill: Skill): boolean {
  if (unit.statuses.has('silence') && skill.type !== 'heal') return false;
  return unit.skillCooldowns.get(skill.id) <= 0;
}

// ✅ 完全重写 executeSkill，支持 power + 抗性命中
function executeSkill(
  attacker: BattleUnit,
  defender: BattleUnit,
  skill: Skill,
  state: BattleState
): void {
  const log = state.log;
  const finalAtt = calculateFinalAttributes(attacker.data);
  const finalDef = calculateFinalAttributes(defender.data);

  // 所有非 heal/buff 技能均可被闪避
  if (!['heal', 'buff'].includes(skill.type)) {
    const evasion = Math.min(0.25, finalDef.speed / 400);
    if (Math.random() < evasion) {
      log.push(`${defender.data.name} 闪避了 ${attacker.data.name} 的「${skill.name}」！`);
      attacker.skillCooldowns.set(skill.id, skill.cooldown);
      return;
    }
  }

  if (skill.type === 'attack') {
    let damage = skill.power * (finalAtt.spirit / 100);
    damage *= getElementMultiplier(attacker.data, defender.data, skill.element);
    const critRate = Math.min(0.3, (finalAtt.wisdom - 50) / 200);
    const isCrit = Math.random() < critRate;
    if (isCrit) damage *= 2;
    const defReduction = finalDef.vitality / 500;
    damage *= (1 - defReduction);
    defender.hp -= Math.max(1, Math.floor(damage));
    log.push(
      `${attacker.data.name} 使用「${skill.name}」！` +
      (isCrit ? '【暴击】' : '') +
      `造成 ${Math.floor(damage)} 点伤害！`
    );

  } else if (skill.type === 'debuff' || skill.type === 'control') {
    if (!skill.effect) {
      log.push(`⚠️ 技能 ${skill.name} 缺少 effect 字段！`);
      return;
    }
    if (!STATUS_EFFECTS.has(skill.effect)) {
      log.push(`⚠️ 无效状态效果：${skill.effect}`);
      return;
    }

    // ✅ 关键：使用 power + 神识计算命中率
    const hitChance = calculateStatusHitChance(skill.power, finalDef.willpower);
    const duration = skill.duration ?? (skill.type === 'control' ? 1 : 2);

    if (Math.random() < hitChance) {
      applyStatus(defender, skill.effect, duration);
      log.push(`${attacker.data.name} 成功对 ${defender.data.name} 施加「${skill.effect}」！`);
    } else {
      log.push(`${defender.data.name} 凭借强大神识，抵抗了「${skill.name}」！`);
    }

  } else if (skill.type === 'heal') {
    const heal = skill.power + finalAtt.spirit / 2;
    const target = skill.target_self === false ? defender : attacker;
    const maxHp = 80 + calculateFinalAttributes(target.data).vitality;
    target.hp = Math.min(target.hp + heal, maxHp);
    log.push(`${attacker.data.name} 使用「${skill.name}」，恢复 ${Math.floor(heal)} 点气血！`);

  } else if (skill.type === 'buff') {
    if (!skill.effect) return;
    const duration = skill.duration ?? 2;
    applyStatus(attacker, skill.effect, duration);
    log.push(`${attacker.data.name} 获得「${skill.effect}」效果！`);
  }

  // 触发装备效果（仅当技能命中目标时）
  if (['attack', 'debuff', 'control'].includes(skill.type)) {
    // 检查是否命中（攻击必然命中除非闪避；debuff/control 需判断）
    const isDebuffHit = 
      skill.type === 'attack' || 
      (skill.type !== 'attack' && log.some(msg => msg.includes('成功') || !msg.includes('抵抗')));

    if (isDebuffHit) {
      for (const equip of [attacker.data.equipped.weapon, attacker.data.equipped.armor, attacker.data.equipped.accessory]) {
        if (!equip) continue;
        for (const eff of [...equip.special_effects, ...equip.curses]) {
          if (eff.type === 'on_hit_add_effect' && Math.random() * 100 < eff.chance) {
            applyStatus(defender, eff.effect, 2);
            log.push(`${defender.data.name} 因 ${equip.name} 被附加「${eff.effect}」！`);
          }
        }
      }
    }
  }

  attacker.skillCooldowns.set(skill.id, skill.cooldown);
}

function runBattle(playerData: Cultivator, opponentData: Cultivator): BattleState {
  const initUnit = (data: Cultivator, id: 'player' | 'opponent'): BattleUnit => ({
    id,
    data,
    hp: 80 + calculateFinalAttributes(data).vitality,
    statuses: new Map(),
    skillCooldowns: new Map(data.skills.map(s => [s.id, 0]))
  });

  const state: BattleState = {
    player: initUnit(playerData, 'player'),
    opponent: initUnit(opponentData, 'opponent'),
    turn: 0,
    log: []
  };

  while (state.player.hp > 0 && state.opponent.hp > 0 && state.turn < 30) {
    tickStatusEffects(state.player, state.log);
    tickStatusEffects(state.opponent, state.log);
    if (state.player.hp <= 0 || state.opponent.hp <= 0) break;

    const pSpeed = calculateFinalAttributes(state.player.data).speed + (state.player.statuses.has('speed_up') ? 20 : 0);
    const oSpeed = calculateFinalAttributes(state.opponent.data).speed + (state.opponent.statuses.has('speed_up') ? 20 : 0);
    const actors = pSpeed >= oSpeed ? [state.player, state.opponent] : [state.opponent, state.player];

    for (const actor of actors) {
      if (actor.hp <= 0) continue;
      if (isActionBlocked(actor)) {
        state.log.push(`${actor.data.name} 无法行动！`);
        continue;
      }

      const available = actor.data.skills.filter(s => canUseSkill(actor, s));
      if (available.length === 0) {
        state.log.push(`${actor.data.name} 无可用技能！`);
        continue;
      }
      const skill = available[Math.floor(Math.random() * available.length)];
      const target = actor.id === 'player' ? state.opponent : state.player;
      executeSkill(actor, target, skill, state);
      if (target.hp <= 0) break;
    }

    state.turn++;
  }

  if (state.player.hp <= 0) {
    state.log.push(`💀 ${state.player.data.name} 战败陨落...`);
  } else if (state.opponent.hp <= 0) {
    state.log.push(`✨ ${state.player.data.name} 斩敌证道！`);
  }

  return state;
}
```

---

