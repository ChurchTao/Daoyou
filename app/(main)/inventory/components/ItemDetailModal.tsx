'use client';

import { InkModal } from '@/components/layout';
import { InkBadge, InkButton } from '@/components/ui';
import { getArtifactDisplayInfo } from '@/lib/utils/effectDisplay';
import type { Artifact, Consumable, Material } from '@/types/cultivator';
import {
  getEquipmentSlotInfo,
  getMaterialTypeInfo,
} from '@/types/dictionaries';

type InventoryItem = Artifact | Consumable | Material;

interface ItemDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: InventoryItem | null;
}

/**
 * 物品详情弹窗
 */
export function ItemDetailModal({
  isOpen,
  onClose,
  item,
}: ItemDetailModalProps) {
  if (!item) return null;

  return (
    <InkModal isOpen={isOpen} onClose={onClose} title="物品详情">
      <ItemDetailContent item={item} />
      <div className="pt-4 flex justify-end">
        <InkButton onClick={onClose} className="w-full">
          关闭
        </InkButton>
      </div>
    </InkModal>
  );
}

function ItemDetailContent({ item }: { item: InventoryItem }) {
  // 法宝（有 slot 属性）
  if ('slot' in item) {
    return <ArtifactDetail item={item as Artifact} />;
  }

  // 丹药（有 effect 数组但无 slot）
  if ('effect' in item) {
    return <ConsumableDetail item={item as Consumable} />;
  }

  // 材料
  return <MaterialDetail item={item as Material} />;
}

function ArtifactDetail({ item }: { item: Artifact }) {
  const slotInfo = getEquipmentSlotInfo(item.slot);
  const displayInfo = getArtifactDisplayInfo(item);

  return (
    <div className="space-y-2">
      <div className="flex flex-col items-center p-4 bg-muted/20 rounded-lg">
        <div className="text-4xl mb-2">{slotInfo.icon}</div>
        <h4 className="text-lg font-bold">{item.name}</h4>
        <div className="flex gap-2 mt-2">
          <InkBadge tier={item.quality}>{slotInfo.label}</InkBadge>
          <InkBadge tone="default">{item.element}</InkBadge>
        </div>
      </div>

      <div className="space-y-2 text-sm">
        {item.required_realm && (
          <div className="flex justify-between border-b border-ink/50 pb-2">
            <span className="opacity-70">境界要求</span>
            <span>{item.required_realm}</span>
          </div>
        )}

        {/* 属性加成 */}
        {displayInfo.statBonuses.length > 0 && (
          <div className="pt-2">
            <span className="block opacity-70 mb-1">属性加成</span>
            <div className="grid grid-cols-2 gap-2">
              {displayInfo.statBonuses.map((bonus, i) => (
                <div
                  key={i}
                  className="px-2 py-1 rounded border border-ink/10 bg-ink/5"
                >
                  {bonus.attribute}+{bonus.value}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 其他效果 */}
        {displayInfo.effects.length > 0 && (
          <div className="pt-2">
            <span className="block opacity-70 mb-1 font-bold text-ink">
              特殊效果
            </span>
            <ul className="list-disc list-inside space-y-1">
              {displayInfo.effects.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </div>
        )}

        {item.description && (
          <div className="pt-2">
            <span className="block opacity-70 mb-1">法宝说明</span>
            <p className="indent-4 leading-relaxed opacity-90">
              {item.description}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function ConsumableDetail({ item }: { item: Consumable }) {
  return (
    <div className="space-y-2">
      <div className="flex flex-col items-center p-4 bg-muted/20 rounded-lg">
        <div className="text-4xl mb-2">🌕</div>
        <h4 className="text-lg font-bold">{item.name}</h4>
        <div className="flex gap-2 mt-2">
          {item.quality && <InkBadge tier={item.quality}>{item.type}</InkBadge>}
        </div>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex justify-between border-b border-border/50 pb-2">
          <span className="opacity-70">持有数量</span>
          <span className="font-bold">{item.quantity}</span>
        </div>

        {item.description && (
          <div>
            <span className="block opacity-70 mb-1 font-bold text-ink">
              丹药详述
            </span>
            <p className="indent-4 leading-relaxed opacity-90">
              {item.description}
            </p>
          </div>
        )}

        {item.effect && item.effect.length > 0 && (
          <div>
            <span className="block opacity-70 mb-1 font-bold text-ink">
              药效
            </span>
            <ul className="list-disc list-inside space-y-1">
              {item.effect.map((e, i) => (
                <li key={i}>
                  {e.effect_type} + {e.bonus}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function MaterialDetail({ item }: { item: Material }) {
  const typeInfo = getMaterialTypeInfo(item.type);

  return (
    <div className="space-y-2">
      <div className="flex flex-col items-center p-4 bg-muted/20 rounded-lg">
        <div className="text-4xl mb-2">{typeInfo.icon}</div>
        <h4 className="text-lg font-bold">{item.name}</h4>
        <div className="flex gap-2 mt-2">
          <InkBadge tier={item.rank}>{typeInfo.label}</InkBadge>
          {item.element && <InkBadge tone="default">{item.element}</InkBadge>}
        </div>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex justify-between border-b border-border/50 pb-2">
          <span className="opacity-70">持有数量</span>
          <span className="font-bold">{item.quantity}</span>
        </div>

        {item.description && (
          <div className="pt-2">
            <span className="block opacity-70 mb-1">物品说明</span>
            <p className="indent-4 leading-relaxed opacity-90">
              {item.description}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
