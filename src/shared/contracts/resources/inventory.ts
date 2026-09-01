import type { AbilityConfig } from '@shared/engine/battle-v5/core/configs';
import {
  AbilityType,
  AttributeType,
  ModifierType,
} from '@shared/engine/battle-v5/core/types';
import {
  CONSUMABLE_TYPE_VALUES,
  ELEMENT_VALUES,
  EQUIPMENT_SLOT_VALUES,
  MATERIAL_TYPE_VALUES,
  QUALITY_VALUES,
  REALM_STAGE_VALUES,
  REALM_VALUES,
} from '@shared/types/constants';
import {
  ALCHEMY_COMPOUND_TIER_VALUES,
  ALCHEMY_PROPERTY_KEY_VALUES,
  FORMULA_FIT_BAND_VALUES,
  PILL_APPEARANCE_GRADE_VALUES,
  PILL_FAMILY_VALUES,
  PILL_QUOTA_CATEGORY_VALUES,
  TALISMAN_SESSION_MODE_VALUES,
} from '@shared/types/consumable';
import type { Artifact, Consumable, Material } from '@shared/types/cultivator';
import { z } from 'zod';
import { applyResourceChange } from './core';
import type { ResourceChange, ResourceDataMap } from './registry';

export const INVENTORY_RESOURCE_TOPICS = [
  'inventory.artifacts',
  'inventory.materials',
  'inventory.consumables',
] as const;

export type InventoryResourceTopic = (typeof INVENTORY_RESOURCE_TOPICS)[number];

export interface ResourcePageData<T> {
  items: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export interface InventoryResourceDataMap {
  'inventory.artifacts': ResourcePageData<Artifact>;
  'inventory.materials': ResourcePageData<Material>;
  'inventory.consumables': ResourcePageData<Consumable>;
}

export type InventoryResourceViewParams = {
  materialTypes?: readonly Material['type'][];
  excludeMaterialTypes?: readonly Material['type'][];
  materialRanks?: readonly Material['rank'][];
  materialElements?: readonly NonNullable<Material['element']>[];
  materialSortBy?:
    'createdAt' | 'rank' | 'type' | 'element' | 'quantity' | 'name';
};

export type InventoryPageReduction<TTopic extends InventoryResourceTopic> =
  | { status: 'applied'; data: ResourceDataMap[TTopic] }
  | { status: 'ignored' }
  | { status: 'stale' };

export function reduceInventoryResourcePage<
  TTopic extends InventoryResourceTopic,
>(
  current: ResourceDataMap[TTopic] | undefined,
  change: ResourceChange<TTopic>,
  params: InventoryResourceViewParams = {},
): InventoryPageReduction<TTopic> {
  if (!current || change.operation === 'invalidate') {
    return { status: 'stale' };
  }
  if (change.operation === 'remove-items') {
    const ids = new Set(change.payload.ids.map(String));
    const isCompleteFirstPage =
      current.pagination.page === 1 &&
      !current.pagination.hasMore &&
      current.pagination.total === current.items.length;
    if (
      !isCompleteFirstPage ||
      [...ids].some(
        (id) =>
          !current.items.some((item) => 'id' in item && String(item.id) === id),
      )
    ) {
      return { status: 'stale' };
    }
    const items = current.items.filter(
      (item) => !('id' in item) || !ids.has(String(item.id)),
    );
    const removed = current.items.length - items.length;
    const total = Math.max(0, current.pagination.total - removed);
    return {
      status: 'applied',
      data: {
        items,
        pagination: {
          ...current.pagination,
          total,
          totalPages: Math.ceil(total / current.pagination.pageSize),
          hasMore: false,
        },
      } as ResourceDataMap[TTopic],
    };
  }
  if (change.operation === 'upsert-items') {
    const updates = new Map(
      change.payload.items
        .filter(
          (
            item,
          ): item is (typeof change.payload.items)[number] & {
            id: string;
          } => Boolean(item && typeof item === 'object' && 'id' in item),
        )
        .map((item) => [String(item.id), item]),
    );
    if (change.resourceTopic === 'inventory.materials') {
      for (const [id, item] of updates) {
        const existing = current.items.find(
          (candidate) => 'id' in candidate && String(candidate.id) === id,
        );
        const matches = matchesMaterialInventoryParams(
          item as Material,
          params,
        );
        if (!existing && !matches) {
          updates.delete(id);
          continue;
        }
        if (!existing || !matches) return { status: 'stale' };
        if (
          params.materialSortBy &&
          existing[params.materialSortBy as keyof typeof existing] !==
            item[params.materialSortBy as keyof typeof item]
        ) {
          return { status: 'stale' };
        }
      }
    } else if (
      [...updates.keys()].some(
        (id) =>
          !current.items.some((item) => 'id' in item && String(item.id) === id),
      )
    ) {
      return { status: 'stale' };
    }
    if (updates.size === 0) return { status: 'ignored' };
    return {
      status: 'applied',
      data: {
        ...current,
        items: current.items.map((item) => {
          const update =
            'id' in item ? updates.get(String(item.id)) : undefined;
          return update ? { ...item, ...update } : item;
        }),
      } as ResourceDataMap[TTopic],
    };
  }
  const data = applyResourceChange(current, change);
  return data === undefined ? { status: 'stale' } : { status: 'applied', data };
}

function matchesMaterialInventoryParams(
  material: Material,
  params: InventoryResourceViewParams,
): boolean {
  if (
    params.materialTypes?.length &&
    !params.materialTypes.includes(material.type)
  ) {
    return false;
  }
  if (
    params.excludeMaterialTypes?.length &&
    params.excludeMaterialTypes.includes(material.type)
  ) {
    return false;
  }
  if (
    params.materialRanks?.length &&
    !params.materialRanks.includes(material.rank)
  ) {
    return false;
  }
  if (
    params.materialElements?.length &&
    (!material.element || !params.materialElements.includes(material.element))
  ) {
    return false;
  }
  return true;
}

const jsonObjectSchema = z.record(z.string(), z.json());
const paginationSchema = z
  .object({
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
    hasMore: z.boolean(),
  })
  .strict();
const attributeModifierSchema = z
  .object({
    attrType: z.nativeEnum(AttributeType),
    type: z.nativeEnum(ModifierType),
    value: z.number(),
    scaleByLayer: z.boolean().optional(),
    valueByLayer: z.array(z.number()).readonly().optional(),
  })
  .strict();
const abilityConfigEnvelopeSchema = z
  .object({
    slug: z.string(),
    name: z.string(),
    description: z.string().optional(),
    type: z.nativeEnum(AbilityType),
    tags: z.array(z.string()).optional(),
    mpCost: z.number().optional(),
    hpCost: z.number().optional(),
    costs: z.array(z.json()).optional(),
    cooldown: z.number().optional(),
    priority: z.number().optional(),
    targetPolicy: z
      .object({
        team: z.enum(['enemy', 'ally', 'self', 'any']),
        scope: z.enum(['single', 'aoe', 'random']),
        maxTargets: z.number().optional(),
      })
      .strict()
      .optional(),
    hitPolicy: z.enum(['normal', 'guaranteed']).optional(),
    selectionProfile: z.json().optional(),
    castConditions: z.array(z.json()).optional(),
    effects: z.array(z.json()).optional(),
    completionEffects: z.array(z.json()).optional(),
    effectLayers: z.array(z.json()).optional(),
    baseEffectDisplayName: z.string().optional(),
    effectPlans: z.array(z.json()).optional(),
    castEffects: z.array(z.json()).optional(),
    listeners: z.array(z.json()).optional(),
    modifiers: z.array(attributeModifierSchema).optional(),
  })
  .strict();
const abilityConfigSchema = z.custom<AbilityConfig>(
  (value) => abilityConfigEnvelopeSchema.safeParse(value).success,
  'Invalid ability config',
);
export const skillSchema = z
  .object({
    id: z.string().optional(),
    name: z.string(),
    element: z.enum(ELEMENT_VALUES),
    quality: z.enum(QUALITY_VALUES).optional(),
    score: z.number().optional(),
    cost: z.number().optional(),
    cooldown: z.number(),
    target_self: z.boolean().optional(),
    description: z.string().optional(),
    abilityConfig: abilityConfigSchema.optional(),
    productModel: z.json().optional(),
  })
  .strict();
export const cultivationTechniqueSchema = z
  .object({
    id: z.string().optional(),
    name: z.string(),
    element: z.enum(ELEMENT_VALUES).optional(),
    quality: z.enum(QUALITY_VALUES).optional(),
    score: z.number().optional(),
    description: z.string().optional(),
    attributeModifiers: z.array(attributeModifierSchema).optional(),
    abilityConfig: abilityConfigSchema.optional(),
    productModel: z.json().optional(),
  })
  .strict();
export const artifactSchema = z
  .object({
    id: z.string().uuid().optional(),
    name: z.string(),
    slot: z.enum(EQUIPMENT_SLOT_VALUES),
    element: z.enum(ELEMENT_VALUES),
    quality: z.enum(QUALITY_VALUES).optional(),
    description: z.string().optional(),
    attributeModifiers: z.array(attributeModifierSchema).optional(),
    abilityConfig: abilityConfigSchema.optional(),
    prompt: z.string().optional(),
    score: z.number().optional(),
    productModel: z.json().optional(),
    battleRuntimeMeta: z
      .object({
        anchorRealm: z.enum(REALM_VALUES).optional(),
        anchorRealmStage: z.enum(REALM_STAGE_VALUES).optional(),
      })
      .strict()
      .optional(),
    isEquipped: z.boolean().optional(),
  })
  .strict();
export const materialSchema = z
  .object({
    id: z.string().uuid().optional(),
    name: z.string(),
    type: z.enum(MATERIAL_TYPE_VALUES),
    rank: z.enum(QUALITY_VALUES),
    price: z.number().optional(),
    element: z.enum(ELEMENT_VALUES).optional(),
    description: z.string().optional(),
    details: jsonObjectSchema.optional(),
    quantity: z.number(),
  })
  .strict();
const conditionOperationStatusSchema = z
  .object({
    key: z.enum([
      'weakness',
      'minor_wound',
      'major_wound',
      'near_death',
      'breakthrough_focus',
      'protect_meridians',
      'clear_mind',
      'cultivation_boost',
    ]),
    duration: z.discriminatedUnion('kind', [
      z.object({ kind: z.literal('until_removed') }).strict(),
      z.object({ kind: z.literal('time'), expiresAt: z.string() }).strict(),
    ]),
    payload: z
      .record(z.string(), z.union([z.number(), z.string(), z.boolean()]))
      .optional(),
  })
  .strict();
const conditionTrackPathSchema = z.enum([
  'body.skin',
  'body.sinew_bone',
  'body.organs',
  'body.qi_blood',
  'body.primordial_spirit',
  'tempering.vitality',
  'tempering.spirit',
  'tempering.wisdom',
  'tempering.speed',
  'tempering.willpower',
  'marrow_wash',
]);
const conditionOperationSchema = z.discriminatedUnion('type', [
  z
    .object({
      type: z.literal('restore_resource'),
      resource: z.enum(['hp', 'mp']),
      mode: z.enum(['flat', 'percent']),
      value: z.number(),
    })
    .strict(),
  z
    .object({
      type: z.literal('change_gauge'),
      gauge: z.literal('pillToxicity'),
      delta: z.number(),
    })
    .strict(),
  z
    .object({
      type: z.literal('add_status'),
      status: conditionOperationStatusSchema.shape.key,
      stacks: z.number().optional(),
      duration: conditionOperationStatusSchema.shape.duration.optional(),
      usesRemaining: z.number().optional(),
      payload: conditionOperationStatusSchema.shape.payload,
    })
    .strict(),
  z
    .object({
      type: z.literal('remove_status'),
      status: conditionOperationStatusSchema.shape.key,
      removeAll: z.boolean().optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal('advance_track'),
      track: conditionTrackPathSchema,
      value: z.number(),
    })
    .strict(),
  z
    .object({
      type: z.literal('gain_progress'),
      target: z.enum(['cultivation_exp', 'comprehension_insight']),
      value: z.number(),
    })
    .strict(),
  z
    .object({ type: z.literal('increase_lifespan'), value: z.number() })
    .strict(),
]);
const weightedAlchemyPropertySchema = z
  .object({
    key: z.enum(ALCHEMY_PROPERTY_KEY_VALUES),
    weight: z.number(),
  })
  .strict();
const alchemyMaterialPropertyVectorSchema = z
  .object({
    materialRef: z.string(),
    materialName: z.string(),
    properties: z.array(weightedAlchemyPropertySchema),
  })
  .strict();
const alchemyEssenceSummarySchema = z
  .object({
    rawEssence: z.number(),
    effectiveEssence: z.number(),
    qualityPotential: z.number(),
    purity: z.number(),
    stability: z.number(),
  })
  .strict();
const alchemyOutputLotSchema = z
  .object({
    quality: z.enum(QUALITY_VALUES),
    appearance: z.enum(PILL_APPEARANCE_GRADE_VALUES),
    quantity: z.number(),
    essenceSpent: z.number(),
    effectMultiplier: z.number(),
  })
  .strict();
const alchemyYieldProfileSchema = z
  .object({
    essence: alchemyEssenceSummarySchema,
    primaryQuality: z.enum(QUALITY_VALUES),
    lots: z.array(alchemyOutputLotSchema),
    totalQuantity: z.number(),
    wastedEssence: z.number(),
    essenceLossRatio: z.number().optional(),
    distributionSummary: z.string(),
  })
  .strict();
const alchemyBatchProfileSchema = z
  .object({
    yieldQuantity: z.number().optional(),
    lotQuantity: z.number().int().positive().optional(),
    synergyScore: z.number(),
    conflictScore: z.number(),
    compoundTier: z.enum(ALCHEMY_COMPOUND_TIER_VALUES),
    roleSummary: z.string(),
    stabilityDelta: z.number(),
    toxicityDelta: z.number(),
    secondaryEffectMultiplierBonus: z.number().optional(),
    essenceSummary: alchemyEssenceSummarySchema.optional(),
    yieldProfile: alchemyYieldProfileSchema.optional(),
    essenceLossRatio: z.number().min(0).max(1).optional(),
  })
  .strict();
const pillAlchemyMetaBaseShape = {
  sourceMaterials: z.array(z.string()),
  analysisVersion: z.number().optional(),
  propertyVector: z.array(weightedAlchemyPropertySchema).optional(),
  sourceMaterialVectors: z
    .array(alchemyMaterialPropertyVectorSchema)
    .optional(),
  dominantElement: z.enum(ELEMENT_VALUES).optional(),
  stability: z.number(),
  toxicityRating: z.number(),
  appearance: z.enum(PILL_APPEARANCE_GRADE_VALUES).optional(),
  tags: z.array(z.string()),
  batch: alchemyBatchProfileSchema.optional(),
  version: z.union([z.literal(3), z.literal(4)]).optional(),
  breakthroughTargetRealm: z.enum(REALM_VALUES).optional(),
  breakthroughLabel: z.string().optional(),
};
const pillAlchemyMetaSchema = z.discriminatedUnion('source', [
  z
    .object({
      source: z.literal('improvised'),
      formulaId: z.never().optional(),
      ...pillAlchemyMetaBaseShape,
    })
    .strict(),
  z
    .object({
      source: z.literal('formula'),
      formulaId: z.string(),
      fitScore: z.number(),
      fitBand: z.enum(FORMULA_FIT_BAND_VALUES),
      fitMultiplier: z.number(),
      ...pillAlchemyMetaBaseShape,
    })
    .strict(),
]);
export const consumableSchema = z
  .object({
    id: z.string().uuid().optional(),
    name: z.string(),
    type: z.enum(CONSUMABLE_TYPE_VALUES),
    quality: z.enum(QUALITY_VALUES).optional(),
    quantity: z.number(),
    description: z.string().optional(),
    prompt: z.string().optional(),
    score: z.number().optional(),
    spec: z.discriminatedUnion('kind', [
      z
        .object({
          kind: z.literal('pill'),
          family: z.enum(PILL_FAMILY_VALUES),
          operations: z.array(conditionOperationSchema),
          consumeRules: z
            .object({
              scene: z.literal('out_of_battle_only'),
              quotaCategory: z.enum(PILL_QUOTA_CATEGORY_VALUES),
            })
            .strict(),
          alchemyMeta: pillAlchemyMetaSchema,
        })
        .strict(),
      z
        .object({
          kind: z.literal('spirit_fruit'),
          family: z.enum(PILL_FAMILY_VALUES),
          operations: z.array(conditionOperationSchema),
          consumeRules: z
            .object({
              scene: z.literal('out_of_battle_only'),
              quotaCategory: z.enum(PILL_QUOTA_CATEGORY_VALUES),
            })
            .strict(),
          source: z
            .object({
              kind: z.literal('spirit_field'),
              version: z.literal(1),
            })
            .strict(),
        })
        .strict(),
      z
        .object({
          kind: z.literal('talisman'),
          scenario: z.string(),
          sessionMode: z.enum(TALISMAN_SESSION_MODE_VALUES),
          notes: z.string().optional(),
        })
        .strict(),
    ]),
  })
  .strict();

const inventoryPageSchema = <T extends z.ZodTypeAny>(item: T) =>
  z.object({ items: z.array(item), pagination: paginationSchema }).strict();

export const INVENTORY_RESOURCE_DATA_SCHEMAS = {
  'inventory.artifacts': inventoryPageSchema(artifactSchema),
  'inventory.materials': inventoryPageSchema(materialSchema),
  'inventory.consumables': inventoryPageSchema(consumableSchema),
} satisfies {
  [TTopic in InventoryResourceTopic]: z.ZodType<
    InventoryResourceDataMap[TTopic]
  >;
};
