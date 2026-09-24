import { ConsumableDetailModal } from '@app/components/feature/consumables';
import {
  getProductShowcaseProps,
  toProductDisplayModel,
  type ProductRecordLike,
} from '@app/components/feature/products';
import { InkModal } from '@app/components/layout';
import { ItemShowcaseModal } from '@app/components/ui/ItemShowcaseModal';
import { seedFactsOf } from '@shared/items/definitions/seeds';
import type { CultivatorCondition } from '@shared/types/condition';
import type { RealmType } from '@shared/types/constants';
import type {
  Consumable,
  CultivationTechnique,
  Material,
  Skill,
} from '@shared/types/cultivator';
import type { ItemDetailPayload } from './itemDetailPayload';
import { ItemPreview } from './ItemPreview';

interface ItemDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: ItemDetailPayload | null;
  viewerRealm?: RealmType;
  viewerCondition?: CultivatorCondition;
}

export function ItemDetailModal({
  isOpen,
  onClose,
  item,
  viewerRealm,
  viewerCondition,
}: ItemDetailModalProps) {
  if (!item || !isOpen) return null;

  if (item.kind === 'artifact') {
    const artifactRecord = item.item as unknown as ProductRecordLike;
    const product = toProductDisplayModel({
      ...artifactRecord,
      productType: 'artifact',
    });

    return (
      <ItemShowcaseModal
        isOpen
        onClose={onClose}
        {...getProductShowcaseProps(product)}
      />
    );
  }

  if (item.kind === 'skill') {
    const skill = item.item as Skill;
    const product = toProductDisplayModel({
      ...skill,
      productType: 'skill',
    } as ProductRecordLike);

    return (
      <ItemShowcaseModal
        isOpen
        onClose={onClose}
        {...getProductShowcaseProps(product)}
      />
    );
  }

  if (item.kind === 'gongfa') {
    const technique = item.item as CultivationTechnique;
    const product = toProductDisplayModel({
      ...technique,
      productType: 'gongfa',
    } as ProductRecordLike);

    return (
      <ItemShowcaseModal
        isOpen
        onClose={onClose}
        {...getProductShowcaseProps(product)}
      />
    );
  }

  if (item.kind === 'consumable' || item.kind === 'inventory-consumable') {
    return (
      <ConsumableDetailModal
        isOpen
        onClose={onClose}
        consumable={item.item as Consumable}
        viewerRealm={viewerRealm}
        viewerCondition={viewerCondition}
      />
    );
  }

  const material = item.item as Material;
  return (
    <InkModal isOpen onClose={onClose}>
      <ItemPreview
        item={{
          name: material.name,
          quantity: material.quantity,
          definitionId: material.type === 'seed' ? 'seed.v1' : 'material.v1',
          instanceData:
            material.type === 'seed'
              ? seedFactsOf(material)
              : {
                  name: material.name,
                  type: material.type,
                  rank: material.rank,
                  element: material.element ?? null,
                  description: material.description ?? '',
                },
        }}
        close={onClose}
      />
    </InkModal>
  );
}
