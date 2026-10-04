import {
  toFateDisplayModel,
} from '@app/components/feature/fates/FateDisplayAdapter';
import { FateEffectList } from '@app/components/feature/fates/FateEffectList';
import { InkBadge, ItemShowcaseModal } from '@app/components/ui';
import type { PreHeavenFate } from '@daoyou/game-domain/character';

interface FateDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  fate: PreHeavenFate | null;
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
      metaSection={<FateEffectList groups={model.detailGroups} />}
      description={model.description}
      descriptionTitle="命格详述"
    />
  );
}
