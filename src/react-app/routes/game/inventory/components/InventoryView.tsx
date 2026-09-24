import { VaultWithdrawalList } from '@app/components/feature/forging/VaultWithdrawal';
import { InventoryHeader } from '@app/components/feature/items/InventoryHeader';
import { InventoryItems } from '@app/components/feature/items/InventoryItems';
import { GameSceneFrame } from '@app/components/game-shell';
import { InkButton } from '@app/components/ui/InkButton';
import { InkDetailDrawer } from '@app/components/ui/InkDetailDrawer';
import { useInventoryBag } from '@app/lib/resources/bag';
import { BAG_CAPACITY } from '@shared/inventory';
import { useState, useSyncExternalStore } from 'react';

const compactQuery = '(max-width: 767px)';
function subscribeCompact(callback: () => void) {
  const query = window.matchMedia(compactQuery);
  query.addEventListener('change', callback);
  return () => query.removeEventListener('change', callback);
}
const readCompact = () => window.matchMedia(compactQuery).matches;
const readServerCompact = () => false;

function VaultBag() {
  const bag = useInventoryBag();
  return (
    <div className="space-y-3">
      <InventoryHeader
        capacity={
          <>
            {bag.data?.used ?? '—'} / {BAG_CAPACITY}
          </>
        }
      />
      {bag.error ? (
        <p role="alert">
          物品栏读取失败{' '}
          <InkButton onClick={() => bag.invalidate()}>重新读取</InkButton>
        </p>
      ) : null}
      {!bag.data && !bag.error ? <p role="status">正在读取储物袋……</p> : null}
      {bag.data ? (
        <InventoryItems items={bag.data.items} slotProps={() => ({})} />
      ) : null}
    </div>
  );
}

export function InventoryView() {
  const compact = useSyncExternalStore(
    subscribeCompact,
    readCompact,
    readServerCompact,
  );
  const [bagOpen, setBagOpen] = useState(false);
  return (
    <GameSceneFrame variant="workflow">
      <div className="grid min-w-0 gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section aria-label="旧宝库">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-sm font-medium">宝库旧藏</h2>
            {compact ? (
              <InkButton onClick={() => setBagOpen(true)}>查看物品栏</InkButton>
            ) : null}
          </div>
          <VaultWithdrawalList
            onChanged={() => {
              if (compact) setBagOpen(true);
            }}
          />
        </section>
        {!compact ? (
          <aside
            aria-label="随身物品栏"
            className="min-w-0 self-start md:sticky md:top-4"
          >
            <VaultBag />
          </aside>
        ) : null}
      </div>
      {compact ? (
        <InkDetailDrawer
          isOpen={bagOpen}
          title="随身物品"
          onClose={() => setBagOpen(false)}
          size="sm"
        >
          {bagOpen ? <VaultBag /> : null}
        </InkDetailDrawer>
      ) : null}
    </GameSceneFrame>
  );
}
