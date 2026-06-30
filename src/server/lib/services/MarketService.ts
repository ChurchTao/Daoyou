import { MARKET_PRESET_POOL } from '@shared/engine/material/creation/marketPresets';
import {
  BASE_PRICES,
  QUALITY_CHANCE_MAP,
  TYPE_CHANCE_MAP,
  TYPE_MULTIPLIERS,
} from '@shared/engine/material/creation/config';
import { getExecutor, type DbTransaction } from '@server/lib/drizzle/db';
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
  resolveLayerConfig,
  validateLayerAccess,
} from '@shared/lib/game/marketConfig';
import { redis } from '@server/lib/redis';
import { parseRedisJson } from '@server/lib/redis/json';
import { createMessage } from '@server/lib/repositories/worldChatRepository';
import { addMaterialStackToInventory } from './materialInventory';
import {
  materialLibraryEntryToMaterial,
  sampleMaterialForRange,
  sampleMaterialLibraryEntries,
  type MaterialLibrarySampleRequest,
} from './MaterialLibraryService';
import {
  getHiddenMysteryReveal,
  sanitizeMaterialDetails,
  type HiddenMysteryReveal,
  withHiddenMysteryReveal,
} from './materialDetailsPrivacy';
import { QiService } from './QiService';
import type { MaterialType, Quality, RealmType } from '@shared/types/constants';
import {
  MATERIAL_TYPE_VALUES,
  QUALITY_ORDER,
  QUALITY_VALUES,
} from '@shared/types/constants';
import type {
  PreHeavenFate,
} from '@shared/types/cultivator';
import type {
  MarketAccessState,
  MarketLayer,
  MarketListing,
  MysteryRevealContext,
  RegionProfile,
  ResolvedLayerConfig,
} from '@shared/types/market';
import { MARKET_PRESET_FALLBACK_LAYERS } from '@shared/types/market';
import { and, eq, sql } from 'drizzle-orm';
import {
  evaluateFateContext,
  getMarketPurchasePriceMultiplier,
  scaleFateAdjustedValue,
} from '@shared/lib/fates';

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
  mysteryContext?: MysteryRevealContext;
  mysteryReveal?: HiddenMysteryReveal;
};

export type BuyInput = {
  nodeId: string;
  layer: MarketLayer;
  listingId: string;
  quantity: number;
  userId: string;
  cultivatorId: string;
  cultivatorRealm: RealmType;
  fates?: PreHeavenFate[];
  tx?: DbTransaction;
  deferSideEffects?: boolean;
};

export type BatchBuyInput = {
  nodeId: string;
  layer: MarketLayer;
  items: { listingId: string; quantity: number }[];
  userId: string;
  cultivatorId: string;
  cultivatorRealm: RealmType;
  fates?: PreHeavenFate[];
  tx?: DbTransaction;
  deferSideEffects?: boolean;
};

type IdentifyInput = {
  materialId: string;
  cultivatorId: string;
  tx?: DbTransaction;
  deferSideEffects?: boolean;
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

function canUsePresetFallback(layer: MarketLayer): boolean {
  return MARKET_PRESET_FALLBACK_LAYERS.includes(layer);
}

// ─── 随机工具 ───

function randomPick<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)];
}

function rollDisguiseRank() {
  return randomPick(['凡品', '灵品', '玄品', '真品', '地品'] as const);
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

function getQualityByOrder(order: number): Quality {
  return (
    QUALITY_VALUES.find((quality) => QUALITY_ORDER[quality] === order) ??
    QUALITY_VALUES[0]
  );
}

function clampQualityOrder(order: number, range: { min: Quality; max: Quality }) {
  return Math.max(
    QUALITY_ORDER[range.min],
    Math.min(QUALITY_ORDER[range.max], order),
  );
}

function estimateQualityFromPrice(price: number, type: MaterialType): Quality {
  const typeMultiplier = TYPE_MULTIPLIERS[type] ?? 1;
  const normalizedPrice = Math.max(1, price / Math.max(0.1, typeMultiplier));

  return QUALITY_VALUES.reduce((best, quality) => {
    const bestDistance = Math.abs(
      Math.log(normalizedPrice) - Math.log(BASE_PRICES[best]),
    );
    const distance = Math.abs(
      Math.log(normalizedPrice) - Math.log(BASE_PRICES[quality]),
    );
    return distance < bestDistance ? quality : best;
  }, QUALITY_VALUES[0]);
}

function buildPriceAnchoredRankRange(
  price: number,
  type: MaterialType,
  layerRange: { min: Quality; max: Quality },
): { min: Quality; max: Quality } {
  const anchorQuality = estimateQualityFromPrice(price, type);
  const anchorOrder = QUALITY_ORDER[anchorQuality];

  return {
    min: getQualityByOrder(clampQualityOrder(anchorOrder - 2, layerRange)),
    max: getQualityByOrder(clampQualityOrder(anchorOrder + 2, layerRange)),
  };
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
  layerConfig: ResolvedLayerConfig,
): InternalMarketListing[] {
  return listings.map((item) => {
    if (Math.random() > mysteryChance) return item;

    const mask = buildMysteryMask(item.type);
    const disguiseRank = rollDisguiseRank();
    const noisyMultiplier = 0.1 + Math.random() * 2.2;
    const disguisedPrice = Math.max(1, Math.floor(item.price * noisyMultiplier));
    const mysteryContext: MysteryRevealContext = {
      type: item.type,
      rankRange: buildPriceAnchoredRankRange(
        disguisedPrice,
        item.type,
        layerConfig.rankRange,
      ),
      anchorPrice: disguisedPrice,
      nodeId: item.nodeId,
      layer: item.layer,
      regionTags: getNodeRegionTags(item.nodeId),
      createdAt: Date.now(),
    };
    const mysteryReveal: HiddenMysteryReveal = {
      name: item.name,
      type: item.type,
      rank: item.rank,
      element: item.element,
      description: item.description,
      details: sanitizeMaterialDetails(item.details) ?? {},
      quantity: 1,
      boundAt: new Date().toISOString(),
    };

    return {
      ...item,
      name: mask.disguisedName,
      description: mask.description,
      rank: disguiseRank,
      element: undefined,
      details: {},
      quantity: 1,
      isMystery: true,
      mysteryMask: { badge: '?', disguisedName: mask.disguisedName },
      price: disguisedPrice,
      mysteryContext,
      mysteryReveal,
    };
  });
}

function isQuality(value: unknown): value is Quality {
  return typeof value === 'string' && value in QUALITY_ORDER;
}

function isMaterialType(value: unknown): value is MaterialType {
  return (
    typeof value === 'string' &&
    (MATERIAL_TYPE_VALUES as readonly string[]).includes(value)
  );
}

function isMarketLayer(value: unknown): value is MarketLayer {
  return (
    value === 'common' ||
    value === 'treasure' ||
    value === 'heaven' ||
    value === 'black'
  );
}

function normalizeRankRange(
  value: unknown,
  fallback: { min: Quality; max: Quality },
): { min: Quality; max: Quality } {
  if (!value || typeof value !== 'object') return fallback;
  const range = value as { min?: unknown; max?: unknown };
  if (!isQuality(range.min) || !isQuality(range.max)) return fallback;
  return { min: range.min, max: range.max };
}

function getMysteryContextForListing(
  item: InternalMarketListing,
): MysteryRevealContext {
  if (item.mysteryContext) {
    return {
      ...item.mysteryContext,
      anchorPrice: item.mysteryContext.anchorPrice ?? item.price,
    };
  }

  const layer = isMarketLayer(item.layer) ? item.layer : 'black';
  const nodeId = item.nodeId || getDefaultMarketNodeId();
  const layerConfig = resolveLayerConfig(layer, getRegionProfile(nodeId));
  return {
    type: isMaterialType(item.type) ? item.type : 'aux',
    rankRange: layerConfig.rankRange,
    anchorPrice: item.price,
    nodeId,
    layer,
    regionTags: getNodeRegionTags(nodeId),
    createdAt: Date.now(),
  };
}

function buildMysteryDetails(
  item: InternalMarketListing,
  mysteryId: string,
) {
  const context = getMysteryContextForListing(item);
  return {
    mysteryId,
    identifyCost: 1,
    disguiseTier: item.rank,
    purchasedAt: Date.now(),
    type: context.type,
    rankRange: context.rankRange,
    anchorPrice: context.anchorPrice,
    nodeId: context.nodeId,
    layer: context.layer,
    regionTags: context.regionTags,
  };
}

function buildHiddenMysteryReveal(item: InternalMarketListing): HiddenMysteryReveal | null {
  if (item.mysteryReveal) {
    return item.mysteryReveal;
  }
  if (!item.isMystery) {
    return null;
  }
  return null;
}

function resolveMysteryRevealContext(
  target: typeof materials.$inferSelect,
  mystery: {
    type?: unknown;
    rankRange?: unknown;
    anchorPrice?: unknown;
    nodeId?: unknown;
    layer?: unknown;
    regionTags?: unknown;
  },
): MysteryRevealContext {
  const nodeId =
    typeof mystery.nodeId === 'string' && mystery.nodeId.length > 0
      ? mystery.nodeId
      : getDefaultMarketNodeId();
  const layer = isMarketLayer(mystery.layer) ? mystery.layer : 'black';
  const fallbackRange = resolveLayerConfig(
    layer,
    getRegionProfile(nodeId),
  ).rankRange;

  return {
    type: isMaterialType(mystery.type)
      ? mystery.type
      : isMaterialType(target.type)
        ? target.type
        : 'aux',
    rankRange: normalizeRankRange(mystery.rankRange, fallbackRange),
    anchorPrice:
      typeof mystery.anchorPrice === 'number' && Number.isFinite(mystery.anchorPrice)
        ? mystery.anchorPrice
        : 0,
    nodeId,
    layer,
    regionTags: Array.isArray(mystery.regionTags)
      ? mystery.regionTags.filter((tag): tag is string => typeof tag === 'string')
      : getNodeRegionTags(nodeId),
    createdAt: Date.now(),
  };
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
    details: sanitizeMaterialDetails(listing.details) ?? {},
    quantity: listing.quantity,
    price: listing.price,
    basePrice: listing.basePrice,
    isMystery: listing.isMystery,
    mysteryMask: listing.mysteryMask,
  };
}

function getMarketPriceMultiplier(fates: PreHeavenFate[] = []): number {
  return getMarketPurchasePriceMultiplier(evaluateFateContext(fates));
}

function getDiscountedMarketPrice(
  basePrice: number,
  fates: PreHeavenFate[] = [],
): number {
  return scaleFateAdjustedValue(basePrice, getMarketPriceMultiplier(fates));
}

function applyMarketPurchaseDiscount(
  listing: MarketListing,
  fates: PreHeavenFate[] = [],
): MarketListing {
  const discountedPrice = getDiscountedMarketPrice(listing.price, fates);
  if (discountedPrice >= listing.price) {
    return {
      ...listing,
      basePrice: undefined,
    };
  }

  return {
    ...listing,
    basePrice: listing.price,
    price: discountedPrice,
  };
}

// ─── 生成逻辑 ───

/**
 * 低层市场的材料库兜底池。仅 common / treasure 可用。
 */
function generateFromPresets(
  nodeId: string,
  layer: MarketLayer,
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

function buildListingFromLibraryMaterial(args: {
  nodeId: string;
  layer: MarketLayer;
  material: ReturnType<typeof materialLibraryEntryToMaterial>;
  priceModifier: RegionProfile['priceModifier'];
}): InternalMarketListing {
  return {
    id: crypto.randomUUID(),
    nodeId: args.nodeId,
    layer: args.layer,
    name: args.material.name,
    type: args.material.type,
    rank: args.material.rank,
    element: args.material.element,
    description: args.material.description,
    details: args.material.details ?? {},
    quantity: 1,
    price: computePrice(args.material.rank, args.material.type, args.priceModifier),
  };
}

async function generateFromMaterialLibrary(
  nodeId: string,
  layer: MarketLayer,
  profile: RegionProfile,
  layerConfig: ResolvedLayerConfig,
  options: { warnShortage: boolean },
): Promise<InternalMarketListing[]> {
  const requests = new Map<string, MaterialLibrarySampleRequest>();
  for (let i = 0; i < layerConfig.count; i++) {
    const materialType = weightedPickType(profile);
    const quality = rollQualityInRange(layerConfig.rankRange);
    const key = `${materialType}:${quality}`;
    const current = requests.get(key);
    requests.set(key, {
      materialType,
      quality,
      count: (current?.count ?? 0) + 1,
    });
  }

  const sampled = await sampleMaterialLibraryEntries(Array.from(requests.values()));
  const listings: InternalMarketListing[] = [];
  for (const [key, request] of requests) {
    const entries = sampled.get(key) ?? [];
    if (options.warnShortage && entries.length < request.count) {
      console.warn(
        `[market] 未配置道具库或材料候选不足 ${nodeId}:${layer}:${key} requested=${request.count} actual=${entries.length}`,
      );
    }
    for (const entry of entries.slice(0, request.count)) {
      listings.push(
        buildListingFromLibraryMaterial({
          nodeId,
          layer,
          material: materialLibraryEntryToMaterial(entry),
          priceModifier: profile.priceModifier,
        }),
      );
    }
  }

  return listings.slice(0, layerConfig.count);
}

/**
 * 统一生成入口：所有市场先走持久材料库；common / treasure 不足时使用预设兜底。
 */
async function generateListings(
  nodeId: string,
  layer: MarketLayer,
): Promise<InternalMarketListing[]> {
  const profile = getRegionProfile(nodeId);
  const layerConfig = resolveLayerConfig(layer, profile);
  const allowPresetFallback = canUsePresetFallback(layer);

  let listings: InternalMarketListing[];

  listings = await generateFromMaterialLibrary(
    nodeId,
    layer,
    profile,
    layerConfig,
    { warnShortage: !allowPresetFallback },
  );

  if (allowPresetFallback && listings.length < layerConfig.count) {
    const fallback = generateFromPresets(nodeId, layer, profile, {
      ...layerConfig,
      count: layerConfig.count - listings.length,
    });
    listings = [...listings, ...fallback];
  }

  if (!allowPresetFallback && listings.length < layerConfig.count) {
    console.warn(
      `[market] 未配置道具库或材料候选不足 ${nodeId}:${layer} requested=${layerConfig.count} actual=${listings.length}，本轮不触发 LLM，返回空缺货架。`,
    );
  }

  // 黑市应用神秘层
  if (layer === 'black') {
    const mysteryChance = layerConfig.mysteryChance ?? 0.7;
    listings = applyMysteryLayer(listings, mysteryChance, layerConfig);
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
  fates?: PreHeavenFate[];
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
    ...applyMarketPurchaseDiscount(sanitizeListing(l), input.fates),
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

    const itemPrice = getDiscountedMarketPrice(item.price, input.fates);
    const totalPrice = itemPrice * quantity;

    const afterCommitJobs: Array<() => Promise<void>> = [];
    const writePurchase = async (tx: DbTransaction) => {
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

      if (item.isMystery) {
        const mysteryId = crypto.randomUUID();
        const hiddenReveal = buildHiddenMysteryReveal(item);
        if (!hiddenReveal) {
          throw new MarketServiceError(503, '黑市鉴宝册缺页，请稍后再试');
        }
        const publicDetails = {
          ...(sanitizeMaterialDetails(item.details) ?? {}),
          mystery: buildMysteryDetails(item, mysteryId),
        };

        await tx.insert(materials).values({
          cultivatorId,
          name: item.mysteryMask?.disguisedName || item.name,
          type: item.type,
          rank: item.rank,
          element: item.element,
          description: item.description,
          quantity,
          details: withHiddenMysteryReveal(publicDetails, hiddenReveal),
        });
      } else {
        await addMaterialStackToInventory(
          cultivatorId,
          {
            name: item.name,
            type: item.type,
            rank: item.rank,
            element: item.element,
            description: item.description,
            quantity,
            details: item.details || {},
          },
          tx,
        );
      }
    };

    if (input.tx) {
      await writePurchase(input.tx);
    } else {
      await getExecutor().transaction(writePurchase);
    }

    // 记录已购买
    const ttl = getBoughtTtlSec(layer);
    afterCommitJobs.push(async () => {
      await redis.sadd(boughtKey, listingId);
      await redis.expire(boughtKey, ttl);
    });
    const afterCommit = async () => {
      for (const job of afterCommitJobs) {
        await job();
      }
    };
    if (!input.deferSideEffects) {
      await afterCommit();
    }

    return {
      success: true,
      message: `成功购入 ${item.name} x${quantity}`,
      item: applyMarketPurchaseDiscount(sanitizeListing(item), input.fates),
      afterCommit: input.deferSideEffects ? afterCommit : undefined,
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
      totalCost += getDiscountedMarketPrice(item.price, input.fates) * buyReq.quantity;
      processItems.push({ item, quantity: buyReq.quantity });
    }

    const afterCommitJobs: Array<() => Promise<void>> = [];
    const writeBatchPurchase = async (tx: DbTransaction) => {
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
        if (item.isMystery) {
          const mysteryId = crypto.randomUUID();
          const hiddenReveal = buildHiddenMysteryReveal(item);
          if (!hiddenReveal) {
            throw new MarketServiceError(503, '黑市鉴宝册缺页，请稍后再试');
          }
          const publicDetails = {
            ...(sanitizeMaterialDetails(item.details) ?? {}),
            mystery: buildMysteryDetails(item, mysteryId),
          };

          await tx.insert(materials).values({
            cultivatorId,
            name: item.mysteryMask?.disguisedName || item.name,
            type: item.type,
            rank: item.rank,
            element: item.element,
            description: item.description,
            quantity,
            details: withHiddenMysteryReveal(publicDetails, hiddenReveal),
          });
        } else {
          await addMaterialStackToInventory(
            cultivatorId,
            {
              name: item.name,
              type: item.type,
              rank: item.rank,
              element: item.element,
              description: item.description,
              quantity,
              details: item.details || {},
            },
            tx,
          );
        }
      }
    };

    if (input.tx) {
      await writeBatchPurchase(input.tx);
    } else {
      await getExecutor().transaction(writeBatchPurchase);
    }

    // 批量记录已购买
    const ttl = getBoughtTtlSec(layer);
    const listingIds = processItems.map(({ item }) => item.id);
    afterCommitJobs.push(async () => {
      await redis.sadd(boughtKey, ...listingIds);
      await redis.expire(boughtKey, ttl);
    });
    const afterCommit = async () => {
      for (const job of afterCommitJobs) {
        await job();
      }
    };
    if (!input.deferSideEffects) {
      await afterCommit();
    }

    return {
      success: true,
      message: `成功批量购入 ${processItems.length} 种物品`,
      totalCost,
      afterCommit: input.deferSideEffects ? afterCommit : undefined,
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
    const q = input.tx ?? getExecutor();
    const current = await q
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
      type?: MaterialType;
      rankRange?: { min: Quality; max: Quality };
      nodeId?: string;
      layer?: MarketLayer;
      regionTags?: string[];
    } | null;

    if (!mystery?.mysteryId) {
      throw new MarketServiceError(400, '此物并非神秘物品，无需鉴定');
    }

    const mysteryKey = getMysteryKey(cultivatorId, mystery.mysteryId);
    const cost = QiService.getCost('market_identify');
    const revealContext = resolveMysteryRevealContext(target, mystery);
    let revealedMaterial = getHiddenMysteryReveal(details);
    if (!revealedMaterial) {
      const sampled = await sampleMaterialForRange({
        materialType: revealContext.type,
        rankRange: revealContext.rankRange,
        count: 1,
      });
      if (!sampled) {
        throw new MarketServiceError(503, '鉴定材料库暂无匹配灵材，请稍后再试');
      }
      const sampledMaterial = materialLibraryEntryToMaterial(sampled);
      revealedMaterial = {
        name: sampledMaterial.name,
        type: sampledMaterial.type,
        rank: sampledMaterial.rank,
        element: sampledMaterial.element,
        description: sampledMaterial.description,
        details: sanitizeMaterialDetails(sampledMaterial.details) ?? {},
        quantity: 1,
        itemLibraryItemId: sampled.itemId,
        boundAt: new Date().toISOString(),
      };
    }

    let revealedMaterialId = materialId;
    let qiAfter: number | undefined;
    const writeReveal = async (tx: DbTransaction) => {
      const qiReservation = await QiService.reserveQi({
        cultivatorId,
        action: 'market_identify',
        actionInstanceId: `market-identify:${mystery.mysteryId}`,
        metadata: {
          materialId,
          mysteryId: mystery.mysteryId,
          revealName: revealedMaterial.name,
        },
        tx,
      });
      qiAfter = qiReservation.qiAfter;

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
          name: revealedMaterial.name,
          type: revealedMaterial.type,
          rank: revealedMaterial.rank,
          element: revealedMaterial.element,
          description: revealedMaterial.description,
          quantity: 1,
          details: sanitizeMaterialDetails(revealedMaterial.details) ?? {},
        })
        .returning({ id: materials.id });
      revealedMaterialId = insertedMaterial.id;

      await QiService.commitReservation({
        actionInstanceId: qiReservation.actionInstanceId,
        metadata: {
          revealedMaterialId,
          committedAt: new Date().toISOString(),
        },
        tx,
      });
    };

    if (input.tx) {
      await writeReveal(input.tx);
    } else {
      await getExecutor().transaction(writeReveal);
    }

    const disguiseOrder =
      QUALITY_ORDER[(mystery.disguiseTier || target.rank) as keyof typeof QUALITY_ORDER];
    const realOrder = QUALITY_ORDER[revealedMaterial.rank];
    const delta = realOrder - disguiseOrder;
    const jackpotLevel =
      delta >= 3 ? 'legendary_win' : delta >= 1 ? 'win' : delta <= -2 ? 'big_loss' : 'normal';
    const isHeavenOrAbove = realOrder >= QUALITY_ORDER['天品'];

    const afterCommit = async () => {
      await redis.del(mysteryKey);
      if (!isHeavenOrAbove) {
        return;
      }
      const [sender] = await getExecutor()
        .select({ userId: cultivators.userId, name: cultivators.name })
        .from(cultivators)
        .where(eq(cultivators.id, cultivatorId))
        .limit(1);
      if (sender) {
        const rumorText = `鉴宝司金光冲霄，${sender.name}鉴出${revealedMaterial.rank}「${revealedMaterial.name}」，天降异象，诸界皆闻。`;
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
                name: revealedMaterial.name,
                type: revealedMaterial.type,
                rank: revealedMaterial.rank,
                element: revealedMaterial.element,
                description: revealedMaterial.description,
                quantity: 1,
              },
              text: rumorText,
            },
          });
        } catch (chatError) {
          console.error('鉴定传闻发送失败:', chatError);
        }
      }
    };

    if (!input.deferSideEffects) {
      await afterCommit();
    }

    return {
      success: true,
      revealedItem: { id: revealedMaterialId, ...revealedMaterial, quantity: 1 },
      cost,
      qiAfter,
      jackpotLevel,
      revealEffect: delta >= 2 ? '金光冲霄' : delta <= -2 ? '灵尘散尽' : '封印破除',
      afterCommit: input.deferSideEffects ? afterCommit : undefined,
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
