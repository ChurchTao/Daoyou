import { apiFetch } from '@app/lib/api/fetch';
import { ItemExchangeShelf } from '@app/components/feature/item-shop/ItemExchangeShelf';
import {
  canonicalExchangeLines,
  exchangeSummary,
  HIGH_VALUE_EXCHANGE_CONFIRM_THRESHOLD,
  useExchangeCart,
} from '@app/components/feature/item-shop/useExchangeCart';
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
import type { SectShopCartBuyResponse } from '@daoyou/contracts/shops/sect';
import { STANDARD_SECT_PRESENTATION } from '@daoyou/game-rules/sect-organization';
import { useRef, useState } from 'react';
import {
  postJson,
  SectPermissionBoundary,
  SectScene,
} from '../components/SectScene';

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
  const items = shop.data?.items ?? [];
  const contribution = shop.data?.contribution;
  const { mutate } = useResourceMutation();
  const { openDialog, pushToast } = useInkUI();
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const attempt = useRef<{ key: string; requestId: string } | null>(null);
  const cart = useExchangeCart(items);

  const executeCheckout = async () => {
    const lines = cart.lines;
    const total = cart.total;
    if (busy.current || !lines.length) return;
    if (contribution === undefined || contribution < total) {
      pushToast({ message: '宗门贡献不足。', tone: 'warning' });
      return;
    }
    const itemsToBuy = canonicalExchangeLines(lines);
    const key = JSON.stringify({ expectedTotal: total, items: itemsToBuy });
    if (attempt.current?.key !== key)
      attempt.current = { key, requestId: crypto.randomUUID() };
    busy.current = true;
    setPending(true);
    try {
      const result = await mutate<SectShopCartBuyResponse>(
        apiFetch(
          '/api/sects/current/shop/buy',
          postJson(
            { expectedTotal: total, items: itemsToBuy },
            attempt.current.requestId,
          ),
        ),
      );
      attempt.current = null;
      cart.clear(lines.map((line) => line.id));
      pushToast({
        message: `${exchangeSummary(lines)}，存入${result.destinations.map((location) => (location === 'bag' ? '储物袋' : '洞府储藏室')).join('／')}。`,
        tone: 'success',
      });
    } catch (error) {
      pushToast({
        message: error instanceof Error ? error.message : '支取失败',
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
              将消耗：<span className="font-mono">{cart.total}</span> 宗门贡献
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

  if (catalogOpen)
    return (
      <TreasuryShelfWorkspace
        items={items}
        contribution={contribution}
        pending={pending}
        cart={cart}
        loading={shop.loading}
        error={shop.error}
        onCheckout={requestCheckout}
        onUnavailable={(message) => pushToast({ message, tone: 'warning' })}
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
  pending,
  cart,
  loading,
  error,
  onCheckout,
  onUnavailable,
  onBack,
}: {
  items: SectShopCartBuyResponse['purchasedItems'];
  contribution: number | undefined;
  pending: boolean;
  cart: ReturnType<typeof useExchangeCart>;
  loading: boolean;
  error?: string;
  onCheckout(): void;
  onUnavailable(message: string): void;
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
          pending={pending}
          cart={cart}
          onCheckout={onCheckout}
          onUnavailable={onUnavailable}
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
