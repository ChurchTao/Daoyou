import {
  getTalismanActionHref,
  getTalismanActionLabel,
  isAttributeResetTalisman,
  isQiRestoreTalisman,
  isSectMeridianResetTalisman,
} from '@app/components/feature/consumables';
import { InkButton } from '@app/components/ui/InkButton';
import { InkQuantityInput } from '@app/components/ui/InkQuantityInput';
import type { InventoryView } from '@daoyou/contracts/inventory';
import { ConsumableFactsSchema } from '@daoyou/game-domain/inventory';
import { itemDefinition } from '@daoyou/game-rules/inventory';
import { useState } from 'react';
import { useNavigate } from 'react-router';

/** Bag and in-scene use share quantity controls and consumable eligibility. */
export function ConsumableUseActions({
  item,
  pending,
  onUse,
}: {
  item: InventoryView['items'][number];
  pending: boolean;
  onUse: (quantity: number) => void;
}) {
  const [quantity, setQuantity] = useState('1');
  const navigate = useNavigate();
  if (
    item.location !== 'bag' ||
    itemDefinition(item.definitionId).kind !== 'consumable'
  )
    return null;
  const consumable = {
    ...ConsumableFactsSchema.parse(item.instanceData),
    id: item.id,
    quantity: item.quantity,
  };
  const beastFood =
    consumable.spec.kind !== 'talisman' &&
    consumable.spec.operations.some(
      (operation) => operation.type === 'gain_beast_cultivation',
    );
  const actionHref = beastFood
    ? '/game/beasts'
    : getTalismanActionHref(consumable);
  const directUse =
    !beastFood &&
    (consumable.spec.kind !== 'talisman' ||
      isQiRestoreTalisman(consumable) ||
      isAttributeResetTalisman(consumable) ||
      isSectMeridianResetTalisman(consumable));
  const max = Math.min(item.quantity, 99);
  const amount = Number(quantity);
  return (
    <>
      {directUse && consumable.spec.kind === 'pill' && item.quantity > 1 ? (
        <InkQuantityInput
          label="服用数量"
          value={quantity}
          onChange={setQuantity}
          max={max}
          disabled={pending}
        />
      ) : null}
      {directUse ? (
        <InkButton
          disabled={
            pending ||
            (consumable.spec.kind === 'pill' &&
              (!Number.isInteger(amount) || amount < 1 || amount > max))
          }
          onClick={() => onUse(consumable.spec.kind === 'pill' ? amount : 1)}
        >
          {consumable.spec.kind === 'pill' ? '服用' : '使用'}
        </InkButton>
      ) : actionHref ? (
        <InkButton disabled={pending} onClick={() => navigate(actionHref)}>
          {beastFood
            ? '前往喂养灵兽'
            : (getTalismanActionLabel(consumable) ?? '前往使用')}
        </InkButton>
      ) : null}
    </>
  );
}
