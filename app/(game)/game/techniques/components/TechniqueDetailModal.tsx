'use client';

import { AffixChip } from '@/components/feature/products';
import { ItemShowcaseModal } from '@/components/ui/ItemShowcaseModal';
import { InkBadge } from '@/components/ui/InkBadge';
import type { V2Technique } from '../hooks/useTechniquesViewModel';

export function TechniqueDetailModal({
  isOpen,
  onClose,
  technique,
}: {
  isOpen: boolean;
  onClose: () => void;
  technique: V2Technique | null;
}) {
  if (!technique) return null;

  return (
    <ItemShowcaseModal
      isOpen={isOpen}
      onClose={onClose}
      icon="📘"
      name={technique.name}
      badges={[
        technique.quality && (
          <InkBadge key="q" tier={technique.quality}>
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
      footer={
        technique.affixes.length > 0 ? (
          <div className="space-y-2 pt-2">
            <div className="text-ink-secondary text-xs font-semibold tracking-wide uppercase">
              词缀
            </div>
            <ul className="space-y-1.5">
              {technique.affixes.map((affix) => (
                <AffixChip key={affix.id} affix={affix} />
              ))}
            </ul>
          </div>
        ) : null
      }
    />
  );
}
