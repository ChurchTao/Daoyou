import {
  legacyModifiers,
  legacyRecord,
  legacyText,
  type LegacyAttributeModifier,
} from '@shared/legacy/products';
import {
  getAttributeInfo,
  type AttributeKey,
} from '@shared/lib/gameConceptDisplay';
import type { ElementType, Quality } from '@shared/types/constants';

export type AffixRarityTone = 'muted' | 'info' | 'rare' | 'legendary';
export interface AffixView {
  id: string;
  name: string;
  bodyText: string;
  rarityTone: AffixRarityTone;
  isPerfect: boolean;
}
export interface AttributeModifierView {
  attrLabel: string;
  attrKey: string;
  valueText: string;
  raw: LegacyAttributeModifier;
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
  rawModel?: {
    productType?: string;
    metadata?: { anchorRealm?: string; creatorName?: string };
  };
}

export function formatNumber(value: number, digits = 2) {
  return Number.isFinite(value)
    ? String(Number(value.toFixed(digits)))
    : '未记录';
}
export function formatAttributeValue(modifier: LegacyAttributeModifier) {
  const prefix = modifier.value >= 0 ? '+' : '';
  if (modifier.type === 'add')
    return `${prefix}${formatNumber(modifier.value * 100)}%`;
  if (modifier.type === 'multiply') return `×${formatNumber(modifier.value)}`;
  return `${prefix}${formatNumber(modifier.value)}`;
}
export function toAttributeModifierView(
  modifier: LegacyAttributeModifier,
): AttributeModifierView {
  return {
    attrKey: modifier.attrType,
    attrLabel: getAttributeInfo(modifier.attrType as AttributeKey).label,
    valueText: formatAttributeValue(modifier),
    raw: modifier,
  };
}
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
  productModel?: unknown;
}

export function toProductDisplayModel(
  record: ProductRecordLike,
): ProductDisplayModel {
  const raw = legacyRecord(record.productModel);
  const metadata = legacyRecord(raw.metadata);
  const modifiers = legacyModifiers(raw.attributeModifiers).map(
    toAttributeModifierView,
  );
  const affixes: AffixView[] = Array.isArray(raw.affixes)
    ? raw.affixes.map((entry, index) => {
        const row = legacyRecord(entry);
        return {
          id: legacyText(row.id) ?? String(index),
          name: legacyText(row.name) ?? '未记录名称',
          bodyText: legacyText(row.description) ?? '未记录说明',
          rarityTone: 'muted',
          isPerfect: row.isPerfect === true,
        };
      })
    : [];
  return {
    name: record.name ?? legacyText(raw.name) ?? '未记录名称',
    description: record.description ?? legacyText(raw.description),
    originalName: legacyText(raw.originalName),
    productType: (record.productType ??
      raw.productType) as ProductDisplayModel['productType'],
    quality: record.quality ?? undefined,
    element: record.element ?? undefined,
    slot: record.slot ?? undefined,
    score: record.score ?? 0,
    isEquipped: Boolean(record.isEquipped),
    modifiers,
    affixes,
    rawModel: {
      productType: legacyText(raw.productType),
      metadata: {
        anchorRealm: legacyText(metadata.anchorRealm),
        creatorName: legacyText(metadata.creatorName),
      },
    },
  };
}
