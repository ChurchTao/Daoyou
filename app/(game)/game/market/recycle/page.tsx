'use client';

import { InkPageShell, InkSection } from '@/components/layout';
import {
  InkActionGroup,
  InkBadge,
  InkButton,
  InkDialog,
  InkList,
  InkListItem,
  InkNotice,
  InkTabs,
} from '@/components/ui';
import { TypewriterText } from '@/components/ui/TypewriterText';
import { useCultivator } from '@/lib/contexts/CultivatorContext';
import { usePaginatedInventoryArtifacts } from '@/lib/hooks/usePaginatedInventoryArtifacts';
import { usePaginatedInventoryMaterials } from '@/lib/hooks/usePaginatedInventoryMaterials';
import { QUALITY_ORDER } from '@/types/constants';
import type { Artifact, Material } from '@/types/cultivator';
import {
  getEquipmentSlotInfo,
  getMaterialTypeInfo,
} from '@/types/dictionaries';
import type {
  HighTierAppraisal,
  SellConfirmResponse,
  SellItemType,
  SellPreviewResponse,
} from '@/types/market';
import { usePathname } from 'next/navigation';
import { useCallback, useMemo, useState, type ReactNode } from 'react';

interface SellApiError {
  error?: string;
}

interface InventoryMaterialsApiPayload {
  success: boolean;
  data?: {
    items?: Material[];
    pagination?: {
      hasMore: boolean;
    };
  };
  error?: string;
}

interface InventoryArtifactsApiPayload {
  success: boolean;
  data?: {
    items?: Artifact[];
    pagination?: {
      hasMore: boolean;
    };
  };
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

type RecycleTab = 'materials' | 'artifacts';

async function requestSellPreview(
  itemType: SellItemType,
  itemIds: string[],
): Promise<SellPreviewResponse> {
  const response = await fetch('/api/market/sell', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phase: 'preview',
      itemType,
      itemIds,
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
): Promise<SellConfirmResponse> {
  const response = await fetch('/api/market/sell', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phase: 'confirm',
      sessionId,
    }),
  });
  const payload = (await response.json()) as SellConfirmResponse & SellApiError;
  if (!response.ok || !payload.success) {
    throw new Error(payload.error || '回收确认失败');
  }
  return payload;
}

async function fetchAllLowTierMaterialIds(): Promise<string[]> {
  const ids: string[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const params = new URLSearchParams({
      type: 'materials',
      page: String(page),
      pageSize: '100',
      materialRanks: '凡品,灵品,玄品',
      materialSortBy: 'createdAt',
      materialSortOrder: 'desc',
    });
    const response = await fetch(
      `/api/cultivator/inventory?${params.toString()}`,
    );
    const payload = (await response.json()) as InventoryMaterialsApiPayload;
    if (!response.ok || !payload.success) {
      throw new Error(payload.error || '检索可回收材料失败');
    }
    const items = payload.data?.items || [];
    for (const item of items) {
      if (item.id) ids.push(item.id);
    }
    hasMore = Boolean(payload.data?.pagination?.hasMore);
    page += 1;
  }

  return ids;
}

async function fetchAllLowTierArtifactIds(
  equippedIds: Set<string>,
): Promise<string[]> {
  const ids: string[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const params = new URLSearchParams({
      type: 'artifacts',
      page: String(page),
      pageSize: '100',
    });
    const response = await fetch(
      `/api/cultivator/inventory?${params.toString()}`,
    );
    const payload = (await response.json()) as InventoryArtifactsApiPayload;
    if (!response.ok || !payload.success) {
      throw new Error(payload.error || '检索可回收法宝失败');
    }
    const items = payload.data?.items || [];
    for (const item of items) {
      if (!item.id || equippedIds.has(item.id)) continue;
      const quality = item.quality || '凡品';
      if (QUALITY_ORDER[quality] <= QUALITY_ORDER['玄品']) {
        ids.push(item.id);
      }
    }
    hasMore = Boolean(payload.data?.pagination?.hasMore);
    page += 1;
  }

  return ids;
}

export default function MarketRecyclePage() {
  const pathname = usePathname();
  const { cultivator, equipped, refresh } = useCultivator();
  const [activeTab, setActiveTab] = useState<RecycleTab>('materials');
  const [dialog, setDialog] = useState<RecycleDialogState | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [pendingItemId, setPendingItemId] = useState<string | null>(null);

  const equippedIds = useMemo(
    () =>
      new Set<string>(
        [equipped?.weapon, equipped?.armor, equipped?.accessory].filter(
          Boolean,
        ) as string[],
      ),
    [equipped?.accessory, equipped?.armor, equipped?.weapon],
  );

  const {
    materials,
    pagination: materialPagination,
    isLoading: materialLoading,
    isRefreshing: materialRefreshing,
    isInitialized: materialInitialized,
    error: materialError,
    refreshPage: refreshMaterialPage,
    goPrevPage: goPrevMaterialPage,
    goNextPage: goNextMaterialPage,
  } = usePaginatedInventoryMaterials({
    cultivatorId: cultivator?.id,
    pageSize: 20,
    materialSortBy: 'createdAt',
    materialSortOrder: 'desc',
  });

  const {
    artifacts,
    pagination: artifactPagination,
    isLoading: artifactLoading,
    isRefreshing: artifactRefreshing,
    isInitialized: artifactInitialized,
    error: artifactError,
    refreshPage: refreshArtifactPage,
    goPrevPage: goPrevArtifactPage,
    goNextPage: goNextArtifactPage,
  } = usePaginatedInventoryArtifacts({
    cultivatorId: cultivator?.id,
    pageSize: 20,
  });

  const closeDialog = useCallback(() => {
    if (isProcessing) return;
    setDialog(null);
  }, [isProcessing]);

  const refreshCurrentTab = useCallback(async () => {
    if (activeTab === 'materials') {
      await refreshMaterialPage();
      return;
    }
    await refreshArtifactPage();
  }, [activeTab, refreshArtifactPage, refreshMaterialPage]);

  const handleSellConfirm = useCallback(
    async (preview: SellPreviewResponse) => {
      try {
        setIsProcessing(true);
        setDialog((prev) => ({
          ...prev!,
          loading: true,
        }));
        const result = await requestSellConfirm(preview.sessionId);
        setDialog({
          id: 'sell-result',
          title: '回收完成',
          content: (
            <p className="py-3 text-center leading-7">
              坊市已入账
              <span className="mx-1 font-bold text-amber-700">
                {result.gainedSpiritStones}
              </span>
              灵石。
            </p>
          ),
          confirmLabel: '知晓',
          cancelLabel: '关闭',
        });
        await refresh();
        await refreshCurrentTab();
      } catch (err) {
        setDialog({
          id: 'sell-error',
          title: '回收失败',
          content: (
            <p className="py-3 text-center text-red-700">
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
    [refresh, refreshCurrentTab],
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

      setDialog({
        id: `sell-preview-${preview.sessionId}`,
        title: isHighTier
          ? isArtifact
            ? '法宝鉴评'
            : '鉴宝师评估'
          : isArtifact
            ? '法宝回收确认'
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
                  <span className="ml-1 font-bold text-amber-700">
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
                {isArtifact ? '件法宝' : '份废料'}，预计获得{' '}
                <span className="font-bold">{preview.totalSpiritStones}</span>{' '}
                灵石。
              </p>
            )}
          </div>
        ),
        confirmLabel: '确认回收',
        cancelLabel: '再想想',
        loadingLabel: '交易中...',
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
            <p className="py-3 text-center text-red-700">
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
            <p className="py-3 text-center text-red-700">
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
            <p className="py-3 text-center text-red-700">
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

  const handleBulkRecycle = useCallback(async () => {
    setBulkLoading(true);
    try {
      if (activeTab === 'materials') {
        const ids = await fetchAllLowTierMaterialIds();
        if (ids.length === 0) {
          setBulkLoading(false);
          setDialog({
            id: 'empty-low-tier-materials',
            title: '无可清理废料',
            content: (
              <p className="py-3 text-center">当前未检索到凡/灵/玄品材料。</p>
            ),
            confirmLabel: '知晓',
            cancelLabel: '关闭',
          });
          return;
        }
        const preview = await requestSellPreview('material', ids);
        setBulkLoading(false);
        openPreviewDialog(preview);
        return;
      }

      const ids = await fetchAllLowTierArtifactIds(equippedIds);
      if (ids.length === 0) {
        setBulkLoading(false);
        setDialog({
          id: 'empty-low-tier-artifacts',
          title: '无可清理法宝',
          content: (
            <p className="py-3 text-center">
              当前未检索到可回收的凡/灵/玄品法宝。
            </p>
          ),
          confirmLabel: '知晓',
          cancelLabel: '关闭',
        });
        return;
      }
      const preview = await requestSellPreview('artifact', ids);
      setBulkLoading(false);
      openPreviewDialog(preview);
    } catch (err) {
      setDialog({
        id: 'bulk-preview-error',
        title: '预览失败',
        content: (
          <p className="py-3 text-center text-red-700">
            {err instanceof Error ? err.message : '预览失败'}
          </p>
        ),
        confirmLabel: '知晓',
        cancelLabel: '关闭',
      });
      setBulkLoading(false);
    }
  }, [activeTab, equippedIds, openPreviewDialog]);

  const dialogState = dialog
    ? {
        ...dialog,
        onCancel: closeDialog,
      }
    : null;

  const subtitle = cultivator ? `灵石余额：${cultivator.spirit_stones}` : '';

  const isMaterialTab = activeTab === 'materials';
  const isLoading = isMaterialTab ? materialLoading : artifactLoading;
  const isRefreshing = isMaterialTab ? materialRefreshing : artifactRefreshing;
  const isInitialized = isMaterialTab ? materialInitialized : artifactInitialized;
  const listError = isMaterialTab ? materialError : artifactError;
  const pagination = isMaterialTab ? materialPagination : artifactPagination;

  const hasItems = isMaterialTab
    ? isInitialized && materials.length > 0
    : isInitialized && artifacts.length > 0;

  return (
    <InkPageShell
      title="【坊市鉴宝司】"
      subtitle={subtitle}
      backHref="/game"
      currentPath={pathname}
      footer={
        <InkActionGroup align="between">
          <InkButton href="/game">返回主界</InkButton>
          <InkButton href="/game/map?intent=market">前往坊市</InkButton>
          <InkButton href="/game/inventory" variant="secondary">
            查看储物袋
          </InkButton>
        </InkActionGroup>
      }
    >
      <InkTabs
        className="mb-4"
        activeValue={activeTab}
        onChange={(value) => setActiveTab(value as RecycleTab)}
        items={[
          { label: '材料回收', value: 'materials' },
          { label: '法宝回收', value: 'artifacts' },
        ]}
      />

      <InkSection title="鉴宝师规矩">
        {isMaterialTab ? (
          <p className="text-ink-secondary text-sm leading-7">
            真品及以上需先行鉴定再成交；凡、灵、玄品可批量清理。鉴定结果当场生效，
            过时需重新鉴定。
          </p>
        ) : (
          <p className="text-ink-secondary text-sm leading-7">
            真品及以上法宝仅支持单件鉴评回收；凡、灵、玄品可批量清理。
            已装备法宝不可回收，需先卸下。
          </p>
        )}

        <div className="mt-3 flex gap-2">
          <InkButton
            variant="primary"
            onClick={() => void handleBulkRecycle()}
            disabled={isLoading || isRefreshing || isProcessing || bulkLoading}
          >
            {bulkLoading
              ? '清点中…'
              : isMaterialTab
                ? '一键出售低阶材料'
                : '一键出售低阶法宝'}
          </InkButton>
          <InkButton
            variant="secondary"
            onClick={() => void refreshCurrentTab()}
            disabled={isLoading || isRefreshing}
          >
            {isRefreshing
              ? '刷新中…'
              : isMaterialTab
                ? '刷新材料'
                : '刷新法宝'}
          </InkButton>
        </div>
      </InkSection>

      <InkSection title={isMaterialTab ? '待鉴定材料' : '待鉴定法宝'}>
        {!isInitialized && isLoading ? (
          <InkNotice>
            {isMaterialTab
              ? '鉴宝师正在清点货架，请稍候……'
              : '鉴宝师正在核对法宝名录，请稍候……'}
          </InkNotice>
        ) : listError ? (
          <InkNotice>{listError}</InkNotice>
        ) : !hasItems ? (
          <InkNotice>
            {isMaterialTab
              ? '储物袋暂无材料，先去历练再来坊市吧。'
              : '储物袋暂无法宝，先去炼器或探险再来坊市吧。'}
          </InkNotice>
        ) : isMaterialTab ? (
          <InkList>
            {materials.map((item) => {
              const typeInfo = getMaterialTypeInfo(item.type);
              const isLow = QUALITY_ORDER[item.rank] <= QUALITY_ORDER['玄品'];
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
                    </>
                  }
                  meta={`属性：${item.element || '无属性'}`}
                  description={item.description || '尚未录入描述'}
                  actions={
                    <InkButton
                      variant="primary"
                      onClick={() => void handleSingleMaterialRecycle(item)}
                      disabled={
                        isProcessing ||
                        bulkLoading ||
                        pendingItemId === item.id
                      }
                    >
                      {pendingItemId === item.id
                        ? '鉴定中…'
                        : isLow
                          ? '回收'
                          : '鉴定回收'}
                    </InkButton>
                  }
                />
              );
            })}
          </InkList>
        ) : (
          <InkList>
            {artifacts.map((item) => {
              const quality = item.quality || '凡品';
              const isLow = QUALITY_ORDER[quality] <= QUALITY_ORDER['玄品'];
              const isEquipped = Boolean(item.id && equippedIds.has(item.id));
              const slotInfo = getEquipmentSlotInfo(item.slot);
              return (
                <InkListItem
                  key={item.id}
                  layout="col"
                  title={
                    <>
                      {slotInfo.icon} {item.name}
                      <InkBadge tier={quality} className="ml-2">
                        {slotInfo.label}
                      </InkBadge>
                      {isEquipped && (
                        <InkBadge tone="default" className="ml-2">
                          已装备
                        </InkBadge>
                      )}
                    </>
                  }
                  meta={`属性：${item.element} · 评分：${item.score || 0}`}
                  description={item.description || '尚未录入描述'}
                  actions={
                    <InkButton
                      variant="primary"
                      onClick={() => void handleSingleArtifactRecycle(item)}
                      disabled={
                        isProcessing ||
                        bulkLoading ||
                        isEquipped ||
                        pendingItemId === item.id
                      }
                    >
                      {pendingItemId === item.id
                        ? '鉴评中…'
                        : isEquipped
                          ? '已装备'
                          : isLow
                            ? '回收'
                            : '鉴定回收'}
                    </InkButton>
                  }
                />
              );
            })}
          </InkList>
        )}

        {pagination.totalPages > 1 && (
          <div className="mt-4 flex items-center justify-center gap-4">
            <InkButton
              disabled={pagination.page <= 1 || isLoading || isRefreshing}
              onClick={() =>
                void (isMaterialTab ? goPrevMaterialPage() : goPrevArtifactPage())
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
                void (isMaterialTab ? goNextMaterialPage() : goNextArtifactPage())
              }
            >
              下一页
            </InkButton>
          </div>
        )}
      </InkSection>

      <InkDialog dialog={dialogState} onClose={closeDialog} />
    </InkPageShell>
  );
}
