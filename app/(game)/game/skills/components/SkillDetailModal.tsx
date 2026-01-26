'use client';

import { EffectDetailModal } from '@/components/ui/EffectDetailModal';
import { InkBadge } from '@/components/ui/InkBadge';
import { getSkillDisplayInfo, getSkillElementInfo } from '@/lib/utils/effectDisplay';
import { StatusEffect } from '@/types/constants';
import type { Skill } from '@/types/cultivator';

interface SkillDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  skill: Skill | null;
  onShowEffectHelp?: (effectName: StatusEffect) => void;
}

/**
 * 神通详情弹窗
 */
export function SkillDetailModal({
  isOpen,
  onClose,
  skill,
  onShowEffectHelp,
}: SkillDetailModalProps) {
  if (!skill) return null;

  const displayInfo = getSkillDisplayInfo(skill);
  const { icon: skillIcon } = getSkillElementInfo(skill);

  // 神通威能信息
  const extraInfo = (
    <div className="pt-2">
      <span className="block opacity-70 mb-1">神通威能</span>
      <div className="grid grid-cols-2 gap-2">
        <div className="px-2 py-1 bg-ink/5 rounded">
          威力：{displayInfo.power}
        </div>
        <div className="px-2 py-1 bg-ink/5 rounded">
          冷却：{skill.cooldown} 回合
        </div>
        <div className="px-2 py-1 bg-ink/5 rounded">
          消耗：{skill.cost || 0} 灵力
        </div>
        <div className="px-2 py-1 bg-ink/5 rounded">
          目标：{skill.target_self ? '自身' : '敌方'}
        </div>
      </div>

      {/* 特殊效果 (Buff，可点击) */}
      {displayInfo.buffName && (
        <div className="pt-2">
          <span className="block opacity-70 mb-1 font-bold text-ink-primary">
            特殊效果 (点击可了解详情)
          </span>
          <div
            className="flex items-center gap-2 bg-paper-2 p-2 rounded cursor-pointer"
            onClick={() =>
              onShowEffectHelp?.(displayInfo.buffId! as StatusEffect)
            }
          >
            <span className="font-bold">{displayInfo.buffName}</span>
            {displayInfo.buffDuration && (
              <span className="text-xs text-ink-secondary">
                （持续 {displayInfo.buffDuration} 回合）
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <EffectDetailModal
      isOpen={isOpen}
      onClose={onClose}
      icon={skillIcon}
      name={skill.name}
      badges={[
        skill.grade && <InkBadge key="grade" tier={skill.grade}>{skill.grade}</InkBadge>,
        <InkBadge key="element" tone="default">{skill.element}</InkBadge>,
      ].filter(Boolean)}
      extraInfo={extraInfo}
      effects={skill.effects}
      description={skill.description}
      effectTitle="神通效果"
      descriptionTitle="神通说明"
    />
  );
}
