'use client';

import {
  getProductShowcaseProps,
  toProductDisplayModel,
  type ProductRecordLike,
} from '@/components/feature/products';
import { InkBadge } from '@/components/ui/InkBadge';
import { ItemShowcaseModal } from '@/components/ui/ItemShowcaseModal';
import type {
  Artifact,
  Consumable,
  CultivationTechnique,
  Material,
  Skill,
} from '@/types/cultivator';
import {
  CONSUMABLE_TYPE_DISPLAY_MAP,
  getMaterialTypeInfo,
} from '@/types/dictionaries';

type InventoryItem = Artifact | Consumable | Material;
type DetailItem = InventoryItem | Skill | CultivationTechnique;

interface ItemDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: DetailItem | null;
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

  // 法宝（有 slot 属性）
  if ('slot' in item) {
    const artifactRecord = item as unknown as ProductRecordLike;
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

  // 神通（有 cost、cooldown 和 element）
  if ('cooldown' in item && 'element' in item && !('type' in item)) {
    const skill = item as Skill;
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

  // 功法（无 slot，无 cooldown）
  if (!('slot' in item) && !('cooldown' in item)) {
    const technique = item as CultivationTechnique;
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

  // 丹药/符箓（消耗品）
  if ('quality' in item && 'type' in item && 'quantity' in item) {
    const typeInfo = CONSUMABLE_TYPE_DISPLAY_MAP[item.type];
    return (
      <ItemShowcaseModal
        isOpen
        onClose={onClose}
        icon={typeInfo.icon}
        name={item.name}
        badges={[
          item.quality && (
            <InkBadge key="q" tier={item.quality}>
              {typeInfo.label}
            </InkBadge>
          ),
        ].filter(Boolean)}
        extraInfo={<QuantityInfo quantity={item.quantity} />}
        description={item.description}
        descriptionTitle="丹药详述"
      />
    );
  }

  // 材料
  const material = item as Material;
  const typeInfo = getMaterialTypeInfo(material.type);
  const badges = [
    <InkBadge key="r" tier={material.rank}>
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
