import { ItemExchangeShelf } from '@app/components/feature/item-shop/ItemExchangeShelf';
import {
  GameSceneAsideSection,
  GameSceneFrame,
} from '@app/components/game-shell';
import { useInkUI } from '@app/components/providers/InkUIProvider';
import { useResourceMutation } from '@app/lib/resources/mutations';
import { useCultivatorCurrency } from '@app/lib/resources/player';
import type {
  ReputationShopBuyResponse,
  ReputationShopItemView,
  ReputationShopListResponse,
} from '@shared/contracts/reputationShop';
import { getGameConceptInfo } from '@shared/lib/gameConceptDisplay';
import { useCallback, useEffect, useRef, useState } from 'react';

const REPUTATION_INFO = getGameConceptInfo('reputation');

async function fetchVaultItems(): Promise<ReputationShopListResponse> {
  const response = await fetch('/api/reputation-shop', { cache: 'no-store' });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? '天骄宝阁暂不可入');
  return data as ReputationShopListResponse;
}

export default function TianjiaoVaultPage() {
  const currency = useCultivatorCurrency();
  const reputation = currency.data?.reputation;
  const { mutate } = useResourceMutation();
  const { pushToast } = useInkUI();
  const [items, setItems] = useState<ReputationShopItemView[]>([]);
  const [loading, setLoading] = useState(true);
  const pending = useRef(false);
  const attempts = useRef(new Map<string, string>());
  const [buyingId, setBuyingId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchVaultItems();
      setItems(data.items);
    } catch (error) {
      pushToast({
        message: error instanceof Error ? error.message : '天骄宝阁暂不可入',
        tone: 'danger',
      });
    } finally {
      setLoading(false);
    }
  }, [pushToast]);

  useEffect(() => {
    void Promise.resolve().then(refresh);
  }, [refresh]);

  const handleBuy = async (item: ReputationShopItemView) => {
    if (pending.current) return;
    if (!attempts.current.has(item.id) && item.remainingPurchases === 0) {
      pushToast({ message: '此物已达兑换上限', tone: 'warning' });
      return;
    }
    if (
      !attempts.current.has(item.id) &&
      (reputation === undefined || reputation < item.price)
    ) {
      pushToast({ message: '声望不足', tone: 'warning' });
      return;
    }
    pending.current = true;
    if (!attempts.current.has(item.id))
      attempts.current.set(item.id, crypto.randomUUID());
    setBuyingId(item.id);
    try {
      const result = await mutate<ReputationShopBuyResponse>(
        fetch(`/api/reputation-shop/${item.id}/buy`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ requestId: attempts.current.get(item.id) }),
        }),
      );
      attempts.current.delete(item.id);
      pushToast({
        message: `已兑换 ${result.purchasedItem.item.name}，已放入${result.destinations.map((location) => (location === 'bag' ? '背包' : '储藏室')).join('、')}`,
        tone: 'success',
      });
      await refresh();
    } catch (error) {
      pushToast({
        message: error instanceof Error ? error.message : '兑换失败',
        tone: 'danger',
      });
    } finally {
      pending.current = false;
      setBuyingId(null);
    }
  };

  return (
    <GameSceneFrame
      title="天骄宝阁"
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
        buyingId={buyingId}
        onBuy={(item) => void handleBuy(item)}
        loading={loading}
        loadingText="宝阁执事正在核验名册……"
        emptyText="宝阁今日暂未陈列可兑换之物。"
      />
    </GameSceneFrame>
  );
}
