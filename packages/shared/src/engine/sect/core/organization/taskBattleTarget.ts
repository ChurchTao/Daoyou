import { SectV6TargetSchema } from '@daoyou/shared/contracts/combatV6SectTask';
import {
  REALM_VALUES,
  type RealmStage,
  type RealmType,
} from '@daoyou/shared/types/constants';
import { z } from 'zod';
import type { SectBattleTargetAcquisition } from './contracts.js';

export type SectBattleTargetSnapshot = z.infer<typeof SectV6TargetSchema>;

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
  const parsed = SectV6TargetSchema.safeParse(
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
