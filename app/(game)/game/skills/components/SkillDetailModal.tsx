'use client';

import { AffixChip } from '@/components/feature/products';
import { ItemShowcaseModal } from '@/components/ui/ItemShowcaseModal';
import { InkBadge } from '@/components/ui/InkBadge';
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

  const mpCost = skill.projection?.mpCost ?? 0;
  const cooldown = skill.projection?.cooldown ?? 0;

  return (
    <ItemShowcaseModal
      isOpen={isOpen}
      onClose={onClose}
      icon="📜"
      name={skill.name}
      badges={[
        skill.quality && (
          <InkBadge key="q" tier={skill.quality}>
            神通
          </InkBadge>
        ),
        skill.element && (
          <InkBadge key="e" tone="default">
            {skill.element}
          </InkBadge>
        ),
      ].filter(Boolean)}
      extraInfo={
        <div className="space-y-2">
          <div className="border-border/50 flex justify-between border-b pb-2">
            <span className="opacity-70">灵力消耗</span>
            <span>{mpCost}</span>
          </div>
          <div className="border-border/50 flex justify-between border-b pb-2">
            <span className="opacity-70">冷却回合</span>
            <span>{cooldown}</span>
          </div>
        </div>
      }
      description={skill.description}
      descriptionTitle="神通详述"
      footer={
        skill.affixes.length > 0 ? (
          <div className="space-y-2 pt-2">
            <div className="text-ink-secondary text-xs font-semibold tracking-wide uppercase">
              词缀
            </div>
            <ul className="space-y-1.5">
              {skill.affixes.map((affix) => (
                <AffixChip key={affix.id} affix={affix} />
              ))}
            </ul>
          </div>
        ) : null
      }
    />
  );
}
