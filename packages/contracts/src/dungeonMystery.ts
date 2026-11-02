import {
  MysteryActionSchema,
  MysteryAnswersSchema,
  MysteryIdSchema,
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

export const DungeonMysteryTalkRequestSchema = z
  .object({
    runId: z.uuid(),
    actionId: z.uuid(),
    turn: z.number().int().nonnegative(),
    npcId: MysteryIdSchema,
    question: z.string().trim().min(1).max(80),
  })
  .strict();

export type DungeonMysteryTalkRequest = z.infer<
  typeof DungeonMysteryTalkRequestSchema
>;

/** 强闯守卫：先进入遭遇战，战斗结束后回到调查。 */
export const DungeonMysteryGuardRequestSchema = z
  .object({
    runId: z.uuid(),
    actionId: z.uuid(),
    turn: z.number().int().nonnegative(),
    guardId: MysteryIdSchema,
  })
  .strict();

export type DungeonMysteryGuardRequest = z.infer<
  typeof DungeonMysteryGuardRequestSchema
>;
