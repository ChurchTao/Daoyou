import { ListItemModal } from '@app/components/auction/ListItemModal';
import {
  ConsumableListCard,
} from '@app/components/feature/consumables';
import { ArtifactListCard } from '@app/components/feature/products';
import {
  ItemDetailModal,
  toInventoryItemDetail,
  type ItemDetailPayload,
} from '@app/components/feature/items';
import {
  GameSceneAsideSection,
  GameSceneFrame,
  GameSceneTabs,
} from '@app/components/game-shell';
import { useInkUI } from '@app/components/providers/InkUIProvider';
import {
  InkBadge,
  InkButton,
  InkDialog,
  InkDialogState,
  InkInput,
  InkList,
  InkNotice,
  InkSelect,
} from '@app/components/ui';
import { ItemCard } from '@app/components/ui/ItemCard';
import { usePlayerStateView } from '@app/lib/player-state/selectors';
import { usePlayerStateActions } from '@app/lib/player-state/store';
import {
  TEMP_DISABLED_MESSAGES,
  temporaryRestrictions,
} from '@shared/config/temporaryRestrictions';
import {
  CONSUMABLE_TYPE_DISPLAY_MAP,
  getEquipmentSlotInfo,
  getGameConceptInfo,
  getMaterialTypeInfo,
} from '@shared/lib/gameConceptDisplay';
import {
  CONSUMABLE_TYPE_VALUES,
  EQUIPMENT_SLOT_VALUES,
  MATERIAL_TYPE_VALUES,
  QUALITY_VALUES,
} from '@shared/types/constants';
import type { Artifact, Consumable, Material } from '@shared/types/cultivator';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react';
import { useSearchParams } from 'react-router';

type AuctionItemType = 'material' | 'artifact' | 'consumable';
type AuctionTypeFilter = AuctionItemType | 'all';
type AuctionScope = 'browse' | 'my';
type AuctionSearchMode = 'itemName' | 'sellerName';
type AuctionSortBy = 'latest' | 'price_asc' | 'price_desc';

type AuctionListing = {
  id: string;
  sellerId: string;
  sellerName: string;
  itemType: AuctionItemType;
  itemId: string;
  itemName: string;
  itemQuality: string;
  itemCategory: string;
  itemSnapshot: Material | Artifact | Consumable;
  price: number;
  visibility?: 'public' | 'private';
  targetCultivatorId?: string | null;
  targetCultivatorName?: string | null;
  status: string;
  createdAt: string;
  expiresAt: string;
  soldAt?: string;
};

type AuctionPagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
};

type AuctionListPayload = {
  listings?: AuctionListing[];
  pagination?: AuctionPagination;
  error?: string;
};

const PAGE_SIZE = 10;
const SPIRIT_STONES_INFO = getGameConceptInfo('spirit_stones');
const HIGH_VALUE_PURCHASE_CONFIRM_THRESHOLD = 100_000;

const TYPE_TABS: Array<{ label: string; value: AuctionTypeFilter }> = [
  { label: '全部', value: 'all' },
  { label: '材料', value: 'material' },
  { label: '法宝', value: 'artifact' },
  { label: '丹药', value: 'consumable' },
];

const VIEW_TABS: Array<{ label: string; value: AuctionScope }> = [
  { label: '浏览拍卖', value: 'browse' },
  { label: '我的寄售', value: 'my' },
];

const SEARCH_MODE_LABELS: Record<AuctionSearchMode, string> = {
  itemName: '物品名',
  sellerName: '卖家名',
};

function normalizeType(value: string | null): AuctionTypeFilter {
  return value === 'material' || value === 'artifact' || value === 'consumable'
    ? value
    : 'all';
}

function normalizeScope(value: string | null): AuctionScope {
  return value === 'my' ? 'my' : 'browse';
}

function normalizeSearchMode(value: string | null): AuctionSearchMode {
  return value === 'sellerName' ? 'sellerName' : 'itemName';
}

function normalizeSortBy(value: string | null): AuctionSortBy {
  return value === 'price_asc' || value === 'price_desc' ? value : 'latest';
}

function normalizePage(value: string | null): number {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

function getCategoryOptions(itemType: AuctionTypeFilter) {
  if (itemType === 'material') {
    return MATERIAL_TYPE_VALUES.map((value) => ({
      value,
      label: getMaterialTypeInfo(value).label,
    }));
  }

  if (itemType === 'artifact') {
    return EQUIPMENT_SLOT_VALUES.map((value) => ({
      value,
      label: getEquipmentSlotInfo(value).label,
    }));
  }

  if (itemType === 'consumable') {
    return CONSUMABLE_TYPE_VALUES.map((value) => ({
      value,
      label: CONSUMABLE_TYPE_DISPLAY_MAP[value].label,
    }));
  }

  return [];
}

function getQualityLabel(value: string | null) {
  return value && QUALITY_VALUES.includes(value as (typeof QUALITY_VALUES)[number])
    ? value
    : '全部品级';
}

export default function AuctionPage() {
  const { cultivator } = usePlayerStateView();
  const { mutate } = usePlayerStateActions();
  const { pushToast } = useInkUI();
  const [searchParams, setSearchParams] = useSearchParams();
  const [browseListings, setBrowseListings] = useState<AuctionListing[]>([]);
  const [myListings, setMyListings] = useState<AuctionListing[]>([]);
  const [pagination, setPagination] = useState<Record<AuctionScope, AuctionPagination>>({
    browse: { page: 1, limit: PAGE_SIZE, total: 0, totalPages: 1, hasMore: false },
    my: { page: 1, limit: PAGE_SIZE, total: 0, totalPages: 1, hasMore: false },
  });
  const [isLoadingBrowse, setIsLoadingBrowse] = useState(true);
  const [isLoadingMy, setIsLoadingMy] = useState(false);
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [showListModal, setShowListModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ItemDetailPayload | null>(null);
  const [buyConfirmDialog, setBuyConfirmDialog] =
    useState<InkDialogState | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const activeTab = normalizeScope(searchParams.get('tab'));
  const activeType = normalizeType(searchParams.get('itemType'));
  const categoryOptions = useMemo(() => getCategoryOptions(activeType), [activeType]);
  const itemCategory = searchParams.get('itemCategory') || 'all';
  const itemQuality = searchParams.get('itemQuality') || 'all';
  const sortBy = normalizeSortBy(searchParams.get('sortBy'));
  const page = normalizePage(searchParams.get('page'));
  const searchMode = normalizeSearchMode(searchParams.get('searchMode'));
  const currentSearchValue = searchParams.get(searchMode) || '';
  const searchDraftKey = `${searchMode}:${currentSearchValue}`;
  const [searchDraftState, setSearchDraftState] = useState({
    key: searchDraftKey,
    value: currentSearchValue,
  });
  const searchDraft =
    searchDraftState.key === searchDraftKey
      ? searchDraftState.value
      : currentSearchValue;

  const updateQuery = useCallback(
    (
      updates: Record<string, string | null | undefined>,
      options: { resetPage?: boolean } = { resetPage: true },
    ) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        for (const [key, value] of Object.entries(updates)) {
          if (!value || value === 'all' || (key === 'page' && value === '1')) {
            next.delete(key);
          } else {
            next.set(key, value);
          }
        }
        if (options.resetPage) {
          next.delete('page');
        }
        return next;
      });
    },
    [setSearchParams],
  );

  const buildListUrl = useCallback((scope: AuctionScope, requestedPage: number) => {
    const params = new URLSearchParams({
      scope: scope === 'my' ? 'mine' : 'all',
      page: String(requestedPage),
      limit: String(PAGE_SIZE),
      sortBy,
    });

    if (activeType !== 'all') {
      params.set('itemType', activeType);
    }
    if (activeType !== 'all' && itemCategory !== 'all') {
      params.set('itemCategory', itemCategory);
    }
    if (itemQuality !== 'all') {
      params.set('itemQuality', itemQuality);
    }
    const exactSearch = currentSearchValue.trim();
    if (exactSearch) {
      params.set(searchMode, exactSearch);
    }

    return `/api/auction/listings?${params.toString()}`;
  }, [
    activeType,
    currentSearchValue,
    itemCategory,
    itemQuality,
    searchMode,
    sortBy,
  ]);

  const fetchListings = useCallback(
    async (scope: AuctionScope = activeTab, requestedPage: number = page) => {
      if (scope === 'browse') {
        setIsLoadingBrowse(true);
      } else {
        setIsLoadingMy(true);
      }

      try {
        const res = await fetch(buildListUrl(scope, requestedPage));
        const data = (await res.json()) as AuctionListPayload;
        if (!res.ok) {
          throw new Error(data.error || '获取拍卖列表失败');
        }

        const nextListings = data.listings || [];
        const nextPagination =
          data.pagination || {
            page: requestedPage,
            limit: PAGE_SIZE,
            total: nextListings.length,
            totalPages: 1,
            hasMore: false,
          };

        if (scope === 'browse') {
          setBrowseListings(nextListings);
        } else {
          setMyListings(nextListings);
        }
        setPagination((prev) => ({ ...prev, [scope]: nextPagination }));
      } catch (error) {
        pushToast({
          message: error instanceof Error ? error.message : '获取拍卖列表失败',
          tone: 'warning',
        });
      } finally {
        if (scope === 'browse') {
          setIsLoadingBrowse(false);
        } else {
          setIsLoadingMy(false);
        }
      }
    },
    [activeTab, buildListUrl, page, pushToast],
  );

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (activeTab === 'browse') {
        setIsLoadingBrowse(true);
      } else {
        setIsLoadingMy(true);
      }

      try {
        const res = await fetch(buildListUrl(activeTab, page));
        const data = (await res.json()) as AuctionListPayload;
        if (cancelled) return;
        if (!res.ok) {
          throw new Error(data.error || '获取拍卖列表失败');
        }

        const nextListings = data.listings || [];
        const nextPagination =
          data.pagination || {
            page,
            limit: PAGE_SIZE,
            total: nextListings.length,
            totalPages: 1,
            hasMore: false,
          };

        if (activeTab === 'browse') {
          setBrowseListings(nextListings);
        } else {
          setMyListings(nextListings);
        }
        setPagination((prev) => ({ ...prev, [activeTab]: nextPagination }));
      } catch (error) {
        if (!cancelled) {
          pushToast({
            message: error instanceof Error ? error.message : '获取拍卖列表失败',
            tone: 'warning',
          });
        }
      } finally {
        if (!cancelled) {
          if (activeTab === 'browse') {
            setIsLoadingBrowse(false);
          } else {
            setIsLoadingMy(false);
          }
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [activeTab, buildListUrl, page, pushToast]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  const handleApplySearch = (event: FormEvent) => {
    event.preventDefault();
    updateQuery({
      itemName: null,
      sellerName: null,
      searchMode,
      [searchMode]: searchDraft.trim() || null,
    });
  };

  const handleClearFilters = () => {
    setSearchDraftState({ key: 'itemName:', value: '' });
    updateQuery({
      itemType: null,
      itemCategory: null,
      itemQuality: null,
      sortBy: null,
      searchMode: null,
      itemName: null,
      sellerName: null,
      page: null,
    });
  };

  const executeBuy = async (listing: AuctionListing) => {
    setBuyingId(listing.id);
    try {
      const result = await mutate<{ message: string }>(
        fetch('/api/auction/buy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ listingId: listing.id }),
        }),
      );
      pushToast({ message: result.message, tone: 'success' });
      await fetchListings('browse', pagination.browse.page);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : '购买失败';
      pushToast({ message, tone: 'danger' });
    } finally {
      setBuyingId(null);
    }
  };

  const handleBuy = async (listing: AuctionListing) => {
    if (!cultivator) {
      pushToast({ message: '请先登录', tone: 'warning' });
      return;
    }
    if (cultivator.spirit_stones < listing.price) {
      pushToast({ message: '囊中羞涩，灵石不足', tone: 'warning' });
      return;
    }
    if (listing.sellerId === cultivator.id) {
      pushToast({ message: '无法购买自己寄售的物品', tone: 'warning' });
      return;
    }
    if (listing.price > HIGH_VALUE_PURCHASE_CONFIRM_THRESHOLD) {
      setBuyConfirmDialog({
        id: `auction-buy-${listing.id}`,
        title: '高额交易确认',
        content: (
          <div className="space-y-2 text-sm leading-7">
            <p>确定购入「{listing.itemName}」吗？</p>
            <p className="text-gold font-bold">
              将消耗：{SPIRIT_STONES_INFO.icon} {listing.price}{' '}
              {SPIRIT_STONES_INFO.label}
            </p>
          </div>
        ),
        confirmLabel: '确认购入',
        cancelLabel: '再看看',
        onConfirm: async () => {
          await executeBuy(listing);
        },
      });
      return;
    }

    await executeBuy(listing);
  };

  const handleCancel = async (listing: AuctionListing) => {
    if (!cultivator) return;

    setCancellingId(listing.id);
    try {
      const result = await mutate<{ message: string }>(
        fetch(`/api/auction/${listing.id}`, {
          method: 'DELETE',
        }),
      );
      pushToast({ message: result.message, tone: 'success' });
      await fetchListings('my', pagination.my.page);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : '下架失败';
      pushToast({ message, tone: 'danger' });
    } finally {
      setCancellingId(null);
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const diff = date.getTime() - now;
    if (diff <= 0) return '已过期';
    const hours = Math.floor(diff / 1000 / 60 / 60);
    const minutes = Math.floor((diff / 1000 / 60) % 60);
    return `${hours}时${minutes}分`;
  };

  const getItemDisplayProps = (listing: AuctionListing) => {
    const item = listing.itemSnapshot;
    const baseProps = {
      name: item.name,
      description: item.description,
    };

    switch (listing.itemType) {
      case 'material': {
        const material = item as Material;
        const typeInfo = getMaterialTypeInfo(material.type);
        return {
          ...baseProps,
          icon: typeInfo.icon,
          quality: material.rank,
          badgeExtra: (
            <>
              <InkBadge tone="default">{typeInfo.label}</InkBadge>
              {material.element && (
                <InkBadge tone="default">{material.element}</InkBadge>
              )}
            </>
          ),
        };
      }
      case 'artifact': {
        const artifact = item as Artifact;
        const slotInfo = getEquipmentSlotInfo(artifact.slot);
        return {
          ...baseProps,
          icon: slotInfo.icon,
          quality: artifact.quality,
          badgeExtra: (
            <>
              <InkBadge tone="default">{artifact.element}</InkBadge>
              <InkBadge tone="default">{slotInfo.label}</InkBadge>
            </>
          ),
        };
      }
      case 'consumable':
        return baseProps;
    }
  };

  const renderListing = (listing: AuctionListing, isMyListing: boolean) => {
    const displayProps = getItemDisplayProps(listing);
    const timeLeft = formatTime(listing.expiresAt);
    const listedQuantity =
      'quantity' in listing.itemSnapshot ? listing.itemSnapshot.quantity : 1;
    const listingMeta = (
      <div className="text-ink-secondary mt-1 space-y-2 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>
              卖家: {listing.sellerName}
              {listing.sellerId === cultivator?.id ? ' (我)' : ''}
            </span>
            <span>数量: x{listedQuantity}</span>
            {listing.visibility === 'private' && (
              <span className="text-crimson">
                专属：
                {listing.targetCultivatorId === cultivator?.id
                  ? '指定给我'
                  : listing.targetCultivatorName || '指定道友'}
              </span>
            )}
            <span className="text-gold text-sm font-semibold">
              {SPIRIT_STONES_INFO.icon} {listing.price}{' '}
              {SPIRIT_STONES_INFO.label}
            </span>
          </div>
          <span className="whitespace-nowrap">剩余: {timeLeft}</span>
        </div>
        {isMyListing && (
          <div className="flex justify-end">
            <span className="text-ink-secondary text-[0.75rem] opacity-75">
              预计到手: {Math.floor(listing.price * 0.9)} 灵石
            </span>
          </div>
        )}
      </div>
    );
    const actions = (
      <div className="flex w-full justify-end gap-2">
        <InkButton
          variant="secondary"
          onClick={() =>
            setSelectedItem(
              toInventoryItemDetail(listing.itemType, listing.itemSnapshot),
            )
          }
        >
          详情
        </InkButton>
        {isMyListing ? (
          <InkButton
            onClick={() => handleCancel(listing)}
            disabled={!!cancellingId}
            variant="secondary"
          >
            {cancellingId === listing.id ? '处理中' : '下架'}
          </InkButton>
        ) : (
          <InkButton
            onClick={() => handleBuy(listing)}
            disabled={!!buyingId || listing.sellerId === cultivator?.id}
            variant="primary"
          >
            {buyingId === listing.id
              ? '交易中'
              : listing.sellerId === cultivator?.id
                ? '自己的'
                : '购买'}
          </InkButton>
        )}
      </div>
    );

    if (listing.itemType === 'consumable') {
      return (
        <ConsumableListCard
          key={listing.id}
          consumable={listing.itemSnapshot as Consumable}
          realm={cultivator?.realm}
          condition={cultivator?.condition}
          contextMeta={listingMeta}
          actions={actions}
        />
      );
    }

    if (listing.itemType === 'artifact') {
      return (
        <ArtifactListCard
          key={listing.id}
          artifact={listing.itemSnapshot as Artifact}
          contextMeta={listingMeta}
          actions={actions}
        />
      );
    }

    return (
      <ItemCard
        key={listing.id}
        layout="col"
        {...displayProps}
        meta={listingMeta}
        actions={actions}
      />
    );
  };

  const renderPagination = (type: AuctionScope) => {
    const pag = pagination[type];
    if (pag.totalPages <= 1) return null;

    return (
      <div className="mt-4 flex items-center justify-center gap-4">
        <InkButton
          variant="secondary"
          disabled={pag.page <= 1}
          onClick={() => updateQuery({ page: String(pag.page - 1) }, { resetPage: false })}
        >
          上一页
        </InkButton>
        <span className="text-ink-secondary text-sm">
          {pag.page} / {pag.totalPages}
        </span>
        <InkButton
          variant="secondary"
          disabled={pag.page >= pag.totalPages}
          onClick={() => updateQuery({ page: String(pag.page + 1) }, { resetPage: false })}
        >
          下一页
        </InkButton>
      </div>
    );
  };

  const filterSummary = [
    TYPE_TABS.find((item) => item.value === activeType)?.label || '全部',
    activeType !== 'all' && itemCategory !== 'all'
      ? categoryOptions.find((item) => item.value === itemCategory)?.label
      : null,
    getQualityLabel(itemQuality),
    currentSearchValue.trim()
      ? `${SEARCH_MODE_LABELS[searchMode]}=${currentSearchValue.trim()}`
      : null,
  ].filter(Boolean);

  const activeListings = activeTab === 'browse' ? browseListings : myListings;
  const isLoading = activeTab === 'browse' ? isLoadingBrowse : isLoadingMy;
  const filterSummaryText = filterSummary.join(' / ');

  const renderFilterControls = (compact = false) => (
    <div className={compact ? 'space-y-3' : 'space-y-4'}>
      <div
        className={
          compact
            ? 'grid grid-cols-2 gap-2'
            : 'grid gap-3 md:grid-cols-[1fr_1fr_1fr]'
        }
      >
        {activeType !== 'all' && (
          <InkSelect
            label="子类"
            size="sm"
            value={itemCategory}
            onChange={(value) => updateQuery({ itemCategory: value })}
          >
            <option value="all">全部子类</option>
            {categoryOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </InkSelect>
        )}
        <InkSelect
          label="品级"
          size="sm"
          value={itemQuality}
          onChange={(value) => updateQuery({ itemQuality: value })}
        >
          <option value="all">全部品级</option>
          {QUALITY_VALUES.map((quality) => (
            <option key={quality} value={quality}>
              {quality}
            </option>
          ))}
        </InkSelect>
        <InkSelect
          label="排序"
          size="sm"
          value={sortBy}
          onChange={(value) => updateQuery({ sortBy: value })}
        >
          <option value="latest">最新上架</option>
          <option value="price_asc">价格从低到高</option>
          <option value="price_desc">价格从高到低</option>
        </InkSelect>
      </div>

      <form
        onSubmit={handleApplySearch}
        className={
          compact
            ? 'grid grid-cols-2 gap-2'
            : 'grid gap-3 md:grid-cols-[11rem_1fr_auto_auto]'
        }
      >
        <InkSelect
          label="搜索模式"
          size="sm"
          value={searchMode}
          onChange={(value) => {
            updateQuery({
              searchMode: value,
              itemName: null,
              sellerName: null,
            });
          }}
        >
          <option value="itemName">物品名精准匹配</option>
          <option value="sellerName">卖家名精准匹配</option>
        </InkSelect>
        <InkInput
          label="精确值"
          size="sm"
          value={searchDraft}
          onChange={(value) =>
            setSearchDraftState({ key: searchDraftKey, value })
          }
          placeholder={`输入完整${SEARCH_MODE_LABELS[searchMode]}`}
        />
        <div
          className={
            compact
              ? 'col-span-2 flex justify-end gap-3'
              : 'flex items-end'
          }
        >
          <InkButton type="submit" variant="primary" className={compact ? '' : 'w-full'}>
            搜索
          </InkButton>
          {compact && (
            <InkButton
              type="button"
              variant="secondary"
              onClick={handleClearFilters}
            >
              清除
            </InkButton>
          )}
        </div>
        {!compact && (
          <div className="flex items-end">
            <InkButton
              type="button"
              variant="secondary"
              className="w-full"
              onClick={handleClearFilters}
            >
              清除
            </InkButton>
          </div>
        )}
      </form>
    </div>
  );

  return (
    <GameSceneFrame
      variant="workflow"
      title="【拍卖行】"
      description="各路道友寄售珍材法宝，按类检索后再议价成交。"
      aside={
        <>
          <GameSceneAsideSection title="寄售摘要">
            <div className="space-y-2 text-sm leading-7">
              <p>
                {SPIRIT_STONES_INFO.label}余额：
                {cultivator?.spirit_stones ?? 0}
              </p>
              <p>当前页签：{activeTab === 'browse' ? '浏览拍卖' : '我的寄售'}</p>
              <p>当前筛选：{filterSummaryText}</p>
              <p>我的寄售：{pagination.my.total} / 5</p>
            </div>
          </GameSceneAsideSection>
          <GameSceneAsideSection
            title="成交规则"
            className="text-sm leading-7"
            help={{
              title: '拍卖行成交规则',
              content: (
                <div className="space-y-2 text-sm leading-7">
                  <p>自己的货单不可回购；专属交易仅指定道友可见。</p>
                  <p>卖家实际到手为标价九成。</p>
                </div>
              ),
            }}
          />
        </>
      }
    >
      <GameSceneTabs
        items={VIEW_TABS}
        activeValue={activeTab}
        onChange={(value) => updateQuery({ tab: value }, { resetPage: true })}
      />

      <div className="space-y-4">
        <GameSceneTabs
          items={TYPE_TABS}
          activeValue={activeType}
          onChange={(value) =>
            updateQuery({
              itemType: value,
              itemCategory: null,
            })
          }
        />

        <details className="border-ink/20 bg-ink/5 border border-dashed px-2 py-2 md:hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
            <span className="text-crimson font-semibold">筛选 / 搜索</span>
            <span className="text-ink-secondary truncate text-right text-sm">
              {filterSummaryText}
            </span>
          </summary>
          <div className="mt-3">{renderFilterControls(true)}</div>
        </details>

        <div className="hidden md:block">
          {renderFilterControls()}
        </div>

        <div className="flex items-center justify-between gap-3">
          <p className="text-ink-secondary text-sm">
            共 {pagination[activeTab].total} 条货单
          </p>
          {cultivator && activeTab === 'my' ? (
            <InkButton onClick={() => setShowListModal(true)} variant="primary">
              上架物品
            </InkButton>
          ) : null}
        </div>
      </div>

      {temporaryRestrictions.disableConsumableAuctionListing && (
        <InkNotice>{TEMP_DISABLED_MESSAGES.consumableAuctionListing}</InkNotice>
      )}

      {isLoading ? (
        <div className="py-10 text-center">正在获取拍卖列表...</div>
      ) : activeListings.length > 0 ? (
        <>
          <InkList>
            {activeListings.map((listing) =>
              renderListing(listing, activeTab === 'my'),
            )}
          </InkList>
          {renderPagination(activeTab)}
        </>
      ) : (
        <InkNotice>
          {activeTab === 'my'
            ? '当前没有符合条件的寄售记录'
            : '当前没有符合条件的拍卖货单'}
        </InkNotice>
      )}

      {showListModal && (
        <ListItemModal
          onClose={() => setShowListModal(false)}
          onSuccess={() => {
            setShowListModal(false);
            updateQuery({ tab: 'my', page: null });
          }}
          cultivator={cultivator}
        />
      )}

      <ItemDetailModal
        isOpen={!!selectedItem}
        onClose={() => setSelectedItem(null)}
        item={selectedItem}
        viewerRealm={cultivator?.realm}
      />
      <InkDialog
        dialog={buyConfirmDialog}
        onClose={() => setBuyConfirmDialog(null)}
      />
    </GameSceneFrame>
  );
}
