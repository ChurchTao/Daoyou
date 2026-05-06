'use client';

import {
  getProductShowcaseProps,
  toProductDisplayModel,
  type ProductRecordLike,
} from '@/components/feature/products';
import { InkBadge } from '@/components/ui/InkBadge';
import { ItemShowcaseModal } from '@/components/ui/ItemShowcaseModal';
import type {
  Consumable,
  CultivationTechnique,
  Material,
  Skill,
} from '@/types/cultivator';
import {
  CONSUMABLE_TYPE_DISPLAY_MAP,
  getMaterialTypeInfo,
} from '@/types/dictionaries';
import type { ItemDetailPayload } from './itemDetailPayload';

interface ItemDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: ItemDetailPayload | null;
}

// 持有数量信息组件
function QuantityInfo({ quantity }: { quantity: number }) {
  return (
    <div className="border-border/50 flex justify-between border-b pb-2">
      <span className="opacity-70">持有数量</span>
      <span className="font-bold">{quantity}</span>
    </div>
  );
}

/**
 * 物品详情弹窗
 */
export function ItemDetailModal({
  isOpen,
  onClose,
  item,
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
    const consumable = item.item as Consumable;
    const typeInfo = CONSUMABLE_TYPE_DISPLAY_MAP[consumable.type];
    return (
      <ItemShowcaseModal
        isOpen
        onClose={onClose}
        icon={typeInfo.icon}
        name={consumable.name}
        badges={[
          consumable.quality ? (
            <InkBadge key="type" tier={consumable.quality}>
              {typeInfo.label}
            </InkBadge>
          ) : (
            <InkBadge key="type" tone="default">
              {typeInfo.label}
            </InkBadge>
          ),
        ].filter(Boolean)}
        extraInfo={<QuantityInfo quantity={consumable.quantity} />}
        description={consumable.description}
        descriptionTitle="丹药详述"
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
