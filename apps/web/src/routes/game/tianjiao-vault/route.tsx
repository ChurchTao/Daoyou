import { apiFetch } from '@app/lib/api/fetch';
import { ItemExchangeShelf } from '@app/components/feature/item-shop/ItemExchangeShelf';
import {
  canonicalExchangeLines,
  exchangeSummary,
  HIGH_VALUE_EXCHANGE_CONFIRM_THRESHOLD,
  useExchangeCart,
} from '@app/components/feature/item-shop/useExchangeCart';
import {
  GameSceneAsideSection,
  GameSceneFrame,
} from '@app/components/game-shell';
import { useInkUI } from '@app/components/providers/InkUIProvider';
import { useResourceMutation } from '@app/lib/resources/mutations';
import { useCultivatorCurrency } from '@app/lib/resources/player';
import type {
  ReputationShopCartBuyResponse,
  ReputationShopListResponse,
} from '@daoyou/contracts/shops/reputation';
import { getGameConceptInfo } from '@daoyou/game-content/presentation/concepts';
import { useCallback, useEffect, useRef, useState } from 'react';

const REPUTATION_INFO = getGameConceptInfo('reputation');

async function fetchVaultItems(): Promise<ReputationShopListResponse> {
  const response = await apiFetch('/api/reputation-shop', { cache: 'no-store' });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? '万界商行暂不可入');
  return data as ReputationShopListResponse;
}

export default function TianjiaoVaultPage() {
  const currency = useCultivatorCurrency();
  const reputation = currency.data?.reputation;
  const { mutate } = useResourceMutation();
  const { openDialog, pushToast } = useInkUI();
  const [items, setItems] = useState<ReputationShopListResponse['items']>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const attempt = useRef<{ key: string; requestId: string } | null>(null);
  const refreshSeq = useRef(0);
  const cart = useExchangeCart(items);

  const refresh = useCallback(async (quiet = false) => {
    const seq = ++refreshSeq.current;
    if (!quiet) setLoading(true);
    try {
      const data = await fetchVaultItems();
      if (seq !== refreshSeq.current) return;
      setItems(data.items);
    } catch (error) {
      if (quiet || seq !== refreshSeq.current) return;
      pushToast({
        message: error instanceof Error ? error.message : '万界商行暂不可入',
        tone: 'danger',
      });
    } finally {
      if (!quiet && seq === refreshSeq.current) setLoading(false);
    }
  }, [pushToast]);

  useEffect(() => {
    void Promise.resolve().then(() => refresh());
  }, [refresh]);

  const executeCheckout = async () => {
    const lines = cart.lines;
    const total = cart.total;
    if (busy.current || !lines.length) return;
    if (reputation === undefined || reputation < total) {
      pushToast({ message: '声望不足', tone: 'warning' });
      return;
    }
    const itemsToBuy = canonicalExchangeLines(lines);
    const key = JSON.stringify({ expectedTotal: total, items: itemsToBuy });
    if (attempt.current?.key !== key)
      attempt.current = { key, requestId: crypto.randomUUID() };
    busy.current = true;
    setPending(true);
    try {
      const result = await mutate<ReputationShopCartBuyResponse>(
        apiFetch('/api/reputation-shop/buy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requestId: attempt.current.requestId,
            expectedTotal: total,
            items: itemsToBuy,
          }),
        }),
      );
      attempt.current = null;
      cart.clear(lines.map((line) => line.id));
      pushToast({
        message: `${exchangeSummary(lines)}，已放入${result.destinations.map((location) => (location === 'bag' ? '背包' : '储藏室')).join('、')}`,
        tone: 'success',
      });
      setItems((current) =>
        current.map(
          (item) =>
            result.purchasedItems.find((purchased) => purchased.id === item.id) ??
            item,
        ),
      );
      void refresh(true);
    } catch (error) {
      pushToast({
        message: error instanceof Error ? error.message : '兑换失败',
        tone: 'danger',
      });
    } finally {
      busy.current = false;
      setPending(false);
    }
  };

  const requestCheckout = () => {
    if (busy.current || !cart.lines.length) return;
    if (cart.total > HIGH_VALUE_EXCHANGE_CONFIRM_THRESHOLD) {
      openDialog({
        title: '确认兑换',
        content: (
          <div className="space-y-2 text-sm leading-7">
            <p>
              确认兑换所选 <span className="font-mono">{cart.lines.length}</span>{' '}
              种，共 <span className="font-mono">{cart.pieces}</span> 次？
            </p>
            <p className="text-crimson font-bold">
              将消耗：<span className="font-mono">{cart.total}</span>{' '}
              {REPUTATION_INFO.label}
            </p>
          </div>
        ),
        confirmLabel: '确认兑换',
        cancelLabel: '再看看',
        onConfirm: executeCheckout,
      });
      return;
    }
    void executeCheckout();
  };

  return (
    <GameSceneFrame
      title="万界商行"
      description="榜上扬名、幻境破关所得声望，皆可在此换取珍藏。"
      aside={
        <>
          <GameSceneAsideSection title="声望余量">
            <div className="space-y-2 text-sm leading-7">
              <p>
                {REPUTATION_INFO.icon} {REPUTATION_INFO.label}：
                {reputation ?? '读取中…'}
              </p>
              <p>已上架：{items.length} 件</p>
            </div>
          </GameSceneAsideSection>
          <GameSceneAsideSection title="兑换规矩">
            <div className="space-y-2 text-sm leading-7">
              <p>兑换后道具进入背包，满包转入储藏室。</p>
              <p>部分珍藏设有个人兑换上限。</p>
            </div>
          </GameSceneAsideSection>
        </>
      }
    >
      <ItemExchangeShelf
        items={items}
        balance={reputation}
        currencyConcept="reputation"
        pending={pending}
        cart={cart}
        onCheckout={requestCheckout}
        onUnavailable={(message) => pushToast({ message, tone: 'warning' })}
        loading={loading}
        loadingText="万界商行执事正在核验名册……"
        emptyText="万界商行今日暂未陈列可兑换之物。"
      />
    </GameSceneFrame>
  );
}
