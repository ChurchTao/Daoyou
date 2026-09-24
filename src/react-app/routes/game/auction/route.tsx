import { AuctionListingActions } from '@app/components/auction/AuctionListingActions';
import { AuctionListings } from '@app/components/auction/AuctionListings';
import { ListBeastModal } from '@app/components/auction/ListBeastModal';
import { ListItemModal } from '@app/components/auction/ListItemModal';
import {
  GameLoadingState,
  GameSceneFrame,
  GameSceneTabs,
} from '@app/components/game-shell';
import { GameSceneHelpButton } from '@app/components/game-shell/GameSceneSection';
import { useInkUI } from '@app/components/providers/InkUIProvider';
import {
  InkButton,
  InkDetailDrawer,
  InkDialog,
  type InkDialogState,
  InkInput,
  InkNotice,
  InkSelect,
} from '@app/components/ui';
import { useResourceMutation } from '@app/lib/resources/mutations';
import {
  useCultivatorCurrency,
  useCultivatorIdentity,
} from '@app/lib/resources/player';
import {
  AUCTION_MAX_PURCHASE_QUANTITY,
  AUCTION_MAX_TRANSACTION_TOTAL,
  calculateAuctionSettlement,
} from '@shared/config/auctionConfig';
import { getRealmStageLevel } from '@shared/config/realmProgression';
import {
  AUCTION_ITEM_TYPES,
  AUCTION_TYPE_NAMES,
  type AuctionAssetType,
  type AuctionItemType,
  type AuctionListingView,
} from '@shared/contracts/auction';
import { BEAST_SPECIES } from '@shared/engine/combat-v6/beasts/content';
import { canDeployBeast } from '@shared/engine/combat-v6/beasts/projection';
import { EQUIPMENT_SLOT_NAMES } from '@shared/items/definitions/equipment-blueprints';
import { MATERIAL_TYPE_NAMES } from '@shared/items/definitions/materials';
import { QUALITY_VALUES } from '@shared/types/constants';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';

type ItemTypeFilter = AuctionItemType | 'all';
type ListingsPayload = {
  listings: AuctionListingView[];
  pagination: { page: number; total: number; totalPages: number };
};
const ASSET_TABS = [
  { label: '道具', value: 'item' },
  { label: '灵兽', value: 'beast' },
];
const ITEM_TYPES = AUCTION_ITEM_TYPES.filter((type) => type !== 'beast');
const HIGH_VALUE_PURCHASE_CONFIRM_THRESHOLD = 100_000;

function getCategoryOptions(type: ItemTypeFilter) {
  if (type === 'beast')
    return BEAST_SPECIES.map((s) => ({ value: s.id, label: s.name }));
  const names =
    type === 'material'
      ? MATERIAL_TYPE_NAMES
      : type === 'equipment' || type === 'blueprint'
        ? EQUIPMENT_SLOT_NAMES
        : type === 'consumable'
          ? { pill: '丹药', spirit_fruit: '灵果' }
          : {};
  return Object.entries(names).map(([value, label]) => ({ value, label }));
}

export default function AuctionPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  // Preserve existing itemType=beast links while making assetType the primary tab.
  const assetType: AuctionAssetType =
    searchParams.get('assetType') === 'beast' ||
    (!searchParams.has('assetType') && searchParams.get('itemType') === 'beast')
      ? 'beast'
      : 'item';
  const rawType = searchParams.get('itemType');
  const itemType: ItemTypeFilter =
    assetType === 'beast'
      ? 'beast'
      : ITEM_TYPES.includes(rawType as (typeof ITEM_TYPES)[number])
        ? (rawType as ItemTypeFilter)
        : 'all';
  const mine = searchParams.get('tab') === 'my';
  const categoryOptions = getCategoryOptions(itemType);
  const itemCategory = categoryOptions.some(
    (option) => option.value === searchParams.get('itemCategory'),
  )
    ? searchParams.get('itemCategory')!
    : 'all';
  const supportsQuality = ['material', 'seed', 'consumable'].includes(itemType);
  const rawQuality = searchParams.get('itemQuality');
  const itemQuality =
    supportsQuality &&
    QUALITY_VALUES.includes(rawQuality as (typeof QUALITY_VALUES)[number])
      ? rawQuality!
      : 'all';
  const rawSort = searchParams.get('sortBy');
  const sortBy =
    rawSort === 'price_asc' || rawSort === 'price_desc' ? rawSort : 'latest';
  const rawPage = Number(searchParams.get('page'));
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const searchMode =
    searchParams.get('searchMode') === 'sellerName' ? 'sellerName' : 'itemName';
  const searchValue = searchParams.get(searchMode) || '';
  const profile = useCultivatorIdentity();
  const currency = useCultivatorCurrency();
  const identity = profile.data?.cultivator;
  const ownerLevel = identity
    ? getRealmStageLevel(identity.realm, identity.realm_stage)
    : 0;
  const { mutate } = useResourceMutation();
  const { pushToast } = useInkUI();
  const [refresh, setRefresh] = useState(0);
  const [result, setResult] = useState<{
    key: string;
    data?: ListingsPayload;
    error?: string;
  }>();
  const [showListModal, setShowListModal] = useState(false);
  const [filterDraft, setFilterDraft] = useState<{
    itemType: ItemTypeFilter;
    category: string;
    quality: string;
    sortBy: string;
    searchMode: string;
    searchValue: string;
  } | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const pending = useRef(false);
  const buyAttempt = useRef<{ key: string; id: string }>(undefined);
  const [dialog, setDialog] = useState<InkDialogState | null>(null);
  const [now, setNow] = useState(() => Date.now());

  function updateQuery(
    updates: Record<string, string | null>,
    resetPage = true,
  ) {
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous);
      for (const [key, value] of Object.entries(updates)) {
        if (!value || value === 'all') next.delete(key);
        else next.set(key, value);
      }
      if (resetPage) next.delete('page');
      return next;
    });
  }
  const params = new URLSearchParams({
    assetType,
    scope: mine ? 'mine' : 'all',
    page: String(page),
    limit: assetType === 'item' ? '24' : '12',
    sortBy,
  });
  if (itemType !== 'all') params.set('itemType', itemType);
  if (itemCategory !== 'all') params.set('itemCategory', itemCategory);
  if (itemQuality !== 'all') params.set('itemQuality', itemQuality);
  if (searchValue.trim()) params.set(searchMode, searchValue.trim());
  const listUrl = `/api/auction/listings?${params}`;
  const requestKey = `${listUrl}:${refresh}`;
  const currentResult = result?.key === requestKey ? result : undefined;
  const data = currentResult?.data;

  useEffect(() => {
    const controller = new AbortController();
    void fetch(listUrl, { signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || '获取拍卖列表失败');
        if (!controller.signal.aborted)
          setResult({ key: requestKey, data: payload });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setResult({
            key: requestKey,
            error: error instanceof Error ? error.message : '获取拍卖列表失败',
          });
      });
    return () => controller.abort();
  }, [listUrl, requestKey]);

  // A sale or cancellation may empty the last page; keep the current filters.
  useEffect(() => {
    if (!data || page <= Math.max(1, data.pagination.totalPages)) return;
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.set('page', String(Math.max(1, data.pagination.totalPages)));
        return next;
      },
      { replace: true },
    );
  }, [data, page, setSearchParams]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  async function executeBuy(listing: AuctionListingView, quantity: number) {
    if (pending.current) return false;
    pending.current = true;
    const key = JSON.stringify([listing.id, quantity]);
    if (buyAttempt.current?.key !== key)
      buyAttempt.current = { key, id: crypto.randomUUID() };
    setPendingId(listing.id);
    try {
      const response = await mutate<{ message: string }>(
        fetch('/api/auction/buy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            listingId: listing.id,
            quantity,
            requestId: buyAttempt.current.id,
          }),
        }),
      );
      buyAttempt.current = undefined;
      pushToast({ message: response.message, tone: 'success' });
      return true;
    } catch (error) {
      pushToast({
        message: error instanceof Error ? error.message : '购买失败',
        tone: 'danger',
      });
      return false;
    } finally {
      pending.current = false;
      setPendingId(null);
      setRefresh((value) => value + 1);
    }
  }

  async function handleBuy(listing: AuctionListingView, quantity: number) {
    if (pending.current) return false;
    if (!identity || !currency.data) {
      pushToast({ message: '角色信息读取中，请稍后重试', tone: 'warning' });
      return false;
    }
    if (
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity >
        Math.min(listing.remainingQuantity, AUCTION_MAX_PURCHASE_QUANTITY)
    )
      return false;
    const total = calculateAuctionSettlement(
      listing.price,
      quantity,
    ).grossAmount;
    if (
      total > AUCTION_MAX_TRANSACTION_TOTAL ||
      total > currency.data.spiritStones
    ) {
      pushToast({
        message:
          total > AUCTION_MAX_TRANSACTION_TOTAL
            ? '超过单次交易总额上限'
            : '囊中羞涩，灵石不足',
        tone: 'warning',
      });
      return false;
    }
    if (listing.sellerId === identity.id) return false;
    if (
      listing.itemType === 'beast' ||
      quantity > 1 ||
      total > HIGH_VALUE_PURCHASE_CONFIRM_THRESHOLD
    ) {
      setDialog({
        id: `auction-buy-${listing.id}`,
        title: '确认购入',
        confirmLabel: '确认购入',
        cancelLabel: '再看看',
        content: (
          <div className="space-y-3 text-sm leading-6">
            <p>
              购入「{listing.itemName}」
              <span className="font-mono">{quantity}</span>
              {listing.itemType === 'beast' ? '只' : '件'}。
            </p>
            <p>
              单价{' '}
              <span className="font-mono">
                {listing.price.toLocaleString()}
              </span>{' '}
              灵石
            </p>
            <p className="text-amber-800">
              合计{' '}
              <span className="font-mono font-semibold">
                {total.toLocaleString()}
              </span>{' '}
              灵石
            </p>
            {listing.itemType === 'beast' &&
              !canDeployBeast(listing.beast, ownerLevel) && (
                <p className="text-crimson">
                  当前境界或灵兽寿命不满足出战条件，领取后暂不能出战。
                </p>
              )}
            <p className="text-ink-secondary">
              {listing.itemType === 'beast'
                ? '通过邮件领取，满仓时保留附件；领取后不自动携带或首发。'
                : '购入后通过邮件领取。'}
            </p>
          </div>
        ),
        onConfirm: async () => {
          await executeBuy(listing, quantity);
        },
      });
      return true;
    }
    return executeBuy(listing, quantity);
  }
  async function handleCancel(listing: AuctionListingView) {
    if (pending.current) return false;
    pending.current = true;
    setPendingId(listing.id);
    try {
      const response = await mutate<{ message: string }>(
        fetch(`/api/auction/${listing.id}`, { method: 'DELETE' }),
      );
      pushToast({ message: response.message, tone: 'success' });
      return true;
    } catch (error) {
      pushToast({
        message: error instanceof Error ? error.message : '下架失败',
        tone: 'danger',
      });
      return false;
    } finally {
      pending.current = false;
      setPendingId(null);
      setRefresh((value) => value + 1);
    }
  }
  const assetLabel = assetType === 'item' ? '道具' : '灵兽';
  const filterCount =
    Number(assetType === 'item' && itemType !== 'all') +
    Number(itemCategory !== 'all') +
    Number(itemQuality !== 'all') +
    Number(Boolean(searchValue.trim())) +
    Number(sortBy !== 'latest');
  const draftCategoryOptions = getCategoryOptions(
    filterDraft?.itemType ?? itemType,
  );
  const draftSupportsQuality = ['material', 'seed', 'consumable'].includes(
    filterDraft?.itemType ?? itemType,
  );
  function applyFilters() {
    if (!filterDraft) return;
    updateQuery({
      itemType: filterDraft.itemType,
      itemCategory: filterDraft.category,
      itemQuality: filterDraft.quality,
      sortBy: filterDraft.sortBy,
      searchMode: filterDraft.searchMode,
      itemName: null,
      sellerName: null,
      [filterDraft.searchMode]: filterDraft.searchValue.trim() || null,
    });
    setFilterDraft(null);
  }
  const listModalProps = {
    onClose: () => setShowListModal(false),
    onSuccess: () => {
      setShowListModal(false);
      updateQuery({
        tab: 'my',
        assetType,
        itemType: null,
        itemCategory: null,
        itemQuality: null,
        itemName: null,
        sellerName: null,
      });
      setRefresh((value) => value + 1);
    },
  };

  return (
    <GameSceneFrame variant="workflow">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <GameSceneTabs
            items={ASSET_TABS}
            activeValue={assetType}
            onChange={(value) => {
              updateQuery({
                assetType: value,
                itemType: null,
                itemCategory: null,
                itemQuality: null,
                itemName: null,
                sellerName: null,
              });
            }}
          />
        </div>
        <div className="flex shrink-0 items-center gap-1 sm:gap-3">
          <InkButton onClick={() => updateQuery({ tab: mine ? null : 'my' })}>
            {mine ? '返回市场' : '我的寄售'}
          </InkButton>
          <InkButton variant="primary" onClick={() => setShowListModal(true)}>
            上架
          </InkButton>
          <GameSceneHelpButton
            help={{
              title: '拍卖行规则',
              content: (
                <div className="space-y-2 text-sm leading-6">
                  <p>道具与灵兽合计最多寄售5单，每单保留48小时。</p>
                  <p>堆叠道具按件计价，可选择购买数量。灵兽每单1只。</p>
                  <p>
                    成交按单价适用3%～15%超额累进税率，成交款与退回物品通过邮件领取。
                  </p>
                  <p>
                    好友专属寄售须消耗1张随身拍卖行贵宾符，仅卖家与指定道友可见。同账号不可回购。
                  </p>
                </div>
              ),
            }}
          />
        </div>
      </div>
      <div className="flex items-center justify-between gap-2">
        <InkButton
          variant={filterCount ? 'primary' : 'default'}
          className="min-h-11"
          onClick={() =>
            setFilterDraft({
              itemType,
              category: itemCategory,
              quality: itemQuality,
              sortBy,
              searchMode,
              searchValue,
            })
          }
        >
          筛选{filterCount ? ` · ${filterCount}` : ''}
        </InkButton>
        <div className="text-ink-secondary flex items-center gap-2 text-xs">
          <p>
            {mine ? '我的寄售' : '在售'}
            {data && (
              <>
                {' '}
                · <span className="font-mono">{data.pagination.total}</span> 单
              </>
            )}
          </p>
          <InkButton onClick={() => setRefresh((value) => value + 1)}>
            刷新
          </InkButton>
        </div>
      </div>
      {filterDraft && (
        <InkDetailDrawer
          isOpen
          size="sm"
          title={`筛选${assetLabel}`}
          closeLabel="取消"
          onClose={() => setFilterDraft(null)}
          footer={
            <div className="flex items-center justify-between gap-3">
              <InkButton
                className="min-h-11"
                onClick={() =>
                  setFilterDraft({
                    itemType: assetType === 'beast' ? 'beast' : 'all',
                    category: 'all',
                    quality: 'all',
                    sortBy: 'latest',
                    searchMode: 'itemName',
                    searchValue: '',
                  })
                }
              >
                重置
              </InkButton>
              <InkButton
                variant="primary"
                className="min-h-11"
                onClick={applyFilters}
              >
                应用
              </InkButton>
            </div>
          }
        >
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              applyFilters();
            }}
          >
            <div className="grid grid-cols-2 gap-3">
              {assetType === 'item' && (
                <InkSelect
                  label="道具分类"
                  value={filterDraft.itemType}
                  onChange={(value) =>
                    setFilterDraft({
                      ...filterDraft,
                      itemType: value as ItemTypeFilter,
                      category: 'all',
                      quality: 'all',
                    })
                  }
                >
                  <option value="all">全部道具</option>
                  {ITEM_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {AUCTION_TYPE_NAMES[type]}
                    </option>
                  ))}
                </InkSelect>
              )}
              {draftCategoryOptions.length > 0 && (
                <InkSelect
                  label={assetType === 'beast' ? '物种' : '子类'}
                  value={filterDraft.category}
                  onChange={(value) =>
                    setFilterDraft({ ...filterDraft, category: value })
                  }
                >
                  <option value="all">
                    {assetType === 'beast' ? '全部物种' : '全部子类'}
                  </option>
                  {draftCategoryOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </InkSelect>
              )}
              {draftSupportsQuality && (
                <InkSelect
                  label="品级"
                  value={filterDraft.quality}
                  onChange={(value) =>
                    setFilterDraft({ ...filterDraft, quality: value })
                  }
                >
                  <option value="all">全部品级</option>
                  {QUALITY_VALUES.map((quality) => (
                    <option key={quality} value={quality}>
                      {quality}
                    </option>
                  ))}
                </InkSelect>
              )}
              <InkSelect
                label="排序"
                value={filterDraft.sortBy}
                onChange={(value) =>
                  setFilterDraft({ ...filterDraft, sortBy: value })
                }
              >
                <option value="latest">最新上架</option>
                <option value="price_asc">价格从低到高</option>
                <option value="price_desc">价格从高到低</option>
              </InkSelect>
            </div>
            <div className="grid grid-cols-[6rem_minmax(0,1fr)] items-start gap-3">
              <InkSelect
                label="搜索方式"
                value={filterDraft.searchMode}
                onChange={(value) =>
                  setFilterDraft({
                    ...filterDraft,
                    searchMode: value,
                    searchValue: '',
                  })
                }
              >
                <option value="itemName">{assetLabel}</option>
                <option value="sellerName">卖家</option>
              </InkSelect>
              <InkInput
                label="完整名称"
                value={filterDraft.searchValue}
                onChange={(value) =>
                  setFilterDraft({ ...filterDraft, searchValue: value })
                }
                placeholder={
                  filterDraft.searchMode === 'sellerName'
                    ? '完整卖家名'
                    : assetType === 'beast'
                      ? '灵兽自定义全名'
                      : '完整道具名'
                }
              />
            </div>
          </form>
        </InkDetailDrawer>
      )}
      {!currentResult ? (
        <GameLoadingState message="正在获取拍卖列表……" variant="inline" />
      ) : currentResult.error ? (
        <InkNotice tone="warning">
          {currentResult.error}
          <InkButton onClick={() => setRefresh((value) => value + 1)}>
            重试
          </InkButton>
        </InkNotice>
      ) : data && data.listings.length > 0 ? (
        <>
          <AuctionListings
            key={listUrl}
            listings={data.listings}
            assetType={assetType}
            ownerId={identity?.id}
            actions={(listing, close) => (
              <AuctionListingActions
                listing={listing}
                ownerId={identity?.id}
                ownerLevel={ownerLevel}
                now={now}
                pendingId={pendingId}
                onBuy={handleBuy}
                onCancel={handleCancel}
                close={close}
              />
            )}
          />
          {data.pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-4">
              <InkButton
                disabled={page <= 1}
                onClick={() => updateQuery({ page: String(page - 1) }, false)}
              >
                上一页
              </InkButton>
              <span className="font-mono text-sm">
                {page} / {data.pagination.totalPages}
              </span>
              <InkButton
                disabled={page >= data.pagination.totalPages}
                onClick={() => updateQuery({ page: String(page + 1) }, false)}
              >
                下一页
              </InkButton>
            </div>
          )}
        </>
      ) : (
        <InkNotice>
          {mine ? '当前没有符合条件的寄售' : '当前没有符合条件的货单'}
        </InkNotice>
      )}
      {showListModal &&
        (assetType === 'beast' ? (
          <ListBeastModal {...listModalProps} />
        ) : (
          <ListItemModal {...listModalProps} />
        ))}
      <InkDialog
        dialog={dialog}
        onClose={() => {
          if (!pending.current) setDialog(null);
        }}
      />
    </GameSceneFrame>
  );
}
