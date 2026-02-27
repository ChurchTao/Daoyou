'use client';

import { InkPageShell, InkSection } from '@/components/layout';
import { useInkUI } from '@/components/providers/InkUIProvider';
import {
  InkActionGroup,
  InkBadge,
  InkButton,
  InkList,
  InkListItem,
  InkNotice,
} from '@/components/ui';
import { useCultivator } from '@/lib/contexts/CultivatorContext';
import { Material } from '@/types/cultivator';
import { getMaterialTypeInfo } from '@/types/dictionaries';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

type MarketListing = Material & { price: number };

export default function MarketPage() {
  const { cultivator, refresh } = useCultivator();
  const [listings, setListings] = useState<MarketListing[]>([]);
  const [nextRefresh, setNextRefresh] = useState<number>(0);
  const [isRefreshingMarket, setIsRefreshingMarket] = useState(false);
  const [isLoadingMarket, setIsLoadingMarket] = useState(true);
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const { pushToast } = useInkUI();
  const pathname = usePathname();
  const isFetchingRef = useRef(false);
  const nextRetryAtRef = useRef(0);

  const fetchMarket = useCallback(
    async ({
      silent = false,
      showLoading = false,
    }: {
      silent?: boolean;
      showLoading?: boolean;
    } = {}) => {
      if (isFetchingRef.current) return;

      isFetchingRef.current = true;
      if (showLoading) setIsLoadingMarket(true);

      try {
        const res = await fetch('/api/market', { cache: 'no-store' });
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data?.error || '坊市暂未开启');
        }

        if (data.listings) {
          setListings(data.listings);
          setNextRefresh(data.nextRefresh);
          const isShortRetryWindow =
            typeof data.nextRefresh === 'number' &&
            data.nextRefresh - Date.now() <= 20000;
          setIsRefreshingMarket(data.listings.length === 0 && isShortRetryWindow);
          nextRetryAtRef.current = 0;
        }
      } catch (error) {
        nextRetryAtRef.current = Date.now() + 5000;
        if (!silent) {
          pushToast({
            message: error instanceof Error ? error.message : '坊市暂未开启',
            tone: 'warning',
          });
        }
      } finally {
        if (showLoading) setIsLoadingMarket(false);
        isFetchingRef.current = false;
      }
    },
    [pushToast],
  );

  useEffect(() => {
    void fetchMarket({ showLoading: true });
  }, [fetchMarket]);

  const handleBuy = async (item: MarketListing) => {
    if (!cultivator) return;
    if (cultivator.spirit_stones < item.price) {
      pushToast({ message: '囊中羞涩，灵石不足', tone: 'warning' });
      return;
    }

    setBuyingId(item.id!);
    try {
      const res = await fetch('/api/market/buy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: item.id,
          quantity: 1,
        }),
      });
      const result = await res.json();
      if (result.success) {
        pushToast({ message: `成功购入 ${item.name}`, tone: 'success' });
        // Refresh cultivator to update spirit stones and inventory
        await refresh();
        // Refresh market list (update quantity)
        void fetchMarket({ showLoading: false });
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

  const formatTime = (ms: number) => {
    const minutes = Math.floor((ms / 1000 / 60) % 60);
    const seconds = Math.floor((ms / 1000) % 60);
    return `${minutes}分${seconds}秒`;
  };

  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      const diff = nextRefresh - now;
      if (diff <= 0) {
        setTimeLeft('即将刷新');
        if (now >= nextRetryAtRef.current) {
          nextRetryAtRef.current = now + 5000;
          void fetchMarket({ silent: true, showLoading: false });
        }
      } else {
        setTimeLeft(formatTime(diff));
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [fetchMarket, nextRefresh]);

  return (
    <InkPageShell
      title="【云游坊市】"
      subtitle={
        cultivator ? `灵石余额：${cultivator.spirit_stones}` : '路人止步'
      }
      backHref="/game"
      currentPath={pathname}
      footer={
        <InkActionGroup>
          <InkButton href="/game/inventory">查看储物袋</InkButton>
        </InkActionGroup>
      }
    >
      <InkSection title={`下批好货刷新倒计时：${timeLeft}`}>
        {isLoadingMarket ? (
          <div className="py-10 text-center">坊市掌柜正在盘货...</div>
        ) : listings.length > 0 ? (
          <InkList>
            {listings.map((item) => {
              const typeInfo = getMaterialTypeInfo(item.type);

              return (
                <InkListItem
                  key={item.id}
                  title={
                    <>
                      {item.name}
                      <InkBadge tier={item.rank} className="ml-2">
                        {typeInfo.label}
                      </InkBadge>
                    </>
                  }
                  meta={
                    <div className="flex w-full items-center justify-between">
                      <span>
                        {typeInfo.icon} · {item.element || '无属性'}
                      </span>
                      <span className="font-bold text-yellow-600">
                        💰 {item.price} 灵石
                      </span>
                    </div>
                  }
                  description={
                    <div>
                      <p>{item.description}</p>
                      <p className="text-ink-secondary mt-1 text-xs">
                        库存: {item.quantity}
                      </p>
                    </div>
                  }
                  actions={
                    <InkButton
                      onClick={() => handleBuy(item)}
                      disabled={!!buyingId || item.quantity <= 0}
                      variant="primary"
                      className="min-w-20"
                    >
                      {buyingId === item.id
                        ? '交易中'
                        : item.quantity <= 0
                          ? '售罄'
                          : '购买'}
                    </InkButton>
                  }
                />
              );
            })}
          </InkList>
        ) : isRefreshingMarket ? (
          <InkNotice>坊市掌柜正在盘货，请稍候片刻再来。</InkNotice>
        ) : (
          <InkNotice>今日货物已售罄，请稍后再来。</InkNotice>
        )}
      </InkSection>
    </InkPageShell>
  );
}
