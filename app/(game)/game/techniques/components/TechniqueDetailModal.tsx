'use client';

import { AbilityDetailModal } from '@/components/feature/products';
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
  return (
    <AbilityDetailModal
      isOpen={isOpen}
      onClose={onClose}
      product={technique}
    />
  );
}
