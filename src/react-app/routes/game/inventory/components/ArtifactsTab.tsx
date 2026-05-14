import { InkBadge, InkButton, InkList, InkNotice } from '@app/components/ui';
import {
  AffixInlineList,
  toProductDisplayModel,
  type ProductRecordLike,
} from '@app/components/feature/products';
import { ItemCard } from '@app/components/ui/ItemCard';
import type { Artifact } from '@shared/types/cultivator';
import { getEquipmentSlotInfo } from '@shared/types/dictionaries';

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
                <AffixInlineList affixes={product.affixes} />
                <div className="text-ink-secondary flex flex-wrap gap-2 text-sm">
                  {equippedNow && (
                    <span className="text-ink font-medium">已装备</span>
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
