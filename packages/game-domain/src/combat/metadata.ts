import { z } from 'zod';


export const CombatV6TrainingBattleMetadataV1Schema = z
  .object({
    schemaVersion: z.literal(1),
    sourceType: z.literal('training-room'),
    battleType: z.literal('training'),
    idempotencyKey: z.uuid(),
    payload: z
      .object({
        encounterId: z.string().min(1).max(160),
        tier: z.union([z.literal(60), z.literal(120), z.literal(180)]),
      })
      .strict(),
  })
  .strict();


export const CombatV6BattleMetadataV1Schema = z.discriminatedUnion(
  'sourceType',
  [
    CombatV6TrainingBattleMetadataV1Schema,
    z
      .object({
        schemaVersion: z.literal(1),
        sourceType: z.literal('breakthrough'),
        battleType: z.literal('pve'),
        idempotencyKey: z.uuid(),
        payload: z
          .object({ taskId: z.uuid(), challengeId: z.string().min(1) })
          .strict(),
      })
      .strict(),
    z
      .object({
        schemaVersion: z.literal(1),
        sourceType: z.literal('sect-task'),
        battleType: z.literal('pve'),
        idempotencyKey: z.uuid(),
        payload: z
          .object({ recordId: z.uuid(), taskId: z.string().min(1) })
          .strict(),
      })
      .strict(),
    z
      .object({
        schemaVersion: z.literal(1),
        sourceType: z.literal('ranking'),
        battleType: z.literal('pvp'),
        idempotencyKey: z.uuid(),
        payload: z.object({ realm: z.string(), day: z.string() }).strict(),
      })
      .strict(),
    z
      .object({
        schemaVersion: z.literal(1),
        sourceType: z.literal('tower'),
        battleType: z.literal('pve'),
        idempotencyKey: z.uuid(),
        payload: z
          .object({ runId: z.uuid(), floor: z.number().int().min(1).max(20) })
          .strict(),
      })
      .strict(),
    z
      .object({
        schemaVersion: z.literal(1),
        sourceType: z.literal('dungeon'),
        battleType: z.literal('pve'),
        idempotencyKey: z.uuid(),
        payload: z
          .object({ runId: z.uuid(), nodeId: z.string().min(1) })
          .strict(),
      })
      .strict(),
    z
      .object({
        schemaVersion: z.literal(1),
        sourceType: z.literal('wild-encounter'),
        battleType: z.literal('pve'),
        idempotencyKey: z.string().min(1).max(200),
        payload: z
          .object({
            nodeId: z.string().min(1),
            encounterContentVersion: z.string().min(1),
            combatants: z
              .array(
                z
                  .object({
                    unitId: z.string().min(1),
                    speciesId: z.string().min(1),
                    level: z.number().int().min(0).max(180),
                  })
                  .strict(),
              )
              .min(1)
              .max(3),
          })
          .strict(),
      })
      .strict(),
  ],
);

export type CombatV6BattleMetadataV1 = z.infer<
  typeof CombatV6BattleMetadataV1Schema
>;
