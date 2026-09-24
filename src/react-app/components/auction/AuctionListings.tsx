import { BeastTradeCard } from '@app/components/feature/beasts/BeastTradeCard';
import { BeastTradeDetails } from '@app/components/feature/beasts/BeastTradePreview';
import {
  InventoryGrid,
  ItemSlot,
} from '@app/components/feature/items/ItemSlot';
import { InkModal } from '@app/components/layout';
import { InkButton } from '@app/components/ui';
import type {
  AuctionAssetType,
  AuctionListingView,
} from '@shared/contracts/auction';
import { useState, type ReactNode } from 'react';

type Actions = (listing: AuctionListingView, close: () => void) => ReactNode;

function BeastListing({
  listing,
  actions,
}: {
  listing: Extract<AuctionListingView, { itemType: 'beast' }>;
  actions: Actions;
}) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <>
      <BeastTradeCard
        beast={listing.beast}
        price={listing.price}
        onClick={() => setOpen(true)}
      />
      {open && (
        <InkModal
          isOpen
          title="灵兽详情"
          onClose={close}
          footer={<InkButton onClick={close}>关闭</InkButton>}
        >
          <BeastTradeDetails beast={listing.beast} />
          <div className="border-ink/15 mt-4 border-t pt-4">
            {actions(listing, close)}
          </div>
        </InkModal>
      )}
    </>
  );
}

/** Market and personal listings share rendering and differ only in allowed actions. */
export function AuctionListings({
  listings,
  assetType,
  ownerId,
  actions,
}: {
  listings: AuctionListingView[];
  assetType: AuctionAssetType;
  ownerId?: string;
  actions: Actions;
}) {
  if (assetType === 'beast') {
    return (
      <div className="grid gap-3 md:grid-cols-2">
        {listings.map(
          (listing) =>
            listing.itemType === 'beast' && (
              <BeastListing
                key={listing.id}
                listing={listing}
                actions={actions}
              />
            ),
        )}
      </div>
    );
  }
  return (
    <InventoryGrid className="grid-cols-4 gap-x-2 gap-y-4 sm:grid-cols-6 lg:grid-cols-8">
      {listings.map(
        (listing) =>
          listing.itemType !== 'beast' && (
            <div key={listing.id} className="min-w-0">
              <ItemSlot
                className="w-full"
                item={{ ...listing.item, quantity: listing.remainingQuantity }}
                quantityLabel="库存"
                badge={
                  listing.sellerId === ownerId
                    ? '我的'
                    : listing.visibility === 'private'
                      ? '专属'
                      : undefined
                }
              >
                {(close) => actions(listing, close)}
              </ItemSlot>
              <p
                className="mt-1 flex flex-wrap items-baseline justify-center gap-x-1 text-xs text-amber-800"
                aria-label={`单价 ${listing.price.toLocaleString()} 灵石`}
              >
                <span className="font-mono whitespace-nowrap">
                  {listing.price.toLocaleString()}
                </span>
                <span>灵石</span>
              </p>
            </div>
          ),
      )}
    </InventoryGrid>
  );
}
