import {
  APPRAISAL_KEYWORD_BONUS_MAX,
  APPRAISAL_KEYWORD_BONUS_MIN,
  APPRAISAL_KEYWORD_WEIGHTS,
  APPRAISAL_RATING_MULTIPLIER,
  APPRAISAL_SESSION_TTL_SEC,
  ARTIFACT_MATERIAL_ANCHOR_FACTOR,
  ARTIFACT_SLOT_FACTOR,
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
import {
  BASE_PRICES,
  TYPE_MULTIPLIERS,
} from '@/engine/material/creation/config';
import { getExecutor } from '@/lib/drizzle/db';
import {
  artifacts,
  cultivators,
  equippedItems,
  materials,
} from '@/lib/drizzle/schema';
import { redis } from '@/lib/redis';
import { QUALITY_ORDER, type Quality } from '@/types/constants';
import type { Artifact, Material } from '@/types/cultivator';
import type {
  HighTierAppraisal,
  SellConfirmResponse,
  SellItemType,
  SellMode,
  SellPreviewItem,
  SellPreviewResponse,
} from '@/types/market';
import { text } from '@/utils/aiClient';
import { and, eq, inArray, sql } from 'drizzle-orm';

const SELL_SESSION_PREFIX = 'market:sell:session:';
const SELL_LOCK_PREFIX = 'market:sell:lock:';

interface ArtifactSnapshot {
  id: string;
  quality: Quality;
  score: number;
  slot: Artifact['slot'];
  effectsHash: string;
}

interface MaterialSnapshot {
  id: string;
  rank: Quality;
  quantity: number;
}

interface RecycleSession {
  sessionId: string;
  cultivatorId: string;
  itemType: SellItemType;
  itemIds: string[];
  mode: SellMode;
  quotedItems: SellPreviewItem[];
  quotedTotal: number;
  appraisal?: HighTierAppraisal;
  snapshot: Record<string, ArtifactSnapshot | MaterialSnapshot>;
  equippedCheckAtPreview: string[];
  createdAt: number;
  expiresAt: number;
}

type SessionStore = Omit<SellPreviewResponse, 'success'> & {
  cultivatorId: string;
  itemIds: string[];
  quotedItems: SellPreviewItem[];
  quotedTotal: number;
  snapshot: Record<string, ArtifactSnapshot | MaterialSnapshot>;
  equippedCheckAtPreview: string[];
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

function isLowTier(quality: Quality): boolean {
  return QUALITY_ORDER[quality] <= QUALITY_ORDER[RECYCLE_LOW_TIER_MAX];
}

function isHighTier(quality: Quality): boolean {
  return QUALITY_ORDER[quality] >= QUALITY_ORDER[HIGH_TIER_MIN];
}

function buildSessionKey(sessionId: string): string {
  return `${SELL_SESSION_PREFIX}${sessionId}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
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
  return Math.min(
    APPRAISAL_KEYWORD_BONUS_MAX,
    Math.max(APPRAISAL_KEYWORD_BONUS_MIN, bonus),
  );
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
  const factor = Math.min(rawFactor, RECYCLE_PRICE_FACTOR_CAP);
  if (factor >= PRODUCE_PRICE_FACTOR_MIN) {
    return Math.max(
      1,
      Math.floor(
        basePrice * typeMultiplier * (PRODUCE_PRICE_FACTOR_MIN - 0.01),
      ),
    );
  }
  return Math.max(1, Math.floor(basePrice * typeMultiplier * factor));
}

function getArtifactQuality(artifact: Pick<Artifact, 'quality'>): Quality {
  const value = artifact.quality || '凡品';
  return value in QUALITY_ORDER ? value : '凡品';
}

export function calculateArtifactUnitPrice(
  artifact: Pick<Artifact, 'quality' | 'score' | 'slot' | 'effects'>,
): number {
  const quality = getArtifactQuality(artifact);
  const materialAnchorPrice = BASE_PRICES[quality];
  const qualityFactor = ARTIFACT_MATERIAL_ANCHOR_FACTOR[quality];

  const score = Math.max(0, artifact.score || 0);
  const scoreMultiplier = clamp(0.92 + score / 3000, 0.92, 1.5);
  const effectCount = Array.isArray(artifact.effects)
    ? artifact.effects.length
    : 0;
  const effectMultiplier = 1 + Math.min(0.22, effectCount * 0.05);
  const slotMultiplier = ARTIFACT_SLOT_FACTOR[artifact.slot] ?? 1;

  const raw = Math.floor(
    materialAnchorPrice *
      qualityFactor *
      scoreMultiplier *
      effectMultiplier *
      slotMultiplier,
  );
  const cap = Math.floor(materialAnchorPrice * RECYCLE_PRICE_FACTOR_CAP);

  return Math.max(1, Math.min(raw, cap));
}

function getArtifactAppraisalRating(
  artifact: Pick<Artifact, 'quality' | 'score' | 'effects'>,
): HighTierAppraisal['rating'] {
  const quality = getArtifactQuality(artifact);
  const qualityScore = QUALITY_ORDER[quality] ?? 0;
  const score = Math.max(0, artifact.score || 0);
  const effectCount = Array.isArray(artifact.effects)
    ? artifact.effects.length
    : 0;

  const total =
    qualityScore * 12 + Math.min(18, Math.floor(score / 220)) + effectCount * 3;
  if (total >= 88) return 'S';
  if (total >= 70) return 'A';
  if (total >= 54) return 'B';
  return 'C';
}

export function buildArtifactHighTierAppraisal(
  artifact: Pick<Artifact, 'name' | 'quality' | 'score' | 'slot' | 'effects'>,
): HighTierAppraisal {
  const quality = getArtifactQuality(artifact);
  const score = Math.max(0, artifact.score || 0);
  const effectCount = Array.isArray(artifact.effects)
    ? artifact.effects.length
    : 0;

  const rating = getArtifactAppraisalRating(artifact);
  const slotText =
    artifact.slot === 'weapon'
      ? '攻伐之器'
      : artifact.slot === 'armor'
        ? '护体之器'
        : '辅修之器';
  const scoreText =
    score >= 2200
      ? '灵纹浑成'
      : score >= 1400
        ? '气机稳固'
        : score >= 800
          ? '灵性尚可'
          : '器韵平平';
  const effectText =
    effectCount >= 4
      ? '器内道痕层叠，可承重祭'
      : effectCount >= 2
        ? '内蕴数重法效，可堪实战'
        : '法效单薄，更宜折价流转';

  const comment = `此${quality}${slotText}「${artifact.name}」${scoreText}，${effectText}。按坊市旧例估衡，今可定为${rating}级回收。`;

  const keywords = [quality, slotText, scoreText, effectText.split('，')[0]]
    .map((item) => item.replace(/[「」]/g, ''))
    .slice(0, 4);

  return {
    rating,
    comment,
    keywords,
  };
}

export function buildFallbackAppraisal(material: Material): HighTierAppraisal {
  return {
    rating: 'C',
    comment: `此物虽有灵韵，却难见本源神华。以当前品相观之，尚可作炼材辅佐之用，难称绝珍，回收估值当以稳妥为先。(${material.name})`,
    keywords: ['普通', '稳妥'],
  };
}

async function appraiseHighTierMaterial(
  material: Material,
): Promise<HighTierAppraisal> {
  try {
    const result = await text(
      getMarketAppraisalPrompt(),
      getMarketAppraisalUserPrompt(material),
      true,
    );
    return JSON.parse(result.text) as HighTierAppraisal;
  } catch (error) {
    console.warn('high-tier material appraisal failed, fallback used:', error);
    return buildFallbackAppraisal(material);
  }
}

function normalizeItemIds(itemIds: string[]): string[] {
  const deduped = [...new Set(itemIds.map((id) => id?.trim()).filter(Boolean))];
  if (deduped.length === 0) {
    throw new MarketRecycleError(400, '请至少选择一件物品');
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
    .where(
      and(
        eq(materials.cultivatorId, cultivatorId),
        inArray(materials.id, materialIds),
      ),
    );

  if (rows.length !== materialIds.length) {
    throw new MarketRecycleError(400, '部分材料不存在或不属于当前角色');
  }

  const order = new Map(materialIds.map((id, index) => [id, index]));
  rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  return rows as Material[];
}

async function loadOwnedArtifacts(
  cultivatorId: string,
  artifactIds: string[],
): Promise<Artifact[]> {
  const rows = await getExecutor()
    .select()
    .from(artifacts)
    .where(
      and(
        eq(artifacts.cultivatorId, cultivatorId),
        inArray(artifacts.id, artifactIds),
      ),
    );

  if (rows.length !== artifactIds.length) {
    throw new MarketRecycleError(400, '部分法宝不存在或不属于当前角色');
  }

  const order = new Map(artifactIds.map((id, index) => [id, index]));
  rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  return rows as Artifact[];
}

function getEffectsHash(value: unknown): string {
  try {
    return JSON.stringify(value ?? []);
  } catch {
    return '[]';
  }
}

async function getEquippedArtifactIds(cultivatorId: string): Promise<string[]> {
  const [row] = await getExecutor()
    .select({
      weapon: equippedItems.weapon_id,
      armor: equippedItems.armor_id,
      accessory: equippedItems.accessory_id,
    })
    .from(equippedItems)
    .where(eq(equippedItems.cultivatorId, cultivatorId))
    .limit(1);

  if (!row) return [];
  return [row.weapon, row.armor, row.accessory].filter(Boolean) as string[];
}

function ensureArtifactsNotEquipped(
  artifactIds: string[],
  equippedIds: string[],
  message: string,
): void {
  const equippedSet = new Set(equippedIds);
  if (artifactIds.some((id) => equippedSet.has(id))) {
    throw new MarketRecycleError(400, message);
  }
}

function buildMaterialSessionSnapshot(
  items: SellPreviewItem[],
): Record<string, MaterialSnapshot> {
  const snapshot: Record<string, MaterialSnapshot> = {};
  for (const item of items) {
    snapshot[item.id] = {
      id: item.id,
      rank: item.rank || '凡品',
      quantity: item.quantity,
    };
  }
  return snapshot;
}

function buildArtifactSessionSnapshot(
  items: Artifact[],
): Record<string, ArtifactSnapshot> {
  const snapshot: Record<string, ArtifactSnapshot> = {};
  for (const item of items) {
    if (!item.id) continue;
    snapshot[item.id] = {
      id: item.id,
      quality: getArtifactQuality(item),
      score: item.score || 0,
      slot: item.slot,
      effectsHash: getEffectsHash(item.effects),
    };
  }
  return snapshot;
}

async function previewMaterialSell(
  cultivator: { id: string },
  materialIds: string[],
): Promise<SellPreviewResponse> {
  const ids = normalizeItemIds(materialIds);
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

  const totalSpiritStones = items.reduce(
    (sum, item) => sum + item.totalPrice,
    0,
  );
  const sessionId = crypto.randomUUID();
  const createdAt = Date.now();
  const expiresAt = createdAt + APPRAISAL_SESSION_TTL_SEC * 1000;
  const session: SessionStore = {
    itemType: 'material',
    sessionId,
    mode,
    items,
    totalSpiritStones,
    appraisal,
    expiresAt,
    cultivatorId: cultivator.id,
    itemIds: ids,
    quotedItems: items,
    quotedTotal: totalSpiritStones,
    snapshot: buildMaterialSessionSnapshot(items),
    equippedCheckAtPreview: [],
    createdAt,
  };

  await redis.set(buildSessionKey(sessionId), session, {
    ex: APPRAISAL_SESSION_TTL_SEC,
  });

  return {
    success: true,
    itemType: 'material',
    sessionId,
    mode,
    items,
    totalSpiritStones,
    appraisal,
    expiresAt,
  };
}

async function previewArtifactSell(
  cultivator: { id: string },
  artifactIds: string[],
): Promise<SellPreviewResponse> {
  const ids = normalizeItemIds(artifactIds);
  const ownedArtifacts = await loadOwnedArtifacts(cultivator.id, ids);
  const equippedIds = await getEquippedArtifactIds(cultivator.id);
  ensureArtifactsNotEquipped(ids, equippedIds, '已装备法宝不可回收，请先卸下');

  const lowTier = ownedArtifacts.filter((item) =>
    isLowTier(getArtifactQuality(item)),
  );
  const highTier = ownedArtifacts.filter((item) =>
    isHighTier(getArtifactQuality(item)),
  );

  if (lowTier.length > 0 && highTier.length > 0) {
    throw new MarketRecycleError(400, '不可混合回收低品与高品法宝');
  }
  if (highTier.length > 1) {
    throw new MarketRecycleError(400, '真品及以上法宝仅支持单件鉴定回收');
  }

  let mode: SellMode;
  let appraisal: HighTierAppraisal | undefined;
  let targetArtifacts: Artifact[] = [];

  if (highTier.length === 1) {
    mode = 'high_single';
    targetArtifacts = highTier;
    appraisal = buildArtifactHighTierAppraisal(highTier[0]);
  } else {
    mode = 'low_bulk';
    targetArtifacts = lowTier;
  }

  if (targetArtifacts.length === 0) {
    throw new MarketRecycleError(400, '未找到可回收法宝');
  }

  const items: SellPreviewItem[] = targetArtifacts.map((item) => {
    const unitPrice = calculateArtifactUnitPrice(item);
    return {
      id: item.id!,
      name: item.name,
      quality: getArtifactQuality(item),
      quantity: 1,
      unitPrice,
      totalPrice: unitPrice,
      slot: item.slot,
      score: item.score || 0,
      element: item.element,
    };
  });

  const totalSpiritStones = items.reduce(
    (sum, item) => sum + item.totalPrice,
    0,
  );
  const sessionId = crypto.randomUUID();
  const createdAt = Date.now();
  const expiresAt = createdAt + APPRAISAL_SESSION_TTL_SEC * 1000;
  const session: SessionStore = {
    itemType: 'artifact',
    sessionId,
    mode,
    items,
    totalSpiritStones,
    appraisal,
    expiresAt,
    cultivatorId: cultivator.id,
    itemIds: ids,
    quotedItems: items,
    quotedTotal: totalSpiritStones,
    snapshot: buildArtifactSessionSnapshot(targetArtifacts),
    equippedCheckAtPreview: equippedIds,
    createdAt,
  };

  await redis.set(buildSessionKey(sessionId), session, {
    ex: APPRAISAL_SESSION_TTL_SEC,
  });

  return {
    success: true,
    itemType: 'artifact',
    sessionId,
    mode,
    items,
    totalSpiritStones,
    appraisal,
    expiresAt,
  };
}

export async function previewSell(
  cultivator: { id: string },
  itemIds: string[],
  itemType: SellItemType = 'material',
): Promise<SellPreviewResponse> {
  if (itemType === 'artifact') {
    return previewArtifactSell(cultivator, itemIds);
  }
  return previewMaterialSell(cultivator, itemIds);
}

async function readSession(sessionId: string): Promise<RecycleSession> {
  const raw = (await redis.get(
    buildSessionKey(sessionId),
  )) as SessionStore | null;
  if (!raw) {
    throw new MarketRecycleError(410, '回收确认已过期，请重新鉴定');
  }
  return {
    sessionId,
    cultivatorId: raw.cultivatorId,
    itemType: raw.itemType || 'material',
    itemIds: raw.itemIds,
    mode: raw.mode,
    quotedItems: raw.quotedItems,
    quotedTotal: raw.quotedTotal,
    appraisal: raw.appraisal,
    snapshot: raw.snapshot || {},
    equippedCheckAtPreview: raw.equippedCheckAtPreview || [],
    createdAt: raw.createdAt,
    expiresAt: raw.expiresAt,
  };
}

async function confirmMaterialSell(
  cultivatorId: string,
  session: RecycleSession,
): Promise<SellConfirmResponse> {
  const ownedMaterials = await loadOwnedMaterials(
    cultivatorId,
    session.itemIds,
  );
  const snapshot = new Map(ownedMaterials.map((item) => [item.id, item]));

  for (const quoted of session.quotedItems) {
    const current = snapshot.get(quoted.id);
    const expected = session.snapshot[quoted.id] as
      | MaterialSnapshot
      | undefined;
    if (!current || !expected) {
      throw new MarketRecycleError(409, '材料已发生变化，请重新预览');
    }
    if (
      current.quantity !== expected.quantity ||
      current.rank !== expected.rank
    ) {
      throw new MarketRecycleError(409, '材料已发生变化，请重新预览');
    }
  }

  const txResult = await getExecutor().transaction(async (tx) => {
    const deleted = await tx
      .delete(materials)
      .where(
        and(
          eq(materials.cultivatorId, cultivatorId),
          inArray(materials.id, session.itemIds),
        ),
      )
      .returning({ id: materials.id });

    if (deleted.length !== session.itemIds.length) {
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

  await redis.del(buildSessionKey(session.sessionId));

  return {
    success: true,
    itemType: 'material',
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
}

async function confirmArtifactSell(
  cultivatorId: string,
  session: RecycleSession,
): Promise<SellConfirmResponse> {
  const txResult = await getExecutor().transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(artifacts)
      .where(
        and(
          eq(artifacts.cultivatorId, cultivatorId),
          inArray(artifacts.id, session.itemIds),
        ),
      );

    if (rows.length !== session.itemIds.length) {
      throw new MarketRecycleError(409, '法宝已发生变化，请重新预览');
    }

    const [equippedRow] = await tx
      .select({
        weapon: equippedItems.weapon_id,
        armor: equippedItems.armor_id,
        accessory: equippedItems.accessory_id,
      })
      .from(equippedItems)
      .where(eq(equippedItems.cultivatorId, cultivatorId))
      .limit(1);

    if (equippedRow) {
      const equippedSet = new Set(
        [equippedRow.weapon, equippedRow.armor, equippedRow.accessory].filter(
          Boolean,
        ),
      );
      if (session.itemIds.some((id) => equippedSet.has(id))) {
        throw new MarketRecycleError(409, '法宝已装备，无法回收，请先卸下');
      }
    }

    const rowMap = new Map(rows.map((row) => [row.id, row]));
    for (const id of session.itemIds) {
      const current = rowMap.get(id);
      const expected = session.snapshot[id] as ArtifactSnapshot | undefined;
      if (!current || !expected) {
        throw new MarketRecycleError(409, '法宝已发生变化，请重新预览');
      }
      const currentQuality = getArtifactQuality({
        quality: current.quality as Quality,
      });
      const currentScore = current.score || 0;
      const currentSlot = current.slot as Artifact['slot'];
      const currentEffectsHash = getEffectsHash(current.effects);
      if (
        currentQuality !== expected.quality ||
        currentScore !== expected.score ||
        currentSlot !== expected.slot ||
        currentEffectsHash !== expected.effectsHash
      ) {
        throw new MarketRecycleError(409, '法宝已发生变化，请重新预览');
      }
    }

    const deleted = await tx
      .delete(artifacts)
      .where(
        and(
          eq(artifacts.cultivatorId, cultivatorId),
          inArray(artifacts.id, session.itemIds),
        ),
      )
      .returning({ id: artifacts.id });

    if (deleted.length !== session.itemIds.length) {
      throw new MarketRecycleError(409, '法宝已发生变化，请重新预览');
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

  await redis.del(buildSessionKey(session.sessionId));

  return {
    success: true,
    itemType: 'artifact',
    gainedSpiritStones: session.quotedTotal,
    soldItems: session.quotedItems.map((item) => ({
      id: item.id,
      name: item.name,
      quality: item.quality,
      quantity: 1,
      price: item.totalPrice,
      slot: item.slot,
      score: item.score,
      element: item.element,
    })),
    remainingSpiritStones: txResult.spiritStones,
    appraisal: session.appraisal,
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

    if (session.itemType === 'artifact') {
      return confirmArtifactSell(cultivatorId, session);
    }

    return confirmMaterialSell(cultivatorId, session);
  } finally {
    await redis.del(lockKey);
  }
}
