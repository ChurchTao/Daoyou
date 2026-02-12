'use client';

import { ItemDetailModal } from '@/app/(game)/game/inventory/components/ItemDetailModal';
import { ListItemModal } from '@/components/auction/ListItemModal';
import { InkPageShell, InkSection } from '@/components/layout';
import { useInkUI } from '@/components/providers/InkUIProvider';
import {
  InkActionGroup,
  InkBadge,
  InkButton,
  InkList,
  InkNotice,
  InkTabs,
} from '@/components/ui';
import { EffectCard } from '@/components/ui/EffectCard';
import { useCultivator } from '@/lib/contexts/CultivatorContext';
import type { Artifact, Consumable, Material } from '@/types/cultivator';
import {
  CONSUMABLE_TYPE_DISPLAY_MAP,
  getConsumableRankInfo,
  getEquipmentSlotInfo,
  getMaterialTypeInfo,
} from '@/types/dictionaries';
import { usePathname } from 'next/navigation';
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
  const { cultivator, refresh } = useCultivator();
  const [activeTab, setActiveTab] = useState('browse');
  const [browseListings, setBrowseListings] = useState<AuctionListing[]>([]);
  const [myListings, setMyListings] = useState<AuctionListing[]>([]);
  const [isLoadingBrowse, setIsLoadingBrowse] = useState(true);
  const [isLoadingMy, setIsLoadingMy] = useState(true);
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [showListModal, setShowListModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<
    Material | Artifact | Consumable | null
  >(null);

  const [pagination, setPagination] = useState({
    browse: { page: 1, totalPages: 1 },
    my: { page: 1, totalPages: 1 },
  });

  const { pushToast } = useInkUI();
  const pathname = usePathname();

  useEffect(() => {
    if (activeTab === 'browse') {
      fetchBrowseListings(pagination.browse.page);
    } else {
      fetchMyListings(pagination.my.page);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

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
      const res = await fetch('/api/auction/buy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId: listing.id }),
      });
      const result = await res.json();
      if (result.success) {
        pushToast({ message: result.message, tone: 'success' });
        await refresh();
        fetchBrowseListings(pagination.browse.page);
      } else {
        throw new Error(result.error);
      }
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
      const res = await fetch(`/api/auction/${listing.id}`, {
        method: 'DELETE',
      });
      const result = await res.json();
      if (result.success) {
        pushToast({ message: result.message, tone: 'success' });
        fetchMyListings(pagination.my.page);
      } else {
        throw new Error(result.error);
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : '下架失败';
      pushToast({ message, tone: 'danger' });
    } finally {
      setCancellingId(null);
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const diff = date.getTime() - Date.now();
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
          effects: artifact.effects,
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
        return {
          ...baseProps,
          icon: typeInfo.icon,
          quality: consumable.quality,
          effects: consumable.effects,
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

  const subtitle = cultivator
    ? activeTab === 'my'
      ? `灵石余额：${cultivator.spirit_stones} ｜ 我的寄售：${myListings.length}/5`
      : `灵石余额：${cultivator.spirit_stones}`
    : '路人止步';

  const renderListing = (listing: AuctionListing, isMyListing: boolean) => {
    const displayProps = getItemDisplayProps(listing);
    const timeLeft = formatTime(listing.expiresAt);
    const listedQuantity =
      'quantity' in listing.itemSnapshot ? listing.itemSnapshot.quantity : 1;

    return (
      <EffectCard
        key={listing.id}
        layout="col"
        {...displayProps}
        meta={
          <div className="text-ink-secondary mt-1 space-y-2 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span>
                  卖家: {listing.sellerName}
                  {listing.sellerId === cultivator?.id ? ' (我)' : ''}
                </span>
                <span>数量: x{listedQuantity}</span>
                <span className="text-sm font-semibold text-yellow-700">
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
              onClick={() => setSelectedItem(listing.itemSnapshot)}
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
    <InkPageShell
      title="【拍卖行】"
      subtitle={subtitle}
      backHref="/game"
      currentPath={pathname}
      footer={
        <InkActionGroup>
          <InkButton href="/game/inventory">查看储物袋</InkButton>
          {cultivator && activeTab === 'my' && (
            <InkButton onClick={() => setShowListModal(true)} variant="primary">
              上架物品
            </InkButton>
          )}
        </InkActionGroup>
      }
    >
      <InkTabs items={tabs} activeValue={activeTab} onChange={setActiveTab} />

      {activeTab === 'browse' ? (
        <InkSection title="">
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
        </InkSection>
      ) : (
        <InkSection title="">
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
              点击下方「上架物品」开始寄售
            </InkNotice>
          )}
        </InkSection>
      )}

      {showListModal && (
        <ListItemModal
          onClose={() => setShowListModal(false)}
          onSuccess={() => {
            setShowListModal(false);
            fetchMyListings();
            refresh();
          }}
          cultivator={cultivator}
        />
      )}

      <ItemDetailModal
        isOpen={!!selectedItem}
        onClose={() => setSelectedItem(null)}
        item={selectedItem}
      />
    </InkPageShell>
  );
}
