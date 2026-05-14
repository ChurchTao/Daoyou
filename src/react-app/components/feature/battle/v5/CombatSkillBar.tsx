import { cn } from '@shared/lib/cn';
import type { UnitStateSnapshot } from '@shared/engine/battle-v5/systems/state/types';
import { format } from 'd3-format';

interface Props {
  unit: UnitStateSnapshot | null;
}

const fmtInt = format(',d');

export function CombatSkillBar({ unit }: Props) {
  if (!unit || unit.cooldowns.length === 0) return null;

  return (
    <div className="space-y-2 text-sm leading-5">
      <div className="text-battle-muted">技能状态</div>
      <div className="grid grid-cols-2 gap-2">
        {unit.cooldowns.map((skill) => {
          const isOnCooldown = skill.current > 0;
          const isLowMp = unit.mp.current < skill.mpCost;
          const stateLabel = isOnCooldown
            ? `CD ${skill.current}`
            : isLowMp
              ? '缺灵'
              : '可用';
          const costLabel = skill.mpCost > 0 ? `耗 ${fmtInt(skill.mpCost)}` : '免耗';

          return (
            <div
              key={skill.skillId}
              className="bg-battle-faint grid min-w-0 grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-2 rounded-sm border border-battle-faint px-2 py-1.5"
            >
              <span className="text-ink min-w-0 truncate">{skill.skillName}</span>
              <span
                className={cn(
                  'shrink-0 rounded-sm border px-1.5 py-0.5 text-[11px] leading-none font-medium',
                  isOnCooldown
                    ? 'border-battle-faint bg-paper text-battle-muted'
                    : isLowMp
                      ? 'border-crimson/20 bg-crimson/5 text-crimson'
                      : 'border-teal/20 bg-teal/10 text-teal',
                )}
              >
                {stateLabel}
              </span>
              <span className="text-battle-muted shrink-0 text-[11px] leading-none tabular-nums">
                {costLabel}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
