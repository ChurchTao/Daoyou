import type { MailAttachment } from '@shared/types/mail';
import type { ResourceOperation } from '@shared/engine/resource/types';
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
  PILL_FAMILY_VALUES,
  PILL_QUOTA_CATEGORY_VALUES,
  TALISMAN_SESSION_MODE_VALUES,
} from '@shared/types/consumable';
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
    dominantElement: z.enum(ELEMENT_VALUES).optional(),
    stability: z.number(),
    toxicityRating: z.number(),
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

export const MailAttachmentSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('spirit_stones'),
    name: z.string().trim().min(1).max(100),
    quantity: z.number().int().min(1),
  }),
  z.object({
    type: z.literal('reputation'),
    name: z.string().trim().min(1).max(100),
    quantity: z.number().int().min(1),
  }),
  z.object({
    type: z.literal('cultivation_exp'),
    name: z.string().trim().min(1).max(100),
    quantity: z.number().int().min(1),
  }),
  z.object({
    type: z.literal('comprehension_insight'),
    name: z.string().trim().min(1).max(100),
    quantity: z.number().int().min(1),
  }),
  z.object({
    type: z.literal('material'),
    name: z.string().trim().min(1).max(100),
    quantity: z.number().int().min(1),
    data: ItemLibraryMaterialPayloadSchema.extend({
      quantity: z.number().int().min(1),
    }),
  }),
  z.object({
    type: z.literal('consumable'),
    name: z.string().trim().min(1).max(100),
    quantity: z.number().int().min(1),
    data: ItemLibraryConsumablePayloadSchema.extend({
      quantity: z.number().int().min(1),
    }),
  }),
  z.object({
    type: z.literal('artifact'),
    name: z.string().trim().min(1).max(100),
    quantity: z.number().int().min(1),
    data: ItemLibraryArtifactPayloadSchema,
  }),
]);

export const MailAttachmentsSchema = z.array(MailAttachmentSchema);

export const ArtifactEditorConfigSchema = z.object({
  slot: z.enum(EQUIPMENT_SLOT_VALUES),
  element: z.enum(ELEMENT_VALUES),
  quality: z.enum(QUALITY_VALUES).optional(),
  realm: z.enum(REALM_VALUES).optional(),
  realmStage: z.enum(REALM_STAGE_VALUES).optional(),
  affixIds: z.array(z.string().min(1)).min(1),
});

export const ArtifactPreviewRequestSchema = ArtifactEditorConfigSchema.extend({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(1000).optional(),
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

export const CreateItemLibraryEntrySchema = z.discriminatedUnion('type', [
  z.object({
    itemId: ItemLibraryItemIdSchema,
    type: z.literal('material'),
    status: ItemLibraryStatusSchema.default('published'),
    payload: ItemLibraryMaterialPayloadSchema,
    editorConfig: z.record(z.string(), z.unknown()).default({}),
  }),
  z.object({
    itemId: ItemLibraryItemIdSchema,
    type: z.literal('consumable'),
    status: ItemLibraryStatusSchema.default('published'),
    payload: ItemLibraryConsumablePayloadSchema,
    editorConfig: z.record(z.string(), z.unknown()).default({}),
  }),
  z.object({
    itemId: ItemLibraryItemIdSchema,
    type: z.literal('artifact'),
    status: ItemLibraryStatusSchema.default('published'),
    payload: ItemLibraryArtifactPayloadSchema,
    editorConfig: ArtifactEditorConfigSchema,
  }),
]);

export const UpdateItemLibraryEntrySchema = z.discriminatedUnion('type', [
  CreateItemLibraryEntrySchema.options[0].omit({ itemId: true }),
  CreateItemLibraryEntrySchema.options[1].omit({ itemId: true }),
  CreateItemLibraryEntrySchema.options[2].omit({ itemId: true }),
]);

export const ItemLibraryListQuerySchema = z.object({
  status: ItemLibraryStatusSchema.optional(),
  type: ItemLibraryTypeSchema.optional(),
  q: z.string().trim().max(100).optional(),
});

export const ItemLibraryRewardSelectionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('spirit_stones'),
    quantity: z.number().int().min(1).max(100000000),
  }),
  z.object({
    type: z.literal('reputation'),
    quantity: z.number().int().min(1).max(100000000),
  }),
  z.object({
    type: z.literal('item_library'),
    itemId: ItemLibraryItemIdSchema,
    quantity: z.number().int().min(1).max(100000000),
  }),
]);

export const ItemLibraryRewardSelectionsSchema = z.array(
  ItemLibraryRewardSelectionSchema,
);

export type ItemLibraryEntry = z.infer<typeof ItemLibraryEntrySchema>;
export type ItemLibraryPayload =
  | z.infer<typeof ItemLibraryMaterialPayloadSchema>
  | z.infer<typeof ItemLibraryConsumablePayloadSchema>
  | z.infer<typeof ItemLibraryArtifactPayloadSchema>;
export type ItemLibraryEditorConfig =
  | Record<string, unknown>
  | z.infer<typeof ArtifactEditorConfigSchema>;
export type CreateItemLibraryEntry = z.infer<
  typeof CreateItemLibraryEntrySchema
>;
export type UpdateItemLibraryEntry = z.infer<
  typeof UpdateItemLibraryEntrySchema
>;
export type ItemLibraryRewardSelection = z.infer<
  typeof ItemLibraryRewardSelectionSchema
>;

function clonePlainData<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function parseItemLibraryEntry(input: unknown): ItemLibraryEntry {
  return ItemLibraryEntrySchema.parse(input);
}

export function parseItemLibraryEntries(input: unknown): ItemLibraryEntry[] {
  return z.array(ItemLibraryEntrySchema).parse(input);
}

export function parseItemLibraryRewardSelections(
  input: unknown,
): ItemLibraryRewardSelection[] {
  return ItemLibraryRewardSelectionsSchema.parse(input);
}

export function parseMailAttachments(input: unknown): MailAttachment[] {
  return MailAttachmentsSchema.parse(input) as MailAttachment[];
}

export function buildAttachmentFromItemLibraryEntry(
  entry: ItemLibraryEntry,
  quantity: number,
): MailAttachment {
  if (entry.status !== 'published') {
    throw new ItemLibraryResolveError(`道具已下架：${entry.itemId}`);
  }

  switch (entry.type) {
    case 'material':
      return {
        type: 'material',
        name: entry.payload.name,
        quantity,
        data: {
          ...clonePlainData(entry.payload),
          quantity,
        } as MailAttachment['data'],
      };
    case 'consumable':
      return {
        type: 'consumable',
        name: entry.payload.name,
        quantity,
        data: {
          ...clonePlainData(entry.payload),
          quantity,
        } as MailAttachment['data'],
      };
    case 'artifact':
      return {
        type: 'artifact',
        name: entry.payload.name,
        quantity,
        data: clonePlainData(entry.payload) as MailAttachment['data'],
      };
  }
}

export class ItemLibraryResolveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ItemLibraryResolveError';
  }
}

export function resolveItemLibrarySelections(
  rewardSelections: ItemLibraryRewardSelection[],
  entries: ItemLibraryEntry[],
): MailAttachment[] {
  const itemMap = new Map(entries.map((item) => [item.itemId, item]));

  return rewardSelections.map((selection) => {
    if (selection.type === 'spirit_stones') {
      return {
        type: 'spirit_stones',
        name: '灵石',
        quantity: selection.quantity,
      };
    }

    if (selection.type === 'reputation') {
      return {
        type: 'reputation',
        name: '声望',
        quantity: selection.quantity,
      };
    }

    const item = itemMap.get(selection.itemId);
    if (!item) {
      throw new ItemLibraryResolveError(`道具库道具不存在：${selection.itemId}`);
    }

    return buildAttachmentFromItemLibraryEntry(item, selection.quantity);
  });
}

export function attachmentsToResourceOperations(
  attachments: MailAttachment[],
): ResourceOperation[] {
  const gains: ResourceOperation[] = [];

  for (const item of attachments) {
    switch (item.type) {
      case 'spirit_stones':
        gains.push({ type: 'spirit_stones', value: item.quantity });
        break;
      case 'reputation':
        gains.push({ type: 'reputation', value: item.quantity });
        break;
      case 'material':
        gains.push({
          type: 'material',
          value: item.quantity,
          data: item.data,
        });
        break;
      case 'consumable':
        gains.push({
          type: 'consumable',
          value: item.quantity,
          data: item.data,
        });
        break;
      case 'artifact':
        for (let i = 0; i < (item.quantity || 1); i += 1) {
          gains.push({
            type: 'artifact',
            value: 1,
            data: item.data,
          });
        }
        break;
      case 'cultivation_exp':
        gains.push({ type: 'cultivation_exp', value: item.quantity });
        break;
      case 'comprehension_insight':
        gains.push({ type: 'comprehension_insight', value: item.quantity });
        break;
    }
  }

  return gains;
}

export function summarizeMailAttachment(attachment: MailAttachment): string {
  return `${attachment.name} x${attachment.quantity}`;
}

export function summarizeMailAttachments(
  attachments: MailAttachment[],
): string[] {
  return attachments.map((attachment) =>
    summarizeMailAttachment(clonePlainData(attachment)),
  );
}
