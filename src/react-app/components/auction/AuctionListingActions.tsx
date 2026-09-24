import { InkButton, InkInput } from '@app/components/ui';
import {
  AUCTION_MAX_PURCHASE_QUANTITY,
  AUCTION_MAX_TRANSACTION_TOTAL,
  calculateAuctionSettlement,
} from '@shared/config/auctionConfig';
import type { AuctionListingView } from '@shared/contracts/auction';
import { canDeployBeast } from '@shared/engine/combat-v6/beasts/projection';
import { useState } from 'react';

export function AuctionListingActions({
  listing,
  ownerId,
  ownerLevel,
  now,
  pendingId,
  onBuy,
  onCancel,
  close,
}: {
  listing: AuctionListingView;
  ownerId?: string;
  ownerLevel: number;
  now: number;
  pendingId: string | null;
  onBuy: (listing: AuctionListingView, quantity: number) => Promise<boolean>;
  onCancel: (listing: AuctionListingView) => Promise<boolean>;
  close: () => void;
}) {
  const [quantity, setQuantity] = useState('1');
  const isOwner = listing.sellerId === ownerId;
  const isBeast = listing.itemType === 'beast';
  const maxQuantity = Math.min(
    listing.remainingQuantity,
    AUCTION_MAX_PURCHASE_QUANTITY,
    Math.floor(AUCTION_MAX_TRANSACTION_TOTAL / listing.price),
  );
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
        单价 <span className="font-mono">{listing.price.toLocaleString()}</span>{' '}
        灵石／{isBeast ? '只' : '件'}
      </p>
      {!isOwner && !isBeast && maxQuantity > 1 && (
        <div className="flex items-end gap-2">
          <InkInput
            label="购买数量"
            type="number"
            min={1}
            max={maxQuantity}
            value={quantity}
            onChange={setQuantity}
            disabled={!!pendingId}
          />
          <InkButton
            disabled={!!pendingId}
            onClick={() => setQuantity(String(maxQuantity))}
          >
            最多
          </InkButton>
        </div>
      )}
      {!isOwner && (
        <p className="text-amber-800">
          合计{' '}
          <span className="font-mono font-semibold">
            {total?.toLocaleString() ?? '—'}
          </span>{' '}
          灵石
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
    </div>
  );
}
