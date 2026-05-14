import { getCultivatorDisplayAttributes } from '@shared/engine/battle-v5/adapters/CultivatorDisplayAdapter';
import { normalizePersistentCombatStatuses } from '@shared/engine/battle-v5/setup/CombatStatusTemplateRegistry';
import type { BattleInitConfigV5 } from '@shared/engine/battle-v5/setup/types';
import type { PersistentCombatStatusV5 } from '@shared/engine/battle-v5/setup/types';
import type { UnitStateSnapshot } from '@shared/engine/battle-v5/systems/state/types';
import type {
  ConsumableUseSpec,
  Cultivator,
  CultivatorPersistentState,
} from '@shared/types/cultivator';

const RECOVERY_CONFIG = {
  hpPerHour: 0.08,
  mpPerHour: 0.18,
  toxicityPenaltyDivisor: 180,
  minorWoundPenalty: 0.88,
  majorWoundPenalty: 0.68,
  nearDeathPenalty: 0.42,
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function withoutStatus(
  statuses: PersistentCombatStatusV5[],
  templateId: string,
): PersistentCombatStatusV5[] {
  return statuses.filter((status) => status.templateId !== templateId);
}

function upsertStatus(
  statuses: PersistentCombatStatusV5[],
  templateId: string,
  stacks = 1,
): PersistentCombatStatusV5[] {
  const normalized = normalizePersistentCombatStatuses(statuses);
  const next = withoutStatus(normalized, templateId);
  next.push({
    version: 1,
    templateId,
    stacks: Math.max(1, Math.floor(stacks)),
  });
  return next;
}

function hasStatus(
  statuses: PersistentCombatStatusV5[],
  templateId: string,
): boolean {
  return statuses.some((status) => status.templateId === templateId);
}

function getRecoveryPenalty(statuses: PersistentCombatStatusV5[]): number {
  if (hasStatus(statuses, 'near_death')) return RECOVERY_CONFIG.nearDeathPenalty;
  if (hasStatus(statuses, 'major_wound')) return RECOVERY_CONFIG.majorWoundPenalty;
  if (hasStatus(statuses, 'minor_wound')) return RECOVERY_CONFIG.minorWoundPenalty;
  return 1;
}

function applyResourceIndicatorStatuses(
  currentStatuses: PersistentCombatStatusV5[],
  currentHp: number,
  maxHp: number,
  currentMp: number,
  maxMp: number,
): PersistentCombatStatusV5[] {
  let statuses = withoutStatus(currentStatuses, 'hp_deficit');
  statuses = withoutStatus(statuses, 'mana_depleted');

  if (currentHp < maxHp) {
    statuses.push({ version: 1, templateId: 'hp_deficit', stacks: 1 });
  }

  if (currentMp < maxMp) {
    statuses.push({ version: 1, templateId: 'mana_depleted', stacks: 1 });
  }

  return statuses;
}

function relieveWounds(
  statuses: PersistentCombatStatusV5[],
  woundRelief: number,
): PersistentCombatStatusV5[] {
  let next = normalizePersistentCombatStatuses(statuses);
  let remaining = Math.max(0, Math.floor(woundRelief));

  while (remaining > 0) {
    if (hasStatus(next, 'near_death')) {
      next = withoutStatus(next, 'near_death');
      next = upsertStatus(next, 'major_wound');
    } else if (hasStatus(next, 'major_wound')) {
      next = withoutStatus(next, 'major_wound');
      next = upsertStatus(next, 'minor_wound');
    } else if (hasStatus(next, 'minor_wound')) {
      next = withoutStatus(next, 'minor_wound');
    } else {
      break;
    }

    remaining -= 1;
  }

  return next;
}

function getRecoveryFactor(state: CultivatorPersistentState): number {
  const pillToxicity = Math.max(0, state.pillToxicity ?? 0);
  return clamp(1 - pillToxicity / RECOVERY_CONFIG.toxicityPenaltyDivisor, 0.3, 1);
}

function buildDefaultState(
  cultivator: Cultivator,
  now: Date,
): CultivatorPersistentState {
  const display = getCultivatorDisplayAttributes(cultivator);
  return {
    currentHp: display.maxHp,
    currentMp: display.maxMp,
    pillToxicity: 0,
    realmPillUsage: {},
    lastNaturalRecoveryAt: now.toISOString(),
    totalRecoveredHp: 0,
    totalRecoveredMp: 0,
  };
}

export const PersistentStateService = {
  getMaxResources(cultivator: Cultivator): { maxHp: number; maxMp: number } {
    const display = getCultivatorDisplayAttributes(cultivator);
    return {
      maxHp: display.maxHp,
      maxMp: display.maxMp,
    };
  },

  normalizeState(
    cultivator: Cultivator,
    stateInput?: CultivatorPersistentState,
    now: Date = new Date(),
  ): CultivatorPersistentState {
    const defaults = buildDefaultState(cultivator, now);
    const raw = stateInput ?? cultivator.persistent_state ?? {};
    const { maxHp, maxMp } = this.getMaxResources(cultivator);

    return {
      ...defaults,
      ...raw,
      currentHp: clamp(raw.currentHp ?? defaults.currentHp ?? maxHp, 0, maxHp),
      currentMp: clamp(raw.currentMp ?? defaults.currentMp ?? maxMp, 0, maxMp),
      pillToxicity: Math.max(0, raw.pillToxicity ?? defaults.pillToxicity ?? 0),
      realmPillUsage: raw.realmPillUsage ?? defaults.realmPillUsage ?? {},
      pendingBreakthroughBonus: Math.max(0, raw.pendingBreakthroughBonus ?? 0),
      lastNaturalRecoveryAt:
        raw.lastNaturalRecoveryAt ?? defaults.lastNaturalRecoveryAt,
      totalRecoveredHp: Math.max(
        0,
        raw.totalRecoveredHp ?? defaults.totalRecoveredHp ?? 0,
      ),
      totalRecoveredMp: Math.max(
        0,
        raw.totalRecoveredMp ?? defaults.totalRecoveredMp ?? 0,
      ),
    };
  },

  applyNaturalRecovery(
    cultivator: Cultivator,
    stateInput?: CultivatorPersistentState,
    statusesInput?: PersistentCombatStatusV5[],
    now: Date = new Date(),
  ): {
    state: CultivatorPersistentState;
    statuses: PersistentCombatStatusV5[];
  } {
    const state = this.normalizeState(cultivator, stateInput, now);
    const statuses = normalizePersistentCombatStatuses(
      statusesInput ?? cultivator.persistent_statuses,
    );
    const { maxHp, maxMp } = this.getMaxResources(cultivator);

    const lastRecoveryAt = Date.parse(state.lastNaturalRecoveryAt ?? '');
    if (!Number.isFinite(lastRecoveryAt)) {
      return {
        state: {
          ...state,
          lastNaturalRecoveryAt: now.toISOString(),
        },
        statuses: applyResourceIndicatorStatuses(
          statuses,
          state.currentHp ?? maxHp,
          maxHp,
          state.currentMp ?? maxMp,
          maxMp,
        ),
      };
    }

    const elapsedHours = Math.max(0, now.getTime() - lastRecoveryAt) / 3600000;
    if (elapsedHours <= 0) {
      return {
        state,
        statuses: applyResourceIndicatorStatuses(
          statuses,
          state.currentHp ?? maxHp,
          maxHp,
          state.currentMp ?? maxMp,
          maxMp,
        ),
      };
    }

    const recoveryFactor = getRecoveryFactor(state) * getRecoveryPenalty(statuses);
    const hpRecover = Math.floor(maxHp * RECOVERY_CONFIG.hpPerHour * elapsedHours * recoveryFactor);
    const mpRecover = Math.floor(maxMp * RECOVERY_CONFIG.mpPerHour * elapsedHours * recoveryFactor);
    const currentHp = clamp((state.currentHp ?? maxHp) + hpRecover, 0, maxHp);
    const currentMp = clamp((state.currentMp ?? maxMp) + mpRecover, 0, maxMp);

    return {
      state: {
        ...state,
        currentHp,
        currentMp,
        lastNaturalRecoveryAt: now.toISOString(),
        totalRecoveredHp: (state.totalRecoveredHp ?? 0) + Math.max(0, currentHp - (state.currentHp ?? maxHp)),
        totalRecoveredMp: (state.totalRecoveredMp ?? 0) + Math.max(0, currentMp - (state.currentMp ?? maxMp)),
      },
      statuses: applyResourceIndicatorStatuses(statuses, currentHp, maxHp, currentMp, maxMp),
    };
  },

  applyConsumableRecovery(
    cultivator: Cultivator,
    stateInput: CultivatorPersistentState | undefined,
    statusesInput: PersistentCombatStatusV5[] | undefined,
    useSpec: ConsumableUseSpec,
    now: Date = new Date(),
  ): {
    state: CultivatorPersistentState;
    statuses: PersistentCombatStatusV5[];
  } {
    const hydrated = this.applyNaturalRecovery(cultivator, stateInput, statusesInput, now);
    const { maxHp, maxMp } = this.getMaxResources(cultivator);
    const recoveryFactor =
      useSpec.detoxifyAmount && useSpec.detoxifyAmount > 0
        ? 1
        : getRecoveryFactor(hydrated.state);

    const hpGain = Math.floor(
      ((useSpec.hpRecoverFlat ?? 0) + maxHp * (useSpec.hpRecoverPercent ?? 0)) *
        recoveryFactor,
    );
    const mpGain = Math.floor(
      ((useSpec.mpRecoverFlat ?? 0) + maxMp * (useSpec.mpRecoverPercent ?? 0)) *
        recoveryFactor,
    );

    const currentHp = clamp((hydrated.state.currentHp ?? maxHp) + hpGain, 0, maxHp);
    const currentMp = clamp((hydrated.state.currentMp ?? maxMp) + mpGain, 0, maxMp);
    const pillToxicity = clamp(
      (hydrated.state.pillToxicity ?? 0) +
        (useSpec.toxicityDelta ?? 0) -
        (useSpec.detoxifyAmount ?? 0),
      0,
      999,
    );

    const relievedStatuses =
      useSpec.woundRelief && useSpec.woundRelief > 0
        ? relieveWounds(hydrated.statuses, useSpec.woundRelief)
        : hydrated.statuses;

    return {
      state: {
        ...hydrated.state,
        currentHp,
        currentMp,
        pillToxicity,
        lastNaturalRecoveryAt: now.toISOString(),
      },
      statuses: applyResourceIndicatorStatuses(
        relievedStatuses,
        currentHp,
        maxHp,
        currentMp,
        maxMp,
      ),
    };
  },

  applyExternalResourceLoss(
    cultivator: Cultivator,
    stateInput: CultivatorPersistentState | undefined,
    statusesInput: PersistentCombatStatusV5[] | undefined,
    options: {
      hpPercent?: number;
      mpPercent?: number;
      hpFlat?: number;
      mpFlat?: number;
    },
    now: Date = new Date(),
  ): {
    state: CultivatorPersistentState;
    statuses: PersistentCombatStatusV5[];
  } {
    const hydrated = this.applyNaturalRecovery(cultivator, stateInput, statusesInput, now);
    const { maxHp, maxMp } = this.getMaxResources(cultivator);
    const hpLoss = Math.floor(
      maxHp * (options.hpPercent ?? 0) + (options.hpFlat ?? 0),
    );
    const mpLoss = Math.floor(
      maxMp * (options.mpPercent ?? 0) + (options.mpFlat ?? 0),
    );
    const currentHp = clamp((hydrated.state.currentHp ?? maxHp) - hpLoss, 0, maxHp);
    const currentMp = clamp((hydrated.state.currentMp ?? maxMp) - mpLoss, 0, maxMp);

    return {
      state: {
        ...hydrated.state,
        currentHp,
        currentMp,
        lastNaturalRecoveryAt: now.toISOString(),
      },
      statuses: applyResourceIndicatorStatuses(
        hydrated.statuses,
        currentHp,
        maxHp,
        currentMp,
        maxMp,
      ),
    };
  },

  applyPveBattleOutcome(
    cultivator: Cultivator,
    stateInput: CultivatorPersistentState | undefined,
    statusesInput: PersistentCombatStatusV5[] | undefined,
    playerSnapshot: UnitStateSnapshot,
    didLose: boolean,
    now: Date = new Date(),
  ): {
    state: CultivatorPersistentState;
    statuses: PersistentCombatStatusV5[];
  } {
    const hydrated = this.applyNaturalRecovery(cultivator, stateInput, statusesInput, now);
    const { maxHp, maxMp } = this.getMaxResources(cultivator);

    if (didLose) {
      const statuses = upsertStatus(
        withoutStatus(hydrated.statuses, 'minor_wound'),
        'near_death',
      );
      return {
        state: {
          ...hydrated.state,
          currentHp: 1,
          currentMp: 0,
          lastBattleAt: now.toISOString(),
          lastNaturalRecoveryAt: now.toISOString(),
        },
        statuses: applyResourceIndicatorStatuses(statuses, 1, maxHp, 0, maxMp),
      };
    }

    const currentHp = clamp(playerSnapshot.hp.current, 0, maxHp);
    const currentMp = clamp(playerSnapshot.mp.current, 0, maxMp);
    return {
      state: {
        ...hydrated.state,
        currentHp,
        currentMp,
        lastBattleAt: now.toISOString(),
        lastNaturalRecoveryAt: now.toISOString(),
      },
      statuses: applyResourceIndicatorStatuses(
        hydrated.statuses,
        currentHp,
        maxHp,
        currentMp,
        maxMp,
      ),
    };
  },

  addPillToxicity(
    cultivator: Cultivator,
    stateInput: CultivatorPersistentState | undefined,
    amount: number,
    now: Date = new Date(),
  ): CultivatorPersistentState {
    const state = this.normalizeState(cultivator, stateInput, now);
    return {
      ...state,
      pillToxicity: clamp((state.pillToxicity ?? 0) + amount, 0, 999),
      lastNaturalRecoveryAt: now.toISOString(),
    };
  },

  getBreakthroughPenalty(stateInput: CultivatorPersistentState | undefined): number {
    const pillToxicity = Math.max(0, stateInput?.pillToxicity ?? 0);
    return clamp(pillToxicity / 1000, 0, 0.18);
  },

  buildPveBattleInit(
    cultivator: Cultivator,
    stateInput?: CultivatorPersistentState,
    statusesInput?: PersistentCombatStatusV5[],
    now: Date = new Date(),
  ): BattleInitConfigV5 {
    const hydrated = this.applyNaturalRecovery(cultivator, stateInput, statusesInput, now);
    return {
      player: {
        resourceState: {
          hp: {
            mode: 'absolute',
            value: hydrated.state.currentHp ?? 0,
          },
          mp: {
            mode: 'absolute',
            value: hydrated.state.currentMp ?? 0,
          },
        },
        statusRefs: hydrated.statuses,
      },
    };
  },
};
