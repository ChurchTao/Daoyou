'use client';

import {
  toFateDisplayModel,
  type FateDisplayModel,
} from '@/components/feature/fates/FateDisplayAdapter';
import { FateEffectList } from '@/components/feature/fates/FateEffectList';
import { InkBadge, ItemShowcaseModal } from '@/components/ui';
import type { PreHeavenFate } from '@/types/cultivator';

interface FateDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  fate: PreHeavenFate | null;
}

function FateSummary({ model }: { model: FateDisplayModel }) {
  if (model.coreTags.length === 0) return null;

  return (
    <div className="flex flex-wrap justify-center gap-1.5">
      {model.coreTags.map((tag) => (
        <InkBadge key={tag} tone="default">
          {tag}
        </InkBadge>
      ))}
    </div>
  );
}

export function FateDetailModal({
  isOpen,
  onClose,
  fate,
}: FateDetailModalProps) {
  if (!fate) return null;

  const model = toFateDisplayModel(fate);

  return (
    <ItemShowcaseModal
      isOpen={isOpen}
      onClose={onClose}
      icon="🔮"
      name={model.name}
      badges={
        model.quality
          ? [<InkBadge key="quality" tier={model.quality} />]
          : undefined
      }
      summary={<FateSummary model={model} />}
      metaSection={<FateEffectList groups={model.detailGroups} />}
      description={model.description}
      descriptionTitle="命格详述"
    />
  );
}
