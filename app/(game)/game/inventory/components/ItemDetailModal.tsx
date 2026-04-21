'use client';

import { ItemShowcaseModal } from '@/components/ui/ItemShowcaseModal';
import { InkBadge } from '@/components/ui/InkBadge';
import type {
  Artifact,
  Consumable,
  CultivationTechnique,
  Material,
  Skill,
} from '@/types/cultivator';
import {
  CONSUMABLE_TYPE_DISPLAY_MAP,
  getEquipmentSlotInfo,
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
    const slotInfo = getEquipmentSlotInfo(item.slot);
    const extraInfo = item.required_realm ? (
      <div className="border-ink/50 flex justify-between border-b pb-2">
        <span className="opacity-70">境界要求</span>
        <span>{item.required_realm}</span>
      </div>
    ) : null;

    return (
      <ItemShowcaseModal
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
        description={item.description}
        descriptionTitle="法宝说明"
      />
    );
  }

  // 功法（有 required_realm，无 slot）
  if ('required_realm' in item && !('slot' in item)) {
    const technique = item as CultivationTechnique;
    return (
      <ItemShowcaseModal
        isOpen
        onClose={onClose}
        icon="📘"
        name={technique.name}
        badges={[
          technique.grade && (
            <InkBadge key="g" tier={technique.grade}>
              功法
            </InkBadge>
          ),
        ].filter(Boolean)}
        extraInfo={
          <div className="border-border/50 flex justify-between border-b pb-2">
            <span className="opacity-70">境界要求</span>
            <span>{technique.required_realm}</span>
          </div>
        }
        description={technique.description}
        descriptionTitle="功法详述"
      />
    );
  }

  // 神通（有 cost、cooldown 和 element）
  if ('cooldown' in item && 'element' in item && !('type' in item)) {
    const skill = item as Skill;
    return (
      <ItemShowcaseModal
        isOpen
        onClose={onClose}
        icon="📜"
        name={skill.name}
        badges={[
          skill.grade && (
            <InkBadge key="g" tier={skill.grade}>
              神通
            </InkBadge>
          ),
          <InkBadge key="e" tone="default">
            {skill.element}
          </InkBadge>,
        ].filter(Boolean)}
        extraInfo={
          <div className="space-y-2">
            <div className="border-border/50 flex justify-between border-b pb-2">
              <span className="opacity-70">灵力消耗</span>
              <span>{skill.cost ?? 0}</span>
            </div>
            <div className="border-border/50 flex justify-between border-b pb-2">
              <span className="opacity-70">冷却回合</span>
              <span>{skill.cooldown}</span>
            </div>
          </div>
        }
        description={skill.description}
        descriptionTitle="神通详述"
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
