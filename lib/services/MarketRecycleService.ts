import {
  APPRAISAL_KEYWORD_BONUS_MAX,
  APPRAISAL_KEYWORD_BONUS_MIN,
  APPRAISAL_KEYWORD_WEIGHTS,
  APPRAISAL_RATING_MULTIPLIER,
  APPRAISAL_SESSION_TTL_SEC,
  HIGH_TIER_BASE_FACTOR,
  HIGH_TIER_MIN,
  LOW_TIER_ANCHOR_FACTOR,
  PRODUCE_PRICE_FACTOR_MIN,
  RECYCLE_LOW_TIER_MAX,
  RECYCLE_PRICE_FACTOR_CAP,
} from '@/config/marketConfig';
import {
  getMarketAppraisalPrompt,
  getMarketAppraisalUserPrompt,
} from '@/engine/market/appraisal/prompts';
import { HighTierAppraisalSchema } from '@/engine/market/appraisal/types';
import { BASE_PRICES, TYPE_MULTIPLIERS } from '@/engine/material/creation/config';
import { getExecutor } from '@/lib/drizzle/db';
import { cultivators, materials } from '@/lib/drizzle/schema';
import { redis } from '@/lib/redis';
import {
  QUALITY_ORDER,
  type Quality,
} from '@/types/constants';
import type { Material } from '@/types/cultivator';
import type {
  HighTierAppraisal,
  SellConfirmResponse,
  SellMode,
  SellPreviewItem,
  SellPreviewResponse,
} from '@/types/market';
import { object } from '@/utils/aiClient';
import { and, eq, inArray, sql } from 'drizzle-orm';

const SELL_SESSION_PREFIX = 'market:sell:session:';
const SELL_LOCK_PREFIX = 'market:sell:lock:';

interface RecycleSession {
  cultivatorId: string;
  materialIds: string[];
  mode: SellMode;
  quotedItems: SellPreviewItem[];
  quotedTotal: number;
  appraisal?: HighTierAppraisal;
  createdAt: number;
  expiresAt: number;
}

type SessionStore = Omit<SellPreviewResponse, 'success'> & {
  cultivatorId: string;
  materialIds: string[];
  quotedItems: SellPreviewItem[];
  quotedTotal: number;
  createdAt: number;
};

export class MarketRecycleError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'MarketRecycleError';
  }
}

function isLowTier(rank: Quality): boolean {
  return QUALITY_ORDER[rank] <= QUALITY_ORDER[RECYCLE_LOW_TIER_MAX];
}

function isHighTier(rank: Quality): boolean {
  return QUALITY_ORDER[rank] >= QUALITY_ORDER[HIGH_TIER_MIN];
}

function buildSessionKey(sessionId: string): string {
  return `${SELL_SESSION_PREFIX}${sessionId}`;
}

export function calculateKeywordBonus(keywords: string[]): number {
  let bonus = 0;
  for (const raw of keywords) {
    const keyword = String(raw || '').trim();
    if (!keyword) continue;

    for (const [token, weight] of Object.entries(APPRAISAL_KEYWORD_WEIGHTS)) {
      if (keyword.includes(token)) {
        bonus += weight;
      }
    }
  }
  return Math.min(APPRAISAL_KEYWORD_BONUS_MAX, Math.max(APPRAISAL_KEYWORD_BONUS_MIN, bonus));
}

export function calculateLowTierUnitPrice(
  material: Pick<Material, 'rank' | 'type'>,
): number {
  const basePrice = BASE_PRICES[material.rank];
  const typeMultiplier = TYPE_MULTIPLIERS[material.type] || 1;
  const rankFactor =
    material.rank === '凡品'
      ? LOW_TIER_ANCHOR_FACTOR.凡品
      : material.rank === '灵品'
        ? LOW_TIER_ANCHOR_FACTOR.灵品
        : LOW_TIER_ANCHOR_FACTOR.玄品;
  const recycleFactor = Math.min(
    RECYCLE_PRICE_FACTOR_CAP,
    Math.max(0.22, rankFactor),
  );
  return Math.max(1, Math.floor(basePrice * typeMultiplier * recycleFactor));
}

export function calculateHighTierUnitPrice(
  material: Pick<Material, 'rank' | 'type'>,
  appraisal: HighTierAppraisal,
): number {
  const basePrice = BASE_PRICES[material.rank];
  const typeMultiplier = TYPE_MULTIPLIERS[material.type] || 1;
  const rankFactor =
    material.rank === '真品'
      ? HIGH_TIER_BASE_FACTOR.真品
      : material.rank === '地品'
        ? HIGH_TIER_BASE_FACTOR.地品
      : material.rank === '天品'
          ? HIGH_TIER_BASE_FACTOR.天品
          : material.rank === '仙品'
            ? HIGH_TIER_BASE_FACTOR.仙品
            : HIGH_TIER_BASE_FACTOR.神品;
  const ratingMultiplier = APPRAISAL_RATING_MULTIPLIER[appraisal.rating] || 1;
  const keywordBonus = calculateKeywordBonus(appraisal.keywords || []);
  const rawFactor = rankFactor * ratingMultiplier * (1 + keywordBonus);
  // 保证回收价严格低于生产端最小价格系数（0.8）
  const factor = Math.min(rawFactor, RECYCLE_PRICE_FACTOR_CAP);
  if (factor >= PRODUCE_PRICE_FACTOR_MIN) {
    return Math.max(1, Math.floor(basePrice * typeMultiplier * (PRODUCE_PRICE_FACTOR_MIN - 0.01)));
  }
  return Math.max(
    1,
    Math.floor(basePrice * typeMultiplier * factor),
  );
}

export function buildFallbackAppraisal(material: Material): HighTierAppraisal {
  return {
    rating: 'C',
    comment: `此物虽有灵韵，却难见本源神华。以当前品相观之，尚可作炼材辅佐之用，难称绝珍，回收估值当以稳妥为先。(${material.name})`,
    keywords: ['普通', '稳妥'],
  };
}

async function appraiseHighTierMaterial(material: Material): Promise<HighTierAppraisal> {
  try {
    const result = await object(
      getMarketAppraisalPrompt(),
      getMarketAppraisalUserPrompt(material),
      {
        schema: HighTierAppraisalSchema,
        schemaName: 'HighTierAppraisal',
      },
      true,
      false,
    );
    return result.object;
  } catch (error) {
    console.warn('high-tier material appraisal failed, fallback used:', error);
    return buildFallbackAppraisal(material);
  }
}

function normalizeMaterialIds(materialIds: string[]): string[] {
  const deduped = [...new Set(materialIds.map((id) => id?.trim()).filter(Boolean))];
  if (deduped.length === 0) {
    throw new MarketRecycleError(400, '请至少选择一件材料');
  }
  return deduped;
}

async function loadOwnedMaterials(
  cultivatorId: string,
  materialIds: string[],
): Promise<Material[]> {
  const rows = await getExecutor()
    .select()
    .from(materials)
    .where(and(eq(materials.cultivatorId, cultivatorId), inArray(materials.id, materialIds)));

  if (rows.length !== materialIds.length) {
    throw new MarketRecycleError(400, '部分材料不存在或不属于当前角色');
  }

  const order = new Map(materialIds.map((id, index) => [id, index]));
  rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  return rows as Material[];
}

export async function previewSell(
  cultivator: { id: string },
  materialIds: string[],
): Promise<SellPreviewResponse> {
  const ids = normalizeMaterialIds(materialIds);
  const ownedMaterials = await loadOwnedMaterials(cultivator.id, ids);

  const lowTier = ownedMaterials.filter((item) => isLowTier(item.rank));
  const highTier = ownedMaterials.filter((item) => isHighTier(item.rank));

  if (lowTier.length > 0 && highTier.length > 0) {
    throw new MarketRecycleError(400, '不可混合回收低品与高品材料');
  }
  if (highTier.length > 1) {
    throw new MarketRecycleError(400, '真品及以上材料仅支持单件鉴定回收');
  }

  let mode: SellMode;
  let appraisal: HighTierAppraisal | undefined;
  let items: SellPreviewItem[] = [];

  if (highTier.length === 1) {
    const material = highTier[0];
    mode = 'high_single';
    appraisal = await appraiseHighTierMaterial(material);
    const unitPrice = calculateHighTierUnitPrice(material, appraisal);
    items = [
      {
        id: material.id!,
        name: material.name,
        rank: material.rank,
        quantity: material.quantity,
        unitPrice,
        totalPrice: unitPrice * material.quantity,
      },
    ];
  } else {
    mode = 'low_bulk';
    items = lowTier.map((material) => {
      const unitPrice = calculateLowTierUnitPrice(material);
      return {
        id: material.id!,
        name: material.name,
        rank: material.rank,
        quantity: material.quantity,
        unitPrice,
        totalPrice: unitPrice * material.quantity,
      };
    });
  }

  if (items.length === 0) {
    throw new MarketRecycleError(400, '未找到可回收材料');
  }

  const totalSpiritStones = items.reduce((sum, item) => sum + item.totalPrice, 0);
  const sessionId = crypto.randomUUID();
  const createdAt = Date.now();
  const expiresAt = createdAt + APPRAISAL_SESSION_TTL_SEC * 1000;
  const session: SessionStore = {
    sessionId,
    mode,
    items,
    totalSpiritStones,
    appraisal,
    expiresAt,
    cultivatorId: cultivator.id,
    materialIds: ids,
    quotedItems: items,
    quotedTotal: totalSpiritStones,
    createdAt,
  };

  await redis.set(buildSessionKey(sessionId), session, {
    ex: APPRAISAL_SESSION_TTL_SEC,
  });

  return {
    success: true,
    sessionId,
    mode,
    items,
    totalSpiritStones,
    appraisal,
    expiresAt,
  };
}

async function readSession(sessionId: string): Promise<RecycleSession> {
  const raw = (await redis.get(buildSessionKey(sessionId))) as SessionStore | null;
  if (!raw) {
    throw new MarketRecycleError(410, '回收确认已过期，请重新鉴定');
  }
  return {
    cultivatorId: raw.cultivatorId,
    materialIds: raw.materialIds,
    mode: raw.mode,
    quotedItems: raw.quotedItems,
    quotedTotal: raw.quotedTotal,
    appraisal: raw.appraisal,
    createdAt: raw.createdAt,
    expiresAt: raw.expiresAt,
  };
}

export async function confirmSell(
  cultivatorId: string,
  sessionId: string,
): Promise<SellConfirmResponse> {
  const lockKey = `${SELL_LOCK_PREFIX}${cultivatorId}`;
  const acquiredLock = await redis.set(lockKey, 'locked', { nx: true, ex: 10 });
  if (!acquiredLock) {
    throw new MarketRecycleError(429, '回收交易处理中，请稍后再试');
  }

  try {
    const session = await readSession(sessionId);
    if (session.cultivatorId !== cultivatorId) {
      throw new MarketRecycleError(410, '回收确认已失效');
    }
    if (session.expiresAt < Date.now()) {
      await redis.del(buildSessionKey(sessionId));
      throw new MarketRecycleError(410, '回收确认已过期，请重新鉴定');
    }

    const ownedMaterials = await loadOwnedMaterials(cultivatorId, session.materialIds);
    const snapshot = new Map(ownedMaterials.map((item) => [item.id, item]));
    for (const quoted of session.quotedItems) {
      const current = snapshot.get(quoted.id);
      if (!current) {
        throw new MarketRecycleError(409, '材料已发生变化，请重新预览');
      }
      if (current.quantity !== quoted.quantity || current.rank !== quoted.rank) {
        throw new MarketRecycleError(409, '材料已发生变化，请重新预览');
      }
    }

    const txResult = await getExecutor().transaction(async (tx) => {
      const deleted = await tx
        .delete(materials)
        .where(
          and(eq(materials.cultivatorId, cultivatorId), inArray(materials.id, session.materialIds)),
        )
        .returning({ id: materials.id });

      if (deleted.length !== session.materialIds.length) {
        throw new MarketRecycleError(409, '材料已发生变化，请重新预览');
      }

      const [updated] = await tx
        .update(cultivators)
        .set({
          spirit_stones: sql`${cultivators.spirit_stones} + ${session.quotedTotal}`,
        })
        .where(eq(cultivators.id, cultivatorId))
        .returning({
          spiritStones: cultivators.spirit_stones,
        });

      if (!updated) {
        throw new MarketRecycleError(404, '角色不存在或已失效');
      }
      return updated;
    });

    await redis.del(buildSessionKey(sessionId));

    return {
      success: true,
      gainedSpiritStones: session.quotedTotal,
      soldItems: session.quotedItems.map((item) => ({
        id: item.id,
        name: item.name,
        rank: item.rank,
        quantity: item.quantity,
        price: item.totalPrice,
      })),
      remainingSpiritStones: txResult.spiritStones,
      appraisal: session.appraisal,
    };
  } finally {
    await redis.del(lockKey);
  }
}
