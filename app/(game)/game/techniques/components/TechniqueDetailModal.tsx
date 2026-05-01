'use client';

import { getProductShowcaseProps } from '@/components/feature/products';
import { ItemShowcaseModal } from '@/components/ui/ItemShowcaseModal';
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
      {...getProductShowcaseProps(technique)}
    />
  );
}
