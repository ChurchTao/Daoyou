import { ConsumableListCard } from '@app/components/feature/consumables';
import { ArtifactListCard } from '@app/components/feature/products';
import {
  GameLoadingState,
  GameSceneAsideSection,
  GameSceneFrame,
  GameSceneTabs,
} from '@app/components/game-shell';
import {
  InkBadge,
  InkButton,
  InkDialog,
  InkInput,
  InkList,
  InkListItem,
  InkNotice,
} from '@app/components/ui';
import { TypewriterText } from '@app/components/ui/TypewriterText';
import {
  useArtifactInventoryResource,
  useConsumableInventoryResource,
  useMaterialInventoryResource,
} from '@app/lib/resources/inventory';
import { useResourceMutation } from '@app/lib/resources/mutations';
import {
  useCultivatorCurrency,
  usePlayerLoadout,
  usePlayerSession,
} from '@app/lib/resources/player';
import { MAX_PLAYER_ITEM_QUANTITY } from '@shared/config/itemQuantity';
import { isPillConsumable } from '@shared/lib/consumables';
import { getMaterialTypeInfo } from '@shared/lib/gameConceptDisplay';
import { QUALITY_ORDER } from '@shared/types/constants';
import type { Artifact, Consumable, Material } from '@shared/types/cultivator';
import type {
  HighTierAppraisal,
  SellConfirmResponse,
  SellItemType,
  SellPreviewResponse,
} from '@shared/types/market';
import { useCallback, useMemo, useState, type ReactNode } from 'react';

interface SellApiError {
  error?: string;
}

interface RecycleDialogState {
  id: string;
  title?: string;
  content: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  loadingLabel?: string;
  onConfirm?: () => void | Promise<void>;
}

type RecycleTab = 'materials' | 'artifacts' | 'consumables';

function isMysteryMaterial(item: Pick<Material, 'details'>): boolean {
  const details = item.details;
  return !!details && typeof details === 'object' && 'mystery' in details;
}

async function requestSellPreview(
  itemType: SellItemType,
  itemIds: string[],
  quantity = 1,
): Promise<SellPreviewResponse> {
  const response = await fetch('/api/market/sell', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phase: 'preview',
      itemType,
      ...(itemType === 'consumable'
        ? { items: itemIds.map((id) => ({ id, quantity })) }
        : { itemIds }),
    }),
  });
  const payload = (await response.json()) as SellPreviewResponse & SellApiError;
  if (!response.ok || !payload.success) {
    throw new Error(payload.error || '回收预览失败');
  }
  return payload;
}

async function requestSellConfirm(
  sessionId: string,
  mutate: (request: Promise<Response>) => Promise<SellConfirmResponse>,
): Promise<SellConfirmResponse> {
  return mutate(
    fetch('/api/market/sell', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phase: 'confirm',
        sessionId,
      }),
    }),
  );
}

async function requestAllLowTierSellPreview(
  itemType: SellItemType,
): Promise<SellPreviewResponse> {
  const response = await fetch('/api/market/sell', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phase: 'preview',
      itemType,
      selection: 'low-tier-all',
    }),
  });
  const payload = (await response.json()) as SellPreviewResponse & SellApiError;
  if (!response.ok || !payload.success) {
    throw new Error(payload.error || '检索可回收物品失败');
  }
  return payload;
}

export default function MarketRecyclePage() {
  const session = usePlayerSession();
  const currency = useCultivatorCurrency();
  const loadout = usePlayerLoadout();
  const cultivatorId = session.data?.activeCultivator?.id;
  const equipped = loadout.data?.equipped;
  const { mutate } = useResourceMutation();
  const [activeTab, setActiveTab] = useState<RecycleTab>('materials');
  const [dialog, setDialog] = useState<RecycleDialogState | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [pendingItemId, setPendingItemId] = useState<string | null>(null);
  const [consumableQuantities, setConsumableQuantities] = useState<
    Record<string, string>
  >({});

  const equippedIds = useMemo(
    () =>
      new Set<string>(
        [equipped?.weapon, equipped?.armor, equipped?.accessory].filter(
          Boolean,
        ) as string[],
      ),
    [equipped?.accessory, equipped?.armor, equipped?.weapon],
  );

  const materialInventory = useMaterialInventoryResource({
    enabled: Boolean(cultivatorId),
    pageSize: 20,
    materialSortBy: 'createdAt',
    materialSortOrder: 'desc',
  });
  const artifactInventory = useArtifactInventoryResource({
    enabled: Boolean(cultivatorId),
    pageSize: 20,
  });
  const consumableInventory = useConsumableInventoryResource({
    enabled: Boolean(cultivatorId),
    pageSize: 20,
    consumableKind: 'pill',
  });
  const materials = materialInventory.items ?? [];
  const materialPagination = materialInventory.pagination ?? {
    page: materialInventory.page,
    pageSize: 20,
    total: 0,
    totalPages: 0,
    hasMore: false,
  };
  const materialLoading = materialInventory.loading;
  const materialRefreshing = materialInventory.isRefreshing;
  const materialInitialized = materialInventory.data !== undefined;
  const materialError = materialInventory.error;
  const refreshMaterialPage = materialInventory.reload;
  const goPrevMaterialPage = materialInventory.goPrevPage;
  const goNextMaterialPage = materialInventory.goNextPage;
  const artifacts = artifactInventory.items ?? [];
  const artifactPagination = artifactInventory.pagination ?? {
    page: artifactInventory.page,
    pageSize: 20,
    total: 0,
    totalPages: 0,
    hasMore: false,
  };
  const artifactLoading = artifactInventory.loading;
  const artifactRefreshing = artifactInventory.isRefreshing;
  const artifactInitialized = artifactInventory.data !== undefined;
  const artifactError = artifactInventory.error;
  const refreshArtifactPage = artifactInventory.reload;
  const goPrevArtifactPage = artifactInventory.goPrevPage;
  const goNextArtifactPage = artifactInventory.goNextPage;
  const consumableItems = (consumableInventory.items ?? []).filter(
    isPillConsumable,
  );
  const consumablePagination = consumableInventory.pagination ?? {
    page: consumableInventory.page,
    pageSize: 20,
    total: 0,
    totalPages: 0,
    hasMore: false,
  };
  const consumableLoading = consumableInventory.loading;
  const consumableRefreshing = consumableInventory.isRefreshing;
  const consumableInitialized = consumableInventory.data !== undefined;
  const consumableError = consumableInventory.error;
  const refreshConsumablePage = consumableInventory.reload;
  const goPrevConsumablePage = consumableInventory.goPrevPage;
  const goNextConsumablePage = consumableInventory.goNextPage;

  const closeDialog = useCallback(() => {
    if (isProcessing) return;
    setDialog(null);
  }, [isProcessing]);

  const refreshCurrentTab = useCallback(async () => {
    if (activeTab === 'materials') {
      await refreshMaterialPage();
      return;
    }
    if (activeTab === 'artifacts') {
      await refreshArtifactPage();
      return;
    }
    await refreshConsumablePage();
  }, [
    activeTab,
    refreshArtifactPage,
    refreshConsumablePage,
    refreshMaterialPage,
  ]);

  const handleSellConfirm = useCallback(
    async (preview: SellPreviewResponse) => {
      try {
        setIsProcessing(true);
        setDialog((prev) => ({
          ...prev!,
          loading: true,
        }));
        const result = await requestSellConfirm(preview.sessionId, mutate);
        setDialog({
          id: 'sell-result',
          title: '回收完成',
          content: (
            <p className="py-3 text-center leading-7">
              坊市已入账
              <span className="text-wood mx-1 font-bold">
                {result.gainedSpiritStones}
              </span>
              灵石。
            </p>
          ),
          confirmLabel: '知晓',
          cancelLabel: '关闭',
        });
      } catch (err) {
        setDialog({
          id: 'sell-error',
          title: '回收失败',
          content: (
            <p className="text-crimson py-3 text-center">
              {err instanceof Error ? err.message : '未知错误'}
            </p>
          ),
          confirmLabel: '知晓',
          cancelLabel: '关闭',
        });
      } finally {
        setIsProcessing(false);
        setPendingItemId(null);
        setBulkLoading(false);
      }
    },
    [mutate],
  );

  const openPreviewDialog = useCallback(
    (preview: SellPreviewResponse) => {
      const isHighTier = preview.mode === 'high_single';
      const first = preview.items[0];
      const appraisal = preview.appraisal as HighTierAppraisal | undefined;
      const totalCount = preview.items.reduce(
        (sum, item) => sum + item.quantity,
        0,
      );
      const isArtifact = preview.itemType === 'artifact';
      const isConsumable = preview.itemType === 'consumable';

      setDialog({
        id: `sell-preview-${preview.sessionId}`,
        title: isHighTier
          ? isArtifact
            ? '法宝鉴评'
            : isConsumable
              ? '高阶丹药回收确认'
              : '鉴宝师评估'
          : isArtifact
            ? '法宝回收确认'
            : isConsumable
              ? '废丹回收确认'
              : '废料回收确认',
        content: (
          <div className="space-y-3 py-1">
            {isHighTier && appraisal ? (
              <>
                <p className="text-sm">
                  宝物：
                  <span className="ml-1 font-bold">{first?.name}</span>
                </p>
                <p className="text-sm">
                  评级：
                  <span className="text-wood ml-1 font-bold">
                    {appraisal.rating}
                  </span>
                </p>
                <div className="bg-ink/5 border-ink/10 border p-2 text-sm leading-6">
                  <TypewriterText
                    text={appraisal.comment}
                    speed={36}
                    showCursor
                    enabled
                  />
                </div>
                <p className="text-center leading-7">
                  估价：
                  <span className="ml-1 font-bold">
                    {preview.totalSpiritStones}
                  </span>{' '}
                  灵石
                </p>
              </>
            ) : (
              <p className="text-center leading-7">
                本次将清理 <span className="font-bold">{totalCount}</span>{' '}
                {isArtifact ? '件法宝' : isConsumable ? '枚丹药' : '份废料'}
                ，预计获得{' '}
                <span className="font-bold">
                  {preview.totalSpiritStones}
                </span>{' '}
                灵石。
              </p>
            )}
          </div>
        ),
        confirmLabel: '确认回收',
        cancelLabel: '再想想',
        loadingLabel: '交易中……',
        onConfirm: async () => await handleSellConfirm(preview),
      });
    },
    [handleSellConfirm],
  );

  const handleSingleMaterialRecycle = useCallback(
    async (item: Material) => {
      if (!item.id) return;
      setPendingItemId(item.id);
      try {
        const preview = await requestSellPreview('material', [item.id]);
        setPendingItemId(null);
        openPreviewDialog(preview);
      } catch (err) {
        setPendingItemId(null);
        setDialog({
          id: 'material-preview-error',
          title: '鉴定失败',
          content: (
            <p className="text-crimson py-3 text-center">
              {err instanceof Error ? err.message : '鉴定失败'}
            </p>
          ),
          confirmLabel: '知晓',
          cancelLabel: '关闭',
        });
      }
    },
    [openPreviewDialog],
  );

  const handleSingleArtifactRecycle = useCallback(
    async (item: Artifact) => {
      if (!item.id) return;
      if (equippedIds.has(item.id)) {
        setDialog({
          id: 'artifact-equipped-warning',
          title: '不可回收',
          content: (
            <p className="text-crimson py-3 text-center">
              已装备法宝不可回收，请先卸下。
            </p>
          ),
          confirmLabel: '知晓',
          cancelLabel: '关闭',
        });
        return;
      }

      setPendingItemId(item.id);
      try {
        const preview = await requestSellPreview('artifact', [item.id]);
        setPendingItemId(null);
        openPreviewDialog(preview);
      } catch (err) {
        setPendingItemId(null);
        setDialog({
          id: 'artifact-preview-error',
          title: '鉴评失败',
          content: (
            <p className="text-crimson py-3 text-center">
              {err instanceof Error ? err.message : '鉴评失败'}
            </p>
          ),
          confirmLabel: '知晓',
          cancelLabel: '关闭',
        });
      }
    },
    [equippedIds, openPreviewDialog],
  );

  const handleSingleConsumableRecycle = useCallback(
    async (item: Consumable) => {
      if (!item.id) return;
      const quantity = Number.parseInt(consumableQuantities[item.id] || '1');
      if (
        !Number.isInteger(quantity) ||
        quantity < 1 ||
        quantity > Math.min(item.quantity, MAX_PLAYER_ITEM_QUANTITY)
      ) {
        setDialog({
          id: 'consumable-quantity-error',
          title: '数量有误',
          content: (
            <p className="text-crimson py-3 text-center">
              回收数量范围为 1～
              {Math.min(item.quantity, MAX_PLAYER_ITEM_QUANTITY)}。
            </p>
          ),
          confirmLabel: '知晓',
          cancelLabel: '关闭',
        });
        return;
      }

      setPendingItemId(item.id);
      try {
        const preview = await requestSellPreview(
          'consumable',
          [item.id],
          quantity,
        );
        setPendingItemId(null);
        openPreviewDialog(preview);
      } catch (err) {
        setPendingItemId(null);
        setDialog({
          id: 'consumable-preview-error',
          title: '估价失败',
          content: (
            <p className="text-crimson py-3 text-center">
              {err instanceof Error ? err.message : '估价失败'}
            </p>
          ),
          confirmLabel: '知晓',
          cancelLabel: '关闭',
        });
      }
    },
    [consumableQuantities, openPreviewDialog],
  );

  const handleBulkRecycle = useCallback(async () => {
    setBulkLoading(true);
    try {
      if (activeTab === 'materials') {
        const preview = await requestAllLowTierSellPreview('material');
        setBulkLoading(false);
        openPreviewDialog(preview);
        return;
      }

      const preview = await requestAllLowTierSellPreview(
        activeTab === 'artifacts' ? 'artifact' : 'consumable',
      );
      setBulkLoading(false);
      openPreviewDialog(preview);
    } catch (err) {
      setDialog({
        id: 'bulk-preview-error',
        title: '预览失败',
        content: (
          <p className="text-crimson py-3 text-center">
            {err instanceof Error ? err.message : '预览失败'}
          </p>
        ),
        confirmLabel: '知晓',
        cancelLabel: '关闭',
      });
      setBulkLoading(false);
    }
  }, [activeTab, openPreviewDialog]);

  const dialogState = dialog
    ? {
        ...dialog,
        onCancel: closeDialog,
      }
    : null;

  const isMaterialTab = activeTab === 'materials';
  const isArtifactTab = activeTab === 'artifacts';
  const isLoading = isMaterialTab
    ? materialLoading
    : isArtifactTab
      ? artifactLoading
      : consumableLoading;
  const isRefreshing = isMaterialTab
    ? materialRefreshing
    : isArtifactTab
      ? artifactRefreshing
      : consumableRefreshing;
  const isInitialized = isMaterialTab
    ? materialInitialized
    : isArtifactTab
      ? artifactInitialized
      : consumableInitialized;
  const listError = isMaterialTab
    ? materialError
    : isArtifactTab
      ? artifactError
      : consumableError;
  const pagination = isMaterialTab
    ? materialPagination
    : isArtifactTab
      ? artifactPagination
      : consumablePagination;

  const hasItems = isMaterialTab
    ? isInitialized && materials.length > 0
    : isArtifactTab
      ? isInitialized && artifacts.length > 0
      : isInitialized && consumableItems.length > 0;

  return (
    <GameSceneFrame
      variant="workflow"
      title="【坊市鉴宝司】"
      description="鉴宝司按品相估价材料、法宝与丹药，确认货单后当场结算灵石。"
      aside={
        <>
          <GameSceneAsideSection title="鉴宝摘要">
            <div className="space-y-2 text-sm leading-7">
              <p>灵石余额：{currency.data?.spiritStones ?? '读取中'}</p>
              <p>
                当前页签：
                {isMaterialTab
                  ? '材料回收'
                  : isArtifactTab
                    ? '法宝回收'
                    : '丹药回收'}
              </p>
              <p>
                当前页次：{pagination.page} /{' '}
                {Math.max(pagination.totalPages, 1)}
              </p>
              {isArtifactTab ? <p>已装备法宝：{equippedIds.size} 件</p> : null}
            </div>
          </GameSceneAsideSection>
          <GameSceneAsideSection
            title="回收规矩"
            className="text-sm leading-7"
            help={{
              title: '坊市鉴宝司回收规矩',
              content: (
                <div className="space-y-2 text-sm leading-7">
                  {isMaterialTab ? (
                    <>
                      <p>
                        凡、灵、玄品材料适合批量清理；高阶材料会先进入鉴定流程。
                      </p>
                      <p>预览过期后需重新鉴定，确认前不会真正成交。</p>
                    </>
                  ) : isArtifactTab ? (
                    <>
                      <p>已装备法宝不可回收；高阶法宝仅支持单件鉴评。</p>
                      <p>凡、灵、玄品法宝可直接纳入批量清理。</p>
                    </>
                  ) : (
                    <>
                      <p>仅回收有效丹药，符箓等其他消耗品不纳入。</p>
                      <p>可选择单组数量；凡、灵、玄品丹药可批量清理。</p>
                    </>
                  )}
                </div>
              ),
            }}
          />
        </>
      }
    >
      <GameSceneTabs
        activeValue={activeTab}
        onChange={(value) => setActiveTab(value as RecycleTab)}
        items={[
          { label: '材料回收', value: 'materials' },
          { label: '法宝回收', value: 'artifacts' },
          { label: '丹药回收', value: 'consumables' },
        ]}
      />

      <div className="space-y-3">
        {isMaterialTab ? (
          <p className="text-ink-secondary text-sm leading-7">
            真品及以上需先行鉴定再成交；凡、灵、玄品可批量清理。鉴定结果当场生效，
            过时需重新鉴定。
          </p>
        ) : isArtifactTab ? (
          <p className="text-ink-secondary text-sm leading-7">
            真品及以上法宝仅支持单件鉴评回收；凡、灵、玄品可批量清理。
            已装备法宝不可回收，需先卸下。
          </p>
        ) : (
          <p className="text-ink-secondary text-sm leading-7">
            丹药按品质、品相、评分和实际功效保守估价；可先选数量，再确认回收。
          </p>
        )}

        <div className="mt-3 flex gap-2">
          <InkButton
            variant="primary"
            onClick={() => void handleBulkRecycle()}
            disabled={isLoading || isRefreshing || isProcessing}
            pending={bulkLoading}
            pendingLabel="清点中……"
          >
            {isMaterialTab
              ? '一键出售低阶材料'
              : isArtifactTab
                ? '一键出售低阶法宝'
                : '一键回收低阶丹药'}
          </InkButton>
          <InkButton
            variant="secondary"
            onClick={() => void refreshCurrentTab()}
            disabled={isLoading}
            pending={isRefreshing}
            pendingLabel="刷新中……"
          >
            {isMaterialTab
              ? '刷新材料'
              : isArtifactTab
                ? '刷新法宝'
                : '刷新丹药'}
          </InkButton>
        </div>
      </div>

      <div className="space-y-4">
        {isRefreshing && hasItems ? (
          <GameLoadingState message="鉴宝师正在更新名录……" variant="inline" />
        ) : null}
        {!isInitialized && isLoading ? (
          <GameLoadingState
            message={
              isMaterialTab
                ? '鉴宝师正在清点货架，请稍候……'
                : isArtifactTab
                  ? '鉴宝师正在核对法宝名录，请稍候……'
                  : '药师正在核对丹药名录，请稍候……'
            }
            variant="inline"
          />
        ) : listError ? (
          <InkNotice>{listError}</InkNotice>
        ) : !hasItems ? (
          <InkNotice>
            {isMaterialTab
              ? '储物袋暂无材料，先去历练再来坊市吧。'
              : isArtifactTab
                ? '储物袋暂无法宝，先去炼器或探险再来坊市吧。'
                : '储物袋暂无可回收丹药。'}
          </InkNotice>
        ) : isMaterialTab ? (
          <InkList>
            {materials.map((item) => {
              const typeInfo = getMaterialTypeInfo(item.type);
              const isLow = QUALITY_ORDER[item.rank] <= QUALITY_ORDER['玄品'];
              const isMystery = isMysteryMaterial(item);
              return (
                <InkListItem
                  key={item.id}
                  layout="col"
                  title={
                    <>
                      {typeInfo.icon} {item.name}
                      <InkBadge tier={item.rank} className="ml-2">
                        {typeInfo.label}
                      </InkBadge>
                      <span className="text-ink-secondary ml-2 text-sm">
                        x{item.quantity}
                      </span>
                      {isMystery && (
                        <InkBadge tone="warning" className="ml-2">
                          待鉴定
                        </InkBadge>
                      )}
                    </>
                  }
                  meta={`属性：${item.element || '无属性'}`}
                  description={item.description || '尚未录入描述'}
                  actions={
                    <InkButton
                      variant="primary"
                      onClick={() => void handleSingleMaterialRecycle(item)}
                      disabled={isProcessing || bulkLoading || isMystery}
                      pending={pendingItemId === item.id}
                      pendingLabel="鉴定中……"
                    >
                      {isMystery ? '待鉴定' : isLow ? '回收' : '鉴定回收'}
                    </InkButton>
                  }
                />
              );
            })}
          </InkList>
        ) : isArtifactTab ? (
          <InkList>
            {artifacts.map((item) => {
              const quality = item.quality || '凡品';
              const isLow = QUALITY_ORDER[quality] <= QUALITY_ORDER['玄品'];
              const isEquipped = Boolean(item.id && equippedIds.has(item.id));
              return (
                <ArtifactListCard
                  key={item.id}
                  artifact={item}
                  equipped={isEquipped}
                  actions={
                    <InkButton
                      variant="primary"
                      onClick={() => void handleSingleArtifactRecycle(item)}
                      disabled={isProcessing || bulkLoading || isEquipped}
                      pending={pendingItemId === item.id}
                      pendingLabel="鉴评中……"
                    >
                      {isEquipped ? '不可回收' : isLow ? '回收' : '鉴定回收'}
                    </InkButton>
                  }
                />
              );
            })}
          </InkList>
        ) : (
          <InkList>
            {consumableItems.map((item) => (
              <ConsumableListCard
                key={item.id}
                consumable={item}
                contextMeta={
                  <span className="text-ink-secondary text-xs">
                    可用 x{item.quantity} · 评分 {item.score || '—'}
                  </span>
                }
                actions={
                  <div className="flex items-start justify-end gap-2">
                    <div className="flex items-start gap-1">
                      <div className="w-24">
                        <InkInput
                          type="number"
                          min={1}
                          max={Math.min(
                            item.quantity,
                            MAX_PLAYER_ITEM_QUANTITY,
                          )}
                          size="sm"
                          value={consumableQuantities[item.id!] || '1'}
                          onChange={(value) =>
                            setConsumableQuantities((current) => ({
                              ...current,
                              [item.id!]: value,
                            }))
                          }
                          hint={`最多 ${Math.min(
                            item.quantity,
                            MAX_PLAYER_ITEM_QUANTITY,
                          )}`}
                          disabled={isProcessing || bulkLoading}
                        />
                      </div>
                      <InkButton
                        type="button"
                        variant="secondary"
                        onClick={() =>
                          setConsumableQuantities((current) => ({
                            ...current,
                            [item.id!]: String(
                              Math.min(
                                item.quantity,
                                MAX_PLAYER_ITEM_QUANTITY,
                              ),
                            ),
                          }))
                        }
                        disabled={isProcessing || bulkLoading}
                      >
                        全部
                      </InkButton>
                    </div>
                    <InkButton
                      variant="primary"
                      onClick={() => void handleSingleConsumableRecycle(item)}
                      disabled={isProcessing || bulkLoading}
                      pending={pendingItemId === item.id}
                      pendingLabel="估价中……"
                    >
                      回收
                    </InkButton>
                  </div>
                }
              />
            ))}
          </InkList>
        )}

        {pagination.totalPages > 1 && (
          <div className="mt-4 flex items-center justify-center gap-4">
            <InkButton
              disabled={pagination.page <= 1 || isLoading || isRefreshing}
              onClick={() =>
                void (isMaterialTab
                  ? goPrevMaterialPage()
                  : isArtifactTab
                    ? goPrevArtifactPage()
                    : goPrevConsumablePage())
              }
            >
              上一页
            </InkButton>
            <span className="text-ink-secondary text-sm">
              {pagination.page} / {pagination.totalPages}
            </span>
            <InkButton
              disabled={
                pagination.page >= pagination.totalPages ||
                isLoading ||
                isRefreshing
              }
              onClick={() =>
                void (isMaterialTab
                  ? goNextMaterialPage()
                  : isArtifactTab
                    ? goNextArtifactPage()
                    : goNextConsumablePage())
              }
            >
              下一页
            </InkButton>
          </div>
        )}
      </div>

      <InkDialog dialog={dialogState} onClose={closeDialog} />
    </GameSceneFrame>
  );
}
