import { InkButton } from '@app/components/ui';
import { consumableFactsOf } from '@shared/items/definitions/consumables';
import { ItemSlot } from '../../items/ItemSlot';
import { useAlchemyCraftSession } from '../alchemyCraftContext';

export function FurnaceHarvestStage() {
  const session = useAlchemyCraftSession();
  const items = session.result.craftedConsumables;
  const total = items.reduce((sum, item) => sum + item.quantity, 0);
  return (
    <div className="space-y-3 text-sm" aria-live="polite">
      <div
        className="flex flex-wrap justify-center gap-2"
        aria-label="本炉副丹"
      >
        {items.slice(1).map((item, index) => (
          <ItemSlot
            key={`${item.id}-${index}`}
            className="w-20"
            badge="副丹"
            item={{
              definitionId: 'consumable.v1',
              name: item.name,
              quantity: item.quantity,
              instanceData: consumableFactsOf(item),
            }}
          />
        ))}
      </div>
      <p className="text-ink-secondary text-center text-xs">
        成丹 {total} 枚 · 已入物品栏，随身格位不足时存入储藏室
      </p>
      {session.result.formulaProgress ? (
        <p className="text-center text-xs">
          丹方熟练 +{session.result.formulaProgress.gainedExp} · Lv.
          {session.result.formulaProgress.level}
        </p>
      ) : null}
      {session.result.formulaDiscovery ? (
        <div className="border-ink/10 flex flex-wrap items-center justify-between gap-3 border-t pt-3">
          <span>发现丹方：{session.result.formulaDiscovery.name}</span>
          <div className="flex gap-3">
            <InkButton onClick={() => void session.resolveDiscovery(false)}>
              不保存
            </InkButton>
            <InkButton onClick={() => void session.resolveDiscovery(true)}>
              保存丹方
            </InkButton>
          </div>
        </div>
      ) : null}
      <div className="flex justify-center">
        <InkButton variant="primary" onClick={session.startNextBatch}>
          再炼一炉
        </InkButton>
      </div>
    </div>
  );
}
