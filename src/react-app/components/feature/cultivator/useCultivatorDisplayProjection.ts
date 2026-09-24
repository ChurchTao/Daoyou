import {
  membershipState,
  useActiveSectContextQuery,
} from '@app/components/feature/sect/sectResources';
import {
  useCultivatorCondition,
  useCultivatorIdentity,
} from '@app/lib/resources/player';
import {
  getEstimatedServerNowMs,
  useRecoveryClock,
} from '@app/lib/resources/recoveryClock';
import {
  type CultivatorDisplayInput,
} from '@shared/lib/cultivatorDisplay';
import type { CombatV6ResourceAuthority, CultivatorDisplaySnapshot } from '@shared/lib/cultivatorDisplay';
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
  Pick<Cultivator, 'spiritual_roots'> &
  Pick<Cultivator, 'pre_heaven_fates'> & {
    condition: CultivatorCondition & { combatV6: CombatV6ResourceAuthority };
  };

export interface CultivatorDisplayProjection {
  cultivator: CultivatorDisplayProjectionInput;
  projectedCondition: CultivatorCondition;
  display: CultivatorDisplaySnapshot;
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
  const sectContext = useActiveSectContextQuery(enabled);
  const identity = profile.data?.cultivator;
  const sect = useMemo(
    () =>
      sectContext.hasSect && sectContext.data
        ? membershipState(sectContext.data)
        : undefined,
    [
      sectContext.data,
      sectContext.hasSect,
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
      !condition.data?.combatV6 ||
      !sectReady
    ) {
      return null;
    }
    const cultivator: CultivatorDisplayProjectionInput = {
      ...identity,
      condition: { ...condition.data, combatV6: condition.data.combatV6 },
      sect,
    };
    const display = { attrs: condition.data.combatV6.attrs };
    const fateContext = evaluateFateContext(
      cultivator.pre_heaven_fates ?? [],
    );
    return {
      cultivator,
      display,
      maxHp: condition.data.combatV6.maxHp,
      maxMp: condition.data.combatV6.maxMp,
      recoveryPaused: condition.data.combatV6.recoveryPaused,
      fateContext,
    };
  }, [condition.data, identity, sect, sectReady]);

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
    const projectedCondition: CultivatorDisplayProjectionInput['condition'] = {
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
      sectContext.sessionLoading ||
      (sectContext.hasSect &&
        sectContext.loading));
  const error =
    profile.error ??
    condition.error ??
    (condition.data && !condition.data.combatV6 ? '角色战斗属性尚未加载' : undefined) ??
    sectContext.sessionError ??
    sectContext.error;

  return {
    data,
    loading,
    error,
  };
}
