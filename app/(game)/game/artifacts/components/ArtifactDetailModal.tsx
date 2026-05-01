'use client';

import { getProductShowcaseProps } from '@/components/feature/products';
import { ItemShowcaseModal } from '@/components/ui/ItemShowcaseModal';
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
  if (!artifact) return null;

  return (
    <ItemShowcaseModal
      isOpen={isOpen}
      onClose={onClose}
      {...getProductShowcaseProps(artifact)}
    />
  );
}
