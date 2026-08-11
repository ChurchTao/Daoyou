import { z } from 'zod';

const BattleIdentifierSchema = z.string().min(1).max(160);

const BattleBasicAttackIntentSchema = z.object({
  kind: z.literal('basic_attack'),
  targetUnitId: BattleIdentifierSchema.optional(),
}).strict();

const BattleAbilityIntentSchema = z.object({
  kind: z.literal('ability'),
  abilityId: BattleIdentifierSchema,
  targetUnitId: BattleIdentifierSchema.optional(),
}).strict();

export const BattleBoardgameMovePayloadSchema = z.object({
  requestId: z.string().uuid(),
  round: z.number().int().positive().max(1_000_000),
  checkpointRevision: z.number().int().nonnegative().max(2_147_483_647),
  intents: z.record(
    BattleIdentifierSchema,
    z.discriminatedUnion('kind', [
      BattleBasicAttackIntentSchema,
      BattleAbilityIntentSchema,
    ]),
  ).refine((intents) => Object.keys(intents).length <= 4, {
    message: 'At most four battle intents are allowed',
  }),
}).strict();

export type BattleBoardgameMovePayloadV1 = z.infer<
  typeof BattleBoardgameMovePayloadSchema
>;
