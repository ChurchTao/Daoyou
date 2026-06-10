import { ItemDetailModal } from '@app/routes/game/inventory/components/ItemDetailModal';
import {
  toInventoryItemDetail, type ItemDetailPayload, } from '@app/routes/game/inventory/components/itemDetailPayload';
import {
  TEMP_DISABLED_MESSAGES, temporaryRestrictions, } from '@shared/config/temporaryRestrictions';
import { ListItemModal } from '@app/components/auction/ListItemModal';
import {
  PillKeywordLine,
  toPillDisplayModel,
} from '@app/components/feature/consumables';
import {
  GameSceneAsideSection,
  GameSceneFrame,
  GameSceneTabs,
} from '@app/components/game-shell';
import { useInkUI } from '@app/components/providers/InkUIProvider';
import {
  InkBadge,
  InkButton,
  InkList,
  InkNotice,
} from '@app/components/ui';
import { ItemCard } from '@app/components/ui/ItemCard';
import { useCultivator } from '@app/lib/contexts/CultivatorContext';
import { usePlayerStateActions } from '@app/lib/player-state/store';
import { isPillConsumable } from '@shared/lib/consumables';
import type { Artifact, Consumable, Material } from '@shared/types/cultivator';
import {
  CONSUMABLE_TYPE_DISPLAY_MAP, getConsumableRankInfo, getEquipmentSlotInfo, getMaterialTypeInfo, } from '@shared/types/dictionaries';
import { useEffect, useState } from 'react';


type AuctionListing = {
  id: string;
  sellerId: string;
  sellerName: string;
  itemType: 'material' | 'artifact' | 'consumable';
  itemId: string;
  itemSnapshot: Material | Artifact | Consumable;
  price: number;
  status: string;
  createdAt: string;
  expiresAt: string;
  soldAt?: string;
};

export default function AuctionPage() {
  const { cultivator } = useCultivator();
  const [activeTab, setActiveTab] = useState('browse');
  const [browseListings, setBrowseListings] = useState<AuctionListing[]>([]);
  const [myListings, setMyListings] = useState<AuctionListing[]>([]);
  const [isLoadingBrowse, setIsLoadingBrowse] = useState(true);
  const [isLoadingMy, setIsLoadingMy] = useState(true);
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [showListModal, setShowListModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ItemDetailPayload | null>(
    null,
  );

  const [pagination, setPagination] = useState({
    browse: { page: 1, totalPages: 1 },
    my: { page: 1, totalPages: 1 },
  });

  const { pushToast } = useInkUI();
  const { mutate } = usePlayerStateActions();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;

    const loadActiveTab = async () => {
      try {
        if (activeTab === 'browse') {
          const res = await fetch(
            `/api/auction/listings?page=${pagination.browse.page}&limit=10`,
          );
          const data = await res.json();
          if (cancelled) return;
          if (data.listings) {
            setBrowseListings(data.listings);
            if (data.pagination) {
              setPagination((prev) => ({
                ...prev,
                browse: {
                  page: data.pagination.page,
                  totalPages: data.pagination.totalPages,
                },
              }));
            }
          }
          setIsLoadingBrowse(false);
          return;
        }

        if (!cultivator) {
          if (!cancelled) {
            setMyListings([]);
            setIsLoadingMy(false);
          }
          return;
        }

        const res = await fetch(
          `/api/auction/listings?page=${pagination.my.page}&limit=50`,
        );
        const data = await res.json();
        if (cancelled) return;
        if (data.listings) {
          const filtered = data.listings.filter(
            (l: AuctionListing) => l.sellerId === cultivator.id,
          );
          setMyListings(filtered);
        }
        setIsLoadingMy(false);
      } catch (error) {
        if (!cancelled) {
          pushToast({
            message: error instanceof Error ? error.message : '获取拍卖列表失败',
            tone: 'warning',
          });
        }
      }
    };

    void loadActiveTab();

    return () => {
      cancelled = true;
    };
  }, [activeTab, cultivator, pagination.browse.page, pagination.my.page, pushToast]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchBrowseListings = async (page: number = 1) => {
    setIsLoadingBrowse(true);
    try {
      const res = await fetch(`/api/auction/listings?page=${page}&limit=10`);
      const data = await res.json();
      if (data.listings) {
        setBrowseListings(data.listings);
        if (data.pagination) {
          setPagination((prev) => ({
            ...prev,
            browse: {
              page: data.pagination.page,
              totalPages: data.pagination.totalPages,
            },
          }));
        }
      }
    } catch (error) {
      pushToast({
        message: error instanceof Error ? error.message : '获取拍卖列表失败',
        tone: 'warning',
      });
    } finally {
      setIsLoadingBrowse(false);
    }
  };

  const fetchMyListings = async (page: number = 1) => {
    if (!cultivator) {
      setMyListings([]);
      setIsLoadingMy(false);
      return;
    }

    setIsLoadingMy(true);
    try {
      // 这里的 API 目前不支持直接查个人的分页，所以还是前端过滤或者需要后端支持
      // 不过 API 已经支持分页，只是没有 sellerId 过滤
      // 为了保持分页逻辑一致，暂时先复用列表接口并增加参数（如果后端支持的话）
      // 实际上后端目前没加 sellerId 过滤，我先按现有 API 处理
      const res = await fetch(`/api/auction/listings?page=${page}&limit=50`);
      const data = await res.json();
      if (data.listings) {
        // 只显示自己的寄售
        const filtered = data.listings.filter(
          (l: AuctionListing) => l.sellerId === cultivator.id,
        );
        setMyListings(filtered);
        // 我的寄售通常不多，分页逻辑暂时简化
      }
    } catch (error) {
      pushToast({
        message: error instanceof Error ? error.message : '获取寄售记录失败',
        tone: 'warning',
      });
    } finally {
      setIsLoadingMy(false);
    }
  };

  const handlePageChange = (newPage: number) => {
    if (activeTab === 'browse') {
      fetchBrowseListings(newPage);
    } else {
      fetchMyListings(newPage);
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
      fetchBrowseListings(pagination.browse.page);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : '购买失败';
      pushToast({ message, tone: 'danger' });
    } finally {
      setBuyingId(null);
    }
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
      fetchMyListings(pagination.my.page);
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
      pillKeywordLabels: undefined as string[] | undefined,
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
      case 'consumable': {
        const consumable = item as Consumable;
        const typeInfo = CONSUMABLE_TYPE_DISPLAY_MAP[consumable.type];
        const rankInfo = getConsumableRankInfo(consumable.quality || '凡品');
        const pillDisplay = isPillConsumable(consumable)
          ? toPillDisplayModel(consumable, { realm: cultivator?.realm })
          : null;
        return {
          ...baseProps,
          icon: typeInfo.icon,
          quality: consumable.quality,
          description: pillDisplay?.primaryEffect ?? consumable.description,
          pillKeywordLabels: pillDisplay?.keywordLabels,
          badgeExtra: (
            <>
              <InkBadge tone="default">{rankInfo.label}</InkBadge>
              <InkBadge tone="default">{consumable.type}</InkBadge>
            </>
          ),
        };
      }
    }
  };

  const tabs = [
    { label: '浏览拍卖', value: 'browse' },
    { label: '我的寄售', value: 'my' },
  ];

  const renderListing = (listing: AuctionListing, isMyListing: boolean) => {
    const displayProps = getItemDisplayProps(listing);
    const timeLeft = formatTime(listing.expiresAt);
    const listedQuantity =
      'quantity' in listing.itemSnapshot ? listing.itemSnapshot.quantity : 1;

    return (
      <ItemCard
        key={listing.id}
        layout="col"
        {...displayProps}
        meta={
          <div className="text-ink-secondary mt-1 space-y-2 text-xs">
            {displayProps.pillKeywordLabels ? (
              <PillKeywordLine labels={displayProps.pillKeywordLabels} />
            ) : null}
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span>
                  卖家: {listing.sellerName}
                  {listing.sellerId === cultivator?.id ? ' (我)' : ''}
                </span>
                <span>数量: x{listedQuantity}</span>
                <span className="text-gold text-sm font-semibold">
                  💰 {listing.price} 灵石
                </span>
              </div>
              <span className="whitespace-nowrap">剩余: {timeLeft}</span>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
              {isMyListing && (
                <span className="text-ink-secondary text-[0.75rem] opacity-75">
                  预计到手: {Math.floor(listing.price * 0.9)} 灵石
                </span>
              )}
            </div>
          </div>
        }
        actions={
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
        }
      />
    );
  };

  const renderPagination = (type: 'browse' | 'my') => {
    const pag = pagination[type];
    if (pag.totalPages <= 1) return null;

    return (
      <div className="mt-4 flex items-center justify-center gap-4">
        <InkButton
          variant="secondary"
          disabled={pag.page <= 1}
          onClick={() => handlePageChange(pag.page - 1)}
        >
          上一页
        </InkButton>
        <span className="text-ink-secondary text-sm">
          {pag.page} / {pag.totalPages}
        </span>
        <InkButton
          variant="secondary"
          disabled={pag.page >= pag.totalPages}
          onClick={() => handlePageChange(pag.page + 1)}
        >
          下一页
        </InkButton>
      </div>
    );
  };

  return (
    <GameSceneFrame
      variant="workflow"
      title="【拍卖行】"
      description="拍卖行保留浏览、购买、寄售与详情弹窗，右侧改为只呈现灵石余额、寄售容量与成交规则。"
      aside={
        <>
          <GameSceneAsideSection title="寄售摘要">
            <div className="space-y-2 text-sm leading-7">
              <p>灵石余额：{cultivator?.spirit_stones ?? 0}</p>
              <p>当前页签：{activeTab === 'browse' ? '浏览拍卖' : '我的寄售'}</p>
              <p>浏览货单：{browseListings.length} 条</p>
              <p>我的寄售：{myListings.length} / 5</p>
            </div>
          </GameSceneAsideSection>
          <GameSceneAsideSection
            title="成交规则"
            className="text-sm leading-7"
            help={{
              title: '拍卖行成交规则',
              content: (
                <div className="space-y-2 text-sm leading-7">
                  <p>寄售成功后按时限等待成交；自己的货单不可回购。</p>
                  <p>卖家实际到手为标价的九成，余下一成视作抽成。</p>
                </div>
              ),
            }}
          />
        </>
      }
    >
      <GameSceneTabs
        items={tabs}
        activeValue={activeTab}
        onChange={setActiveTab}
      />
      {cultivator && activeTab === 'my' ? (
        <div className="flex justify-end">
          <InkButton onClick={() => setShowListModal(true)} variant="primary">
            上架物品
          </InkButton>
        </div>
      ) : null}
      {temporaryRestrictions.disableConsumableAuctionListing && (
        <InkNotice>{TEMP_DISABLED_MESSAGES.consumableAuctionListing}</InkNotice>
      )}

      {activeTab === 'browse' ? (
        <div>
          {isLoadingBrowse ? (
            <div className="py-10 text-center">正在获取拍卖列表...</div>
          ) : browseListings.length > 0 ? (
            <>
              <InkList>
                {browseListings.map((listing) => renderListing(listing, false))}
              </InkList>
              {renderPagination('browse')}
            </>
          ) : (
            <InkNotice>当前没有道友寄售的物品</InkNotice>
          )}
        </div>
      ) : (
        <div>
          {isLoadingMy ? (
            <div className="py-10 text-center">正在获取寄售记录...</div>
          ) : myListings.length > 0 ? (
            <>
              <InkList>
                {myListings.map((listing) => renderListing(listing, true))}
              </InkList>
              {renderPagination('my')}
            </>
          ) : (
            <InkNotice>
              你还没有寄售任何物品
              <br />
              点击上方「上架物品」开始寄售
            </InkNotice>
          )}
        </div>
      )}

      {showListModal && (
        <ListItemModal
          onClose={() => setShowListModal(false)}
          onSuccess={() => {
            setShowListModal(false);
            fetchMyListings();
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
    </GameSceneFrame>
  );
}
