import { InkBadge } from '@app/components/ui';
import { ItemCard } from '@app/components/ui/ItemCard';
import type { Artifact } from '@shared/types/cultivator';
import { getEquipmentSlotInfo } from '@shared/lib/gameConceptDisplay';
import type { ReactNode } from 'react';
import { AffixInlineList } from './AffixInlineList';
import {
  toProductDisplayModel,
  type ProductRecordLike,
} from './abilityDisplay';

export interface ArtifactListCardProps {
  artifact: Artifact;
  equipped?: boolean;
  actions?: ReactNode;
}

export function ArtifactListCard({
  artifact,
  equipped = false,
  actions,
}: ArtifactListCardProps) {
  const product = toProductDisplayModel({
    ...(artifact as ProductRecordLike),
    productType: 'artifact',
  });
  const slotInfo = getEquipmentSlotInfo(artifact.slot);

  return (
    <ItemCard
      icon={slotInfo.icon}
      name={artifact.name}
      quality={artifact.quality}
      badgeExtra={
        <>
          <InkBadge tone="default">{artifact.element}</InkBadge>
          <InkBadge tone="default">{slotInfo.label}</InkBadge>
        </>
      }
      meta={
        <div className="space-y-1">
          <AffixInlineList affixes={product.affixes} />
          {equipped ? (
            <div className="text-ink-secondary flex flex-wrap gap-2 text-sm">
              <span className="text-ink font-medium">已装备</span>
            </div>
          ) : null}
        </div>
      }
      description={artifact.description}
      actions={actions}
      layout="col"
    />
  );
}
