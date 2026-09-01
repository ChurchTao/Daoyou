import { buildTalismanUseConfirmText } from '@app/components/feature/consumables';
import type { ItemDetailPayload } from '@app/components/feature/items';
import { useInkUI } from '@app/components/providers/InkUIProvider';
import type { InkDialogState } from '@app/components/ui/InkDialog';
import {
  inventoryArtifactsResource,
  inventoryConsumablesResource,
  inventoryMaterialsResource,
} from '@app/lib/resources/definitions';
import { useResource } from '@app/lib/resources/hooks';
import { useResourceMutation } from '@app/lib/resources/mutations';
import {
  useCultivatorCondition,
  useCultivatorCurrency,
  useCultivatorIdentity,
  usePlayerLoadout,
  usePlayerSession,
} from '@app/lib/resources/player';
import { isAttributeResetTalismanScenario } from '@shared/config/attributeResetTalisman';
import { isQiRestoreTalismanScenario } from '@shared/config/qiSystem';
import { isSectMeridianResetTalismanScenario } from '@shared/config/sectMeridianResetTalisman';
import {
  isPillConsumable,
  isSpiritFruitConsumable,
  isTalismanConsumable,
} from '@shared/lib/consumables';
import type { CultivatorCondition } from '@shared/types/condition';
import {
  QUALITY_ORDER,
  type ElementType,
  type MaterialType,
  type Quality,
  type RealmType,
} from '@shared/types/constants';
import type {
  Artifact,
  Consumable,
  EquippedItems,
  Material,
} from '@shared/types/cultivator';
import { useCallback, useMemo, useState } from 'react';

export type InventoryTab = 'artifacts' | 'materials' | 'consumables';
export type InventoryItem = Artifact | Consumable | Material;
type ConsumableWithId = Consumable & { id: string };

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

function getIdentifyCostText(): string {
  return '1 天地灵气';
}

function getTalismanUseConfirmLines(item: Consumable): string[] {
  return buildTalismanUseConfirmText(item)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

export interface UseInventoryViewModelReturn {
  // 数据
  cultivatorId: string | null;
  realm: RealmType | undefined;
  condition: CultivatorCondition | undefined;
  spiritStones: number | undefined;
  inventory: InventoryByTab;
  equipped: EquippedItems | null;
  isLoading: boolean;
  isTabLoading: boolean;
  isTabRefreshing: boolean;
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
  // Tab 状态
  const [activeTab, setActiveTab] = useState<InventoryTab>('artifacts');
  const [pageByTab, setPageByTab] = useState<Record<InventoryTab, number>>({
    artifacts: 1,
    materials: 1,
    consumables: 1,
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
  const needsViewerFacts = activeTab === 'consumables' || isModalOpen;
  const session = usePlayerSession();
  const profile = useCultivatorIdentity(needsViewerFacts);
  const conditionQuery = useCultivatorCondition(needsViewerFacts);
  const currency = useCultivatorCurrency();
  const loadout = usePlayerLoadout(activeTab === 'artifacts');
  const cultivatorId = session.data?.activeCultivator?.id ?? null;
  const realm = profile.data?.cultivator.realm;
  const condition = conditionQuery.data;
  const spiritStones = currency.data?.spiritStones;
  const equipped = loadout.data?.equipped ?? null;
  const isLoading =
    currency.loading ||
    session.loading ||
    (needsViewerFacts && (profile.loading || conditionQuery.loading)) ||
    (activeTab === 'artifacts' && loadout.loading);
  const note = session.data?.note;

  const { pushToast } = useInkUI();
  const { mutate } = useResourceMutation();

  // Dialog 状态
  const [dialog, setDialog] = useState<InkDialogState | null>(null);

  // 操作状态
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [identifyCelebration, setIdentifyCelebration] =
    useState<IdentifyCelebrationState | null>(null);

  const clearIdentifyCelebration = useCallback(() => {
    setIdentifyCelebration(null);
  }, []);

  const artifactParams = useMemo(
    () => ({ page: pageByTab.artifacts, pageSize: DEFAULT_PAGE_SIZE }),
    [pageByTab.artifacts],
  );
  const materialParams = useMemo(
    () => ({
      page: pageByTab.materials,
      pageSize: DEFAULT_PAGE_SIZE,
      materialRanks:
        materialFilters.rank === 'all' ? undefined : [materialFilters.rank],
      materialTypes:
        materialFilters.type === 'all' ? undefined : [materialFilters.type],
      materialElements:
        materialFilters.element === 'all'
          ? undefined
          : [materialFilters.element],
      materialSortBy: materialFilters.sortBy,
      materialSortOrder: materialFilters.sortOrder,
    }),
    [materialFilters, pageByTab.materials],
  );
  const consumableParams = useMemo(
    () => ({ page: pageByTab.consumables, pageSize: DEFAULT_PAGE_SIZE }),
    [pageByTab.consumables],
  );
  const artifactsQuery = useResource(
    inventoryArtifactsResource,
    artifactParams,
    activeTab === 'artifacts' && Boolean(cultivatorId),
  );
  const materialsQuery = useResource(
    inventoryMaterialsResource,
    materialParams,
    activeTab === 'materials' && Boolean(cultivatorId),
  );
  const consumablesQuery = useResource(
    inventoryConsumablesResource,
    consumableParams,
    activeTab === 'consumables' && Boolean(cultivatorId),
  );
  const activeQuery =
    activeTab === 'artifacts'
      ? artifactsQuery
      : activeTab === 'materials'
        ? materialsQuery
        : consumablesQuery;
  const isTabLoading = activeQuery.loading;
  const isTabRefreshing = activeQuery.isRefreshing;

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
      if (!cultivatorId) return;

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
    [cultivatorId, mutate, pushToast],
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
        loadingLabel: '丢弃中……',
        onConfirm: async () => await handleDiscard(item, type),
      });
    },
    [handleDiscard],
  );

  // 装备/卸下法宝
  const handleEquipToggle = useCallback(
    async (item: Artifact) => {
      if (!cultivatorId || !item.id) {
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
    [cultivatorId, mutate, pushToast],
  );

  const executeConsumableUse = useCallback(
    async (item: ConsumableWithId) => {
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
    [mutate, pushToast],
  );

  // 使用消耗品
  const handleConsume = useCallback(
    async (item: Consumable) => {
      if (!cultivatorId || !item.id) {
        pushToast({
          message: '此消耗品暂无有效 ID，无法使用。',
          tone: 'warning',
        });
        return;
      }
      const usableItem: ConsumableWithId = { ...item, id: item.id };

      if (isTalismanConsumable(usableItem)) {
        if (
          !isQiRestoreTalismanScenario(usableItem.spec.scenario) &&
          !isAttributeResetTalismanScenario(usableItem.spec.scenario) &&
          !isSectMeridianResetTalismanScenario(usableItem.spec.scenario)
        ) {
          pushToast({
            message:
              '符箓需在对应特殊玩法入口校验并锁定，不能在背包中直接使用。',
            tone: 'warning',
          });
          return;
        }

        const effectLines = getTalismanUseConfirmLines(usableItem);
        setDialog({
          id: `talisman-use-confirm-${usableItem.id}`,
          title: '符箓使用确认',
          content: (
            <div className="space-y-3 py-3 text-sm leading-7">
              <p className="text-center">
                确认使用 <span className="font-bold">{usableItem.name}</span>{' '}
                吗？
              </p>
              <div className="border-ink/10 bg-paper space-y-1 border border-dashed p-3">
                <p className="text-ink-secondary text-xs font-bold">效用</p>
                {effectLines.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
              <p className="text-ink-secondary text-center text-xs">
                确认后将消耗 1 张符箓，使用结果无法撤回。
              </p>
            </div>
          ),
          confirmLabel: '确认使用',
          loadingLabel: '使用中……',
          onConfirm: async () => await executeConsumableUse(usableItem),
        });
        return;
      }

      if (
        !isPillConsumable(usableItem) &&
        !isSpiritFruitConsumable(usableItem)
      ) {
        pushToast({
          message: '该消耗品缺少有效药效数据，暂时无法服用。',
          tone: 'warning',
        });
        return;
      }

      await executeConsumableUse(usableItem);
    },
    [cultivatorId, executeConsumableUse, pushToast],
  );

  // 鉴定神秘材料
  const handleIdentifyMaterial = useCallback(
    async (item: Material) => {
      if (!cultivatorId || !item.id) {
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
            <span className="font-bold">{getIdentifyCostText()}</span>。
            <br />
            <span className="text-ink-secondary text-xs">
              鉴定后才会揭开真实材料，结果无法预先得知。
            </span>
          </p>
        ),
        confirmLabel: '确认鉴定',
        loadingLabel: '鉴定中……',
        onConfirm: executeIdentify,
      });
    },
    [cultivatorId, mutate, pushToast],
  );

  const pagination =
    activeQuery.data?.pagination ?? createEmptyPagination(DEFAULT_PAGE_SIZE);

  const goPrevPage = useCallback(() => {
    if (pagination.page <= 1 || isTabLoading) return;
    setPageByTab((current) => ({
      ...current,
      [activeTab]: pagination.page - 1,
    }));
  }, [activeTab, isTabLoading, pagination.page]);

  const goNextPage = useCallback(() => {
    if (pagination.page >= pagination.totalPages || isTabLoading) return;
    setPageByTab((current) => ({
      ...current,
      [activeTab]: pagination.page + 1,
    }));
  }, [activeTab, isTabLoading, pagination.page, pagination.totalPages]);

  const inventory = useMemo(
    () => ({
      artifacts: artifactsQuery.data?.items ?? [],
      materials: materialsQuery.data?.items ?? [],
      consumables: consumablesQuery.data?.items ?? [],
    }),
    [
      artifactsQuery.data?.items,
      consumablesQuery.data?.items,
      materialsQuery.data?.items,
    ],
  );

  return {
    // 数据
    cultivatorId,
    realm,
    condition,
    spiritStones,
    inventory,
    equipped,
    isLoading,
    isTabLoading,
    isTabRefreshing,
    note,
    pagination,

    // Tab 状态
    activeTab,
    setActiveTab,
    goPrevPage,
    goNextPage,
    materialFilters,
    setMaterialRankFilter: (rank) => {
      setPageByTab((current) => ({ ...current, materials: 1 }));
      setMaterialFilters((prev) => ({ ...prev, rank }));
    },
    setMaterialTypeFilter: (type) => {
      setPageByTab((current) => ({ ...current, materials: 1 }));
      setMaterialFilters((prev) => ({ ...prev, type }));
    },
    setMaterialElementFilter: (element) => {
      setPageByTab((current) => ({ ...current, materials: 1 }));
      setMaterialFilters((prev) => ({ ...prev, element }));
    },
    setMaterialSort: (sortBy, sortOrder) => {
      setPageByTab((current) => ({ ...current, materials: 1 }));
      setMaterialFilters((prev) => ({ ...prev, sortBy, sortOrder }));
    },
    resetMaterialFilters: () => {
      setPageByTab((current) => ({ ...current, materials: 1 }));
      setMaterialFilters({
        rank: 'all',
        type: 'all',
        element: 'all',
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });
    },

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
