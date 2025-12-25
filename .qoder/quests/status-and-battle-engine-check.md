# 状态引擎与战斗引擎集成检查及副本引擎重构设计

## 一、现状检查

### 1.1 状态引擎实现情况

#### 已完成功能

**核心模块**
- **StatusContainer**：状态容器，管理单个角色的所有临时状态
  - 状态添加与抵抗判定（基于神识）
  - 状态叠加、互斥、刷新逻辑
  - 状态过期管理（回合制与实时制）
  - DOT伤害计算与应用
  - 属性修正计算
  - 序列化与反序列化支持

- **StatusRegistry**：状态注册表，维护状态元信息
  - 状态定义注册
  - 战斗状态（Buff/Debuff/Control/DOT）已注册
  - 持久状态部分注册（目前仅有weakness）

- **计算器模块**：
  - DamageOverTimeCalculator：DOT伤害计算
  - AttributeModifierCalculator：属性修正计算
  - ResistanceCalculator：抵抗率计算
  - ActionBlockerCalculator：行动限制检查

**类型系统**
- 完整的类型定义（StatusInstance、StatusDefinition、StatusApplicationRequest等）
- 支持六种状态类型：buff、debuff、control、dot、persistent、environmental
- 支持四种持续时间类型：turn、realtime、permanent、conditional

#### 未完成功能

**状态注册不完整**
- 持久状态仅注册了weakness，缺少以下状态：
  - minor_wound（轻伤）
  - major_wound（重伤）
  - near_death（濒死）
  - artifact_damaged（法宝受损）
  - mana_depleted（灵力枯竭）
  - hp_deficit（气血亏空）
  - enlightenment（顿悟状态）
  - willpower_enhanced（神识增强）
  - fate_blessing（命格加持）

**环境状态未注册**
- scorching（炎热）
- freezing（冰冻）
- toxic_air（瘴气）
- formation_suppressed（阵法压制）
- abundant_qi（灵气充裕）

**效果计算器部分缺失**
- ActionBlockerCalculator 已实现但未充分测试
- 部分特殊状态的效果计算器未实现

### 1.2 战斗引擎实现情况

#### 已完成功能

**BattleEngineV2**
- 完整的战斗流程（初始化、回合执行、结果生成）
- 状态刷新机制（每回合自动触发）
- 行动顺序决定（考虑速度与speed_up状态）
- 行动限制检查（stun、root状态）
- 技能选择AI
- 法宝技能集成
- 回合快照记录

**BattleUnit**
- 状态容器集成
- 属性缓存与脏标记机制
- 最终属性计算（基础+装备+状态修正）
- 单元快照与施法者快照生成
- 技能冷却管理
- HP/MP管理

**SkillExecutor**
- 技能执行逻辑（攻击、治疗、增益、减益、控制）
- 闪避判定
- 暴击判定
- 状态施加（包括抵抗判定）
- 法宝代价处理（on_use_cost_hp）
- 日志生成

**计算器模块**
- DamageCalculator：伤害计算（元素克制、暴击、防御、状态影响）
- CriticalCalculator：暴击率计算
- EvasionCalculator：闪避率计算
- AttributeCalculator：属性修正应用

#### 未完成功能

**战斗后状态持久化**
- 战斗结束后，部分状态应保留到角色身上（如weakness、minor_wound等）
- 缺少战斗结束后的状态清理与持久化逻辑

**战斗前状态加载**
- 角色在战斗前可能携带持久状态
- 缺少从数据库加载角色持久状态到BattleUnit的机制

**特殊状态效果**
- artifact_damaged状态影响法宝使用未实现
- mana_depleted状态影响灵力恢复未实现
- enlightenment等增益状态效果未实现

### 1.3 副本引擎与战斗引擎集成情况

#### 已完成功能

**战斗触发机制**
- 副本选项中可包含battle类型cost
- 创建BattleSession并存储到Redis
- 根据副本状态计算玩家当前HP/MP（考虑累积的hp_loss和mp_loss）
- 使用enemyGenerator生成敌人

**战斗回调处理**
- handleBattleCallback接收战斗结果
- 更新副本状态并生成叙事
- 战斗后继续副本流程或结算

#### 存在问题

**状态不连续**
- 副本中的hp_loss、mp_loss只是简单的数值累加
- 未使用状态系统来表达"虚弱"、"轻伤"等状态
- 战斗中产生的状态无法传递回副本流程

**战斗初始化不完整**
- 玩家进入战斗时，未考虑之前副本中累积的持久状态
- 仅传递了HP/MP数值，未传递状态实例

**战斗结果处理简化**
- 战斗结束后，只生成了简单的文本描述
- 未记录战斗过程中产生的持久状态（如受伤、法宝损坏等）

**资源处理占位**
- processResources方法仅打印日志，未实际修改角色数据
- generateRealRewards方法返回空数组

## 二、重构目标

### 2.1 完善状态引擎

**补全状态注册**
- 注册所有持久状态（persistent类型）
- 注册所有环境状态（environmental类型）
- 为特殊状态实现自定义效果计算器

**增强状态持久化**
- 扩展StatusContainer支持状态导出为数据库格式
- 实现从数据库格式恢复StatusContainer的机制

**明确设计原则**
- 持久状态通过特定功能清除（闭关疗伤、使用丹药等，后续实现）
- 持久状态仅数值削弱，不限制玩法（不会禁止进入副本或战斗）
- 环境状态仅在副本中有效，离开副本后立即清除

### 2.2 完善战斗引擎集成

**战斗前状态加载**
- 从角色数据中加载持久状态到BattleUnit
- 支持携带环境状态进入战斗（仅副本战斗）

**战斗后状态生成（仅失败方）**
- 战斗失败且HP低于30%：添加minor_wound
- 战斗失败且HP低于10%：添加major_wound（或升级已有的minor_wound）
- 状态升级规则：minor_wound → major_wound → near_death
- 将持久化状态保存到角色数据
- 清理临时战斗状态（buff、debuff、control、dot）

**特殊状态效果实现**
- mana_depleted：降低最大灵力
- hp_deficit：降低治疗效果
- enlightenment：提升悟性属性

**暂不实现**
- artifact_damaged状态暂时不考虑（需要引入法宝耐久度系统）

### 2.3 重构副本引擎

**虚拟HP/MP损失机制**
- hp_loss/mp_loss使用数值记录（累加到DungeonState）
- 战斗初始化时，将累积损失转换为百分比扣除：currentHp = maxHp * (1 - hpLossPercent)
- weak等其他cost类型映射为状态（weakness状态）

**战斗集成优化**
- 创建战斗时传递持久状态快照+虚拟HP/MP损失百分比
- 战斗失败时，生成伤势状态（minor_wound/major_wound）
- 战斗后合并失败方的伤势状态到副本状态
- 支持环境状态影响战斗（仅副本中有效）

**战斗失败处理**
- 战斗失败 = 副本失败
- 立即触发副本结算，评级降低
- 保存失败方的伤势状态到数据库

**资源处理实现**
- 实现processResources真实修改角色数据（使用数据库事务）
  - 灵石增减
  - 材料获得/消耗
  - 修为、寿元变动
  - 状态施加（weakness等）
- 实现generateRealRewards根据奖励等级和玩家境界生成真实奖励
  - 先根据AI评级确定奖励档次
  - 根据玩家境界调整奖励池
  - 通过AI生成具体奖励内容
  - 发放到角色

## 三、设计方案

### 3.1 状态注册表扩展

#### 持久状态定义

| 状态Key | 类型 | 显示名称 | 描述 | 效果 | 持续时间 | 可叠加 | 备注 |
|---------|------|----------|------|------|----------|--------|------|
| weakness | persistent | 虚弱 | 全属性降低 | vitality/spirit/wisdom -10% | permanent | 否 | 通过闭关或丹药清除 |
| minor_wound | persistent | 轻伤 | 最大气血降低 | maxHp -10% | permanent | 否 | 可升级为major_wound |
| major_wound | persistent | 重伤 | 最大气血大幅降低 | maxHp -30% | permanent | 否 | 可升级为near_death |
| near_death | persistent | 濒死 | 全属性与气血大幅降低 | 所有属性 -50%, maxHp -50% | permanent | 否 | 最严重的伤势 |
| mana_depleted | persistent | 灵力枯竭 | 最大灵力降低 | maxMp -20% | permanent | 否 | 通过闭关或丹药清除 |
| hp_deficit | persistent | 气血亏空 | 治疗效果受阻 | 治疗效果 -30% | permanent | 否 | 通过闭关或丹药清除 |
| enlightenment | persistent | 顿悟 | 悟性大幅提升 | wisdom +50% | permanent | 否 | 稀有增益状态 |
| willpower_enhanced | persistent | 神识增强 | 神识提升 | willpower +30% | permanent | 否 | 稀有增益状态 |
| fate_blessing | persistent | 命格加持 | 全属性小幅提升 | 所有属性 +10% | permanent | 否 | 稀有增益状态 |

注：artifact_damaged状态暂不实现，需等待法宝耐久度系统。

#### 环境状态定义

| 状态Key | 类型 | 显示名称 | 描述 | 效果 | 持续时间 | 可叠加 | 触发条件 |
|---------|------|----------|------|------|----------|--------|----------|
| scorching | environmental | 炎热 | 火元素加强、水元素削弱 | 火元素伤害 +20%，水元素伤害 -20% | conditional | 否 | 副本地点包含"火山"、"炎域"等标签 |
| freezing | environmental | 冰冻 | 冰元素加强、火元素削弱 | 冰元素伤害 +20%，火元素伤害 -20% | conditional | 否 | 副本地点包含"冰原"、"雪域"等标签 |
| toxic_air | environmental | 瘴气 | 每回合受毒伤害 | 每回合损失 maxHp的2% | conditional | 否 | 副本地点包含"毒沼"、"瘴林"等标签 |
| formation_suppressed | environmental | 阵法压制 | 全属性降低 | 所有属性 -20% | conditional | 否 | 副本地点包含"古阵"、"禁地"等标签 |
| abundant_qi | environmental | 灵气充裕 | 灵力恢复加快 | MP恢复 +50% | conditional | 否 | 副本地点包含"灵脉"、"仙府"等标签 |

注：环境状态的durationType为conditional，conditionType为custom（副本结束后清除）。仅在副本中根据地点标签自动添加，整个副本过程有效。

#### 效果计算器实现策略

**属性修正计算器扩展**
- 需要处理百分比修正（如-10%、+50%等）
- 需要处理最大HP/MP修正
- 需要处理治疗效果修正

**环境状态计算器**
- 元素伤害修正器：调整技能伤害的元素倍率
- 毒伤计算器：每回合计算百分比HP损失
- MP恢复修正器：调整灵力恢复速度

**特殊状态计算器**
- artifact_damaged：检查技能来源，降低法宝技能威力
- enlightenment：提升技能效果或增加暴击率

### 3.2 状态持久化机制

#### 数据库存储格式

在cultivators表中增加持久状态字段（或使用已有JSONB字段）：

```
persistent_statuses: {
  statusKey: string;
  potency: number;
  createdAt: number;
  metadata: Record<string, any>;
}[]
```

#### 序列化与反序列化

**导出持久状态**
- StatusContainer.exportPersistentStatuses()：筛选statusType为persistent的状态，导出为简化格式

**加载持久状态**
- StatusContainer.loadPersistentStatuses(persistentStatuses)：从简化格式恢复为StatusInstance并添加到容器

**清理临时状态**
- StatusContainer.clearTemporaryStatuses()：仅移除非persistent类型的状态

### 3.3 战斗引擎集成

#### 战斗初始化扩展

**BattleUnit构造函数增强**
- 接受initialStatuses参数（StatusInstance[]）
- 构造时将initialStatuses加载到statusContainer

**BattleEngineV2.initializeBattle扩展**
- 从cultivatorData中提取persistent_statuses
- 转换为StatusInstance并传递给BattleUnit构造函数
- 为副本战斗，传递环境状态（如果有）

#### 战斗结束处理

**BattleEngineV2.generateResult扩展**
- 收集双方的持久状态
- 在BattleEngineResult中返回持久状态快照
- 返回后由调用方负责保存到数据库

**持久状态判定规则（仅失败方）**
- 战斗失败且HP低于30%：添加minor_wound
- 战斗失败且HP低于10%：升级或添加major_wound
- 已有minor_wound时触发：升级为major_wound
- 已有major_wound时触发：升级为near_death
- 已有near_death时触发：保持near_death（不再叠加）

#### 状态清理策略

**战斗结束时**
- 清除所有buff、debuff、control、dot状态
- 保留persistent状态
- 清除environmental状态（副本战斗中，环境状态在副本结束时才清除）
- 对失败方应用伤势判定，生成新的持久状态

### 3.4 副本引擎重构

#### 副本状态扩展

**DungeonState增加字段**
- accumulatedHpLoss：累积HP损失百分比（number, 0-1）
- accumulatedMpLoss：累积MP损失百分比（number, 0-1）
- persistentStatuses：持久状态快照（StatusInstance[]，序列化格式）
- environmentalStatuses：当前副本的环境状态（StatusInstance[]，序列化格式）

#### 副本流程改造

**状态初始化**
- startDungeon时，从cultivatorData加载persistent_statuses
- 根据地点标签（location_tags）添加环境状态
  - 例如：tags包含"火山"，添加scorching状态

**选项代价处理**
- handleAction时，将cost转换为状态应用
  - hp_loss：不直接扣HP，而是添加minor_wound或记录虚拟HP损失
  - mp_loss：不直接扣MP，而是添加mana_depleted或记录虚拟MP损失
  - weak：添加weakness状态
  - artifact_damage：添加artifact_damaged状态
- 更新playerStatusContainer

**战斗触发改造**
- createBattleSession时，从playerStatusContainer提取状态
- 计算当前实际HP/MP（考虑状态修正和虚拟损失）
- 将状态快照存储到BattleSession

**战斗回调改造**
- handleBattleCallback时：
  - 如果玩家胜利：继续副本，不增加伤势状态
  - 如果玩家失败：
    - 根据战斗结束时的HP比例，生成伤势状态
    - 将伤势状态添加到persistentStatuses
    - 立即调用settleDungeon，副本失败

**结算处理**
- settleDungeon时：
  - 调用generateRealRewards生成奖励
  - 调用processResources应用奖励和代价（使用数据库事务）
  - 导出persistentStatuses中的持久状态
  - 清除environmentalStatuses
  - 更新数据库：
    - cultivator.persistent_statuses
    - cultivator.spirit_stones
    - cultivator.experience
    - cultivator.lifespan
    - inventory表
  - 清除Redis中的DungeonState
  - 存档到dungeonHistories

#### 资源处理实现

**processResources方法实现**

目标：根据DungeonResourceGain或DungeonOptionCost修改角色数据和状态。

实现策略：

| 资源类型 | Cost处理（扣除/施加负面状态） | Gain处理（增加/施加正面状态） |
|---------|------------------------------|------------------------------|
| spirit_stones_loss / spirit_stones_gain | 扣除cultivator.spirit_stones | 增加cultivator.spirit_stones |
| hp_loss | 累加到accumulatedHpLoss（百分比） | （不适用于gain） |
| mp_loss | 累加到accumulatedMpLoss（百分比） | （不适用于gain） |
| weak | 添加weakness状态 | （不适用于gain） |
| material_loss | 从inventory.materials中扣除指定材料 | （不适用于gain） |
| exp_loss | 扣除cultivator.experience | （不适用于gain） |
| lifespan_loss / lifespan_gain | 减少cultivator.lifespan | 增加cultivator.lifespan |
| battle | 触发战斗（已实现） | （不适用于gain） |
| artifact_gain | 通过AI生成法宝并添加到inventory.artifacts | - |
| material_gain | 从预定义池选择材料并添加到inventory.materials | - |
| consumable_gain | 从预定义池选择消耗品并添加到inventory.consumables | - |
| exp_gain | 增加cultivator.experience | - |

注意事项：
- 需要与数据库交互，使用事务确保原子性
- weak等状态通过StatusContainer施加
- hp_loss/mp_loss不直接扣减，而是记录百分比，战斗时计算
- artifact_damage暂不实现

**generateRealRewards方法实现**

目标：根据AI给出的reward_tier和玩家境界，生成真实的奖励列表（DungeonResourceGain[]）。

实现策略：

定义奖励池表格：

| 奖励等级 | 灵石数量 | 材料数量 | 消耗品数量 | 法宝概率 | 修为奖励 | 寿元奖励 | 增益状态 |
|---------|---------|---------|-----------|---------|---------|---------|---------|
| S | 5000-10000 | 3-5个稀有材料 | 2-3个高级丹药 | 30%获得高品质法宝 | +5000 | +10年 | 30%获得enlightenment或fate_blessing |
| A | 2000-5000 | 2-3个稀有材料 | 1-2个中级丹药 | 15%获得中品质法宝 | +2000 | +5年 | 15%获得willpower_enhanced |
| B | 500-2000 | 1-2个普通材料 | 1个普通丹药 | 5%获得低品质法宝 | +500 | +2年 | - |
| C | 100-500 | 1个普通材料 | - | - | +100 | - | - |
| D | 0-100 | - | - | - | - | - | - |

实现步骤：
- 根据reward_tier查询奖励池配置
- 根据玩家境界调整材料、法宝的品质和数量
- 随机生成具体的奖励项
- 返回DungeonResourceGain[]数组

**archiveDungeon方法扩展**
- 将持久状态保存到cultivator.persistent_statuses字段
- 清除副本相关的临时状态

### 3.5 状态系统与副本的交互流程

#### 副本开始
```
1. 从数据库加载角色persistent_statuses
2. 创建StatusContainer并加载持久状态
3. 根据地点添加环境状态
4. 存储StatusContainer快照到DungeonState
```

#### 副本进行中
```
每次选择后：
1. 解析选项的costs
2. 将costs转换为状态应用请求
3. 调用StatusContainer.addStatus施加状态
4. 如果是battle cost，触发战斗：
   a. 从StatusContainer导出状态快照
   b. 计算当前HP/MP（基础值 - 虚拟损失 + 状态修正）
   c. 创建BattleSession并存储状态快照
   d. 战斗结束后，合并战斗产生的持久状态到StatusContainer
5. 更新DungeonState的playerStatusContainer快照
```

#### 副本结算
```
1. 调用generateRealRewards生成奖励
2. 调用processResources应用奖励和代价
3. 导出StatusContainer的持久状态
4. 更新数据库：
   a. cultivator.persistent_statuses
   b. cultivator.spirit_stones
   c. cultivator.experience
   d. cultivator.lifespan
   e. inventory表
5. 清除Redis中的DungeonState
6. 存档到dungeonHistories
```

## 四、实现清单

### 4.1 状态引擎完善

- [ ] 扩展StatusRegistry注册持久状态（10个）
- [ ] 扩展StatusRegistry注册环境状态（5个）
- [ ] 实现持久状态的效果计算器
  - [ ] minor_wound、major_wound、near_death：maxHp修正
  - [ ] artifact_damaged：法宝技能power修正
  - [ ] mana_depleted、hp_deficit：maxMp修正、治疗效果修正
  - [ ] enlightenment、willpower_enhanced、fate_blessing：属性增益
- [ ] 实现环境状态的效果计算器
  - [ ] scorching、freezing：元素伤害修正
  - [ ] toxic_air：DOT计算器扩展
  - [ ] formation_suppressed、abundant_qi：属性修正
- [ ] 扩展AttributeModifierCalculator支持百分比修正
- [ ] 实现StatusContainer.exportPersistentStatuses
- [ ] 实现StatusContainer.loadPersistentStatuses
- [ ] 实现StatusContainer.clearTemporaryStatuses

### 4.2 战斗引擎集成

- [ ] 扩展BattleUnit构造函数支持initialStatuses
- [ ] 扩展BattleEngineV2.initializeBattle加载持久状态
- [ ] 实现战斗结束时的持久状态判定逻辑
  - [ ] 低血量判定（minor_wound、major_wound）
  - [ ] 法宝损坏判定（artifact_damaged）
  - [ ] 灵力枯竭判定（mana_depleted）
- [ ] 扩展BattleEngineResult返回持久状态快照
- [ ] 实现战斗结束时的状态清理（clearTemporaryStatuses）
- [ ] 实现环境状态影响战斗的逻辑
  - [ ] scorching、freezing影响元素伤害
  - [ ] toxic_air每回合DOT
  - [ ] formation_suppressed属性压制

### 4.3 副本引擎重构

- [ ] 扩展DungeonState增加playerStatusContainer字段
- [ ] 扩展DungeonState增加environmentalStatuses字段
- [ ] 修改startDungeon：加载持久状态、添加环境状态
- [ ] 修改handleAction：将costs转换为状态应用
  - [ ] hp_loss映射为状态
  - [ ] mp_loss映射为状态
  - [ ] weak映射为weakness状态
  - [ ] artifact_damage映射为artifact_damaged状态
- [ ] 修改createBattleSession：传递状态快照
- [ ] 修改handleBattleCallback：合并战斗产生的持久状态
- [ ] 实现processResources真实修改角色数据
  - [ ] 灵石增减
  - [ ] 修为、寿元增减
  - [ ] 法宝、材料、消耗品增减
  - [ ] 状态施加
- [ ] 实现generateRealRewards根据奖励等级生成奖励
  - [ ] 定义奖励池配置表
  - [ ] 实现随机生成逻辑
- [ ] 修改archiveDungeon保存持久状态到数据库
- [ ] 修改settleDungeon应用增益状态

### 4.4 数据库与类型定义

- [ ] 扩展Cultivator类型定义：增加persistent_statuses字段
- [ ] 修改cultivators表schema：增加persistent_statuses字段（JSONB）
- [ ] 更新types/constants.ts：确保所有新状态已添加到STATUS_EFFECT_VALUES

### 4.5 测试与验证

- [ ] 单元测试：持久状态注册与效果计算
- [ ] 单元测试：环境状态注册与效果计算
- [ ] 集成测试：战斗中持久状态的生成与保存
- [ ] 集成测试：副本中状态的累积与战斗传递
- [ ] 端到端测试：完整副本流程（开始→战斗→结算→状态保存）

## 五、技术约束

### 5.1 状态系统约束

**持久状态不可叠加**
- persistent类型状态均不可叠加，避免状态爆炸

**持久状态清除机制**
- 仅通过特定手段清除（如：使用丹药、闭关疗伤）
- 不会在战斗或副本中自动消退

**环境状态作用域**
- environmental状态仅在特定场景有效
- 战斗结束或副本结束后自动清除

### 5.2 战斗引擎约束

**状态传递单向性**
- 战斗前：从角色数据加载持久状态到BattleUnit
- 战斗后：从BattleUnit导出持久状态到角色数据
- 战斗中产生的临时状态不保存

**状态不影响战斗逻辑复杂度**
- 状态效果通过计算器统一处理
- 不在战斗引擎核心逻辑中硬编码状态判断

### 5.3 副本引擎约束

**状态与数值的隔离**
- 副本中的代价优先表达为状态，而非直接扣除数值
- 仅在结算时一次性写入数据库

**战斗集成的松耦合**
- 副本引擎通过BattleSession与战斗引擎通信
- 战斗结果通过回调传递，不直接访问战斗引擎内部状态

### 5.4 性能考虑

**状态数量限制**
- 单个角色的状态数量不应超过20个
- 超出时，考虑合并或替换低优先级状态

**状态快照序列化**
- StatusContainer的序列化不应超过10KB
- 仅序列化必要字段

**Redis存储优化**
- DungeonState的序列化尽量精简
- 设置合理的TTL避免内存泄漏

## 六、风险评估

### 6.1 向后兼容性

**风险**：引入持久状态后，旧的角色数据缺少persistent_statuses字段

**应对**：
- 数据库迁移脚本添加字段，默认值为空数组
- 代码中做好空值校验

### 6.2 状态爆炸

**风险**：副本中多次应用状态，导致状态数量过多

**应对**：
- 限制同类状态的叠加上限
- 清理低效或过期的状态

### 6.3 性能影响

**风险**：每回合刷新状态、计算属性修正可能影响性能

**应对**：
- 使用属性缓存与脏标记机制（已实现）
- 避免不必要的状态遍历

### 6.4 AI生成内容的不确定性

**风险**：AI生成的costs类型可能不符合预期，导致processResources报错

**应对**：
- 严格验证AI返回的schema
- 对不支持的cost类型进行降级处理（如打印警告，不应用效果）

## 七、后续扩展

### 7.1 状态驱动的UI展示

在角色详情页展示当前持久状态，提供状态图标和说明。

### 7.2 状态清除机制

实现闭关疗伤、使用丹药等功能，清除或减轻持久状态。

### 7.3 状态触发的剧情事件

某些持久状态可能触发特殊剧情（如：携带enlightenment状态时，顿悟系统成功率提升）。

### 7.4 状态的社交影响

战斗时，对方可以探测到部分持久状态，影响挑战决策。
在角色详情页展示当前持久状态，提供状态图标和说明。

### 7.2 状态清除机制

实现闭关疗伤、使用丹药等功能，清除或减轻持久状态。

### 7.3 状态触发的剧情事件

某些持久状态可能触发特殊剧情（如：携带enlightenment状态时，顿悟系统成功率提升）。

### 7.4 状态的社交影响

战斗时，对方可以探测到部分持久状态，影响挑战决策。
