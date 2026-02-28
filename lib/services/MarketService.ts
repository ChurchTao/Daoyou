import { MaterialGenerator } from '@/engine/material/creation/MaterialGenerator';
import { getExecutor } from '@/lib/drizzle/db';
import { cultivators, materials } from '@/lib/drizzle/schema';
import {
  getDefaultMarketNodeId,
  getLayerConfig,
  getMarketConfigByNodeId,
  getNodeRegionTags,
  getRegionFlavor,
  isMarketNodeEnabled,
  MARKET_CACHE_TTL_SEC,
  MARKET_STALE_RETRY_MS,
  MYSTERY_MAPPING_TTL_SEC,
  validateLayerAccess,
} from '@/lib/game/marketConfig';
import { redis } from '@/lib/redis';
import { MaterialType, QUALITY_ORDER, RealmType } from '@/types/constants';
import {
  MarketAccessState,
  MarketLayer,
  MarketListing,
  MysteryRevealPayload,
} from '@/types/market';
import { and, eq, sql } from 'drizzle-orm';

const MARKET_CACHE_PREFIX = 'market:listings';
const MARKET_LOCK_PREFIX = 'market:generating';
const BUY_LOCK_PREFIX = 'market:buy:lock';
const IDENTIFY_LOCK_PREFIX = 'market:identify:lock';
const MYSTERY_PREFIX = 'market:mystery';

type CachedMarketData = {
  listings: InternalMarketListing[];
  nextRefresh: number;
};

type InternalMarketListing = MarketListing & {
  mysteryPayload?: MysteryRevealPayload;
};

type BuyInput = {
  nodeId: string;
  layer: MarketLayer;
  listingId: string;
  quantity: number;
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

function getCacheKey(nodeId: string, layer: MarketLayer) {
  return `${MARKET_CACHE_PREFIX}:${nodeId}:${layer}`;
}

function getLockKey(nodeId: string, layer: MarketLayer) {
  return `${MARKET_LOCK_PREFIX}:${nodeId}:${layer}`;
}

function getBuyLockKey(nodeId: string, layer: MarketLayer, listingId: string) {
  return `${BUY_LOCK_PREFIX}:${nodeId}:${layer}:${listingId}`;
}

function getIdentifyLockKey(materialId: string) {
  return `${IDENTIFY_LOCK_PREFIX}:${materialId}`;
}

function getMysteryKey(cultivatorId: string, mysteryId: string) {
  return `${MYSTERY_PREFIX}:${cultivatorId}:${mysteryId}`;
}

function randomPick<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)];
}

function rollDisguiseRank() {
  return randomPick(['凡品', '灵品', '玄品', '真品', '地品'] as const);
}

function rollIdentifyCost(rank: keyof typeof QUALITY_ORDER): number {
  const table: Record<string, number> = {
    凡品: 20,
    灵品: 80,
    玄品: 200,
    真品: 600,
    地品: 1600,
    天品: 4000,
    仙品: 12000,
    神品: 36000,
  };
  return table[rank] ?? 200;
}

function buildMysteryMask(type: MaterialType) {
  const manualMaskPool = {
    names: ['虫蛀的旧经卷', '残页秘术抄本', '封角破损的典籍'],
    descriptions: [
      '纸页泛黄，字迹断续，偶有完整周天图谱隐于夹层。',
      '抄本笔意凌乱，却夹杂数段精妙法门，真假难辨。',
      '典籍封角残破，翻页时灵识微震，似藏有被遮掩的真解。',
    ],
  };

  const poolByType: Record<
    MaterialType,
    {
      names: string[];
      descriptions: string[];
    }
  > = {
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
    manual: manualMaskPool, // deprecated legacy type
  };

  const pool = poolByType[type] || poolByType.aux;
  const pairCount = Math.min(pool.names.length, pool.descriptions.length);
  const index = Math.floor(Math.random() * Math.max(1, pairCount));
  return {
    disguisedName: pool.names[index] || pool.names[0],
    description: pool.descriptions[index] || pool.descriptions[0],
  };
}

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

function parseLayer(input: string | null | undefined): MarketLayer {
  if (
    input === 'common' ||
    input === 'treasure' ||
    input === 'heaven' ||
    input === 'black'
  ) {
    return input;
  }
  return 'common';
}

function parseCachedData(raw: unknown): CachedMarketData | null {
  if (!raw || Array.isArray(raw)) return null;
  const asData = raw as CachedMarketData;
  if (
    !Array.isArray(asData.listings) ||
    typeof asData.nextRefresh !== 'number'
  ) {
    return null;
  }
  return asData;
}

async function generateLayerListings(
  nodeId: string,
  layer: MarketLayer,
): Promise<InternalMarketListing[]> {
  const layerConfig = getLayerConfig(layer);
  const regionTags = getNodeRegionTags(nodeId);
  const items = await MaterialGenerator.generateRandom(layerConfig.count, {
    rankRange: layerConfig.rankRange,
    regionTags,
    allowMystery: layer === 'black',
    mysteryChance: layerConfig.mysteryChance,
  });

  return items.map((item) => ({
    ...item,
    id: crypto.randomUUID(),
    nodeId,
    layer,
  }));
}

function applyMysteryLayer(
  listings: InternalMarketListing[],
): InternalMarketListing[] {
  return listings.map((item) => {
    const mysteryChance = getLayerConfig('black').mysteryChance ?? 0;
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
        quantity: 1,
      },
      createdAt: Date.now(),
      disguiseTier: disguiseRank,
    };

    const noisyMultiplier = 0.1 + Math.random() * 2.2;
    const disguisedPrice = Math.max(
      1,
      Math.floor(item.price * noisyMultiplier),
    );

    return {
      ...item,
      name: mask.disguisedName,
      description: mask.description,
      rank: disguiseRank,
      quantity: 1,
      isMystery: true,
      mysteryMask: {
        badge: '?',
        disguisedName: mask.disguisedName,
      },
      price: disguisedPrice,
      mysteryPayload,
    };
  });
}

async function refreshMarket(nodeId: string, layer: MarketLayer) {
  const rawListings = await generateLayerListings(nodeId, layer);
  const listings =
    layer === 'black' ? applyMysteryLayer(rawListings) : rawListings;
  const nextRefresh = Date.now() + MARKET_CACHE_TTL_SEC * 1000;
  const payload: CachedMarketData = { listings, nextRefresh };
  await redis.set(getCacheKey(nodeId, layer), payload, {
    ex: MARKET_CACHE_TTL_SEC,
  });
  return payload;
}

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
  cultivatorRealm: RealmType;
}) {
  const { nodeId, layer, cultivatorRealm } = input;
  if (!isMarketNodeEnabled(nodeId)) {
    throw new MarketServiceError(404, '该地图节点未开放坊市');
  }

  const access = getMarketAccess(nodeId, layer, cultivatorRealm);
  const cacheKey = getCacheKey(nodeId, layer);
  const lockKey = getLockKey(nodeId, layer);
  const now = Date.now();

  let cachedData = parseCachedData(await redis.get(cacheKey));

  if (!cachedData || cachedData.nextRefresh <= now) {
    const lock = await redis.set(lockKey, '1', { nx: true, ex: 60 });
    if (lock) {
      try {
        cachedData = await refreshMarket(nodeId, layer);
      } finally {
        await redis.del(lockKey);
      }
    } else if (cachedData) {
      cachedData = {
        listings: cachedData.listings,
        nextRefresh: now + MARKET_STALE_RETRY_MS,
      };
    } else {
      cachedData = {
        listings: [],
        nextRefresh: now + MARKET_STALE_RETRY_MS,
      };
    }
  }

  return {
    nodeId,
    layer,
    listings: cachedData.listings.map(sanitizeListing),
    nextRefresh: cachedData.nextRefresh,
    access,
    marketFlavor: getRegionFlavor(nodeId, layer),
  };
}

export async function buyMarketItem(input: BuyInput) {
  const { nodeId, layer, listingId, quantity, cultivatorId, cultivatorRealm } =
    input;
  if (quantity < 1) {
    throw new MarketServiceError(400, '购买数量必须大于 0');
  }

  const access = getMarketAccess(nodeId, layer, cultivatorRealm);
  if (!access.allowed) {
    throw new MarketServiceError(403, access.reason || '当前层不可进入');
  }

  const lockKey = getBuyLockKey(nodeId, layer, listingId);
  const gotLock = await redis.set(lockKey, '1', { nx: true, ex: 10 });
  if (!gotLock) {
    throw new MarketServiceError(429, '此物正被其他道友争夺，请稍后再试');
  }

  try {
    const cacheKey = getCacheKey(nodeId, layer);
    const cachedData = parseCachedData(await redis.get(cacheKey));
    if (!cachedData) {
      throw new MarketServiceError(404, '坊市正在进货中，暂未开启');
    }

    const index = cachedData.listings.findIndex(
      (item) => item.id === listingId,
    );
    if (index < 0) {
      throw new MarketServiceError(404, '此物已不再坊市之中，或许已被他人买走');
    }
    const item = cachedData.listings[index];
    if (item.quantity < quantity) {
      throw new MarketServiceError(400, '坊市库存不足，请减少购买数量');
    }

    const totalPrice = item.price * quantity;

    await getExecutor().transaction(async (tx) => {
      const [updatedCultivator] = await tx
        .update(cultivators)
        .set({
          spirit_stones: sql`${cultivators.spirit_stones} - ${totalPrice}`,
        })
        .where(
          sql`${cultivators.id} = ${cultivatorId} AND ${cultivators.spirit_stones} >= ${totalPrice}`,
        )
        .returning({
          id: cultivators.id,
        });

      if (!updatedCultivator) {
        throw new MarketServiceError(400, '囊中羞涩，灵石不足');
      }

      if (item.isMystery && item.mysteryPayload) {
        const mysteryId = crypto.randomUUID();
        const mysteryKey = getMysteryKey(cultivatorId, mysteryId);
        await redis.set(mysteryKey, item.mysteryPayload, {
          ex: MYSTERY_MAPPING_TTL_SEC,
        });

        await tx.insert(materials).values({
          cultivatorId,
          name: item.mysteryMask?.disguisedName || item.name,
          type: item.type,
          rank: item.rank,
          element: item.element,
          description: item.description,
          quantity,
          details: {
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

    item.quantity -= quantity;
    if (item.quantity <= 0) {
      cachedData.listings.splice(index, 1);
    } else {
      cachedData.listings[index] = item;
    }

    await redis.set(cacheKey, cachedData, { keepTtl: true });
    return {
      success: true,
      message: `成功购入 ${item.name} x${quantity}`,
      item: sanitizeListing(item),
    };
  } finally {
    await redis.del(lockKey);
  }
}

export async function identifyMysteryMaterial(input: IdentifyInput) {
  const { materialId, cultivatorId } = input;
  const lockKey = getIdentifyLockKey(materialId);
  const gotLock = await redis.set(lockKey, '1', { nx: true, ex: 10 });
  if (!gotLock) {
    throw new MarketServiceError(429, '鉴定事务处理中，请稍后再试');
  }

  try {
    const current = await getExecutor()
      .select()
      .from(materials)
      .where(
        and(
          eq(materials.id, materialId),
          eq(materials.cultivatorId, cultivatorId),
        ),
      )
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
    const payload = (await redis.get(
      mysteryKey,
    )) as MysteryRevealPayload | null;
    if (!payload) {
      throw new MarketServiceError(410, '线索已散，请重新寻宝');
    }

    const cost = Math.max(
      1,
      mystery.identifyCost ??
        rollIdentifyCost(target.rank as keyof typeof QUALITY_ORDER),
    );

    await getExecutor().transaction(async (tx) => {
      const [updatedCultivator] = await tx
        .update(cultivators)
        .set({
          spirit_stones: sql`${cultivators.spirit_stones} - ${cost}`,
        })
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

      await tx.insert(materials).values({
        cultivatorId,
        name: payload.material.name,
        type: payload.material.type,
        rank: payload.material.rank,
        element: payload.material.element,
        description: payload.material.description,
        quantity: 1,
        details: payload.material.details || {},
      });
    });

    await redis.del(mysteryKey);

    const disguiseOrder =
      QUALITY_ORDER[
        (mystery.disguiseTier || target.rank) as keyof typeof QUALITY_ORDER
      ];
    const realOrder = QUALITY_ORDER[payload.material.rank];
    const delta = realOrder - disguiseOrder;
    const jackpotLevel =
      delta >= 3
        ? 'legendary_win'
        : delta >= 1
          ? 'win'
          : delta <= -2
            ? 'big_loss'
            : 'normal';

    return {
      success: true,
      revealedItem: payload.material,
      cost,
      jackpotLevel,
      revealEffect:
        delta >= 2 ? '金光冲霄' : delta <= -2 ? '灵尘散尽' : '封印破除',
    };
  } finally {
    await redis.del(lockKey);
  }
}

export async function clearMarketCache(nodeId?: string, layer?: MarketLayer) {
  const targetNodeId = resolveNodeId(nodeId);
  const targetLayer = layer || 'common';
  await redis.del(getCacheKey(targetNodeId, targetLayer));
}

export function getCompatibilityDefaults() {
  return {
    nodeId: getDefaultMarketNodeId(),
    layer: 'common' as MarketLayer,
  };
}
