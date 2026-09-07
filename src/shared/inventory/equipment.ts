import { z } from 'zod';
import { DAO_EQUIPMENT_SLOTS } from '../engine/combat-v6/equipment';
export const EQUIPMENT_ATTRIBUTE_NAMES = {
  physicalAtk: '物攻',
  physicalDef: '物防',
  magicAtk: '法攻',
  magicDef: '法防',
  maxHp: '气血',
  maxMp: '法力',
  healPower: '治疗',
  speed: '速度',
  hit: '命中',
  dodge: '闪避',
  critRate: '暴击',
  spellCritRate: '法暴',
  physicalFuryRate: '物理狂暴',
  sealHit: '封印命中',
  sealResist: '封印抵抗',
  vitality: '体质',
  strength: '力量',
  spirit: '灵力',
  endurance: '耐力',
  willpower: '意志',
};
const roll = z
  .object({
    attr: z.enum(
      Object.keys(EQUIPMENT_ATTRIBUTE_NAMES) as [
        keyof typeof EQUIPMENT_ATTRIBUTE_NAMES,
        ...(keyof typeof EQUIPMENT_ATTRIBUTE_NAMES)[],
      ],
    ),
    value: z.number().finite(),
  })
  .strict();
export const InventoryEquipmentSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: z.string().min(1),
    templateId: z.string().min(1),
    name: z.string().min(1).max(100),
    slot: z.enum(DAO_EQUIPMENT_SLOTS),
    equipmentLevel: z.number().int().nonnegative(),
    requiredLevel: z.number().int().nonnegative(),
    baseStats: z.array(roll).max(20),
    attributeBonuses: z.array(roll).max(20),
    essenceIds: z.array(z.string()).max(20),
    artId: z.string().optional(),
    formationInscription: z
      .object({ patternId: z.string(), level: z.number().int().nonnegative() })
      .strict()
      .optional(),
    appraisalState: z.literal('appraised'),
    generatorVersion: z.enum([
      'dao_equipment_generator_v1',
      'dao_equipment_generator_v2',
      'dao_equipment_generator_v3',
    ]),
    createdAt: z.string(),
  })
  .strict();
