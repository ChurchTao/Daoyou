# 修仙者修为（经验值）系统设计文档

## 一、设计目标

将当前基于纯概率的瞬时突破机制改造为更符合修仙世界观的渐进式成长体系，通过引入修为积累、感悟系统和多维度风险机制，增强玩家的成长体验感和策略深度。

### 核心设计原则

1. **渐进式成长**：突破前必须完成修为积累，让玩家看到可量化的进度
2. **风险与收益平衡**：突破失败不仅消耗寿元，还会损失修为
3. **多路径成长**：闭关、战斗、副本、炼丹等多种方式获取修为
4. **符合修仙设定**：灵根强弱影响修炼效率，感悟深浅影响突破成功率

---

## 二、核心概念定义

### 2.1 修为值（Cultivation Experience）

修为值是角色在当前境界阶段的修炼进度，表现为数值化的经验积累。

| 属性 | 说明 |
|------|------|
| **当前修为** | 角色已积累的修为数值 |
| **修为上限** | 当前境界阶段要求的修为满值，达到后才能尝试突破 |
| **修为进度** | 当前修为 / 修为上限，以百分比显示（如 85%） |
| **修为状态** | 积累中、可突破、圆满 |

#### 修为上限计算规则

每个境界阶段的修为上限由以下因素决定：

- **基础修为需求**：根据境界和阶段设定基础值
- **境界系数**：境界越高，修为需求呈指数增长
- **阶段系数**：初期 < 中期 < 后期 < 圆满

**修为上限公式**：

```
修为上限 = 基础值 × 境界系数 × 阶段系数
```

**参考数值表**：

| 境界 | 初期 | 中期 | 后期 | 圆满 |
|------|------|------|------|------|
| 炼气 | 1000 | 1500 | 2200 | 3000 |
| 筑基 | 5000 | 8000 | 12000 | 18000 |
| 金丹 | 30000 | 50000 | 80000 | 120000 |
| 元婴 | 200000 | 350000 | 550000 | 800000 |
| 化神 | 1500000 | 2500000 | 4000000 | 6000000 |

---

### 2.2 感悟值（Comprehension Insight）

感悟值是角色对天地大道的领悟程度，是突破时的软性指标。

| 属性 | 说明 |
|------|------|
| **感悟值** | 当前境界的感悟积累（0-100分） |
| **感悟来源** | 副本奇遇、天地异象、悟道事件、战斗领悟 |
| **感悟效果** | 影响突破成功率、突破后属性成长上限 |

#### 感悟获取方式

| 方式 | 感悟值范围 | 触发条件 |
|------|-----------|----------|
| 副本奇遇 | 5-20 | 完成副本时概率触发 |
| 战斗领悟 | 1-10 | 战胜高境界对手时概率触发 |
| 悟道事件 | 10-30 | 特定奇遇选项、神签抽取 |
| 阅读典籍 | 3-8 | 消耗特定道具 |
| 顿悟状态 | 20-50 | 极低概率触发（受悟性影响） |

---

### 2.3 突破条件分级

根据修为进度和感悟值，突破分为三个等级：

| 突破等级 | 修为进度要求 | 感悟值要求 | 基础成功率调整 | 失败损失 |
|----------|-------------|-----------|---------------|----------|
| **强行突破** | 60%-79% | 任意 | -30% | 损失50%-70%修为 |
| **常规突破** | 80%-99% | 任意 | 正常 | 损失30%-50%修为 |
| **圆满突破** | 100% | ≥50 | +15% | 损失20%-30%修为 |

---

## 三、修为获取机制

### 3.1 闭关修炼

闭关是修为获取的主要途径。

#### 修为获取计算公式

```
单次闭关获得修为 = 基础修为 × 灵根系数 × 功法系数 × 悟性系数 × 年限系数 × 随机波动
```

#### 各系数说明

**1. 基础修为**

根据当前境界设定：

| 境界 | 基础修为/年 |
|------|------------|
| 炼气 | 50 |
| 筑基 | 150 |
| 金丹 | 400 |
| 元婴 | 1000 |
| 化神 | 2500 |

**2. 灵根系数（新增）**

灵根强度直接影响修炼效率：

- **计算方式**：取主灵根（strength最高的灵根）的强度值
- **系数公式**：`灵根系数 = 0.5 + (主灵根强度 / 100)`

| 主灵根强度 | 灵根系数 | 修炼效率 |
|-----------|---------|---------|
| 20-40（伪灵根） | 0.7-0.9 | 低 |
| 41-70（真灵根） | 0.91-1.2 | 中 |
| 71-100（天灵根） | 1.21-1.5 | 高 |

**示例**：
- 角色主灵根强度为85（天灵根），则灵根系数 = 0.5 + 85/100 = 1.35
- 角色主灵根强度为35（伪灵根），则灵根系数 = 0.5 + 35/100 = 0.85

**3. 功法系数**

根据功法品级：

| 功法等级 | 系数 |
|---------|------|
| 黄阶 | 1.0 |
| 玄阶 | 1.2 |
| 地阶 | 1.5 |
| 天阶 | 2.0 |

**4. 悟性系数**

```
悟性系数 = 1.0 + (悟性 - 50) / 200
```

范围：0.75 ~ 1.5

**5. 年限系数**

```
年限系数 = 1.0 + log10(闭关年限)
```

- 闭关10年：系数 ≈ 2.0
- 闭关50年：系数 ≈ 2.7
- 闭关100年：系数 ≈ 3.0

**6. 随机波动**

每次闭关修为获取在计算结果的 ±10% 范围内随机波动。

#### 修为获取示例

**场景**：炼气初期角色闭关10年

- 基础修为：50/年
- 主灵根强度：75（天灵根）→ 灵根系数 = 1.25
- 功法：玄阶 → 功法系数 = 1.2
- 悟性：80 → 悟性系数 = 1.15
- 年限：10年 → 年限系数 = 2.0
- 随机波动：假设为 1.05

```
获得修为 = 50 × 10年 × 1.25 × 1.2 × 1.15 × 2.0 × 1.05
         = 50 × 10 × 1.25 × 1.2 × 1.15 × 2.0 × 1.05
         ≈ 1811
```

炼气初期修为上限为1000，单次闭关10年可获得约1811修为，已超过上限，可以尝试突破。

---

### 3.2 战斗获取修为

战胜敌人可获得少量修为，鼓励玩家多元化成长。

#### 修为奖励计算

```
战斗修为 = 基础奖励 × 境界差系数 × 战斗表现系数
```

| 因素 | 说明 |
|------|------|
| **基础奖励** | 根据敌人境界设定（如炼气敌人给50，筑基给200） |
| **境界差系数** | 越级挑战奖励更高（高1境界×1.5，高2境界×2.0） |
| **战斗表现系数** | 回合数少、无伤胜利等条件提升奖励（1.0-1.3） |

**限制**：

- 每日战斗修为获取上限为当前境界修为需求的5%
- 重复挑战同一对手递减（首次100%，第二次50%，第三次及以后10%）

---

### 3.3 副本探索获取修为

副本通关时根据选择和结果给予修为奖励。

| 副本结果 | 修为奖励 | 感悟值奖励 |
|---------|---------|-----------|
| 圆满通关 | 当前境界需求的8-15% | 10-20 |
| 普通通关 | 当前境界需求的3-8% | 5-10 |
| 失败/逃离 | 当前境界需求的1-3% | 0-5 |

---

### 3.4 炼丹服用

特定丹药可直接提升修为。

| 丹药类型 | 修为提升 | 副作用 |
|---------|---------|--------|
| 聚灵丹（凡品） | 固定50点 | 无 |
| 破境丹（灵品） | 当前需求的5% | 使用后24小时内无法闭关 |
| 通天丹（玄品） | 当前需求的10% | 使用后感悟值-10 |
| 造化丹（真品） | 当前需求的20% | 需要消耗大量灵石和材料炼制 |

**限制**：

- 同一境界阶段服用丹药获得的修为不能超过该阶段需求的30%
- 过度服用会产生"丹毒"debuff，降低后续修为获取效率

---

## 四、突破机制重构

### 4.1 突破前置条件

玩家可选择在以下时机尝试突破：

| 条件 | 修为进度 | 感悟值 | 说明 |
|------|---------|--------|------|
| **最低要求** | ≥60% | 任意 | 可尝试，但风险极高 |
| **推荐要求** | ≥80% | ≥30 | 常规突破时机 |
| **最佳时机** | 100% | ≥50 | 成功率最高，损失最小 |

### 4.2 突破成功率计算

在原有突破成功率基础上增加修为进度和感悟的影响：

```
最终成功率 = 原突破公式计算的成功率 × 修为进度系数 × 感悟系数
```

**修为进度系数**：

| 修为进度 | 系数 |
|---------|------|
| 60%-69% | 0.5 |
| 70%-79% | 0.7 |
| 80%-89% | 0.9 |
| 90%-99% | 1.0 |
| 100% | 1.15 |

**感悟系数**：

```
感悟系数 = 1.0 + (感悟值 / 200)
```

- 感悟值0：系数1.0
- 感悟值50：系数1.25
- 感悟值100：系数1.5

### 4.3 突破失败惩罚

突破失败时，除消耗寿元外，还会损失修为：

**修为损失计算**：

```
损失修为 = 当前修为 × 损失比例 × (1 - 感悟保护系数)
```

| 突破等级 | 基础损失比例 | 感悟保护系数 |
|---------|-------------|-------------|
| 强行突破（60-79%） | 50%-70% | 感悟值 / 500 |
| 常规突破（80-99%） | 30%-50% | 感悟值 / 300 |
| 圆满突破（100%） | 20%-30% | 感悟值 / 200 |

**示例**：

- 修为进度85%，感悟值30，突破失败
- 基础损失比例：40%（常规突破范围内随机）
- 感悟保护系数：30/300 = 0.1
- 实际损失比例：40% × (1 - 0.1) = 36%

**其他惩罚**：

- 失败后感悟值降低10-20点
- 增加心魔debuff（下次突破成功率-5%，可通过特定事件消除）
- 连续失败3次及以上，触发"瓶颈期"状态（修为获取效率-20%，持续7天）

### 4.4 突破成功奖励

突破成功时的额外奖励与修为进度和感悟值相关：

| 突破等级 | 属性成长加成 | 感悟值奖励 | 特殊奖励 |
|---------|------------|-----------|---------|
| 强行突破 | 基础成长的80% | -10 | 无 |
| 常规突破 | 基础成长的100% | +5 | 无 |
| 圆满突破 | 基础成长的120% | +15 | 小概率领悟新技能 |

---

## 五、进阶机制

### 5.1 瓶颈期系统

当修为进度达到90%时，进入"瓶颈期"：

**特征**：

- 闭关修为获取效率降低至50%
- 无法通过闭关获得感悟值
- UI提示"已达瓶颈，需另辟蹊径"

**突破瓶颈方式**：

1. 通过副本奇遇获得感悟值
2. 战胜高境界敌人
3. 服用破境丹（消耗品）
4. 触发顿悟事件（随机）
5. 直接尝试突破（此时修为已满足，但建议积累感悟）

**设计意图**：引导玩家在瓶颈期多样化游玩，而非单纯闭关。

---

### 5.2 顿悟系统

顿悟是低概率触发的特殊状态。

**触发时机**：

- 闭关时（概率 = 悟性 / 2000，即悟性100时为5%概率）
- 战斗后（概率 = 悟性 / 3000）
- 副本特定选项
- 神签抽取（特定签文）

**顿悟效果**：

- 获得"顿悟"buff，持续3天
- buff期间修为获取效率翻倍
- buff期间感悟值获取 +50%
- 触发顿悟时立即获得20-50点感悟值

**UI表现**：

- 金色光效提示"道友于混沌中一念顿悟，天地大道豁然开朗！"
- 角色头像显示金色光圈

---

### 5.3 走火入魔机制

过度追求速成会引发走火入魔风险。

**触发条件**：

1. 短期内（7天内）修为暴涨超过当前需求的50%
2. 连续服用3颗及以上增益丹药
3. 强行突破连续失败3次

**走火入魔效果**：

- 角色进入"走火入魔"状态
- 损失当前修为的30%-50%
- 损失当前感悟值的50%
- 随机损失部分属性（可通过特定任务恢复）
- 需要完成"疗伤"任务才能继续修炼

**疗伤任务**：

- 选项一：闭关疗伤（消耗30天寿元，无其他收益）
- 选项二：寻访名医（消耗大量灵石）
- 选项三：服用疗伤丹药（需炼制或购买）

**设计意图**：限制玩家过度氪金/刷副本速成，鼓励稳健成长。

---

### 5.4 境界稳固度（可选扩展）

此机制为可选设计，可在后续版本加入。

**核心概念**：

- 刚突破时境界稳固度为60%
- 通过战斗、副本逐渐提升至100%
- 稳固度低于80%时，战斗中有小概率触发"境界不稳"，临时属性降低
- 稳固度100%后，可获得"境界巩固"成就，下次突破成功率+5%

---

## 六、数据模型设计

### 6.1 数据库Schema扩展

在 `cultivators` 表中新增单个JSONB字段：

| 字段名 | 类型 | 说明 | 默认值 |
|-------|------|------|--------|
| `cultivation_progress` | jsonb | 修为进度相关的所有数据 | `{}` |

**`cultivation_progress` JSONB结构**：

```json
{
  "cultivation_exp": 0,              // 当前修为值
  "exp_cap": 1000,                    // 当前境界修为上限
  "comprehension_insight": 0,         // 当前感悟值
  "breakthrough_failures": 0,         // 连续突破失败次数
  "last_epiphany_at": null,          // 上次顿悟时间（ISO字符串）
  "bottleneck_state": false,          // 是否处于瓶颈期
  "inner_demon": false,               // 是否有心魔debuff
  "deviation_risk": 0,                // 走火入魔风险值（0-100）
  "epiphany_buff_expires_at": null   // 顿悟buff过期时间（ISO字符串）
}
```

**优势**：
- 保持表结构简洁，避免字段爆炸
- 与现有schema设计风格一致（如attributes、inventory等都用JSONB）
- 便于未来扩展新字段，无需修改表结构
- JSONB支持索引，查询性能可控

### 6.2 TypeScript类型定义扩展

在 `types/cultivator.ts` 中新增接口定义：

```typescript
export interface CultivationProgress {
  cultivation_exp: number;              // 当前修为值
  exp_cap: number;                      // 当前境界修为上限
  comprehension_insight: number;        // 当前感悟值（0-100）
  breakthrough_failures: number;        // 连续突破失败次数
  bottleneck_state: boolean;            // 是否处于瓶颈期
  inner_demon: boolean;                 // 是否有心魔debuff
  deviation_risk: number;               // 走火入魔风险值（0-100）
  last_epiphany_at?: string;           // 上次顿悟时间（ISO字符串）
  epiphany_buff_expires_at?: string;   // 顿悟buff过期时间（ISO字符串）
}

export interface Cultivator {
  // ... 现有字段
  cultivation_progress?: CultivationProgress;
}
```

**默认值工厂函数**：

```typescript
export function createDefaultCultivationProgress(
  realm: RealmType,
  realm_stage: RealmStage
): CultivationProgress {
  return {
    cultivation_exp: 0,
    exp_cap: calculateExpCap(realm, realm_stage),
    comprehension_insight: 0,
    breakthrough_failures: 0,
    bottleneck_state: false,
    inner_demon: false,
    deviation_risk: 0,
  };
}
```

### 6.3 闭关记录扩展

在 `RetreatRecord` 中新增字段记录修为变化：

```typescript
export interface RetreatRecord {
  // ... 现有字段
  exp_gained?: number;              // 本次闭关获得修为
  exp_before?: number;              // 闭关前修为
  exp_after?: number;               // 闭关后修为
  insight_gained?: number;          // 本次闭关获得感悟
  epiphany_triggered?: boolean;     // 是否触发顿悟
}
```

这些字段为可选，保持向后兼容。旧的闭关记录不会包含这些字段。

### 6.4 突破历史扩展

在 `BreakthroughHistoryEntry` 中新增字段：

```typescript
export interface BreakthroughHistoryEntry {
  // ... 现有字段
  exp_progress?: number;                // 突破时的修为进度（0-100百分比）
  insight_value?: number;               // 突破时的感悟值
  exp_lost_on_failure?: number;         // 失败时损失的修为（仅失败记录有）
  breakthrough_type?: 'forced' | 'normal' | 'perfect'; // 突破类型
}
```

这些字段为可选，保持向后兼容。

---

## 七、前端UI设计

### 7.1 修为进度展示

在角色主页新增"修为进度"卡片：

**展示内容**：

- 修为进度条（带百分比）
- 当前修为 / 修为上限（数值）
- 感悟值（0-100，用莲花图标或光点表示）
- 状态标签（积累中 / 可突破 / 瓶颈期 / 心魔缠身）

**UI示例**：

```
【修为进度】
─────────────────────────────
境界：筑基初期

修为：█████████░░ 4500 / 5000 (90%)
感悟：◉◉◉◉◉◎◎◎◎◎ 52 / 100

状态：🔒 已入瓶颈期，需另辟蹊径
─────────────────────────────
```

### 7.2 闭关页面改造

在 `/app/retreat/page.tsx` 中：

**新增预览信息**：

- 预计获得修为（范围）
- 修为满后是否可突破
- 突破成功率预览（如果修为已满）
- 顿悟概率提示

**修改闭关按钮逻辑**：

- 修为未满：按钮文案为"闭关修炼"
- 修为已满：按钮文案为"尝试突破"
- 瓶颈期：按钮禁用，提示引导玩家去副本/战斗

**闭关结果展示**：

- 显示获得的修为和感悟
- 如果触发顿悟，显示特殊动效和文案
- 如果触发走火入魔，显示警告信息和疗伤选项

### 7.3 突破确认弹窗

当修为满足突破条件时，点击"尝试突破"弹出确认窗：

**弹窗内容**：

```
【突破确认】
─────────────────────────────
当前状态：
  修为进度：95%
  感悟值：45
  预计成功率：62%

突破等级：常规突破
失败损失：约 1350-1900 修为（30%-40%）

是否确认突破？
─────────────────────────────
[三思而行]  [破境而出 →]
```

---

## 八、API接口设计

### 8.1 闭关修炼接口（改造）

**端点**：`POST /api/cultivator/retreat`

**请求体**：

| 字段 | 类型 | 说明 |
|------|------|------|
| cultivatorId | string | 角色ID |
| years | number | 闭关年限 |
| action | 'cultivate' \| 'breakthrough' | 操作类型：修炼或突破 |

**响应体**（修炼）：

```typescript
{
  success: true,
  data: {
    exp_gained: number,           // 获得修为
    insight_gained: number,       // 获得感悟
    epiphany_triggered: boolean,  // 是否顿悟
    new_exp: number,              // 当前总修为
    exp_cap: number,              // 修为上限
    progress: number,             // 进度百分比
    can_breakthrough: boolean,    // 是否可突破
    bottleneck_entered: boolean,  // 是否进入瓶颈期
    story?: string,               // AI生成的修炼叙事
  }
}
```

**响应体**（突破）：

```typescript
{
  success: true,
  data: {
    breakthrough_success: boolean,
    summary: BreakthroughAttemptSummary, // 原有突破结果
    exp_lost?: number,            // 失败时损失的修为
    insight_change: number,       // 感悟值变化
    inner_demon_triggered: boolean, // 是否触发心魔
    story?: string,               // 突破/失败叙事
  }
}
```

### 8.2 修为查询接口

**端点**：`GET /api/cultivator/cultivation-progress/:id`

**响应体**：

```typescript
{
  success: true,
  data: {
    cultivation_exp: number,
    exp_cap: number,
    progress: number,
    comprehension_insight: number,
    bottleneck_state: boolean,
    breakthrough_failures: number,
    can_breakthrough: boolean,
    recommended_action: 'cultivate' | 'breakthrough' | 'explore' | 'battle'
  }
}
```

### 8.3 顿悟触发接口（内部）

在战斗、副本完成后调用的内部逻辑：

**函数签名**：

```typescript
async function checkEpiphanyTrigger(
  cultivator: Cultivator,
  context: 'retreat' | 'battle' | 'dungeon'
): Promise<{
  triggered: boolean,
  insight_gained: number,
  buff_applied: boolean
}>
```

---

## 九、核心算法伪代码

### 9.1 闭关修炼算法

```
function performRetreat(cultivator, years):
  # 1. 检查冷却时间（保留原有逻辑）
  checkCooldown(cultivator)
  
  # 2. 计算修为获取
  主灵根强度 = getMainSpiritualRootStrength(cultivator)
  灵根系数 = 0.5 + 主灵根强度 / 100
  功法系数 = getCultivationTechniqueMultiplier(cultivator)
  悟性系数 = 1.0 + (cultivator.wisdom - 50) / 200
  年限系数 = 1.0 + log10(years)
  随机波动 = random(0.9, 1.1)
  
  基础修为 = getBaseExpByRealm(cultivator.realm)
  获得修为 = 基础修为 × years × 灵根系数 × 功法系数 × 悟性系数 × 年限系数 × 随机波动
  
  # 3. 检查是否触发顿悟
  if random() < (cultivator.wisdom / 2000):
    顿悟触发 = true
    获得修为 *= 2
    获得感悟 = random(20, 50)
    应用顿悟buff(cultivator)
  else:
    顿悟触发 = false
    获得感悟 = 0
  
  # 4. 应用瓶颈期修正
  if cultivator.bottleneck_state:
    获得修为 *= 0.5
  
  # 5. 更新修为
  cultivator.cultivation_exp += 获得修为
  cultivator.comprehension_insight += 获得感悟
  cultivator.age += years
  
  # 6. 检查是否达到修为上限
  if cultivator.cultivation_exp >= cultivator.exp_cap:
    cultivator.cultivation_exp = cultivator.exp_cap
    可突破 = true
    
    # 检查是否进入瓶颈期
    if 进度 >= 90% and not cultivator.bottleneck_state:
      cultivator.bottleneck_state = true
  else:
    可突破 = false
  
  # 7. 生成AI叙事（调用story service）
  story = generateRetreatStory(cultivator, 获得修为, 顿悟触发)
  
  # 8. 保存记录
  saveRetreatRecord(cultivator, years, 获得修为, 获得感悟, 顿悟触发)
  
  return {
    exp_gained: 获得修为,
    insight_gained: 获得感悟,
    epiphany_triggered: 顿悟触发,
    can_breakthrough: 可突破,
    bottleneck_entered: cultivator.bottleneck_state,
    story: story
  }
```

### 9.2 突破尝试算法

```
function attemptBreakthrough(cultivator):
  # 1. 检查前置条件
  if cultivator.cultivation_exp < cultivator.exp_cap × 0.6:
    throw Error("修为不足，无法突破")
  
  # 2. 计算修为进度和突破等级
  进度 = cultivator.cultivation_exp / cultivator.exp_cap
  
  if 进度 >= 1.0 and cultivator.comprehension_insight >= 50:
    突破等级 = 'perfect'
    进度系数 = 1.15
  else if 进度 >= 0.8:
    突破等级 = 'normal'
    进度系数 = 0.9 + (进度 - 0.8) × 0.5
  else:
    突破等级 = 'forced'
    进度系数 = 0.5 + (进度 - 0.6) × 1.0
  
  # 3. 计算感悟系数
  感悟系数 = 1.0 + cultivator.comprehension_insight / 200
  
  # 4. 调用原突破引擎计算基础成功率
  原成功率 = calculateOriginalBreakthroughChance(cultivator, years=0)
  
  # 5. 应用新系数
  最终成功率 = 原成功率 × 进度系数 × 感悟系数
  
  # 6. 应用心魔debuff
  if cultivator.inner_demon:
    最终成功率 *= 0.95
  
  # 7. roll突破
  roll = random()
  success = roll <= 最终成功率
  
  # 8. 处理突破结果
  if success:
    # 成功：调用原突破逻辑，应用属性成长
    result = performOriginalBreakthrough(cultivator)
    
    # 应用成长加成
    if 突破等级 == 'perfect':
      result.attributeGrowth *= 1.2
      cultivator.comprehension_insight += 15
    else if 突破等级 == 'forced':
      result.attributeGrowth *= 0.8
      cultivator.comprehension_insight -= 10
    else:
      cultivator.comprehension_insight += 5
    
    # 重置修为和状态
    cultivator.cultivation_exp = 0
    cultivator.exp_cap = calculateExpCap(cultivator.realm, cultivator.realm_stage)
    cultivator.breakthrough_failures = 0
    cultivator.bottleneck_state = false
    cultivator.inner_demon = false
    
  else:
    # 失败：损失修为
    if 突破等级 == 'perfect':
      损失比例 = random(0.2, 0.3)
    else if 突破等级 == 'normal':
      损失比例 = random(0.3, 0.5)
    else:
      损失比例 = random(0.5, 0.7)
    
    感悟保护系数 = cultivator.comprehension_insight / (突破等级 == 'forced' ? 500 : 300)
    实际损失比例 = 损失比例 × (1 - 感悟保护系数)
    
    损失修为 = cultivator.cultivation_exp × 实际损失比例
    cultivator.cultivation_exp -= 损失修为
    cultivator.comprehension_insight -= random(10, 20)
    cultivator.breakthrough_failures += 1
    
    # 检查心魔触发
    if cultivator.breakthrough_failures >= 3:
      cultivator.inner_demon = true
    
  # 9. 生成AI叙事
  story = generateBreakthroughStory(cultivator, success, 突破等级)
  
  # 10. 保存记录
  saveBreakthroughRecord(cultivator, success, 损失修为, 进度, 感悟值)
  
  return {
    success: success,
    exp_lost: 损失修为 or 0,
    insight_change: 感悟值变化,
    inner_demon_triggered: cultivator.inner_demon,
    story: story
  }
```

### 9.3 主灵根强度获取算法

```
function getMainSpiritualRootStrength(cultivator):
  if cultivator.spiritual_roots.length == 0:
    return 50  # 默认值（无灵根情况，理论上不应出现）
  
  主灵根 = cultivator.spiritual_roots[0]
  
  for root in cultivator.spiritual_roots:
    if root.strength > 主灵根.strength:
      主灵根 = root
  
  return 主灵根.strength
```

---

## 十、迁移方案

### 10.1 现有角色数据迁移

对于已存在的角色，需要初始化修为系统数据。

**迁移策略**：

1. **修为值初始化**：根据当前境界阶段，设置为修为上限的随机60%-90%
2. **感悟值初始化**：根据悟性属性，设置为 `悟性 / 2`（范围约25-50）
3. **其他字段**：均设为默认值

**迁移脚本（TypeScript）示例**：

```typescript
import { db } from '@/lib/drizzle/db';
import { cultivators } from '@/lib/drizzle/schema';
import { calculateExpCap } from '@/utils/cultivationUtils';
import { sql } from 'drizzle-orm';

async function migrateCultivationProgress() {
  const allCultivators = await db().select().from(cultivators);
  
  for (const cultivator of allCultivators) {
    // 跳过已有修为数据的角色
    if (cultivator.cultivation_progress) continue;
    
    const exp_cap = calculateExpCap(cultivator.realm, cultivator.realm_stage);
    const random_progress = 0.6 + Math.random() * 0.3;
    const cultivation_exp = Math.floor(exp_cap * random_progress);
    const comprehension_insight = Math.min(Math.floor(cultivator.wisdom / 2), 50);
    
    const cultivation_progress = {
      cultivation_exp,
      exp_cap,
      comprehension_insight,
      breakthrough_failures: 0,
      bottleneck_state: false,
      inner_demon: false,
      deviation_risk: 0,
    };
    
    await db().update(cultivators)
      .set({ cultivation_progress })
      .where(sql`id = ${cultivator.id}`);
  }
  
  console.log(`迁移完成：${allCultivators.length} 个角色`);
}
```

**Drizzle迁移文件**（`drizzle/00XX_add_cultivation_progress.sql`）：

```sql
-- 添加cultivation_progress字段
ALTER TABLE wanjiedaoyou_cultivators 
ADD COLUMN cultivation_progress JSONB DEFAULT '{}'::jsonb;

-- 创建JSONB索引以提升查询性能（可选）
CREATE INDEX idx_cultivation_exp 
ON wanjiedaoyou_cultivators 
USING gin ((cultivation_progress -> 'cultivation_exp'));
```

**注意事项**：
- 先执行SQL迁移添加字段
- 再运行TypeScript脚本初始化数据
- 建议在低峰期执行，避免影响用户体验

### 10.2 向后兼容性

**数据层兼容**：

```typescript
// 读取时自动初始化
function getCultivationProgress(cultivator: Cultivator): CultivationProgress {
  if (!cultivator.cultivation_progress) {
    return createDefaultCultivationProgress(
      cultivator.realm,
      cultivator.realm_stage
    );
  }
  return cultivator.cultivation_progress;
}
```

**闭关接口兼容**：

- 如果请求体没有 `action` 字段，默认为 `cultivate`
- 如果角色的 `cultivation_progress` 为空或null，自动初始化后再执行
- Repository层读取时自动填充默认值，写入时确保完整性

**前端渐进式升级**：

- 第一阶段：只显示修为进度，不改变突破逻辑
- 第二阶段：启用新突破逻辑，保留旧逻辑作为降级方案
- 第三阶段：完全移除旧逻辑

---

## 十一、后续扩展方向

### 11.1 境界稳固度系统

刚突破后境界不稳，需要通过战斗和历练巩固，详见"五、进阶机制 5.4"。

### 11.2 修为转化机制

允许玩家将过剩修为转化为其他资源：

- 转化为灵石（低效率）
- 注入法宝提升品质
- 传授给NPC弟子（未来如有门派系统）

### 11.3 感悟碎片收集

将感悟值拆分为不同类型的"感悟碎片"：

- 剑意碎片、丹道碎片、阵法碎片等
- 集齐特定碎片可解锁特殊技能或称号
- 增加收集乐趣和策略深度

### 11.4 修为排行榜

在现有排行榜基础上新增"修为榜"：

- 展示当前境界修为进度最高的修士
- 鼓励玩家追求修为极限而非急于突破

---

## 十二、平衡性调优建议

### 12.1 数值平衡测试重点

1. **修为获取速度**：确保平均玩家在合理时间内（如3-7天）能积累满一个阶段的修为
2. **突破失败损失**：失败惩罚不应过重，避免玩家长期无进展而流失
3. **灵根影响**：灵根差异不应过大，避免低灵根玩家完全失去游玩动力
4. **丹药平衡**：丹药提供的修为不应超过总需求的30%，保持闭关的主导地位

### 12.2 玩家行为引导

1. **新手引导**：在首次闭关时弹出修为系统说明
2. **瓶颈期提示**：明确告知玩家应该去副本或战斗
3. **风险警示**：强行突破时显著标红警告损失比例
4. **正向激励**：圆满突破时给予额外成就或称号奖励

### 12.3 数据监控指标

上线后需监控的关键数据：

- 平均突破成功率（目标：60%-75%）
- 玩家选择突破时的平均修为进度（目标：85%-95%）
- 走火入魔触发率（目标：<5%）
- 瓶颈期玩家的副本参与率提升幅度（目标：+30%以上）

---

## 十三、开发任务分解

### 阶段一：数据层（优先级：高）

- [ ] 数据库Schema设计和迁移脚本编写
- [ ] TypeScript类型定义扩展
- [ ] Repository层新增修为相关CRUD方法
- [ ] 现有角色数据迁移脚本

### 阶段二：核心逻辑层（优先级：高）

- [ ] 修为获取计算引擎（包含灵根系数）
- [ ] 突破成功率重构（整合修为进度和感悟）
- [ ] 突破失败惩罚逻辑
- [ ] 顿悟触发机制
- [ ] 瓶颈期检测和状态管理
- [ ] 走火入魔触发和恢复逻辑

### 阶段三：API接口（优先级：高）

- [ ] 改造 `/api/cultivator/retreat` 接口
- [ ] 新增修为查询接口
- [ ] 战斗胜利后修为奖励集成
- [ ] 副本完成后修为奖励集成

### 阶段四：前端UI（优先级：中）

- [ ] 角色主页修为进度卡片
- [ ] 闭关页面改造（预览、结果展示）
- [ ] 突破确认弹窗
- [ ] 顿悟特效和提示
- [ ] 走火入魔警告和疗伤界面
- [ ] 瓶颈期状态提示

### 阶段五：AI叙事增强（优先级：中）

- [ ] 修炼过程叙事生成（普通/顿悟）
- [ ] 突破成功叙事（强行/常规/圆满）
- [ ] 突破失败叙事（不同失败原因）
- [ ] 走火入魔叙事

### 阶段六：扩展功能（优先级：低）

- [ ] 炼丹系统集成（修为丹药）
- [ ] 感悟碎片收集系统
- [ ] 境界稳固度系统
- [ ] 修为排行榜

### 阶段七：测试与优化（优先级：高）

- [ ] 单元测试（修为计算、突破逻辑）
- [ ] 集成测试（完整闭关-突破流程）
- [ ] 数值平衡测试
- [ ] 性能测试（大量角色并发闭关）
- [ ] 用户体验测试

---

## 十四、风险评估

| 风险项 | 影响 | 概率 | 缓解措施 |
|-------|------|------|---------|
| 数值平衡失调 | 高 | 中 | 充分测试，保留动态调整参数的能力 |
| 玩家觉得太肝 | 高 | 中 | 设置合理的修为获取速度，提供多元化获取途径 |
| 突破失败惩罚过重导致流失 | 高 | 低 | 降低损失比例下限，增加感悟保护机制 |
| AI叙事生成延迟 | 中 | 中 | 叙事异步生成，先返回数值结果 |
| 数据库迁移失败 | 高 | 低 | 充分测试迁移脚本，保留回滚方案 |
| 灵根差距导致不公平 | 中 | 中 | 限制灵根系数范围（0.7-1.5），提供其他平衡机制 |

---

## 十五、成功指标

上线后1个月内达成以下目标视为成功：

1. **玩家参与度**：70%以上的活跃玩家至少完成一次完整的"修炼-突破"循环
2. **多元化游玩**：瓶颈期玩家的副本参与率提升30%以上
3. **满意度**：玩家反馈中关于"成长感不足"的抱怨降低50%
4. **平衡性**：突破成功率维持在60%-75%之间
5. **留存率**：新系统上线后7日留存率提升5%以上

1. **新手引导**：在首次闭关时弹出修为系统说明
2. **瓶颈期提示**：明确告知玩家应该去副本或战斗
3. **风险警示**：强行突破时显著标红警告损失比例
4. **正向激励**：圆满突破时给予额外成就或称号奖励

### 12.3 数据监控指标

上线后需监控的关键数据：

- 平均突破成功率（目标：60%-75%）
- 玩家选择突破时的平均修为进度（目标：85%-95%）
- 走火入魔触发率（目标：<5%）
- 瓶颈期玩家的副本参与率提升幅度（目标：+30%以上）

---

## 十三、开发任务分解

### 阶段一：数据层（优先级：高）

- [ ] 数据库Schema设计和迁移脚本编写
- [ ] TypeScript类型定义扩展
- [ ] Repository层新增修为相关CRUD方法
- [ ] 现有角色数据迁移脚本

### 阶段二：核心逻辑层（优先级：高）

- [ ] 修为获取计算引擎（包含灵根系数）
- [ ] 突破成功率重构（整合修为进度和感悟）
- [ ] 突破失败惩罚逻辑
- [ ] 顿悟触发机制
- [ ] 瓶颈期检测和状态管理
- [ ] 走火入魔触发和恢复逻辑

### 阶段三：API接口（优先级：高）

- [ ] 改造 `/api/cultivator/retreat` 接口
- [ ] 新增修为查询接口
- [ ] 战斗胜利后修为奖励集成
- [ ] 副本完成后修为奖励集成

### 阶段四：前端UI（优先级：中）

- [ ] 角色主页修为进度卡片
- [ ] 闭关页面改造（预览、结果展示）
- [ ] 突破确认弹窗
- [ ] 顿悟特效和提示
- [ ] 走火入魔警告和疗伤界面
- [ ] 瓶颈期状态提示

### 阶段五：AI叙事增强（优先级：中）

- [ ] 修炼过程叙事生成（普通/顿悟）
- [ ] 突破成功叙事（强行/常规/圆满）
- [ ] 突破失败叙事（不同失败原因）
- [ ] 走火入魔叙事

### 阶段六：扩展功能（优先级：低）

- [ ] 炼丹系统集成（修为丹药）
- [ ] 感悟碎片收集系统
- [ ] 境界稳固度系统
- [ ] 修为排行榜

### 阶段七：测试与优化（优先级：高）

- [ ] 单元测试（修为计算、突破逻辑）
- [ ] 集成测试（完整闭关-突破流程）
- [ ] 数值平衡测试
- [ ] 性能测试（大量角色并发闭关）
- [ ] 用户体验测试

---

## 十四、风险评估

| 风险项 | 影响 | 概率 | 缓解措施 |
|-------|------|------|---------|
| 数值平衡失调 | 高 | 中 | 充分测试，保留动态调整参数的能力 |
| 玩家觉得太肝 | 高 | 中 | 设置合理的修为获取速度，提供多元化获取途径 |
| 突破失败惩罚过重导致流失 | 高 | 低 | 降低损失比例下限，增加感悟保护机制 |
| AI叙事生成延迟 | 中 | 中 | 叙事异步生成，先返回数值结果 |
| 数据库迁移失败 | 高 | 低 | 充分测试迁移脚本，保留回滚方案 |
| 灵根差距导致不公平 | 中 | 中 | 限制灵根系数范围（0.7-1.5），提供其他平衡机制 |

---

## 十五、成功指标

上线后1个月内达成以下目标视为成功：

1. **玩家参与度**：70%以上的活跃玩家至少完成一次完整的"修炼-突破"循环
2. **多元化游玩**：瓶颈期玩家的副本参与率提升30%以上
3. **满意度**：玩家反馈中关于"成长感不足"的抱怨降低50%
4. **平衡性**：突破成功率维持在60%-75%之间
5. **留存率**：新系统上线后7日留存率提升5%以上
