import { ConsumableDetailModal } from '@app/components/feature/consumables';
import {
  getProductShowcaseProps,
  toProductDisplayModel,
  type ProductRecordLike,
} from '@app/components/feature/products';
import { InkBadge } from '@app/components/ui/InkBadge';
import { ItemShowcaseModal } from '@app/components/ui/ItemShowcaseModal';
import type { CultivatorCondition } from '@shared/types/condition';
import type { RealmType } from '@shared/types/constants';
import type {
  Consumable,
  CultivationTechnique,
  Material,
  Skill,
} from '@shared/types/cultivator';
import { getMaterialTypeInfo } from '@shared/lib/gameConceptDisplay';
import type { ItemDetailPayload } from './itemDetailPayload';

interface ItemDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: ItemDetailPayload | null;
  viewerRealm?: RealmType;
  viewerCondition?: CultivatorCondition;
}

function QuantityInfo({ quantity }: { quantity: number }) {
  return (
    <div className="border-border/50 flex justify-between border-b pb-2">
      <span className="opacity-70">持有数量</span>
      <span className="font-bold">{quantity}</span>
    </div>
  );
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

  if (item.kind === 'consumable') {
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
  const typeInfo = getMaterialTypeInfo(material.type);
  const badges = [
    <InkBadge key="type" tier={material.rank}>
      {typeInfo.label}
    </InkBadge>,
  ];
  if (material.element) {
    badges.push(
      <InkBadge key="e" tone="default">
        {material.element}
      </InkBadge>,
    );
  }

  return (
    <ItemShowcaseModal
      isOpen
      onClose={onClose}
      icon={typeInfo.icon}
      name={material.name}
      badges={badges}
      extraInfo={<QuantityInfo quantity={material.quantity} />}
      description={material.description}
      descriptionTitle="物品说明"
    />
  );
}
