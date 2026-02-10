'use client';

import { ListItemModal } from '@/components/auction/ListItemModal';
import { InkPageShell, InkSection } from '@/components/layout';
import { useInkUI } from '@/components/providers/InkUIProvider';
import {
  InkActionGroup,
  InkBadge,
  InkButton,
  InkList,
  InkListItem,
  InkNotice,
  InkTabs,
} from '@/components/ui';
import { useCultivator } from '@/lib/contexts/CultivatorContext';
import type { Artifact, Consumable, Material } from '@/types/cultivator';
import {
  getConsumableRankInfo,
  getMaterialTypeInfo,
  getQualityInfo,
} from '@/types/dictionaries';
import { usePathname, useRouter } from 'next/navigation';
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
  const { pushToast } = useInkUI();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (activeTab === 'browse') {
      fetchBrowseListings();
    } else {
      fetchMyListings();
    }
  }, [activeTab]);

  const fetchBrowseListings = async () => {
    setIsLoadingBrowse(true);
    try {
      const res = await fetch('/api/auction/listings');
      const data = await res.json();
      if (data.listings) {
        setBrowseListings(data.listings);
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

  const fetchMyListings = async () => {
    if (!cultivator) {
      setMyListings([]);
      setIsLoadingMy(false);
      return;
    }

    setIsLoadingMy(true);
    try {
      const res = await fetch('/api/auction/listings');
      const data = await res.json();
      if (data.listings) {
        // 只显示自己的寄售
        const myListings = data.listings.filter(
          (l: AuctionListing) => l.sellerId === cultivator.id,
        );
        setMyListings(myListings);
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
        fetchBrowseListings();
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
        fetchMyListings();
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

  const getItemDisplay = (listing: AuctionListing) => {
    const item = listing.itemSnapshot;
    const baseInfo = {
      name: item.name,
      description: item.description,
    };

    switch (listing.itemType) {
      case 'material': {
        const material = item as Material;
        const typeInfo = getMaterialTypeInfo(material.type);
        return {
          ...baseInfo,
          badge: <InkBadge tier={material.rank}>{typeInfo.label}</InkBadge>,
          meta: (
            <>
              <span>
                {typeInfo.icon} · {material.element || '无属性'}
              </span>
            </>
          ),
        };
      }
      case 'artifact': {
        const artifact = item as Artifact;
        const qualityInfo = getQualityInfo(artifact.quality || '凡品');
        return {
          ...baseInfo,
          badge: (
            <InkBadge tier={artifact.quality || '凡品'}>
              {qualityInfo.label}
            </InkBadge>
          ),
          meta: (
            <>
              <span>
                ⚔️ · {artifact.element} · {artifact.slot}
              </span>
            </>
          ),
        };
      }
      case 'consumable': {
        const consumable = item as Consumable;
        const qualityInfo = getQualityInfo(consumable.quality || '凡品');
        const rankInfo = getConsumableRankInfo(consumable.quality || '凡品');
        return {
          ...baseInfo,
          badge: (
            <InkBadge tier={consumable.quality || '凡品'}>
              {rankInfo.label}
            </InkBadge>
          ),
          meta: (
            <>
              <span>💊 · {consumable.type}</span>
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

  return (
    <InkPageShell
      title="【拍卖行】"
      subtitle={
        cultivator ? `灵石余额：${cultivator.spirit_stones}` : '路人止步'
      }
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
        <InkSection title="道友寄售">
          {isLoadingBrowse ? (
            <div className="py-10 text-center">正在获取拍卖列表...</div>
          ) : browseListings.length > 0 ? (
            <InkList>
              {browseListings.map((listing) => {
                const display = getItemDisplay(listing);
                return (
                  <InkListItem
                    key={listing.id}
                    title={
                      <>
                        {display.name}
                        <span className="text-ink-secondary ml-2 text-sm">
                          卖家: {listing.sellerName}
                        </span>
                        <div className="ml-auto">{display.badge}</div>
                      </>
                    }
                    meta={
                      <div className="flex w-full items-center justify-between">
                        {display.meta}
                        <span className="text-ink-secondary text-xs">
                          剩余 {formatTime(listing.expiresAt)}
                        </span>
                      </div>
                    }
                    description={
                      <div>
                        <p>{display.description}</p>
                        <p className="mt-1 text-lg font-bold text-yellow-600">
                          💰 {listing.price} 灵石
                        </p>
                      </div>
                    }
                    actions={
                      <InkButton
                        onClick={() => handleBuy(listing)}
                        disabled={
                          !!buyingId || listing.sellerId === cultivator?.id
                        }
                        variant="primary"
                        className="min-w-20"
                      >
                        {buyingId === listing.id
                          ? '交易中'
                          : listing.sellerId === cultivator?.id
                            ? '自己的'
                            : '购买'}
                      </InkButton>
                    }
                  />
                );
              })}
            </InkList>
          ) : (
            <InkNotice>当前没有道友寄售的物品</InkNotice>
          )}
        </InkSection>
      ) : (
        <InkSection title={`我的寄售 (${myListings.length}/5)`}>
          {isLoadingMy ? (
            <div className="py-10 text-center">正在获取寄售记录...</div>
          ) : myListings.length > 0 ? (
            <InkList>
              {myListings.map((listing) => {
                const display = getItemDisplay(listing);
                return (
                  <InkListItem
                    key={listing.id}
                    title={
                      <>
                        {display.name}
                        <div className="ml-auto">{display.badge}</div>
                      </>
                    }
                    meta={
                      <div className="flex w-full items-center justify-between">
                        {display.meta}
                        <span className="text-ink-secondary text-xs">
                          剩余 {formatTime(listing.expiresAt)}
                        </span>
                      </div>
                    }
                    description={
                      <div>
                        <p>{display.description}</p>
                        <p className="mt-1 text-lg font-bold text-yellow-600">
                          💰 {listing.price} 灵石
                        </p>
                        <p className="text-ink-secondary mt-1 text-xs">
                          预计收入: {Math.floor(listing.price * 0.9)} 灵石
                          (10%手续费)
                        </p>
                      </div>
                    }
                    actions={
                      <InkButton
                        onClick={() => handleCancel(listing)}
                        disabled={!!cancellingId}
                        variant="secondary"
                        className="min-w-20"
                      >
                        {cancellingId === listing.id ? '处理中' : '下架'}
                      </InkButton>
                    }
                  />
                );
              })}
            </InkList>
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
    </InkPageShell>
  );
}
