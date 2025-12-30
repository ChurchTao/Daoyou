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
import { useCultivatorBundle } from '@/lib/hooks/useCultivatorBundle';
import { Material } from '@/types/cultivator';
import { getMaterialTypeInfo } from '@/types/dictionaries';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

type MarketListing = Material & { price: number };

export default function MarketPage() {
  const { cultivator, refresh } = useCultivatorBundle();
  const [listings, setListings] = useState<MarketListing[]>([]);
  const [nextRefresh, setNextRefresh] = useState<number>(0);
  const [isLoadingMarket, setIsLoadingMarket] = useState(true);
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const { pushToast } = useInkUI();
  const pathname = usePathname();

  useEffect(() => {
    fetchMarket();
  }, []);

  const fetchMarket = async () => {
    setIsLoadingMarket(true);
    try {
      const res = await fetch('/api/market');
      const data = await res.json();
      if (data.listings) {
        setListings(data.listings);
        setNextRefresh(data.nextRefresh);
      }
    } catch (error) {
      pushToast({
        message: error instanceof Error ? error.message : '坊市暂未开启',
        tone: 'warning',
      });
    } finally {
      setIsLoadingMarket(false);
    }
  };

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
          cultivatorId: cultivator.id,
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
        fetchMarket();
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
      const diff = nextRefresh - Date.now();
      if (diff <= 0) {
        setTimeLeft('即将刷新');
        if (diff < -5000) fetchMarket(); // Refresh if outdated by 5s
      } else {
        setTimeLeft(formatTime(diff));
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [nextRefresh]);

  return (
    <InkPageShell
      title="【云游坊市】"
      subtitle={
        cultivator ? `灵石余额：${cultivator.spirit_stones}` : '路人止步'
      }
      backHref="/"
      currentPath={pathname}
      footer={
        <InkActionGroup>
          <InkButton href="/inventory">查看储物袋</InkButton>
        </InkActionGroup>
      }
    >
      <InkSection title={`下批好货刷新倒计时：${timeLeft}`}>
        {isLoadingMarket ? (
          <div className="text-center py-10">坊市掌柜正在盘货...</div>
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
                    <div className="flex justify-between items-center w-full">
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
                      <p className="text-xs text-ink-secondary mt-1">
                        库存: {item.quantity}
                      </p>
                    </div>
                  }
                  actions={
                    <InkButton
                      onClick={() => handleBuy(item)}
                      disabled={!!buyingId || item.quantity <= 0}
                      variant="primary"
                      className="min-w-[80px]"
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
        ) : (
          <InkNotice>今日货物已售罄，请稍后再来。</InkNotice>
        )}
      </InkSection>
    </InkPageShell>
  );
}
