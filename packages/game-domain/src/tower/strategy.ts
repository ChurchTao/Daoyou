import { z } from 'zod';

export const TOWER_STRATEGY_VERSION = 'combat-v6-tower-v8' as const;

const trait = z.strictObject({
  id: z.string().min(1),
  targetEnemyId: z.string().min(1).optional(),
});

const share = z.number().positive().max(1);

export const TowerFloorStrategySchema = z.strictObject({
  floor: z.number().int().min(1).max(20),
  kind: z.enum(['normal', 'elite', 'boss']),
  budget: z.strictObject({ hpScale: z.number().positive().max(1) }),
  enemies: z
    .array(
      z.strictObject({
        id: z
          .string()
          .regex(/^[a-zA-Z0-9_.-]+$/)
          .max(60),
        archetype: z.string().min(1),
        behaviorId: z.string().min(1),
        role: z.enum(['leader', 'striker', 'support']),
        traits: z.array(trait).max(8),
        budgetShare: z.strictObject({ hp: share, output: share }),
      }),
    )
    .min(1)
    .max(3),
});

export type TowerFloorStrategy = z.infer<typeof TowerFloorStrategySchema>;

export type TowerEnemyStrategy = TowerFloorStrategy['enemies'][number];

export type TowerTraitId = TowerEnemyStrategy['traits'][number]['id'];
