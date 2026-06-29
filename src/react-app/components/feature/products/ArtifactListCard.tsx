import type { Artifact } from '@shared/types/cultivator';
import { getEquipmentSlotInfo } from '@shared/lib/gameConceptDisplay';
import type { ReactNode } from 'react';
import { AffixInlineList } from './AffixInlineList';
import {
  toProductDisplayModel,
  type ProductRecordLike,
} from './abilityDisplay';
import { ProductListRow } from './ProductListRow';

export interface ArtifactListCardProps {
  artifact: Artifact;
  equipped?: boolean;
  actions?: ReactNode;
  contextMeta?: ReactNode;
}

export function ArtifactListCard({
  artifact,
  equipped = false,
  actions,
  contextMeta,
}: ArtifactListCardProps) {
  const product = toProductDisplayModel({
    ...(artifact as ProductRecordLike),
    productType: 'artifact',
  });
  const slotInfo = getEquipmentSlotInfo(artifact.slot);

  return (
    <ProductListRow
      icon={slotInfo.icon}
      name={artifact.name}
      quality={artifact.quality}
      element={artifact.element}
      score={product.score}
      state={equipped ? 'active' : 'normal'}
      stateLabel={equipped ? '已装备' : undefined}
      meta={
        product.affixes.length > 0 || contextMeta ? (
          <div className="space-y-1">
            {product.affixes.length > 0 ? (
              <AffixInlineList affixes={product.affixes} />
            ) : null}
            {contextMeta}
          </div>
        ) : undefined
      }
      description={artifact.description}
      actions={actions}
    />
  );
}
