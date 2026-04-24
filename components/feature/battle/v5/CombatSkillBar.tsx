'use client';

import { cn } from '@/lib/cn';
import type { UnitStateSnapshot } from '@/engine/battle-v5/systems/state/types';
import { format } from 'd3-format';

interface Props {
  unit: UnitStateSnapshot | null;
}

const fmtInt = format(',d');

export function CombatSkillBar({ unit }: Props) {
  if (!unit || unit.cooldowns.length === 0) return null;

  return (
    <div className="flex items-start gap-2 text-sm leading-6">
      <span className="text-battle-muted shrink-0">技能状态</span>
      <div className="min-w-0 flex flex-1 flex-wrap gap-x-2 gap-y-1">
        {unit.cooldowns.map((skill, index) => {
          const isOnCooldown = skill.current > 0;
          const isLowMp = unit.mp.current < skill.mpCost;
          const stateLabel = isOnCooldown
            ? `冷却 ${skill.current}`
            : isLowMp
              ? '灵力不足'
              : '可用';

          return (
            <span key={skill.skillId} className="contents">
              <span className="text-ink truncate max-w-full">{skill.skillName}</span>
              <span className="text-battle-muted">·</span>
              <span
                className={cn(
                  isOnCooldown
                    ? 'text-battle-muted'
                    : isLowMp
                      ? 'text-crimson'
                      : 'text-teal',
                )}
              >
                {stateLabel}
              </span>
              {skill.mpCost > 0 && (
                <>
                  <span className="text-battle-muted">·</span>
                  <span className="text-battle-muted">消耗 {fmtInt(skill.mpCost)}</span>
                </>
              )}
              {index < unit.cooldowns.length - 1 && (
                <span className="text-battle-muted">｜</span>
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}
