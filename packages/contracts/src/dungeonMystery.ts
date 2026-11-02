import {
  MysteryActionSchema,
  MysteryAnswersSchema,
} from '@daoyou/game-domain/dungeon/mystery';
import { z } from 'zod';

export const DungeonMysteryActRequestSchema = z
  .object({
    runId: z.uuid(),
    actionId: z.uuid(),
    turn: z.number().int().nonnegative(),
    action: MysteryActionSchema,
  })
  .strict();

export type DungeonMysteryActRequest = z.infer<
  typeof DungeonMysteryActRequestSchema
>;

export const DungeonMysteryDeduceRequestSchema = z
  .object({
    runId: z.uuid(),
    answers: MysteryAnswersSchema,
  })
  .strict();

export type DungeonMysteryDeduceRequest = z.infer<
  typeof DungeonMysteryDeduceRequestSchema
>;
