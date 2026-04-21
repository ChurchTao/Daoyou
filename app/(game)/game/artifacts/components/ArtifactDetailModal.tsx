'use client';

import { AbilityDetailModal } from '@/components/feature/products';
import type { V2Artifact } from '../hooks/useArtifactsViewModel';

export function ArtifactDetailModal({
  isOpen,
  onClose,
  artifact,
}: {
  isOpen: boolean;
  onClose: () => void;
  artifact: V2Artifact | null;
}) {
  return (
    <AbilityDetailModal
      isOpen={isOpen}
      onClose={onClose}
      product={artifact}
    />
  );
}
