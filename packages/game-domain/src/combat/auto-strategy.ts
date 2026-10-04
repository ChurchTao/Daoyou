import { z } from 'zod';


export const MAX_AUTO_STRATEGY_RULES = 10;

const comparison = z.enum(['lt', 'lte', 'gt', 'gte']);

export type AutoComparison = z.infer<typeof comparison>;


const condition = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('selfHpBelow'),
    percent: z.number().int().min(1).max(100),
    comparison: comparison.optional(),
  }),
  z.strictObject({
    type: z.literal('allyHpBelow'),
    percent: z.number().int().min(1).max(100),
    comparison: comparison.optional(),
  }),
  z.strictObject({
    type: z.literal('enemyHpBelow'),
    percent: z.number().int().min(1).max(100),
    comparison: comparison.optional(),
  }),
  z.strictObject({ type: z.literal('allyDowned') }),
  z.strictObject({
    type: z.literal('targetHpBelow'),
    percent: z.number().int().min(1).max(100),
    comparison: comparison.optional(),
  }),
  z.strictObject({
    type: z.literal('enemyCountAtLeast'),
    count: z.number().int().min(1).max(6),
    comparison: comparison.optional(),
  }),
  z.strictObject({
    type: z.literal('selfResourceAtLeast'),
    resourceId: z.string().min(1).max(120),
    amount: z.number().int().min(0).max(10000),
    comparison: comparison.optional(),
  }),
  z.strictObject({
    type: z.literal('selfStatus'),
    kind: z.string().min(1).max(120),
    statusId: z.string().min(1).max(160).optional(),
    present: z.boolean(),
  }),
  z.strictObject({
    type: z.literal('targetStatus'),
    kind: z.string().min(1).max(120),
    statusId: z.string().min(1).max(160).optional(),
    present: z.boolean(),
    ownedBySelf: z.boolean(),
  }),
  z.strictObject({
    type: z.literal('allyStatus'),
    kind: z.string().min(1).max(120),
    statusId: z.string().min(1).max(160).optional(),
    present: z.boolean(),
    ownedBySelf: z.boolean(),
  }),
]);


const rule = z.strictObject({
  conditions: z.array(condition).max(3),
  action: z.discriminatedUnion('type', [
    z.strictObject({
      type: z.literal('skill'),
      skillId: z.string().min(1).max(160),
    }),
    z.strictObject({ type: z.literal('attack') }),
    z.strictObject({ type: z.literal('defend') }),
  ]),
  target: z.enum(['best', 'lowestHpEnemy', 'lowestHpAlly']).default('best'),
  targetScope: z.enum(['any', 'allyPet', 'ownPet', 'teammatePlayer']).optional(),
});

// Existing saved and in-progress battles may still contain 11–12 rules.
export const AutoStrategySchema = z.strictObject({
  version: z.literal(1),
  rules: z.array(rule).max(12),
});

export const SaveAutoStrategySchema = z.strictObject({
  version: z.literal(1),
  rules: z.array(rule).max(MAX_AUTO_STRATEGY_RULES),
});

export type AutoStrategy = z.infer<typeof AutoStrategySchema>;
