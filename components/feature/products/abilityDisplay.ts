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

// ===== 基础视图态 =====

export interface AffixView {
  id: string;
  name: string;
  description?: string;
  category: string;
  /** 是否完美触发 */
  isPerfect: boolean;
  /** 随机效率分 0-1 */
  rollEfficiency: number;
  /** 最终倍率（如 1.12 表示 112%） */
  finalMultiplier: number;
  /** 标签（battle-v5 ability tags 等） */
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
  /** battle-v5 原生 projectionKind */
  projectionKind:
    | 'active_skill'
    | 'artifact_passive'
    | 'gongfa_passive';
  /** 标签（法术、控制、增益……） */
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
  quality?: string;
  element?: string;
  slot?: string;
  score: number;
  isEquipped?: boolean;
  affixes: AffixView[];
  modifiers: AttributeModifierView[];
  projection?: AbilityProjectionSummary;
  abilityConfig?: AbilityConfig;
  rawModel: CreationProductModel;
}

// ===== 映射 =====

const ATTRIBUTE_LABELS: Record<AttributeType, string> = {
  [AttributeType.SPIRIT]: '灵力',
  [AttributeType.VITALITY]: '体魄',
  [AttributeType.SPEED]: '身法',
  [AttributeType.WILLPOWER]: '神识',
  [AttributeType.WISDOM]: '悟性',
  [AttributeType.ATK]: '物攻',
  [AttributeType.DEF]: '物防',
  [AttributeType.MAGIC_ATK]: '法攻',
  [AttributeType.MAGIC_DEF]: '法防',
  [AttributeType.CRIT_RATE]: '暴击率',
  [AttributeType.CRIT_DAMAGE_MULT]: '暴击伤害',
  [AttributeType.EVASION_RATE]: '闪避率',
  [AttributeType.CONTROL_HIT]: '控制命中',
  [AttributeType.CONTROL_RESISTANCE]: '控制抗性',
  [AttributeType.ARMOR_PENETRATION]: '破防',
  [AttributeType.MAGIC_PENETRATION]: '法穿',
  [AttributeType.CRIT_RESIST]: '暴击抗性',
  [AttributeType.CRIT_DAMAGE_REDUCTION]: '暴伤减免',
  [AttributeType.ACCURACY]: '命中',
  [AttributeType.HEAL_AMPLIFY]: '治疗加成',
};

export function formatAttributeValue(
  modifier: AttributeModifierConfig,
): string {
  const prefix = modifier.value >= 0 ? '+' : '';
  switch (modifier.type) {
    // ADD 在 battle-v5 语义为 "百分比加法" (final *= 1 + sum)
    case ModifierType.ADD:
      return `${prefix}${(modifier.value * 100).toFixed(0)}%`;
    // MULTIPLY 是独立累乘，value > 1 表示增益，< 1 表示减益
    case ModifierType.MULTIPLY:
      return `×${modifier.value.toFixed(2)}`;
    case ModifierType.BASE:
    case ModifierType.FIXED:
    default:
      return `${prefix}${modifier.value}`;
  }
}

export function toAttributeModifierView(
  modifier: AttributeModifierConfig,
): AttributeModifierView {
  return {
    attrKey: modifier.attrType,
    attrLabel: ATTRIBUTE_LABELS[modifier.attrType] ?? modifier.attrType,
    valueText: formatAttributeValue(modifier),
    raw: modifier,
  };
}

export function toAffixView(affix: RolledAffix): AffixView {
  return {
    id: affix.id,
    name: affix.name,
    description: affix.description,
    category: affix.category,
    isPerfect: affix.isPerfect,
    rollEfficiency: affix.rollEfficiency,
    finalMultiplier: affix.finalMultiplier,
    tags: affix.tags ?? [],
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
  element?: string | null;
  quality?: string | null;
  slot?: string | null;
  score?: number;
  isEquipped?: boolean;
  abilityConfig?: unknown;
  productModel?: unknown;
}

/**
 * 将 `/api/v2/products` 的原始行转换为 UI 视图态。
 * `productModel` 是 battle-v5 与 creation-v2 的权威来源；其余列字段只作为冗余兜底。
 */
export function toProductDisplayModel(
  record: ProductRecordLike,
): ProductDisplayModel {
  const rawModel = record.productModel as CreationProductModel;
  const affixes = (rawModel?.affixes ?? []).map(toAffixView);
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
    abilityConfig: record.abilityConfig as AbilityConfig | undefined,
    rawModel,
  };
}
