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
  InkTabs,
} from '@/components/ui';
import { useCultivator } from '@/lib/contexts/CultivatorContext';
import { getMapNode } from '@/lib/game/mapSystem';
import { Material } from '@/types/cultivator';
import { getMaterialTypeInfo } from '@/types/dictionaries';
import { MarketLayer } from '@/types/market';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type MarketListing = Material & {
  price: number;
  id: string;
  nodeId: string;
  layer: MarketLayer;
  isMystery?: boolean;
  mysteryMask?: {
    badge: '?';
    disguisedName: string;
  };
};

const DEFAULT_NODE_ID = 'TN_YUE_01';

const LAYER_OPTIONS: Array<{ label: string; value: MarketLayer }> = [
  { label: '凡市', value: 'common' },
  { label: '珍宝阁', value: 'treasure' },
  { label: '天宝殿', value: 'heaven' },
  { label: '黑市', value: 'black' },
];

export default function MarketPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { cultivator, refresh } = useCultivator();
  const { pushToast } = useInkUI();

  const nodeId = searchParams.get('nodeId') || DEFAULT_NODE_ID;
  const layer = (searchParams.get('layer') as MarketLayer | null) || 'common';
  const activeLayer = useMemo<MarketLayer>(
    () =>
      ['common', 'treasure', 'heaven', 'black'].includes(layer)
        ? layer
        : 'common',
    [layer],
  );

  const [listings, setListings] = useState<MarketListing[]>([]);
  const [nextRefresh, setNextRefresh] = useState<number>(0);
  const [isRefreshingMarket, setIsRefreshingMarket] = useState(false);
  const [isLoadingMarket, setIsLoadingMarket] = useState(true);
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [access, setAccess] = useState<{
    allowed: boolean;
    reason?: string;
    entryFee?: number;
  }>({ allowed: true });
  const [marketFlavor, setMarketFlavor] = useState<{
    title: string;
    description: string;
  } | null>(null);

  const isFetchingRef = useRef(false);
  const nextRetryAtRef = useRef(0);

  const selectedNode = getMapNode(nodeId);

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
        const res = await fetch(`/api/market/${nodeId}?layer=${activeLayer}`, {
          cache: 'no-store',
        });
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data?.error || '坊市暂未开启');
        }

        setListings(data.listings || []);
        setNextRefresh(data.nextRefresh || Date.now() + 5000);
        setAccess(data.access || { allowed: true });
        setMarketFlavor(data.marketFlavor || null);
        const isShortRetryWindow =
          typeof data.nextRefresh === 'number' &&
          data.nextRefresh - Date.now() <= 20000;
        setIsRefreshingMarket(
          (data.listings || []).length === 0 && isShortRetryWindow,
        );
        nextRetryAtRef.current = 0;
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
    [activeLayer, nodeId, pushToast],
  );

  useEffect(() => {
    if (!searchParams.get('nodeId')) {
      const next = new URLSearchParams(searchParams.toString());
      next.set('nodeId', DEFAULT_NODE_ID);
      if (!next.get('layer')) next.set('layer', 'common');
      router.replace(`${pathname}?${next.toString()}`);
      return;
    }
    void fetchMarket({ showLoading: true });
  }, [fetchMarket, pathname, router, searchParams]);

  const handleBuy = async (item: MarketListing) => {
    if (!cultivator) return;
    if (!access.allowed) {
      pushToast({
        message: access.reason || '当前层不可进入',
        tone: 'warning',
      });
      return;
    }
    if (cultivator.spirit_stones < item.price) {
      pushToast({ message: '囊中羞涩，灵石不足', tone: 'warning' });
      return;
    }

    setBuyingId(item.id);
    try {
      const res = await fetch(`/api/market/${nodeId}/buy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listingId: item.id,
          quantity: 1,
          layer: activeLayer,
        }),
      });
      const result = await res.json();
      if (result.success) {
        pushToast({ message: `成功购入 ${item.name}`, tone: 'success' });
        await refresh();
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

  const handleLayerChange = (nextLayer: string) => {
    const target = nextLayer as MarketLayer;
    const next = new URLSearchParams(searchParams.toString());
    next.set('nodeId', nodeId);
    next.set('layer', target);
    router.replace(`${pathname}?${next.toString()}`);
  };

  return (
    <InkPageShell
      title={`【${marketFlavor?.title || '云游坊市'}】`}
      subtitle={
        cultivator
          ? `灵石余额：${cultivator.spirit_stones} · 当前节点：${selectedNode?.name || nodeId}`
          : '路人止步'
      }
      backHref="/game"
      currentPath={pathname}
      footer={
        <InkActionGroup>
          <InkButton href="/game/map?intent=market">地图择城</InkButton>
          <InkButton href="/game/inventory">查看储物袋</InkButton>
        </InkActionGroup>
      }
    >
      <InkSection title={marketFlavor?.description || '四方云集，价高者得'}>
        <InkTabs
          className="mb-4"
          activeValue={activeLayer}
          onChange={handleLayerChange}
          items={LAYER_OPTIONS}
        />
        {!access.allowed && (
          <InkNotice>{access.reason || '当前层不可进入'}</InkNotice>
        )}
      </InkSection>

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
                    <div className="flex items-center">
                      <div className="flex items-center">
                        {item.isMystery && (
                          <span className="text-tier-di border-tier-di bg-tier-di/5 mr-1 inline-flex h-4 w-4 items-center justify-center rounded-xs border px-px text-xs">
                            疑
                          </span>
                        )}
                        {item.name}
                      </div>
                      <InkBadge tier={item.rank}>{typeInfo.label}</InkBadge>
                    </div>
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
                      disabled={
                        !!buyingId || item.quantity <= 0 || !access.allowed
                      }
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
