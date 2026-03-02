import type { MailAttachment } from '@/lib/services/MailService';
import {
  CONSUMABLE_TYPE_VALUES,
  ELEMENT_VALUES,
  EQUIPMENT_SLOT_VALUES,
  MATERIAL_TYPE_VALUES,
  QUALITY_VALUES,
  REALM_VALUES,
} from '@/types/constants';
import redeemRewardPresetsRaw from './redeemRewardPresets.json';
import { z } from 'zod';

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
    effects: z.array(z.record(z.string(), z.unknown())).default([]),
    details: z.record(z.string(), z.unknown()).optional(),
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
    required_realm: z.enum(REALM_VALUES).optional(),
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
