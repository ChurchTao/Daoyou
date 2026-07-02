import type {
  AlchemyMaterialPropertyVector,
  AlchemyPropertyKey,
  WeightedAlchemyProperty,
} from '@shared/types/consumable';
import { normalizeWeightedAlchemyProperties } from './alchemyProperties';

interface AlchemyMaterialHintRule {
  property: AlchemyPropertyKey;
  weight: number;
  keywords: readonly string[];
}

const BODY_MATERIAL_HINT_RULES: readonly AlchemyMaterialHintRule[] = [
  {
    property: 'marrow_wash',
    weight: 0.92,
    keywords: ['洗髓', '伐脉', '易筋', '脱胎换骨'],
  },
  {
    property: 'body_skin',
    weight: 0.85,
    keywords: ['皮膜', '筋膜', '护膜', '外皮', '鳞', '甲', '毒瘴', '寒铁砂', '风蚀'],
  },
  {
    property: 'body_sinew_bone',
    weight: 0.9,
    keywords: ['筋骨', '骨髓', '龙骨', '兽骨', '骨粉', '玄铁', '地磁', '重压'],
  },
  {
    property: 'body_organs',
    weight: 0.9,
    keywords: ['脏腑', '五脏', '五气', '真火', '肺腑', '火毒', '内腑'],
  },
  {
    property: 'body_qi_blood',
    weight: 0.9,
    keywords: ['气血', '精血', '血参', '朱果', '血魄', '穴窍', '血晶'],
  },
  {
    property: 'body_primordial_spirit',
    weight: 0.85,
    keywords: ['元神', '神识', '魂晶', '清神', '定魂', '心魔', '夺舍', '识海'],
  },
];

function normalizeSearchText(...parts: Array<string | undefined>): string {
  return parts
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export function inferAlchemyMaterialPropertyHints(input: {
  name: string;
  description?: string;
}): WeightedAlchemyProperty[] {
  const text = normalizeSearchText(input.name, input.description);
  if (!text) {
    return [];
  }

  return BODY_MATERIAL_HINT_RULES.flatMap((rule) =>
    rule.keywords.some((keyword) => text.includes(keyword.toLowerCase()))
      ? [{ key: rule.property, weight: rule.weight }]
      : [],
  );
}

export function mergeAlchemyMaterialPropertyHints(
  vector: AlchemyMaterialPropertyVector,
  material: { name: string; description?: string },
): AlchemyMaterialPropertyVector {
  const hinted = inferAlchemyMaterialPropertyHints(material);
  if (hinted.length === 0) {
    return vector;
  }

  return {
    ...vector,
    properties: normalizeWeightedAlchemyProperties([
      ...vector.properties,
      ...hinted,
    ]).slice(0, 3),
  };
}
