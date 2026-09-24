import { z } from 'zod';
import { isTalismanScenario } from '../config/talismanScenarios';
import { isOpenEquipmentLevel } from '../engine/combat-v6/equipment/realm';
import { DAO_WEAPON_TYPES } from '../engine/combat-v6/equipment/weapons';
import { QUALITY_VALUES } from '../types/constants';
import {
  ALCHEMY_PROPERTY_KEY_VALUES,
  PILL_APPEARANCE_GRADE_VALUES,
  PILL_FAMILY_VALUES,
} from '../types/consumable';

export const AdminItemGenerationSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('pill'),
      name: z.string().trim().min(1).max(100),
      quality: z.enum(QUALITY_VALUES),
      effects: z.array(z.enum(ALCHEMY_PROPERTY_KEY_VALUES)).min(1).max(3),
      appearance: z.enum(PILL_APPEARANCE_GRADE_VALUES),
    })
    .strict(),
  z
    .object({
      kind: z.literal('spirit_fruit'),
      name: z.string().trim().min(1).max(100),
      quality: z.enum(QUALITY_VALUES),
      family: z.enum(PILL_FAMILY_VALUES),
    })
    .strict(),
  z
    .object({
      kind: z.literal('talisman'),
      scenario: z.string().refine(isTalismanScenario, '符箓玩法已停用'),
    })
    .strict(),
  z
    .object({
      kind: z.literal('equipment'),
      templateId: z.string().min(1),
      equipmentLevel: z.number().int().refine(isOpenEquipmentLevel),
      baseQuality: z.number().min(0).max(1),
      weaponType: z.enum(DAO_WEAPON_TYPES).optional(),
    })
    .strict(),
]);
