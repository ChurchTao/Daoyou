import { renderPromptSystem, renderPromptUser } from '@server/lib/prompts';
import { generateAiArray } from '@server/utils/aiClient';
import {
  ELEMENT_VALUES,
  QUALITY_VALUES,
  type ElementType,
  type Quality,
} from '@shared/types/constants';
import type { Material } from '@shared/types/cultivator';
import { z } from 'zod';
import {
  SPIRIT_SEED_QUALITY_CHANCE_MAP,
  getSpiritFieldQualityBalance,
} from './config';
import { buildSpiritFieldSeedMaterialFromPlant } from './seedMaterial';
import {
  SPIRIT_SEED_CARE_STYLE_TAGS,
  SPIRIT_SEED_GROWTH_FORMS,
  SPIRIT_SEED_HABITAT_TAGS,
  SPIRIT_SEED_HARVEST_PARTS,
  SPIRIT_SEED_USE_TAGS,
  type SpiritFieldPlantSnapshot,
  type SpiritSeedGrowthForm,
  type SpiritSeedIdentity,
  type SpiritSeedRandomOptions,
  type SpiritSeedSkeleton,
} from './types';

const SpiritSeedAISchema = z
  .object({
    plantName: z.string().trim().min(2).max(10),
    seedName: z.string().trim().min(2).max(12),
    description: z.string().trim().min(20).max(140),
    seedDescription: z.string().trim().min(12).max(90),
    appearance: z.string().trim().min(6).max(80),
    matureSign: z.string().trim().min(6).max(80),
    element: z.enum(ELEMENT_VALUES),
    growthForm: z.enum(SPIRIT_SEED_GROWTH_FORMS),
    harvestPart: z.enum(SPIRIT_SEED_HARVEST_PARTS),
    habitatTags: z.array(z.enum(SPIRIT_SEED_HABITAT_TAGS)).min(1).max(3),
    careStyleTags: z
      .array(z.enum(SPIRIT_SEED_CARE_STYLE_TAGS))
      .min(1)
      .max(3),
    useTags: z.array(z.enum(SPIRIT_SEED_USE_TAGS)).min(1).max(3),
  })
  .strict();

export interface SpiritSeedBatchSpec {
  rank: Quality;
  quantity: number;
  element?: ElementType;
  regionTags?: string[];
}

function pickWeightedQuality(
  options: SpiritSeedRandomOptions,
  rng: () => number,
): Quality {
  if (options.guaranteedRank) return options.guaranteedRank;

  const minIndex = options.rankRange
    ? QUALITY_VALUES.indexOf(options.rankRange.min)
    : 0;
  const maxIndex = options.rankRange
    ? QUALITY_VALUES.indexOf(options.rankRange.max)
    : QUALITY_VALUES.length - 1;
  const lo = Math.min(minIndex, maxIndex);
  const hi = Math.max(minIndex, maxIndex);
  const weights = options.qualityChanceMap ?? SPIRIT_SEED_QUALITY_CHANCE_MAP;
  const candidates = QUALITY_VALUES.slice(lo, hi + 1);
  const total = candidates.reduce(
    (sum, quality) => sum + Math.max(0, weights[quality] ?? 0),
    0,
  );

  if (total <= 0) {
    return candidates[Math.floor(rng() * candidates.length)] ?? '凡品';
  }

  let cursor = rng() * total;
  for (const quality of candidates) {
    cursor -= Math.max(0, weights[quality] ?? 0);
    if (cursor <= 0) return quality;
  }
  return candidates[candidates.length - 1] ?? '凡品';
}

function describeQuality(quality: Quality): string {
  const index = QUALITY_VALUES.indexOf(quality);
  if (index <= 1) return '常见灵植，名称与来历应朴素克制';
  if (index <= 3) return '已有明显灵性，可有独特生态与药性意象';
  if (index <= 5) return '天地灵物，命名和成熟异象可以更鲜明';
  return '极高阶灵植，应有古老、稀有、法则感，但不要堆砌夸张神名';
}

function buildGenerationRequestList(skeletons: SpiritSeedSkeleton[]): string {
  return skeletons
    .map((skeleton, index) => {
      const element = skeleton.forcedElement ?? '由你从允许五行中选择';
      const region = skeleton.regionTags?.length
        ? skeleton.regionTags.join('、')
        : '无特定地域';
      return [
        `${index + 1}. 品质：${skeleton.rank}`,
        `元素约束：${element}`,
        `地域语境：${region}`,
        `品质语气：${describeQuality(skeleton.rank)}`,
      ].join(' | ');
    })
    .join('\n');
}

function fallbackGrowthForm(index: number): SpiritSeedGrowthForm {
  const forms = SPIRIT_SEED_GROWTH_FORMS;
  return forms[index % forms.length] ?? 'herb';
}

function deriveSeedItemName(
  plantName: string,
  growthForm: SpiritSeedGrowthForm,
): string {
  switch (growthForm) {
    case 'fungus':
      return `${plantName}菌孢`;
    case 'tree':
      return `${plantName}芽核`;
    case 'root':
      return `${plantName}根芽`;
    case 'aquatic':
      return `${plantName}水籽`;
    default:
      return `${plantName}籽`;
  }
}

function normalizeIdentity(
  identity: SpiritSeedIdentity,
  skeleton: SpiritSeedSkeleton,
): SpiritSeedIdentity {
  const element = skeleton.forcedElement ?? identity.element;
  const seedName =
    identity.seedName === `${identity.plantName}灵种` ||
    identity.seedName.trim() === '灵种'
      ? deriveSeedItemName(identity.plantName, identity.growthForm)
      : identity.seedName;

  return {
    ...identity,
    element,
    seedName,
    habitatTags: [...new Set(identity.habitatTags)].slice(0, 3),
    careStyleTags: [...new Set(identity.careStyleTags)].slice(0, 3),
    useTags: [...new Set(identity.useTags)].slice(0, 3),
  };
}

function buildFallbackIdentity(
  skeleton: SpiritSeedSkeleton,
  index: number,
): SpiritSeedIdentity {
  const element =
    skeleton.forcedElement ?? ELEMENT_VALUES[index % ELEMENT_VALUES.length] ?? '木';
  const growthForm = fallbackGrowthForm(index);
  const elementPrefix: Record<ElementType, string> = {
    金: '金纹',
    木: '青络',
    水: '沧露',
    火: '赤霞',
    土: '地脉',
    风: '凌风',
    雷: '紫电',
    冰: '霜华',
  };
  const formName: Record<SpiritSeedGrowthForm, string> = {
    herb: '草',
    flower: '花',
    vine: '藤',
    shrub: '枝',
    tree: '木',
    fungus: '芝',
    aquatic: '萍',
    root: '参',
  };
  const plantName = `${elementPrefix[element]}${formName[growthForm]}`;

  return {
    plantName,
    seedName: deriveSeedItemName(plantName, growthForm),
    description: `${plantName}是一种与${element}行灵气相合的灵植，形态随生境略有差异，成熟后可采其主要药用部位入丹或作修行辅材。`,
    seedDescription: `种体隐有${element}行微光，灵机尚未舒展，入土后需循其习性缓慢温养。`,
    appearance: `幼株纹理清晰，枝叶间可见淡淡${element}行灵光。`,
    matureSign: '成熟时灵光由散转凝，主要采收部位会出现明显色泽变化。',
    element,
    growthForm,
    harvestPart: growthForm === 'fungus' ? 'whole' : growthForm === 'root' ? 'root' : 'leaf',
    habitatTags: growthForm === 'aquatic' ? ['waterside'] : ['mountain'],
    careStyleTags: ['qi-sensitive'],
    useTags: ['alchemy'],
  };
}

export class SpiritSeedGenerator {
  /**
   * 生成灵种专属骨架。这里只决定品质/数量/强制元素/地域上下文，
   * 不接触 MaterialGenerator，也没有 material type 概念。
   */
  static generateRandomSkeletons(
    count: number,
    options: SpiritSeedRandomOptions = {},
    rng: () => number = Math.random,
  ): SpiritSeedSkeleton[] {
    return Array.from({ length: Math.max(0, Math.floor(count)) }, () => ({
      rank: pickWeightedQuality(options, rng),
      quantity: 1,
      forcedElement: options.specifiedElement,
      regionTags: options.regionTags?.slice(0, 8),
    }));
  }

  static async generateRandom(
    count: number,
    options: SpiritSeedRandomOptions = {},
  ): Promise<Array<Omit<Material, 'id'>>> {
    return this.generateFromSkeletons(this.generateRandomSkeletons(count, options));
  }

  static async generateBatches(
    batches: readonly SpiritSeedBatchSpec[],
  ): Promise<Array<Omit<Material, 'id'>>> {
    return this.generateFromSkeletons(
      batches.map((batch) => ({
        rank: batch.rank,
        quantity: Math.max(1, Math.floor(batch.quantity)),
        forcedElement: batch.element,
        regionTags: batch.regionTags?.slice(0, 8),
      })),
    );
  }

  static async generateFromSkeletons(
    skeletons: SpiritSeedSkeleton[],
  ): Promise<Array<Omit<Material, 'id'>>> {
    if (skeletons.length === 0) return [];

    let identities: SpiritSeedIdentity[];
    try {
      const aiResponse = await generateAiArray({
        system: renderPromptSystem('spirit-seed-generation'),
        prompt: renderPromptUser('spirit-seed-generation', {
          requestList: buildGenerationRequestList(skeletons),
        }),
        elementSchema: SpiritSeedAISchema,
        name: 'SpiritSeedIdentityList',
        description: '灵田系统专用灵种身份与语义标签列表',
        sceneId: 'spirit-seed-generation',
        maxOutputTokens: Math.min(8_000, Math.max(1_200, skeletons.length * 850)),
      });
      identities = skeletons.map((skeleton, index) => {
        const output = aiResponse.output[index];
        return output
          ? normalizeIdentity(output, skeleton)
          : buildFallbackIdentity(skeleton, index);
      });
    } catch (error) {
      console.error('[spirit-seed-generation] failed, using fallback', error);
      identities = skeletons.map(buildFallbackIdentity);
    }

    return skeletons.map((skeleton, index) => {
      const identity = identities[index] ?? buildFallbackIdentity(skeleton, index);
      const balance = getSpiritFieldQualityBalance(skeleton.rank);
      const plant: SpiritFieldPlantSnapshot = {
        id: globalThis.crypto.randomUUID(),
        name: identity.plantName,
        seedName: identity.seedName,
        quality: skeleton.rank,
        element: identity.element,
        minRealm: balance.minRealm,
        baseGrowthMs: balance.growthMs,
        careSlots: balance.careSlots,
        careCooldownMs: balance.careCooldownMs,
        description: identity.description,
        seedDescription: identity.seedDescription,
        appearance: identity.appearance,
        matureSign: identity.matureSign,
        growthForm: identity.growthForm,
        harvestPart: identity.harvestPart,
        habitatTags: identity.habitatTags,
        careStyleTags: identity.careStyleTags,
        useTags: identity.useTags,
        baseYieldMin: balance.baseYield[0],
        baseYieldMax: balance.baseYield[1],
      };
      return buildSpiritFieldSeedMaterialFromPlant(plant, skeleton.quantity);
    });
  }
}
