import { ELEMENT_VALUES } from '@daoyou/constants/elements';
import { QUALITY_VALUES, type Quality } from '@daoyou/constants/qualities';
import { z } from 'zod';
import { ALCHEMY_PROPERTY_KEY_VALUES } from '../consumable.js';
import type { ExorcismGrade } from '../dungeon/exorcism.js';
import type { ItemGrant } from '../items/inventory.js';
import { INVENTORY_MATERIAL_TYPES } from '../items/material-facts.js';

export const CONTEST_ATTEMPTS = 3;
export const CONTEST_QI = 7;
export const CONTEST_MATERIAL_STOCK = 3;
export const CONTEST_DURATION_MS = 30 * 60_000;
export const CONTEST_NODE_ID = 'SAT_LX_ALCHEMY';
export const CONTEST_HEAT = { gentle: 1, steady: 2, fierce: 3 } as const;
export type ContestHeat = keyof typeof CONTEST_HEAT;

const property = z.enum(ALCHEMY_PROPERTY_KEY_VALUES);
const paragraph = z.string().trim().min(1).max(240);
export const ContestPropertiesSchema = z
  .array(
    z.object({
      key: property,
      weight: z.number().gt(0).max(1),
    }),
  )
  .min(1)
  .max(3)
  .refine(
    (values) =>
      new Set(values.map((value) => value.key)).size === values.length &&
      Math.abs(values.reduce((sum, value) => sum + value.weight, 0) - 1) <=
        0.011,
  );

export const ContestMaterialDraftSchema = z.object({
  name: z.string().trim().min(2).max(24),
  description: paragraph,
  type: z
    .enum(INVENTORY_MATERIAL_TYPES)
    .exclude(['gongfa_manual', 'skill_manual']),
  rank: z.enum(QUALITY_VALUES),
  element: z.enum(ELEMENT_VALUES),
  properties: ContestPropertiesSchema,
});
export const ContestMaterialSchema = ContestMaterialDraftSchema.extend({
  id: z.string().min(1).max(120),
});
export const ContestQuestionDraftSchema = z.object({
  title: z.string().trim().min(2).max(24),
  brief: paragraph,
  primary: property,
  secondary: property.nullable(),
});
export const ContestQuestionSchema = ContestQuestionDraftSchema.extend({
  pillName: z.string().trim().min(2).max(16),
  minimumStrength: z.number().positive(),
  maximumToxicity: z.number().int().min(0).max(100),
  strengthForFullScore: z.number().positive(),
  quantityForFullScore: z.number().int().positive(),
});
export const ContestPaperSchema = z
  .object({
    rulesVersion: z.literal(1),
    question: ContestQuestionSchema,
    materials: z.array(ContestMaterialSchema).length(16),
  })
  .refine(
    ({ materials, question }) =>
      new Set(materials.map(({ id }) => id)).size === 16 &&
      new Set(materials.map(({ name }) => name)).size === 16 &&
      question.primary !== question.secondary &&
      (question.secondary === null ||
        (question.primary !== 'beast_cultivation' &&
          question.secondary !== 'beast_cultivation')) &&
      question.strengthForFullScore >= question.minimumStrength,
  );

export type ContestMaterial = z.infer<typeof ContestMaterialSchema>;
export type ContestQuestionDraft = z.infer<typeof ContestQuestionDraftSchema>;
export type ContestQuestion = z.infer<typeof ContestQuestionSchema>;
export type ContestPaper = z.infer<typeof ContestPaperSchema>;
export type ContestDose = { materialId: string; dose: number };
export type ContestRecipe = { doses: ContestDose[]; heat: ContestHeat };
export type ContestEffect = { key: z.infer<typeof property>; value: number };
export type ContestLot = { quality: Quality; quantity: number };
export type ContestFurnace = {
  effects: ContestEffect[];
  lots: ContestLot[];
  qualifiedLots: ContestLot[];
  stability: number;
  purity: number;
  toxicity: number;
  appearance: 'low' | 'middle' | 'high' | 'perfect';
  qualified: boolean;
  reason: 'empty' | 'primary' | 'secondary' | 'toxicity' | 'strength' | null;
  points: {
    effect: number;
    quality: number;
    quantity: number;
    appearance: number;
    time: number;
  };
  score: number;
};
export type ContestAttempt = ContestFurnace &
  ContestRecipe & { acceptedAt: string };
export type ContestStanding = {
  score: number;
  effectScore: number;
  usedMaterials: number;
};
export type ContestStandingDetail = ContestStanding & {
  materialPoints: number;
  qiPoints: number;
  bestAttempt: number;
};
export type ContestCompletionReward = {
  grade: ExorcismGrade;
  cultivationExp: number;
  spiritStones: number;
  insight: number;
  items: ItemGrant[];
};
