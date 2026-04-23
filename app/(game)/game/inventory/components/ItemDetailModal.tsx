'use client';

import {
  AffixChip,
  toProductDisplayModel,
  type ProductRecordLike,
} from '@/components/feature/products';
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
    const artifactRecord = item as unknown as ProductRecordLike;
    const slotInfo = getEquipmentSlotInfo(item.slot);
    const product = artifactRecord.productModel
      ? toProductDisplayModel(artifactRecord)
      : null;
    const artifactMetadata = (product?.rawModel &&
    product.rawModel.productType === 'artifact'
      ? product.rawModel.metadata
      : undefined) as
      | { creatorName?: string; anchorRealm?: string }
      | undefined;
    const extraRows: React.ReactNode[] = [];
    if (artifactMetadata?.anchorRealm) {
      extraRows.push(
        <div key="anchor-realm" className="border-ink/50 flex justify-between border-b pb-2">
          <span className="opacity-70">境界要求</span>
          <span>{artifactMetadata.anchorRealm}</span>
        </div>,
      );
    }
    if (artifactMetadata?.creatorName) {
      extraRows.push(
        <div key="creator" className="border-ink/50 flex justify-between border-b pb-2">
          <span className="opacity-70">打造者</span>
          <span>{artifactMetadata.creatorName}</span>
        </div>,
      );
    }
    const extraInfo = extraRows.length > 0 ? <>{extraRows}</> : null;

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
        footer={
          product && product.affixes.length > 0 ? (
            <div className="space-y-2 pt-2">
              <div className="text-ink-secondary text-xs font-semibold tracking-wide uppercase">
                词缀
              </div>
              <ul className="space-y-1.5">
                {product.affixes.map((affix) => (
                  <AffixChip key={affix.id} affix={affix} />
                ))}
              </ul>
            </div>
          ) : null
        }
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
          skill.quality && (
            <InkBadge key="g" tier={skill.quality}>
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
              <span className="opacity-70">法力消耗</span>
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

  // 功法（无 slot，无 cooldown）
  if (!('slot' in item) && !('cooldown' in item)) {
    const technique = item as CultivationTechnique;
    return (
      <ItemShowcaseModal
        isOpen
        onClose={onClose}
        icon="📘"
        name={technique.name}
        badges={[
          technique.quality && (
            <InkBadge key="g" tier={technique.quality}>
              功法
            </InkBadge>
          ),
          technique.element && (
            <InkBadge key="e" tone="default">
              {technique.element}
            </InkBadge>
          ),
        ].filter(Boolean)}
        description={technique.description}
        descriptionTitle="功法详述"
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
