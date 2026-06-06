# 「天地灵气」行动力系统 — 首版重构方案

## 一、方案定位

### 1.1 设计结论

「天地灵气」是《万界道友》的统一行动力资源，用来约束高成本、高成长价值的主动玩法。首版不追求覆盖所有系统，而是先接入三类核心玩法：

- **副本探索**：原每日 2 次限制废弃，改为每次消耗 50 灵气。
- **造物体系**：炼丹、炼器、创造功法、创造神通统一接入灵气消耗。
- **闭关修炼/突破**：原每日闭关寿元上限废弃，改为按闭关年限或突破行为消耗灵气。

天骄榜首版**不接入灵气**，继续保留每日 10 次挑战限制。该决策用于保持竞技系统的公平性，避免通过补充行动力直接购买更多排名冲击机会。

### 1.2 要解决的问题

当前各玩法存在独立限制器，例如副本次数、闭关每日寿元上限、角色生成配额、世界聊天冷却等。它们承担的目标不同，但在玩家感知上容易混在一起，造成三个问题：

- **成长入口分散**：副本、闭关、造物分别有不同门槛，玩家无法用一个统一资源规划当天重点。
- **LLM 成本缺少统一阀门**：副本、造物、炼丹等玩法都可能触发 LLM，但限制方式散落在各模块。
- **商业化承接困难**：如果每个玩法各有次数，道具补充会变成多个入口，规则难解释，也更难维护。

灵气系统的首版目标是把“主动推进成长且成本较高”的玩法统一到一个行动力池中。它不是严格的 LLM 硬预算，也不承诺每 1 点灵气对应固定 Token 成本；运营和策划仍以消耗表作为唯一可维护的调参入口。

### 1.3 首版设计原则

1. **单表定价**：所有灵气消耗只维护一张 `QI_ACTION_COSTS` 表，不拆额外权重，避免长期维护复杂度。
2. **优先约束 PvE 成长**：首版只接入副本、造物、闭关，暂不接入天骄榜、赌战、历练收益、天机推演、坊市鉴定等外围玩法。
3. **直接切换**：不上双轨、不做影子账本。旧限制器在同一版本内被灵气替代，避免后期维护两套逻辑。
4. **日志必做**：所有灵气预扣、提交、退款、恢复都必须写入日志，用于审计、客服、补偿和反作弊。
5. **公平边界清晰**：自然上限和自然恢复所有角色一致；月卡只提供每日可领取的恢复符箓，不提高灵气上限，也不提高自然恢复量。

---

## 二、核心资源设计

### 2.1 名称与世界观

资源名称：**天地灵气**，简称 **灵气**。

世界观说明：天地灵气是修士行动与推演的基础。探索秘境、闭关吐纳、炼制丹药、锻造法宝、参悟功法神通，都会消耗修士可调动的天地灵气。灵气每日自然汇聚，也可以通过符箓引动天地气机进行补充。

恢复道具统一定义为**符箓类型**，不使用丹药类型。原因：

- 丹药已经承载 HP/MP、寿元、毒性、修炼加成等身体状态效果，继续塞入行动力恢复会混淆丹药体系。
- 符箓更适合作为一次性功能道具，可解释为引气、聚气、补气，不影响丹药毒性和药性设计。
- 月卡、活动、补偿发放符箓更清晰，便于运营包装。

### 2.2 基础数值

| 属性 | 首版值 | 说明 |
|------|--------|------|
| 资源名称 | 天地灵气（Qi） | 统一行动力资源 |
| 当前值 | `cultivators.qi` | 新增数据库列 |
| 基础上限 | 200 | 所有角色统一 |
| 每日自然恢复 | 恢复至 200 | 每日 0 点后懒刷新，不做全表 cron |
| 道具溢出上限 | 300 | 符箓补充可临时超过 200，最高 300 |
| 刷新时区 | Asia/Shanghai | 与当前日常节奏一致 |

自然恢复规则：

- 当玩家登录、查询灵气、或执行灵气相关操作时触发懒刷新。
- 如果已跨自然日且当前灵气低于 200，则恢复至 200。
- 如果当前灵气高于或等于 200，则自然恢复不增加灵气，只更新刷新时间。
- 不活跃角色不主动刷新，避免无效数据库写入。

### 2.3 公平与付费边界

首版不设计任何永久提高灵气上限或每日自然恢复量的能力。

- 免费玩家：每日自然恢复至 200。
- 月卡玩家：每日可领取恢复灵气的符箓。
- 活动/补偿：发放恢复符箓或直接通过后台补充灵气。
- 竞技玩法：天骄榜不消耗灵气，继续保持每日 10 次挑战限制。

付费只增加 PvE 成长玩法的可参与次数，不直接增加 PvP 排名挑战次数。

---

## 三、首版接入范围与定价

### 3.1 灵气消耗表

| 玩法 | 行为 | Action Key | 灵气消耗 | 首版状态 | 说明 |
|------|------|------------|----------|----------|------|
| 副本探索 | 开始一次副本 | `dungeon_start` | 50 | 接入 | 废弃原每日 2 次限制，满灵气可连续探索 4 次 |
| 闭关修炼 | 每消耗 10 年寿元 | `retreat_10_years` | 5 | 接入 | 原每日 200 年上限废弃，仍消耗角色真实寿元 |
| 突破 | 尝试破境 | `breakthrough_attempt` | 15 | 接入 | 不论成功失败均消耗，技术失败按退款规则处理 |
| 炼丹（自由） | 自由炼丹一次 | `alchemy_improvised` | 15 | 接入 | 玩家输入解析成本较高 |
| 炼丹（丹方） | 按丹方炼丹一次 | `alchemy_formula` | 8 | 接入 | 规则更稳定，消耗低于自由炼丹 |
| 炼器/法宝 | 创建一件法宝 | `creation_artifact` | 8 | 接入 | 走 creation-v2 产品链路 |
| 创造功法 | 创建一部功法 | `creation_gongfa` | 8 | 接入 | 走 creation-v2 产品链路 |
| 创造神通 | 创建一门神通 | `creation_skill` | 8 | 接入 | 走 creation-v2 产品链路 |

闭关消耗按 10 年向上取整：

```text
qiCost = ceil(years / 10) * 5
```

例如闭关 1-10 年消耗 5，11-20 年消耗 10，200 年消耗 100，400 年消耗 200。

### 3.2 首版不接入灵气的行为

| 玩法 | 首版规则 | 原因 |
|------|----------|------|
| 天骄榜挑战 | 保留每日 10 次限制，不消耗灵气 | 保护竞技公平性 |
| 赌战 | 保留现有规则，不消耗灵气 | 经济与 PvP 混合玩法，暂不扩大影响面 |
| 历练收益 | 不消耗灵气 | 避免日常登录领取变成惩罚动作 |
| 天机推演 | 不消耗灵气 | 可后续视 LLM 成本再接入 |
| 幻境之塔 | 不消耗灵气 | 赛季玩法另行评估 |
| 坊市鉴定 | 不消耗灵气 | 市场系统先保持稳定 |
| 丹方解析 | 不消耗灵气，保留冷却 | 先用冷却防刷，避免首版覆盖过宽 |
| 客栈疗养 | 不消耗灵气 | 纯状态恢复 |
| 服用丹药 | 不消耗灵气 | 纯消耗品效果 |
| 拍卖行买卖 | 不消耗灵气 | 玩家间经济 |
| 世界聊天 | 不消耗灵气，保留 60 秒冷却 | 社交行为不纳入行动力 |
| 问法寻卷 | 不消耗灵气 | 已有符箓/抽取资源门槛 |
| 角色创建 | 保留每日 6 次 / 邮箱 / IP 限制 | 防注册滥用，与游戏内行动力无关 |

### 3.3 旧限制器迁移

| 现有限制 | 首版处理 |
|----------|----------|
| `dungeonLimiter` 每日 2 次 | 废弃，由 `dungeon_start` 50 灵气替代 |
| `lifespanLimiter` 每日 200 年 | 废弃，由 `retreat_10_years` 灵气消耗替代 |
| `rankings daily challenges` 每日 10 次 | 保留，不接入灵气 |
| `characterGenerationLimiter` | 保留 |
| `worldChatLimiter` | 保留 |
| 炼丹/丹方短冷却 | 保留 |
| retreat lock、challenge lock 等并发锁 | 保留 |

---

## 四、灵气消耗状态机

### 4.1 为什么必须预扣

副本、造物、炼丹等玩法通常先触发 LLM 或复杂服务，再写入最终结果。如果只在成功后扣灵气，玩家可以通过中断请求、重试、并发等方式免费消耗 LLM。如果一开始直接扣死，服务失败又会造成体验损失。

因此首版采用**预扣 + 提交/退款**模型。

### 4.2 状态定义

灵气日志必须记录每一次资源变动，状态如下：

| 状态 | 含义 | 是否影响灵气余额 |
|------|------|------------------|
| `reserved` | 已预扣，玩法处理中 | 是，先扣除 |
| `committed` | 玩法成功，消耗确认 | 不再二次扣除 |
| `refunded` | 技术失败或业务回滚，灵气已退回 | 是，返还 |
| `restore_committed` | 符箓、补偿、GM 等恢复成功 | 是，增加 |
| `failed_no_refund` | 玩法正常失败，不退款 | 不返还 |

每次预扣都必须带 `actionInstanceId`，用于幂等和故障恢复。重复提交、重复退款必须被服务层拒绝或变成幂等返回。

### 4.3 退款规则

| 场景 | 是否退款 | 说明 |
|------|----------|------|
| 灵气不足，未开始玩法 | 不涉及 | 无日志或记录失败检查均可 |
| LLM 调用超时/异常 | 退款 | 玩家未获得有效结果 |
| 数据库写入失败 | 退款 | 主结果未落库 |
| 服务内部校验失败 | 退款 | 如生成结果未通过 deterministic 校验 |
| 玩家输入非法 | 不扣款 | 参数校验在预扣前完成 |
| 突破正常失败 | 不退款 | 这是玩法结果，不是技术失败 |
| 炼丹产物品质低 | 不退款 | 这是玩法结果 |
| 副本战斗失败/撤退 | 不退款 | 这是玩法结果 |
| 客户端断开但服务端已完成 | 不退款 | 以服务端提交为准 |

### 4.4 接入顺序

每个消耗灵气的接口按同一流程处理：

1. 校验登录、活跃角色、参数和玩法前置条件。
2. 获取并发锁，避免同一角色重复发起同类操作。
3. 调用 `QiService.reserveQi()` 原子刷新并预扣灵气，写入 `reserved` 日志。
4. 执行玩法主逻辑。
5. 成功落库后调用 `QiService.commitReservation()`。
6. 技术失败或业务回滚时调用 `QiService.refundReservation()`。
7. 释放并发锁。

---

## 五、数据库与服务设计

### 5.1 角色表新增字段

```sql
ALTER TABLE wanjiedaoyou_cultivators
  ADD COLUMN qi INTEGER NOT NULL DEFAULT 200,
  ADD COLUMN qi_last_refreshed_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
```

| 字段 | 说明 |
|------|------|
| `qi` | 当前灵气 |
| `qi_last_refreshed_at` | 上次懒刷新时间 |

灵气基础上限不入库，统一使用配置 `QI_MAX = 200`。首版不支持境界、月卡、VIP 改变自然上限，避免数据库保存一份不会被业务修改的冗余字段。

### 5.2 灵气日志表

灵气日志不是可选项，首版必须实现。

```sql
CREATE TABLE wanjiedaoyou_qi_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cultivator_id UUID NOT NULL REFERENCES wanjiedaoyou_cultivators(id),
  action VARCHAR(64) NOT NULL,
  action_instance_id VARCHAR(128) NOT NULL,
  status VARCHAR(32) NOT NULL,
  qi_cost INTEGER NOT NULL DEFAULT 0,
  qi_gain INTEGER NOT NULL DEFAULT 0,
  qi_before INTEGER NOT NULL,
  qi_after INTEGER NOT NULL,
  source VARCHAR(64),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_qi_logs_action_instance
  ON wanjiedaoyou_qi_logs(action_instance_id);

CREATE INDEX idx_qi_logs_cultivator_created_at
  ON wanjiedaoyou_qi_logs(cultivator_id, created_at DESC);

CREATE INDEX idx_qi_logs_status_created_at
  ON wanjiedaoyou_qi_logs(status, created_at DESC);
```

日志用途：

- 查询今日消耗和恢复明细。
- 排查玩家反馈，例如“副本失败但灵气没退”。
- 定位异常账号，例如短时间大量预扣/退款。
- 后续统计各玩法真实灵气消耗分布。

### 5.3 `QiService` 职责

新增 `src/server/lib/services/QiService.ts`。

核心方法：

```typescript
class QiService {
  async getQiState(cultivatorId: string): Promise<QiState>;

  async reserveQi(input: {
    cultivatorId: string;
    action: QiAction;
    actionInstanceId: string;
    cost?: number;
    metadata?: Record<string, unknown>;
  }): Promise<QiReservationResult>;

  async commitReservation(input: {
    actionInstanceId: string;
    metadata?: Record<string, unknown>;
  }): Promise<void>;

  async refundReservation(input: {
    actionInstanceId: string;
    reason: string;
    metadata?: Record<string, unknown>;
  }): Promise<void>;

  async restoreQi(input: {
    cultivatorId: string;
    amount: number;
    source: QiRestoreSource;
    actionInstanceId: string;
    metadata?: Record<string, unknown>;
  }): Promise<QiRestoreResult>;
}
```

服务层要求：

- `reserveQi()` 必须完成懒刷新、余额检查、扣除、写日志的原子操作。
- `commitReservation()` 只更新日志状态，不再改变灵气余额。
- `refundReservation()` 必须原子返还灵气并更新日志状态。
- `restoreQi()` 必须遵守 300 溢出上限和每日符箓使用上限。
- 所有写操作应支持传入 `DbExecutor` / `DbTransaction`，避免玩法事务中打开新的执行器。

### 5.4 懒刷新原子规则

预扣时需要先判断是否跨天：

- 跨天且当前灵气小于 `QI_MAX`：先恢复到 `QI_MAX`，再扣除本次消耗。
- 跨天且当前灵气大于等于 `QI_MAX`：不增加灵气，只更新时间。
- 未跨天：直接按当前值扣除。

跨天判断以 `Asia/Shanghai` 日期为准。

---

## 六、恢复符箓设计

### 6.1 道具类型

恢复灵气的道具统一使用**符箓**类型，不进入丹药体系，不产生丹毒、不走丹药效果执行器。

推荐命名：

| 道具 | 效果 | 获取方式 | 说明 |
|------|------|----------|------|
| 小聚灵符 | 恢复 50 灵气 | 活动、商城、月卡 | 等效 1 次副本 |
| 中聚灵符 | 恢复 100 灵气 | 活动、商城 | 等效半日行动力 |
| 大聚灵符 | 恢复 200 灵气 | 高价值活动、补偿 | 等效一整管基础灵气 |
| 天地引气符 | 恢复至基础上限 | 稀有活动、维护补偿 | 当前低于 200 时最有效 |

### 6.2 使用限制

- 符箓补充可使灵气超过 200，但最高不超过 300。
- 每日最多使用 3 张恢复灵气符箓。
- 当当前灵气已达到 300 时不可使用。
- 使用符箓必须写入 `restore_committed` 日志。

### 6.3 月卡设计边界

月卡不增加灵气上限，不增加自然恢复量。月卡权益建议为：

- 每日可领取 1 张小聚灵符或中聚灵符。
- 领取后进入背包，由玩家自行选择使用时机。
- 月卡符箓仍受每日使用次数和 300 溢出上限约束。

---

## 七、前端体验设计

### 7.1 全局展示

在游戏主界面角色信息区域展示灵气：

```text
天地灵气  144 / 200
```

展示规则：

- 当前值低于消耗门槛时，在相关玩法按钮旁提示“灵气不足”。
- 当前值超过 200 时显示为 `260 / 200`
- 点击灵气区域打开详情面板。

### 7.2 详情面板

面板展示：

- 当前灵气 / 基础上限 / 溢出上限。
- 今日已消耗灵气。
- 今日已通过符箓恢复灵气。
- 今日符箓使用次数。
- 最近灵气流水。
- 下次自然恢复时间：次日 00:00。

### 7.3 消耗预览

消耗灵气前必须给玩家明确预览：

```text
副本探索
消耗灵气：50
当前灵气：144 -> 94
```

闭关需要按输入年限动态展示：

```text
闭关 80 年
消耗灵气：40
消耗寿元：80 年
```

### 7.4 灵气不足

灵气不足时：

- 不允许提交消耗操作。
- 展示当前灵气和所需灵气。
- 提供“使用聚灵符”入口。
- 保留“等待明日恢复”的低干扰提示。

无灵气时仍可参与不消耗灵气的玩法，例如天骄榜挑战、世界聊天、拍卖行、整理装备、服用丹药、查看战报等，避免玩家完全无事可做。

---

## 八、数值影响评估

### 8.1 等效活动量

| 玩法 | 旧限制 | 新限制 | 变化 |
|------|--------|--------|------|
| 副本 | 2 次/天 | 满灵气最多 4 次/天 | 上限翻倍 |
| 闭关 | 每日最多 200 年 | 满灵气最多 400 年 | 上限翻倍 |
| 造物 | 无统一行动力上限 | 满灵气最多 13-25 次 | 从无限制变为有成本 |
| 天骄榜 | 10 次/天 | 仍为 10 次/天 | 不变 |

副本与闭关的上限提升是本方案的主动取舍：玩家可以把当天灵气集中投入单一成长方向，也可以在副本、闭关、造物之间分配。

### 8.2 典型日常分配

| 行为 | 次数 | 灵气消耗 | 小计 |
|------|------|----------|------|
| 副本探索 | 2 次 | 50 | 100 |
| 闭关 100 年 | 1 次 | 50 | 50 |
| 按丹方炼丹 | 2 次 | 8 | 16 |
| 创造神通 | 1 次 | 8 | 8 |
| 预留调整 | - | - | 26 |
| **合计** | | | **174 / 200** |

这个分配让普通玩家每天仍能完成主要成长，同时保留一定余量给临时需求。

### 8.3 经济风险

副本从 2 次提升到最多 4 次，会直接提高材料、灵石、装备产出的潜在上限。首版需要同步检查：

- 副本基础掉落是否按 2 次/天设计。
- 稀有掉落是否需要每日软保底或上限。
- 副本失败、撤退、重试是否会影响实际产出。
- 恢复符箓是否会放大高价值副本刷取收益。

闭关从 200 年提升到最多 400 年，会加快修为成长。需要关注：

- 突破频率是否明显提高。
- 寿元消耗是否仍能形成有效约束。
- 高境界玩家是否因寿元储备更厚而获得过强加速。

造物接入灵气后，反而会降低无限生成的压力。需要确认炼丹、法宝、功法、神通的失败、低品质、材料消耗和灵气消耗之间的体验是否匹配。

---

## 九、配置设计

新增 `src/shared/config/qiSystem.ts`，集中维护首版数值：

```typescript
export const QI_MAX = 200;
export const QI_DAILY_REFRESH = 200;
export const QI_OVERFLOW_MAX = 300;
export const QI_DAILY_RESTORE_ITEM_LIMIT = 3;
export const QI_REFRESH_TIMEZONE = 'Asia/Shanghai';

export const QI_ACTION_COSTS = {
  dungeon_start: 50,
  retreat_10_years: 5,
  breakthrough_attempt: 15,
  alchemy_improvised: 15,
  alchemy_formula: 8,
  creation_artifact: 8,
  creation_gongfa: 8,
  creation_skill: 8,
} as const;
```

配置规则：

- 所有接口只能使用配置里的 action key，不允许在路由里手写消耗数值。
- 闭关这类动态消耗由配置基础值计算，不新增零散常量。
- 不在首版接入的玩法不得预先加入 `QI_ACTION_COSTS`，避免误接入。

---

## 十、API 与 Contract

### 10.1 新增接口

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/cultivator/qi` | 获取当前灵气状态，触发懒刷新 |
| `GET` | `/api/cultivator/qi/logs` | 获取近期灵气流水 |
| `POST` | `/api/cultivator/qi/restore` | 使用恢复符箓补充灵气 |

### 10.2 错误响应

灵气不足返回：

```json
{
  "error": "QI_INSUFFICIENT",
  "message": "天地灵气不足",
  "required": 50,
  "current": 12,
  "action": "dungeon_start"
}
```

推荐 HTTP 状态码使用 `400` 或 `409`，不要使用自定义含义的 `402`。`402 Payment Required` 容易把普通行动力不足误导为支付错误。

### 10.3 Contract 类型

```typescript
export interface QiState {
  current: number;
  max: number;
  overflowMax: number;
  dailyRefresh: number;
  lastRefreshedAt: string;
  todayConsumed: number;
  todayRestored: number;
  todayRestoreItemUses: number;
  dailyRestoreItemLimit: number;
}

export interface QiReservationResult {
  success: boolean;
  action: string;
  actionInstanceId: string;
  qiBefore: number;
  qiAfter: number;
  consumed: number;
}

export interface QiRestoreResult {
  success: boolean;
  qiBefore: number;
  qiAfter: number;
  restored: number;
  overflowMax: number;
}
```

---

## 十一、实施计划

### Phase 0：基础设施

- 新增 `qiSystem.ts` 配置。
- 新增数据库迁移：角色灵气字段 + 灵气日志表。
- 新增 `QiService`，实现懒刷新、预扣、提交、退款、恢复。
- 新增 shared contracts/types。
- 增加服务层单元测试，覆盖并发预扣、跨天刷新、退款幂等、恢复上限。

### Phase 1：副本接入

- 废弃 `dungeonLimiter`。
- 副本开始时预扣 `dungeon_start`。
- 副本生成或落库失败时退款。
- 副本正常失败、撤退、战斗失败不退款。
- 前端副本入口展示 50 灵气消耗。

### Phase 2：闭关接入

- 废弃 `lifespanLimiter` 每日 200 年限制。
- 闭关修炼按 `ceil(years / 10) * 5` 预扣。
- 突破尝试预扣 15。
- 参数校验、寿元不足、大境界任务阻塞必须发生在预扣前。
- 突破正常失败不退款，技术失败退款。

### Phase 3：造物接入

- 炼丹自由接入 15 灵气。
- 丹方炼丹接入 8 灵气。
- 法宝、功法、神通创建接入 8 灵气。
- LLM 生成失败、schema 校验失败、落库失败退款。
- 低品质、失败产物、正常随机结果不退款。

### Phase 4：符箓恢复与前端总览

- 新增恢复符箓道具定义。
- 实现 `/api/cultivator/qi/restore`。
- 游戏主界面展示灵气。
- 详情面板展示消耗、恢复和符箓使用次数。
- 月卡每日发放符箓，不修改灵气上限和自然恢复。

---

## 十二、风险与对策

| 风险 | 影响 | 对策 |
|------|------|------|
| 副本产出翻倍 | 材料、灵石、装备通胀 | 同步检查掉落表，必要时调低单次产出或增加稀有产出上限 |
| 闭关成长加速 | 境界推进变快 | 观察突破频率和寿元消耗，必要时调高闭关灵气成本 |
| 造物消耗过低 | LLM 成本压力仍高 | 通过单消耗表快速调整炼丹/造物成本 |
| 技术失败扣款争议 | 客服压力与玩家不满 | 预扣/退款日志首版必做，并提供后台查询依据 |
| 付费影响竞技公平 | 玩家认为买符箓能买排名 | 天骄榜不接入灵气，保留每日 10 次限制 |
| 直接切换出错 | 影响核心玩法 | 首版范围收窄，只改副本、闭关、造物；上线前用针对性测试覆盖 |

### 12.1 回滚原则

由于采用直接切换，不保留双轨长期运行。但可以保留短期应急开关：

- `QI_SYSTEM_ENABLED=false`：灵气预扣变为 no-op。
- 旧副本/闭关限制器代码在首版上线后短期保留一个版本，不继续维护新需求。
- 回滚只作为事故处理手段，不作为常规并行方案。

---

## 十三、改动文件预估

| 文件 | 操作 | 说明 |
|------|------|------|
| `drizzle/00xx_qi_system.sql` | 新增 | 灵气字段与日志表 |
| `src/server/lib/drizzle/schema.ts` | 修改 | 增加 Drizzle schema |
| `src/shared/config/qiSystem.ts` | 新增 | 灵气数值配置 |
| `src/shared/contracts/qi.ts` | 新增 | API contract |
| `src/shared/types/qi.ts` | 新增 | 服务与日志类型 |
| `src/server/lib/services/QiService.ts` | 新增 | 灵气核心服务 |
| `src/server/routes/api/cultivator.router.ts` | 修改 | 灵气查询、日志、恢复接口；闭关接入 |
| `src/server/lib/dungeon/service_v2.ts` | 修改 | 副本开始接入灵气 |
| `src/server/lib/dungeon/dungeonLimiter.ts` | 废弃 | 首版不再使用 |
| `src/server/lib/redis/lifespanLimiter.ts` | 废弃 | 首版不再使用每日寿元限制 |
| 造物/炼丹相关服务 | 修改 | 接入预扣、提交、退款 |
| `src/react-app` 相关游戏 UI | 修改 | 灵气展示、消耗预览、恢复入口 |

---

## 十四、总结

首版「天地灵气」系统不是一次性重做所有玩法限制，而是把副本、闭关、造物这三类高成长、高成本玩法先统一到一个行动力池中。

对玩家来说，核心变化是从“副本只能 2 次、闭关只能 200 年、造物缺少统一门槛”变成“每天 200 灵气，自行决定投入副本、闭关还是造物”。对系统来说，核心收益是用一张消耗表管理主要成长行为，并通过日志把每次消耗、退款、恢复变成可审计事件。

天骄榜保留每日 10 次，不消耗灵气；月卡只发恢复符箓，不提高灵气上限或自然恢复。这样可以在引入行动力和商业化承接的同时，尽量避免竞技公平性争议。
