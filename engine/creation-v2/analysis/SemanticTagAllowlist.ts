/*
 * SemanticTagAllowlist: 造物系统允许的语义标签白名单与别名映射。
 * 用于约束 LLM 输出，避免噪声标签进入规则判断链路。
 */
import { CreationTags } from '@/engine/shared/tag-domain';

export const CREATION_SEMANTIC_TAG_ALLOWLIST = [
  CreationTags.MATERIAL.SEMANTIC_FLAME,
  CreationTags.MATERIAL.SEMANTIC_FREEZE,
  CreationTags.MATERIAL.SEMANTIC_THUNDER,
  CreationTags.MATERIAL.SEMANTIC_WIND,
  CreationTags.MATERIAL.SEMANTIC_BLADE,
  CreationTags.MATERIAL.SEMANTIC_GUARD,
  CreationTags.MATERIAL.SEMANTIC_BURST,
  CreationTags.MATERIAL.SEMANTIC_SUSTAIN,
  CreationTags.MATERIAL.SEMANTIC_MANUAL,
  CreationTags.MATERIAL.SEMANTIC_SPIRIT,
  CreationTags.MATERIAL.SEMANTIC_EARTH,
  CreationTags.MATERIAL.SEMANTIC_METAL,
  CreationTags.MATERIAL.SEMANTIC_WATER,
  CreationTags.MATERIAL.SEMANTIC_WOOD,
  CreationTags.MATERIAL.SEMANTIC_POISON,
  CreationTags.MATERIAL.SEMANTIC_DIVINE,
  CreationTags.MATERIAL.SEMANTIC_SPACE,
  CreationTags.MATERIAL.SEMANTIC_TIME,
  CreationTags.MATERIAL.SEMANTIC_LIFE,
] as const;

export type CreationSemanticTag =
  (typeof CREATION_SEMANTIC_TAG_ALLOWLIST)[number];

const SEMANTIC_TAG_ALIAS_MAP: Record<string, CreationSemanticTag> = {
  flame: 'Material.Semantic.Flame',
  fire: 'Material.Semantic.Flame',
  'material.semantic.flame': 'Material.Semantic.Flame',
  '火': 'Material.Semantic.Flame',
  '炎': 'Material.Semantic.Flame',
  freeze: 'Material.Semantic.Freeze',
  ice: 'Material.Semantic.Freeze',
  cold: 'Material.Semantic.Freeze',
  'material.semantic.freeze': 'Material.Semantic.Freeze',
  '冰': 'Material.Semantic.Freeze',
  thunder: 'Material.Semantic.Thunder',
  lightning: 'Material.Semantic.Thunder',
  'material.semantic.thunder': 'Material.Semantic.Thunder',
  '雷': 'Material.Semantic.Thunder',
  wind: 'Material.Semantic.Wind',
  air: 'Material.Semantic.Wind',
  'material.semantic.wind': 'Material.Semantic.Wind',
  '风': 'Material.Semantic.Wind',
  blade: 'Material.Semantic.Blade',
  weapon: 'Material.Semantic.Blade',
  'material.semantic.blade': 'Material.Semantic.Blade',
  '锋': 'Material.Semantic.Blade',
  guard: 'Material.Semantic.Guard',
  shield: 'Material.Semantic.Guard',
  defense: 'Material.Semantic.Guard',
  defensive: 'Material.Semantic.Guard',
  'material.semantic.guard': 'Material.Semantic.Guard',
  '护': 'Material.Semantic.Guard',
  burst: 'Material.Semantic.Burst',
  explosive: 'Material.Semantic.Burst',
  'material.semantic.burst': 'Material.Semantic.Burst',
  '爆': 'Material.Semantic.Burst',
  sustain: 'Material.Semantic.Sustain',
  healing: 'Material.Semantic.Sustain',
  recovery: 'Material.Semantic.Sustain',
  'material.semantic.sustain': 'Material.Semantic.Sustain',
  '养': 'Material.Semantic.Sustain',
  manual: 'Material.Semantic.Manual',
  tome: 'Material.Semantic.Manual',
  scripture: 'Material.Semantic.Manual',
  'material.semantic.manual': 'Material.Semantic.Manual',
  '诀': 'Material.Semantic.Manual',
  spirit: 'Material.Semantic.Spirit',
  soul: 'Material.Semantic.Spirit',
  psyche: 'Material.Semantic.Spirit',
  'material.semantic.spirit': 'Material.Semantic.Spirit',
  '灵': 'Material.Semantic.Spirit',
  earth: 'Material.Semantic.Earth',
  stone: 'Material.Semantic.Earth',
  'material.semantic.earth': 'Material.Semantic.Earth',
  '土': 'Material.Semantic.Earth',
  metal: 'Material.Semantic.Metal',
  steel: 'Material.Semantic.Metal',
  'material.semantic.metal': 'Material.Semantic.Metal',
  '金': 'Material.Semantic.Metal',
  water: 'Material.Semantic.Water',
  aqua: 'Material.Semantic.Water',
  'material.semantic.water': 'Material.Semantic.Water',
  '水': 'Material.Semantic.Water',
  wood: 'Material.Semantic.Wood',
  timber: 'Material.Semantic.Wood',
  'material.semantic.wood': 'Material.Semantic.Wood',
  '木': 'Material.Semantic.Wood',
  poison: 'Material.Semantic.Poison',
  toxic: 'Material.Semantic.Poison',
  venom: 'Material.Semantic.Poison',
  'material.semantic.poison': 'Material.Semantic.Poison',
  '毒': 'Material.Semantic.Poison',
  divine: 'Material.Semantic.Divine',
  holy: 'Material.Semantic.Divine',
  sacred: 'Material.Semantic.Divine',
  'material.semantic.divine': 'Material.Semantic.Divine',
  '圣': 'Material.Semantic.Divine',
  space: 'Material.Semantic.Space',
  spatial: 'Material.Semantic.Space',
  'material.semantic.space': 'Material.Semantic.Space',
  '空': 'Material.Semantic.Space',
  time: 'Material.Semantic.Time',
  temporal: 'Material.Semantic.Time',
  'material.semantic.time': 'Material.Semantic.Time',
  '时': 'Material.Semantic.Time',
  life: 'Material.Semantic.Life',
  vitality: 'Material.Semantic.Life',
  'material.semantic.life': 'Material.Semantic.Life',
  '生': 'Material.Semantic.Life',
};

const SEMANTIC_TAG_ALLOWLIST = new Set<string>(
  CREATION_SEMANTIC_TAG_ALLOWLIST,
);

const SEMANTIC_TAG_TEXT_PATTERNS: Array<{
  tag: CreationSemanticTag;
  pattern: RegExp;
}> = [
  { tag: CreationTags.MATERIAL.SEMANTIC_FLAME, pattern: /火|炎|焰|灼|赤炎/u },
  { tag: CreationTags.MATERIAL.SEMANTIC_FREEZE, pattern: /冰|寒|霜|冻/u },
  { tag: CreationTags.MATERIAL.SEMANTIC_THUNDER, pattern: /雷|霆|电/u },
  { tag: CreationTags.MATERIAL.SEMANTIC_WIND, pattern: /风|岚/u },
  { tag: CreationTags.MATERIAL.SEMANTIC_BLADE, pattern: /锋|刃|剑|枪|铁/u },
  { tag: CreationTags.MATERIAL.SEMANTIC_GUARD, pattern: /守|护|甲|盾/u },
  { tag: CreationTags.MATERIAL.SEMANTIC_BURST, pattern: /爆|烈|怒|狂/u },
  { tag: CreationTags.MATERIAL.SEMANTIC_SUSTAIN, pattern: /生|息|养|愈/u },
  { tag: CreationTags.MATERIAL.SEMANTIC_MANUAL, pattern: /诀|经|录|卷/u },
  { tag: CreationTags.MATERIAL.SEMANTIC_SPIRIT, pattern: /魂|魄|灵/u },
  { tag: CreationTags.MATERIAL.SEMANTIC_EARTH, pattern: /土|石|岳|岩|坤/u },
  { tag: CreationTags.MATERIAL.SEMANTIC_METAL, pattern: /金|钢|铁|锐|铸/u },
  { tag: CreationTags.MATERIAL.SEMANTIC_WATER, pattern: /水|潮|泉|流|澜/u },
  { tag: CreationTags.MATERIAL.SEMANTIC_WOOD, pattern: /木|林|枝|藤|根/u },
  { tag: CreationTags.MATERIAL.SEMANTIC_POISON, pattern: /毒|蚀|腐|瘴|蛊/u },
  { tag: CreationTags.MATERIAL.SEMANTIC_DIVINE, pattern: /圣|神|煌|祈|赐/u },
  { tag: CreationTags.MATERIAL.SEMANTIC_SPACE, pattern: /空|界|域|虚|折/u },
  { tag: CreationTags.MATERIAL.SEMANTIC_TIME, pattern: /时|刻|岁|轮|瞬/u },
  { tag: CreationTags.MATERIAL.SEMANTIC_LIFE, pattern: /生|命|苏|复|萌/u },
];

const MAX_ENRICHMENT_TAGS = 4;

function sanitizeSemanticTagInput(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function normalizeSemanticTag(
  raw: string,
): CreationSemanticTag | null {
  const sanitized = sanitizeSemanticTagInput(raw);
  const aliasMatch = SEMANTIC_TAG_ALIAS_MAP[sanitized];
  if (aliasMatch) {
    return aliasMatch;
  }

  for (const candidate of CREATION_SEMANTIC_TAG_ALLOWLIST) {
    if (candidate.toLowerCase() === sanitized) {
      return candidate;
    }
  }

  return null;
}

export function normalizeSemanticTags(
  rawTags: string[],
  maxCount: number = MAX_ENRICHMENT_TAGS,
): { tags: CreationSemanticTag[]; droppedTags: string[] } {
  const tags: CreationSemanticTag[] = [];
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

export function extractSemanticTagsFromText(sourceText: string): CreationSemanticTag[] {
  return SEMANTIC_TAG_TEXT_PATTERNS.filter(({ pattern }) => pattern.test(sourceText)).map(
    ({ tag }) => tag,
  );
}

export function getCreationSemanticTagAllowlist(): CreationSemanticTag[] {
  return [...CREATION_SEMANTIC_TAG_ALLOWLIST];
}