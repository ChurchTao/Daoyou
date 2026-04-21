'use client';

import { AbilityDetailModal } from '@/components/feature/products';
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
  return (
    <AbilityDetailModal isOpen={isOpen} onClose={onClose} product={skill} />
  );
}
