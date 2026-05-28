import { GAME_ROUTE_ID, type UserLoaderData } from '@app/lib/router/routeData';
import type { ApiFailure } from '@shared/contracts/http';
import type {
  PlayerActiveResponse,
  PlayerCultivatorView,
} from '@shared/contracts/player';
import type {
  Cultivator,
  EquippedItems,
  Inventory,
  Skill,
} from '@shared/types/cultivator';
import { useCallback, useEffect, useRef, useState } from 'react';
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

const BUNDLE_INVENTORY_PAGE_SIZE = 50;

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

const loadingState: FetchState = {
  ...initialState,
  isLoading: true,
};

// ============================================================
// 模块级缓存（简化版）
// ============================================================

let cachedState: FetchState | null = null;
let cachedUserId: string | null = null;
let inflightUserId: string | null = null;
let inflightStatePromise: Promise<FetchState> | null = null;

function getCachedState(userId: string | null): FetchState | null {
  if (cachedUserId === userId && cachedState) {
    return cachedState;
  }
  return null;
}

function setCachedState(state: FetchState, userId: string | null) {
  cachedState = state;
  cachedUserId = userId;
}

function clearCache() {
  cachedState = null;
  cachedUserId = null;
}

function clearInflight(userId?: string) {
  if (userId && inflightUserId !== userId) {
    return;
  }

  inflightUserId = null;
  inflightStatePromise = null;
}

// ============================================================
// 数据获取函数
// ============================================================

async function fetchCultivatorData(): Promise<{
  cultivatorView: PlayerCultivatorView | null;
  hasActive: boolean;
  hasDead: boolean;
  unreadMailCount: number;
}> {
  const response = await fetch('/api/player/active');
  const result = (await response.json()) as PlayerActiveResponse | ApiFailure;

  if (!result.success) {
    throw new Error(result.error || '未获取到角色数据');
  }

  if (!response.ok) {
    throw new Error('未获取到角色数据');
  }

  const list: PlayerCultivatorView[] = result.data?.cultivators || [];
  return {
    cultivatorView: result.data?.activeCultivator || list[0] || null,
    hasActive: !!result.meta?.hasActive,
    hasDead: !!result.meta?.hasDead,
    unreadMailCount: result.data?.unreadMailCount || 0,
  };
}

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

async function fetchInventoryByType(
  type: InventoryType,
): Promise<Inventory[InventoryType] | null> {
  try {
    const res = await fetch(
      `/api/cultivator/inventory?type=${type}&page=1&pageSize=${BUNDLE_INVENTORY_PAGE_SIZE}`,
    );
    const json = await res.json();
    if (!res.ok || !json.success) {
      return null;
    }
    return (json.data?.items || []) as Inventory[InventoryType];
  } catch (e) {
    console.error(`获取背包类型 ${type} 失败`, e);
    return null;
  }
}

async function fetchUnreadCount(): Promise<number> {
  try {
    const res = await fetch('/api/cultivator/mail/unread-count');
    if (res.ok) {
      const data = await res.json();
      return data.count || 0;
    }
    return 0;
  } catch (e) {
    console.error('获取未读邮件失败', e);
    return 0;
  }
}

async function buildCultivatorState(userId: string): Promise<FetchState> {
  const { cultivatorView, hasActive, hasDead, unreadMailCount } =
    await fetchCultivatorData();

  if (!hasActive || !cultivatorView) {
    return {
      ...initialState,
      note: hasDead ? '前世道途已尽，待转世重修。' : undefined,
      hasActiveCultivator: false,
    };
  }

  const unreadCount = unreadMailCount || (await fetchUnreadCount());
  return buildFetchStateFromPlayerView({
    cultivatorView,
    unreadMailCount: unreadCount,
    cachedState: getCachedState(userId),
  });
}

function fetchCultivatorStateShared(userId: string): Promise<FetchState> {
  if (inflightUserId === userId && inflightStatePromise) {
    return inflightStatePromise;
  }

  inflightUserId = userId;
  inflightStatePromise = buildCultivatorState(userId).finally(() => {
    clearInflight(userId);
  });

  return inflightStatePromise;
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

  // 使用 ref 跟踪加载状态，避免重复请求
  const loadingRef = useRef(false);
  const lastUserIdRef = useRef<string | null>(null);

  // 从缓存初始化状态
  const [state, setState] = useState<FetchState>(() => {
    const cached = getCachedState(userId);
    return cached || (userId ? loadingState : initialState);
  });

  // ========== 辅助函数：更新状态并同步缓存 ==========
  const updateState = useCallback(
    (updater: FetchState | ((prev: FetchState) => FetchState)) => {
      setState((prev) => {
        const newState =
          typeof updater === 'function' ? updater(prev) : updater;
        // 同步更新缓存
        setCachedState(newState, userId);
        return newState;
      });
    },
    [userId],
  );

  // ========== 核心加载函数 ==========
  const loadFromServer = useCallback(async () => {
    if (!userId) {
      clearCache();
      clearInflight();
      setState(initialState);
      return;
    }

    // 防止重复请求
    if (loadingRef.current) {
      return;
    }
    loadingRef.current = true;

    setState((prev) => ({ ...prev, isLoading: true, error: undefined }));

    try {
      const newState = await fetchCultivatorStateShared(userId);
      setCachedState(newState, userId);
      setState(newState);
    } catch (error) {
      console.warn('加载角色资料失败：', error);
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : prev.error,
      }));
    } finally {
      loadingRef.current = false;
    }
  }, [userId]);

  // ========== 细粒度刷新函数 ==========
  const refreshInventory = useCallback(
    async (
      types: InventoryType[] = ['artifacts', 'materials', 'consumables'],
    ) => {
      if (!state.cultivator?.id) return;

      const uniqueTypes = Array.from(new Set(types));
      const entries = await Promise.all(
        uniqueTypes.map(async (type) => {
          const items = await fetchInventoryByType(type);
          return [type, items] as const;
        }),
      );

      const patch: Partial<Inventory> = {};
      for (const [type, items] of entries) {
        if (items) {
          if (type === 'artifacts')
            patch.artifacts = items as Inventory['artifacts'];
          if (type === 'materials')
            patch.materials = items as Inventory['materials'];
          if (type === 'consumables')
            patch.consumables = items as Inventory['consumables'];
        }
      }

      if (Object.keys(patch).length === 0) return;

      updateState((prev) => {
        if (!prev.cultivator) return prev;

        const newInventory: Inventory = {
          ...prev.inventory,
          ...patch,
        };

        return {
          ...prev,
          cultivator: { ...prev.cultivator, inventory: newInventory },
          inventory: newInventory,
          inventoryLoaded: uniqueTypes.reduce(
            (acc, type) => {
              acc[type] = true;
              return acc;
            },
            { ...prev.inventoryLoaded },
          ),
        };
      });
    },
    [state.cultivator?.id, updateState],
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
    const count = await fetchUnreadCount();
    updateState((prev) => ({ ...prev, unreadMailCount: count }));
  }, [userId, updateState]);

  // ========== 初始化逻辑 ==========
  useEffect(() => {
    // 无用户时重置
    if (!userId) {
      if (lastUserIdRef.current !== null) {
        clearCache();
        setState(initialState);
      }
      clearInflight();
      lastUserIdRef.current = null;
      return;
    }

    // 用户未变化，跳过
    if (lastUserIdRef.current === userId) {
      return;
    }

    // 用户变化
    lastUserIdRef.current = userId;

    // 检查是否有缓存
    const cached = getCachedState(userId);
    if (cached) {
      setState(cached);
      return;
    }

    // 无缓存，从服务器加载
    setState(loadingState);
    loadFromServer();
  }, [userId, loadFromServer]);

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
