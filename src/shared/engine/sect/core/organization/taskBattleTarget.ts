import { SectV6TargetSchema } from '@shared/contracts/combatV6SectTask';
import {
  REALM_STAGE_VALUES,
  REALM_VALUES,
  type RealmStage,
  type RealmType,
} from '@shared/types/constants';
import { z } from 'zod';
import type { SectBattleTargetAcquisition } from './contracts';

export const SECT_BATTLE_TARGET_SCHEMA_VERSION = 1;

const baseTargetSchema = z.object({
  schemaVersion: z.literal(SECT_BATTLE_TARGET_SCHEMA_VERSION),
  challengeTitle: z.string().min(1).max(100),
  name: z.string().min(1).max(100),
  description: z.string().min(1).max(500),
  realm: z.enum(REALM_VALUES),
  realmStage: z.enum(REALM_STAGE_VALUES),
});

export const SectPresetBattleTargetSnapshotSchema = baseTargetSchema.extend({
  kind: z.literal('preset'),
  presetId: z.string().min(1).max(128),
  rulesVersion: z.number().int().positive(),
});

export const SectCultivatorBattleTargetSnapshotSchema = baseTargetSchema.extend(
  {
    kind: z.literal('cultivator'),
    sourceCultivatorId: z.string().uuid(),
    sourceSectId: z.string().min(1).max(64),
    sourceSectName: z.string().min(1).max(100),
    lockedAt: z.string().datetime(),
  },
);

const legacyTargetSchema = z.discriminatedUnion('kind', [
  SectPresetBattleTargetSnapshotSchema,
  SectCultivatorBattleTargetSnapshotSchema,
]);
export const SectBattleTargetSnapshotSchema = z.union([
  SectV6TargetSchema,
  legacyTargetSchema,
]);

export type SectBattleTargetSnapshot = z.infer<
  typeof SectBattleTargetSnapshotSchema
>;

export interface SectBattleTargetSummary {
  kind: SectBattleTargetSnapshot['kind'];
  name: string;
  description: string;
  realm: RealmType;
  realmStage: RealmStage;
  sectId?: string;
  sectName?: string;
}

export function resolveSectBattleTargetRealmCandidates(
  realm: RealmType,
  acquisition: SectBattleTargetAcquisition,
): readonly RealmType[] {
  if (acquisition === 'preset') return [realm];

  const realmIndex = REALM_VALUES.indexOf(realm);
  const previousRealm = REALM_VALUES[realmIndex - 1];
  return previousRealm ? [realm, previousRealm] : [realm];
}

export function readSectBattleTargetSnapshot(
  executorData: Record<string, unknown>,
): SectBattleTargetSnapshot | undefined {
  const parsed = SectBattleTargetSnapshotSchema.safeParse(
    executorData.battleTarget,
  );
  return parsed.success ? parsed.data : undefined;
}

export function summarizeSectBattleTarget(
  snapshot: SectBattleTargetSnapshot,
): SectBattleTargetSummary {
  return {
    kind: snapshot.kind,
    name: snapshot.name,
    description: snapshot.description,
    realm: snapshot.realm,
    realmStage: snapshot.realmStage,
    ...(snapshot.kind === 'cultivator'
      ? {
          sectId: snapshot.sourceSectId,
          sectName: snapshot.sourceSectName,
        }
      : {}),
  };
}
