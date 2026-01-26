'use client';

import { EffectDetailModal } from '@/components/ui/EffectDetailModal';
import { InkBadge } from '@/components/ui/InkBadge';
import type { Artifact, Consumable, Material } from '@/types/cultivator';
import {
  CONSUMABLE_TYPE_DISPLAY_MAP,
  getEquipmentSlotInfo,
  getMaterialTypeInfo,
} from '@/types/dictionaries';

type InventoryItem = Artifact | Consumable | Material;

interface ItemDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: InventoryItem | null;
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
    const slotInfo = getEquipmentSlotInfo(item.slot);
    const extraInfo = item.required_realm ? (
      <div className="border-ink/50 flex justify-between border-b pb-2">
        <span className="opacity-70">境界要求</span>
        <span>{item.required_realm}</span>
      </div>
    ) : null;

    return (
      <EffectDetailModal
        isOpen
        onClose={onClose}
        icon={slotInfo.icon}
        name={item.name}
        badges={[
          item.quality && (
            <InkBadge key="q" tier={item.quality}>
              {slotInfo.label}
            </InkBadge>
          ),
          <InkBadge key="e" tone="default">
            {item.element}
          </InkBadge>,
        ].filter(Boolean)}
        extraInfo={extraInfo}
        effects={item.effects}
        description={item.description}
        effectTitle="法宝效果"
        descriptionTitle="法宝说明"
      />
    );
  }

  // 丹药/符箓（有 effects 数组但无 slot）
  if ('effects' in item) {
    const typeInfo = CONSUMABLE_TYPE_DISPLAY_MAP[item.type];
    return (
      <EffectDetailModal
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
        effects={item.effects}
        description={item.description}
        effectTitle="药效"
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
    <EffectDetailModal
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
