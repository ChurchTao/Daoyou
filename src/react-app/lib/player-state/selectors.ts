import { EXP_CAP_TABLE } from '@shared/config/cultivationProgress';
import { getCultivatorDisplaySnapshot } from '@shared/engine/battle-v5/adapters/CultivatorDisplayAdapter';
import type {
  PlayerStateDomain,
  PlayerStateSnapshot,
} from '@shared/contracts/player';
import type {
  Cultivator,
  CultivationProgress,
  EquippedItems,
  Inventory,
  Skill,
} from '@shared/types/cultivator';
import { useMemo } from 'react';
import {
  usePlayerState,
  type PlayerStateStoreData,
} from './store';

const defaultInventory: Inventory = {
  artifacts: [],
  consumables: [],
  materials: [],
};

const defaultEquipped: EquippedItems = {
  weapon: null,
  armor: null,
  accessory: null,
};

type PlayerStateStatus = {
  isLoading: boolean;
  isRefreshing: boolean;
  isRecovering: boolean;
  error?: string;
  note?: string;
  hasActiveCultivator: boolean;
};

export function selectActiveCultivatorProfile(
  storeState: PlayerStateStoreData,
): Cultivator | null {
  const profile = storeState.snapshot.profile;
  const cultivator = profile?.cultivator ?? null;

  if (!cultivator) {
    return null;
  }

  const loadout = storeState.snapshot.loadout;
  const inventory: Inventory = {
    artifacts: loadout?.artifacts ?? [],
    consumables: [],
    materials: [],
  };
  const equipped = loadout?.equipped ?? defaultEquipped;
  const skills = loadout?.skills ?? [];
  const patchedProgress =
    'cultivation_exp' in (storeState.snapshot.progress ?? {})
      ? (storeState.snapshot.progress as CultivationProgress)
      : null;
  const cultivationProgress = patchedProgress
    ? {
        ...patchedProgress,
        exp_cap:
          patchedProgress.exp_cap ??
          EXP_CAP_TABLE[cultivator.realm]?.[cultivator.realm_stage] ??
          EXP_CAP_TABLE['炼气']['初期'],
      }
    : cultivator.cultivation_progress;

  return {
    ...cultivator,
    condition: storeState.snapshot.condition ?? cultivator.condition,
    cultivation_progress: cultivationProgress,
    spirit_stones:
      storeState.snapshot.currency?.spiritStones ?? cultivator.spirit_stones,
    reputation: storeState.snapshot.currency?.reputation ?? cultivator.reputation ?? 0,
    inventory,
    skills,
    cultivations: loadout?.cultivations ?? [],
    equipped,
  };
}

export function selectCultivatorDisplay(storeState: PlayerStateStoreData) {
  const cultivator = selectActiveCultivatorProfile(storeState);
  if (!cultivator) {
    return null;
  }

  return getCultivatorDisplaySnapshot(cultivator);
}

export function selectInventorySnapshot(
  storeState: PlayerStateStoreData,
): Inventory {
  return selectActiveCultivatorProfile(storeState)?.inventory ?? defaultInventory;
}

export function selectProductsSnapshot(
  storeState: PlayerStateStoreData,
): PlayerStateSnapshot['loadout'] {
  const cultivator = selectActiveCultivatorProfile(storeState);

  return storeState.snapshot.loadout ?? {
    skills: cultivator?.skills ?? [],
    cultivations: cultivator?.cultivations ?? [],
    artifacts: cultivator?.inventory.artifacts ?? [],
    equipped: cultivator?.equipped ?? defaultEquipped,
  };
}

export function selectPlayerStateStatus(
  storeState: PlayerStateStoreData,
): PlayerStateStatus {
  return {
    isLoading: storeState.loading,
    isRefreshing: storeState.isRefreshing,
    isRecovering: storeState.isRecovering,
    error: storeState.error ?? undefined,
    note: undefined,
    hasActiveCultivator: Boolean(storeState.snapshot.profile?.cultivator),
  };
}

export function useActiveCultivatorProfile() {
  return usePlayerState(selectActiveCultivatorProfile);
}

export function useCultivatorDisplay() {
  return usePlayerState(selectCultivatorDisplay);
}

export function useCultivatorCondition() {
  return usePlayerState((state) => selectActiveCultivatorProfile(state)?.condition ?? null);
}

export function useCultivatorCurrency() {
  return usePlayerState((state) => state.snapshot.currency ?? null);
}

export function useUnreadMailCount() {
  return usePlayerState((state) => state.snapshot.mail?.unreadCount ?? 0);
}

export function useInventorySnapshot() {
  return usePlayerState(selectInventorySnapshot);
}

export function useProductsSnapshot() {
  return usePlayerState(selectProductsSnapshot);
}

export function useTaskSummary() {
  return usePlayerState((state) => state.snapshot.tasks ?? null);
}

export function usePlayerStateDomainVersion(domain: PlayerStateDomain) {
  return usePlayerState((state) => state.domainVersions[domain] ?? 0);
}

export function usePlayerStateStatus() {
  return usePlayerState(selectPlayerStateStatus, shallowEqualPlayerStateStatus);
}

export function usePlayerStateView() {
  const cultivator = useActiveCultivatorProfile();
  const display = useCultivatorDisplay();
  const inventory = useInventorySnapshot();
  const products = useProductsSnapshot();
  const unreadMailCount = useUnreadMailCount();
  const status = usePlayerStateStatus();

  return useMemo(
    () => ({
      cultivator,
      display,
      inventory,
      skills: products.skills,
      equipped: products.equipped,
      unreadMailCount,
      ...status,
    }),
    [cultivator, display, inventory, products, status, unreadMailCount],
  );
}

export function usePlayerStateVersionedValue<T>(
  domain: PlayerStateDomain,
  selector: () => T,
): { value: T; version: number } {
  const version = usePlayerStateDomainVersion(domain);
  const value = selector();

  return useMemo(() => ({ value, version }), [value, version]);
}

function shallowEqualPlayerStateStatus(
  left: PlayerStateStatus,
  right: PlayerStateStatus,
) {
  return (
    left.isLoading === right.isLoading &&
    left.isRefreshing === right.isRefreshing &&
    left.isRecovering === right.isRecovering &&
    left.error === right.error &&
    left.note === right.note &&
    left.hasActiveCultivator === right.hasActiveCultivator
  );
}

export type { PlayerStateStatus };
export type PlayerStateView = ReturnType<typeof usePlayerStateView>;
export type PlayerProductsSnapshot = ReturnType<typeof selectProductsSnapshot>;
export type PlayerSkillsSnapshot = Skill[];
