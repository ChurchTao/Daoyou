import type { MailAttachment } from '@shared/types/mail';
import {
  CONSUMABLE_TYPE_VALUES,
  ELEMENT_VALUES,
  EQUIPMENT_SLOT_VALUES,
  MATERIAL_TYPE_VALUES,
  QUALITY_VALUES,
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
    payload: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
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

export const SpiritStonesAttachmentSchema = z.object({
  type: z.literal('spirit_stones'),
  name: z.string().trim().min(1).max(100),
  quantity: z.number().int().min(1),
});

export const MaterialAttachmentDataSchema = z.object({
  name: z.string().trim().min(1).max(100),
  type: z.enum(MATERIAL_TYPE_VALUES),
  rank: z.enum(QUALITY_VALUES),
  element: z.enum(ELEMENT_VALUES).optional(),
  description: z.string().optional(),
  quantity: z.number().int().min(1),
});

export const MaterialAttachmentSchema = z.object({
  type: z.literal('material'),
  name: z.string().trim().min(1).max(100),
  quantity: z.number().int().min(1),
  data: MaterialAttachmentDataSchema,
});

export const ConsumableAttachmentDataSchema = z.object({
  name: z.string().trim().min(1).max(100),
  type: z.enum(CONSUMABLE_TYPE_VALUES),
  quality: z.enum(QUALITY_VALUES).optional(),
  quantity: z.number().int().min(1),
  description: z.string().optional(),
  prompt: z.string().optional(),
  score: z.number().int().optional(),
  spec: ConsumableSpecSchema,
});

export const ConsumableAttachmentSchema = z.object({
  type: z.literal('consumable'),
  name: z.string().trim().min(1).max(100),
  quantity: z.number().int().min(1),
  data: ConsumableAttachmentDataSchema,
});

export const ArtifactAttachmentDataSchema = z.object({
  name: z.string().trim().min(1).max(100),
  slot: z.enum(EQUIPMENT_SLOT_VALUES),
  element: z.enum(ELEMENT_VALUES),
  quality: z.enum(QUALITY_VALUES).optional(),
  description: z.string().optional(),
  effects: z.array(z.record(z.string(), z.unknown())).default([]),
});

export const ArtifactAttachmentSchema = z.object({
  type: z.literal('artifact'),
  name: z.string().trim().min(1).max(100),
  quantity: z.number().int().min(1),
  data: ArtifactAttachmentDataSchema,
});

export const MailAttachmentSchema = z.discriminatedUnion('type', [
  SpiritStonesAttachmentSchema,
  MaterialAttachmentSchema,
  ConsumableAttachmentSchema,
  ArtifactAttachmentSchema,
]);

export const MailAttachmentsSchema = z.array(MailAttachmentSchema);

const RewardCatalogItemIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9][a-z0-9_-]*$/i, '目录项 ID 仅支持字母、数字、_ 和 -');

const RewardCatalogMaterialDataSchema = MaterialAttachmentDataSchema.omit({
  quantity: true,
});

const RewardCatalogConsumableDataSchema = ConsumableAttachmentDataSchema.omit({
  quantity: true,
});

export const RewardCatalogItemSchema = z.discriminatedUnion('type', [
  z.object({
    id: RewardCatalogItemIdSchema,
    type: z.literal('material'),
    data: RewardCatalogMaterialDataSchema,
  }),
  z.object({
    id: RewardCatalogItemIdSchema,
    type: z.literal('consumable'),
    data: RewardCatalogConsumableDataSchema,
  }),
  z.object({
    id: RewardCatalogItemIdSchema,
    type: z.literal('artifact'),
    data: ArtifactAttachmentDataSchema,
  }),
]);

export const RewardCatalogSchema = z
  .array(RewardCatalogItemSchema)
  .superRefine((items, ctx) => {
    const seenIds = new Set<string>();

    items.forEach((item, index) => {
      if (seenIds.has(item.id)) {
        ctx.addIssue({
          code: 'custom',
          path: [index, 'id'],
          message: `目录项 ID 重复：${item.id}`,
        });
        return;
      }

      seenIds.add(item.id);
    });
  });

export const RewardSelectionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('spirit_stones'),
    quantity: z.number().int().min(1).max(100000000),
  }),
  z.object({
    type: z.literal('catalog_item'),
    itemId: RewardCatalogItemIdSchema,
    quantity: z.number().int().min(1).max(100000000),
  }),
]);

export const RewardSelectionsSchema = z.array(RewardSelectionSchema);

export type RewardCatalogItem = z.infer<typeof RewardCatalogItemSchema>;
export type RewardSelection = z.infer<typeof RewardSelectionSchema>;

function clonePlainData<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function cloneAttachment(attachment: MailAttachment): MailAttachment {
  return clonePlainData(attachment);
}

export function cloneRewardCatalogItem(
  item: RewardCatalogItem,
): RewardCatalogItem {
  return clonePlainData(item);
}

export function parseMailAttachments(input: unknown): MailAttachment[] {
  return MailAttachmentsSchema.parse(input) as MailAttachment[];
}

export function parseRewardCatalog(input: unknown): RewardCatalogItem[] {
  return RewardCatalogSchema.parse(input);
}

export function parseRewardSelections(input: unknown): RewardSelection[] {
  return RewardSelectionsSchema.parse(input);
}

export function getRewardCatalogItemName(item: RewardCatalogItem): string {
  return item.data.name;
}

export function buildAttachmentFromCatalogItem(
  item: RewardCatalogItem,
  quantity: number,
): MailAttachment {
  switch (item.type) {
    case 'material':
      return {
        type: 'material',
        name: item.data.name,
        quantity,
        data: {
          ...clonePlainData(item.data),
          quantity,
        } as MailAttachment['data'],
      };
    case 'consumable':
      return {
        type: 'consumable',
        name: item.data.name,
        quantity,
        data: {
          ...clonePlainData(item.data),
          quantity,
        } as MailAttachment['data'],
      };
    case 'artifact':
      return {
        type: 'artifact',
        name: item.data.name,
        quantity,
        data: clonePlainData(item.data) as MailAttachment['data'],
      };
  }
}

export class RewardCatalogResolveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RewardCatalogResolveError';
  }
}

export function resolveRewardSelections(
  rewardSelections: RewardSelection[],
  rewardCatalog: RewardCatalogItem[],
): MailAttachment[] {
  const itemMap = new Map(rewardCatalog.map((item) => [item.id, item]));

  return rewardSelections.map((selection) => {
    if (selection.type === 'spirit_stones') {
      return {
        type: 'spirit_stones',
        name: '灵石',
        quantity: selection.quantity,
      };
    }

    const item = itemMap.get(selection.itemId);
    if (!item) {
      throw new RewardCatalogResolveError(
        `奖励目录项不存在：${selection.itemId}`,
      );
    }

    return buildAttachmentFromCatalogItem(item, selection.quantity);
  });
}

export function summarizeMailAttachment(attachment: MailAttachment): string {
  return `${attachment.name} x${attachment.quantity}`;
}

export function summarizeMailAttachments(attachments: MailAttachment[]): string[] {
  return attachments.map((attachment) => summarizeMailAttachment(cloneAttachment(attachment)));
}
