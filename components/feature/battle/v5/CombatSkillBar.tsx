'use client';

import { cn } from '@/lib/cn';
import type { UnitStateSnapshot } from '@/engine/battle-v5/systems/state/types';

interface Props {
  unit: UnitStateSnapshot | null;
}

/**
 * 玩家技能监控栏
 */
export function CombatSkillBar({ unit }: Props) {
  if (!unit) return null;

  return (
    <div className="flex flex-col gap-2 p-3 border border-ink/20 bg-paper/50 rounded-sm">
      <div className="text-[10px] font-heading text-ink/40 uppercase tracking-wider px-1">
        技能监控 (Player Abilities)
      </div>
      
      <div className="flex flex-wrap gap-3">
        {unit.cooldowns.map((skill) => {
          const isOnCd = skill.current > 0;
          const isLowMp = unit.mp.current < skill.mpCost;
          
          return (
            <div 
              key={skill.skillId}
              className="group relative flex flex-col items-center gap-1"
            >
              {/* 技能图标容器 */}
              <div className={cn(
                "w-12 h-12 border-2 transition-all duration-300 flex items-center justify-center relative bg-paper",
                isOnCd ? "border-ink/20 grayscale" : "border-ink shadow-sm",
                isLowMp && !isOnCd && "border-blue-400 ring-1 ring-blue-400/30"
              )}>
                {/* 技能缩写或名称首字 */}
                <span className={cn(
                  "font-heading text-lg",
                  isOnCd ? "text-ink/30" : "text-ink"
                )}>
                  {skill.skillName.substring(0, 1)}
                </span>

                {/* CD 遮罩层 */}
                {isOnCd && (
                  <div className="absolute inset-0 bg-ink/60 flex items-center justify-center">
                    <span className="text-paper font-mono text-xl font-bold animate-pulse">
                      {skill.current}
                    </span>
                  </div>
                )}

                {/* 灵力不足标识 */}
                {isLowMp && !isOnCd && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full border border-paper shadow-sm" title="灵力不足" />
                )}
              </div>

              {/* 技能名称与消耗 */}
              <div className="text-[9px] text-center flex flex-col leading-none">
                <span className={cn("truncate w-12", isOnCd ? "text-ink/40" : "text-ink")}>
                  {skill.skillName}
                </span>
                {skill.mpCost > 0 && (
                  <span className={cn(
                    "font-mono mt-0.5",
                    isLowMp ? "text-blue-600 font-bold" : "text-ink/40"
                  )}>
                    {skill.mpCost}
                  </span>
                )}
              </div>

              {/* Tooltip (Hover) */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-ink text-paper text-[10px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                {skill.skillName} {skill.mpCost > 0 ? `(消耗: ${skill.mpCost}灵力)` : ''}
                {isOnCd && ` | 冷却中: ${skill.current}/${skill.max}回合`}
              </div>
            </div>
          );
        })}

        {unit.cooldowns.length === 0 && (
          <div className="text-[10px] text-ink/30 italic py-2 px-1">
            未装备主动技能
          </div>
        )}
      </div>
    </div>
  );
}
