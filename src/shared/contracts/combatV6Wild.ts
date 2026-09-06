import type { WildRuntimeSnapshot } from '@shared/engine/combat-v6/wild/host';
import type { WildResources } from '@shared/engine/combat-v6/wild/rules';
import { z } from 'zod';
import type { CombatV6TrainingSessionViewV1 } from './combatV6';
import type { CombatV6RedisRuntimeV1 } from './combatV6Runtime';
import { CombatV6BattleMetadataV1Schema } from './combatV6Runtime';

export const WildExploreRequestSchema = z
  .object({ nodeId: z.string().min(1).max(100), requestId: z.uuid() })
  .strict();
export const WildResourcesSchema = z
  .object({
    hp: z.number().finite().nonnegative(),
    mp: z.number().finite().nonnegative(),
    maxHp: z.number().finite().positive(),
    maxMp: z.number().finite().nonnegative(),
  })
  .strict();
export type WildRuntime = Omit<CombatV6RedisRuntimeV1, 'metadata' | 'host'> & {
  metadata: Extract<
    z.infer<typeof CombatV6BattleMetadataV1Schema>,
    { sourceType: 'wild-encounter' }
  >;
  host: WildRuntimeSnapshot;
};
export const WildRuntimeSchema = z
  .object({
    runtimeVersion: z.literal('combat_v6_redis_runtime_v1'),
    battleId: z.uuid(),
    userId: z.uuid(),
    cultivatorId: z.uuid(),
    membershipId: z.uuid(),
    buildRevision: z.number().int().nonnegative(),
    metadata: CombatV6BattleMetadataV1Schema,
    revision: z.number().int().nonnegative(),
    createdAt: z.iso.datetime(),
    expiresAt: z.iso.datetime(),
    latestEventSeq: z.number().int().min(-1),
    host: z
      .object({
        schemaVersion: z.literal(1),
        hostVersion: z.literal('combat_v6_wild_runtime_v1'),
        nodeId: z.string().min(1),
        playerId: z.string().min(1),
        input: z
          .object({
            seed: z.number().int(),
            versions: z
              .object({
                engineVersion: z.literal('combat-v6'),
                rulesetVersion: z.literal('daoyou_rules_v5'),
                contentVersion: z.literal('daoyou_wild_encounter_content_v1'),
                projectionVersion: z.literal('wild_encounter_v1'),
              })
              .strict(),
            units: z.array(z.record(z.string(), z.unknown())).min(2).max(4),
            skills: z.array(z.record(z.string(), z.unknown())),
            statusDefs: z.array(z.record(z.string(), z.unknown())),
          })
          .strict(),
        npcStrategies: z.record(
          z.string(),
          z.discriminatedUnion('type', [
            z.object({ type: z.literal('attack') }).strict(),
            z.object({ type: z.literal('defend') }).strict(),
            z
              .object({
                type: z.literal('skill-rotation'),
                skillIds: z.array(z.string()).min(1),
              })
              .strict(),
          ]),
        ),
        combatants: z
          .array(
            z
              .object({
                unitId: z.string(),
                speciesId: z.string(),
                level: z.number().int().min(5).max(15),
              })
              .strict(),
          )
          .min(1)
          .max(3),
        state: z
          .object({
            round: z.number().int().positive(),
            rngState: z.number().int(),
            units: z.array(z.record(z.string(), z.unknown())).min(2).max(4),
          })
          .passthrough(),
        rounds: z.array(z.unknown()),
        events: z.array(z.unknown()),
      })
      .strict(),
  })
  .strict()
  .refine(
    (v) =>
      v.metadata.sourceType === 'wild-encounter' &&
      v.metadata.payload.nodeId === v.host.nodeId &&
      v.latestEventSeq === v.host.events.length - 1,
  );
export interface WildSettlement {
  schemaVersion: 1;
  battleId: string;
  userId: string;
  cultivatorId: string;
  membershipId: string;
  metadata: WildRuntime['metadata'];
  combatVersions: WildRuntimeSnapshot['state']['versions'];
  createdAt: string;
  expiresAt: string;
  revision: number;
  round: number;
  entry: WildResources;
  final: WildResources;
}
export const WildSettlementSchema = z
  .object({
    schemaVersion: z.literal(1),
    battleId: z.uuid(),
    userId: z.uuid(),
    cultivatorId: z.uuid(),
    membershipId: z.uuid(),
    metadata: CombatV6BattleMetadataV1Schema,
    combatVersions: z
      .object({
        engineVersion: z.string(),
        rulesetVersion: z.string(),
        contentVersion: z.string(),
        projectionVersion: z.string(),
      })
      .strict(),
    createdAt: z.iso.datetime(),
    expiresAt: z.iso.datetime(),
    revision: z.number().int().nonnegative(),
    round: z.number().int().positive(),
    entry: WildResourcesSchema,
    final: WildResourcesSchema,
  })
  .strict()
  .refine((v) => v.metadata.sourceType === 'wild-encounter');
export type WildSessionView = Omit<
  CombatV6TrainingSessionViewV1,
  'encounterId' | 'tier'
> & { nodeId: string; settlement: 'pending' | 'settled' | 'not-started' };
