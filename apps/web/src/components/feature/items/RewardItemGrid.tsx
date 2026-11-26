import type { ItemGrant } from '@daoyou/game-domain/inventory';
import { rewardDisplayItem } from '@daoyou/game-rules/rewards/materials';
import { ItemSlot } from './ItemSlot';
import type { DisplayItem } from './itemPresentation';

export function RewardItemGrid({ grants }: { grants: readonly ItemGrant[] }) {
  const grouped = new Map<string, DisplayItem>();
  for (const grant of grants) {
    const key = JSON.stringify([grant.definitionId, grant.instanceData]);
    const item = grouped.get(key);
    if (item) item.quantity += grant.quantity;
    else grouped.set(key, rewardDisplayItem(grant));
  }

  return (
    <div className="flex flex-wrap gap-2">
      {[...grouped].map(([key, item]) => (
        <ItemSlot key={key} item={item} className="w-20" quantityLabel="奖励" />
      ))}
    </div>
  );
}
