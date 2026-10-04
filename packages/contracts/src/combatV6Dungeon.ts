import { DungeonMaterialSelectionsSchema } from '@daoyou/game-domain/dungeon';
import { z } from 'zod';

import type { CombatV6TrainingSessionViewV1 } from './combatV6.js';

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

export type DungeonSessionView = Omit<
  CombatV6TrainingSessionViewV1,
  'encounterId' | 'tier'
>;
