/*
 * SemanticTagAllowlist: 造物系统允许的语义标签白名单与别名映射。
 * 用于约束 LLM 输出，避免噪声标签进入规则判断链路。
 */
import {
  CREATION_MATERIAL_SEMANTIC_TAGS,
  CreationTags,
} from '@/engine/shared/tag-domain';
import type { CreationMaterialSemanticTag } from '@/engine/shared/tag-domain';

function sanitizeSemanticTagInput(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').toLowerCase();
}

const SEMANTIC_TAG_ALIASES: Record<CreationMaterialSemanticTag, readonly string[]> = {
  [CreationTags.MATERIAL.SEMANTIC_FLAME]: [
    'flame',
    'fire',
    'material.semantic.flame',
    '火',
    '炎',
  ],
  [CreationTags.MATERIAL.SEMANTIC_FREEZE]: [
    'freeze',
    'ice',
    'cold',
    'material.semantic.freeze',
    '冰',
  ],
  [CreationTags.MATERIAL.SEMANTIC_THUNDER]: [
    'thunder',
    'lightning',
    'material.semantic.thunder',
    '雷',
  ],
  [CreationTags.MATERIAL.SEMANTIC_WIND]: [
    'wind',
    'air',
    'material.semantic.wind',
    '风',
  ],
  [CreationTags.MATERIAL.SEMANTIC_BLADE]: [
    'blade',
    'weapon',
    'material.semantic.blade',
    '锋',
  ],
  [CreationTags.MATERIAL.SEMANTIC_GUARD]: [
    'guard',
    'shield',
    'defense',
    'defensive',
    'material.semantic.guard',
    '护',
  ],
  [CreationTags.MATERIAL.SEMANTIC_BURST]: [
    'burst',
    'explosive',
    'material.semantic.burst',
    '爆',
  ],
  [CreationTags.MATERIAL.SEMANTIC_SUSTAIN]: [
    'sustain',
    'healing',
    'recovery',
    'material.semantic.sustain',
    '养',
  ],
  [CreationTags.MATERIAL.SEMANTIC_MANUAL]: [
    'manual',
    'tome',
    'scripture',
    'material.semantic.manual',
    '诀',
  ],
  [CreationTags.MATERIAL.SEMANTIC_SPIRIT]: [
    'spirit',
    'soul',
    'psyche',
    'material.semantic.spirit',
    '灵',
  ],
  [CreationTags.MATERIAL.SEMANTIC_EARTH]: [
    'earth',
    'stone',
    'material.semantic.earth',
    '土',
  ],
  [CreationTags.MATERIAL.SEMANTIC_METAL]: [
    'metal',
    'steel',
    'material.semantic.metal',
    '金',
  ],
  [CreationTags.MATERIAL.SEMANTIC_WATER]: [
    'water',
    'aqua',
    'material.semantic.water',
    '水',
  ],
  [CreationTags.MATERIAL.SEMANTIC_WOOD]: [
    'wood',
    'timber',
    'material.semantic.wood',
    '木',
  ],
  [CreationTags.MATERIAL.SEMANTIC_POISON]: [
    'poison',
    'toxic',
    'venom',
    'material.semantic.poison',
    '毒',
  ],
  [CreationTags.MATERIAL.SEMANTIC_DIVINE]: [
    'divine',
    'holy',
    'sacred',
    'material.semantic.divine',
    '圣',
  ],
  [CreationTags.MATERIAL.SEMANTIC_SPACE]: [
    'space',
    'spatial',
    'material.semantic.space',
    '空',
  ],
  [CreationTags.MATERIAL.SEMANTIC_TIME]: [
    'time',
    'temporal',
    'material.semantic.time',
    '时',
  ],
  [CreationTags.MATERIAL.SEMANTIC_LIFE]: [
    'life',
    'vitality',
    'material.semantic.life',
    '生',
  ],
};

const SEMANTIC_TAG_ALIAS_MAP = Object.fromEntries(
  Object.entries(SEMANTIC_TAG_ALIASES).flatMap(([tag, aliases]) =>
    aliases.map((alias) => [sanitizeSemanticTagInput(alias), tag]),
  ),
) as Record<string, CreationMaterialSemanticTag>;

const SEMANTIC_TAG_ALLOWLIST = new Set<string>(
  CREATION_MATERIAL_SEMANTIC_TAGS,
);

const SEMANTIC_TAG_TEXT_PATTERN_MAP: Record<CreationMaterialSemanticTag, RegExp> = {
  [CreationTags.MATERIAL.SEMANTIC_FLAME]: /火|炎|焰|灼|赤炎/u,
  [CreationTags.MATERIAL.SEMANTIC_FREEZE]: /冰|寒|霜|冻/u,
  [CreationTags.MATERIAL.SEMANTIC_THUNDER]: /雷|霆|电/u,
  [CreationTags.MATERIAL.SEMANTIC_WIND]: /风|岚/u,
  [CreationTags.MATERIAL.SEMANTIC_BLADE]: /锋|刃|剑|枪|铁/u,
  [CreationTags.MATERIAL.SEMANTIC_GUARD]: /守|护|甲|盾/u,
  [CreationTags.MATERIAL.SEMANTIC_BURST]: /爆|烈|怒|狂/u,
  [CreationTags.MATERIAL.SEMANTIC_SUSTAIN]: /生|息|养|愈/u,
  [CreationTags.MATERIAL.SEMANTIC_MANUAL]: /诀|经|录|卷/u,
  [CreationTags.MATERIAL.SEMANTIC_SPIRIT]: /魂|魄|灵/u,
  [CreationTags.MATERIAL.SEMANTIC_EARTH]: /土|石|岳|岩|坤/u,
  [CreationTags.MATERIAL.SEMANTIC_METAL]: /金|钢|铁|锐|铸/u,
  [CreationTags.MATERIAL.SEMANTIC_WATER]: /水|潮|泉|流|澜/u,
  [CreationTags.MATERIAL.SEMANTIC_WOOD]: /木|林|枝|藤|根/u,
  [CreationTags.MATERIAL.SEMANTIC_POISON]: /毒|蚀|腐|瘴|蛊/u,
  [CreationTags.MATERIAL.SEMANTIC_DIVINE]: /圣|神|煌|祈|赐/u,
  [CreationTags.MATERIAL.SEMANTIC_SPACE]: /空|界|域|虚|折/u,
  [CreationTags.MATERIAL.SEMANTIC_TIME]: /时|刻|岁|轮|瞬/u,
  [CreationTags.MATERIAL.SEMANTIC_LIFE]: /生|命|苏|复|萌/u,
};

const SEMANTIC_TAG_TEXT_PATTERNS = CREATION_MATERIAL_SEMANTIC_TAGS.map((tag) => ({
  tag,
  pattern: SEMANTIC_TAG_TEXT_PATTERN_MAP[tag],
}));

const MAX_ENRICHMENT_TAGS = 4;

export function normalizeSemanticTag(
  raw: string,
): CreationMaterialSemanticTag | null {
  const sanitized = sanitizeSemanticTagInput(raw);
  const aliasMatch = SEMANTIC_TAG_ALIAS_MAP[sanitized];
  if (aliasMatch) {
    return aliasMatch;
  }

  for (const candidate of CREATION_MATERIAL_SEMANTIC_TAGS) {
    if (candidate.toLowerCase() === sanitized) {
      return candidate;
    }
  }

  return null;
}

export function normalizeSemanticTags(
  rawTags: string[],
  maxCount: number = MAX_ENRICHMENT_TAGS,
): { tags: CreationMaterialSemanticTag[]; droppedTags: string[] } {
  const tags: CreationMaterialSemanticTag[] = [];
  const droppedTags: string[] = [];
  const seen = new Set<string>();

  for (const rawTag of rawTags) {
    const normalized = normalizeSemanticTag(rawTag);
    if (!normalized) {
      droppedTags.push(rawTag);
      continue;
    }
    if (!SEMANTIC_TAG_ALLOWLIST.has(normalized) || seen.has(normalized)) {
      if (seen.has(normalized)) {
        droppedTags.push(rawTag);
      }
      continue;
    }
    seen.add(normalized);
    tags.push(normalized);
    if (tags.length >= maxCount) {
      break;
    }
  }

  if (rawTags.length > maxCount) {
    droppedTags.push(...rawTags.slice(maxCount));
  }

  return { tags, droppedTags };
}

export function extractSemanticTagsFromText(sourceText: string): CreationMaterialSemanticTag[] {
  return SEMANTIC_TAG_TEXT_PATTERNS.filter(({ pattern }) => pattern.test(sourceText)).map(
    ({ tag }) => tag,
  );
}

export function getCreationMaterialSemanticTagAllowlist(): CreationMaterialSemanticTag[] {
  return [...CREATION_MATERIAL_SEMANTIC_TAGS];
}