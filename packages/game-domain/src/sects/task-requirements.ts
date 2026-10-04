import { z } from 'zod';
import { QUALITY_VALUES } from '@daoyou/constants/qualities';
import {
  PILL_APPEARANCE_GRADE_VALUES,
  PILL_FAMILY_VALUES,
} from '../consumable.js';
import { DAO_EQUIPMENT_SLOTS } from '../equipment/types.js';
import { MATERIAL_TYPE_VALUES } from '../inventory.js';

export const SECT_PILL_TRAIT_KEYS = [
  'restore_hp',
  'restore_mp',
  'detox',
  'gain_cultivation',
  'gain_insight',
  'breakthrough_support',
  'tempering',
  'marrow_wash',
  'increase_lifespan',
] as const;

export type SectPillTraitKey = (typeof SECT_PILL_TRAIT_KEYS)[number];

export type SectSubmissionItemKind = 'pill' | 'equipment' | 'material';

export type SectPillDeliveryRequirement = z.infer<
  ReturnType<
    typeof createSectDeliveryRequirementSchemas
  >['SectPillDeliveryRequirementSchema']
>;

export type SectEquipmentDeliveryRequirement = z.infer<
  ReturnType<
    typeof createSectDeliveryRequirementSchemas
  >['SectEquipmentDeliveryRequirementSchema']
>;

export type SectMaterialDeliveryRequirement = z.infer<
  ReturnType<
    typeof createSectDeliveryRequirementSchemas
  >['SectMaterialDeliveryRequirementSchema']
>;

export type SectDeliveryRequirement = z.infer<
  ReturnType<
    typeof createSectDeliveryRequirementSchemas
  >['SectDeliveryRequirementSchema']
>;

/** Bind the full delivery validator to the active task quantity policy. */
export function createSectDeliveryRequirementSchemas(quantity: {
  pill: 1;
  equipment: 1;
  material: { min: number; max: number };
}) {
  const QualitySchema = z.enum(QUALITY_VALUES);
  const AppearanceSchema = z.enum(PILL_APPEARANCE_GRADE_VALUES);

  const SectPillDeliveryRequirementSchema = z
    .object({
      kind: z.literal('pill'),
      quantity: z.literal(quantity.pill),
      minQuality: QualitySchema,
      family: z.enum(PILL_FAMILY_VALUES),
      trait: z.enum(SECT_PILL_TRAIT_KEYS),
      appearance: z.object({
        mode: z.enum(['at_least', 'exact']),
        grade: AppearanceSchema,
      }),
    })
    .strict();

  const SectEquipmentDeliveryRequirementSchema = z
    .object({
      kind: z.literal('equipment'),
      quantity: z.literal(quantity.equipment),
      minEquipmentLevel: z.number().int().min(10).max(180).multipleOf(10),
      slot: z.enum(DAO_EQUIPMENT_SLOTS),
      mustBeUnequipped: z.literal(true),
    })
    .strict();

  const SectMaterialDeliveryRequirementSchema = z
    .object({
      kind: z.literal('material'),
      quantity: z
        .number()
        .int()
        .min(quantity.material.min)
        .max(quantity.material.max),
      minQuality: QualitySchema,
      materialType: z.enum(MATERIAL_TYPE_VALUES),
      element: z
        .enum(['金', '木', '水', '火', '土', '风', '雷', '冰'])
        .optional(),
    })
    .strict();

  const SectDeliveryRequirementSchema = z.discriminatedUnion('kind', [
    SectPillDeliveryRequirementSchema,
    SectEquipmentDeliveryRequirementSchema,
    SectMaterialDeliveryRequirementSchema,
  ]);

  return {
    SectPillDeliveryRequirementSchema,
    SectEquipmentDeliveryRequirementSchema,
    SectMaterialDeliveryRequirementSchema,
    SectDeliveryRequirementSchema,
  };
}
