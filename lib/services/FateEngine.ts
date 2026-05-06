import type { Cultivator, PreHeavenFate, SpiritualRoot } from '@/types/cultivator';
import {
  FATE_CANDIDATE_COUNT,
  FATE_SLOT_COUNT,
  getAllFatePolicies,
  getFatePolicyByName,
  getFatePolicyByRegistryKey,
  type FatePolicyDefinition,
} from './FatePolicyRegistry';

export interface FateCreationContext {
  dominantTags: string[];
  suppressedTags: string[];
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

function dedupe(values: Iterable<string | undefined>): string[] {
  const set = new Set<string>();
  for (const value of values) {
    if (!value) continue;
    set.add(value);
  }
  return [...set];
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function resolveDefinition(fate: PreHeavenFate): FatePolicyDefinition | undefined {
  return (
    getFatePolicyByRegistryKey(fate.registryKey) ?? getFatePolicyByName(fate.name)
  );
}

function mergeFate(fate: PreHeavenFate): PreHeavenFate {
  const definition = resolveDefinition(fate);
  if (!definition) {
    return {
      ...fate,
      tags: fate.tags ?? [],
      growthBias: fate.growthBias ?? {},
      worldBias: fate.worldBias ?? {},
      tradeoffs: fate.tradeoffs ?? [],
    };
  }

  return {
    ...definition,
    ...fate,
    registryKey: fate.registryKey ?? definition.registryKey,
    quality: fate.quality ?? definition.quality,
    description: fate.description ?? definition.description,
    tags: fate.tags ?? definition.tags,
    growthBias: {
      ...definition.growthBias,
      ...(fate.growthBias ?? {}),
    },
    worldBias: {
      ...definition.worldBias,
      ...(fate.worldBias ?? {}),
    },
    tradeoffs: fate.tradeoffs ?? definition.tradeoffs,
  };
}

function getMainRoot(spiritualRoots: SpiritualRoot[]): SpiritualRoot | undefined {
  return [...spiritualRoots].sort((left, right) => right.strength - left.strength)[0];
}

function getWeightedCandidates(cultivator: Cultivator): Array<{
  definition: FatePolicyDefinition;
  weight: number;
}> {
  const mainRoot = getMainRoot(cultivator.spiritual_roots ?? []);
  const prompt = `${cultivator.prompt ?? ''} ${cultivator.background ?? ''} ${
    cultivator.origin ?? ''
  } ${cultivator.personality ?? ''}`.toLowerCase();

  return getAllFatePolicies().map((definition) => {
    let weight = 1;

    if (definition.tags.includes('sword') && /剑|剑修|锋/u.test(prompt)) {
      weight += 2;
    }
    if (definition.tags.includes('alchemy') && /丹|医|药|炼丹/u.test(prompt)) {
      weight += 2;
    }
    if (definition.tags.includes('thunder') && /雷|迅|霆/u.test(prompt)) {
      weight += 2;
    }
    if (definition.tags.includes('guard') && /稳|守|厚重/u.test(prompt)) {
      weight += 1.5;
    }
    if (definition.tags.includes('spirit') && /悟|经|神识|推演/u.test(prompt)) {
      weight += 1.5;
    }

    switch (mainRoot?.element) {
      case '金':
        if (definition.tags.includes('sword')) weight += 2;
        break;
      case '木':
        if (definition.tags.includes('alchemy')) weight += 2;
        break;
      case '水':
        if (definition.tags.includes('water')) weight += 2;
        break;
      case '雷':
        if (definition.tags.includes('thunder')) weight += 2.5;
        break;
      case '土':
        if (definition.tags.includes('guard')) weight += 2;
        break;
      default:
        break;
    }

    return {
      definition,
      weight,
    };
  });
}

function weightedPickUnique<T>(
  pool: Array<{ value: T; weight: number }>,
  count: number,
  rng: () => number,
): T[] {
  const working = [...pool];
  const picked: T[] = [];

  while (working.length > 0 && picked.length < count) {
    const totalWeight = working.reduce(
      (sum, entry) => sum + Math.max(entry.weight, 0.01),
      0,
    );
    let roll = rng() * totalWeight;
    let selectedIndex = 0;

    for (let index = 0; index < working.length; index += 1) {
      roll -= Math.max(working[index].weight, 0.01);
      if (roll <= 0) {
        selectedIndex = index;
        break;
      }
    }

    const [selected] = working.splice(selectedIndex, 1);
    picked.push(selected.value);
  }

  return picked;
}

export const FateEngine = {
  normalizeFate(fate: PreHeavenFate): PreHeavenFate {
    return mergeFate(fate);
  },

  normalizeFates(fates: PreHeavenFate[]): PreHeavenFate[] {
    return fates.map((fate) => mergeFate(fate));
  },

  generateCandidatePool(
    cultivator: Cultivator,
    rng: () => number = Math.random,
  ): PreHeavenFate[] {
    const weightedPool = getWeightedCandidates(cultivator).map((entry) => ({
      value: entry.definition,
      weight: entry.weight,
    }));

    return weightedPickUnique(weightedPool, FATE_CANDIDATE_COUNT, rng).map(
      (definition) => mergeFate(definition),
    );
  },

  rerollWholeSet(
    cultivator: Cultivator,
    rng: () => number = Math.random,
  ): PreHeavenFate[] {
    return this.generateCandidatePool(cultivator, rng);
  },

  getSelectedFates(fates: PreHeavenFate[]): PreHeavenFate[] {
    return this.normalizeFates(fates).slice(0, FATE_SLOT_COUNT);
  },

  evaluateCreationContext(fates: PreHeavenFate[]): FateCreationContext {
    const normalized = this.normalizeFates(fates);
    const dominantTags = dedupe(
      normalized.flatMap((fate) => fate.growthBias?.creationTags ?? []),
    );
    const suppressedTags = dedupe(
      normalized.flatMap((fate) =>
        (fate.tradeoffs ?? [])
          .filter((tradeoff) => tradeoff.scope === 'creation')
          .flatMap((tradeoff) => tradeoff.creationTags ?? []),
      ),
    );

    return {
      dominantTags,
      suppressedTags,
      summary: normalized
        .map((fate) => {
          const positive = fate.growthBias?.creationTags?.length
            ? `偏向 ${fate.growthBias.creationTags.join(' / ')}`
            : '偏向未明';
          const negative = (fate.tradeoffs ?? [])
            .filter((tradeoff) => tradeoff.scope === 'creation')
            .map((tradeoff) => tradeoff.description)
            .join('；');
          return negative ? `${fate.name}：${positive}；${negative}` : `${fate.name}：${positive}`;
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
      cultivationExpMultiplier *=
        fate.growthBias?.cultivationExpMultiplier ?? 1;
      insightGainMultiplier *= fate.growthBias?.insightGainMultiplier ?? 1;
      breakthroughChanceBonus +=
        fate.growthBias?.breakthroughChanceBonus ?? 0;

      for (const tradeoff of fate.tradeoffs ?? []) {
        if (tradeoff.scope === 'cultivation' && tradeoff.multiplier) {
          cultivationExpMultiplier *= tradeoff.multiplier;
        }
        if (
          tradeoff.scope === 'breakthrough' &&
          tradeoff.breakthroughChanceBonus
        ) {
          breakthroughChanceBonus += tradeoff.breakthroughChanceBonus;
        }
      }
    }

    return {
      cultivationExpMultiplier: clamp(cultivationExpMultiplier, 0.65, 1.5),
      insightGainMultiplier: clamp(insightGainMultiplier, 0.65, 1.6),
      breakthroughChanceBonus: clamp(breakthroughChanceBonus, -0.12, 0.16),
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
      rewardScoreMultiplier *= fate.worldBias?.rewardScoreMultiplier ?? 1;
      for (const preferredType of fate.worldBias?.preferredRewardTypes ?? []) {
        rewardTypeMultipliers[preferredType] =
          (rewardTypeMultipliers[preferredType] ?? 1) * 1.15;
      }

      for (const tradeoff of fate.tradeoffs ?? []) {
        if (tradeoff.scope !== 'world') continue;
        for (const rewardType of tradeoff.rewardTypes ?? []) {
          rewardTypeMultipliers[rewardType] =
            (rewardTypeMultipliers[rewardType] ?? 1) *
            (tradeoff.multiplier ?? 0.9);
        }
      }
    }

    return {
      encounterHints: dedupe(
        normalized.flatMap((fate) => fate.worldBias?.encounterHints ?? []),
      ),
      rewardTypeMultipliers,
      rewardScoreMultiplier: clamp(rewardScoreMultiplier, 0.75, 1.35),
      summary: normalized
        .map((fate) => {
          const preferred = fate.worldBias?.preferredRewardTypes?.join(' / ');
          const downside = (fate.tradeoffs ?? [])
            .filter((tradeoff) => tradeoff.scope === 'world')
            .map((tradeoff) => tradeoff.description)
            .join('；');
          return `${fate.name}${preferred ? `偏向 ${preferred}` : ''}${
            downside ? `；${downside}` : ''
          }`;
        })
        .join(' | '),
    };
  },
};
