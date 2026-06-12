import {
  GameSceneAsideSection,
  GameSceneFrame,
} from '@app/components/game-shell';
import { useInkUI } from '@app/components/providers/InkUIProvider';
import {
  InkBadge,
  InkButton,
  InkList,
  InkListItem,
  InkNotice,
} from '@app/components/ui';
import { usePlayerStateView } from '@app/lib/player-state/selectors';
import { usePlayerStateActions } from '@app/lib/player-state/store';
import type {
  ReputationShopBuyResponse,
  ReputationShopItemView,
  ReputationShopListResponse,
} from '@shared/contracts/reputationShop';
import { getGameConceptInfo } from '@shared/lib/gameConceptDisplay';
import { QUALITY_VALUES, type Quality } from '@shared/types/constants';
import { useCallback, useEffect, useState } from 'react';

const REPUTATION_INFO = getGameConceptInfo('reputation');

function getItemTypeLabel(item: ReputationShopItemView['item']) {
  switch (item.type) {
    case 'material':
      return '材料';
    case 'consumable':
      return '消耗品';
    case 'artifact':
      return '法宝';
  }
}

function toQualityTier(quality: string | null | undefined): Quality | undefined {
  return QUALITY_VALUES.includes(quality as Quality)
    ? (quality as Quality)
    : undefined;
}

async function fetchVaultItems(): Promise<ReputationShopListResponse> {
  const response = await fetch('/api/reputation-shop', { cache: 'no-store' });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error ?? '天骄宝阁暂不可入');
  }
  return data as ReputationShopListResponse;
}

export default function TianjiaoVaultPage() {
  const { cultivator } = usePlayerStateView();
  const { mutate, refresh: refreshPlayerState } = usePlayerStateActions();
  const { pushToast } = useInkUI();
  const [items, setItems] = useState<ReputationShopItemView[]>([]);
  const [loading, setLoading] = useState(true);
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const reputation = cultivator?.reputation ?? 0;

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

  useEffect(() => {
    void Promise.resolve().then(() => refreshPlayerState(['currency']));
  }, [refreshPlayerState]);

  const handleBuy = async (item: ReputationShopItemView) => {
    if (!cultivator) return;
    if (item.remainingPurchases === 0) {
      pushToast({ message: '此物已达兑换上限', tone: 'warning' });
      return;
    }
    if (reputation < item.price) {
      pushToast({ message: '声望不足', tone: 'warning' });
      return;
    }

    setBuyingId(item.id);
    try {
      const result = await mutate<ReputationShopBuyResponse>(
        fetch(`/api/reputation-shop/${item.id}/buy`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      pushToast({
        message: `已兑换 ${result.purchasedItem.item.name}`,
        tone: 'success',
      });
      void refresh();
    } catch (error) {
      pushToast({
        message: error instanceof Error ? error.message : '兑换失败',
        tone: 'danger',
      });
    } finally {
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
                {REPUTATION_INFO.icon} {REPUTATION_INFO.label}：{reputation}
              </p>
              <p>已上架：{items.length} 件</p>
            </div>
          </GameSceneAsideSection>
          <GameSceneAsideSection title="兑换规矩">
            <div className="space-y-2 text-sm leading-7">
              <p>兑换后道具会直接归入储物袋。</p>
              <p>部分珍藏设有个人兑换上限。</p>
            </div>
          </GameSceneAsideSection>
        </>
      }
    >
      {loading ? (
        <InkNotice tone="muted">宝阁执事正在核验名册...</InkNotice>
      ) : items.length === 0 ? (
        <InkNotice tone="muted">宝阁今日暂未陈列可兑换之物。</InkNotice>
      ) : (
        <InkList>
          {items.map((item) => {
            const canBuy =
              item.remainingPurchases !== 0 &&
              reputation >= item.price &&
              buyingId !== item.id;
            return (
              <InkListItem
                key={item.id}
                title={
                  <div className="flex flex-wrap items-center gap-2">
                    <span>{item.item.name}</span>
                    <InkBadge tier={toQualityTier(item.item.quality)}>
                      {getItemTypeLabel(item.item)}
                    </InkBadge>
                  </div>
                }
                meta={
                  <div className="flex w-full flex-wrap items-center justify-between gap-2">
                    <span>
                      {REPUTATION_INFO.icon} {item.price}{' '}
                      {REPUTATION_INFO.label}
                    </span>
                    <span>
                      数量 x{item.quantity}
                      {item.perUserLimit
                        ? ` · 本周已兑 ${item.purchasedCount}/${item.perUserLimit}`
                        : ''}
                    </span>
                  </div>
                }
                description={
                  item.item.description ?? item.item.payload.description ?? '无说明'
                }
                actions={
                  <InkButton
                    onClick={() => handleBuy(item)}
                    disabled={!canBuy}
                    variant={canBuy ? 'primary' : 'secondary'}
                  >
                    {buyingId === item.id
                      ? '兑换中'
                      : item.remainingPurchases === 0
                        ? '已达上限'
                        : reputation < item.price
                          ? '声望不足'
                          : '兑换'}
                  </InkButton>
                }
              />
            );
          })}
        </InkList>
      )}
    </GameSceneFrame>
  );
}
