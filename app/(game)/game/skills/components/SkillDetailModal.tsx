'use client';

import { ItemShowcaseModal } from '@/components/ui/ItemShowcaseModal';
import { getProductShowcaseProps } from '@/components/feature/products';
import type { V2Skill } from '../hooks/useSkillsViewModel';

interface SkillDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  skill: V2Skill | null;
}

export function SkillDetailModal({
  isOpen,
  onClose,
  skill,
}: SkillDetailModalProps) {
  if (!skill) return null;

  return (
    <ItemShowcaseModal
      isOpen={isOpen}
      onClose={onClose}
      {...getProductShowcaseProps(skill)}
    />
  );
}
