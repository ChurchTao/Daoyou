import { ItemPreview } from '@app/components/feature/items/ItemPreview';
import { ItemPreviewView } from '@app/components/feature/items/ItemPreviewView';
import { itemPresentation } from '@app/components/feature/items/itemPresentation';
import type { ItemPreviewModel } from '@app/components/feature/items/presentation/types';
import { InkModal } from '@app/components/layout';
import { InkTag } from '@app/components/ui';
import { GameIcon } from '@app/components/ui/GameIcon';
import { tierColorMap } from '@app/components/ui/inkBadgeTiers';
import { SpiritStones } from '@app/components/ui/SpiritStones';
import { cn } from '@app/lib/cn';
import type { AuctionBuyOrderView } from '@daoyou/contracts/auction';
import {
  AUCTION_TYPE_NAMES,
  type AuctionMaterialCondition,
} from '@daoyou/game-domain/auction';
import {
  MATERIAL_TYPE_NAMES,
  type MaterialType,
} from '@daoyou/game-domain/inventory';
import { useState, type ReactNode } from 'react';

type Actions = (order: AuctionBuyOrderView, close: () => void) => ReactNode;

const MATERIAL_TYPE_ICONS: Record<MaterialType, string> = {
  seed: '🌱',
  herb: '🌿',
  ore: '🪨',
  tcdb: '💎',
  aux: '🧵',
  monster: '🦴',
  gongfa_manual: '📚',
  skill_manual: '📖',
};

function elementLabel(element: AuctionMaterialCondition['element']) {
  if (element === 'any') return '不限';
  if (element === 'none') return '无属性';
  return `${element}属性`;
}

function timeLeft(expiresAt: string, now: number) {
  const minutes = Math.max(
    0,
    Math.ceil((new Date(expiresAt).getTime() - now) / 60000),
  );
  if (minutes === 0) return '已过期';
  const hours = Math.floor(minutes / 60);
  return hours > 0
    ? `剩余 ${hours}时${minutes % 60}分`
    : `剩余 ${minutes}分`;
}

function statusTag(order: AuctionBuyOrderView, ownerId?: string) {
  if (order.buyerId === ownerId)
    return { label: '我的', tone: 'neutral' as const };
  if (order.supplyableQuantity > 0)
    return { label: '可供', tone: 'good' as const };
  return null;
}

function conditionPreviewModel(
  order: Extract<AuctionBuyOrderView, { targetMode: 'condition' }>,
): ItemPreviewModel {
  const { condition } = order;
  return {
    title: order.itemName,
    icon: condition.type ? MATERIAL_TYPE_ICONS[condition.type] : '🧺',
    titleColor: tierColorMap[condition.quality],
    header: [
      { kind: 'status', value: '条件收购' },
      { kind: 'quantity', label: '剩余', value: order.remainingQuantity },
    ],
    sections: [
      {
        title: '收购条件',
        entries: [
          { kind: 'line', label: '品质', value: condition.quality },
          {
            kind: 'line',
            label: '类型',
            value: condition.type
              ? MATERIAL_TYPE_NAMES[condition.type]
              : '不限',
          },
          {
            kind: 'line',
            label: '五行',
            value: elementLabel(condition.element),
          },
        ],
      },
    ],
    description: '背包中符合条件、名称与描述不限的材料均可供货。',
  };
}

function OrderCard({
  order,
  ownerId,
  now,
  actions,
}: {
  order: AuctionBuyOrderView;
  ownerId?: string;
  now: number;
  actions: Actions;
}) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const status = statusTag(order, ownerId);
  const summary =
    order.targetMode === 'exact'
      ? itemPresentation({
          ...order.item,
          quantity: order.remainingQuantity,
        })
      : null;
  const condition = order.targetMode === 'condition' ? order.condition : null;
  const title = condition
    ? condition.type
      ? MATERIAL_TYPE_NAMES[condition.type]
      : '任意材料'
    : order.itemName;
  const color = condition
    ? tierColorMap[condition.quality]
    : (summary?.color ?? '');
  const icon = condition
    ? condition.type
      ? MATERIAL_TYPE_ICONS[condition.type]
      : '🧺'
    : (summary?.icon ?? '❔');
  const detail = condition
    ? `品质 ${condition.quality} · 五行 ${elementLabel(condition.element)}`
    : `品质 ${order.itemQuality} · ${AUCTION_TYPE_NAMES[order.itemType]}`;
  const expired = timeLeft(order.expiresAt, now) === '已过期';

  return (
    <>
      <button
        type="button"
        aria-label={`查看收购单：${order.itemName}`}
        onClick={() => setOpen(true)}
        className="bg-paper border-ink/20 hover:border-crimson/50 focus-visible:outline-crimson flex w-full min-w-0 items-center gap-4 border p-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <span
          aria-hidden="true"
          className="border-ink/20 bg-bgpaper flex size-14 shrink-0 items-center justify-center rounded-sm border text-3xl"
        >
          <GameIcon value={icon} purpose="artwork" />
        </span>
        <span className="min-w-0 flex-1 space-y-1 text-sm">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span
              className={cn(
                'min-w-0 truncate text-base font-semibold',
                color,
              )}
            >
              {title}
            </span>
            <InkTag tone="info">
              {order.targetMode === 'exact' ? '同款' : '条件'}
            </InkTag>
            {status ? <InkTag tone={status.tone}>{status.label}</InkTag> : null}
          </span>
          <span className="text-ink-secondary block">{detail}</span>
          <span className="text-ink-secondary flex flex-wrap gap-x-3">
            <span>求购者 {order.buyerName}</span>
            <span>
              已收{' '}
              <span className="font-mono">
                {order.initialQuantity - order.remainingQuantity}
              </span>{' '}
              / {order.initialQuantity} 件
            </span>
          </span>
          <span
            className={cn('block', expired ? 'text-crimson' : 'text-ink-secondary')}
          >
            {timeLeft(order.expiresAt, now)}
          </span>
        </span>
        <span className="shrink-0 text-right">
          <SpiritStones amount={order.price} className="font-semibold" />
          <span className="text-ink-secondary block text-xs">单价／件</span>
        </span>
      </button>
      {open ? (
        <InkModal
          isOpen
          title="收购详情"
          className="max-w-xl"
          onClose={close}
        >
          {order.targetMode === 'condition' ? (
            <ItemPreviewView
              model={conditionPreviewModel(order)}
              close={close}
              actions={actions(order, close)}
            />
          ) : (
            <ItemPreview
              item={{
                ...order.item,
                quantity: order.remainingQuantity,
              }}
              quantityLabel="库存"
              close={close}
              actions={actions(order, close)}
            />
          )}
        </InkModal>
      ) : null}
    </>
  );
}

export function AuctionBuyOrders({
  orders,
  ownerId,
  now,
  actions,
}: {
  orders: AuctionBuyOrderView[];
  ownerId?: string;
  now: number;
  actions: Actions;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {orders.map((order) => (
        <OrderCard
          key={order.id}
          order={order}
          ownerId={ownerId}
          now={now}
          actions={actions}
        />
      ))}
    </div>
  );
}
