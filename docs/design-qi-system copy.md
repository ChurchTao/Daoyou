# 「天地灵气」统一体力系统 — 重构方案

## 一、背景与动机

### 1.1 现状问题

《万界道友》当前各玩法采用**独立的限制机制**：副本每天 2 次、天骄榜每天 10 次、闭关修炼每天消耗 200 年寿元上限等。这些限制各自为政，带来了几个核心问题：

- **玩家体验僵硬**：每种玩法的次数相互独立，玩家无法按自己的偏好分配游戏时间。想多刷副本的玩家无法把天骄榜的次数"转移"过来。
- **成本管控分散**：每个需要 LLM 参与的玩法都有自己的限制器（`dungeonLimiter`、`lifespanLimiter`、`characterGenerationLimiter` 等），缺乏统一的成本视角。
- **扩展性差**：新增一个玩法就要写一个新的 Limiter，数值调整需要逐个系统修改。
- **付费设计困难**：独立的次数限制难以设计统一的付费补充方案。

### 1.2 设计目标

引入一个**统一的「天地灵气」资源系统**，实现：

1. **统一成本度量**：将所有涉及 LLM 调用或重要游戏进展的行为，统一折算为「灵气」消耗。
2. **玩家自主分配**：取消各玩法的独立次数限制，玩家持有一个灵气池，自由选择参与什么玩法。
3. **每日懒刷新**：每天按需恢复灵气（玩家操作或登录时触发），不做全表批量刷新，保证日活节奏的同时避免百万级角色的性能问题。
4. **付费扩展预留**：可通过道具（如「聚灵丹」）补充灵气，为后续商业化留口子。
5. **反作弊保底**：保留必要的冷却时间和并发锁，防止短时间内恶意刷取。

---

## 二、核心概念设计

### 2.1 名称与世界观融合

推荐名称：**「天地灵气」**（简称「灵气」）

世界观包装：修仙世界中，天地间的灵气是万物修行的根基。每一次探索秘境、炼制丹药、推演天机，都需要汲取天地灵气。灵气会随着时间自然汇聚，也可通过灵石阵法或丹药加速恢复。

选择理由：
- 「灵气」是修仙世界观中最通用的概念，天然适合做统一资源。
- 比「体力值」更有沉浸感，比「疲劳值」更正面积极。
- 与现有的灵石、修为形成三层资源体系：**灵石（货币）→ 灵气（行动力）→ 修为（进度）**。

### 2.2 资源定义

| 属性 | 值 | 说明 |
|------|------|------|
| 资源名称 | 天地灵气（Qi） | 统一体力资源 |
| 存储位置 | `cultivators.qi` (integer) | 新增数据库列 |
| 上限（Max Qi） | **200**（全角色统一） | 不随境界变化，所有玩家公平一致 |
| 每日恢复量 | **200**（全角色统一） | 每日恢复至上限，等效 4 次副本 |
| 恢复策略 | **懒刷新**（无批量 cron） | 玩家执行操作或登录时按需刷新，不对全表做定时 UPDATE |
| 溢出规则 | 基础上限 200 | 自然恢复不超过上限，道具补充可临时超出上限（不超过 300，即 150%） |

### 2.3 统一上限设计说明

所有角色不论境界，灵气上限和每日恢复量均为 **200 点**。

设计理由：

- **公平性**：新玩家与老玩家拥有相同的每日行动力，降低了新玩家的追赶压力。
- **简单直观**：不需要向玩家解释"为什么我的灵气上限比他少"，一个数字走天下。
- **成本可控**：统一的灵气上限意味着每个角色的 LLM 成本上限一致，便于运营预算。
- **境界差异化体现在别处**：高境界角色在战斗数值、可用玩法、装备品质上有优势，灵气层面保持平等。

> 注：如果未来希望给高境界玩家更多灵气，只需在配置文件中引入境界映射表即可，当前设计不做过度预留。

### 2.4 灵气突破上限（道具补充溢出）

通过付费道具（「聚灵丹」等）补充灵气时，允许临时超出基础上限，但设有**溢出上限**：

- 溢出上限 = 200 × 150% = **300**
- 自然恢复只在低于 200 时生效
- 灵气会随时间消耗逐渐回到基础上限以内

这个设计参考了主流手游（如原神的浓缩树脂、明日方舟的理智）的做法，既保护了付费意愿，又防止无限堆积。

---

## 三、各玩法灵气消耗定价

### 3.1 定价原则

1. **LLM 成本正比原则**：LLM 调用越重的玩法，灵气消耗越高。
2. **进度价值原则**：对角色成长影响越大的行为，消耗越高。
3. **低门槛保底**：基础体验行为（如查看信息、世界聊天）不消耗灵气。
4. **PvP 公平性**：PvP 战斗本身的确定性部分（天骄榜挑战、赌战）消耗较低，但附带 LLM 的战前/战后叙事则增加消耗。

### 3.2 灵气消耗表

| 玩法 | 行为 | 灵气消耗 | LLM 调用 | 说明 |
|------|------|---------|---------|------|
| **副本探索** | 开始一次副本 | **50** | 是（多轮叙事生成） | 原限制 2 次/天 → 现等效 4 次，LLM 最重的玩法 |
| **造物炼器** | 创建一件物品 | **8** | 是（LLM 生成） | 含法宝、功法、神通，含叙事润色 |
| **炼丹（自由）** | 自由炼丹一次 | **15** | 是（LLM 属性解析） | 高 LLM 消耗，需完整解析玩家输入 |
| **炼丹（丹方）** | 按丹方炼丹 | **8** | 轻度（叙事润色） | LLM 消耗较轻，与造物齐平 |
| **丹方解析** | 解析未知丹方 | **5** | 是（LLM 分析） | 保留 30 秒冷却防刷 |
| **幻境之塔** | 开始新一轮 | **30** | 是（敌人生成） | 赛季制，LLM 调用较重 |
| **闭关修炼** | 每消耗 10 年寿元 | **5** | 是（突破故事） | 原限制 200 年/天，现等效可闭关 400 年 |
| **突破** | 尝试破境 | **15** | 是（破境叙事） | 重要节点，单独定价 |
| **历练收益** | 领取离线收益 | **8** | 是（收益故事 + 材料生成） | 每日 1-2 次 |
| **天骄榜挑战** | 发起一次挑战 | **8** | 否 | 确定性战斗，轻度消耗 |
| **赌战** | 创建/参与赌战 | **8** | 否 | 确定性战斗 |
| **命格重塑** | 重塑命格 | **30** | 是（LLM 生成） | 重要行为，高消耗 |
| **天机推演** | 每日运势 | **5** | 是（LLM 生成） | 每日 1 次，轻量 |
| **坊市鉴定** | 鉴定物品 | **5** | 是（LLM 评估） | 低消耗 |
| **灵眼之泉疗养** | 恢复 HP/MP | **0** | 否 | 纯数值操作，不消耗灵气 |
| **服用丹药** | 使用消耗品 | **0** | 否 | 纯数值操作 |
| **拍卖行** | 买/卖物品 | **0** | 否 | 玩家间经济 |
| **世界聊天** | 发送消息 | **0** | 否 | 保留 60 秒冷却即可 |
| **问法寻卷** | 抽卡 | **0** | 否（间接） | 已有符箓消耗做门槛 |

### 3.3 不消耗灵气但保留限制的行为

以下行为不涉及 LLM 或已用其他资源做门槛，无需纳入灵气系统：

- **角色创建**：保持每日 6 次 / 邮箱 / IP 的限制（防止批量注册滥用）
- **兑换码**：保持现有机制
- **日常任务**：任务本身不消耗灵气（它们是被动追踪的行为）

---

## 四、替代现有限制器的迁移策略

### 4.1 被替代的独立限制器

| 现有限制器 | 原限制 | 迁移方案 |
|-----------|-------|---------|
| `dungeonLimiter` | 2 次/天 | **废弃**。由灵气系统统一管控，副本 50 灵气/次，等效 4 次 |
| `lifespanLimiter`（每日寿元上限） | 200 年/天 | **废弃**。闭关改为消耗灵气（5 灵气/10 年），寿元仍按角色实际寿元扣除 |
| `rankings daily challenges` | 10 次/天 | **废弃**。天骄榜挑战改为每次消耗 8 灵气 |

### 4.2 保留的限制器

| 限制器 | 原因 |
|--------|------|
| `characterGenerationLimiter` | 防批量注册，与游戏内体力无关 |
| `worldChatLimiter`（60 秒冷却） | 防刷屏，保留 |
| `alchemyFormulaCooldown`（30 秒冷却） | 防脚本刷解析，保留作为反刷机制 |
| 并发锁（retreat lock、challenge lock 等） | 防并发冲突，保留 |
| 拍卖行上架数量上限（5 个） | 经济平衡，保留 |
| 赌战上限（1 个） | 经济平衡，保留 |

### 4.3 迁移方式：直接切换

本系统采用**一次性直接切换**，不设过渡期：

1. 执行数据库迁移，为所有角色新增灵气列，初始值设为 200（满灵气）。
2. 在同一个版本中，所有玩法入口统一接入灵气消耗检查。
3. 同步废弃旧限制器（`dungeonLimiter`、`lifespanLimiter`、`rankings daily challenges`）。
4. 旧限制器的 Redis 键会在次日自然过期，无需手动清理。

选择直接切换的原因：

- 灵气系统在各玩法的等效次数上不低于旧限制（副本从 2 次提升到 4 次），玩家体验只会变好。
- 灰度并存阶段会让代码复杂度翻倍（既要检查灵气又要检查旧限制），增加出错风险。
- 数值配置化设计，如有问题可快速调整灵气消耗值来应对。

---

## 五、数据库与技术方案

### 5.1 数据库变更

**新增列（迁移文件 0048+）：**

```sql
ALTER TABLE wanjiedaoyou_cultivators
  ADD COLUMN qi INTEGER NOT NULL DEFAULT 200,
  ADD COLUMN qi_max INTEGER NOT NULL DEFAULT 200,
  ADD COLUMN qi_last_refreshed_at TIMESTAMPTZ DEFAULT NOW();
```

| 列名 | 类型 | 说明 |
|------|------|------|
| `qi` | INTEGER | 当前灵气值，默认 200（满灵气） |
| `qi_max` | INTEGER | 灵气上限，当前统一 200，预留给未来可能的调整 |
| `qi_last_refreshed_at` | TIMESTAMPTZ | 上次灵气刷新时间，用于懒刷新判断 |

**新增灵气日志表（可选但推荐）：**

```sql
CREATE TABLE wanjiedaoyou_qi_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cultivator_id UUID NOT NULL REFERENCES wanjiedaoyou_cultivators(id),
  action VARCHAR(50) NOT NULL,       -- 'dungeon_start', 'retreat', 'craft', etc.
  qi_cost INTEGER NOT NULL,          -- 消耗量（正数）
  qi_gain INTEGER NOT NULL DEFAULT 0,-- 获得量（道具补充等）
  qi_before INTEGER NOT NULL,
  qi_after INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_qi_logs_cultivator_date
  ON wanjiedaoyou_qi_logs(cultivator_id, created_at DESC);
```

这张表用于审计、数据分析和反作弊。可以定期清理超过 30 天的日志。

### 5.2 核心服务层设计

**新增 `QiService`（`src/server/lib/services/QiService.ts`）：**

```typescript
/**
 * 天地灵气管理服务
 *
 * 核心职责：
 * 1. 检查灵气是否充足
 * 2. 扣除灵气（原子操作）
 * 3. 补充灵气（道具/付费）
 * 4. 懒刷新（操作/登录时按需触发）
 */

// 灵气消耗配置表
const QI_COSTS: Record<string, number> = {
  dungeon_start: 50,
  retreat_per_10_years: 5,
  breakthrough: 15,
  yield_claim: 8,
  craft_creation: 8,
  alchemy_improvised: 15,
  alchemy_formula: 8,
  alchemy_formula_analysis: 5,
  tower_start: 30,
  ranking_challenge: 8,
  bet_battle: 8,
  divine_fortune: 5,
  fate_reshape: 30,
  market_appraisal: 5,
};

// 统一灵气上限与每日恢复量
const QI_MAX = 200;
const QI_DAILY_REFRESH = 200;
```

**核心方法：**

```typescript
class QiService {
  /**
   * 检查灵气是否充足（不扣除）
   * 内部会先触发懒刷新（如跨天）
   */
  async checkQi(cultivatorId: string, action: string): Promise<{
    sufficient: boolean;
    current: number;
    required: number;
  }>;

  /**
   * 消耗灵气（原子操作，含并发保护）
   * 执行前自动触发懒刷新（如跨天）
   * 返回扣除后的灵气值
   */
  async consumeQi(cultivatorId: string, action: string): Promise<{
    success: boolean;
    qiBefore: number;
    qiAfter: number;
    consumed: number;
  }>;

  /**
   * 补充灵气（道具/付费）
   * 允许溢出至 300（QI_MAX * 1.5）
   */
  async restoreQi(cultivatorId: string, amount: number, source: string): Promise<{
    success: boolean;
    qiBefore: number;
    qiAfter: number;
    restored: number;
    overflowCap: number;
  }>;

  /**
   * 懒刷新：检查是否需要跨天恢复灵气
   * 在执行灵气操作或角色登录时调用
   * 如果 qi_last_refreshed_at 不是今天（Asia/Shanghai），则恢复至上限
   */
  async refreshIfNeeded(cultivatorId: string): Promise<void>;
}
```

### 5.3 每日刷新策略：纯懒刷新

**不使用定时 cron 任务**，完全依赖懒刷新。

原因：当角色数量达到数十万甚至百万级别时，每日全表 UPDATE 不仅成本高昂（大量无用写操作），而且会产生明显的执行延迟。绝大多数角色可能长期不登录，批量刷新纯属浪费。

**懒刷新机制：**

1. **触发时机**：每次玩家执行灵气消耗操作前，或角色登录加载信息时。
2. **判断逻辑**：比较 `qi_last_refreshed_at` 与当前时间（Asia/Shanghai 时区）是否为同一天。如果跨天，则执行一次刷新。
3. **刷新行为**：如果当前灵气 < 上限（200），则恢复至上限；如果灵气已 >= 上限（如道具补充溢出），则保持不变，只更新时间戳。
4. **原子性**：刷新和灵气扣除在同一次数据库操作中完成，避免并发问题。

**懒刷新伪代码：**

```typescript
async function refreshAndConsume(cultivatorId: string, action: string) {
  const cost = QI_COSTS[action];
  if (!cost) throw new Error(`Unknown action: ${action}`);

  const today = getTodayString('Asia/Shanghai'); // 'YYYY-MM-DD'

  // 一次 SQL 同时完成懒刷新 + 扣除（利用 CASE WHEN 保证原子性）
  const result = await db.execute(sql`
    UPDATE wanjiedaoyou_cultivators
    SET
      qi = CASE
        WHEN DATE(qi_last_refreshed_at AT TIME ZONE 'Asia/Shanghai') < ${today}::date
        THEN LEAST(${QI_MAX}, GREATEST(qi, ${QI_MAX})) - ${cost}
        ELSE qi - ${cost}
      END,
      qi_last_refreshed_at = CASE
        WHEN DATE(qi_last_refreshed_at AT TIME ZONE 'Asia/Shanghai') < ${today}::date
        THEN NOW()
        ELSE qi_last_refreshed_at
      END
    WHERE id = ${cultivatorId}
      AND (
        CASE
          WHEN DATE(qi_last_refreshed_at AT TIME ZONE 'Asia/Shanghai') < ${today}::date
          THEN LEAST(${QI_MAX}, GREATEST(qi, ${QI_MAX}))
          ELSE qi
        END
      ) >= ${cost}
    RETURNING qi, qi_last_refreshed_at
  `);

  if (result.length === 0) {
    // 灵气不足，查询当前值返回给调用方
    return { success: false, ... };
  }
  return { success: true, qiAfter: result[0].qi, consumed: cost };
}
```

**登录时预刷新（可选优化）：**

在角色信息加载接口中调用 `refreshIfNeeded()`，让玩家登录时就能看到正确的灵气值，而不是等到操作时才发现跨天了。这只是一个展示优化，核心逻辑仍由操作时的原子刷新保证。

**为什么不需要 cron 兜底：**

- 灵气数据只在玩家操作时才被读取和消费，不活跃的角色的灵气值不需要是最新的。
- 排行榜等读取场景只关心排名数据（战斗结果），不依赖灵气值做排序。
- 如果需要查看不活跃玩家的灵气值（如管理后台），可以在查询层做日期判断后展示"明日恢复"标签。

### 5.4 与现有 Redis 限制器的关系

灵气系统**主要使用数据库**存储，不依赖 Redis 做核心计数。原因：

- 灵气值需要与角色数据一起参与事务（扣灵气 + 执行玩法 = 一个事务）。
- 数据库操作可以保证原子性和一致性。
- Redis 限制器的模式（`{feature}:daily:{id}:{date}`）不再需要，可以随旧限制器一起清理。

但仍保留 Redis 用于：

- **并发锁**：防止同一玩家同时发起多个消耗灵气的操作。
- **短冷却**：炼丹公式解析 30 秒、世界聊天 60 秒等。

---

## 六、付费设计预留

### 6.1 灵气补充道具

| 道具名称 | 效果 | 获取方式 | 设计意图 |
|---------|------|---------|---------|
| **聚灵丹（小）** | 恢复 50 灵气 | 商城购买 / 活动奖励 | 等效 1 次副本 |
| **聚灵丹（中）** | 恢复 100 灵气 | 商城购买 / 周卡奖励 | 等效半日行动力 |
| **聚灵丹（大）** | 恢复 200 灵气 | 商城购买 / 月卡奖励 | 等效一整管灵气 |
| **天地灵泉** | 立即回满至上限 | 稀有活动 / 高价位商城 | 应急使用 |

### 6.2 付费边界原则

- **绝不售卖灵气本身**：灵气只能通过游戏内自然恢复或道具补充，道具可以通过游戏内途径获得。
- **付费加速而非付费获胜**：付费只增加每日可做的事情量，不影响单次玩法的收益。
- **防沉迷底线**：每日道具补充灵气有次数上限（如聚灵丹每天最多使用 3 次），防止无限制氪金刷取。
- **VIP/月卡体系**：可设计「道友令牌」月卡，效果为每日灵气上限 +40（即 240）、每日自动恢复量 +40。

### 6.3 未来扩展接口

道具补充灵气的接口设计为通用的 `restoreQi(cultivatorId, amount, source)` 方法，`source` 参数可以是：

- `'item'`：使用背包中的聚灵丹
- `'shop'`：商城直接购买
- `'monthly_card'`：月卡每日自动补充
- `'gm'`：管理员手动补充
- `'compensation'`：系统补偿（如维护补偿邮件附带灵气）

---

## 七、前端交互设计

### 7.1 灵气显示

在游戏主界面（角色信息面板）顶部显示灵气状态：

```
  天地灵气  ████████████████░░░░  144/200
```

- 进度条颜色：>60% 绿色，30-60% 黄色，<30% 红色
- 点击可展开灵气详情面板

### 7.2 灵气详情面板

展示内容：

- 当前灵气 / 上限
- 今日恢复量 / 已消耗量
- 各玩法消耗明细（今日）
- 道具补充入口（聚灵丹按钮）
- 下次自然恢复时间（次日 00:00）

### 7.3 玩法入口拦截

当灵气不足时，各玩法入口按钮变为灰色，显示：

```
灵气不足（需要 50，当前 12）
[使用聚灵丹]  [等待恢复]
```

### 7.4 灵气消耗预览

在玩家确认执行操作前，显示灵气消耗提示：

```
  ┌─ 副本探索 ──────────────────┐
  │ 消耗灵气：50               │
  │ 当前灵气：144 → 94         │
  │                            │
  │      [确认出发]             │
  └────────────────────────────┘
```

### 7.5 前端 Contract 变更

在 `src/shared/contracts/` 中新增：

```typescript
// 灵气相关 contract
export interface QiState {
  current: number;
  max: number;
  dailyRefresh: number;
  lastRefreshedAt: string; // ISO datetime
  todayConsumed: number;   // 今日已消耗（可选，用于详情展示）
  todayRestored: number;   // 今日已补充（道具）
}

export interface QiConsumeResult {
  success: boolean;
  qiBefore: number;
  qiAfter: number;
  consumed: number;
  action: string;
  message?: string; // 灵气不足时的提示
}

export interface QiRestoreResult {
  success: boolean;
  qiBefore: number;
  qiAfter: number;
  restored: number;
  overflowCap: number;
}
```

---

## 八、数值平衡与经济影响

### 8.1 等效日常活动量对比

以**200 灵气/天**为例，与当前系统对比：

| 玩法 | 当前限制 | 新系统下的等效量 | 变化 |
|------|---------|----------------|------|
| 副本 | 2 次/天 | 200 ÷ 50 = **4 次**（纯副本的话） | 翻倍 |
| 天骄榜 | 10 次/天 | 200 ÷ 8 = **25 次**（纯挑战的话） | 大幅增加 |
| 闭关 | 200 年/天 | 200 ÷ 5 × 10 = **400 年**（纯闭关的话） | 翻倍 |
| 造物 | 无上限 | 200 ÷ 8 = **25 次**（纯造物的话） | 明确上限 |

**但这正是设计的核心意图**：玩家不可能把所有灵气都花在一个玩法上。灵气系统的本质是让玩家**在多种玩法之间分配有限的行动力**，而不是在每种玩法上都无限制。

一个典型玩家的日活分配可能如下：

| 行为 | 次数 | 灵气消耗 | 小计 |
|------|------|---------|------|
| 领取离线收益 | 1 次 | 8 | 8 |
| 天机推演 | 1 次 | 5 | 5 |
| 闭关修炼 30 年 | 1 次 | 15 | 15 |
| 副本探索 | 2 次 | 50 | 100 |
| 炼丹 | 1 次 | 8 | 8 |
| 天骄榜挑战 | 3 次 | 8 | 24 |
| 幻境之塔 | 1 次 | 30 | 30 |
| 造物 | 1 次 | 8 | 8 |
| **合计** | | | **198 / 200** |

几乎用满了灵气，但玩家可以根据自己的需求灵活调整——今天想多刷一次副本？放弃天骄榜和幻境之塔就行。

### 8.2 LLM 成本预估

按上述典型日活计算 LLM 调用次数：

| 行为 | LLM 调用 | 每日次数 | 总调用 |
|------|---------|---------|-------|
| 离线收益 | 1 次 | 1 | 1 |
| 天机推演 | 1 次 | 1 | 1 |
| 闭关突破故事 | 1 次 | ~0.3（约 3 天 1 次突破） | 0.3 |
| 副本叙事（3-5 轮/次） | 3-5 次 | 2 | 8 |
| 炼丹 | 1 次 | 1 | 1 |
| 幻境之塔敌人生成 | 1 次 | 1 | 1 |
| 造物 | 2-3 次 | 1 | 2.5 |
| 天骄榜（无 LLM） | 0 次 | 3 | 0 |
| **合计** | | | **~14.8 次/天/玩家** |

对比旧系统：

| 行为 | 旧系统每日 LLM 调用上限 |
|------|---------------------|
| 副本叙事 | 2 × 5 = 10 |
| 闭关突破 | ~1（受寿元限制） |
| 离线收益 | 1 |
| 天机推演 | 1 |
| 炼丹 | 无上限（实际 ~2-3） |
| 造物 | 无上限（实际 ~1-2） |
| 幻境之塔 | 无上限 |
| **合计** | **~17-20 次/天/玩家** |

灵气系统下 LLM 成本**反而略有下降**（从 ~18 次降至 ~15 次），因为副本虽然从 2 次增到 4 次（上限），但典型玩家通常只跑 2 次，而造物/天骄榜等低消耗玩法的增加不会带来额外 LLM 成本。灵气系统提供了更精确的成本控制——灵气上限 200 就是一个硬性的每日 LLM 预算天花板。

### 8.3 灵石经济影响

灵气系统与灵石经济正交。灵气控制行动次数，灵石控制物品价值。两者不会产生直接冲突。

需要注意的是：当玩家可以更多地刷副本（从 2 次增到最多 4 次），副本产出的材料/灵石总量会增加。建议同步审视副本掉落表，确保经济不会通胀。如有必要，可以在高灵气消耗下降低单次副本的掉落量。

---

## 九、数值配置化设计

所有灵气相关数值应集中在配置文件中，便于后续调整：

**新增文件 `src/shared/config/qiSystem.ts`：**

```typescript
/**
 * 天地灵气系统配置
 * 所有数值集中管理，方便策划调整
 */

/** 统一灵气上限（所有角色一致） */
export const QI_MAX = 200;

/** 每日灵气恢复量（所有角色一致） */
export const QI_DAILY_REFRESH = 200;

/** 各玩法灵气消耗 */
export const QI_ACTION_COSTS = {
  dungeon_start: 50,
  retreat_per_10_years: 5,
  breakthrough: 15,
  yield_claim: 8,
  craft_creation: 8,
  alchemy_improvised: 15,
  alchemy_formula: 8,
  alchemy_formula_analysis: 5,
  tower_start: 30,
  ranking_challenge: 8,
  bet_battle: 8,
  divine_fortune: 5,
  fate_reshape: 30,
  market_appraisal: 5,
} as const;

/** 道具补充灵气的溢出系数（相对于基础上限） */
export const QI_OVERFLOW_RATIO = 1.5;

/** 溢出上限（QI_MAX * QI_OVERFLOW_RATIO） */
export const QI_OVERFLOW_MAX = 300;

/** 每日道具补充次数上限 */
export const QI_DAILY_RESTORE_LIMIT = 3;

/** 灵气刷新时区 */
export const QI_REFRESH_TIMEZONE = 'Asia/Shanghai';
```

---

## 十、API 设计

### 10.1 新增接口

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/cultivator/qi` | 获取当前灵气状态 |
| `POST` | `/api/cultivator/qi/restore` | 使用道具恢复灵气 |
| `GET` | `/api/cultivator/qi/logs` | 查看今日灵气消耗明细 |

### 10.2 现有接口变更

所有需要消耗灵气的接口，在执行主逻辑之前，统一调用 `QiService.consumeQi()` 进行灵气扣除。扣除失败则返回 `402 Qi Insufficient` 错误码（自定义），附带所需灵气量和当前灵气量。

**错误响应示例：**

```json
{
  "error": "QI_INSUFFICIENT",
  "message": "灵气不足，无法探索副本",
  "required": 50,
  "current": 12,
  "action": "dungeon_start"
}
```

---

## 十一、实施计划

### Phase 0：准备（1-2 天）

- 创建 `qiSystem.ts` 配置文件
- 新增 `QiService` 服务（含懒刷新逻辑）
- 编写数据库迁移文件
- 新增灵气相关 Contract 类型

### Phase 1：核心玩法接入（3-5 天）

- 数据库迁移（新增列 + 日志表）
- `QiService` 实现（消耗、恢复、懒刷新）
- 改造副本系统接入灵气消耗（50/次）
- 改造闭关/突破系统接入灵气消耗
- 改造天骄榜接入灵气消耗
- **同步废弃**旧限制器（`dungeonLimiter`、`lifespanLimiter`、rankings daily）

### Phase 2：全玩法接入（3-5 天）

- 改造造物/炼丹系统（8/15）
- 改造幻境之塔（30）
- 改造历练收益（8）
- 改造命格重塑（30）
- 改造天机推演（5）
- 改造坊市鉴定（5）

### Phase 3：前端适配（3-5 天）

- 灵气状态栏 UI
- 灵气详情面板
- 各玩法入口拦截与消耗预览
- 道具补充入口

### Phase 4：付费道具（后续版本）

- 实现聚灵丹道具（走现有消耗品系统）
- 商城上架
- 月卡/VIP 灵气加成

---

## 十二、风险与对策

### 12.1 风险清单

| 风险 | 影响 | 概率 | 对策 |
|------|------|------|------|
| 灵气消耗定价不合理 | 某些玩法被冷落或过度使用 | 高 | 配置化设计便于快速调整，上线后根据数据微调 |
| LLM 成本意外上升 | 运营费用增加 | 低 | 灵气系统天然限制了每日 LLM 调用总量（~15 次/天），比旧系统更可控 |
| 老玩家不适应 | 社区负面反馈 | 中 | 提前公告，副本从 2 次提升到 4 次，整体体验只升不降 |
| 副本产出通胀 | 灵石/材料经济失衡 | 中 | 同步审视副本掉落表，必要时按灵气消耗比例降低单次掉落 |
| 灵气刷新时区问题 | 海外玩家体验差 | 低 | 当前以 Asia/Shanghai 为准，后续可考虑按玩家时区个性化 |

### 12.2 回滚方案

灵气系统通过数据库列和独立服务实现，与旧限制器解耦。如需回滚：

1. 在配置中关闭灵气检查（`QiService.consumeQi` 变为 no-op）
2. 重新启用旧限制器
3. 灵气数据保留不删除，便于后续重新上线

---

## 十三、改动文件汇总

| 文件 | 操作 | 说明 |
|------|------|------|
| `drizzle/0048_qi_system.sql` | 新增 | 数据库迁移：灵气列 + 日志表 |
| `src/shared/config/qiSystem.ts` | 新增 | 灵气系统数值配置 |
| `src/shared/types/qi.ts` | 新增 | 灵气相关类型定义 |
| `src/shared/contracts/qi.ts` | 新增 | 灵气 API Contract |
| `src/server/lib/services/QiService.ts` | 新增 | 灵气管理核心服务 |
| `src/server/routes/api/cultivator.ts` | 修改 | 新增灵气查询/恢复接口 |
| `src/server/lib/dungeon/dungeonLimiter.ts` | 废弃 | 由灵气系统替代 |
| `src/server/lib/redis/lifespanLimiter.ts` | 废弃 | 由灵气系统替代 |
| `src/server/lib/redis/rankings.ts` | 修改 | 移除每日挑战计数逻辑 |
| `src/server/lib/services/DungeonService.ts` | 修改 | 接入灵气消耗 |
| `src/server/lib/services/CultivationService.ts` | 修改 | 闭关/突破接入灵气消耗 |
| `src/server/lib/services/RankingService.ts` | 修改 | 天骄榜接入灵气消耗 |
| `src/server/lib/services/AlchemyService.ts` | 修改 | 炼丹接入灵气消耗 |
| `src/server/lib/services/CraftService.ts` | 修改 | 造物接入灵气消耗 |
| `src/server/lib/services/TowerService.ts` | 修改 | 幻境之塔接入灵气消耗 |
| `src/server/lib/services/MarketService.ts` | 修改 | 鉴定接入灵气消耗 |
| `src/server/lib/services/FateReshapeService.ts` | 修改 | 命格重塑接入灵气消耗 |
| `src/server/lib/services/DivineFortuneService.ts` | 修改 | 天机推演接入灵气消耗 |
| `src/server/lib/services/YieldService.ts` | 修改 | 历练收益接入灵气消耗 |
| `src/react-app/` | 修改 | 前端灵气 UI 适配 |
| `docs/design-qi-system.md` | 新增 | 本设计文档 |

---

## 十四、总结

「天地灵气」统一体力系统的核心价值在于：

**对玩家**：从「每种玩法各有限制」变为「一个灵气池自由分配」，游戏体验更自由、更有策略深度。选择今天多刷副本还是多炼丹，成为了有意义的决策。

**对开发者**：从「N 个独立限制器」变为「1 个灵气配置表」，新增玩法只需在 `QI_ACTION_COSTS` 中加一行配置。数值调整只需改一个文件。

**对运营**：灵气系统提供了精确的成本控制能力——每个玩家的每日 LLM 调用上限由灵气上限和消耗配置决定，可以精确计算和调整。同时为付费道具（聚灵丹）和会员体系（月卡灵气加成）预留了清晰的接口。

整套方案在现有架构上改动可控，核心依赖已有的数据库事务和并发锁机制，懒刷新设计避免了百万级角色的批量 UPDATE 问题，不需要引入新的中间件或定时任务。
