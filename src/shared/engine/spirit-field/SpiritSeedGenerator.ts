import { renderPromptSystem, renderPromptUser } from '@server/lib/prompts';
import { generateAiArray } from '@server/utils/aiClient';
import { CREATION_MATERIAL_SEMANTIC_TAGS, CreationTags } from '@shared/engine/shared/tag-domain';
import { ELEMENT_VALUES, QUALITY_VALUES, type ElementType, type Quality } from '@shared/types/constants';
import type { Material } from '@shared/types/cultivator';
import { z } from 'zod';
import { SPIRIT_SEED_QUALITY_CHANCE_MAP, getSpiritFieldQualityBalance } from './config';
import { buildSpiritFieldSeedMaterialFromPlant } from './seedMaterial';
import { SPIRIT_FIELD_CULTIVATION_METHODS, SPIRIT_FIELD_OUTCOME_KINDS, SPIRIT_SEED_GROWTH_FORMS, SPIRIT_SEED_GROWTH_TRAITS, SPIRIT_SEED_HABITAT_TAGS, SPIRIT_SEED_HARVEST_PARTS, SPIRIT_SEED_USE_TAGS, type SpiritFieldPlantSnapshot, type SpiritSeedIdentity, type SpiritSeedRandomOptions, type SpiritSeedSkeleton } from './types';

const SpiritSeedAISchema = z.object({
  seedName: z.string().trim().min(2).max(12),
  seedDescription: z.string().trim().min(12).max(100),
  clueTexts: z.array(z.string().trim().min(6).max(48)).min(2).max(3),
  element: z.enum(ELEMENT_VALUES),
  growthForm: z.enum(SPIRIT_SEED_GROWTH_FORMS),
  harvestPart: z.enum(SPIRIT_SEED_HARVEST_PARTS),
  preferredMethods: z.array(z.enum(SPIRIT_FIELD_CULTIVATION_METHODS)).min(2).max(6),
  avoidedMethods: z.array(z.enum(SPIRIT_FIELD_CULTIVATION_METHODS)).max(4),
  preferredHabitats: z.array(z.enum(SPIRIT_SEED_HABITAT_TAGS)).min(1).max(3),
  avoidedHabitats: z.array(z.enum(SPIRIT_SEED_HABITAT_TAGS)).max(2),
  growthTraits: z.array(z.enum(SPIRIT_SEED_GROWTH_TRAITS)).min(1).max(4),
  useTags: z.array(z.enum(SPIRIT_SEED_USE_TAGS)).min(1).max(4),
  outcomeBiases: z.array(z.enum(SPIRIT_FIELD_OUTCOME_KINDS)).min(1).max(3),
  creationTags: z.array(z.enum(CREATION_MATERIAL_SEMANTIC_TAGS)).min(1).max(5),
}).strict();

export interface SpiritSeedBatchSpec { rank: Quality; quantity: number; element?: ElementType; regionTags?: string[] }

function pickWeightedQuality(options: SpiritSeedRandomOptions, rng: () => number): Quality {
  if (options.guaranteedRank) return options.guaranteedRank;
  const min = options.rankRange ? QUALITY_VALUES.indexOf(options.rankRange.min) : 0;
  const max = options.rankRange ? QUALITY_VALUES.indexOf(options.rankRange.max) : QUALITY_VALUES.length - 1;
  const candidates = QUALITY_VALUES.slice(Math.min(min, max), Math.max(min, max) + 1);
  const weights = options.qualityChanceMap ?? SPIRIT_SEED_QUALITY_CHANCE_MAP;
  const total = candidates.reduce((sum, quality) => sum + Math.max(0, weights[quality]), 0);
  let cursor = rng() * total;
  for (const quality of candidates) { cursor -= Math.max(0, weights[quality]); if (cursor <= 0) return quality; }
  return candidates[candidates.length - 1] ?? '凡品';
}

function requestList(skeletons: SpiritSeedSkeleton[]): string { return skeletons.map((item, index) => `${index + 1}. 品质=${item.rank}；元素=${item.forcedElement ?? '自选'}；地域=${item.regionTags?.join('、') || '无'}`).join('\n'); }
function fallbackIdentity(skeleton: SpiritSeedSkeleton, index: number): SpiritSeedIdentity {
  const element = skeleton.forcedElement ?? ELEMENT_VALUES[index % ELEMENT_VALUES.length] ?? '木';
  return {
    seedName: `${element}纹眠籽`,
    seedDescription: `灰青种壳上浮着一线${element}行微光，握在掌中时灵机时隐时现。`,
    clueTexts: ['种壳遇到温和灵机时会轻轻发热', '其内生机不喜骤然催逼，似宜循序培护'],
    element, growthForm: 'herb', harvestPart: 'leaf',
    preferredMethods: ['seasonal_nurture', 'intrinsic_infusion', 'natural_form'],
    avoidedMethods: ['monster_blood'], preferredHabitats: ['mountain'], avoidedHabitats: [],
    growthTraits: ['qi-sensitive'], useTags: ['alchemy'], outcomeBiases: ['herb'],
    creationTags: [CreationTags.MATERIAL.SEMANTIC_WOOD, CreationTags.MATERIAL.SEMANTIC_ALCHEMY],
  };
}

function normalizeIdentityClues(
  identity: SpiritSeedIdentity,
  fallback: SpiritSeedIdentity,
): SpiritSeedIdentity {
  const hiddenTokens = [
    ...identity.preferredMethods,
    ...identity.avoidedMethods,
    ...identity.preferredHabitats,
    ...identity.avoidedHabitats,
    ...identity.growthTraits,
    ...identity.useTags,
    ...identity.outcomeBiases,
    ...identity.creationTags,
  ];
  const clueTexts = identity.clueTexts.filter(
    (clue) =>
      !hiddenTokens.some((token) => clue.includes(token)) &&
      !/偏好|忌讳|内部(?:规则|标签)|产物倾向|概率|分数|评分/.test(clue),
  );
  const avoidedMethods = identity.avoidedMethods.filter(
    (method) => !identity.preferredMethods.includes(method),
  );
  const seedDescription =
    hiddenTokens.some((token) => identity.seedDescription.includes(token)) ||
    /偏好|忌讳|内部(?:规则|标签)|产物倾向|概率|分数|评分/.test(
      identity.seedDescription,
    )
      ? fallback.seedDescription
      : identity.seedDescription;
  return {
    ...identity,
    seedDescription,
    clueTexts: clueTexts.length >= 2 ? clueTexts.slice(0, 3) : fallback.clueTexts,
    avoidedMethods,
  };
}

export class SpiritSeedGenerator {
  static generateRandomSkeletons(count: number, options: SpiritSeedRandomOptions = {}, rng: () => number = Math.random): SpiritSeedSkeleton[] { return Array.from({ length: Math.max(0, Math.floor(count)) }, () => ({ rank: pickWeightedQuality(options, rng), quantity: 1, forcedElement: options.specifiedElement, regionTags: options.regionTags?.slice(0, 8) })); }
  static async generateRandom(count: number, options: SpiritSeedRandomOptions = {}): Promise<Array<Omit<Material, 'id'>>> { return this.generateFromSkeletons(this.generateRandomSkeletons(count, options)); }
  static async generateBatches(batches: readonly SpiritSeedBatchSpec[]): Promise<Array<Omit<Material, 'id'>>> { return this.generateFromSkeletons(batches.map((batch) => ({ rank: batch.rank, quantity: Math.max(1, Math.floor(batch.quantity)), forcedElement: batch.element, regionTags: batch.regionTags?.slice(0, 8) }))); }
  static async generateFromSkeletons(skeletons: SpiritSeedSkeleton[]): Promise<Array<Omit<Material, 'id'>>> {
    if (skeletons.length === 0) return [];
    let identities: SpiritSeedIdentity[];
    try {
      const response = await generateAiArray({ system: renderPromptSystem('spirit-seed-generation'), prompt: renderPromptUser('spirit-seed-generation', { requestList: requestList(skeletons) }), elementSchema: SpiritSeedAISchema, name: 'SpiritSeedIdentityList', description: '灵种身份、隐性习性与玩家线索', sceneId: 'spirit-seed-generation', maxOutputTokens: Math.min(8_000, Math.max(1_600, skeletons.length * 1_000)) });
      identities = skeletons.map((skeleton, index) => {
        const fallback = fallbackIdentity(skeleton, index);
        const identity = {
          ...(response.output[index] ?? fallback),
          element:
            skeleton.forcedElement ?? response.output[index]?.element ?? fallback.element,
        };
        return normalizeIdentityClues(identity, fallback);
      });
    } catch (error) { console.error('[spirit-seed-generation] fallback', error); identities = skeletons.map(fallbackIdentity); }
    return skeletons.map((skeleton, index) => {
      const identity = identities[index] ?? fallbackIdentity(skeleton, index);
      const balance = getSpiritFieldQualityBalance(skeleton.rank);
      const plant: SpiritFieldPlantSnapshot = { id: globalThis.crypto.randomUUID(), ...identity, quality: skeleton.rank, minRealm: balance.minRealm, stageDurationMs: balance.stageDurationMs, baseYieldMin: balance.baseYield[0], baseYieldMax: balance.baseYield[1] };
      return buildSpiritFieldSeedMaterialFromPlant(plant, skeleton.quantity);
    });
  }
}
