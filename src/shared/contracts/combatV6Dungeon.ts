import { z } from 'zod';
import type { CombatV6TrainingSessionViewV1 } from './combatV6';
export const DungeonFlowRequestSchema = z
  .object({
    expected: z
      .object({
        runId: z.uuid(),
        round: z.number().int().positive(),
        status: z.string().min(1).max(40),
        pendingActionId: z.uuid().nullable(),
      })
      .strict(),
  })
  .strict();
export type DungeonExpectedState = z.infer<
  typeof DungeonFlowRequestSchema
>['expected'];
export const DungeonMaterialSelectionsSchema = z
  .array(
    z
      .object({
        costIndex: z.number().int().min(0).max(31),
        items: z
          .array(
            z
              .object({
                itemId: z.string().min(1).max(160),
                revision: z.number().int().nonnegative(),
                quantity: z.number().int().positive().max(9999),
              })
              .strict(),
          )
          .min(1)
          .max(40),
      })
      .strict(),
  )
  .max(32);
export type DungeonMaterialSelection = z.infer<
  typeof DungeonMaterialSelectionsSchema
>[number];
export const DungeonActionRequestSchema = z
  .object({
    choiceId: z.number().int(),
    actionId: z.uuid(),
    runId: z.uuid(),
    round: z.number().int().positive(),
    materialSelections: DungeonMaterialSelectionsSchema.default([]),
  })
  .strict();
export const DungeonBeginBattleRequestSchema = z
  .object({ encounterId: z.uuid() })
  .strict();
export interface DungeonEncounterView {
  id: string;
  description: string;
  enemies: string[];
  hp: { current: number; max: number };
  mp: { current: number; max: number };
  beast: string | null;
}
export type DungeonSessionView = Omit<
  CombatV6TrainingSessionViewV1,
  'encounterId' | 'tier'
>;
