import { createHash } from 'node:crypto';

import { CreationTags } from '@shared/engine/shared/tag-domain';
import type {
  Cultivator,
  FateEffectEntry,
  PreHeavenFate,
  SpiritualRoot,
} from '@shared/types/cultivator';
import type { Quality } from '@shared/types/constants';
import { QUALITY_ORDER } from '@shared/types/constants';
import {
  FATE_CANDIDATE_COUNT,
  FATE_CANDIDATE_QUALITY_SLOTS,
  FATE_QUALITY_ORDER,
  FATE_QUALITY_TEMPLATES,
  FATE_SLOT_COUNT,
} from './FateConfig';
import {
  buildFateEffectEntry,
  buildLocalFateDescription,
  buildLocalFateName,
  type FateCoreFragmentDefinition,
  type FateEffectFragmentDefinition,
  type FateRollStrategy,
  formatFateTagLabel,
  getAllFateCores,
  getFateBoonFragments,
  getFateBurdenFragments,
  getFateRareFragments,
  isQualityAllowed,
  summarizeFateAura,
} from './FateFragmentRegistry';
import { FateNamingEnricher } from './FateNamingEnricher';

export interface FateTagBias {
  tag: string;
  weight: number;
}

export interface FateCreationContext {
  positiveTagBiases: FateTagBias[];
  negativeTagBiases: FateTagBias[];
  summary: string;
}

export interface FateGrowthContext {
  cultivationExpMultiplier: number;
  insightGainMultiplier: number;
  breakthroughChanceBonus: number;
  summary: string;
}

export interface FateWorldContext {
  encounterHints: string[];
  rewardTypeMultipliers: Record<string, number>;
  rewardScoreMultiplier: number;
  summary: string;
}

interface FateGenerationOptions {
  rng?: () => number;
  strategy?: FateRollStrategy;
}

const DEFAULT_ROLL_STRATEGY: FateRollStrategy = 'root_restricted';
const DEFAULT_NAMER = new FateNamingEnricher();

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function dedupe<T>(values: Iterable<T>): T[] {
  return [...new Set(values)];
}

function normalizeGenerationOptions(
  optionsOrRng?: FateGenerationOptions | (() => number),
): Required<FateGenerationOptions> {
  if (typeof optionsOrRng === 'function') {
    return {
      rng: optionsOrRng,
      strategy: DEFAULT_ROLL_STRATEGY,
    };
  }

  return {
    rng: optionsOrRng?.rng ?? Math.random,
    strategy: optionsOrRng?.strategy ?? DEFAULT_ROLL_STRATEGY,
  };
}

function getSortedRoots(spiritualRoots: SpiritualRoot[]): SpiritualRoot[] {
  return [...spiritualRoots].sort((left, right) => right.strength - left.strength);
}

function buildPromptText(cultivator: Cultivator): string {
  return [
    cultivator.prompt,
    cultivator.background,
    cultivator.origin,
    cultivator.personality,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function keywordHitCount(prompt: string, keywords: string[] = []): number {
  return keywords.reduce(
    (sum, keyword) => sum + (prompt.includes(keyword.toLowerCase()) ? 1 : 0),
    0,
  );
}

function elementAffinityScore(element: SpiritualRoot['element'], tags: string[]): number {
  switch (element) {
    case '金':
      return tags.some(
        (tag) =>
          tag === CreationTags.MATERIAL.SEMANTIC_BLADE ||
          tag === CreationTags.MATERIAL.SEMANTIC_METAL,
      )
        ? 0.95
        : 0;
    case '木':
      return tags.some(
        (tag) =>
          tag === CreationTags.MATERIAL.SEMANTIC_ALCHEMY ||
          tag === CreationTags.MATERIAL.SEMANTIC_WOOD ||
          tag === CreationTags.MATERIAL.SEMANTIC_SUSTAIN,
      )
        ? 0.95
        : 0;
    case '水':
      return tags.some(
        (tag) =>
          tag === CreationTags.MATERIAL.SEMANTIC_WATER ||
          tag === CreationTags.MATERIAL.SEMANTIC_SUSTAIN,
      )
        ? 0.85
        : 0;
    case '土':
      return tags.some(
        (tag) =>
          tag === CreationTags.MATERIAL.SEMANTIC_EARTH ||
          tag === CreationTags.MATERIAL.SEMANTIC_GUARD,
      )
        ? 0.9
        : 0;
    case '雷':
      return tags.some(
        (tag) =>
          tag === CreationTags.MATERIAL.SEMANTIC_THUNDER ||
          tag === CreationTags.MATERIAL.SEMANTIC_BURST,
      )
        ? 1
        : 0;
    case '风':
      return tags.some(
        (tag) =>
          tag === CreationTags.MATERIAL.SEMANTIC_WIND ||
          tag === CreationTags.MATERIAL.SEMANTIC_ILLUSION,
      )
        ? 0.9
        : 0;
    default:
      return 0;
  }
}

function weightedPickOne<T>(
  pool: Array<{ value: T; weight: number }>,
  rng: () => number,
): T | null {
  if (pool.length === 0) return null;

  const totalWeight = pool.reduce(
    (sum, entry) => sum + Math.max(entry.weight, 0.01),
    0,
  );
  let roll = rng() * totalWeight;
  for (const entry of pool) {
    roll -= Math.max(entry.weight, 0.01);
    if (roll <= 0) {
      return entry.value;
    }
  }
  return pool[pool.length - 1]?.value ?? null;
}

function createCompositionHash(
  quality: Quality,
  core: FateCoreFragmentDefinition,
  fragments: FateEffectFragmentDefinition[],
): string {
  return createHash('sha1')
    .update(
      JSON.stringify({
        quality,
        core: core.id,
        fragments: [...fragments.map((fragment) => fragment.id)].sort(),
      }),
    )
    .digest('hex')
    .slice(0, 12);
}

function isCoreEligible(
  core: FateCoreFragmentDefinition,
  roots: SpiritualRoot[],
  strategy: FateRollStrategy,
): boolean {
  if (strategy === 'fully_random') {
    return true;
  }

  const elements = new Set(roots.map((root) => root.element));

  if (core.requiredRoots?.anyOf.length) {
    const hasRequired = core.requiredRoots.anyOf.some((root) =>
      elements.has(root),
    );
    if (!hasRequired) {
      return false;
    }
  }

  if (core.forbiddenRoots?.some((root) => elements.has(root))) {
    return false;
  }

  return true;
}

function scoreCore(
  core: FateCoreFragmentDefinition,
  cultivator: Cultivator,
  roots: SpiritualRoot[],
): number {
  const prompt = buildPromptText(cultivator);
  const mainRoot = roots[0];
  return (
    core.weight +
    keywordHitCount(prompt, core.keywords) * 0.45 +
    (mainRoot ? elementAffinityScore(mainRoot.element, core.tags) : 0) +
    roots
      .slice(1)
      .reduce(
        (sum, root) => sum + elementAffinityScore(root.element, core.tags) * 0.45,
        0,
      )
  );
}

function scoreFragment(
  fragment: FateEffectFragmentDefinition,
  core: FateCoreFragmentDefinition,
  cultivator: Cultivator,
  roots: SpiritualRoot[],
): number {
  const prompt = buildPromptText(cultivator);
  const tagOverlap = fragment.tags.filter((tag) => core.tags.includes(tag)).length;
  const rootBonus = roots.reduce(
    (sum, root, index) =>
      sum +
      elementAffinityScore(root.element, fragment.tags) * (index === 0 ? 0.6 : 0.25),
    0,
  );

  return (
    fragment.weight +
    tagOverlap * 0.7 +
    keywordHitCount(prompt, fragment.keywords) * 0.3 +
    rootBonus
  );
}

function pickFragments(
  fragments: FateEffectFragmentDefinition[],
  count: number,
  rng: () => number,
): FateEffectFragmentDefinition[] | null {
  if (count === 0) return [];
  const working = [...fragments];
  const picked: FateEffectFragmentDefinition[] = [];
  const usedExclusiveGroups = new Set<string>();

  while (working.length > 0 && picked.length < count) {
    const candidate = weightedPickOne(
      working.map((fragment) => ({
        value: fragment,
        weight: fragment.weight,
      })),
      rng,
    );
    if (!candidate) break;

    const candidateIndex = working.findIndex((fragment) => fragment.id === candidate.id);
    if (candidateIndex < 0) break;

    working.splice(candidateIndex, 1);
    if (
      candidate.exclusiveGroup &&
      usedExclusiveGroups.has(candidate.exclusiveGroup)
    ) {
      continue;
    }

    picked.push(candidate);
    if (candidate.exclusiveGroup) {
      usedExclusiveGroups.add(candidate.exclusiveGroup);
    }
  }

  return picked.length === count ? picked : null;
}

function summarizeEffects(effects: FateEffectEntry[]): string {
  const positives = effects
    .filter((effect) => effect.polarity === 'boon')
    .slice(0, 2)
    .map((effect) => effect.label);
  const negatives = effects
    .filter((effect) => effect.polarity === 'burden')
    .slice(0, 2)
    .map((effect) => effect.label);

  return [
    positives.length > 0 ? `顺势：${positives.join('，')}` : undefined,
    negatives.length > 0 ? `代价：${negatives.join('，')}` : undefined,
  ]
    .filter(Boolean)
    .join('；');
}

function composeCandidate(
  cultivator: Cultivator,
  quality: Quality,
  strategy: FateRollStrategy,
  rng: () => number,
  usedHashes: Set<string>,
): PreHeavenFate | null {
  const qualityTemplate = FATE_QUALITY_TEMPLATES[quality];
  const roots = getSortedRoots(cultivator.spiritual_roots ?? []);
  const corePool = getAllFateCores()
    .filter((core) => isCoreEligible(core, roots, strategy))
    .map((core) => ({
      value: core,
      weight: scoreCore(core, cultivator, roots),
    }));

  if (corePool.length === 0) {
    return null;
  }

  for (let attempt = 0; attempt < 48; attempt += 1) {
    const core = weightedPickOne(corePool, rng);
    if (!core) return null;

    const boonPool = getFateBoonFragments()
      .filter(
        (fragment) =>
          isQualityAllowed(fragment, quality) &&
          core.primaryScopes.includes(fragment.scope),
      )
      .map((fragment) => ({
        ...fragment,
        weight: scoreFragment(fragment, core, cultivator, roots),
      }));

    const burdenPool = getFateBurdenFragments()
      .filter(
        (fragment) =>
          isQualityAllowed(fragment, quality) &&
          [...core.primaryScopes, ...core.secondaryScopes].includes(
            fragment.scope,
          ),
      )
      .map((fragment) => ({
        ...fragment,
        weight: scoreFragment(fragment, core, cultivator, roots),
      }));

    const rarePool = getFateRareFragments()
      .filter(
        (fragment) =>
          isQualityAllowed(fragment, quality) &&
          core.primaryScopes.includes(fragment.scope),
      )
      .map((fragment) => ({
        ...fragment,
        weight: scoreFragment(fragment, core, cultivator, roots) + 0.25,
      }));

    const boons = pickFragments(boonPool, qualityTemplate.boonCount, rng);
    const burdens = pickFragments(burdenPool, qualityTemplate.burdenCount, rng);
    if (!boons || !burdens) {
      continue;
    }

    const rares =
      qualityTemplate.rareCount > 0
        ? pickFragments(rarePool, qualityTemplate.rareCount, rng)
        : [];

    if (!rares && !qualityTemplate.rareOptional && qualityTemplate.rareCount > 0) {
      continue;
    }

    const fragments = [...boons, ...burdens, ...(rares ?? [])];
    const compositionHash = createCompositionHash(quality, core, fragments);
    if (usedHashes.has(compositionHash)) {
      continue;
    }

    const effects = fragments.map((fragment, index) =>
      buildFateEffectEntry(fragment, quality, index),
    );
    const tags = dedupe([...core.tags, ...effects.flatMap((effect) => effect.tags ?? [])]);
    const fallbackName = buildLocalFateName(core, quality);
    const fallbackDescription = buildLocalFateDescription(core, effects);

    usedHashes.add(compositionHash);

    return {
      name: fallbackName,
      quality,
      description: fallbackDescription,
      tags,
      effects,
      generationModel: {
        version: 'v2',
        quality,
        fragmentIds: [core.id, ...fragments.map((fragment) => fragment.id)],
        compositionHash,
        primaryDomains: core.primaryScopes,
        qualityTemplateId: qualityTemplate.id,
        coreKey: core.id,
        rollStrategy: strategy,
      },
      namingMetadata: {
        status: 'fallback',
        originalName: fallbackName,
      },
    };
  }

  return null;
}

function pickTargetQuality(
  candidates: Quality[],
  rng: () => number,
): Quality | null {
  return weightedPickOne(
    candidates.map((quality) => ({
      value: quality,
      weight: QUALITY_ORDER[quality] + 1,
    })),
    rng,
  );
}

function qualityFallbackChain(
  target: Quality,
  slotQualities: Quality[],
): Quality[] {
  return FATE_QUALITY_ORDER.filter(
    (quality) =>
      QUALITY_ORDER[quality] <= QUALITY_ORDER[target] &&
      slotQualities.includes(quality),
  ).sort((left, right) => QUALITY_ORDER[right] - QUALITY_ORDER[left]);
}

async function enrichFateNames(
  cultivator: Cultivator,
  fates: PreHeavenFate[],
): Promise<PreHeavenFate[]> {
  const normalized = fates.map((fate) => FateEngine.normalizeFate(fate));
  const rootElements = getSortedRoots(cultivator.spiritual_roots ?? [])
    .slice(0, 2)
    .map((root) => root.element);
  const coreDefinitions = new Map(
    getAllFateCores().map((core) => [core.id, core]),
  );

  const facts = normalized.map((fate) => {
    const coreId = fate.generationModel?.coreKey;
    const core = coreId ? coreDefinitions.get(coreId) : undefined;
    return {
      quality: fate.quality ?? '凡品',
      coreLabel: core?.label ?? '命格未明',
      auraSummary: core ? summarizeFateAura(core, fate.effects ?? []) : summarizeEffects(fate.effects ?? []),
      tags: (fate.tags ?? []).map((tag) => formatFateTagLabel(tag)),
      mainRoots: rootElements,
      effectLines: (fate.effects ?? []).map((effect) => effect.label),
      fallbackName: fate.name,
      fallbackDescription: fate.description ?? '',
    };
  });

  const enrichments = await DEFAULT_NAMER.enrichBatch(facts);
  if (!enrichments) {
    return normalized;
  }

  return normalized.map((fate, index) => {
    const enrichment = enrichments[index];
    if (!enrichment) return fate;
    return {
      ...fate,
      name: enrichment.name,
      description: enrichment.description,
      namingMetadata: {
        status: 'success',
        originalName: fate.name,
        provider: 'deepseek',
        styleInsight: enrichment.styleInsight,
      },
    };
  });
}

export const FateEngine = {
  normalizeFate(fate: PreHeavenFate): PreHeavenFate {
    return {
      ...fate,
      tags: fate.tags ?? [],
      effects: fate.effects ?? [],
    };
  },

  normalizeFates(fates: PreHeavenFate[]): PreHeavenFate[] {
    return fates.map((fate) => this.normalizeFate(fate));
  },

  async generateCandidatePool(
    cultivator: Cultivator,
    optionsOrRng?: FateGenerationOptions | (() => number),
  ): Promise<PreHeavenFate[]> {
    const { rng, strategy } = normalizeGenerationOptions(optionsOrRng);
    const usedHashes = new Set<string>();
    const generated: PreHeavenFate[] = [];

    for (const slotQualities of FATE_CANDIDATE_QUALITY_SLOTS) {
      const targetQuality = pickTargetQuality(slotQualities, rng);
      const fallbackQualities = targetQuality
        ? qualityFallbackChain(targetQuality, slotQualities)
        : [...slotQualities].sort(
            (left, right) => QUALITY_ORDER[right] - QUALITY_ORDER[left],
          );

      let candidate: PreHeavenFate | null = null;
      for (const quality of fallbackQualities) {
        candidate = composeCandidate(
          cultivator,
          quality,
          strategy,
          rng,
          usedHashes,
        );
        if (candidate) {
          break;
        }
      }

      if (candidate) {
        generated.push(candidate);
      }
    }

    if (generated.length < FATE_CANDIDATE_COUNT) {
      for (const quality of [...FATE_QUALITY_ORDER].reverse()) {
        if (generated.length >= FATE_CANDIDATE_COUNT) break;
        const candidate = composeCandidate(
          cultivator,
          quality,
          strategy,
          rng,
          usedHashes,
        );
        if (candidate) {
          generated.push(candidate);
        }
      }
    }

    return enrichFateNames(cultivator, generated);
  },

  async rerollWholeSet(
    cultivator: Cultivator,
    optionsOrRng?: FateGenerationOptions | (() => number),
  ): Promise<PreHeavenFate[]> {
    return this.generateCandidatePool(cultivator, optionsOrRng);
  },

  getSelectedFates(fates: PreHeavenFate[]): PreHeavenFate[] {
    return this.normalizeFates(fates).slice(0, FATE_SLOT_COUNT);
  },

  evaluateCreationContext(fates: PreHeavenFate[]): FateCreationContext {
    const positiveBiasMap = new Map<string, number>();
    const negativeBiasMap = new Map<string, number>();
    const normalized = this.normalizeFates(fates);

    for (const fate of normalized) {
      for (const effect of fate.effects ?? []) {
        if (effect.effectType !== 'creation_tag_bias') continue;
        const targetMap =
          effect.polarity === 'boon' ? positiveBiasMap : negativeBiasMap;
        for (const tag of effect.tags ?? []) {
          targetMap.set(tag, (targetMap.get(tag) ?? 0) + effect.value);
        }
      }
    }

    return {
      positiveTagBiases: [...positiveBiasMap.entries()]
        .map(([tag, weight]) => ({ tag, weight }))
        .sort((left, right) => right.weight - left.weight),
      negativeTagBiases: [...negativeBiasMap.entries()]
        .map(([tag, weight]) => ({ tag, weight }))
        .sort((left, right) => right.weight - left.weight),
      summary: normalized
        .map((fate) => {
          const summary = summarizeEffects(fate.effects ?? []);
          return summary ? `${fate.name}：${summary}` : fate.name;
        })
        .join(' | '),
    };
  },

  evaluateGrowthContext(fates: PreHeavenFate[]): FateGrowthContext {
    const normalized = this.normalizeFates(fates);
    let cultivationExpMultiplier = 1;
    let insightGainMultiplier = 1;
    let breakthroughChanceBonus = 0;

    for (const fate of normalized) {
      for (const effect of fate.effects ?? []) {
        if (effect.effectType === 'cultivation_exp_multiplier') {
          cultivationExpMultiplier *= effect.value;
        }
        if (effect.effectType === 'insight_gain_multiplier') {
          insightGainMultiplier *= effect.value;
        }
        if (effect.effectType === 'breakthrough_bonus') {
          breakthroughChanceBonus += effect.value;
        }
      }
    }

    return {
      cultivationExpMultiplier: clamp(cultivationExpMultiplier, 0.45, 2),
      insightGainMultiplier: clamp(insightGainMultiplier, 0.45, 2.2),
      breakthroughChanceBonus: clamp(breakthroughChanceBonus, -0.25, 0.25),
      summary: normalized
        .map((fate) => `${fate.name}(${fate.description ?? '无描述'})`)
        .join(' | '),
    };
  },

  evaluateWorldContext(fates: PreHeavenFate[]): FateWorldContext {
    const normalized = this.normalizeFates(fates);
    const rewardTypeMultipliers: Record<string, number> = {};
    let rewardScoreMultiplier = 1;

    for (const fate of normalized) {
      for (const effect of fate.effects ?? []) {
        if (effect.effectType === 'reward_score_multiplier') {
          rewardScoreMultiplier *= effect.value;
        }
        if (effect.effectType === 'reward_type_bias') {
          for (const rewardType of effect.rewardTypes ?? []) {
            rewardTypeMultipliers[rewardType] =
              (rewardTypeMultipliers[rewardType] ?? 1) * effect.value;
          }
        }
      }
    }

    return {
      encounterHints: dedupe(
        normalized.flatMap((fate) =>
          (fate.effects ?? [])
            .filter((effect) => effect.effectType === 'encounter_hint')
            .map((effect) => effect.label.replace(/^更易牵动「|」机缘$/g, '')),
        ),
      ),
      rewardTypeMultipliers,
      rewardScoreMultiplier: clamp(rewardScoreMultiplier, 0.55, 1.9),
      summary: normalized
        .map((fate) => {
          const worldEffects = (fate.effects ?? [])
            .filter(
              (effect) =>
                effect.scope === 'world' || effect.scope === 'breakthrough',
            )
            .slice(0, 3)
            .map((effect) => effect.label)
            .join('；');
          return worldEffects ? `${fate.name}：${worldEffects}` : fate.name;
        })
        .join(' | '),
    };
  },
};
