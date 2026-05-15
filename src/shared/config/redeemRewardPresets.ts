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
  TALISMAN_SESSION_MODE_VALUES,
} from '@shared/types/consumable';
import redeemRewardPresetsRaw from './redeemRewardPresets.json';
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
]);

const PillSpecSchema = z.object({
  kind: z.literal('pill'),
  family: z.enum(PILL_FAMILY_VALUES),
  operations: z.array(ConditionOperationSchema),
  consumeRules: z.object({
    scene: z.literal('out_of_battle_only'),
    countsTowardLongTermQuota: z.boolean(),
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

const SpiritStonesAttachmentSchema = z.object({
  type: z.literal('spirit_stones'),
  name: z.string().trim().min(1).max(100),
  quantity: z.number().int().min(1),
});

const MaterialAttachmentSchema = z.object({
  type: z.literal('material'),
  name: z.string().trim().min(1).max(100),
  quantity: z.number().int().min(1),
  data: z.object({
    name: z.string().trim().min(1).max(100),
    type: z.enum(MATERIAL_TYPE_VALUES),
    rank: z.enum(QUALITY_VALUES),
    element: z.enum(ELEMENT_VALUES).optional(),
    description: z.string().optional(),
    quantity: z.number().int().min(1),
  }),
});

const ConsumableAttachmentSchema = z.object({
  type: z.literal('consumable'),
  name: z.string().trim().min(1).max(100),
  quantity: z.number().int().min(1),
  data: z.object({
    name: z.string().trim().min(1).max(100),
    type: z.enum(CONSUMABLE_TYPE_VALUES),
    quality: z.enum(QUALITY_VALUES).optional(),
    quantity: z.number().int().min(1),
    description: z.string().optional(),
    prompt: z.string().optional(),
    score: z.number().int().optional(),
    spec: ConsumableSpecSchema,
  }),
});

const ArtifactAttachmentSchema = z.object({
  type: z.literal('artifact'),
  name: z.string().trim().min(1).max(100),
  quantity: z.number().int().min(1),
  data: z.object({
    name: z.string().trim().min(1).max(100),
    slot: z.enum(EQUIPMENT_SLOT_VALUES),
    element: z.enum(ELEMENT_VALUES),
    quality: z.enum(QUALITY_VALUES).optional(),
    description: z.string().optional(),
    effects: z.array(z.record(z.string(), z.unknown())).default([]),
  }),
});

const RedeemAttachmentSchema = z.union([
  SpiritStonesAttachmentSchema,
  MaterialAttachmentSchema,
  ConsumableAttachmentSchema,
  ArtifactAttachmentSchema,
]);

const RedeemRewardPresetSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(500),
  attachments: z.array(RedeemAttachmentSchema).min(1),
});

export const RedeemRewardPresetsSchema = z.record(
  z.string(),
  RedeemRewardPresetSchema,
);

export function parseRedeemRewardPresets(input: unknown) {
  return RedeemRewardPresetsSchema.parse(input);
}

const redeemRewardPresets = parseRedeemRewardPresets(redeemRewardPresetsRaw);

export type RedeemRewardPresetId = keyof typeof redeemRewardPresets;
export type RedeemRewardPreset = (typeof redeemRewardPresets)[string];

function cloneAttachments(attachments: MailAttachment[]): MailAttachment[] {
  return attachments.map((attachment) => ({
    ...attachment,
    data:
      attachment.data && typeof attachment.data === 'object'
        ? { ...attachment.data }
        : undefined,
  }));
}

export function getRedeemPresetOptions() {
  return Object.entries(redeemRewardPresets).map(([id, preset]) => ({
    id,
    name: preset.name,
    description: preset.description,
  }));
}

export function getRedeemPresetById(id: string) {
  const preset = redeemRewardPresets[id];
  if (!preset) return null;
  return {
    id,
    name: preset.name,
    description: preset.description,
    attachments: cloneAttachments(preset.attachments as MailAttachment[]),
  };
}
