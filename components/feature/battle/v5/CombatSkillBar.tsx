'use client';

import { cn } from '@/lib/cn';
import type { UnitStateSnapshot } from '@/engine/battle-v5/systems/state/types';

interface Props {
  unit: UnitStateSnapshot | null;
}

/**
 * 玩家技能监控栏 - 极简版
 * 展示技能名称、状态与冷却
 */
export function CombatSkillBar({ unit }: Props) {
  if (!unit || unit.cooldowns.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5 p-2.5 border border-ink/10 bg-white/20 rounded-sm mt-2">
      <div className="text-[9px] font-heading text-ink/30 uppercase tracking-widest px-0.5">
        可用技能 (Player Abilities)
      </div>
      
      <div className="flex flex-wrap gap-2">
        {unit.cooldowns.map((skill) => {
          const isOnCd = skill.current > 0;
          const isLowMp = unit.mp.current < skill.mpCost;
          
          return (
            <div 
              key={skill.skillId}
              className={cn(
                "px-2 py-0.5 text-xs border transition-colors flex items-center gap-1.5",
                isOnCd 
                  ? "text-ink/30 border-ink/5 bg-ink/5" 
                  : isLowMp 
                    ? "text-blue-600 border-blue-200 bg-blue-50/50" 
                    : "text-teal-700 border-teal-200 bg-teal-50/50 shadow-sm"
              )}
              title={isOnCd ? `冷却中: ${skill.current}/${skill.max}回合` : isLowMp ? '灵力不足' : '就绪'}
            >
              <span className="font-medium">{skill.skillName}</span>
              {isOnCd ? (
                <span className="font-mono text-[10px] bg-ink/10 px-1 rounded-full">{skill.current}</span>
              ) : skill.mpCost > 0 ? (
                <span className={cn(
                  "text-[9px] opacity-60",
                  isLowMp && "font-bold"
                )}>{skill.mpCost}</span>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
