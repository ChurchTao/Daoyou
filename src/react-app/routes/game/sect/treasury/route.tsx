import { ItemExchangeShelf } from '@app/components/feature/item-shop/ItemExchangeShelf';
import { NpcConversation } from '@app/components/feature/room';
import {
  SectNpcConversationRegistry,
  SectRoutedRoom,
  type SectNpcConversationRendererProps,
} from '@app/components/feature/sect/room';
import { useSectShopQuery } from '@app/components/feature/sect/sectResources';
import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkButton } from '@app/components/ui';
import { useResourceMutation } from '@app/lib/resources/mutations';
import type {
  SectShopBuyResponse,
  SectShopItemData,
} from '@shared/contracts/sectShop';
import { STANDARD_SECT_PRESENTATION } from '@shared/engine/sect';
import { useRef, useState } from 'react';
import {
  postJson,
  SectPermissionBoundary,
  SectScene,
} from '../components/SectScene';

const HIGH_VALUE_EXCHANGE_CONFIRM_THRESHOLD = 100;

const registry = new SectNpcConversationRegistry([
  { key: 'sect.treasury.shop', renderer: TreasuryConversation },
]).assertRoom(STANDARD_SECT_PRESENTATION.rooms.treasury);

export default function SectTreasuryPage() {
  return (
    <SectPermissionBoundary permission="sect.shop.use" sceneKey="treasury">
      <SectScene sceneKey="treasury" mood="treasury">
        <SectRoutedRoom
          roomKey="treasury"
          registry={registry}
          eyebrow="贡献支取 · 库藏封签"
        />
      </SectScene>
    </SectPermissionBoundary>
  );
}

function TreasuryConversation({
  actor,
  onExit,
}: SectNpcConversationRendererProps) {
  const shop = useSectShopQuery();
  const { mutate } = useResourceMutation();
  const { openDialog, pushToast } = useInkUI();
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [buyingId, setBuyingId] = useState<string | null>(null);

  const pending = useRef(false);
  const attempts = useRef(new Map<string, string>());
  const executeBuy = async (item: SectShopItemData) => {
    if (pending.current) return;
    pending.current = true;
    const requestId = attempts.current.get(item.id) ?? crypto.randomUUID();
    attempts.current.set(item.id, requestId);
    setBuyingId(item.id);
    try {
      const result = await mutate<SectShopBuyResponse>(
        fetch(`/api/sects/current/shop/${item.id}/buy`, postJson(undefined, requestId)),
      );
      attempts.current.delete(item.id);
      pushToast({
        message: `已支取 ${result.purchasedItem.item.name}，存入${result.destinations.map(location => location === 'bag' ? '背包' : '储藏室').join('／')}`,
        tone: 'success',
      });
      await shop.reload();
    } catch (error) {
      pushToast({
        message: error instanceof Error ? error.message : '支取失败',
        tone: 'danger',
      });
    } finally {
      pending.current = false;
      setBuyingId(null);
    }
  };

  const handleBuy = async (item: SectShopItemData) => {
    const contribution = shop.data?.contribution;
    if (item.remainingPurchases === 0) {
      pushToast({ message: '此物已达兑换上限', tone: 'warning' });
      return;
    }
    if (contribution === undefined || contribution < item.price) {
      pushToast({ message: '宗门贡献不足', tone: 'warning' });
      return;
    }
    if (item.price > HIGH_VALUE_EXCHANGE_CONFIRM_THRESHOLD) {
      openDialog({
        title: '高额兑换确认',
        content: (
          <div className="space-y-2 text-sm leading-7">
            <p>确定兑换「{item.item.name}」吗？</p>
            <p className="text-crimson font-bold">
              将消耗：{item.price} 宗门贡献
            </p>
          </div>
        ),
        confirmLabel: '确认兑换',
        cancelLabel: '再看看',
        onConfirm: async () => {
          await executeBuy(item);
        },
      });
      return;
    }

    await executeBuy(item);
  };

  if (catalogOpen)
    return (
      <TreasuryShelfWorkspace
        items={shop.data?.items ?? []}
        contribution={shop.data?.contribution}
        buyingId={buyingId}
        loading={shop.loading}
        error={shop.error}
        onBuy={handleBuy}
        onBack={() => setCatalogOpen(false)}
      />
    );

  return (
    <NpcConversation
      actor={actor}
      messages={[{ id: 'greeting', speaker: actor.name, body: actor.greeting }]}
      options={[
        { id: 'catalog', label: '有劳执事取来本周库单', tone: 'primary' },
        { id: 'leave', label: '弟子告退', tone: 'muted' },
      ]}
      error={shop.error}
      onSelectOption={(optionId) => {
        if (optionId === 'leave') onExit();
        else if (optionId === 'catalog') setCatalogOpen(true);
      }}
    />
  );
}

function TreasuryShelfWorkspace({
  items,
  contribution,
  buyingId,
  loading,
  error,
  onBuy,
  onBack,
}: {
  items: SectShopItemData[];
  contribution: number | undefined;
  buyingId: string | null;
  loading: boolean;
  error?: string;
  onBuy(item: SectShopItemData): Promise<void>;
  onBack(): void;
}) {
  return (
    <div className="min-h-[34rem] px-5 py-7 sm:px-8 md:px-10">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-current/10 pb-4">
        <div>
          <p className="text-ink-secondary text-sm">
            宗门宝库 · 已陈列 {items.length} 件
          </p>
          <p className="text-ink mt-1 text-sm">
            当前贡献：
            {contribution === undefined
              ? '读取中…'
              : contribution.toLocaleString('zh-CN')}
          </p>
        </div>
        <InkButton onClick={onBack}>合上库单</InkButton>
      </div>
      <div className="mt-5">
        <ItemExchangeShelf
          items={items}
          balance={contribution}
          currencyConcept="contribution"
          buyingId={buyingId}
          onBuy={(item) => void onBuy(item)}
          loading={loading}
          loadingText="宝库执事正在核验封签……"
          emptyText="宝库暂未陈列可兑换之物。"
        />
        {error ? (
          <p className="text-crimson mt-4 text-sm leading-7">{error}</p>
        ) : null}
      </div>
    </div>
  );
}
