'use client';

import { InkModal } from '@/components/layout';
import { InkBadge, InkButton } from '@/components/ui';
import { getSkillDisplayInfo } from '@/lib/utils/effectDisplay';
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

  return (
    <InkModal isOpen={isOpen} onClose={onClose}>
      <div className="space-y-2">
        {/* Header */}
        <div className="flex flex-col items-center p-4 bg-muted/20 rounded-lg">
          <div className="text-4xl mb-2">todo</div>
          <h4 className="text-lg font-bold">{skill.name}</h4>
          <div className="flex gap-2 mt-2">
            <InkBadge tier={skill.grade}>todo</InkBadge>
            <InkBadge tone="default">{skill.element}</InkBadge>
          </div>
        </div>

        {/* Details */}
        <div className="space-y-2 text-sm">
          <div className="pt-2">
            <span className="block opacity-70 mb-1">神通威能</span>
            <div className="grid grid-cols-2! gap-2">
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
          </div>

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

          <div className="pt-2">
            <span className="block opacity-70 mb-1">神通说明</span>
            <p className="indent-4 leading-relaxed opacity-90 p-2 bg-ink/5 rounded-lg border border-ink/10">
              {skill.description || '此神通玄妙异常，无可奉告。'}
            </p>
          </div>
        </div>

        <div className="pt-4 flex justify-end">
          <InkButton onClick={onClose} className="w-full">
            关闭
          </InkButton>
        </div>
      </div>
    </InkModal>
  );
}
