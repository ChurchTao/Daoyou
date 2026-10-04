import {
  CONSUMABLE_TYPE_VALUES,
  EQUIPMENT_SLOT_VALUES,
  MATERIAL_TYPE_VALUES,
} from '../inventory.js';

import { ELEMENT_VALUES } from '@daoyou/constants/elements';

import { QUALITY_VALUES } from '@daoyou/constants/qualities';

import { REALM_STAGE_VALUES, REALM_VALUES } from '@daoyou/constants/realms';

import {
  ALCHEMY_PROPERTY_KEY_VALUES,
  PILL_APPEARANCE_GRADE_VALUES,
  PILL_FAMILY_VALUES,
  PILL_QUOTA_CATEGORY_VALUES,
  TALISMAN_SESSION_MODE_VALUES,
} from '../consumable.js';

import { z } from 'zod';

const ConditionStatusDurationSchema = z.union([
  z.object({
    kind: z.literal('until_removed'),
  }),
  z.object({
    kind: z.literal('time'),
    expiresAt: z.string().min(1),
  }),
]);

const ConditionOperationSchema = z.discriminatedUnion('type', [
  z
    .object({
      type: z.literal('gain_beast_cultivation'),
      value: z.number().int().positive().max(112125),
    })
    .strict(),
  z.object({
    type: z.literal('restore_resource'),
    resource: z.enum(['hp', 'mp']),
    mode: z.enum(['flat', 'percent']),
    value: z.number(),
  }),
  z.object({
    type: z.literal('change_gauge'),
    gauge: z.literal('pillToxicity'),
    delta: z.number(),
  }),
  z.object({
    type: z.literal('remove_status'),
    status: z.string().min(1),
    removeAll: z.boolean().optional(),
  }),
  z.object({
    type: z.literal('add_status'),
    status: z.string().min(1),
    stacks: z.number().int().min(1).optional(),
    duration: ConditionStatusDurationSchema.optional(),
    usesRemaining: z.number().int().min(0).optional(),
    payload: z
      .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
      .optional(),
  }),
  z.object({
    type: z.literal('advance_track'),
    track: z.string().min(1),
    value: z.number(),
  }),
  z.object({
    type: z.literal('gain_progress'),
    target: z.enum(['cultivation_exp', 'comprehension_insight']),
    value: z.number(),
  }),
  z.object({
    type: z.literal('increase_lifespan'),
    value: z.number().int().min(1),
  }),
]);

const WeightedAlchemyPropertySchema = z.object({
  key: z.enum(ALCHEMY_PROPERTY_KEY_VALUES),
  weight: z.number(),
});

const AlchemyMaterialPropertyVectorSchema = z.object({
  materialRef: z.string(),
  materialName: z.string(),
  properties: z.array(WeightedAlchemyPropertySchema),
});

const PillSpecSchema = z.object({
  kind: z.literal('pill'),
  family: z.enum(PILL_FAMILY_VALUES),
  operations: z.array(ConditionOperationSchema),
  consumeRules: z.object({
    scene: z.literal('out_of_battle_only'),
    quotaCategory: z.enum(PILL_QUOTA_CATEGORY_VALUES),
  }),
  alchemyMeta: z.object({
    source: z.enum(['improvised', 'formula']),
    formulaId: z.string().optional(),
    sourceMaterials: z.array(z.string()),
    analysisVersion: z.number().optional(),
    propertyVector: z.array(WeightedAlchemyPropertySchema).optional(),
    sourceMaterialVectors: z
      .array(AlchemyMaterialPropertyVectorSchema)
      .optional(),
    dominantElement: z.enum(ELEMENT_VALUES).optional(),
    stability: z.number(),
    toxicityRating: z.number(),
    appearance: z.enum(PILL_APPEARANCE_GRADE_VALUES).optional(),
    tags: z.array(z.string()),
  }),
});

const TalismanSpecSchema = z.object({
  kind: z.literal('talisman'),
  scenario: z.string().min(1),
  sessionMode: z.enum(TALISMAN_SESSION_MODE_VALUES),
  notes: z.string().optional(),
});

const ConsumableSpecSchema = z.discriminatedUnion('kind', [
  PillSpecSchema,
  TalismanSpecSchema,
]);

export const ItemLibraryItemIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9][a-z0-9_-]*$/i, '道具 ID 仅支持字母、数字、_ 和 -');

export const ItemLibraryStatusSchema = z.enum(['published', 'archived']);

export const ItemLibraryTypeSchema = z.enum([
  'material',
  'consumable',
  'artifact',
]);

export const ItemLibraryMaterialPayloadSchema = z.object({
  name: z.string().trim().min(1).max(100),
  type: z.enum(MATERIAL_TYPE_VALUES),
  rank: z.enum(QUALITY_VALUES),
  element: z.enum(ELEMENT_VALUES).optional(),
  description: z.string().optional(),
  details: z.record(z.string(), z.unknown()).optional(),
});

export const ItemLibraryConsumablePayloadSchema = z.object({
  name: z.string().trim().min(1).max(100),
  type: z.enum(CONSUMABLE_TYPE_VALUES),
  quality: z.enum(QUALITY_VALUES).optional(),
  description: z.string().optional(),
  prompt: z.string().optional(),
  score: z.number().int().optional(),
  spec: ConsumableSpecSchema,
});

export const ItemLibraryArtifactPayloadSchema = z.object({
  name: z.string().trim().min(1).max(100),
  slot: z.enum(EQUIPMENT_SLOT_VALUES),
  element: z.enum(ELEMENT_VALUES),
  quality: z.enum(QUALITY_VALUES).optional(),
  description: z.string().optional(),
  score: z.number().int().optional(),
  productModel: z.record(z.string(), z.unknown()),
});

export const ArtifactEditorConfigSchema = z.object({
  slot: z.enum(EQUIPMENT_SLOT_VALUES),
  element: z.enum(ELEMENT_VALUES),
  quality: z.enum(QUALITY_VALUES).optional(),
  realm: z.enum(REALM_VALUES).optional(),
  realmStage: z.enum(REALM_STAGE_VALUES).optional(),
  affixIds: z.array(z.string().min(1)).min(1),
});

const ItemLibraryBaseEntrySchema = z.object({
  id: z.string().uuid(),
  itemId: ItemLibraryItemIdSchema,
  status: ItemLibraryStatusSchema,
  name: z.string().trim().min(1).max(100),
  description: z.string().nullable().optional(),
  quality: z.string().nullable().optional(),
  element: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  editorConfig: z.record(z.string(), z.unknown()).default({}),
  createdBy: z.string().uuid(),
  updatedBy: z.string().uuid(),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
});

export const ItemLibraryEntrySchema = z.discriminatedUnion('type', [
  ItemLibraryBaseEntrySchema.extend({
    type: z.literal('material'),
    payload: ItemLibraryMaterialPayloadSchema,
  }),
  ItemLibraryBaseEntrySchema.extend({
    type: z.literal('consumable'),
    payload: ItemLibraryConsumablePayloadSchema,
  }),
  ItemLibraryBaseEntrySchema.extend({
    type: z.literal('artifact'),
    payload: ItemLibraryArtifactPayloadSchema,
    editorConfig: ArtifactEditorConfigSchema,
  }),
]);

export type ItemLibraryEntry = z.infer<typeof ItemLibraryEntrySchema>;

export type ItemLibraryPayload =
  | z.infer<typeof ItemLibraryMaterialPayloadSchema>
  | z.infer<typeof ItemLibraryConsumablePayloadSchema>
  | z.infer<typeof ItemLibraryArtifactPayloadSchema>;

export type ItemLibraryEditorConfig =
  Record<string, unknown> | z.infer<typeof ArtifactEditorConfigSchema>;

export function parseItemLibraryEntry(input: unknown): ItemLibraryEntry {
  return ItemLibraryEntrySchema.parse(input);
}

export function parseItemLibraryEntries(input: unknown): ItemLibraryEntry[] {
  return z.array(ItemLibraryEntrySchema).parse(input);
}
