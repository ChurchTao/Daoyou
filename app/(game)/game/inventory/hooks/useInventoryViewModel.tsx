'use client';

import { useInkUI } from '@/components/providers/InkUIProvider';
import type { InkDialogState } from '@/components/ui/InkDialog';
import { useCultivator } from '@/lib/contexts/CultivatorContext';
import {
  type ElementType,
  type MaterialType,
  type Quality,
} from '@/types/constants';
import type { Artifact, Consumable, Material } from '@/types/cultivator';
import { useCallback, useEffect, useMemo, useState } from 'react';

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

const inFlightInventoryRequestMap = new Map<
  string,
  Promise<InventoryApiPayload>
>();

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
  cultivator: ReturnType<typeof useCultivator>['cultivator'];
  inventory: InventoryByTab;
  equipped: ReturnType<typeof useCultivator>['equipped'];
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
  selectedItem: InventoryItem | null;
  isModalOpen: boolean;
  openItemDetail: (item: InventoryItem) => void;
  closeItemDetail: () => void;

  // Dialog 状态
  dialog: InkDialogState | null;
  closeDialog: () => void;

  // 操作状态
  pendingId: string | null;

  // 业务操作
  handleEquipToggle: (item: Artifact) => Promise<void>;
  handleConsume: (item: Consumable) => Promise<void>;
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
  const PAGE_SIZE = 20;

  const {
    cultivator,
    equipped,
    isLoading,
    refresh,
    refreshInventory,
    note,
  } = useCultivator();

  const { pushToast } = useInkUI();

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
    artifacts: {
      page: 1,
      pageSize: PAGE_SIZE,
      total: 0,
      totalPages: 0,
      hasMore: false,
    },
    materials: {
      page: 1,
      pageSize: PAGE_SIZE,
      total: 0,
      totalPages: 0,
      hasMore: false,
    },
    consumables: {
      page: 1,
      pageSize: PAGE_SIZE,
      total: 0,
      totalPages: 0,
      hasMore: false,
    },
  });
  const [materialFilters, setMaterialFilters] = useState<MaterialFilters>({
    rank: 'all',
    type: 'all',
    element: 'all',
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });

  // Modal 状态
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Dialog 状态
  const [dialog, setDialog] = useState<InkDialogState | null>(null);

  // 操作状态
  const [pendingId, setPendingId] = useState<string | null>(null);

  // 拉取分页数据（按类型）
  const fetchTabPage = useCallback(
    async (tab: InventoryTab, page: number) => {
      if (!cultivator?.id) return;

      setIsTabLoading(true);
      try {
        const params = new URLSearchParams({
          type: tab,
          page: String(page),
          pageSize: String(PAGE_SIZE),
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
    void fetchTabPage(activeTab, 1);
  }, [activeTab, cultivator?.id, fetchTabPage]);

  // 打开物品详情
  const openItemDetail = useCallback((item: InventoryItem) => {
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

        const response = await fetch(`/api/cultivator/inventory/discard`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ itemId: item.id, itemType: type }),
        });

        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.error || '丢弃失败');
        }

        pushToast({ message: '物品已丢弃', tone: 'success' });
        await refreshInventory([activeTab]);
        await fetchTabPage(activeTab, paginationByTab[activeTab].page);
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
    [activeTab, cultivator, fetchTabPage, paginationByTab, pushToast, refreshInventory],
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
        const response = await fetch(`/api/cultivator/equip`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ artifactId: item.id }),
        });

        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.error || '装备操作失败');
        }

        pushToast({ message: '法宝灵性已调顺。', tone: 'success' });
        await refresh();
        await fetchTabPage('artifacts', paginationByTab.artifacts.page);
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
    [cultivator, fetchTabPage, paginationByTab.artifacts.page, pushToast, refresh],
  );

  // 服用丹药
  const handleConsume = useCallback(
    async (item: Consumable) => {
      if (!cultivator || !item.id) {
        pushToast({
          message: '此丹药暂无有效 ID，无法服用。',
          tone: 'warning',
        });
        return;
      }

      setPendingId(item.id);
      try {
        const response = await fetch(`/api/cultivator/consume`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ consumableId: item.id }),
        });

        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.error || '使用失败');
        }

        pushToast({ message: result.data.message, tone: 'success' });
        await refresh();
        await fetchTabPage('consumables', paginationByTab.consumables.page);
      } catch (error) {
        pushToast({
          message: error instanceof Error ? error.message : '使用失败',
          tone: 'danger',
        });
      } finally {
        setPendingId(null);
      }
    },
    [cultivator, fetchTabPage, paginationByTab.consumables.page, pushToast, refresh],
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

    // 业务操作
    handleEquipToggle,
    handleConsume,
    openDiscardConfirm,
  };
}
