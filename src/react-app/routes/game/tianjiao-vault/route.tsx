import {
  GameSceneAsideSection,
  GameSceneFrame,
  GameSceneTabs,
} from '@app/components/game-shell';
import {
  ConsumableListCard,
} from '@app/components/feature/consumables';
import {
  ItemDetailModal,
  toInventoryItemDetail,
  type ItemDetailPayload,
} from '@app/components/feature/items';
import { ArtifactListCard } from '@app/components/feature/products';
import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkBadge, InkButton, InkList, InkNotice } from '@app/components/ui';
import { ItemCard } from '@app/components/ui/ItemCard';
import { usePlayerStateView } from '@app/lib/player-state/selectors';
import { usePlayerStateActions } from '@app/lib/player-state/store';
import type {
  ReputationShopBuyResponse,
  ReputationShopItemView,
  ReputationShopListResponse,
} from '@shared/contracts/reputationShop';
import {
  getGameConceptInfo,
  getMaterialTypeInfo,
} from '@shared/lib/gameConceptDisplay';
import type { Artifact, Consumable, Material } from '@shared/types/cultivator';
import { QUALITY_VALUES, type Quality } from '@shared/types/constants';
import { useCallback, useEffect, useMemo, useState } from 'react';

const REPUTATION_INFO = getGameConceptInfo('reputation');

function toQualityTier(quality: string | null | undefined): Quality | undefined {
  return QUALITY_VALUES.includes(quality as Quality)
    ? (quality as Quality)
    : undefined;
}

type ShopTabKey = 'artifact' | 'pill' | 'talisman' | 'material';

const SHOP_TABS: Array<{
  key: ShopTabKey;
  title: string;
  emptyText: string;
}> = [
  { key: 'artifact', title: '法宝', emptyText: '暂无可兑换法宝。' },
  { key: 'pill', title: '丹药', emptyText: '暂无可兑换丹药。' },
  { key: 'talisman', title: '符箓', emptyText: '暂无可兑换符箓。' },
  { key: 'material', title: '灵材', emptyText: '暂无可兑换灵材。' },
];

function getShopTabKey(item: ReputationShopItemView): ShopTabKey {
  if (item.item.type === 'artifact') return 'artifact';
  if (item.item.type === 'material') return 'material';
  return item.item.payload.type === '符箓' ? 'talisman' : 'pill';
}

function toInventoryPreviewItem(
  shopItem: ReputationShopItemView,
): Artifact | Material | Consumable {
  const entry = shopItem.item;
  if (entry.type === 'artifact') {
    return {
      id: entry.itemId,
      name: entry.payload.name,
      slot: entry.payload.slot,
      element: entry.payload.element,
      quality: entry.payload.quality,
      description: entry.payload.description,
      score: entry.payload.score,
      productModel: entry.payload.productModel,
    };
  }

  if (entry.type === 'consumable') {
    return {
      id: entry.itemId,
      name: entry.payload.name,
      type: entry.payload.type,
      quality: entry.payload.quality,
      quantity: shopItem.quantity,
      description: entry.payload.description,
      prompt: entry.payload.prompt,
      score: entry.payload.score,
      spec: entry.payload.spec as Consumable['spec'],
    };
  }

  return {
    id: entry.itemId,
    name: entry.payload.name,
    type: entry.payload.type,
    rank: entry.payload.rank,
    element: entry.payload.element,
    description: entry.payload.description,
    quantity: shopItem.quantity,
  };
}

function toDetailPayload(shopItem: ReputationShopItemView): ItemDetailPayload {
  const preview = toInventoryPreviewItem(shopItem);
  if (shopItem.item.type === 'artifact') {
    return toInventoryItemDetail('artifact', preview as Artifact);
  }
  if (shopItem.item.type === 'consumable') {
    return toInventoryItemDetail('consumable', preview as Consumable);
  }
  return toInventoryItemDetail('material', preview as Material);
}

function buildPurchaseMeta(item: ReputationShopItemView) {
  const remaining =
    item.remainingPurchases === null ? '不限' : `${item.remainingPurchases}`;
  const limit = item.perUserLimit === null ? '不限' : `${item.perUserLimit}`;
  return `${REPUTATION_INFO.icon} ${item.price} ${REPUTATION_INFO.label} · 本周剩余 ${remaining}/${limit}`;
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
  const [detailItem, setDetailItem] = useState<ItemDetailPayload | null>(null);
  const [activeTab, setActiveTab] = useState<ShopTabKey>('artifact');
  const reputation = cultivator?.reputation ?? 0;
  const itemCountsByTab = useMemo(
    () =>
      items.reduce<Record<ShopTabKey, number>>(
        (acc, item) => {
          acc[getShopTabKey(item)] += 1;
          return acc;
        },
        { artifact: 0, pill: 0, talisman: 0, material: 0 },
      ),
    [items],
  );
  const visibleTabs = useMemo(
    () => SHOP_TABS.filter((tab) => itemCountsByTab[tab.key] > 0),
    [itemCountsByTab],
  );
  const selectedTab =
    itemCountsByTab[activeTab] > 0 ? activeTab : visibleTabs[0]?.key;
  const activeItems = useMemo(
    () =>
      selectedTab
        ? items.filter((item) => getShopTabKey(item) === selectedTab)
        : [],
    [items, selectedTab],
  );
  const activeTabMeta =
    SHOP_TABS.find((tab) => tab.key === selectedTab) ?? SHOP_TABS[0];

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

  const renderShopItem = (item: ReputationShopItemView) => {
    const canBuy =
      item.remainingPurchases !== 0 &&
      reputation >= item.price &&
      buyingId !== item.id;
    const preview = toInventoryPreviewItem(item);
    const actions = (
      <div className="flex w-full flex-wrap justify-end gap-2">
        <InkButton
          type="button"
          variant="secondary"
          onClick={() => setDetailItem(toDetailPayload(item))}
        >
          详情
        </InkButton>
        <InkButton
          onClick={() => handleBuy(item)}
          disabled={!canBuy}
          variant={canBuy ? 'primary' : 'secondary'}
        >
          {buyingId === item.id
            ? '兑换中'
            : item.remainingPurchases === 0
              ? '本周已罄'
              : reputation < item.price
                ? '声望不足'
                : '兑换'}
        </InkButton>
      </div>
    );

    if (item.item.type === 'artifact') {
      return (
        <ArtifactListCard
          key={item.id}
          artifact={preview as Artifact}
          actions={actions}
        />
      );
    }

    if (item.item.type === 'consumable') {
      const consumable = preview as Consumable;

      return (
        <ConsumableListCard
          key={item.id}
          consumable={{
            ...consumable,
            quality: toQualityTier(consumable.quality),
          }}
          realm={cultivator?.realm}
          condition={cultivator?.condition}
          contextMeta={<div>{buildPurchaseMeta(item)}</div>}
          contextMetaPlacement="before"
          actions={actions}
        />
      );
    }

    const material = preview as Material;
    const typeInfo = getMaterialTypeInfo(material.type);
    return (
      <ItemCard
        key={item.id}
        layout="col"
        icon={typeInfo.icon}
        name={material.name}
        quality={material.rank}
        badgeExtra={
          <>
            <InkBadge tier={material.rank}>{typeInfo.label}</InkBadge>
            {material.element ? (
              <InkBadge tone="default">{material.element}</InkBadge>
            ) : null}
            {item.quantity > 1 ? (
              <span className="text-ink-secondary text-sm">x{item.quantity}</span>
            ) : null}
          </>
        }
        meta={buildPurchaseMeta(item)}
        description={
          material.element
            ? `${material.element}属性${typeInfo.label}`
            : `${typeInfo.label}，可入炼制之用`
        }
        actions={actions}
      />
    );
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
        <div className="space-y-4">
          <GameSceneTabs
            activeValue={selectedTab ?? visibleTabs[0].key}
            onChange={(value) => setActiveTab(value as ShopTabKey)}
            items={visibleTabs.map((tab) => ({
              value: tab.key,
              label: `${tab.title} ${itemCountsByTab[tab.key]}`,
            }))}
          />
          {activeItems.length > 0 ? (
            <InkList>{activeItems.map((item) => renderShopItem(item))}</InkList>
          ) : (
            <InkNotice tone="muted">{activeTabMeta.emptyText}</InkNotice>
          )}
        </div>
      )}
      <ItemDetailModal
        isOpen={Boolean(detailItem)}
        item={detailItem}
        onClose={() => setDetailItem(null)}
        viewerRealm={cultivator?.realm}
        viewerCondition={cultivator?.condition}
      />
    </GameSceneFrame>
  );
}
