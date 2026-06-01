## 坊市系统重设计方案（v3）

### 设计目标

解决两大问题：有钱人扫空货架导致其他人买不到；不同地域坊市没有特色。同时避免 per-user 缓存带来的存储爆炸。

### 核心架构：共享缓存 + 个人购买记录

**共享缓存**（`market:v2:listings:{nodeId}:{layer}:{cycle}`）存储完整的商品列表，所有玩家看到同一批商品。**个人购买集合**（`market:v2:bought:{userId}:{nodeId}:{layer}:{cycle}`）记录玩家已购买的 listing ID。玩家的货架视图 = 共享列表 − 已购集合。

这意味着：商品不限量（或者说"无限库存"），但每个玩家每样最多买一次。有钱人无法垄断，后来者也能买到同样的商品。

#### Redis 键设计

```
# 共享商品缓存（所有玩家共用）
market:v2:listings:{nodeId}:{layer}:{cycle}
  Type: STRING (JSON)
  Value: { listings: MarketListing[], generatedAt: number }
  TTL: 周期时长 + 1小时余量

# 个人购买记录
market:v2:bought:{userId}:{nodeId}:{layer}:{cycle}
  Type: SET
  Value: listingId (string)
  TTL: 周期时长 + 1小时余量

# 购买防并发锁
market:v2:buy:lock:{userId}:{nodeId}:{layer}
  Type: STRING
  TTL: 10秒
```

#### 存储开销

- 共享缓存：5节点 × 4层 = 20 条记录，每条约 3KB → ~60KB
- 购买记录：仅活跃玩家产生，每人每访问过的 node+layer 约 500 字节
- 即使 10 万活跃玩家，总计 < 50MB

---

### 一、分层生成策略

不同层级采用不同的生成方式和刷新节奏：

| 层级 | 生成方式 | 刷新周期 | 商品数量 | 理由 |
|------|---------|---------|---------|------|
| 凡市 (common) | 预设材料池 | 15 分钟 | 10 | 高频低价，预设池足够，快速刷新保持新鲜感 |
| 珍宝阁 (treasure) | 预设材料池 | 15 分钟 | 10 | 同上 |
| 天宝殿 (heaven) | LLM 生成 | 2 小时 | 10 | 高价值商品需要独特名称描述，慢节奏增加稀缺感 |
| 黑市 (black) | LLM 生成 | 2 小时 | 10 | 神秘物品需要 LLM 生成真实属性（mysteryPayload） |

#### 1.1 预设池生成（凡市 / 珍宝阁）

从扩充后的 `MARKET_PRESET_POOL` 中随机抽取，流程：

```typescript
function generateFromPresets(
  layer: 'common' | 'treasure',
  regionProfile: RegionProfile,
  count: number = 10,
): MarketListing[] {
  const rankRange = resolveLayerConfig(layer, regionProfile).rankRange;
  const listings: MarketListing[] = [];

  for (let i = 0; i < count; i++) {
    // 1. 按 typeWeights 加权选取材料类型
    const type = weightedPick(MATERIAL_TYPES, regionProfile.typeWeights);
    // 2. 按 rankRange 加权选取品质
    const rank = rollQuality(rankRange);
    // 3. 从预设池中随机选取一个（池已扩充至 6 个/槽位）
    const pool = MARKET_PRESET_POOL[type][rank];
    const preset = pool[Math.floor(Math.random() * pool.length)];
    // 4. 计算价格（基础价 × 类型倍率 × 地域修正 × 随机波动）
    const price = computePrice(rank, type, regionProfile.priceModifier);
    // 5. 生成 listing
    listings.push({ id: crypto.randomUUID(), name: preset.name, ... });
  }
  return listings;
}
```

#### 1.2 LLM 生成（天宝殿 / 黑市）

沿用现有 `MaterialGenerator.generateRandom`，通过 AI 调用生成独特名称和描述。黑市额外应用 `applyMysteryLayer`。

```typescript
function generateFromLLM(
  layer: 'heaven' | 'black',
  regionProfile: RegionProfile,
  nodeId: string,
  count: number = 10,
): Promise<MarketListing[]> {
  const layerConfig = resolveLayerConfig(layer, regionProfile);
  const regionTags = getNodeRegionTags(nodeId);
  return MaterialGenerator.generateRandom(count, {
    rankRange: layerConfig.rankRange,
    regionTags,
    allowMystery: layer === 'black',
    mysteryChance: layerConfig.mysteryChance,
  });
}
```

---

### 二、定时预生成机制

#### 2.1 问题

当前是"玩家访问时触发生成"，第一个进入的玩家要等待生成完毕才能看到商品，体验很差。

#### 2.2 方案：定时器预生成

使用 server-side 定时器（或 cron job），在刷新周期到来前提前生成下一批商品：

```typescript
// server/lib/services/MarketScheduler.ts

const PRE_GENERATE_BUFFER_MS = 30_000; // 提前 30 秒预生成

function startMarketScheduler() {
  setInterval(async () => {
    const now = Date.now();

    for (const nodeId of getEnabledMarketNodeIds()) {
      for (const layer of MARKET_LAYERS) {
        const intervalMs = getRefreshInterval(layer); // common/treasure: 15min, heaven/black: 2h
        const currentCycle = Math.floor(now / intervalMs);
        const cycleEnd = (currentCycle + 1) * intervalMs;
        const timeUntilEnd = cycleEnd - now;

        // 距刷新不足 30 秒 且 下一周期尚未预生成 → 提前生成
        if (timeUntilEnd <= PRE_GENERATE_BUFFER_MS) {
          const nextCycle = currentCycle + 1;
          const cacheKey = `market:v2:listings:${nodeId}:${layer}:${nextCycle}`;
          const exists = await redis.exists(cacheKey);

          if (!exists) {
            await generateAndCache(nodeId, layer, nextCycle);
          }
        }
      }
    }
  }, 10_000); // 每 10 秒检查一次
}
```

#### 2.3 兜底机制

如果预生成因故失败（服务器重启、网络抖动等），保留当前的"访问时懒生成"作为兜底：

```typescript
async function getMarketListings(input) {
  const cycle = getCurrentCycle(intervalMs);
  const cacheKey = `market:v2:listings:${nodeId}:${layer}:${cycle}`;
  let cached = parseCachedData(await redis.get(cacheKey));

  if (!cached) {
    // 兜底：预生成失败，实时生成
    cached = await generateAndCache(nodeId, layer, cycle);
  }

  const boughtKey = `market:v2:bought:${userId}:${nodeId}:${layer}:${cycle}`;
  const boughtIds = new Set(await redis.smembers(boughtKey));

  const listings = cached.listings.map(l => ({
    ...l,
    quantity: boughtIds.has(l.id) ? 0 : 1,
  }));

  return { listings, nextRefresh: (cycle + 1) * intervalMs, ... };
}
```

---

### 三、购买流程

```typescript
async function buyMarketItem(input: BuyInput) {
  const { nodeId, layer, listingId, userId, cultivatorId } = input;
  const cycle = getCurrentCycle(getRefreshInterval(layer));

  // 1. 读取共享缓存
  const cacheKey = `market:v2:listings:${nodeId}:${layer}:${cycle}`;
  const cached = parseCachedData(await redis.get(cacheKey));
  if (!cached) throw new MarketServiceError(404, '坊市正在进货中');

  const item = cached.listings.find(l => l.id === listingId);
  if (!item) throw new MarketServiceError(404, '此物已下架');

  // 2. 检查个人是否已购买
  const boughtKey = `market:v2:bought:${userId}:${nodeId}:${layer}:${cycle}`;
  const alreadyBought = await redis.sismember(boughtKey, listingId);
  if (alreadyBought) throw new MarketServiceError(400, '本批此物你已购入');

  // 3. 获取防并发锁
  const lockKey = `market:v2:buy:lock:${userId}:${nodeId}:${layer}`;
  const gotLock = await redis.set(lockKey, '1', 'EX', 10, 'NX');
  if (!gotLock) throw new MarketServiceError(429, '交易处理中，请稍后');

  try {
    // 4. DB 事务：扣灵石 + 发材料
    await getExecutor().transaction(async (tx) => {
      const [updated] = await tx.update(cultivators)
        .set({ spirit_stones: sql`${cultivators.spirit_stones} - ${item.price}` })
        .where(sql`${cultivators.id} = ${cultivatorId} AND ${cultivators.spirit_stones} >= ${item.price}`)
        .returning({ id: cultivators.id });
      if (!updated) throw new MarketServiceError(400, '灵石不足');

      // 发放材料（处理 mystery 等逻辑不变）
      await insertMaterial(tx, cultivatorId, item);
    });

    // 5. 记录已购买
    const ttl = getRefreshInterval(layer) / 1000 + 3600;
    await redis.sadd(boughtKey, listingId);
    await redis.expire(boughtKey, ttl);

    return { success: true, message: `成功购入 ${item.name}` };
  } finally {
    await redis.del(lockKey);
  }
}
```

---

### 四、地域深度差异化

#### 4.1 RegionProfile 配置

```typescript
type RegionProfile = {
  typeWeights: Partial<Record<MaterialType, number>>;
  priceModifier: { min: number; max: number };
  layerOverrides: Partial<Record<MarketLayer, {
    count?: number;
    rankRange?: { min: Quality; max: Quality };
    mysteryChance?: number;
  }>>;
  signatureTags: string[];
  signatureRatio: number;
};
```

#### 4.2 各区域配置

**天南 —— 灵草与阵材集散地**

```typescript
tiannan: {
  typeWeights: { herb: 3, aux: 2, ore: 1, monster: 1, tcdb: 0.5, gongfa_manual: 0.5, skill_manual: 0.5 },
  priceModifier: { min: 0.75, max: 1.1 },
  layerOverrides: {
    common: { count: 10 },
    treasure: { count: 10 },
  },
  signatureTags: ['灵草', '阵材', '药王谷', '天南特产'],
  signatureRatio: 0.4,
}
```

**乱星海 —— 深海奇珍与妖兽材料**

```typescript
luanxinghai: {
  typeWeights: { monster: 3, ore: 2, tcdb: 1.5, herb: 0.5, aux: 1, gongfa_manual: 0.3, skill_manual: 0.8 },
  priceModifier: { min: 0.9, max: 1.5 },
  layerOverrides: {
    black: { count: 10, mysteryChance: 0.85 },
  },
  signatureTags: ['深海', '妖兽', '乱星海', '海底矿脉'],
  signatureRatio: 0.45,
}
```

**大晋 —— 皇都精品与珍稀天材**

```typescript
dajin: {
  typeWeights: { ore: 2, tcdb: 3, herb: 1, monster: 1, aux: 1.5, gongfa_manual: 1.2, skill_manual: 1 },
  priceModifier: { min: 1.1, max: 1.6 },
  layerOverrides: {
    heaven: { count: 10, rankRange: { min: '地品', max: '神品' } },
    treasure: { rankRange: { min: '真品', max: '天品' } },
  },
  signatureTags: ['皇都', '贡品', '大晋商会', '上古遗珍'],
  signatureRatio: 0.35,
}
```

**默认 —— 散修集市**

```typescript
default: {
  typeWeights: {},
  priceModifier: { min: 0.85, max: 1.25 },
  layerOverrides: {},
  signatureTags: ['散修', '杂货'],
  signatureRatio: 0.2,
}
```

#### 4.3 层级配置合并

```
MARKET_LAYER_CONFIG[layer]（全局默认）
  ← RegionProfile.layerOverrides[layer]（地域覆盖）
    ← 节点级 market_config.layer_overrides[layer]（节点覆盖）
```

---

### 五、数据流总结

#### 查看坊市

```
玩家请求 GET /api/market/{nodeId}?layer=common
  → 计算当前周期 cycle
  → 读取共享缓存 market:v2:listings:{nodeId}:{layer}:{cycle}
    → 不存在则兜底实时生成
  → 读取个人购买集合 market:v2:bought:{userId}:{nodeId}:{layer}:{cycle}
  → 合并视图：共享列表每个 item 标记 quantity = (已买 ? 0 : 1)
  → 返回 listings + nextRefresh + access + marketFlavor
```

#### 购买商品

```
玩家请求 POST /api/market/{nodeId}/buy { listingId }
  → 验证共享缓存中存在该 listing
  → 验证个人购买集合中不存在（SISMEMBER）
  → 获取防并发锁
  → DB 事务：扣灵石 + 发材料
  → SADD 到个人购买集合
  → 释放锁
```

#### 定时刷新

```
MarketScheduler 每 10 秒检查
  → 遍历所有已启用坊市节点 × 4 层
  → 若距刷新 < 30 秒 且 下周期缓存不存在
    → common/treasure: generateFromPresets()
    → heaven/black: generateFromLLM()
  → 写入 Redis market:v2:listings:{nodeId}:{layer}:{nextCycle}
```

---

### 六、需要改动的文件清单

| 文件 | 改动内容 |
|------|---------|
| `shared/types/market.ts` | 新增 `RegionProfile` 类型 |
| `shared/lib/game/marketConfig.ts` | 新增 `REGION_PROFILES`；新增 `resolveLayerConfig()`；新增 `getRefreshInterval()`；新增 `getEnabledMarketNodeIds()` |
| `shared/engine/material/creation/marketPresets.ts` | **新增**：坊市专用预设材料池（7 类型 × 5 品质 × 6 预设） |
| `server/lib/services/MarketService.ts` | 重写核心：共享缓存 + bought 集合；拆分 `generateFromPresets` 和 `generateFromLLM` |
| `server/lib/services/MarketScheduler.ts` | **新增**：定时预生成调度器 |
| `server/lib/services/MarketRecycleService.ts` | 基本不变 |
| `server/routes/api/market.router.ts` | `getMarketListings` 传入 `userId`；移除 POST 手动刷新接口（改为定时） |
| `server/entry.ts` 或启动文件 | 注册 `startMarketScheduler()` |
| `react-app/routes/game/market/route.tsx` | 移除手动刷新按钮；其余不变（API 返回结构不变） |

---

### 七、注意事项

**无限库存 vs 限量**：本方案采用"无限库存 + 每人限购一次"模式。如果后续希望对某些稀有商品做全服限量（如天宝殿的神品只供应 3 份），可以在 listing 上加 `globalStock` 字段，用 Redis DECR 实现全服库存扣减，与个人购买记录并行。

**预设池扩展性**：当前 6 个预设/槽位，10 个商品的凡市从中抽取，重复率约 30%。后续可按需扩充到 10~15 个/槽位进一步降低重复感。

**LLM 成本控制**：天宝殿和黑市仍使用 LLM 生成，每 2 小时 × 5 节点 × 2 层 = 每小时 5 次 LLM 调用，开销可控。

**拍卖行互补**：坊市定位为"日常采购 + 地域特色探索"，拍卖行承接"玩家间稀缺品流通"。
