import {
  buildSectProgressionState,
  useActiveSectContextQuery,
  useSectProgressionQuery,
} from '@app/components/feature/sect/sectResources';
import {
  useCultivatorCondition,
  useCultivatorIdentity,
  usePlayerLoadout,
} from '@app/lib/resources/player';
import {
  getEstimatedServerNowMs,
  useRecoveryClock,
} from '@app/lib/resources/recoveryClock';
import {
  getCultivatorDisplaySnapshot,
  type CultivatorDisplayInput,
} from '@shared/engine/battle-v5/adapters/CultivatorDisplayAdapter';
import type { CultivatorCombatInput } from '@shared/engine/battle-v5/adapters/CultivatorCombatAdapter';
import {
  getNextConditionStatusExpiryMs,
  isConditionStatusActive,
  projectNaturalRecoveryResources,
  type NaturalRecoveryProjection,
} from '@shared/lib/condition';
import { evaluateFateContext } from '@shared/lib/fates';
import type { PlayerIdentityCultivator } from '@shared/contracts/player';
import type { CultivatorCondition } from '@shared/types/condition';
import type { Cultivator } from '@shared/types/cultivator';
import { useMemo } from 'react';

export type CultivatorDisplayProjectionInput = PlayerIdentityCultivator &
  Omit<CultivatorDisplayInput, 'condition'> &
  Pick<CultivatorCombatInput, 'skills' | 'spiritual_roots'> &
  Pick<Cultivator, 'pre_heaven_fates'> & {
    condition: CultivatorCondition;
  };

export interface CultivatorDisplayProjection {
  cultivator: CultivatorDisplayProjectionInput;
  projectedCondition: CultivatorCondition;
  display: ReturnType<typeof getCultivatorDisplaySnapshot>;
  recovery: NaturalRecoveryProjection['recovery'];
  now: Date;
}

function buildProjectedResourceView(resource: {
  current: number;
  max: number;
}) {
  return {
    ...resource,
    percent:
      resource.max > 0
        ? Math.round((resource.current / resource.max) * 10_000) / 100
        : 0,
  };
}

export function useCultivatorDisplayProjection(enabled = true) {
  const profile = useCultivatorIdentity(enabled);
  const condition = useCultivatorCondition(enabled);
  const loadout = usePlayerLoadout(enabled);
  const sectContext = useActiveSectContextQuery(enabled);
  const sectProgression = useSectProgressionQuery(
    enabled && sectContext.hasSect,
  );
  const identity = profile.data?.cultivator;
  const sect = useMemo(
    () =>
      sectContext.hasSect && sectContext.data && sectProgression.data
        ? buildSectProgressionState(sectContext.data, sectProgression.data)
        : undefined,
    [
      sectContext.data,
      sectContext.hasSect,
      sectProgression.data,
    ],
  );
  const sectReady =
    !enabled ||
    (!sectContext.sessionLoading &&
      !sectContext.sessionError &&
      (!sectContext.hasSect || sect !== undefined));

  const basis = useMemo(() => {
    if (
      !identity ||
      !condition.data ||
      !loadout.data ||
      !sectReady
    ) {
      return null;
    }
    const cultivator: CultivatorDisplayProjectionInput = {
      ...identity,
      condition: condition.data,
      skills: loadout.data.skills,
      cultivations: loadout.data.cultivations,
      equipped: loadout.data.equipped,
      inventory: { artifacts: loadout.data.artifacts },
      sect,
    };
    const display = getCultivatorDisplaySnapshot(cultivator);
    const fateContext = evaluateFateContext(
      cultivator.pre_heaven_fates ?? [],
    );
    return {
      cultivator,
      display,
      maxHp: condition.data.combatV6?.maxHp ?? display.resources.hp.max,
      maxMp: condition.data.combatV6?.maxMp ?? display.resources.mp.max,
      recoveryPaused: condition.data.combatV6?.recoveryPaused ?? false,
      fateContext,
    };
  }, [condition.data, identity, loadout.data, sect, sectReady]);

  const estimatedNowMs = getEstimatedServerNowMs();
  const initialProjection = useMemo(
    () =>
      basis
        ? projectNaturalRecoveryResources({
            conditionInput: basis.cultivator.condition,
            maxHp: basis.maxHp,
            maxMp: basis.maxMp,
            toxicityPenaltyMultiplier:
              basis.fateContext.toxicityPenaltyMultiplier,
            naturalRecoveryMultiplier:
              basis.recoveryPaused ? 0 : basis.fateContext.naturalRecoveryMultiplier,
            now: new Date(estimatedNowMs),
          })
        : null,
    [basis, estimatedNowMs],
  );
  const shouldTick = Boolean(
    (initialProjection?.timestampValid &&
      ((!initialProjection.recovery.hp.isFull &&
        initialProjection.recovery.hp.perHour > 0) ||
        (!initialProjection.recovery.mp.isFull &&
          initialProjection.recovery.mp.perHour > 0))) ||
      (basis &&
        getNextConditionStatusExpiryMs(
          basis.cultivator.condition,
          new Date(estimatedNowMs),
        ) !== null),
  );
  const nowMs = useRecoveryClock(shouldTick);

  const data = useMemo<CultivatorDisplayProjection | null>(() => {
    if (!basis) return null;
    const projection = projectNaturalRecoveryResources({
      conditionInput: basis.cultivator.condition,
      maxHp: basis.maxHp,
      maxMp: basis.maxMp,
      toxicityPenaltyMultiplier:
        basis.fateContext.toxicityPenaltyMultiplier,
      naturalRecoveryMultiplier:
        basis.recoveryPaused ? 0 : basis.fateContext.naturalRecoveryMultiplier,
      now: new Date(nowMs),
    });
    const projectedCondition: CultivatorCondition = {
      ...basis.cultivator.condition,
      resources: projection.resources,
      statuses: basis.cultivator.condition.statuses.filter((status) =>
        isConditionStatusActive(status, new Date(nowMs)),
      ),
    };
    const cultivator = {
      ...basis.cultivator,
      condition: projectedCondition,
    };

    return {
      cultivator,
      projectedCondition,
      display: {
        ...basis.display,
        resources: {
          hp: buildProjectedResourceView(projection.resources.hp),
          mp: buildProjectedResourceView(projection.resources.mp),
        },
      },
      recovery: projection.recovery,
      now: new Date(nowMs),
    };
  }, [basis, nowMs]);

  const loading =
    enabled &&
    (profile.loading ||
      condition.loading ||
      loadout.loading ||
      sectContext.sessionLoading ||
      (sectContext.hasSect &&
        (sectContext.loading || sectProgression.loading)));
  const error =
    profile.error ??
    condition.error ??
    loadout.error ??
    sectContext.sessionError ??
    sectContext.error ??
    (sectContext.hasSect ? sectProgression.error : undefined);

  return {
    data,
    loading,
    error,
  };
}
