/*
 * SemanticTagAllowlist: 造物系统允许的语义标签白名单与别名映射。
 * 用于约束 LLM 输出，避免噪声标签进入规则判断链路。
 */
export const CREATION_SEMANTIC_TAG_ALLOWLIST = [
  'Material.Semantic.Flame',
  'Material.Semantic.Freeze',
  'Material.Semantic.Thunder',
  'Material.Semantic.Wind',
  'Material.Semantic.Blade',
  'Material.Semantic.Guard',
  'Material.Semantic.Burst',
  'Material.Semantic.Sustain',
  'Material.Semantic.Manual',
  'Material.Semantic.Spirit',
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
};

const SEMANTIC_TAG_ALLOWLIST = new Set<string>(
  CREATION_SEMANTIC_TAG_ALLOWLIST,
);

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

export function getCreationSemanticTagAllowlist(): CreationSemanticTag[] {
  return [...CREATION_SEMANTIC_TAG_ALLOWLIST];
}