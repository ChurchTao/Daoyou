import { useInkUI } from '@app/components/providers/InkUIProvider';
import type { InkDialogState } from '@app/components/ui/InkDialog';
import {
  usePlayerStateDomainVersion,
  usePlayerStateView,
  type PlayerStateView,
} from '@app/lib/player-state/selectors';
import { usePlayerStateActions } from '@app/lib/player-state/store';
import { isQiRestoreTalismanScenario } from '@shared/config/qiSystem';
import {
  isPillConsumable,
  isTalismanConsumable,
} from '@shared/lib/consumables';
import {
  QUALITY_ORDER,
  type ElementType,
  type MaterialType,
  type Quality,
} from '@shared/types/constants';
import type { Artifact, Consumable, Material } from '@shared/types/cultivator';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ItemDetailPayload } from '../components/itemDetailPayload';

export type InventoryTab = 'artifacts' | 'materials' | 'consumables';
export type InventoryItem = Artifact | Consumable | Material;

interface InventoryPagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

type InventoryByTab = {
  artifacts: Artifact[];
  materials: Material[];
  consumables: Consumable[];
};

export interface MaterialFilters {
  rank: Quality | 'all';
  type: MaterialType | 'all';
  element: ElementType | 'all';
  sortBy: 'createdAt' | 'rank' | 'type' | 'element' | 'quantity' | 'name';
  sortOrder: 'asc' | 'desc';
}

interface InventoryApiPayload {
  success: boolean;
  data?: {
    items?: InventoryByTab[InventoryTab];
    pagination?: InventoryPagination;
  };
  error?: string;
}

interface IdentifyApiResult {
  success: boolean;
  revealedItem?: Material;
  cost?: number;
  revealEffect?: string;
  jackpotLevel?: 'legendary_win' | 'win' | 'big_loss' | 'normal';
  error?: string;
}

interface IdentifyCelebrationState {
  rank?: string;
}

type InventoryLoadReason = 'reset' | 'refresh';

const inFlightInventoryRequestMap = new Map<
  string,
  Promise<InventoryApiPayload>
>();

const IDENTIFY_COST_BY_RANK: Record<Quality, number> = {
  凡品: 20,
  灵品: 80,
  玄品: 200,
  真品: 600,
  地品: 1600,
  天品: 4000,
  仙品: 12000,
  神品: 36000,
};

const DEFAULT_PAGE_SIZE = 20;

const createEmptyPagination = (
  pageSize = DEFAULT_PAGE_SIZE,
): InventoryPagination => ({
  page: 1,
  pageSize,
  total: 0,
  totalPages: 0,
  hasMore: false,
});

function getIdentifyCostText(item: Material): string {
  const details = item.details;
  const mystery =
    details && typeof details === 'object'
      ? (details as { mystery?: { identifyCost?: unknown } }).mystery
      : null;
  const cost = mystery?.identifyCost;
  if (typeof cost === 'number' && Number.isFinite(cost)) {
    return `${Math.max(1, Math.floor(cost))} 灵石`;
  }
  return `约 ${IDENTIFY_COST_BY_RANK[item.rank] ?? 200} 灵石`;
}

function areMaterialFiltersEqual(
  left: MaterialFilters,
  right: MaterialFilters,
): boolean {
  return (
    left.rank === right.rank &&
    left.type === right.type &&
    left.element === right.element &&
    left.sortBy === right.sortBy &&
    left.sortOrder === right.sortOrder
  );
}

async function fetchInventoryWithDedupe(
  url: string,
): Promise<InventoryApiPayload> {
  const inFlight = inFlightInventoryRequestMap.get(url);
  if (inFlight) return inFlight;

  const requestPromise = (async () => {
    const res = await fetch(url);
    const json = (await res.json()) as InventoryApiPayload;
    if (!res.ok || !json.success) {
      throw new Error(json.error || '背包加载失败');
    }
    return json;
  })().finally(() => {
    inFlightInventoryRequestMap.delete(url);
  });

  inFlightInventoryRequestMap.set(url, requestPromise);
  return requestPromise;
}

export interface UseInventoryViewModelReturn {
  // 数据
  cultivator: PlayerStateView['cultivator'];
  inventory: InventoryByTab;
  equipped: PlayerStateView['equipped'];
  isLoading: boolean;
  isTabLoading: boolean;
  note: string | undefined;
  pagination: InventoryPagination;

  // Tab 状态
  activeTab: InventoryTab;
  setActiveTab: (tab: InventoryTab) => void;
  goPrevPage: () => void;
  goNextPage: () => void;
  materialFilters: MaterialFilters;
  setMaterialRankFilter: (rank: Quality | 'all') => void;
  setMaterialTypeFilter: (type: MaterialType | 'all') => void;
  setMaterialElementFilter: (element: ElementType | 'all') => void;
  setMaterialSort: (
    sortBy: MaterialFilters['sortBy'],
    sortOrder: MaterialFilters['sortOrder'],
  ) => void;
  resetMaterialFilters: () => void;

  // Modal 状态
  selectedItem: ItemDetailPayload | null;
  isModalOpen: boolean;
  openItemDetail: (item: ItemDetailPayload) => void;
  closeItemDetail: () => void;

  // Dialog 状态
  dialog: InkDialogState | null;
  closeDialog: () => void;

  // 操作状态
  pendingId: string | null;
  identifyCelebration: IdentifyCelebrationState | null;
  clearIdentifyCelebration: () => void;

  // 业务操作
  handleEquipToggle: (item: Artifact) => Promise<void>;
  handleConsume: (item: Consumable) => Promise<void>;
  handleIdentifyMaterial: (item: Material) => Promise<void>;
  openDiscardConfirm: (
    item: InventoryItem,
    type: 'artifact' | 'consumable' | 'material',
  ) => void;
}

/**
 * 储物袋页面 ViewModel
 * 封装所有业务逻辑和状态管理
 */
export function useInventoryViewModel(): UseInventoryViewModelReturn {
  const { cultivator, equipped, isLoading, note } = usePlayerStateView();
  const inventoryVersion = usePlayerStateDomainVersion('inventory');
  const productsVersion = usePlayerStateDomainVersion('products');

  const { pushToast } = useInkUI();
  const { mutate } = usePlayerStateActions();

  // Tab 状态
  const [activeTab, setActiveTab] = useState<InventoryTab>('artifacts');
  const [isTabLoading, setIsTabLoading] = useState(false);
  const [inventoryByTab, setInventoryByTab] = useState<InventoryByTab>({
    artifacts: [],
    materials: [],
    consumables: [],
  });
  const [paginationByTab, setPaginationByTab] = useState<
    Record<InventoryTab, InventoryPagination>
  >({
    artifacts: createEmptyPagination(),
    materials: createEmptyPagination(),
    consumables: createEmptyPagination(),
  });
  const [materialFilters, setMaterialFilters] = useState<MaterialFilters>({
    rank: 'all',
    type: 'all',
    element: 'all',
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });

  // Modal 状态
  const [selectedItem, setSelectedItem] = useState<ItemDetailPayload | null>(
    null,
  );
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Dialog 状态
  const [dialog, setDialog] = useState<InkDialogState | null>(null);

  // 操作状态
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [identifyCelebration, setIdentifyCelebration] =
    useState<IdentifyCelebrationState | null>(null);

  const clearIdentifyCelebration = useCallback(() => {
    setIdentifyCelebration(null);
  }, []);

  const activeTabRef = useRef(activeTab);
  const paginationByTabRef = useRef(paginationByTab);
  const previousLoadInputsRef = useRef<{
    activeTab: InventoryTab;
    cultivatorId?: string;
    materialFilters: MaterialFilters;
  } | null>(null);

  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  useEffect(() => {
    paginationByTabRef.current = paginationByTab;
  }, [paginationByTab]);

  // 拉取分页数据（按类型）
  const fetchTabPage = useCallback(
    async (tab: InventoryTab, page: number) => {
      if (!cultivator?.id) return;

      setIsTabLoading(true);
      try {
        const params = new URLSearchParams({
          type: tab,
          page: String(page),
          pageSize: String(DEFAULT_PAGE_SIZE),
        });
        if (tab === 'materials') {
          if (materialFilters.rank !== 'all') {
            params.set('materialRanks', materialFilters.rank);
          }
          if (materialFilters.type !== 'all') {
            params.set('materialTypes', materialFilters.type);
          }
          if (materialFilters.element !== 'all') {
            params.set('materialElements', materialFilters.element);
          }
          params.set('materialSortBy', materialFilters.sortBy);
          params.set('materialSortOrder', materialFilters.sortOrder);
        }
        const requestUrl = `/api/cultivator/inventory?${params.toString()}`;
        const json = await fetchInventoryWithDedupe(requestUrl);

        const data = (json.data || {}) as {
          items: InventoryByTab[InventoryTab];
          pagination: InventoryPagination;
        };

        setInventoryByTab((prev) => ({
          ...prev,
          [tab]: data.items,
        }));
        setPaginationByTab((prev) => ({
          ...prev,
          [tab]: data.pagination,
        }));
      } catch (error) {
        pushToast({
          message:
            error instanceof Error ? `加载失败：${error.message}` : '加载失败',
          tone: 'danger',
        });
      } finally {
        setIsTabLoading(false);
      }
    },
    [cultivator?.id, materialFilters, pushToast],
  );

  useEffect(() => {
    if (!cultivator?.id) return;

    let cancelled = false;

    const loadActiveTab = async () => {
      const tab = activeTabRef.current;
      const previousLoadInputs = previousLoadInputsRef.current;
      const loadReason: InventoryLoadReason =
        !previousLoadInputs ||
        previousLoadInputs.cultivatorId !== cultivator.id ||
        previousLoadInputs.activeTab !== activeTab ||
        (tab === 'materials' &&
          !areMaterialFiltersEqual(
            previousLoadInputs.materialFilters,
            materialFilters,
          ))
          ? 'reset'
          : 'refresh';
      const currentPage = Math.max(
        1,
        paginationByTabRef.current[tab].page || 1,
      );
      const targetPage = loadReason === 'reset' ? 1 : currentPage;

      try {
        const fetchPage = async (page: number) => {
          const params = new URLSearchParams({
            type: tab,
            page: String(page),
            pageSize: String(DEFAULT_PAGE_SIZE),
          });
          if (tab === 'materials') {
            if (materialFilters.rank !== 'all') {
              params.set('materialRanks', materialFilters.rank);
            }
            if (materialFilters.type !== 'all') {
              params.set('materialTypes', materialFilters.type);
            }
            if (materialFilters.element !== 'all') {
              params.set('materialElements', materialFilters.element);
            }
            params.set('materialSortBy', materialFilters.sortBy);
            params.set('materialSortOrder', materialFilters.sortOrder);
          }

          const requestUrl = `/api/cultivator/inventory?${params.toString()}`;
          const json = await fetchInventoryWithDedupe(requestUrl);
          return (json.data || {}) as {
            items: InventoryByTab[InventoryTab];
            pagination: InventoryPagination;
          };
        };

        let data = await fetchPage(targetPage);
        if (
          !cancelled &&
          loadReason === 'refresh' &&
          data.pagination.page > Math.max(1, data.pagination.totalPages)
        ) {
          data = await fetchPage(Math.max(1, data.pagination.totalPages));
        }

        if (cancelled) return;

        setInventoryByTab((prev) => ({
          ...prev,
          [tab]: data.items,
        }));
        setPaginationByTab((prev) => ({
          ...prev,
          [tab]: data.pagination,
        }));
        previousLoadInputsRef.current = {
          activeTab,
          cultivatorId: cultivator.id,
          materialFilters,
        };
      } catch (error) {
        if (!cancelled) {
          pushToast({
            message:
              error instanceof Error
                ? `加载失败：${error.message}`
                : '加载失败',
            tone: 'danger',
          });
        }
      } finally {
        if (!cancelled) {
          setIsTabLoading(false);
        }
      }
    };

    void loadActiveTab();

    return () => {
      cancelled = true;
    };
  }, [
    activeTab,
    cultivator?.id,
    inventoryVersion,
    materialFilters,
    productsVersion,
    pushToast,
  ]);

  // 打开物品详情
  const openItemDetail = useCallback((item: ItemDetailPayload) => {
    setSelectedItem(item);
    setIsModalOpen(true);
  }, []);

  // 关闭物品详情
  const closeItemDetail = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  // 关闭对话框
  const closeDialog = useCallback(() => {
    setDialog(null);
  }, []);

  // 丢弃操作
  const handleDiscard = useCallback(
    async (
      item: InventoryItem,
      type: 'artifact' | 'consumable' | 'material',
    ) => {
      if (!cultivator) return;

      try {
        setDialog((prev) => ({
          ...prev!,
          loading: true,
        }));

        await mutate(
          fetch(`/api/cultivator/inventory/discard`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ itemId: item.id, itemType: type }),
          }),
        );

        pushToast({ message: '物品已丢弃', tone: 'success' });
      } catch (error) {
        pushToast({
          message:
            error instanceof Error ? `操作失败：${error.message}` : '操作失败',
          tone: 'danger',
        });
      } finally {
        setDialog((prev) => ({
          ...prev!,
          loading: false,
        }));
      }
    },
    [cultivator, mutate, pushToast],
  );

  // 打开丢弃确认
  const openDiscardConfirm = useCallback(
    (item: InventoryItem, type: 'artifact' | 'consumable' | 'material') => {
      setDialog({
        id: 'discard-confirm',
        title: '丢弃确认',
        content: (
          <p className="py-4 text-center">
            确定要丢弃 <span className="font-bold">{item.name}</span> 吗？
            <br />
            <span className="text-ink-secondary text-xs">
              丢弃后将无法找回。
            </span>
          </p>
        ),
        confirmLabel: '确认丢弃',
        loadingLabel: '丢弃中...',
        onConfirm: async () => await handleDiscard(item, type),
      });
    },
    [handleDiscard],
  );

  // 装备/卸下法宝
  const handleEquipToggle = useCallback(
    async (item: Artifact) => {
      if (!cultivator || !item.id) {
        pushToast({
          message: '此法宝暂无有效 ID，无法操作。',
          tone: 'warning',
        });
        return;
      }

      setPendingId(item.id);
      try {
        await mutate(
          fetch(`/api/cultivator/equip`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ artifactId: item.id }),
          }),
        );

        pushToast({ message: '法宝灵性已调顺。', tone: 'success' });
      } catch (error) {
        pushToast({
          message:
            error instanceof Error
              ? `此法有违天道：${error.message}`
              : '操作失败，请稍后重试。',
          tone: 'danger',
        });
      } finally {
        setPendingId(null);
      }
    },
    [cultivator, mutate, pushToast],
  );

  // 服用丹药
  const handleConsume = useCallback(
    async (item: Consumable) => {
      if (!cultivator || !item.id) {
        pushToast({
          message: '此消耗品暂无有效 ID，无法使用。',
          tone: 'warning',
        });
        return;
      }

      if (isTalismanConsumable(item)) {
        if (!isQiRestoreTalismanScenario(item.spec.scenario)) {
          pushToast({
            message:
              '符箓需在对应特殊玩法入口校验并锁定，不能在背包中直接使用。',
            tone: 'warning',
          });
          return;
        }
      } else if (!isPillConsumable(item)) {
        pushToast({
          message: '该消耗品缺少有效丹药数据，暂时无法服用。',
          tone: 'warning',
        });
        return;
      }

      setPendingId(item.id);
      try {
        const result = await mutate<{
          message: string;
          consumable: Consumable;
        }>(
          fetch('/api/cultivator/consume', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ consumableId: item.id }),
          }),
        );

        pushToast({
          message: result.message || `${item.name}已使用。`,
          tone: 'success',
        });
      } catch (error) {
        pushToast({
          message:
            error instanceof Error ? `使用失败：${error.message}` : '使用失败',
          tone: 'danger',
        });
      } finally {
        setPendingId(null);
      }
    },
    [cultivator, mutate, pushToast],
  );

  // 鉴定神秘材料
  const handleIdentifyMaterial = useCallback(
    async (item: Material) => {
      if (!cultivator || !item.id) {
        pushToast({
          message: '此物暂无有效 ID，无法鉴定。',
          tone: 'warning',
        });
        return;
      }
      const materialId = item.id;

      const executeIdentify = async () => {
        setPendingId(materialId);
        try {
          const result = await mutate<IdentifyApiResult>(
            fetch('/api/cultivator/inventory/identify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ materialId }),
            }),
          );

          const revealed = result.revealedItem
            ? {
                ...result.revealedItem,
                quantity: result.revealedItem.quantity || 1,
              }
            : null;

          pushToast({
            message: `鉴定完成：${result.revealedItem?.name || '未知宝物'}`,
            tone: 'success',
          });

          if (revealed) {
            setSelectedItem({ kind: 'material', item: revealed });
            setIsModalOpen(true);
          }

          const isHeavenOrAbove =
            revealed && QUALITY_ORDER[revealed.rank] >= QUALITY_ORDER['天品'];

          if (isHeavenOrAbove) {
            setIdentifyCelebration({
              rank: revealed.rank,
            });
          }
        } catch (error) {
          pushToast({
            message:
              error instanceof Error
                ? `鉴定失败：${error.message}`
                : '鉴定失败',
            tone: 'danger',
          });
        } finally {
          setPendingId(null);
        }
      };

      setDialog({
        id: 'identify-confirm',
        title: '鉴定确认',
        content: (
          <p className="py-4 text-center">
            鉴定 <span className="font-bold">{item.name}</span> 需要消耗{' '}
            <span className="font-bold">{getIdentifyCostText(item)}</span>。
            <br />
            <span className="text-ink-secondary text-xs">
              鉴定后才会揭开真实材料，结果无法预先得知。
            </span>
          </p>
        ),
        confirmLabel: '确认鉴定',
        loadingLabel: '鉴定中...',
        onConfirm: executeIdentify,
      });
    },
    [cultivator, mutate, pushToast],
  );

  const pagination = paginationByTab[activeTab];

  const goPrevPage = useCallback(() => {
    const current = paginationByTab[activeTab];
    if (current.page <= 1 || isTabLoading) return;
    void fetchTabPage(activeTab, current.page - 1);
  }, [activeTab, fetchTabPage, isTabLoading, paginationByTab]);

  const goNextPage = useCallback(() => {
    const current = paginationByTab[activeTab];
    if (current.page >= current.totalPages || isTabLoading) return;
    void fetchTabPage(activeTab, current.page + 1);
  }, [activeTab, fetchTabPage, isTabLoading, paginationByTab]);

  const inventory = useMemo(
    () => ({
      artifacts: inventoryByTab.artifacts,
      materials: inventoryByTab.materials,
      consumables: inventoryByTab.consumables,
    }),
    [inventoryByTab],
  );

  return {
    // 数据
    cultivator,
    inventory,
    equipped,
    isLoading,
    isTabLoading,
    note,
    pagination,

    // Tab 状态
    activeTab,
    setActiveTab,
    goPrevPage,
    goNextPage,
    materialFilters,
    setMaterialRankFilter: (rank) =>
      setMaterialFilters((prev) => ({ ...prev, rank })),
    setMaterialTypeFilter: (type) =>
      setMaterialFilters((prev) => ({ ...prev, type })),
    setMaterialElementFilter: (element) =>
      setMaterialFilters((prev) => ({ ...prev, element })),
    setMaterialSort: (sortBy, sortOrder) =>
      setMaterialFilters((prev) => ({ ...prev, sortBy, sortOrder })),
    resetMaterialFilters: () =>
      setMaterialFilters({
        rank: 'all',
        type: 'all',
        element: 'all',
        sortBy: 'createdAt',
        sortOrder: 'desc',
      }),

    // Modal 状态
    selectedItem,
    isModalOpen,
    openItemDetail,
    closeItemDetail,

    // Dialog 状态
    dialog,
    closeDialog,

    // 操作状态
    pendingId,
    identifyCelebration,
    clearIdentifyCelebration,

    // 业务操作
    handleEquipToggle,
    handleConsume,
    handleIdentifyMaterial,
    openDiscardConfirm,
  };
}
