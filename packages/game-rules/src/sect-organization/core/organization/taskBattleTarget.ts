import type {
  SectBattleTargetSnapshot,
  SectBattleTargetSummary,
} from '@daoyou/game-domain/sects/tasks';
import { SectV6TargetSchema } from '@daoyou/game-domain/combat/challenges';

import { REALM_VALUES } from '@daoyou/constants/realms';

import type { RealmType } from '@daoyou/constants/realms';

import type { SectBattleTargetAcquisition } from '@daoyou/game-domain/sects/commands';

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
  const parsed = SectV6TargetSchema.safeParse(executorData.battleTarget);
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
