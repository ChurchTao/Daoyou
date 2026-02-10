# 拍卖行系统设计文档

**创建时间**: 2026-02-10
**状态**: 设计完成，待实施

## 1. 概述

拍卖行系统允许玩家寄售材料、装备（法宝）、消耗品，采用一口价交易模式。交易成功后，物品和灵石通过游戏内邮件发放。

### 核心规则
- **手续费**: 10%（从卖家收入中扣除）
- **寄售时限**: 48小时
- **寄售限制**: 每玩家最多同时5个进行中的寄售
- **交易模式**: 一口价（不支持议价）
- **过期处理**: 未售出物品通过邮件返还卖家

## 2. 数据库 Schema

### 新增表：`wanjiedaoyou_auction_listings`

```typescript
export const auctionListings = pgTable('wanjiedaoyou_auction_listings', {
  id: uuid('id').primaryKey().defaultRandom(),

  // 卖家信息
  sellerId: uuid('seller_id')
    .references(() => cultivators.id, { onDelete: 'cascade' })
    .notNull(),
  sellerName: varchar('seller_name', { length: 100 }).notNull(),

  // 物品信息
  itemType: varchar('item_type', { length: 20 }).notNull(), // material | artifact | consumable
  itemId: uuid('item_id').notNull(),

  // 物品快照（完整数据）
  itemSnapshot: jsonb('item_snapshot').notNull(),

  // 价格与状态
  price: integer('price').notNull(),
  status: varchar('status', { length: 20 }).notNull().default('active'), // active | sold | expired | cancelled

  // 时间戳
  createdAt: timestamp('created_at').defaultNow().notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  soldAt: timestamp('sold_at'),
});
```

### 索引设计
- `(status, expiresAt)` - Cron 扫描过期物品
- `(sellerId, status)` - 校验寄售位数量

## 3. API 接口

### 3.1 上架物品
**端点**: `POST /api/auction/list`

**请求体**:
```typescript
{
  itemType: 'material' | 'artifact' | 'consumable',
  itemId: string,
  price: number
}
```

**验证规则**:
- 检查物品所有权
- 价格 ≥ 1 灵石
- 该玩家 active 状态寄售 ≤ 5 个

### 3.2 获取拍卖列表
**端点**: `GET /api/auction/listings`

**查询参数**:
- `itemType`: 物品类型筛选
- `minPrice`, `maxPrice`: 价格区间
- `sortBy`: `price_asc` | `price_desc` | `latest`
- `page`, `limit`: 分页（默认 limit=20）

### 3.3 购买物品
**端点**: `POST /api/auction/buy`

**请求体**:
```typescript
{ listingId: string }
```

**事务流程**:
1. Redis 分布式锁
2. 检查 listing 状态和过期时间
3. 扣除买家灵石
4. 计算 10% 手续费
5. 发送邮件（买家得物品，卖家得 90% 灵石）
6. 更新状态为 `sold`

### 3.4 下架物品
**端点**: `DELETE /api/auction/:id`

**规则**: 仅卖家可操作，物品通过邮件返还

### 3.5 过期处理
**端点**: `POST /api/auction/expire`

**触发**: Cron Job，每小时执行

## 4. 状态机

```
     ┌─────────────────┐
     │   (上架成功)     │
     ↓                 │
┌─────────┐  过期   │    active       │  售出   ┌─────────┐
│ expired │ ◄───────┤   (进行中)      ├───────► │  sold   │
└─────────┘         │                 │         └─────────┘
                    └────┬────────────┘
                         │ 手动下架
                         ↓
                    ┌─────────┐
                    │cancelled │
                    └─────────┘
```

**状态说明**:
- `active`: 进行中
- `sold`: 已售出
- `expired`: 过期未售
- `cancelled`: 手动下架

## 5. 物品快照结构

```typescript
interface ItemSnapshot {
  name: string;
  type: 'material' | 'artifact' | 'consumable';
  quality?: string;
  rank?: string;
  element?: string;
  description?: string;
  details?: Record<string, any>;
  score?: number;
  effects?: EffectConfig[];
  quantity?: number;
}
```

## 6. 错误码

```typescript
ERROR_CODES = {
  INSUFFICIENT_FUNDS: '囊中羞涩，灵石不足',
  LISTING_NOT_FOUND: '此物品已下架或售出',
  LISTING_EXPIRED: '此拍卖已过期',
  NOT_OWNER: '无权操作他人的拍卖',
  MAX_LISTINGS: '寄售位已满（最多5个）',
  ITEM_NOT_FOUND: '物品不存在或已消耗',
  CONCURRENT_PURCHASE: '此物正被其他道友争抢，请稍后再试',
}
```

## 7. 缓存策略

- 拍卖列表缓存 5 分钟：`auction:listings:{page}:{filters}`
- 上架/下架操作后清除相关缓存
- 购买操作直接查数据库

## 8. Cron 配置

```typescript
export const config = {
  runtime: 'edge',
  cron: '0 * * * *', // 每小时
}
```

## 9. 邮件模板

### 买家邮件
```
标题: 拍卖行交易成功
内容: 恭喜道友成功购入 [物品名称]，附件为您的战利品。
附件: { type: itemType, data: itemSnapshot }
```

### 卖家邮件（已售）
```
标题: 拍卖行物品售出
内容: 道友寄售的 [物品名称] 已售出，扣除10%手续费后获得 [灵石数] 灵石。
附件: { type: 'spirit_stones', quantity: price * 0.9 }
```

### 卖家邮件（过期/下架）
```
标题: 拍卖行物品返还
内容: 道友寄售的 [物品名称] [已过期|已下架]，附件返还物品。
附件: { type: itemType, data: itemSnapshot }
```
