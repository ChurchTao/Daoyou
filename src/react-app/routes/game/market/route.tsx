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
  InkList,
  InkListItem,
  InkNotice,
} from '@app/components/ui';
import { usePlayerStateView } from '@app/lib/player-state/selectors';
import { usePlayerStateActions } from '@app/lib/player-state/store';
import { getGameConceptInfo } from '@shared/lib/gameConceptDisplay';
import { Material } from '@shared/types/cultivator';
import { getMaterialTypeInfo } from '@shared/lib/gameConceptDisplay';
import {
  getMarketNodeSwitchOptions,
  getMarketProfileHint,
  resolveMarketSwitchLayer,
} from '@shared/lib/game/marketConfig';
import { MarketLayer } from '@shared/types/market';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

type MarketListing = Material & {
  price: number;
  basePrice?: number;
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
const SPIRIT_STONES_INFO = getGameConceptInfo('spirit_stones');
const HIGH_VALUE_PURCHASE_CONFIRM_THRESHOLD = 100_000;

const LAYER_OPTIONS: Array<{ label: string; value: MarketLayer }> = [
  { label: '凡市', value: 'common' },
  { label: '珍宝阁', value: 'treasure' },
  { label: '天宝殿', value: 'heaven' },
  { label: '黑市', value: 'black' },
];

const getLayerLabel = (layer: MarketLayer) =>
  LAYER_OPTIONS.find((item) => item.value === layer)?.label ?? layer;

type MarketSnapshot = {
  listings: MarketListing[];
  nextRefresh: number;
  access: {
    allowed: boolean;
    reason?: string;
    entryFee?: number;
  };
  marketFlavor: {
    title: string;
    description: string;
  } | null;
  isRefreshingMarket: boolean;
};

async function readMarketSnapshot(
  nodeId: string,
  layer: MarketLayer,
): Promise<MarketSnapshot> {
  const res = await fetch(`/api/market/${nodeId}?layer=${layer}`, {
    cache: 'no-store',
  });
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data?.error || '坊市暂未开启');
  }

  const nextRefresh = data.nextRefresh || Date.now() + 5000;
  const isShortRetryWindow =
    typeof data.nextRefresh === 'number' &&
    data.nextRefresh - Date.now() <= 20000;

  return {
    listings: data.listings || [],
    nextRefresh,
    access: data.access || { allowed: true },
    marketFlavor: data.marketFlavor || null,
    isRefreshingMarket:
      (data.listings || []).length === 0 && isShortRetryWindow,
  };
}

export default function MarketPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { cultivator } = usePlayerStateView();
  const { mutate } = usePlayerStateActions();
  const { pushToast } = useInkUI();

  const nodeId = searchParams.get('nodeId') || DEFAULT_NODE_ID;
  const layer = (searchParams.get('layer') as MarketLayer | null) || 'common';
  const activeLayer = (
    ['common', 'treasure', 'heaven', 'black'].includes(layer) ? layer : 'common'
  ) as MarketLayer;

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

  const [isBatchMode, setIsBatchMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBatchBuying, setIsBatchBuying] = useState(false);
  const [timeLeft, setTimeLeft] = useState('');
  const [switchDialog, setSwitchDialog] = useState<InkDialogState | null>(null);
  const [buyConfirmDialog, setBuyConfirmDialog] =
    useState<InkDialogState | null>(null);
  const [batchBuyDialog, setBatchBuyDialog] = useState<InkDialogState | null>(
    null,
  );

  const isFetchingRef = useRef(false);
  const nextRetryAtRef = useRef(0);

  const marketHint = useMemo(
    () => getMarketProfileHint(nodeId, activeLayer),
    [activeLayer, nodeId],
  );
  const marketSwitchOptions = useMemo(() => getMarketNodeSwitchOptions(), []);
  const sortedMarketSwitchOptions = useMemo(
    () =>
      [...marketSwitchOptions].sort((a, b) => {
        if (a.id === nodeId) return -1;
        if (b.id === nodeId) return 1;
        return a.name.localeCompare(b.name, 'zh-Hans-CN');
      }),
    [marketSwitchOptions, nodeId],
  );
  const currentSwitchOption = useMemo(
    () => marketSwitchOptions.find((option) => option.id === nodeId),
    [marketSwitchOptions, nodeId],
  );
  const marketHintTypeLabels =
    marketHint.dominantMaterialTypes
      .map((type) => getMaterialTypeInfo(type).label)
      .join('、') || '杂货';
  const applyMarketSnapshot = useCallback(
    (snapshot: MarketSnapshot) => {
      setListings(snapshot.listings);
      setNextRefresh(snapshot.nextRefresh);
      setAccess(snapshot.access);
      setMarketFlavor(snapshot.marketFlavor);
      setIsRefreshingMarket(snapshot.isRefreshingMarket);
    },
    [
      setAccess,
      setIsRefreshingMarket,
      setListings,
      setMarketFlavor,
      setNextRefresh,
    ],
  );

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
        applyMarketSnapshot(await readMarketSnapshot(nodeId, activeLayer));
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
    [activeLayer, applyMarketSnapshot, nodeId, pushToast, setIsLoadingMarket],
  );

  useEffect(() => {
    if (!searchParams.get('nodeId')) {
      const next = new URLSearchParams(searchParams.toString());
      next.set('nodeId', DEFAULT_NODE_ID);
      if (!next.get('layer')) next.set('layer', 'common');
      navigate(`/game/market?${next.toString()}`, { replace: true });
      return;
    }
    let cancelled = false;

    const loadInitialMarket = async () => {
      try {
        const snapshot = await readMarketSnapshot(nodeId, activeLayer);

        if (cancelled) return;

        applyMarketSnapshot(snapshot);
        nextRetryAtRef.current = 0;
      } catch (error) {
        nextRetryAtRef.current = Date.now() + 5000;
        if (!cancelled) {
          pushToast({
            message: error instanceof Error ? error.message : '坊市暂未开启',
            tone: 'warning',
          });
        }
      } finally {
        isFetchingRef.current = false;
        if (!cancelled) {
          setIsLoadingMarket(false);
        }
      }
    };

    isFetchingRef.current = true;
    void loadInitialMarket();

    return () => {
      cancelled = true;
    };
  }, [
    activeLayer,
    applyMarketSnapshot,
    navigate,
    nodeId,
    pushToast,
    searchParams,
  ]);

  const executeBuy = async (item: MarketListing) => {
    if (!cultivator) return;

    setBuyingId(item.id);
    try {
      await mutate(
        fetch(`/api/market/${nodeId}/buy`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            listingId: item.id,
            quantity: 1,
            layer: activeLayer,
          }),
        }),
      );
      pushToast({ message: `成功购入 ${item.name}`, tone: 'success' });
      void fetchMarket({ showLoading: false });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : '购买失败';
      pushToast({ message, tone: 'danger' });
    } finally {
      setBuyingId(null);
    }
  };

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
    if (item.price > HIGH_VALUE_PURCHASE_CONFIRM_THRESHOLD) {
      setBuyConfirmDialog({
        id: `market-buy-${item.id}`,
        title: '高额交易确认',
        content: (
          <div className="space-y-2 text-sm leading-7">
            <p>确定购入「{item.name}」吗？</p>
            <p className="text-gold font-bold">
              将消耗：{SPIRIT_STONES_INFO.icon} {item.price}{' '}
              {SPIRIT_STONES_INFO.label}
            </p>
          </div>
        ),
        confirmLabel: '确认购入',
        cancelLabel: '再看看',
        onConfirm: async () => {
          await executeBuy(item);
        },
      });
      return;
    }

    await executeBuy(item);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBatchBuy = async () => {
    if (!cultivator || selectedIds.size === 0) return;

    const selectedItems = listings.filter((l) => selectedIds.has(l.id));
    const totalCost = selectedItems.reduce((acc, curr) => acc + curr.price, 0);

    if (cultivator.spirit_stones < totalCost) {
      pushToast({ message: '囊中羞涩，灵石不足', tone: 'warning' });
      return;
    }

    setBatchBuyDialog({
      id: 'batch-buy',
      title: '批量确认',
      content: (
        <div className="space-y-2">
          <p>确定购入以下 {selectedIds.size} 件物品吗？</p>
          <div className="text-ink-secondary text-sm">
            {selectedItems.map((i) => i.name).join('、')}
          </div>
          <p className="text-gold font-bold">
            共计：{SPIRIT_STONES_INFO.icon} {totalCost}{' '}
            {SPIRIT_STONES_INFO.label}
          </p>
        </div>
      ),
      confirmLabel: '购入',
      cancelLabel: '罢',
      onConfirm: async () => {
        setIsBatchBuying(true);
        // 更新对话框显示 loading
        setBatchBuyDialog((prev) => (prev ? { ...prev, loading: true } : null));
        try {
          await mutate(
            fetch(`/api/market/${nodeId}/buy`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                items: selectedItems.map((i) => ({
                  listingId: i.id,
                  quantity: 1,
                })),
                layer: activeLayer,
              }),
            }),
          );
          pushToast({
            message: `成功批量购入 ${selectedIds.size} 件物品`,
            tone: 'success',
          });
          setSelectedIds(new Set());
          setIsBatchMode(false);
          void fetchMarket({ showLoading: false });
        } catch (e: unknown) {
          pushToast({
            message: e instanceof Error ? e.message : '批量购买失败',
            tone: 'danger',
          });
        } finally {
          setIsBatchBuying(false);
        }
      },
    });
  };

  const formatTime = (ms: number) => {
    const minutes = Math.floor((ms / 1000 / 60) % 60);
    const seconds = Math.floor((ms / 1000) % 60);
    return `${minutes}分${seconds}秒`;
  };

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
    navigate(`/game/market?${next.toString()}`, { replace: true });
  };

  const handleMarketNodeSwitch = (targetNodeId: string) => {
    const nextLayer = resolveMarketSwitchLayer(targetNodeId, activeLayer);
    const next = new URLSearchParams(searchParams.toString());
    next.set('nodeId', targetNodeId);
    next.set('layer', nextLayer);
    setSwitchDialog(null);
    setIsBatchMode(false);
    setSelectedIds(new Set());
    navigate(`/game/market?${next.toString()}`);
  };

  const openMarketSwitchDialog = () => {
    setSwitchDialog({
      id: 'market-switch',
      title: '快捷切换',
      cancelLabel: '关闭',
      confirmLabel: null,
      content: (
        <div className="grid gap-2 md:grid-cols-2">
          {sortedMarketSwitchOptions.map((option) => {
            const isCurrent = option.id === nodeId;
            const targetLayer = resolveMarketSwitchLayer(
              option.id,
              activeLayer,
            );
            const typeLabels = option.dominantMaterialTypes
              .map((type) => getMaterialTypeInfo(type).label)
              .join('、');

            return (
              <button
                key={option.id}
                type="button"
                onClick={() => handleMarketNodeSwitch(option.id)}
                disabled={isCurrent}
                className={[
                  'min-w-0 border px-3 py-2 text-left transition-colors',
                  isCurrent
                    ? 'border-crimson/35 bg-crimson/6 text-ink cursor-default'
                    : 'border-ink/15 bg-paper/50 hover:border-crimson/35 hover:text-crimson',
                ].join(' ')}
              >
                <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-semibold">{option.name}</span>
                  {isCurrent ? (
                    <span className="text-crimson text-xs">当前</span>
                  ) : null}
                </div>
                <div className="text-ink-secondary mt-1 text-xs leading-5">
                  {option.region} · {option.realmRequirement} ·{' '}
                  {getLayerLabel(targetLayer)}
                </div>
                <div className="text-ink-secondary mt-1 text-xs leading-5">
                  {typeLabels || '杂货'} · {option.summary}
                </div>
              </button>
            );
          })}
        </div>
      ),
    });
  };

  return (
    <GameSceneFrame
      title={`【${marketFlavor?.title || '云游坊市'}】`}
      description={
        marketFlavor?.description ||
        '四方云集，奇货待价。先看节点、层级与刷新节奏，再决定补给、捡漏还是观望。'
      }
      headerMeta={
        <div className="space-y-3 text-sm leading-6">
          <div className="text-ink-secondary flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>{marketHint.nodeName}</span>
            <span>{marketHint.region}</span>
            <span>主打 {marketHintTypeLabels}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {marketHint.signatureTags.slice(0, 4).map((tag) => (
              <span
                key={tag}
                className="border-ink/15 text-ink-secondary bg-ink/4 inline-flex border px-2 py-0.5 text-xs leading-5"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      }
      aside={
        <>
          <GameSceneAsideSection title="坊市摘要">
            <div className="space-y-2 text-sm leading-7">
              <p>
                {SPIRIT_STONES_INFO.label}余额：
                {cultivator?.spirit_stones ?? 0}
              </p>
              <p>当前节点：{marketHint.nodeName}</p>
              <p>当前层级：{getLayerLabel(activeLayer)}</p>
              <p>刷新倒计时：{timeLeft}</p>
            </div>
          </GameSceneAsideSection>
          <GameSceneAsideSection title="坊市风闻">
            <div className="space-y-3 text-sm leading-7">
              <p>{marketHint.priceTendency}</p>
              <div className="flex flex-wrap gap-2">
                {marketHint.dominantMaterialTypes.map((type) => {
                  const info = getMaterialTypeInfo(type);
                  return (
                    <span
                      key={type}
                      className="border-ink/15 bg-paper/50 text-ink inline-flex border px-2 py-0.5 text-xs leading-5"
                    >
                      {info.icon} {info.label}
                    </span>
                  );
                })}
              </div>
              {marketHint.layerHints.length > 0 ? (
                <p className="text-ink-secondary">
                  {marketHint.layerHints.join(' ')}
                </p>
              ) : null}
            </div>
          </GameSceneAsideSection>
          <GameSceneAsideSection
            title="入场条件"
            className="text-sm leading-7"
            help={{
              title: '坊市入场条件',
              content: (
                <div className="space-y-2 text-sm leading-7">
                  {access.allowed ? (
                    <p>当前层可自由进入，宜趁刷新前比价出手。</p>
                  ) : (
                    <p>{access.reason || '当前层不可进入'}</p>
                  )}
                  {typeof access.entryFee === 'number' ? (
                    <p>
                      入场耗费：{access.entryFee} {SPIRIT_STONES_INFO.label}
                    </p>
                  ) : null}
                </div>
              ),
            }}
          />
        </>
      }
    >
      <div className="space-y-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <InkButton onClick={openMarketSwitchDialog}>
              快捷切换
            </InkButton>
            <InkButton
              onClick={() => {
                setIsBatchMode(!isBatchMode);
                setSelectedIds(new Set());
              }}
              variant={isBatchMode ? 'primary' : 'default'}
            >
              {isBatchMode ? '退出批量' : '批量模式'}
            </InkButton>
          </div>
          {isBatchMode && selectedIds.size > 0 && (
            <InkButton
              variant="primary"
              onClick={handleBatchBuy}
              disabled={isBatchBuying}
            >
              购入已选 ({selectedIds.size}件 - {SPIRIT_STONES_INFO.icon}{' '}
              {listings
                .filter((l) => selectedIds.has(l.id))
                .reduce((acc, curr) => acc + curr.price, 0)}
              )
            </InkButton>
          )}
        </div>
        {currentSwitchOption ? (
          <p className="text-ink-secondary text-sm leading-6">
            {currentSwitchOption.summary}
          </p>
        ) : null}
        <GameSceneTabs
          activeValue={activeLayer}
          onChange={handleLayerChange}
          items={LAYER_OPTIONS}
        />
        {!access.allowed && (
          <InkNotice>{access.reason || '当前层不可进入'}</InkNotice>
        )}
      </div>

      <div className="space-y-4">
        <p className="text-ink-secondary mb-4 text-sm leading-6">
          下批好货刷新倒计时：{timeLeft}
        </p>
        {isLoadingMarket ? (
          <div className="py-10 text-center">坊市掌柜正在盘货...</div>
        ) : listings.length > 0 ? (
          <InkList>
            {listings.map((item) => {
              const typeInfo = getMaterialTypeInfo(item.type);
              const isSelected = selectedIds.has(item.id);

              return (
                <InkListItem
                  key={item.id}
                  highlight={isBatchMode && isSelected}
                  layout="col"
                  title={
                    <div
                      className="flex cursor-pointer items-center"
                      onClick={() => isBatchMode && toggleSelect(item.id)}
                    >
                      {isBatchMode && (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(item.id)}
                          className="mr-2 h-4 w-4"
                          onClick={(e) => e.stopPropagation()}
                        />
                      )}
                      <div className="flex items-center">
                        {item.isMystery && (
                          <span className="text-tier-di border-tier-di bg-tier-di/5 mr-1 inline-flex h-4 min-w-4 items-center justify-center border px-px text-xs">
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
                      <span className="text-gold flex items-center gap-2 font-bold">
                        {item.basePrice && item.basePrice > item.price ? (
                          <span className="text-ink-secondary text-xs line-through">
                            {SPIRIT_STONES_INFO.icon} {item.basePrice}
                          </span>
                        ) : null}
                        <span>
                          {SPIRIT_STONES_INFO.icon} {item.price}{' '}
                          {SPIRIT_STONES_INFO.label}
                        </span>
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
                    !isBatchMode && (
                      <InkButton
                        onClick={() => handleBuy(item)}
                        disabled={
                          !!buyingId || item.quantity <= 0 || !access.allowed
                        }
                        variant="primary"
                        className="min-w-20 justify-end"
                      >
                        {buyingId === item.id
                          ? '交易中'
                          : item.quantity <= 0
                            ? '售罄'
                            : '购买'}
                      </InkButton>
                    )
                  }
                />
              );
            })}
          </InkList>
        ) : isRefreshingMarket ? (
          <InkNotice>坊市掌柜正在盘货，请稍候片刻再来。</InkNotice>
        ) : (
          <InkNotice>当前层级暂无货物，请等待下次刷新。</InkNotice>
        )}
      </div>
      <InkDialog
        dialog={batchBuyDialog}
        onClose={() => setBatchBuyDialog(null)}
      />
      <InkDialog
        dialog={buyConfirmDialog}
        onClose={() => setBuyConfirmDialog(null)}
      />
      <InkDialog
        dialog={switchDialog}
        onClose={() => setSwitchDialog(null)}
      />
    </GameSceneFrame>
  );
}
