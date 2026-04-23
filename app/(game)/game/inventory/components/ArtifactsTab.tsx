'use client';

import { InkBadge, InkButton, InkList, InkNotice } from '@/components/ui';
import {
  toProductDisplayModel,
  type ProductRecordLike,
} from '@/components/feature/products';
import { ItemCard } from '@/components/ui/ItemCard';
import type { Artifact } from '@/types/cultivator';
import { getEquipmentSlotInfo } from '@/types/dictionaries';

interface ArtifactsTabProps {
  artifacts: Artifact[];
  isLoading?: boolean;
  equipped: {
    weapon?: string | null;
    armor?: string | null;
    accessory?: string | null;
  };
  pendingId: string | null;
  onShowDetails: (item: Artifact) => void;
  onEquipToggle: (item: Artifact) => void;
  onDiscard: (item: Artifact) => void;
}

/**
 * 法宝 Tab 组件
 */
export function ArtifactsTab({
  artifacts,
  isLoading = false,
  equipped,
  pendingId,
  onShowDetails,
  onEquipToggle,
  onDiscard,
}: ArtifactsTabProps) {
  if (isLoading) {
    return <InkNotice>正在检索法宝记录，请稍候……</InkNotice>;
  }

  if (artifacts.length === 0) {
    return <InkNotice>空空如也，道友快去寻宝吧！</InkNotice>;
  }

  return (
    <InkList>
      {artifacts.map((item) => {
        const product = toProductDisplayModel(item as ProductRecordLike);
        const affixLine = product.affixes.length > 0;
        const equippedNow = Boolean(
          item.id &&
          (equipped.weapon === item.id ||
            equipped.armor === item.id ||
            equipped.accessory === item.id),
        );

        const slotInfo = getEquipmentSlotInfo(item.slot);
        return (
          <ItemCard
            key={item.id ?? item.name}
            icon={slotInfo.icon}
            name={item.name}
            quality={item.quality}
            badgeExtra={
              <>
                <InkBadge tone="default">{item.element}</InkBadge>
                <InkBadge tone="default">{slotInfo.label}</InkBadge>
              </>
            }
            meta={
              <div className="space-y-1">
                {affixLine && (
                  <div className="flex flex-wrap items-center gap-1 text-sm">
                    <span className="text-ink-secondary">词缀：</span>
                    {product.affixes.map((affix) => {
                      const style =
                        affix.rarityTone === 'legendary'
                          ? { color: 'var(--color-tier-shen)' }
                          : affix.rarityTone === 'rare'
                            ? { color: 'var(--color-tier-xian)' }
                            : affix.rarityTone === 'info'
                              ? { color: 'var(--color-tier-di)' }
                              : { color: 'var(--color-tier-xuan)' };
                      return (
                        <span key={affix.id} style={style}>
                          {affix.isPerfect ? `极${affix.name}` : affix.name}
                        </span>
                      );
                    })}
                  </div>
                )}
                <div className="text-ink-secondary flex flex-wrap gap-2 text-xs">
                  {equippedNow && (
                    <span className="text-ink font-bold">已装备</span>
                  )}
                </div>
              </div>
            }
            description={item.description}
            actions={
              <div className="flex gap-2">
                <InkButton
                  variant="secondary"
                  onClick={() => onShowDetails(item)}
                >
                  详情
                </InkButton>
                <InkButton
                  disabled={pendingId === item.id}
                  onClick={() => onEquipToggle(item)}
                >
                  {pendingId === item.id
                    ? '操作中…'
                    : equippedNow
                      ? '卸下'
                      : '装备'}
                </InkButton>
                {!equippedNow && (
                  <InkButton
                    variant="primary"
                    className="px-2"
                    onClick={() => onDiscard(item)}
                  >
                    丢弃
                  </InkButton>
                )}
              </div>
            }
            layout="col"
          />
        );
      })}
    </InkList>
  );
}
