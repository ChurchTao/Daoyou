/**
 * abilityDisplay
 *
 * 展示层统一使用此模块把 creation-v2 的 `CreationProductModel`（含 `battleProjection`、
 * `affixes`、`balanceMetrics` 等）与 battle-v5 的 `AbilityConfig` / `AttributeModifierConfig`
 * 翻译为 UI 友好的视图态。
 *
 * 所有神通 / 功法 / 法宝详情页面都应使用这里提供的类型和函数，而不是各自散落地解析
 * productModel 字段。
 */

import {
  AttributeType,
  ModifierType,
} from '@/engine/battle-v5/core/types';
import type {
  AbilityConfig,
  AttributeModifierConfig,
} from '@/engine/battle-v5/core/configs';
import type {
  CreationProductModel,
  ArtifactProductModel,
  GongFaProductModel,
  SkillProductModel,
} from '@/engine/creation-v2/models/types';
import type { RolledAffix } from '@/engine/creation-v2/types';
import {
  renderAffixLine,
  rarityToTone,
  type AffixRarity,
} from '@/engine/battle-v5/effects/affixText';
import { ATTR_LABELS } from '@/engine/battle-v5/effects/affixText/attributes';
import type { ElementType, Quality } from '@/types/constants';

// ===== 基础视图态 =====

export type AffixRarityTone = 'muted' | 'info' | 'rare' | 'legendary';

export interface AffixView {
  id: string;
  name: string;
  /** 一句话渲染：[监听前缀] [条件] [效果+数值] */
  bodyText: string;
  /** 按稀有度上色 */
  rarityTone: AffixRarityTone;
  /** 原始稀有度（common/uncommon/rare/legendary） */
  rarity: AffixRarity;
  /** 是否完美触发（roll 到词缀上限） */
  isPerfect: boolean;
  /** battle-v5 ability tags 等额外标签 */
  tags: string[];
}

export interface AttributeModifierView {
  attrLabel: string;
  attrKey: AttributeType;
  /** 展示用文本，如 "+15" / "+10%" */
  valueText: string;
  raw: AttributeModifierConfig;
}

export interface AbilityProjectionSummary {
  /** '主动 / 被动 / 装备' 中文标签 */
  kindLabel: string;
  projectionKind:
    | 'active_skill'
    | 'artifact_passive'
    | 'gongfa_passive';
  tags: string[];
  mpCost?: number;
  cooldown?: number;
  priority?: number;
}

export interface ProductDisplayModel {
  name: string;
  originalName?: string;
  description?: string;
  productType: 'skill' | 'artifact' | 'gongfa';
  quality?: Quality;
  element?: ElementType;
  slot?: string;
  score: number;
  isEquipped?: boolean;
  affixes: AffixView[];
  modifiers: AttributeModifierView[];
  projection?: AbilityProjectionSummary;
  rawModel: CreationProductModel;
}

// ===== 通用格式化 =====

export function formatAttributeValue(
  modifier: AttributeModifierConfig,
): string {
  const prefix = modifier.value >= 0 ? '+' : '';
  const abs = Math.abs(modifier.value);
  switch (modifier.type) {
    // ADD 在 battle-v5 语义为 "百分比加法" (final *= 1 + sum)
    case ModifierType.ADD:
      return `${prefix}${formatNumber(abs * 100)}%`;
    // MULTIPLY 是独立累乘，value > 1 表示增益，< 1 表示减益
    case ModifierType.MULTIPLY:
      return `×${formatNumber(modifier.value)}`;
    case ModifierType.BASE:
    case ModifierType.FIXED:
    default:
      return `${prefix}${formatNumber(abs)}`;
  }
}

export function formatNumber(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return '0';
  return value
    .toFixed(digits)
    .replace(/\.?0+$/, '');
}

export function toAttributeModifierView(
  modifier: AttributeModifierConfig,
): AttributeModifierView {
  return {
    attrKey: modifier.attrType,
    attrLabel: ATTR_LABELS[modifier.attrType] ?? modifier.attrType,
    valueText: formatAttributeValue(modifier),
    raw: modifier,
  };
}

// ===== 词缀视图 =====

/**
 * 把 RolledAffix 转成 UI 视图态。
 *
 * @param affix  词缀 rolled 结果（含 id / 倍率 / 是否完美等）
 * @param quality 产物品质，用于还原 effectTemplate 中的品质缩放
 * @param abilityConfig 产物 abilityConfig，用于读取真实落地的属性修改器
 */
export function toAffixView(
  affix: RolledAffix,
  quality: Quality,
  abilityConfig?: AbilityConfig,
): AffixView {
  const rendered = renderAffixLine(affix, quality, { abilityConfig });
  return {
    id: rendered.id,
    name: rendered.name,
    bodyText: rendered.bodyText,
    rarity: rendered.rarity,
    rarityTone: rarityToTone(rendered.rarity),
    isPerfect: rendered.isPerfect,
    tags: (affix.tags as string[] | undefined) ?? [],
  };
}

function buildProjection(
  model: CreationProductModel,
): AbilityProjectionSummary | undefined {
  const projection = model.battleProjection as
    | SkillProductModel['battleProjection']
    | ArtifactProductModel['battleProjection']
    | GongFaProductModel['battleProjection']
    | undefined;
  if (!projection) return undefined;

  const base: AbilityProjectionSummary = {
    projectionKind: projection.projectionKind,
    kindLabel:
      projection.projectionKind === 'active_skill'
        ? '主动神通'
        : projection.projectionKind === 'gongfa_passive'
          ? '功法·被动'
          : '法宝·被动',
    tags: projection.abilityTags ?? [],
  };

  if (projection.projectionKind === 'active_skill') {
    base.mpCost = projection.mpCost;
    base.cooldown = projection.cooldown;
    base.priority = projection.priority;
  }

  return base;
}

function collectModifiers(
  model: CreationProductModel,
): AttributeModifierConfig[] {
  const projection = model.battleProjection as
    | ArtifactProductModel['battleProjection']
    | GongFaProductModel['battleProjection']
    | SkillProductModel['battleProjection'];
  if (
    projection.projectionKind === 'artifact_passive' ||
    projection.projectionKind === 'gongfa_passive'
  ) {
    return projection.modifiers ?? [];
  }
  return [];
}

/**
 * DB/API 返回的单个产物记录的最小结构。与 `CreationProductRecord` 兼容。
 */
export interface ProductRecordLike {
  id?: string;
  name?: string;
  description?: string | null;
  productType?: string;
  element?: ElementType | null;
  quality?: Quality | null;
  slot?: string | null;
  score?: number;
  isEquipped?: boolean;
  abilityConfig?: unknown;
  productModel?: unknown;
}

const DEFAULT_QUALITY: Quality = '凡品';

/**
 * 将 `/api/v2/products` 的原始行转换为 UI 视图态。
 * `productModel` 是 battle-v5 与 creation-v2 的权威来源；其余列字段只作为冗余兜底。
 */
export function toProductDisplayModel(
  record: ProductRecordLike,
): ProductDisplayModel {
  const rawModel = record.productModel as CreationProductModel;
  const abilityConfig = record.abilityConfig as AbilityConfig | undefined;
  const quality = (record.quality as Quality | null) ?? DEFAULT_QUALITY;

  const affixes = (rawModel?.affixes ?? []).map((affix) =>
    toAffixView(affix, quality, abilityConfig),
  );
  const modifiers = rawModel
    ? collectModifiers(rawModel).map(toAttributeModifierView)
    : [];

  return {
    name: rawModel?.name ?? record.name ?? '未知产物',
    originalName: rawModel?.originalName,
    description: rawModel?.description ?? record.description ?? undefined,
    productType:
      (rawModel?.productType as ProductDisplayModel['productType']) ??
      (record.productType as ProductDisplayModel['productType']),
    quality: record.quality ?? undefined,
    element: record.element ?? undefined,
    slot: record.slot ?? undefined,
    score: record.score ?? 0,
    isEquipped: Boolean(record.isEquipped),
    affixes,
    modifiers,
    projection: rawModel ? buildProjection(rawModel) : undefined,
    rawModel,
  };
}
