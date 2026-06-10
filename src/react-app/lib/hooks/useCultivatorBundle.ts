import { GAME_ROUTE_ID, type UserLoaderData } from '@app/lib/router/routeData';
import type { PlayerCultivatorView } from '@shared/contracts/player';
import type {
  Cultivator,
  EquippedItems,
  Inventory,
  Skill,
} from '@shared/types/cultivator';
import type { PlayerStateStoreData } from '@app/lib/player-state/store';
import {
  usePlayerState,
  usePlayerStateActions,
} from '@app/lib/player-state/store';
import { useCallback, useEffect } from 'react';
import { useNavigate, useRouteLoaderData } from 'react-router';

// ============================================================
// 类型定义
// ============================================================

type DisplayState = PlayerCultivatorView['display'];

type InventoryType = 'artifacts' | 'consumables' | 'materials';

type FetchState = {
  cultivator: Cultivator | null;
  display: DisplayState | null;
  inventory: Inventory;
  inventoryLoaded: Record<InventoryType, boolean>;
  skills: Skill[];
  equipped: EquippedItems;
  isLoading: boolean;
  error?: string;
  note?: string;
  unreadMailCount: number;
  hasActiveCultivator: boolean;
};

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

const initialState: FetchState = {
  cultivator: null,
  display: null,
  inventory: defaultInventory,
  inventoryLoaded: {
    artifacts: false,
    materials: false,
    consumables: false,
  },
  skills: [],
  equipped: defaultEquipped,
  isLoading: false,
  error: undefined,
  note: undefined,
  unreadMailCount: 0,
  hasActiveCultivator: false,
};

export function buildFetchStateFromPlayerView(args: {
  cultivatorView: PlayerCultivatorView;
  unreadMailCount: number;
  cachedState?: FetchState | null;
}): FetchState {
  const { cultivatorView, unreadMailCount, cachedState } = args;
  const cultivator = cultivatorView.cultivator;
  const cachedInventory = cachedState?.inventory;
  const cachedLoaded = cachedState?.inventoryLoaded;
  const inventory: Inventory = {
    artifacts:
      cultivator.inventory?.artifacts || cachedInventory?.artifacts || [],
    consumables: cachedInventory?.consumables || [],
    materials: cachedInventory?.materials || [],
  };
  const inventoryLoaded: Record<InventoryType, boolean> = {
    artifacts: true,
    materials: cachedLoaded?.materials || false,
    consumables: cachedLoaded?.consumables || false,
  };

  const fullCultivator: Cultivator = {
    ...cultivator,
    inventory,
    cultivations: cultivator.cultivations || [],
    skills: cultivator.skills || [],
    equipped: cultivator.equipped || defaultEquipped,
  };

  return {
    cultivator: fullCultivator,
    display: cultivatorView.display,
    inventory,
    inventoryLoaded,
    skills: fullCultivator.skills || [],
    equipped: fullCultivator.equipped || defaultEquipped,
    isLoading: false,
    error: undefined,
    note: undefined,
    unreadMailCount: unreadMailCount || 0,
    hasActiveCultivator: true,
  };
}

// ============================================================
// 主 Hook
// ============================================================

export function useCultivatorBundle() {
  const gameLoaderData = useRouteLoaderData(GAME_ROUTE_ID) as
    | UserLoaderData
    | undefined;
  const userId = gameLoaderData?.userId ?? null;
  const navigate = useNavigate();
  const storeState = usePlayerState((state) => state);
  const actions = usePlayerStateActions();
  const state = buildLegacyFetchStateFromPlayerState(storeState);

  const loadFromServer = useCallback(async () => {
    await actions.refresh(undefined, userId);
  }, [actions, userId]);

  // ========== 细粒度刷新函数 ==========
  const refreshInventory = useCallback(
    async (
      types: InventoryType[] = ['artifacts', 'materials', 'consumables'],
    ) => {
      void types;
      await actions.refresh(['inventory', 'products'], userId);
    },
    [actions, userId],
  );

  const ensureInventoryLoaded = useCallback(
    async (types: InventoryType[]) => {
      const missingTypes = Array.from(new Set(types)).filter(
        (type) => !state.inventoryLoaded[type],
      );
      if (missingTypes.length === 0) return;
      await refreshInventory(missingTypes);
    },
    [refreshInventory, state.inventoryLoaded],
  );

  /**
   * 完整刷新角色数据（包括功法、神通、背包等所有数据）
   *
   * 使用场景：
   * - 创建新功法/神通后需要重新加载完整角色数据
   * - 需要同步最新状态时
   *
   * 对比 refreshInventory：
   * - refreshCultivator: 重新加载所有角色数据
   * - refreshInventory: 仅刷新背包数据（消耗品、材料、法宝）
   */
  const refreshCultivator = useCallback(async () => {
    if (!userId) return;
    return await loadFromServer();
  }, [userId, loadFromServer]);

  const refreshUnreadMailCount = useCallback(async () => {
    if (!userId) return;
    await actions.refresh(['mail'], userId);
  }, [actions, userId]);

  // ========== 初始化逻辑 ==========
  useEffect(() => {
    void actions.initialize(userId);
  }, [actions, userId]);

  // ========== 死亡重定向 ==========
  useEffect(() => {
    const cultivator = state.cultivator;
    if (!cultivator) return;

    const isDead =
      cultivator.status === 'dead' || cultivator.age >= cultivator.lifespan;

    if (!isDead) return;

    if (
      typeof window !== 'undefined' &&
      window.location.pathname !== '/game/reincarnate'
    ) {
      navigate('/game/reincarnate');
    }
  }, [navigate, state.cultivator]);

  // ========== 返回值 ==========
  return {
    ...state,
    refresh: loadFromServer,
    refreshInventory,
    ensureInventoryLoaded,
    refreshCultivator,
    refreshUnreadMailCount,
  };
}

function buildLegacyFetchStateFromPlayerState(
  storeState: PlayerStateStoreData,
): FetchState {
  const profile = storeState.snapshot.profile;
  const cultivator = profile?.cultivator ?? null;

  if (!cultivator) {
    return {
      ...initialState,
      isLoading: storeState.loading,
      error: storeState.error ?? undefined,
      hasActiveCultivator: false,
    };
  }

  const products = storeState.snapshot.products;
  const inventory: Inventory = storeState.snapshot.inventory ?? {
    artifacts: products?.artifacts ?? cultivator.inventory?.artifacts ?? [],
    consumables: cultivator.inventory?.consumables ?? [],
    materials: cultivator.inventory?.materials ?? [],
  };
  const equipped = products?.equipped ?? cultivator.equipped ?? defaultEquipped;
  const skills = products?.skills ?? cultivator.skills ?? [];
  const fullCultivator: Cultivator = {
    ...cultivator,
    condition: storeState.snapshot.condition ?? cultivator.condition,
    cultivation_progress:
      'cultivation_exp' in (storeState.snapshot.progress ?? {})
        ? (storeState.snapshot.progress as Cultivator['cultivation_progress'])
        : cultivator.cultivation_progress,
    spirit_stones:
      storeState.snapshot.currency?.spiritStones ?? cultivator.spirit_stones,
    inventory,
    skills,
    cultivations: products?.cultivations ?? cultivator.cultivations ?? [],
    equipped,
  };

  return {
    cultivator: fullCultivator,
    display: profile?.display ?? null,
    inventory,
    inventoryLoaded: {
      artifacts: Boolean(storeState.snapshot.inventory || products),
      materials: Boolean(storeState.snapshot.inventory),
      consumables: Boolean(storeState.snapshot.inventory),
    },
    skills,
    equipped,
    isLoading: storeState.loading,
    error: storeState.error ?? undefined,
    note: undefined,
    unreadMailCount: storeState.snapshot.mail?.unreadCount ?? 0,
    hasActiveCultivator: true,
  };
}
