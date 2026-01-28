'use client';

import { EffectDetailModal } from '@/components/ui/EffectDetailModal';
import { InkBadge } from '@/components/ui/InkBadge';
import { StatusEffect } from '@/types/constants';
import type { CultivationTechnique } from '@/types/cultivator';

interface TechniqueDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  technique: CultivationTechnique | null;
}

/**
 * 功法详情弹窗
 */
export function TechniqueDetailModal({
  isOpen,
  onClose,
  technique,
}: TechniqueDetailModalProps) {
  if (!technique) return null;

  // 功法额外信息
  const extraInfo = (
    <div className="pt-2">
      <span className="mb-1 block opacity-70">功法限制</span>
      <div className="flex gap-2">
        <div className="bg-ink/5 rounded px-2 py-1">
          境界需求：{technique.required_realm}
        </div>
      </div>
    </div>
  );

  return (
    <EffectDetailModal
      isOpen={isOpen}
      onClose={onClose}
      icon="📜"
      name={technique.name}
      badges={[
        technique.grade && <InkBadge key="grade" tier={technique.grade} />,
      ].filter(Boolean)}
      extraInfo={extraInfo}
      effects={technique.effects}
      description={technique.description}
      effectTitle="功法效果"
      descriptionTitle="功法说明"
    />
  );
}
