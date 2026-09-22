import type { WildRuntimeSnapshot } from '@shared/engine/combat-v6/wild/host';
import type { WildResources } from '@shared/engine/combat-v6/wild/rules';
import { z } from 'zod';
import { DropPoolSchema, type DropPool } from '../drops';
import { BeastSchema, type SummonedBeast } from '../engine/combat-v6/beasts';
import {
  WildCombatantSchema,
  WildIndividualSchema,
} from '../engine/combat-v6/wild/generator';
import type { WildRegion } from '../engine/combat-v6/wild/pack';
import { ItemGrantSchema, type ItemGrant } from '../inventory';
import type { CombatV6TrainingSessionViewV1 } from './combatV6';
import { CombatV6ReplayTimelineSchema } from './combatV6Replay';
import type { CombatV6RedisRuntimeV1 } from './combatV6Runtime';
import { CombatV6BattleMetadataV1Schema } from './combatV6Runtime';

export const WildExploreRequestSchema = z
  .object({ nodeId: z.string().min(1).max(100), requestId: z.uuid() })
  .strict();
export const WildStartRequestSchema = z
  .object({ encounterId: z.uuid() })
  .strict();
export const WildEncounterSchema = z
  .object({
    id: z.uuid(),
    nodeId: z.string().min(1),
    seed: z.number().int(),
    createdAt: z.iso.datetime(),
    combatants: z.array(WildIndividualSchema).min(1).max(3),
  })
  .strict();
export type WildEncounter = z.infer<typeof WildEncounterSchema>;
export type WildEncounterView = Pick<
  WildEncounter,
  'id' | 'nodeId' | 'createdAt'
> & {
  combatants: z.infer<typeof WildCombatantSchema>[];
};
export type WildRegionView = WildRegion & {
  qiCost: number;
  encounter: WildEncounterView | null;
  settlingBattleId: string | null;
  trainingSessionId: string | null;
};
export function wildEncounterView(encounter: WildEncounter): WildEncounterView {
  return {
    id: encounter.id,
    nodeId: encounter.nodeId,
    createdAt: encounter.createdAt,
    combatants: encounter.combatants.map(
      ({ unitId, speciesId, level, isMutant }) => ({
        unitId,
        speciesId,
        level,
        ...(isMutant ? { isMutant: true } : {}),
      }),
    ),
  };
}
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
  dropPool: DropPool;
  /** Frozen terminal display; settlement facts may be removed after delivery. */
  itemRewards?: ItemGrant[];
};
export const WildRuntimeSchema = z
  .object({
    runtimeVersion: z.literal('combat_v6_redis_runtime_v1'),
    battleId: z.uuid(),
    userId: z.uuid(),
    cultivatorId: z.uuid(),
    membershipId: z.uuid(),
    metadata: CombatV6BattleMetadataV1Schema,
    revision: z.number().int().nonnegative(),
    createdAt: z.iso.datetime(),
    expiresAt: z.iso.datetime(),
    latestEventSeq: z.number().int().min(-1),
    itemRewards: z.array(ItemGrantSchema).max(100).optional(),
    dropPool: DropPoolSchema,
    host: z
      .object({
        schemaVersion: z.literal(1),
        hostVersion: z.literal('combat_v6_wild_runtime_v1'),
        nodeId: z.string().min(1),
        playerId: z.string().min(1),
        input: z
          .object({
            seed: z.number().int(),
            unitAppearances: z.record(z.string(), z.unknown()).optional(),
            versions: z
              .object({
                engineVersion: z.literal('combat-v6'),
                rulesetVersion: z.enum(['daoyou_rules_v8', 'daoyou_rules_v9']),
                contentVersion: z.literal('daoyou_wild_seeking_content_v2'),
                projectionVersion: z.literal('wild_individual_v3'),
                autoPolicyVersion: z.string().min(1).optional(),
              })
              .strict(),
            units: z.array(z.record(z.string(), z.unknown())).min(2).max(10),
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
        combatants: z.array(WildIndividualSchema).min(1).max(3),
        state: z
          .object({
            round: z.number().int().positive(),
            rngState: z.number().int(),
            units: z.array(z.record(z.string(), z.unknown())).min(2).max(10),
          })
          .passthrough(),
        rounds: z.array(z.unknown()),
        events: z.array(z.unknown()),
        timeline: CombatV6ReplayTimelineSchema,
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
  itemRewards?: ItemGrant[];
  capturedBeasts?: SummonedBeast[];
  beastExperience?: { beastId: string; amount: number };
  deadBeastIds?: string[];
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
    itemRewards: z.array(ItemGrantSchema).max(100).optional(),
    capturedBeasts: z.array(BeastSchema).max(3).optional(),
    beastExperience: z
      .object({
        beastId: z.uuid(),
        amount: z.number().int().nonnegative().max(450),
      })
      .strict()
      .optional(),
    deadBeastIds: z.array(z.uuid()).max(6).optional(),
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
        autoPolicyVersion: z.string().min(1).optional(),
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
> & {
  nodeId: string;
  settlement: 'pending' | 'settled' | 'not-started';
  itemRewards?: ItemGrant[];
};
