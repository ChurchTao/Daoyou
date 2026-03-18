# 修仙纯文字游戏战斗系统设计指南

结合你的现有基础（5维属性、镜像自动PVP、技能/命格/BUFF体系），先给核心结论：**纯文字修仙游戏的最优战斗架构，是「分层时序回合制自动战斗架构」**——核心锚定「战前策略博弈」，而非战时手操，用固定结算规则保证策略可落地，用流派制衡保证可玩性，用分层信息展示解决纯文字的信息过载痛点，完美承接你已有的设计框架，无需推翻重来。

## 一、先锚定核心：为什么是这个架构？

纯文字修仙游戏的战斗，和带画面的游戏有本质区别：

- 玩家核心需求：**养成反馈可感知、策略输赢可预期、操作不繁琐、符合修仙世界观**
- 核心痛点：信息过载（满屏文字不想看）、自动战斗变纯看脸、单属性/单流派无敌、输了不知道原因
- 你的现有设计（镜像自动战斗），天然适配「战前策略」的核心，而非战时手操——强行加手操只会拉高玩家门槛，违背修仙游戏「挂机养成、策略定胜负」的核心爽点。

## 二、第一步：盘活你的5维属性，卡死唯一战斗定位

属性是战斗系统的地基，90%的战斗设计崩盘，都源于属性定位重叠、有废属性。先给你的5维属性定死**不可替代的战斗价值**，同时对应核心流派，为后续策略制衡打基础：

| 5维属性 | 核心战斗定位（唯一不可替代） | 对应核心流派 | 关键数值关联 |
| --- | --- | --- | --- |
| 灵力 | 法系输出核心，决定法术伤害、法力上限/回复、护盾值、法术技能基础效果 | 法修（爆发输出） | 法术最终伤害、蓝量、护盾厚度 |
| 体魄 | 生存与体修输出核心，决定气血上限、双系减伤、抗暴击、异常状态抗性、体术伤害 | 体修（坦克/反伤） | 气血值、减伤上限、抗控率、普攻/体术伤害 |
| 身法 | 先手与暴击核心，决定出手顺序、闪避率、暴击率、连击概率、敏系技能效果 | 敏修（先手秒杀） | 出手优先级、暴击率、闪避率、连击触发 |
| 神识 | 控制与反制核心，决定异常状态命中/抵抗、施法打断概率、被动技能触发优先级、心魔类技能效果 | 控修（封技限制） | 控制命中率、抗控率、打断概率、被动触发顺位 |
| 悟性 | 策略与上限核心，决定技能释放条件数量、AI智能度、被动/命格触发概率、buff叠加上限、暴击伤害倍率、技能保底触发阈值 | 万能辅修/赌狗流 | 可设置的技能规则数、触发概率稳定性、伤害上限 |

⚠️ 关键避坑：绝对不要把悟性做成纯场外加经验的废属性，必须让它深度融入战斗，成为所有流派都需要、且能玩出极限流派的核心属性。

## 三、核心架构：分层时序回合制自动战斗体系

这是整个战斗系统的灵魂，核心是**固定结算时序、优先级分层判定**，让你的技能、命格、BUFF、属性全部有明确的结算位置，彻底解决自动战斗的逻辑混乱问题，同时让玩家的战前策略能精准落地。

### 基础战斗规则

1.  战斗单位：敌我双方为玩家完整镜像（属性、技能、命格、装备全复刻），每个单位有独立的属性面板、技能栏、命格槽、BUFF/DEBUFF栏
2.  胜负规则：常规为敌方气血归零获胜；10回合未分胜负，按剩余气血占比>总输出量>神识高低判定；可拓展境界压制、心魔斩杀等特殊胜负条件
3.  核心循环：单回合分为「前置结算→出手判定→出手行动→后置结算」四大阶段，**同阶段内优先级固定，绝不随机乱序**

### 固定结算时序（优先级从高到低，同优先级按神识>悟性排序）

#### 0. 开局命格觉醒阶段（仅第1回合触发，最高优先级）

- 判定所有命格的生效条件，触发全局被动命格（如「开局免疫2次控制」「进场叠加3层灵力buff」）
- 契合修仙「天命先于人事」的世界观，同时让命格成为build的核心，而非单纯的属性挂件

#### 1. 回合前置结算阶段（每回合开头）

按顺序结算，不可颠倒：

1.  永久被动技能结算：如「每回合开始回复5%气血」「全程免疫减益」
2.  持续增益BUFF结算：如回合开始的回血、回蓝、属性提升
3.  持续减益DEBUFF结算：如中毒、灼烧、属性降低、持续封技
4.  阈值型被动触发判定：如「气血低于30%触发1回合无敌」「被控时概率反控」，避免玩家出手前被秒，契合修仙「濒死突破」的设定

#### 2. 出手顺序判定阶段

- 核心判定规则：**身法高的优先出手**；身法相同，神识高的先出手；全属性相同，防守方先出手
- 制衡设计（避免身法无敌）：神识高于对方30%可无视身法差距先手；命格「后发先至」可让首回合后手变先手，给反制空间

#### 3. 出手行动阶段（按出手顺序依次行动）

单个单位的行动回合，依然固定时序结算，彻底解决逻辑混乱：

1.  施法前摇判定：神识对抗，判定是否被敌方「打断施法」类被动/技能拦截
2.  技能释放优先级判定（自动战斗的策略核心）：
    - 基础规则：玩家可提前为技能设置**释放条件**，而非固定顺序释放
    - 示例：「自身气血≤40%优先放回血技能」「敌方有护盾优先放破盾技能」「敌方未被控优先放封技」
    - 悟性核心作用：悟性越高，可设置的释放条件数量越多，AI智能度越高（悟性拉满可实现自动选择最优解，比如敌方被控时不再浪费控制技能，全力输出）
3.  技能效果结算：先结算主动技能的伤害/治疗/护盾，再结算技能附带的被动效果
4.  异常状态施加判定：神识对抗结算控制/减益的命中与抵抗，成功则施加DEBUFF
5.  反击/反伤结算：敌方「受击反弹伤害」「普攻后反击」类效果在此处结算，避免时序混乱

#### 4. 回合后置结算阶段（每回合末尾）

按顺序结算：

1.  回合末尾型BUFF/DEBUFF结算：如「回合结束清除1个减益」「回合结束叠加1层防御buff」
2.  收尾型被动技能结算：如「本回合未受伤害，下次攻击暴击率提升20%」
3.  最终胜负判定：满足胜负条件则战斗结束，未满足则进入下一回合

## 四、纯文字游戏专属优化：解决信息过载与爽点感知

纯文字战斗最大的坑，就是满屏结算文字，玩家既找不到爽点，也看不懂输赢原因。必须做**分层信息展示**，兼顾休闲玩家和硬核玩家：

1.  **默认极简战报模式** 只展示核心结果与高光时刻，用加粗/特殊标识突出爽点，避免信息轰炸。示例：【第3回合 天命触发！】你激活命格「万法归一」，释放【九天雷法】暴击造成12450点伤害，敌方气血归零，战斗胜利！

2.  **可主动开启的详细战报模式** 展示完整的时序结算细节，供玩家复盘优化build。比如清晰标注「本次控制未命中，因敌方神识高于你25%」「未先手，因身法低于对方30点」，给玩家明确的成长目标，而非输了一头雾水。

3.  **节奏压缩设计** 镜像PVP战斗最多10回合封顶，加入「伤害递增机制」（每回合所有单位伤害提升10%），避免膀胱局，契合文字游戏快节奏验证策略的需求。

## 五、策略深度升级：从「比数值」到「玩克制」

自动战斗最容易陷入「数值高就无敌」的死局，必须用**闭环克制体系**，让低数值玩家靠策略搭配打赢高数值玩家，这也是PVP的核心乐趣。

### 1. 5维属性闭环克制

彻底杜绝单属性无敌，形成稳定的流派克制链：

- 灵力（法修）→ 克制体魄（体修）：法术伤害无视部分体魄减伤，破坦能力拉满
- 体魄（体修）→ 克制身法（敏修）：高额抗暴击+反伤，让敏修的暴击秒杀流失效，打别人自己先掉血
- 身法（敏修）→ 克制神识（控修）：先手爆发直接秒掉控修，不给对方放出控制技能的机会
- 神识（控修）→ 克制灵力（法修）：封技+禁蓝，让依赖技能的法修直接变成白板
- 悟性（辅修）→ 全流派适配，极限悟性流可靠高触发概率的被动/命格，实现跨流派反制，玩出无限可能

### 2. 命格+技能的组合克制

命格不能是单纯的属性加成，要做**流派核心与反制核心**，和技能形成绑定组合，同时互相克制：

- 法修核心组合：【万法归一】（法术伤害随灵力递增）+【法身不灭】（施法叠加护盾），反制组合：【清心锁灵】（封技概率提升50%）
- 体修核心组合：【金刚不坏】（气血越低减伤越高）+【以血换伤】（消耗气血提升伤害），反制组合：【破甲穿心】（无视目标50%减伤）
- 控修核心组合：【摄魂夺魄】（控制命中后禁技2回合）+【心魔反噬】（被控时概率反控），反制组合：【太上忘情】（免疫所有控制）
- 敏修核心组合：【千里一击】（先手必定暴击）+【影遁】（闪避后下次攻击必暴击），反制组合：【后发先至】（首回合无视身法先手）+【不动如山】（免疫暴击）

### 3. 随机数保底机制

彻底解决「自动战斗纯看脸」的挫败感：所有概率触发的技能/命格，都加入**保底触发机制**，且悟性越高，保底阈值越低。示例：某被动技能基础触发概率20%，则每回合未触发，下次触发概率提升10%，直到触发为止；悟性拉满时，触发概率浮动不超过5%，让玩家的策略稳定落地，而非纯赌运气。

## 六、落地步骤与避坑指南

### 从0到1落地顺序（循序渐进，避免一次性做崩）

1.  第一步：卡死5维属性的定位与基础数值公式，写死伤害、减伤、命中、暴击的基础计算规则，保证每个属性都有明确的数值作用
2.  第二步：搭建固定时序的回合制战斗框架，先做最简demo（普攻+基础主动技能），跑通结算时序，杜绝逻辑bug
3.  第三步：嵌入被动技能、命格、BUFF/DEBUFF体系，确保每个模块都有对应的结算位置，时序不混乱
4.  第四步：上线技能释放条件自定义系统，结合悟性属性，搭建战前策略的核心玩法
5.  第五步：优化战报展示，做分层信息设计，解决纯文字的信息过载问题
6.  第六步：调整数值平衡，搭建属性+流派的克制闭环，避免单一流派无敌
7.  第七步：拓展进阶玩法（法宝、境界压制、宗门战、天劫心魔战等）

### 绝对要避开的致命坑

1.  不要强行加战时手操：纯文字游戏的核心是挂机养成，手操会拉高玩家门槛，违背你的自动战斗设计初衷，把重心放在战前策略深度上
2.  不要做废属性/废技能：每个属性、技能、命格都要有不可替代的作用，杜绝「全点灵力就无敌」的数值崩坏
3.  不要让随机数主导胜负：没有保底的概率，就是玩家的噩梦，再高的策略深度，也抵不过连续不触发的挫败感
4.  不要忽略防守方平衡：PVP镜像战斗，给防守方加小幅属性加成（如防守时体魄+10%），避免进攻方永远有优势
5.  不要做超长战斗流程：回合数封顶，加快战斗节奏，避免玩家对着满屏文字失去耐心

## 七、可拓展的进阶玩法（基于现有架构无缝衔接）

1.  **功法与境界系统**：功法绑定属性流派（如《金刚诀》让体魄效果翻倍），境界带来压制效果（筑基打金丹全属性降低30%），契合修仙世界观，给玩家明确的成长线
2.  **法宝灵宝系统**：法宝带专属主动/被动效果，和技能、命格形成组合，比如《太极图》免疫前2次伤害，《诛仙剑》概率触发斩杀，丰富build维度
3.  **环境与地形加成**：比如火山地图火属性法术伤害+30%，深海地图身法降低、水属性伤害提升，给PVE/PVP增加更多变量
4.  **宗门组队战**：5v5镜像组队战斗，基于5维属性形成坦克（体魄）、输出（灵力/身法）、控制（神识）、辅助（悟性）的分工，拓展社交玩法
5.  **天劫心魔战**：特殊PVE战斗，对手是属性强化后的自身镜像，玩家必须调整build克制自己才能通关，契合修仙世界观，仪式感拉满

结合战斗设计思路（分层时序回合制、属性/技能/命格/BUFF体系、自动战斗），**最成熟且适配的架构是「事件驱动架构（EDA）+ 借鉴GAS核心思想的模块化战斗框架」**。这套架构既解决了纯文字游戏的时序控制、状态管理难题，又能通过解耦设计让你轻松扩展技能、命格等玩法，无需推翻核心代码。

---

## 一、核心架构选型：为什么是「EDA + GAS思想」？

### 1. 事件驱动架构（Event-Driven Architecture, EDA）

完美适配你的「分层时序回合制」需求——战斗中的每个动作（回合开始、技能释放、受到伤害）都是一个**事件**，所有模块（属性、技能、命格、BUFF）通过「订阅-发布」事件交互，彻底解耦，且能严格控制时序优先级。

### 2. 借鉴GAS（Gameplay Ability System）核心思想

GAS是UE为复杂RPG/动作游戏设计的技能系统，其「**属性（Attribute）+ 修改器（Modifier）+ 能力（Ability）+ 效果（Gameplay Effect）**」的核心逻辑，完全覆盖你的5维属性、技能、命格、BUFF需求，即使不用UE引擎，也能直接移植这套思想。

---

## 二、整体架构分层设计（从底层到上层）

### 1. 数据层（Data Layer）：纯配置驱动，避免硬编码

所有战斗相关数据用配置表（JSON/XML/Excel）存储，代码只负责读取和执行，方便数值调整和玩法扩展。

- **属性配置**：5维属性的基础值、成长系数、派生属性公式（如 `气血=体魄*100+灵力*20`）
- **技能/命格配置**：技能ID、触发条件、效果列表、优先级、冷却时间
- **BUFF配置**：BUFF ID、持续时间、属性修改器、绑定事件、堆叠规则
- **战斗规则配置**：回合数上限、伤害递增系数、胜负判定优先级

### 2. 核心战斗层（Core Combat Layer）：状态机+事件管道，严格控制时序

这是架构的核心，用**有限状态机（FSM）** 管理回合阶段，用**事件管道（Event Pipeline）** 处理所有战斗动作，保证时序100%可控。

#### （1）战斗状态机（Combat State Machine）

将你的「分层时序回合制」拆分为独立状态，每个状态只负责单一逻辑，状态切换时触发对应事件：

```
战斗初始化 → 开局命格觉醒（仅第1回合） → 回合前置结算 → 出手顺序判定 → 出手行动 → 回合后置结算 → 胜负判定 → 下一回合/战斗结束
```

- 每个状态是一个独立类，实现 `OnEnter()`（进入状态时触发事件）、`OnUpdate()`（执行状态逻辑）、`OnExit()`（退出状态时触发事件）
- 状态切换由状态机统一管理，禁止跨状态直接调用，保证时序不混乱

#### （2）事件管道（Event Pipeline）：优先级队列+订阅发布

战斗中的所有动作都通过「事件」传递，事件管道按**优先级**处理事件，彻底解决时序问题。

- **核心事件定义**（覆盖所有战斗节点）：

  ```csharp
  // 示例：事件基类，带优先级（优先级越高越先处理）
  public abstract class CombatEvent {
      public int Priority { get; }
      protected CombatEvent(int priority) => Priority = priority;
  }

  // 具体事件示例
  public class RoundStartEvent : CombatEvent { public RoundStartEvent() : base(100) { } } // 回合开始（高优先级）
  public class SkillCastEvent : CombatEvent { public Ability Skill; public Unit Caster; public Unit Target; public SkillCastEvent(...) : base(50) { } }
  public class DamageTakenEvent : CombatEvent { public float Damage; public Unit Victim; public DamageTakenEvent(...) : base(30) { } }
  public class BuffAppliedEvent : CombatEvent { public Buff Buff; public Unit Target; public BuffAppliedEvent(...) : base(40) { } }
  ```

- **订阅-发布机制**：
  - 所有模块（属性系统、技能系统、命格系统、战报系统）通过 `EventBus.Subscribe<EventType>(Handler)` 订阅事件
  - 事件发生时，通过 `EventBus.Publish(new EventType())` 发布，事件管道按优先级调用所有订阅者的处理函数
  - 关键设计：**同优先级事件按「神识>悟性」排序**，完美契合你的属性定位

### 3. 战斗单元层（Combat Unit Layer）：原型模式+模块化组件

处理玩家/敌方镜像的核心逻辑，用**原型模式**快速生成镜像，用**组件化**管理属性、技能、命格、BUFF。

#### （1）单元原型（Unit Prototype）

- 玩家数据作为「原型」，包含完整的属性、技能、命格、装备配置
- PVP镜像战斗时，通过 `MemberwiseClone()` 或序列化深拷贝生成敌方单元，避免数据污染
- 示例：

  ```csharp
  public class Unit {
      public AttributeSet Attributes { get; private set; } // 属性组件
      public AbilityContainer Abilities { get; private set; } // 技能/命格容器
      public BuffContainer Buffs { get; private set; } // BUFF容器

      // 原型克隆方法
      public Unit Clone() {
          var clone = (Unit)MemberwiseClone();
          clone.Attributes = Attributes.Clone();
          clone.Abilities = Abilities.Clone();
          clone.Buffs = Buffs.Clone();
          return clone;
      }
  }
  ```

#### （2）核心组件（借鉴GAS）

- **属性集（AttributeSet）**：管理5维属性及派生属性，支持「永久修改器」（装备、境界）和「临时修改器」（BUFF、技能）

  ```csharp
  public class AttributeSet {
      // 基础属性
      public Attribute Spirit { get; } // 灵力
      public Attribute Physique { get; } // 体魄
      // ... 其他属性

      // 派生属性（通过公式计算）
      public float MaxHealth => Physique.Value * 100 + Spirit.Value * 20;

      // 添加属性修改器（BUFF/技能调用）
      public void AddModifier(AttributeModifier modifier) { /* ... */ }
      public void RemoveModifier(AttributeModifier modifier) { /* ... */ }
  }

  // 属性修改器（支持加法、乘法、覆盖）
  public class AttributeModifier {
      public Attribute TargetAttr;
      public ModifierType Type; // Add/Multiply/Override
      public float Value;
      public object Source; // 来源（BUFF/技能/命格）
  }
  ```

- **能力容器（AbilityContainer）**：管理主动技能、被动技能、命格，每个「能力」都是独立的 `Ability` 类

  ```csharp
  public abstract class Ability {
      public string Id;
      public int Priority; // 释放/触发优先级
      public abstract bool CanTrigger(Unit caster, Unit target); // 触发条件检查
      public abstract void Execute(Unit caster, Unit target); // 执行效果
  }

  // 主动技能示例
  public class FireBallAbility : Ability {
      public override bool CanTrigger(Unit caster, Unit target) {
          return caster.Attributes.Spirit.Value > 50; // 灵力足够才能释放
      }
      public override void Execute(Unit caster, Unit target) {
          // 发布技能释放事件，由伤害系统、战报系统订阅处理
          EventBus.Publish(new SkillCastEvent(this, caster, target));
      }
  }

  // 被动命格示例：受到伤害时反伤
  public class CounterAttackDestiny : Ability {
      public override void OnActivate() {
          // 订阅「受到伤害」事件
          EventBus.Subscribe<DamageTakenEvent>(OnDamageTaken);
      }
      private void OnDamageTaken(DamageTakenEvent e) {
          if (e.Victim == Owner) { // 自己受到伤害时
              float counterDamage = e.Damage * 0.3f;
              EventBus.Publish(new DamageEvent(counterDamage, Owner, e.Caster)); // 反伤
          }
      }
  }
  ```

- **BUFF容器（BuffContainer）**：管理BUFF的添加、移除、堆叠，在回合对应阶段触发效果

  ```csharp
  public class Buff {
      public string Id;
      public int Duration; // 持续回合数
      public List<AttributeModifier> Modifiers; // 属性修改器
      public List<CombatEvent> BindEvents; // 绑定的事件（如「回合结束时回血」）
  }

  public class BuffContainer {
      private List<Buff> _buffs = new();

      public void AddBuff(Buff buff, Unit target) {
          // 检查堆叠规则、添加修改器、发布BUFF添加事件
          _buffs.Add(buff);
          EventBus.Publish(new BuffAppliedEvent(buff, target));
      }

      // 回合前置/后置结算时调用，触发BUFF效果
      public void OnRoundPhase(RoundPhase phase) {
          foreach (var buff in _buffs) {
              if (buff.BindPhase == phase) {
                  buff.Execute();
              }
          }
      }
  }
  ```

### 4. 表现层（Presentation Layer）：战报生成，纯文字游戏的核心

订阅战斗事件，根据事件生成极简/详细战报，与核心战斗逻辑完全解耦。

```csharp
public class CombatLogSystem {
    public void OnActivate() {
        EventBus.Subscribe<SkillCastEvent>(OnSkillCast);
        EventBus.Subscribe<DamageTakenEvent>(OnDamageTaken);
        EventBus.Subscribe<VictoryEvent>(OnVictory);
    }

    private void OnSkillCast(SkillCastEvent e) {
        if (LogMode == LogMode.Simple) {
            // 极简战报：只显示高光
            if (e.Skill.IsUltimate) {
                AddLog($"【天命触发！】{e.Caster.Name}释放【{e.Skill.Name}】！");
            }
        } else {
            // 详细战报：显示所有细节
            AddLog($"[第{Round}回合] {e.Caster.Name}对{e.Target.Name}释放【{e.Skill.Name}】");
        }
    }
}
```

---

## 三、关键落地细节（避坑指南）

### 1. 时序控制：事件优先级是核心

- 严格定义事件优先级：`回合开始事件（100）> 永久被动触发（90）> BUFF结算（80）> 技能释放（50）> 伤害计算（30）> 战报生成（10）`
- 同优先级事件按「神识>悟性」排序，保证属性定位落地

### 2. 数据驱动：所有逻辑尽量配置化

- 技能/命格的触发条件、效果、优先级全部写在配置表，代码只提供「条件检查器」和「效果执行器」
- 示例配置（JSON）：
  ```json
  {
    "id": "fire_ball",
    "name": "火球术",
    "type": "active_skill",
    "priority": 50,
    "trigger_conditions": [
      {
        "type": "attribute_check",
        "attr": "spirit",
        "operator": ">",
        "value": 50
      }
    ],
    "effects": [
      {
        "type": "damage",
        "value_formula": "spirit * 2 + 100",
        "target": "enemy"
      }
    ]
  }
  ```

### 3. 状态隔离：战斗数据与全局数据分离

- 战斗开始时，将玩家全局数据（存档）克隆一份到「战斗临时数据」，战斗结束后只同步结果（胜负、奖励），避免战斗中修改全局数据导致bug

### 4. 调试工具：内置战斗回放与日志系统

- 记录所有战斗事件，支持回放和单步调试，方便排查时序bug（比如「为什么这个命格没触发」）
- 日志系统显示事件处理顺序、属性变化细节，数值调整时一目了然

---

## 四、总结：这套架构的优势

1. **完全适配你的玩法**：状态机控制回合时序，事件管道处理技能/命格/BUFF，GAS思想管理属性，100%覆盖你的需求
2. **极致解耦**：加新技能/命格只需写新的 `Ability` 类或配置表，不用改核心战斗代码
3. **易扩展**：后续加法宝、境界压制、宗门战等玩法，只需订阅对应事件或添加新状态
4. **易调试**：事件日志和状态机追踪，快速定位bug

用 TypeScript 搭建这套「EDA + GAS 思想」的战斗系统，我们可以充分利用 TS 的**类型安全**、**接口抽象**和**模块化特性**，从「基础结构→核心模块→业务逻辑→整合测试」四步落地。

以下是从零开始的完整步骤，附带可直接复用的核心代码示例：

---

## 第一步：项目初始化与基础结构设计

先搭好文件夹结构，保证逻辑解耦，后续扩展不混乱：

```
combat-system/
├── src/
│   ├── core/                # 核心底层（事件总线、状态机、工具类）
│   │   ├── EventBus.ts      # 事件总线（EDA核心）
│   │   ├── CombatStateMachine.ts  # 战斗状态机
│   │   └── types.ts         # 全局类型定义
│   ├── data/                # 数据层（配置加载、数据结构）
│   │   ├── configs/         # 技能/命格/BUFF配置（JSON）
│   │   └── DataLoader.ts    # 配置加载器
│   ├── units/               # 战斗单元层
│   │   ├── Unit.ts          # 战斗单元基类
│   │   ├── AttributeSet.ts  # 属性集（GAS核心）
│   │   ├── AbilityContainer.ts  # 技能/命格容器
│   │   └── BuffContainer.ts # BUFF容器
│   ├── abilities/           # 能力系统（技能/命格实现）
│   │   ├── Ability.ts       # 能力基类
│   │   ├── ActiveSkill.ts   # 主动技能
│   │   ├── PassiveAbility.ts # 被动技能
│   │   └── Destiny.ts       # 命格
│   ├── systems/             # 业务系统
│   │   ├── CombatLogSystem.ts # 战报系统
│   │   └── DamageSystem.ts  # 伤害计算系统
│   └── index.ts             # 战斗系统入口
└── package.json
```

### 先定义全局类型（`src/core/types.ts`）

用 TS 接口锁死所有数据结构，避免后续类型混乱：

```typescript
// 全局类型定义
export type UnitId = string;
export type AbilityId = string;
export type BuffId = string;
export type EventPriority = number; // 优先级越高越先处理

// 战斗事件基类
export interface CombatEvent {
  readonly type: string;
  readonly priority: EventPriority;
}

// 战斗阶段枚举
export enum CombatPhase {
  INIT = 'init',
  DESTINY_AWAKEN = 'destiny_awaken', // 开局命格觉醒
  ROUND_PRE = 'round_pre', // 回合前置结算
  TURN_ORDER = 'turn_order', // 出手顺序判定
  ACTION = 'action', // 出手行动
  ROUND_POST = 'round_post', // 回合后置结算
  VICTORY_CHECK = 'victory_check', // 胜负判定
  END = 'end',
}

// 属性类型
export enum AttributeType {
  SPIRIT = 'spirit', // 灵力
  PHYSIQUE = 'physique', // 体魄
  AGILITY = 'agility', // 身法
  CONSCIOUSNESS = 'consciousness', // 神识
  COMPREHENSION = 'comprehension', // 悟性
}

// 属性修改器类型
export enum ModifierType {
  ADD = 'add', // 加法
  MULTIPLY = 'multiply', // 乘法
  OVERRIDE = 'override', // 覆盖
}

// 属性修改器
export interface AttributeModifier {
  readonly id: string;
  readonly attrType: AttributeType;
  readonly type: ModifierType;
  readonly value: number;
  readonly source: object; // 来源（技能/BUFF/命格）
}
```

---

## 第二步：实现核心底层模块（EDA + 状态机）

这是整个系统的骨架，必须先写稳。

### 1. 事件总线（`src/core/EventBus.ts`）

实现「订阅-发布」+ **优先级队列**，保证事件按顺序处理：

```typescript
import { CombatEvent, EventPriority } from './types';

// 事件处理器类型
type EventHandler<T extends CombatEvent> = (event: T) => void;

export class EventBus {
  // 单例模式，全局唯一事件总线
  private static _instance: EventBus;
  public static get instance(): EventBus {
    if (!this._instance) this._instance = new EventBus();
    return this._instance;
  }

  // 存储事件订阅者：key为事件类型，value为{处理器, 优先级}数组
  private _subscribers = new Map<
    string,
    Array<{ handler: EventHandler<any>; priority: EventPriority }>
  >();

  // 订阅事件
  public subscribe<T extends CombatEvent>(
    eventType: string,
    handler: EventHandler<T>,
    priority: EventPriority = 0,
  ): void {
    if (!this._subscribers.has(eventType)) {
      this._subscribers.set(eventType, []);
    }
    this._subscribers.get(eventType)!.push({ handler, priority });
    // 按优先级降序排序（高优先级先处理）
    this._subscribers.get(eventType)!.sort((a, b) => b.priority - a.priority);
  }

  // 取消订阅
  public unsubscribe<T extends CombatEvent>(
    eventType: string,
    handler: EventHandler<T>,
  ): void {
    const handlers = this._subscribers.get(eventType);
    if (!handlers) return;
    this._subscribers.set(
      eventType,
      handlers.filter((h) => h.handler !== handler),
    );
  }

  // 发布事件
  public publish<T extends CombatEvent>(event: T): void {
    const handlers = this._subscribers.get(event.type);
    if (!handlers) return;
    // 按优先级顺序调用所有处理器
    handlers.forEach(({ handler }) => handler(event));
  }
}
```

### 2. 战斗状态机（`src/core/CombatStateMachine.ts`）

用状态机严格控制回合时序，每个状态独立实现：

```typescript
import { CombatPhase } from './types';
import { EventBus } from './EventBus';

// 战斗状态基类
interface CombatState {
  phase: CombatPhase;
  onEnter(): void;
  onUpdate(): void;
  onExit(): void;
}

export class CombatStateMachine {
  private _currentState: CombatState | null = null;
  private _states = new Map<CombatPhase, CombatState>();

  constructor() {
    this._initStates();
  }

  // 初始化所有状态（对应你的分层时序）
  private _initStates(): void {
    // 1. 开局命格觉醒状态
    this._states.set(CombatPhase.DESTINY_AWAKEN, {
      phase: CombatPhase.DESTINY_AWAKEN,
      onEnter: () => {
        console.log('[状态] 进入命格觉醒阶段');
        EventBus.instance.publish({
          type: 'DestinyAwakenEvent',
          priority: 100,
        });
      },
      onUpdate: () => this._switchTo(CombatPhase.ROUND_PRE),
      onExit: () => {},
    });

    // 2. 回合前置结算状态
    this._states.set(CombatPhase.ROUND_PRE, {
      phase: CombatPhase.ROUND_PRE,
      onEnter: () => {
        console.log('[状态] 进入回合前置结算');
        EventBus.instance.publish({ type: 'RoundPreEvent', priority: 90 });
      },
      onUpdate: () => this._switchTo(CombatPhase.TURN_ORDER),
      onExit: () => {},
    });

    // ... 其他状态（TURN_ORDER、ACTION、ROUND_POST、VICTORY_CHECK）同理实现
  }

  // 切换状态
  private _switchTo(phase: CombatPhase): void {
    if (this._currentState) this._currentState.onExit();
    this._currentState = this._states.get(phase) || null;
    if (this._currentState) {
      this._currentState.onEnter();
      this._currentState.onUpdate();
    }
  }

  // 启动战斗
  public start(): void {
    this._switchTo(CombatPhase.DESTINY_AWAKEN);
  }
}
```

---

## 第三步：实现战斗单元与GAS核心模块

### 1. 属性集（`src/units/AttributeSet.ts`）

借鉴 GAS 的 Attribute 系统，支持修改器叠加：

```typescript
import { AttributeType, AttributeModifier, ModifierType } from '../core/types';

export class AttributeSet {
  // 基础属性值
  private _baseValues = new Map<AttributeType, number>();
  // 临时修改器
  private _modifiers = new Map<AttributeType, AttributeModifier[]>();

  constructor(baseValues: Partial<Record<AttributeType, number>>) {
    // 初始化基础属性（默认值设为10）
    Object.values(AttributeType).forEach((attr) => {
      this._baseValues.set(attr, baseValues[attr] || 10);
      this._modifiers.set(attr, []);
    });
  }

  // 获取属性最终值（按 加法→乘法→覆盖 顺序计算）
  public getValue(attrType: AttributeType): number {
    const base = this._baseValues.get(attrType)!;
    const modifiers = this._modifiers.get(attrType)!;

    let final = base;
    // 先算加法
    modifiers
      .filter((m) => m.type === ModifierType.ADD)
      .forEach((m) => (final += m.value));
    // 再算乘法
    modifiers
      .filter((m) => m.type === ModifierType.MULTIPLY)
      .forEach((m) => (final *= m.value));
    // 最后算覆盖
    const override = modifiers.find((m) => m.type === ModifierType.OVERRIDE);
    if (override) final = override.value;

    return Math.max(0, final); // 保证属性不为负
  }

  // 添加修改器
  public addModifier(modifier: AttributeModifier): void {
    this._modifiers.get(modifier.attrType)!.push(modifier);
  }

  // 移除修改器
  public removeModifier(modifierId: string): void {
    Object.values(AttributeType).forEach((attr) => {
      const modifiers = this._modifiers.get(attr)!;
      this._modifiers.set(
        attr,
        modifiers.filter((m) => m.id !== modifierId),
      );
    });
  }

  // 克隆属性集（用于原型模式生成镜像）
  public clone(): AttributeSet {
    const clone = new AttributeSet(Object.fromEntries(this._baseValues));
    // 深拷贝修改器
    this._modifiers.forEach((modifiers, attr) => {
      clone._modifiers.set(
        attr,
        modifiers.map((m) => ({ ...m })),
      );
    });
    return clone;
  }
}
```

### 2. 战斗单元（`src/units/Unit.ts`）

用原型模式快速生成PVP镜像，包含所有核心组件：

```typescript
import { AttributeSet } from './AttributeSet';
import { AbilityContainer } from './AbilityContainer';
import { BuffContainer } from './BuffContainer';
import { UnitId } from '../core/types';

export class Unit {
  readonly id: UnitId;
  readonly name: string;
  readonly attributes: AttributeSet;
  readonly abilities: AbilityContainer;
  readonly buffs: BuffContainer;

  constructor(
    id: UnitId,
    name: string,
    baseAttrs: Partial<Record<AttributeType, number>>,
  ) {
    this.id = id;
    this.name = name;
    this.attributes = new AttributeSet(baseAttrs);
    this.abilities = new AbilityContainer(this);
    this.buffs = new BuffContainer(this);
  }

  // 原型克隆：生成PVP镜像
  public clone(): Unit {
    const clone = new Unit(this.id + '_mirror', this.name + '的镜像', {});
    // 深拷贝所有组件
    (clone as any).attributes = this.attributes.clone();
    (clone as any).abilities = this.abilities.clone(clone);
    (clone as any).buffs = this.buffs.clone(clone);
    return clone;
  }
}
```

### 3. 能力基类与容器（`src/abilities/Ability.ts` + `src/units/AbilityContainer.ts`）

实现技能/命格的触发条件与执行逻辑：

```typescript
// src/abilities/Ability.ts
import { Unit } from '../units/Unit';
import { AbilityId, EventPriority } from '../core/types';
import { EventBus } from '../core/EventBus';

export abstract class Ability {
  readonly id: AbilityId;
  readonly name: string;
  readonly priority: EventPriority;
  protected owner: Unit;

  constructor(
    id: AbilityId,
    name: string,
    priority: EventPriority,
    owner: Unit,
  ) {
    this.id = id;
    this.name = name;
    this.priority = priority;
    this.owner = owner;
  }

  // 触发条件检查（子类实现）
  abstract canTrigger(target?: Unit): boolean;
  // 执行效果（子类实现）
  abstract execute(target?: Unit): void;
  // 激活能力（订阅事件）
  abstract onActivate(): void;
  // 克隆能力（用于镜像）
  abstract clone(owner: Unit): Ability;
}

// 示例：主动技能「火球术」
export class FireBallAbility extends Ability {
  canTrigger(target?: Unit): boolean {
    // 灵力>50才能释放
    return this.owner.attributes.getValue(AttributeType.SPIRIT) > 50;
  }

  execute(target?: Unit): void {
    if (!target) return;
    // 计算伤害：灵力*2+100
    const damage =
      this.owner.attributes.getValue(AttributeType.SPIRIT) * 2 + 100;
    // 发布伤害事件，由伤害系统处理
    EventBus.instance.publish({
      type: 'DamageEvent',
      priority: 50,
      caster: this.owner,
      target,
      damage,
    });
  }

  onActivate(): void {
    // 主动技能订阅「出手行动事件」
    EventBus.instance.subscribe(
      'ActionEvent',
      () => {
        if (this.canTrigger()) this.execute();
      },
      this.priority,
    );
  }

  clone(owner: Unit): Ability {
    return new FireBallAbility(this.id, this.name, this.priority, owner);
  }
}
```

```typescript
// src/units/AbilityContainer.ts
import { Ability } from '../abilities/Ability';
import { Unit } from './Unit';

export class AbilityContainer {
  private _abilities = new Map<AbilityId, Ability>();
  private _owner: Unit;

  constructor(owner: Unit) {
    this._owner = owner;
  }

  // 添加能力
  public addAbility(ability: Ability): void {
    this._abilities.set(ability.id, ability);
    ability.onActivate();
  }

  // 克隆容器（用于镜像）
  public clone(owner: Unit): AbilityContainer {
    const clone = new AbilityContainer(owner);
    this._abilities.forEach((ability) => {
      clone.addAbility(ability.clone(owner));
    });
    return clone;
  }
}
```

---

## 第四步：整合系统并跑通Demo

### 1. 编写战斗系统入口（`src/index.ts`）

把所有模块串起来，初始化战斗：

```typescript
import { CombatStateMachine } from './core/CombatStateMachine';
import { Unit } from './units/Unit';
import { AttributeType } from './core/types';
import { FireBallAbility } from './abilities/Ability';
import { CombatLogSystem } from './systems/CombatLogSystem';

export class CombatSystem {
  private _stateMachine: CombatStateMachine;
  private _player: Unit;
  private _enemy: Unit;

  constructor() {
    // 1. 初始化战报系统
    new CombatLogSystem();
    // 2. 创建玩家单元
    this._player = new Unit('player_1', '修仙者', {
      [AttributeType.SPIRIT]: 80,
      [AttributeType.PHYSIQUE]: 60,
    });
    // 3. 给玩家加技能
    this._player.abilities.addAbility(
      new FireBallAbility('fire_ball', '火球术', 50, this._player),
    );
    // 4. 生成敌方镜像（原型模式）
    this._enemy = this._player.clone();
    // 5. 初始化状态机
    this._stateMachine = new CombatStateMachine();
  }

  // 开始战斗
  public start(): void {
    console.log('=== 战斗开始 ===');
    this._stateMachine.start();
  }
}

// 启动Demo
const combat = new CombatSystem();
combat.start();
```

### 2. 补充战报系统（`src/systems/CombatLogSystem.ts`）

订阅事件并输出战报：

```typescript
import { EventBus } from '../core/EventBus';

export class CombatLogSystem {
  constructor() {
    this._subscribeEvents();
  }

  private _subscribeEvents(): void {
    // 订阅伤害事件
    EventBus.instance.subscribe(
      'DamageEvent',
      (e: any) => {
        console.log(
          `[战报] ${e.caster.name}对${e.target.name}造成${e.damage}点伤害！`,
        );
      },
      10,
    );
  }
}
```

---

## 关键优化与后续扩展

1. **数据驱动**：把技能/命格配置写成 JSON，用 `DataLoader` 加载解析，避免硬编码；
2. **BUFF系统**：参考 `Ability` 的实现，给 `Buff` 定义 `onRoundPre`/`onRoundPost` 方法，在对应阶段触发；
3. **调试工具**：给 `EventBus` 加事件日志记录，支持回放；
4. **胜负判定**：在 `VICTORY_CHECK` 状态检查单元气血，发布 `VictoryEvent`。
