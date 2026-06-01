import { MaterialGenerator } from '@shared/engine/material/creation/MaterialGenerator';
import { MARKET_PRESET_POOL } from '@shared/engine/material/creation/marketPresets';
import {
  BASE_PRICES,
  QUALITY_CHANCE_MAP,
  TYPE_CHANCE_MAP,
  TYPE_MULTIPLIERS,
} from '@shared/engine/material/creation/config';
import { getExecutor } from '@server/lib/drizzle/db';
import { cultivators, materials } from '@server/lib/drizzle/schema';
import {
  getCurrentCycle,
  getCycleEndTime,
  getDefaultMarketNodeId,
  getMarketConfigByNodeId,
  getNodeRegionTags,
  getRegionFlavor,
  getRegionProfile,
  getRefreshInterval,
  isMarketNodeEnabled,
  MARKET_STALE_RETRY_MS,
  MYSTERY_MAPPING_TTL_SEC,
  resolveLayerConfig,
  validateLayerAccess,
} from '@shared/lib/game/marketConfig';
import { redis } from '@server/lib/redis';
import { parseRedisJson } from '@server/lib/redis/json';
import { createMessage } from '@server/lib/repositories/worldChatRepository';
import type { MaterialType, Quality, RealmType } from '@shared/types/constants';
import { QUALITY_ORDER } from '@shared/types/constants';
import type {
  MarketAccessState,
  MarketLayer,
  MarketListing,
  MysteryRevealPayload,
  RegionProfile,
  ResolvedLayerConfig,
} from '@shared/types/market';
import { isPresetLayer } from '@shared/types/market';
import { and, eq, sql } from 'drizzle-orm';

// ─── Redis 键前缀 ───

const MARKET_CACHE_NAMESPACE = 'market:v2';
const MARKET_CACHE_PREFIX = `${MARKET_CACHE_NAMESPACE}:listings`;
const MARKET_BOUGHT_PREFIX = `${MARKET_CACHE_NAMESPACE}:bought`;
const MARKET_LOCK_PREFIX = `${MARKET_CACHE_NAMESPACE}:generating`;
const BUY_LOCK_PREFIX = `${MARKET_CACHE_NAMESPACE}:buy:lock`;
const IDENTIFY_LOCK_PREFIX = 'market:identify:lock';
const MYSTERY_PREFIX = 'market:mystery';
const MARKET_CACHE_WAIT_MS = 150;
const MARKET_CACHE_WAIT_RETRIES = 3;

// ─── 类型 ───

type CachedMarketData = {
  listings: InternalMarketListing[];
  generatedAt: number;
};

type InternalMarketListing = MarketListing & {
  mysteryPayload?: MysteryRevealPayload;
};

export type BuyInput = {
  nodeId: string;
  layer: MarketLayer;
  listingId: string;
  quantity: number;
  userId: string;
  cultivatorId: string;
  cultivatorRealm: RealmType;
};

export type BatchBuyInput = {
  nodeId: string;
  layer: MarketLayer;
  items: { listingId: string; quantity: number }[];
  userId: string;
  cultivatorId: string;
  cultivatorRealm: RealmType;
};

type IdentifyInput = {
  materialId: string;
  cultivatorId: string;
};

export class MarketServiceError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// ─── Redis 键工具 ───

function getCacheKey(nodeId: string, layer: MarketLayer, cycle: number) {
  return `${MARKET_CACHE_PREFIX}:${nodeId}:${layer}:${cycle}`;
}

function getBoughtKey(userId: string, nodeId: string, layer: MarketLayer, cycle: number) {
  return `${MARKET_BOUGHT_PREFIX}:${userId}:${nodeId}:${layer}:${cycle}`;
}

function getLockKey(nodeId: string, layer: MarketLayer, cycle: number) {
  return `${MARKET_LOCK_PREFIX}:${nodeId}:${layer}:${cycle}`;
}

function getBuyLockKey(userId: string, nodeId: string, layer: MarketLayer) {
  return `${BUY_LOCK_PREFIX}:${userId}:${nodeId}:${layer}`;
}

function getIdentifyLockKey(materialId: string) {
  return `${IDENTIFY_LOCK_PREFIX}:${materialId}`;
}

function getMysteryKey(cultivatorId: string, mysteryId: string) {
  return `${MYSTERY_PREFIX}:${cultivatorId}:${mysteryId}`;
}

function getBoughtTtlSec(layer: MarketLayer): number {
  return Math.ceil(getRefreshInterval(layer) / 1000) + 3600;
}

// ─── 随机工具 ───

function randomPick<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)];
}

function rollDisguiseRank() {
  return randomPick(['凡品', '灵品', '玄品', '真品', '地品'] as const);
}

function rollIdentifyCost(rank: keyof typeof QUALITY_ORDER): number {
  const table: Record<string, number> = {
    凡品: 20, 灵品: 80, 玄品: 200, 真品: 600,
    地品: 1600, 天品: 4000, 仙品: 12000, 神品: 36000,
  };
  return table[rank] ?? 200;
}

/**
 * 按权重随机选取品质（限定在 rankRange 内）
 */
function rollQualityInRange(rankRange: { min: Quality; max: Quality }): Quality {
  const minOrder = QUALITY_ORDER[rankRange.min];
  const maxOrder = QUALITY_ORDER[rankRange.max];
  const candidates: { quality: Quality; weight: number }[] = [];

  for (const [quality, order] of Object.entries(QUALITY_ORDER) as [Quality, number][]) {
    if (order >= minOrder && order <= maxOrder) {
      candidates.push({ quality, weight: QUALITY_CHANCE_MAP[quality] ?? 0.01 });
    }
  }

  const totalWeight = candidates.reduce((s, c) => s + c.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const c of candidates) {
    roll -= c.weight;
    if (roll <= 0) return c.quality;
  }
  return candidates[candidates.length - 1].quality;
}

/**
 * 按 typeWeights 加权选取材料类型
 */
function weightedPickType(profile: RegionProfile): MaterialType {
  const weights = profile.typeWeights;
  const allTypes: MaterialType[] = ['herb', 'ore', 'monster', 'tcdb', 'aux', 'gongfa_manual', 'skill_manual'];

  const entries = allTypes.map((t) => ({
    type: t,
    weight: weights[t] ?? TYPE_CHANCE_MAP[t] ?? 0.05,
  }));

  const totalWeight = entries.reduce((s, e) => s + e.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const e of entries) {
    roll -= e.weight;
    if (roll <= 0) return e.type;
  }
  return entries[entries.length - 1].type;
}

/**
 * 计算价格：基础价 × 类型倍率 × 地域修正 × 随机波动
 */
function computePrice(
  rank: Quality,
  type: MaterialType,
  priceModifier: { min: number; max: number },
): number {
  const base = BASE_PRICES[rank];
  const typeMultiplier = TYPE_MULTIPLIERS[type] ?? 1.0;
  const regionFactor =
    priceModifier.min + Math.random() * (priceModifier.max - priceModifier.min);
  return Math.max(1, Math.floor(base * typeMultiplier * regionFactor));
}

// ─── 神秘物品伪装 ───

function buildMysteryMask(type: MaterialType) {
  const manualMaskPool = {
    names: ['虫蛀的旧经卷', '残页秘术抄本', '封角破损的典籍'],
    descriptions: [
      '纸页泛黄，字迹断续，偶有完整周天图谱隐于夹层。',
      '抄本笔意凌乱，却夹杂数段精妙法门，真假难辨。',
      '典籍封角残破，翻页时灵识微震，似有被遮掩的真解。',
    ],
  };

  const poolByType: Record<MaterialType, { names: string[]; descriptions: string[] }> = {
    herb: {
      names: ['枯萎的灵草束', '封泥药囊', '残叶草根'],
      descriptions: [
        '药香极淡，叶脉却隐约泛出灵纹，似有年份却难辨真伪。',
        '外层药囊封泥龟裂，灵识探入时有短暂清凉感一闪而逝。',
        '根须干枯近朽，偶尔渗出微弱青光，像被刻意掩饰过。',
      ],
    },
    ore: {
      names: ['沉重的黑色矿石', '裂纹斑驳的矿胚', '裹泥金属块'],
      descriptions: [
        '石皮粗糙黯淡，内里偶有金芒流转，难判是凡矿还是灵矿。',
        '矿胚表面裂隙纵横，触之发凉，隐约有灵压回弹。',
        '外层泥壳厚重，敲击声沉闷，似藏有被封住的金铁精华。',
      ],
    },
    monster: {
      names: ['风干的异兽残骨', '血迹斑驳的鳞片包', '缠布兽爪'],
      descriptions: [
        '骨色灰白近腐，靠近却能感到微弱妖气盘旋不散。',
        '鳞片暗沉失光，边缘却偶有寒芒掠过，真伪难分。',
        '兽爪被旧布层层缠绕，解开时有腥风掠过，气息驳杂。',
      ],
    },
    tcdb: {
      names: ['蒙尘的古盒', '封纹残片', '无名灵物碎块'],
      descriptions: [
        '器表满布岁月痕迹，神识触及时却有一丝古意回鸣。',
        '残片质地难辨，纹路断续，似曾属于某件高阶灵宝。',
        '此物毫不起眼，却在夜间时隐时现微光，来历可疑。',
      ],
    },
    aux: {
      names: ['浑浊灵液瓶', '结块粉末包', '封蜡辅料罐'],
      descriptions: [
        '液体色泽浑浊，摇晃时灵息层层分离，似可用亦似已废。',
        '粉末结块严重，指尖摩挲却有细微灵麻感残留。',
        '封蜡年久开裂，罐内气息忽强忽弱，品质难测。',
      ],
    },
    gongfa_manual: manualMaskPool,
    skill_manual: manualMaskPool,
  };

  const pool = poolByType[type] || poolByType.aux;
  const index = Math.floor(Math.random() * Math.max(1, pool.names.length));
  return {
    disguisedName: pool.names[index] || pool.names[0],
    description: pool.descriptions[index] || pool.descriptions[0],
  };
}

function applyMysteryLayer(
  listings: InternalMarketListing[],
  mysteryChance: number,
): InternalMarketListing[] {
  return listings.map((item) => {
    if (Math.random() > mysteryChance) return item;

    const mask = buildMysteryMask(item.type);
    const disguiseRank = rollDisguiseRank();
    const mysteryPayload: MysteryRevealPayload = {
      material: {
        name: item.name,
        type: item.type,
        rank: item.rank,
        element: item.element,
        description: item.description,
        details: item.details,
        quantity: 1,
      },
      createdAt: Date.now(),
      disguiseTier: disguiseRank,
    };

    const noisyMultiplier = 0.1 + Math.random() * 2.2;
    const disguisedPrice = Math.max(1, Math.floor(item.price * noisyMultiplier));

    return {
      ...item,
      name: mask.disguisedName,
      description: mask.description,
      rank: disguiseRank,
      quantity: 1,
      isMystery: true,
      mysteryMask: { badge: '?', disguisedName: mask.disguisedName },
      price: disguisedPrice,
      mysteryPayload,
    };
  });
}

// ─── 列表清理 ───

function sanitizeListing(listing: InternalMarketListing): MarketListing {
  return {
    id: listing.id,
    nodeId: listing.nodeId,
    layer: listing.layer,
    name: listing.name,
    type: listing.type,
    rank: listing.rank,
    element: listing.element,
    description: listing.description,
    details: listing.details,
    quantity: listing.quantity,
    price: listing.price,
    isMystery: listing.isMystery,
    mysteryMask: listing.mysteryMask,
  };
}

// ─── 生成逻辑 ───

/**
 * 从预设材料池生成商品列表（凡市 / 珍宝阁）
 */
function generateFromPresets(
  nodeId: string,
  layer: 'common' | 'treasure',
  profile: RegionProfile,
  layerConfig: ResolvedLayerConfig,
): InternalMarketListing[] {
  const listings: InternalMarketListing[] = [];

  for (let i = 0; i < layerConfig.count; i++) {
    const type = weightedPickType(profile);
    const rank = rollQualityInRange(layerConfig.rankRange);
    const pool = MARKET_PRESET_POOL[type]?.[rank];

    if (!pool || pool.length === 0) continue;

    const preset = pool[Math.floor(Math.random() * pool.length)];
    const price = computePrice(rank, type, profile.priceModifier);

    listings.push({
      id: crypto.randomUUID(),
      nodeId,
      layer,
      name: preset.name,
      type,
      rank,
      element: preset.element,
      description: preset.description,
      details: {},
      quantity: 1,
      price,
    });
  }

  return listings;
}

/**
 * 通过 LLM 生成商品列表（天宝殿 / 黑市）
 */
async function generateFromLLM(
  nodeId: string,
  layer: 'heaven' | 'black',
  profile: RegionProfile,
  layerConfig: ResolvedLayerConfig,
): Promise<InternalMarketListing[]> {
  const regionTags = getNodeRegionTags(nodeId);
  const items = await MaterialGenerator.generateRandom(layerConfig.count, {
    rankRange: layerConfig.rankRange,
    regionTags,
    allowMystery: false, // 神秘层单独处理
    mysteryChance: 0,
  });

  return items.map((item) => ({
    ...item,
    id: crypto.randomUUID(),
    nodeId,
    layer,
    quantity: 1,
  }));
}

/**
 * 统一生成入口：根据层级选择预设池或 LLM
 */
async function generateListings(
  nodeId: string,
  layer: MarketLayer,
): Promise<InternalMarketListing[]> {
  const profile = getRegionProfile(nodeId);
  const layerConfig = resolveLayerConfig(layer, profile);

  let listings: InternalMarketListing[];

  if (isPresetLayer(layer)) {
    listings = generateFromPresets(nodeId, layer, profile, layerConfig);
  } else {
    listings = await generateFromLLM(nodeId, layer as 'heaven' | 'black', profile, layerConfig);
  }

  // 黑市应用神秘层
  if (layer === 'black') {
    const mysteryChance = layerConfig.mysteryChance ?? 0.7;
    listings = applyMysteryLayer(listings, mysteryChance);
  }

  return listings;
}

/**
 * 生成并写入缓存
 */
async function generateAndCache(
  nodeId: string,
  layer: MarketLayer,
  cycle: number,
): Promise<CachedMarketData | null> {
  const lockKey = getLockKey(nodeId, layer, cycle);
  const lock = await redis.set(lockKey, '1', 'EX', 120, 'NX');

  if (!lock) {
    return null;
  }

  try {
    const listings = await generateListings(nodeId, layer);
    const data: CachedMarketData = { listings, generatedAt: Date.now() };
    const ttlSec = Math.ceil(getRefreshInterval(layer) / 1000) + 3600;
    await redis.set(getCacheKey(nodeId, layer, cycle), JSON.stringify(data), 'EX', ttlSec);
    return data;
  } finally {
    await redis.del(lockKey);
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForCacheData(
  nodeId: string,
  layer: MarketLayer,
  cycle: number,
): Promise<CachedMarketData | null> {
  const cacheKey = getCacheKey(nodeId, layer, cycle);

  for (let attempt = 0; attempt < MARKET_CACHE_WAIT_RETRIES; attempt++) {
    await sleep(MARKET_CACHE_WAIT_MS);
    const cachedData = parseCachedData(await redis.get(cacheKey));
    if (cachedData) {
      return cachedData;
    }
  }

  return null;
}

// ─── 解析输入 ───

function parseLayer(input: string | null | undefined): MarketLayer {
  if (input === 'common' || input === 'treasure' || input === 'heaven' || input === 'black') {
    return input;
  }
  return 'common';
}

function parseCachedData(raw: string | null): CachedMarketData | null {
  const asData = parseRedisJson<CachedMarketData>(raw, 'market cache');
  if (!asData) return null;
  if (!Array.isArray(asData.listings) || typeof asData.generatedAt !== 'number') {
    return null;
  }
  return asData;
}

// ─── 公开 API ───

export function resolveNodeId(nodeId?: string | null) {
  return nodeId || getDefaultMarketNodeId();
}

export function resolveLayer(layer?: string | null) {
  return parseLayer(layer);
}

export function getMarketAccess(
  nodeId: string,
  layer: MarketLayer,
  cultivatorRealm: RealmType,
): MarketAccessState {
  const config = getMarketConfigByNodeId(nodeId);
  return validateLayerAccess(cultivatorRealm, layer, config);
}

export async function getMarketListings(input: {
  nodeId: string;
  layer: MarketLayer;
  userId: string;
  cultivatorRealm: RealmType;
}) {
  const { nodeId, layer, userId, cultivatorRealm } = input;
  if (!isMarketNodeEnabled(nodeId)) {
    throw new MarketServiceError(404, '该地图节点未开放坊市');
  }

  const access = getMarketAccess(nodeId, layer, cultivatorRealm);
  const cycle = getCurrentCycle(layer);
  const cacheKey = getCacheKey(nodeId, layer, cycle);
  let nextRefresh = getCycleEndTime(layer);

  // 1. 读取共享缓存
  let cachedData = parseCachedData(await redis.get(cacheKey));

  // 2. 兜底：缓存未命中则实时生成
  if (!cachedData) {
    cachedData = await generateAndCache(nodeId, layer, cycle);
  }

  // 3. 若其他实例正在生成，则短暂等待缓存落盘，避免返回长时间空货架
  if (!cachedData) {
    cachedData = await waitForCacheData(nodeId, layer, cycle);
  }

  if (!cachedData) {
    cachedData = { listings: [], generatedAt: Date.now() };
    nextRefresh = Date.now() + MARKET_STALE_RETRY_MS;
  }

  // 4. 读取个人购买集合
  const boughtKey = getBoughtKey(userId, nodeId, layer, cycle);
  const boughtIds = new Set(await redis.smembers(boughtKey));

  // 5. 合并视图：已买的标记 quantity = 0
  const listings = cachedData.listings.map((l) => ({
    ...sanitizeListing(l),
    quantity: boughtIds.has(l.id) ? 0 : 1,
  }));

  return {
    nodeId,
    layer,
    listings,
    nextRefresh,
    access,
    marketFlavor: getRegionFlavor(nodeId, layer),
  };
}

export async function buyMarketItem(input: BuyInput) {
  const { nodeId, layer, listingId, quantity, userId, cultivatorId, cultivatorRealm } = input;

  if (quantity < 1) {
    throw new MarketServiceError(400, '购买数量必须大于 0');
  }
  if (quantity !== 1) {
    throw new MarketServiceError(400, '新版坊市每次仅可购入 1 件');
  }

  const access = getMarketAccess(nodeId, layer, cultivatorRealm);
  if (!access.allowed) {
    throw new MarketServiceError(403, access.reason || '当前层不可进入');
  }

  const cycle = getCurrentCycle(layer);

  // 获取防并发锁
  const lockKey = getBuyLockKey(userId, nodeId, layer);
  const gotLock = await redis.set(lockKey, '1', 'EX', 10, 'NX');
  if (!gotLock) {
    throw new MarketServiceError(429, '交易处理中，请稍后再试');
  }

  try {
    // 读取共享缓存
    const cacheKey = getCacheKey(nodeId, layer, cycle);
    const cachedData = parseCachedData(await redis.get(cacheKey));
    if (!cachedData) {
      throw new MarketServiceError(404, '坊市正在进货中，暂未开启');
    }

    const item = cachedData.listings.find((l) => l.id === listingId);
    if (!item) {
      throw new MarketServiceError(404, '此物已不再坊市之中');
    }

    // 检查个人是否已购买
    const boughtKey = getBoughtKey(userId, nodeId, layer, cycle);
    const alreadyBought = await redis.sismember(boughtKey, listingId);
    if (alreadyBought) {
      throw new MarketServiceError(400, '本批此物你已购入，不可重复购买');
    }

    const totalPrice = item.price * quantity;

    // DB 事务：扣灵石 + 发材料
    await getExecutor().transaction(async (tx) => {
      const [updatedCultivator] = await tx
        .update(cultivators)
        .set({ spirit_stones: sql`${cultivators.spirit_stones} - ${totalPrice}` })
        .where(
          sql`${cultivators.id} = ${cultivatorId} AND ${cultivators.spirit_stones} >= ${totalPrice}`,
        )
        .returning({ id: cultivators.id });

      if (!updatedCultivator) {
        throw new MarketServiceError(400, '囊中羞涩，灵石不足');
      }

      if (item.isMystery && item.mysteryPayload) {
        const mysteryId = crypto.randomUUID();
        const mysteryKey = getMysteryKey(cultivatorId, mysteryId);
        await redis.set(mysteryKey, JSON.stringify(item.mysteryPayload), 'EX', MYSTERY_MAPPING_TTL_SEC);

        await tx.insert(materials).values({
          cultivatorId,
          name: item.mysteryMask?.disguisedName || item.name,
          type: item.type,
          rank: item.rank,
          element: item.element,
          description: item.description,
          quantity,
          details: {
            ...(item.details || {}),
            mystery: {
              mysteryId,
              identifyCost: rollIdentifyCost(item.rank),
              disguiseTier: item.rank,
              purchasedAt: Date.now(),
            },
          },
        });
      } else {
        await tx.insert(materials).values({
          cultivatorId,
          name: item.name,
          type: item.type,
          rank: item.rank,
          element: item.element,
          description: item.description,
          quantity,
          details: item.details || {},
        });
      }
    });

    // 记录已购买
    const ttl = getBoughtTtlSec(layer);
    await redis.sadd(boughtKey, listingId);
    await redis.expire(boughtKey, ttl);

    return {
      success: true,
      message: `成功购入 ${item.name} x${quantity}`,
      item: sanitizeListing(item),
    };
  } finally {
    await redis.del(lockKey);
  }
}

export async function batchBuyMarketItems(input: BatchBuyInput) {
  const { nodeId, layer, items, userId, cultivatorId, cultivatorRealm } = input;

  if (items.length === 0) {
    throw new MarketServiceError(400, '购买列表不能为空');
  }

  const listingIds = new Set<string>();
  for (const buyItem of items) {
    if (buyItem.quantity < 1) {
      throw new MarketServiceError(400, '购买数量必须大于 0');
    }
    if (buyItem.quantity !== 1) {
      throw new MarketServiceError(400, '新版坊市每次仅可购入 1 件');
    }
    if (listingIds.has(buyItem.listingId)) {
      throw new MarketServiceError(400, '批量购买中存在重复物品');
    }
    listingIds.add(buyItem.listingId);
  }

  const access = getMarketAccess(nodeId, layer, cultivatorRealm);
  if (!access.allowed) {
    throw new MarketServiceError(403, access.reason || '当前层不可进入');
  }

  const cycle = getCurrentCycle(layer);
  const lockKey = getBuyLockKey(userId, nodeId, layer);
  const gotLock = await redis.set(lockKey, '1', 'EX', 30, 'NX');
  if (!gotLock) {
    throw new MarketServiceError(429, '坊市人声鼎沸，请稍后再往');
  }

  try {
    const cacheKey = getCacheKey(nodeId, layer, cycle);
    const cachedData = parseCachedData(await redis.get(cacheKey));
    if (!cachedData) {
      throw new MarketServiceError(404, '坊市正在进货中，暂未开启');
    }

    const boughtKey = getBoughtKey(userId, nodeId, layer, cycle);
    const boughtIds = new Set(await redis.smembers(boughtKey));

    let totalCost = 0;
    const processItems: { item: InternalMarketListing; quantity: number }[] = [];

    for (const buyReq of items) {
      const item = cachedData.listings.find((l) => l.id === buyReq.listingId);
      if (!item) {
        throw new MarketServiceError(404, `物品已售罄或下架`);
      }
      if (boughtIds.has(item.id)) {
        throw new MarketServiceError(400, `你已购入过 ${item.name}`);
      }
      totalCost += item.price * buyReq.quantity;
      processItems.push({ item, quantity: buyReq.quantity });
    }

    await getExecutor().transaction(async (tx) => {
      const [updatedCultivator] = await tx
        .update(cultivators)
        .set({ spirit_stones: sql`${cultivators.spirit_stones} - ${totalCost}` })
        .where(
          sql`${cultivators.id} = ${cultivatorId} AND ${cultivators.spirit_stones} >= ${totalCost}`,
        )
        .returning({ id: cultivators.id });

      if (!updatedCultivator) {
        throw new MarketServiceError(400, '囊中羞涩，灵石不足');
      }

      for (const { item, quantity } of processItems) {
        if (item.isMystery && item.mysteryPayload) {
          const mysteryId = crypto.randomUUID();
          const mysteryKey = getMysteryKey(cultivatorId, mysteryId);
          await redis.set(mysteryKey, JSON.stringify(item.mysteryPayload), 'EX', MYSTERY_MAPPING_TTL_SEC);

          await tx.insert(materials).values({
            cultivatorId,
            name: item.mysteryMask?.disguisedName || item.name,
            type: item.type,
            rank: item.rank,
            element: item.element,
            description: item.description,
            quantity,
            details: {
              ...(item.details || {}),
              mystery: {
                mysteryId,
                identifyCost: rollIdentifyCost(item.rank),
                disguiseTier: item.rank,
                purchasedAt: Date.now(),
              },
            },
          });
        } else {
          const existing = await tx
            .select()
            .from(materials)
            .where(
              and(
                eq(materials.cultivatorId, cultivatorId),
                eq(materials.name, item.name),
                eq(materials.type, item.type),
                eq(materials.rank, item.rank),
                item.element ? eq(materials.element, item.element) : sql`${materials.element} IS NULL`,
              ),
            )
            .limit(1);

          const target = existing[0];
          const isSameDetails =
            JSON.stringify(target?.details || {}) ===
            JSON.stringify(item.details || {});

          if (target && isSameDetails) {
            await tx
              .update(materials)
              .set({ quantity: sql`${materials.quantity} + ${quantity}` })
              .where(eq(materials.id, target.id));
          } else {
            await tx.insert(materials).values({
              cultivatorId,
              name: item.name,
              type: item.type,
              rank: item.rank,
              element: item.element,
              description: item.description,
              quantity,
              details: item.details || {},
            });
          }
        }
      }
    });

    // 批量记录已购买
    const ttl = getBoughtTtlSec(layer);
    const listingIds = processItems.map(({ item }) => item.id);
    await redis.sadd(boughtKey, ...listingIds);
    await redis.expire(boughtKey, ttl);

    return {
      success: true,
      message: `成功批量购入 ${processItems.length} 种物品`,
      totalCost,
    };
  } finally {
    await redis.del(lockKey);
  }
}

// ─── 鉴定（保持不变）───

export async function identifyMysteryMaterial(input: IdentifyInput) {
  const { materialId, cultivatorId } = input;
  const lockKey = getIdentifyLockKey(materialId);
  const gotLock = await redis.set(lockKey, '1', 'EX', 10, 'NX');
  if (!gotLock) {
    throw new MarketServiceError(429, '鉴定事务处理中，请稍后再试');
  }

  try {
    const current = await getExecutor()
      .select()
      .from(materials)
      .where(and(eq(materials.id, materialId), eq(materials.cultivatorId, cultivatorId)))
      .limit(1);
    const target = current[0];
    if (!target) {
      throw new MarketServiceError(404, '未找到待鉴定物品');
    }

    const details = (target.details || {}) as Record<string, unknown>;
    const mystery = (details.mystery || null) as {
      mysteryId?: string;
      identifyCost?: number;
      disguiseTier?: keyof typeof QUALITY_ORDER;
    } | null;

    if (!mystery?.mysteryId) {
      throw new MarketServiceError(400, '此物并非神秘物品，无需鉴定');
    }

    const mysteryKey = getMysteryKey(cultivatorId, mystery.mysteryId);
    const payload = parseRedisJson<MysteryRevealPayload>(
      await redis.get(mysteryKey),
      mysteryKey,
    );
    if (!payload) {
      throw new MarketServiceError(410, '线索已散，请重新寻宝');
    }

    const cost = Math.max(
      1,
      mystery.identifyCost ?? rollIdentifyCost(target.rank as keyof typeof QUALITY_ORDER),
    );

    let revealedMaterialId = materialId;
    await getExecutor().transaction(async (tx) => {
      const [updatedCultivator] = await tx
        .update(cultivators)
        .set({ spirit_stones: sql`${cultivators.spirit_stones} - ${cost}` })
        .where(
          sql`${cultivators.id} = ${cultivatorId} AND ${cultivators.spirit_stones} >= ${cost}`,
        )
        .returning({ id: cultivators.id });
      if (!updatedCultivator) {
        throw new MarketServiceError(400, '囊中羞涩，灵石不足');
      }

      if (target.quantity > 1) {
        await tx
          .update(materials)
          .set({ quantity: target.quantity - 1 })
          .where(eq(materials.id, materialId));
      } else {
        await tx.delete(materials).where(eq(materials.id, materialId));
      }

      const [insertedMaterial] = await tx
        .insert(materials)
        .values({
          cultivatorId,
          name: payload.material.name,
          type: payload.material.type,
          rank: payload.material.rank,
          element: payload.material.element,
          description: payload.material.description,
          quantity: 1,
          details: payload.material.details || {},
        })
        .returning({ id: materials.id });
      revealedMaterialId = insertedMaterial.id;
    });

    await redis.del(mysteryKey);

    const disguiseOrder =
      QUALITY_ORDER[(mystery.disguiseTier || target.rank) as keyof typeof QUALITY_ORDER];
    const realOrder = QUALITY_ORDER[payload.material.rank];
    const delta = realOrder - disguiseOrder;
    const jackpotLevel =
      delta >= 3 ? 'legendary_win' : delta >= 1 ? 'win' : delta <= -2 ? 'big_loss' : 'normal';
    const isHeavenOrAbove = realOrder >= QUALITY_ORDER['天品'];

    if (isHeavenOrAbove) {
      const [sender] = await getExecutor()
        .select({ userId: cultivators.userId, name: cultivators.name })
        .from(cultivators)
        .where(eq(cultivators.id, cultivatorId))
        .limit(1);
      if (sender) {
        const rumorText = `鉴宝司金光冲霄，${sender.name}鉴出${payload.material.rank}「${payload.material.name}」，天降异象，诸界皆闻。`;
        try {
          await createMessage({
            senderUserId: sender.userId,
            senderCultivatorId: null,
            senderName: '修仙界传闻',
            senderRealm: '炼气',
            senderRealmStage: '系统',
            messageType: 'item_showcase',
            textContent: rumorText,
            payload: {
              itemType: 'material',
              itemId: revealedMaterialId,
              snapshot: {
                id: revealedMaterialId,
                name: payload.material.name,
                type: payload.material.type,
                rank: payload.material.rank,
                element: payload.material.element,
                description: payload.material.description,
                quantity: 1,
              },
              text: rumorText,
            },
          });
        } catch (chatError) {
          console.error('鉴定传闻发送失败:', chatError);
        }
      }
    }

    return {
      success: true,
      revealedItem: { id: revealedMaterialId, ...payload.material, quantity: 1 },
      cost,
      jackpotLevel,
      revealEffect: delta >= 2 ? '金光冲霄' : delta <= -2 ? '灵尘散尽' : '封印破除',
    };
  } finally {
    await redis.del(lockKey);
  }
}

// ─── 定时刷新入口（由 MarketScheduler 调用）───

export async function preGenerateMarket(nodeId: string, layer: MarketLayer) {
  const cycle = getCurrentCycle(layer);
  const cacheKey = getCacheKey(nodeId, layer, cycle);
  const exists = await redis.exists(cacheKey);
  if (exists) return; // 已生成，跳过
  await generateAndCache(nodeId, layer, cycle);
}

/**
 * 供调度器调用：预生成下一周期的缓存
 */
export async function preGenerateNextCycle(nodeId: string, layer: MarketLayer) {
  const intervalMs = getRefreshInterval(layer);
  const nextCycle = Math.floor(Date.now() / intervalMs) + 1;
  const cacheKey = getCacheKey(nodeId, layer, nextCycle);
  const exists = await redis.exists(cacheKey);
  if (exists) return;
  await generateAndCache(nodeId, layer, nextCycle);
}
