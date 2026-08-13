import {
  getExecutor,
  type DbExecutor,
  type DbTransaction,
} from '@server/lib/drizzle/db';
import {
  consumables,
  cultivators,
  materials,
} from '@server/lib/drizzle/schema';
import { redis } from '@server/lib/redis';
import { parseRedisJson } from '@server/lib/redis/json';
import type { CreationProductRecord } from '@server/lib/repositories/creationProductRepository';
import * as creationProductRepository from '@server/lib/repositories/creationProductRepository';
import { calculateSingleElixirScore } from '@server/utils/rankingUtils';
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
} from '@shared/config/marketConfig';
import {
  BASE_PRICES,
  TYPE_MULTIPLIERS,
} from '@shared/engine/material/creation/config';
import { isPillConsumable } from '@shared/lib/consumables';
import { getMaterialTypeLabel } from '@shared/lib/gameConceptDisplay';
import { calculatePillRecycleUnitPrice as calculatePillRecyclePrice } from '@shared/lib/pillRecyclePrice';
import { QUALITY_ORDER, type Quality } from '@shared/types/constants';
import type { Artifact, Consumable, Material } from '@shared/types/cultivator';
import type {
  HighTierAppraisal,
  SellConfirmResponse,
  SellItemType,
  SellMode,
  SellPreviewItem,
  SellPreviewResponse,
} from '@shared/types/market';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { mapConsumableRow } from './consumablePersistence';
import {
  getArtifactQualityFromProduct,
  getArtifactStateHash,
  toArtifactFromProduct,
} from './creationProductArtifactSupport';
import { getMysteryMaterialBlockingReason } from './materialMysteryGuard';

const SELL_SESSION_PREFIX = 'market:sell:session:';
const MYSTERY_MATERIAL_RECYCLE_BLOCKING_REASON =
  '待鉴定材料不可回收，请先鉴定。';
const APPRAISAL_RATING_STEPS: HighTierAppraisal['rating'][] = [
  'C',
  'B',
  'A',
  'S',
];
const HIGH_TIER_MATERIAL_BASE_RATING = {
  真品: 'C',
  地品: 'B',
  天品: 'A',
  仙品: 'S',
  神品: 'S',
} as const satisfies Record<
  '真品' | '地品' | '天品' | '仙品' | '神品',
  HighTierAppraisal['rating']
>;

type HighTierMaterialRank = keyof typeof HIGH_TIER_MATERIAL_BASE_RATING;
type SellConfirmResult = SellConfirmResponse & {
  afterCommit?: () => Promise<unknown>;
  inventoryChanges?: MarketRecycleInventoryChange[];
};

export type MarketRecycleInventoryChange =
  | { operation: 'remove'; id: string }
  | { operation: 'upsert'; item: Consumable };

export interface ConsumableSellSelection {
  id: string;
  quantity: number;
}

function isLowTier(quality: Quality): boolean {
  return (
    (QUALITY_ORDER[quality] ?? 0) <= (QUALITY_ORDER[RECYCLE_LOW_TIER_MAX] ?? 0)
  );
}

function isHighTier(quality: Quality): boolean {
  return (QUALITY_ORDER[quality] ?? 0) >= (QUALITY_ORDER[HIGH_TIER_MIN] ?? 0);
}

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

interface ConsumableSnapshot {
  id: string;
  quality: Quality;
  quantity: number;
  score: number;
  specHash: string;
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
  snapshot: Record<
    string,
    ArtifactSnapshot | MaterialSnapshot | ConsumableSnapshot
  >;
  createdAt: number;
  expiresAt: number;
}

type SessionStore = Omit<SellPreviewResponse, 'success'> & {
  cultivatorId: string;
  itemIds: string[];
  quotedItems: SellPreviewItem[];
  quotedTotal: number;
  snapshot: Record<
    string,
    ArtifactSnapshot | MaterialSnapshot | ConsumableSnapshot
  >;
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
  artifact: Pick<Artifact, 'quality' | 'score' | 'slot' | 'attributeModifiers'>,
): number {
  const quality = getArtifactQuality(artifact);
  const materialAnchorPrice = BASE_PRICES[quality];
  const qualityFactor = ARTIFACT_MATERIAL_ANCHOR_FACTOR[quality];

  const score = Math.max(0, artifact.score || 0);
  const scoreMultiplier = clamp(0.92 + score / 3000, 0.92, 1.5);
  const modifierCount = Array.isArray(artifact.attributeModifiers)
    ? artifact.attributeModifiers.length
    : 0;
  const modifierMultiplier = 1 + Math.min(0.22, modifierCount * 0.05);
  const slotMultiplier = ARTIFACT_SLOT_FACTOR[artifact.slot] ?? 1;

  const raw = Math.floor(
    materialAnchorPrice *
      qualityFactor *
      scoreMultiplier *
      modifierMultiplier *
      slotMultiplier,
  );
  const cap = Math.floor(materialAnchorPrice * RECYCLE_PRICE_FACTOR_CAP);

  return Math.max(1, Math.min(raw, cap));
}

export function calculatePillRecycleUnitPrice(
  consumable: Pick<Consumable, 'quality' | 'score' | 'spec'>,
): number {
  const score = calculateSingleElixirScore(consumable as Consumable);
  return calculatePillRecyclePrice(
    getConsumableQuality(consumable),
    score,
    consumable.spec.kind === 'pill' ? consumable.spec.alchemyMeta.appearance : undefined,
  );
}

function getConsumableQuality(
  consumable: Pick<Consumable, 'quality'>,
): Quality {
  const value = consumable.quality || '凡品';
  return value in QUALITY_ORDER ? value : '凡品';
}

function getConsumableSpecHash(consumable: Pick<Consumable, 'spec'>): string {
  return JSON.stringify(consumable.spec);
}

function getArtifactAppraisalRating(
  artifact: Pick<Artifact, 'quality' | 'score' | 'attributeModifiers'>,
): HighTierAppraisal['rating'] {
  const quality = getArtifactQuality(artifact);
  const qualityScore = QUALITY_ORDER[quality] ?? 0;
  const score = Math.max(0, artifact.score || 0);
  const modifierCount = Array.isArray(artifact.attributeModifiers)
    ? artifact.attributeModifiers.length
    : 0;

  const total =
    qualityScore * 12 +
    Math.min(18, Math.floor(score / 220)) +
    modifierCount * 3;
  if (total >= 88) return 'S';
  if (total >= 70) return 'A';
  if (total >= 54) return 'B';
  return 'C';
}

export function buildArtifactHighTierAppraisal(
  artifact: Pick<
    Artifact,
    'name' | 'quality' | 'score' | 'slot' | 'attributeModifiers'
  >,
): HighTierAppraisal {
  const quality = getArtifactQuality(artifact);
  const score = Math.max(0, artifact.score || 0);
  const modifierCount = Array.isArray(artifact.attributeModifiers)
    ? artifact.attributeModifiers.length
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
    modifierCount >= 4
      ? '器内道痕层叠，可承重祭'
      : modifierCount >= 2
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

function shiftAppraisalRating(
  rating: HighTierAppraisal['rating'],
  delta: number,
): HighTierAppraisal['rating'] {
  const index = APPRAISAL_RATING_STEPS.indexOf(rating);
  return APPRAISAL_RATING_STEPS[
    clamp(index + delta, 0, APPRAISAL_RATING_STEPS.length - 1)
  ];
}

function getMaterialKeywordSource(
  material: Pick<Material, 'name' | 'description' | 'details'>,
): string {
  return [
    material.name,
    material.description || '',
    JSON.stringify(material.details || {}),
  ].join(' ');
}

function extractMaterialAppraisalKeywords(
  material: Pick<Material, 'name' | 'description' | 'details'>,
): string[] {
  const keywordSource = getMaterialKeywordSource(material);
  return Object.entries(APPRAISAL_KEYWORD_WEIGHTS)
    .filter(([token]) => keywordSource.includes(token))
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .map(([token]) => token)
    .slice(0, 4);
}

function getMaterialAppraisalAdjustment(keywords: string[]): number {
  let positiveScore = 0;
  let negativeScore = 0;

  for (const keyword of keywords) {
    const weight = APPRAISAL_KEYWORD_WEIGHTS[keyword] ?? 0;
    if (weight > 0) positiveScore += weight;
    if (weight < 0) negativeScore += Math.abs(weight);
  }

  if (positiveScore >= 0.05 && positiveScore > negativeScore) return 1;
  if (negativeScore >= 0.04 && negativeScore > positiveScore) return -1;
  return 0;
}

function getMaterialAppraisalFeatureText(keywords: string[]): string {
  const positiveKeywords = keywords.filter(
    (keyword) => (APPRAISAL_KEYWORD_WEIGHTS[keyword] ?? 0) > 0,
  );
  const negativeKeywords = keywords.filter(
    (keyword) => (APPRAISAL_KEYWORD_WEIGHTS[keyword] ?? 0) < 0,
  );

  if (
    positiveKeywords.length > 0 &&
    positiveKeywords.length >= negativeKeywords.length
  ) {
    return `尤见${positiveKeywords.slice(0, 2).join('、')}之象`;
  }
  if (negativeKeywords.length > 0) {
    return `惜有${negativeKeywords.slice(0, 2).join('、')}之痕`;
  }
  return '气机收束，异象未尽显';
}

function getMaterialRankTone(rank: HighTierMaterialRank): string {
  switch (rank) {
    case '真品':
      return '已脱凡材，可入稳价之列';
    case '地品':
      return '底蕴稳固，足作上乘炼材';
    case '天品':
      return '灵机昂藏，已有高阶宝材气象';
    case '仙品':
      return '仙蕴昭然，难得一见';
    case '神品':
      return '神华内敛，非寻常坊市所能久留';
  }
}

export function buildMaterialHighTierAppraisal(
  material: Pick<
    Material,
    'name' | 'type' | 'rank' | 'element' | 'description' | 'details'
  >,
): HighTierAppraisal {
  const rank =
    material.rank in HIGH_TIER_MATERIAL_BASE_RATING
      ? (material.rank as HighTierMaterialRank)
      : '真品';
  const keywords = extractMaterialAppraisalKeywords(material);
  const rating = shiftAppraisalRating(
    HIGH_TIER_MATERIAL_BASE_RATING[rank],
    getMaterialAppraisalAdjustment(keywords),
  );
  const typeLabel = getMaterialTypeLabel(material.type);
  const elementText = material.element
    ? `${material.element}灵息流转`
    : '灵息内敛';
  const featureText = getMaterialAppraisalFeatureText(keywords);
  const comment = `此${rank}${typeLabel}「${material.name}」${elementText}，${featureText}。按坊市旧例称量，${getMaterialRankTone(rank)}，今可定为${rating}级回收。`;

  return {
    rating,
    comment,
    keywords,
  };
}

function normalizeItemIds(itemIds: string[]): string[] {
  const deduped = [...new Set(itemIds.map((id) => id?.trim()).filter(Boolean))];
  if (deduped.length === 0) {
    throw new MarketRecycleError(400, '请至少选择一件物品');
  }
  return deduped;
}

function normalizeConsumableSelections(
  selections: ConsumableSellSelection[],
): ConsumableSellSelection[] {
  const normalized = selections.map((selection) => ({
    id: selection.id?.trim(),
    quantity: selection.quantity,
  }));
  if (
    normalized.length === 0 ||
    normalized.some(
      (selection) =>
        !selection.id ||
        !Number.isSafeInteger(selection.quantity) ||
        selection.quantity < 1,
    )
  ) {
    throw new MarketRecycleError(400, '请选择有效的丹药和回收数量');
  }
  if (
    new Set(normalized.map((selection) => selection.id)).size !==
    normalized.length
  ) {
    throw new MarketRecycleError(400, '同一丹药不可重复选择');
  }
  return normalized;
}

function ensureNoMysteryMaterials(items: Material[]): void {
  const reason = getMysteryMaterialBlockingReason(items);
  if (reason) {
    throw new MarketRecycleError(400, MYSTERY_MATERIAL_RECYCLE_BLOCKING_REASON);
  }
}

async function loadOwnedMaterials(
  cultivatorId: string,
  materialIds: string[],
  q: DbExecutor | DbTransaction = getExecutor(),
): Promise<Material[]> {
  const rows = await q
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
  q: DbExecutor | DbTransaction = getExecutor(),
): Promise<{ artifacts: Artifact[]; rawRecords: CreationProductRecord[] }> {
  const rows = await creationProductRepository.findArtifactsByIdsAndCultivator(
    cultivatorId,
    artifactIds,
    q,
  );

  if (rows.length !== artifactIds.length) {
    throw new MarketRecycleError(400, '部分法宝不存在或不属于当前角色');
  }

  const order = new Map(artifactIds.map((id, index) => [id, index]));
  rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  return {
    artifacts: rows.map(toArtifactFromProduct),
    rawRecords: rows,
  };
}

async function loadOwnedConsumables(
  cultivatorId: string,
  consumableIds: string[],
  q: DbExecutor | DbTransaction = getExecutor(),
): Promise<Consumable[]> {
  const rows = await q
    .select()
    .from(consumables)
    .where(
      and(
        eq(consumables.cultivatorId, cultivatorId),
        inArray(consumables.id, consumableIds),
      ),
    );

  if (rows.length !== consumableIds.length) {
    throw new MarketRecycleError(400, '部分丹药不存在或不属于当前角色');
  }

  const order = new Map(consumableIds.map((id, index) => [id, index]));
  rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  const items = rows.map(mapConsumableRow);
  if (items.some((item) => !isPillConsumable(item))) {
    throw new MarketRecycleError(400, '丹药回收不支持符箓或无效消耗品');
  }
  return items;
}

function ensureArtifactsNotEquipped(
  artifacts: CreationProductRecord[],
  message: string,
): void {
  if (artifacts.some((artifact) => artifact.isEquipped)) {
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
  rawRecords: CreationProductRecord[],
): Record<string, ArtifactSnapshot> {
  const rawRecordMap = new Map(rawRecords.map((r) => [r.id, r]));
  const snapshot: Record<string, ArtifactSnapshot> = {};
  for (const item of items) {
    if (!item.id) continue;
    const rawRecord = rawRecordMap.get(item.id);
    snapshot[item.id] = {
      id: item.id,
      quality: getArtifactQuality(item),
      score: item.score || 0,
      slot: item.slot,
      effectsHash: rawRecord ? getArtifactStateHash(rawRecord) : '[]',
    };
  }
  return snapshot;
}

function buildConsumableSessionSnapshot(
  items: Consumable[],
): Record<string, ConsumableSnapshot> {
  const snapshot: Record<string, ConsumableSnapshot> = {};
  for (const item of items) {
    if (!item.id) continue;
    snapshot[item.id] = {
      id: item.id,
      quality: getConsumableQuality(item),
      quantity: item.quantity,
      score: item.score || 0,
      specHash: getConsumableSpecHash(item),
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
  ensureNoMysteryMaterials(ownedMaterials);

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
  let items: SellPreviewItem[];

  if (highTier.length === 1) {
    const material = highTier[0];
    mode = 'high_single';
    appraisal = buildMaterialHighTierAppraisal(material);
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
    createdAt,
  };

  await redis.set(
    buildSessionKey(sessionId),
    JSON.stringify(session),
    'EX',
    APPRAISAL_SESSION_TTL_SEC,
  );

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
  const { artifacts: ownedArtifacts, rawRecords } = await loadOwnedArtifacts(
    cultivator.id,
    ids,
  );
  ensureArtifactsNotEquipped(rawRecords, '已装备法宝不可回收，请先卸下');

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
  let targetArtifacts: Artifact[];

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

  const targetIds = new Set(targetArtifacts.map((a) => a.id));
  const targetRawRecords = rawRecords.filter((r) => targetIds.has(r.id));

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
    snapshot: buildArtifactSessionSnapshot(targetArtifacts, targetRawRecords),
    createdAt,
  };

  await redis.set(
    buildSessionKey(sessionId),
    JSON.stringify(session),
    'EX',
    APPRAISAL_SESSION_TTL_SEC,
  );

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

async function previewConsumableSell(
  cultivator: { id: string },
  rawSelections: ConsumableSellSelection[],
): Promise<SellPreviewResponse> {
  const selections = normalizeConsumableSelections(rawSelections);
  const ids = selections.map((selection) => selection.id);
  const ownedConsumables = await loadOwnedConsumables(cultivator.id, ids);
  const selectionById = new Map(
    selections.map((selection) => [selection.id, selection.quantity]),
  );

  const lowTier = ownedConsumables.filter((item) =>
    isLowTier(getConsumableQuality(item)),
  );
  const highTier = ownedConsumables.filter((item) =>
    isHighTier(getConsumableQuality(item)),
  );
  if (lowTier.length > 0 && highTier.length > 0) {
    throw new MarketRecycleError(400, '不可混合回收低品与高品丹药');
  }
  if (highTier.length > 1) {
    throw new MarketRecycleError(400, '真品及以上丹药仅支持单组回收');
  }

  const mode: SellMode = highTier.length === 1 ? 'high_single' : 'low_bulk';
  const items: SellPreviewItem[] = ownedConsumables.map((item) => {
    const quantity = selectionById.get(item.id!) ?? 0;
    if (quantity < 1 || quantity > item.quantity) {
      throw new MarketRecycleError(
        400,
        `「${item.name}」回收数量范围为 1～${item.quantity}`,
      );
    }
    const score = calculateSingleElixirScore(item);
    const unitPrice = calculatePillRecyclePrice(
      getConsumableQuality(item),
      score,
      item.spec.kind === 'pill' ? item.spec.alchemyMeta.appearance : undefined,
    );
    return {
      id: item.id!,
      name: item.name,
      quality: getConsumableQuality(item),
      appearance:
        item.spec.kind === 'pill'
          ? item.spec.alchemyMeta.appearance
          : undefined,
      quantity,
      unitPrice,
      totalPrice: unitPrice * quantity,
      score,
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
    itemType: 'consumable',
    sessionId,
    mode,
    items,
    totalSpiritStones,
    expiresAt,
    cultivatorId: cultivator.id,
    itemIds: ids,
    quotedItems: items,
    quotedTotal: totalSpiritStones,
    snapshot: buildConsumableSessionSnapshot(ownedConsumables),
    createdAt,
  };

  await redis.set(
    buildSessionKey(sessionId),
    JSON.stringify(session),
    'EX',
    APPRAISAL_SESSION_TTL_SEC,
  );

  return {
    success: true,
    itemType: 'consumable',
    sessionId,
    mode,
    items,
    totalSpiritStones,
    expiresAt,
  };
}

export async function previewSell(
  cultivator: { id: string },
  itemIds: string[],
  itemType: SellItemType = 'material',
  consumableSelections?: ConsumableSellSelection[],
): Promise<SellPreviewResponse> {
  if (itemType === 'consumable') {
    return previewConsumableSell(
      cultivator,
      consumableSelections ?? itemIds.map((id) => ({ id, quantity: 1 })),
    );
  }
  if (itemType === 'artifact') {
    return previewArtifactSell(cultivator, itemIds);
  }
  return previewMaterialSell(cultivator, itemIds);
}

export async function previewAllLowTierSell(
  cultivator: { id: string },
  itemType: SellItemType,
): Promise<SellPreviewResponse> {
  const lowTierQualities = (Object.keys(QUALITY_ORDER) as Quality[]).filter(
    isLowTier,
  );
  if (itemType === 'consumable') {
    const rows = await getExecutor()
      .select()
      .from(consumables)
      .where(
        and(
          eq(consumables.cultivatorId, cultivator.id),
          inArray(consumables.quality, lowTierQualities),
          sql`${consumables.spec}->>'kind' = 'pill'`,
        ),
      )
      .orderBy(desc(consumables.createdAt), desc(consumables.id));
    if (rows.length === 0) {
      throw new MarketRecycleError(400, '未找到可回收丹药');
    }
    return previewConsumableSell(
      cultivator,
      rows.map((row) => ({ id: row.id, quantity: row.quantity })),
    );
  }
  if (itemType === 'artifact') {
    const ids =
      await creationProductRepository.findUnequippedArtifactIdsByQualities(
        cultivator.id,
        lowTierQualities,
      );
    if (ids.length === 0) {
      throw new MarketRecycleError(400, '未找到可回收法宝');
    }
    return previewArtifactSell(cultivator, ids);
  }

  const rows = await getExecutor()
    .select({ id: materials.id })
    .from(materials)
    .where(
      and(
        eq(materials.cultivatorId, cultivator.id),
        inArray(materials.rank, lowTierQualities),
        sql`not coalesce(${materials.details} ? 'mystery', false)`,
      ),
    )
    .orderBy(desc(materials.createdAt), desc(materials.id));
  const ids = rows.map((row) => row.id);
  if (ids.length === 0) {
    throw new MarketRecycleError(400, '未找到可回收材料');
  }
  return previewMaterialSell(cultivator, ids);
}

async function readSession(sessionId: string): Promise<RecycleSession> {
  const key = buildSessionKey(sessionId);
  const raw = parseRedisJson<SessionStore>(await redis.get(key), key);
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
    createdAt: raw.createdAt,
    expiresAt: raw.expiresAt,
  };
}

async function confirmMaterialSell(
  cultivatorId: string,
  session: RecycleSession,
  tx: DbTransaction,
): Promise<SellConfirmResult> {
  const ownedMaterials = await loadOwnedMaterials(
    cultivatorId,
    session.itemIds,
    tx,
  );
  ensureNoMysteryMaterials(ownedMaterials);
  const snapshot = new Map(ownedMaterials.map((item) => [item.id, item]));

  for (const quoted of session.quotedItems) {
    const current = snapshot.get(quoted.id);
    const expected = session.snapshot[quoted.id] as
      MaterialSnapshot | undefined;
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

  const writeSell = async (tx: DbTransaction) => {
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
  };

  const txResult = await writeSell(tx);
  const afterCommit = () => redis.del(buildSessionKey(session.sessionId));

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
    afterCommit,
  };
}

async function confirmArtifactSell(
  cultivatorId: string,
  session: RecycleSession,
  tx: DbTransaction,
): Promise<SellConfirmResult> {
  const writeSell = async (tx: DbTransaction) => {
    const rows =
      await creationProductRepository.findArtifactsByIdsAndCultivator(
        cultivatorId,
        session.itemIds,
        tx,
      );

    if (rows.length !== session.itemIds.length) {
      throw new MarketRecycleError(409, '法宝已发生变化，请重新预览');
    }

    if (rows.some((row) => row.isEquipped)) {
      throw new MarketRecycleError(409, '法宝已装备，无法回收，请先卸下');
    }

    const rowMap = new Map(rows.map((row) => [row.id, row]));
    for (const id of session.itemIds) {
      const current = rowMap.get(id);
      const expected = session.snapshot[id] as ArtifactSnapshot | undefined;
      if (!current || !expected) {
        throw new MarketRecycleError(409, '法宝已发生变化，请重新预览');
      }
      const currentQuality = getArtifactQualityFromProduct(current);
      const currentScore = current.score || 0;
      const currentSlot = (current.slot as Artifact['slot']) || 'weapon';
      const currentEffectsHash = getArtifactStateHash(current);
      if (
        currentQuality !== expected.quality ||
        currentScore !== expected.score ||
        currentSlot !== expected.slot ||
        currentEffectsHash !== expected.effectsHash
      ) {
        throw new MarketRecycleError(409, '法宝已发生变化，请重新预览');
      }
    }

    const deleted =
      await creationProductRepository.deleteArtifactsByIdsAndCultivator(
        cultivatorId,
        session.itemIds,
        tx,
      );

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
  };

  const txResult = await writeSell(tx);
  const afterCommit = () => redis.del(buildSessionKey(session.sessionId));

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
    afterCommit,
  };
}

async function confirmConsumableSell(
  cultivatorId: string,
  session: RecycleSession,
  tx: DbTransaction,
): Promise<SellConfirmResult> {
  const ownedConsumables = await loadOwnedConsumables(
    cultivatorId,
    session.itemIds,
    tx,
  );
  const currentById = new Map(ownedConsumables.map((item) => [item.id, item]));

  for (const quoted of session.quotedItems) {
    const current = currentById.get(quoted.id);
    const expected = session.snapshot[quoted.id] as
      ConsumableSnapshot | undefined;
    if (
      !current ||
      !expected ||
      current.quantity !== expected.quantity ||
      getConsumableQuality(current) !== expected.quality ||
      (current.score || 0) !== expected.score ||
      getConsumableSpecHash(current) !== expected.specHash ||
      quoted.quantity > current.quantity
    ) {
      throw new MarketRecycleError(409, '丹药已发生变化，请重新预览');
    }
  }

  const inventoryChanges: MarketRecycleInventoryChange[] = [];
  for (const quoted of session.quotedItems) {
    const current = currentById.get(quoted.id)!;
    if (quoted.quantity === current.quantity) {
      const deleted = await tx
        .delete(consumables)
        .where(
          and(
            eq(consumables.id, quoted.id),
            eq(consumables.cultivatorId, cultivatorId),
            eq(consumables.quantity, current.quantity),
          ),
        )
        .returning({ id: consumables.id });
      if (deleted.length !== 1) {
        throw new MarketRecycleError(409, '丹药已发生变化，请重新预览');
      }
      inventoryChanges.push({ operation: 'remove', id: quoted.id });
      continue;
    }

    const [updated] = await tx
      .update(consumables)
      .set({ quantity: current.quantity - quoted.quantity })
      .where(
        and(
          eq(consumables.id, quoted.id),
          eq(consumables.cultivatorId, cultivatorId),
          eq(consumables.quantity, current.quantity),
        ),
      )
      .returning();
    if (!updated) {
      throw new MarketRecycleError(409, '丹药已发生变化，请重新预览');
    }
    inventoryChanges.push({
      operation: 'upsert',
      item: mapConsumableRow(updated),
    });
  }

  const [updatedCultivator] = await tx
    .update(cultivators)
    .set({
      spirit_stones: sql`${cultivators.spirit_stones} + ${session.quotedTotal}`,
    })
    .where(eq(cultivators.id, cultivatorId))
    .returning({ spiritStones: cultivators.spirit_stones });
  if (!updatedCultivator) {
    throw new MarketRecycleError(404, '角色不存在或已失效');
  }

  return {
    success: true,
    itemType: 'consumable',
    gainedSpiritStones: session.quotedTotal,
    soldItems: session.quotedItems.map((item) => ({
      id: item.id,
      name: item.name,
      quality: item.quality,
      appearance: item.appearance,
      quantity: item.quantity,
      price: item.totalPrice,
      score: item.score,
    })),
    remainingSpiritStones: updatedCultivator.spiritStones,
    inventoryChanges,
    afterCommit: () => redis.del(buildSessionKey(session.sessionId)),
  };
}

export async function prepareSellConfirmation(
  cultivatorId: string,
  sessionId: string,
): Promise<{
  commit(tx: DbTransaction): Promise<SellConfirmResult>;
}> {
  const session = await readSession(sessionId);

  if (session.cultivatorId !== cultivatorId) {
    throw new MarketRecycleError(410, '回收确认已失效');
  }
  if (session.expiresAt < Date.now()) {
    await redis.del(buildSessionKey(sessionId));
    throw new MarketRecycleError(410, '回收确认已过期，请重新鉴定');
  }

  return {
    commit(tx: DbTransaction) {
      if (session.itemType === 'consumable') {
        return confirmConsumableSell(cultivatorId, session, tx);
      }
      if (session.itemType === 'artifact') {
        return confirmArtifactSell(cultivatorId, session, tx);
      }

      return confirmMaterialSell(cultivatorId, session, tx);
    },
  };
}
