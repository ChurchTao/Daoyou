import { InkModal } from '@app/components/layout';
import { consumableFactsOf } from '@daoyou/shared/items/definitions/consumables';
import type { CultivatorCondition } from '@daoyou/shared/types/condition';
import type { RealmType } from '@daoyou/shared/types/constants';
import type { Consumable } from '@daoyou/shared/types/cultivator';
import { ItemPreview } from '../items/ItemPreview';

interface ConsumableDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  consumable: Consumable;
  viewerRealm?: RealmType;
  viewerCondition?: CultivatorCondition;
}

export function ConsumableDetailModal({
  isOpen,
  onClose,
  consumable,
  viewerRealm,
  viewerCondition,
}: ConsumableDetailModalProps) {
  if (!isOpen) return null;
  return (
    <InkModal isOpen onClose={onClose}>
      <ItemPreview
        item={{
          name: consumable.name,
          quantity: consumable.quantity,
          definitionId: 'consumable.v1',
          instanceData: consumableFactsOf(consumable),
        }}
        options={{ realm: viewerRealm, condition: viewerCondition }}
        close={onClose}
      />
    </InkModal>
  );
}
