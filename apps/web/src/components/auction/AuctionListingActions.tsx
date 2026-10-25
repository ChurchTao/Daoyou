import { InkButton, InkQuantityInput } from '@app/components/ui';
import { SpiritStones } from '@app/components/ui/SpiritStones';
import type { AuctionListingView } from '@daoyou/contracts/auction';
import {
  auctionPurchaseQuantityLimit,
  calculateAuctionSettlement,
  isAuctionBuyOrderKind,
} from '@daoyou/game-rules/auction';
import { canDeployBeast } from '@daoyou/game-rules/beasts/projection';
import { useState } from 'react';

export function AuctionListingActions({
  listing,
  ownerId,
  ownerLevel,
  now,
  pendingId,
  onBuy,
  onCancel,
  onWantSame,
  close,
}: {
  listing: AuctionListingView;
  ownerId?: string;
  ownerLevel: number;
  now: number;
  pendingId: string | null;
  onBuy: (listing: AuctionListingView, quantity: number) => Promise<boolean>;
  onCancel: (listing: AuctionListingView) => Promise<boolean>;
  onWantSame?: (listing: AuctionListingView) => void;
  close: () => void;
}) {
  const [quantity, setQuantity] = useState('1');
  const isOwner = listing.sellerId === ownerId;
  const isBeast = listing.itemType === 'beast';
  const maxQuantity = isBeast
    ? 1
    : auctionPurchaseQuantityLimit({
        definitionId: listing.item.definitionId,
        remainingQuantity: listing.remainingQuantity,
        unitPrice: listing.price,
      });
  const count = Number(quantity);
  const validQuantity =
    Number.isInteger(count) && count >= 1 && count <= maxQuantity;
  const total = validQuantity
    ? calculateAuctionSettlement(listing.price, count).grossAmount
    : null;
  const minutes = Math.max(
    0,
    Math.ceil((new Date(listing.expiresAt).getTime() - now) / 60000),
  );
  const expired = minutes === 0;
  return (
    <div className="space-y-3">
      <div className="text-ink-secondary space-y-1 text-xs">
        <p>
          卖家：{listing.sellerName}
          {isOwner ? '（我）' : ''}
        </p>
        <p>
          剩余时间：
          {expired
            ? '已过期'
            : `${Math.floor(minutes / 60)}时${minutes % 60}分`}
        </p>
        {listing.visibility === 'private' && (
          <p className="text-crimson">
            专属：
            {listing.targetCultivatorId === ownerId
              ? '指定给我'
              : listing.targetCultivatorName || '指定道友'}
          </p>
        )}
      </div>
      <p>
        单价 <SpiritStones amount={listing.price} />／{isBeast ? '只' : '件'}
      </p>
      {!isOwner && !isBeast && maxQuantity > 1 && (
        <div>
          <InkQuantityInput
            showLabel
            fullWidth
            label="购买数量"
            max={maxQuantity}
            value={quantity}
            onChange={setQuantity}
            disabled={!!pendingId}
          />
        </div>
      )}
      {!isOwner && (
        <p className="text-amber-800">
          合计{' '}
          {total === null ? '—' : <SpiritStones amount={total} />}
        </p>
      )}
      {isBeast && !isOwner && !canDeployBeast(listing.beast, ownerLevel) && (
        <p className="text-crimson text-sm">
          当前境界或灵兽寿命不满足出战条件，领取后暂不能出战。
        </p>
      )}
      <p className="text-ink-secondary text-xs">
        {isOwner
          ? '下架后通过邮件领回。'
          : isBeast
            ? '通过邮件领取，满仓时保留附件；领取后不自动携带或首发。'
            : '购入后通过邮件领取。'}
      </p>
      <InkButton
        variant={isOwner ? 'secondary' : 'primary'}
        disabled={!!pendingId || expired || (!isOwner && !validQuantity)}
        pending={pendingId === listing.id}
        pendingLabel="处理中……"
        onClick={async () => {
          const done = isOwner
            ? await onCancel(listing)
            : await onBuy(listing, count);
          if (done) close();
        }}
      >
        {isOwner ? '下架' : '购买'}
      </InkButton>
      {!isOwner &&
        !isBeast &&
        onWantSame &&
        isAuctionBuyOrderKind(listing.itemType) && (
          <InkButton
            disabled={!!pendingId || expired}
            onClick={() => {
              onWantSame(listing);
              close();
            }}
          >
            求购同款
          </InkButton>
        )}
    </div>
  );
}
