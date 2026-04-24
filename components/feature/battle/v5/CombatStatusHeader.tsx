'use client';

import { cn } from '@/lib/cn';
import type { UnitStateSnapshot } from '@/engine/battle-v5/systems/state/types';

interface UnitCardProps {
  unit: UnitStateSnapshot;
  isOpponent?: boolean;
  onShowDetails?: () => void;
}

/**
 * 单位状态卡片：展示名称、气血、灵力及 Buff
 */
function UnitCard({ unit, isOpponent, onShowDetails }: UnitCardProps) {
  // 计算紧凑属性
  const mainAtk = Math.max(unit.attrs.atk || 0, unit.attrs.magicAtk || 0);
  const critRate = Math.round((unit.attrs.critRate || 0) * 100);
  const evasionRate = Math.round((unit.attrs.evasionRate || 0) * 100);

  return (
    <div className={cn(
      "flex-1 p-3 border border-ink-secondary bg-white/30 rounded-sm relative",
      isOpponent && "text-right"
    )}>
      {/* 名称 */}
      <div className="font-heading text-lg border-b border-dashed border-ink-secondary mb-2 px-1">
        {unit.name}
      </div>

      {/* 气血与护盾条 */}
      {/* ... (existing code) ... */}
      <div className="mb-2">
        <div className="flex justify-between text-[10px] mb-0.5 px-1 opacity-80">
          <span>{isOpponent ? '' : '气血'}</span>
          <span className="font-mono">{unit.hp.current} / {unit.hp.max}{unit.shield > 0 ? ` (+${unit.shield})` : ''}</span>
          <span>{isOpponent ? '气血' : ''}</span>
        </div>
        <div className="h-1.5 bg-ink/5 overflow-hidden relative shadow-[inset_0_1px_2px_rgba(0,0,0,0.1)]">
          {/* 血条背景层 */}
          <div 
            className="h-full bg-crimson transition-all duration-500 ease-out relative z-10" 
            style={{ 
              width: `${unit.hp.percent}%`, 
              float: isOpponent ? 'right' : 'left' 
            }}
          />
          {/* 护盾条（金色半透明，覆盖在血条之上，并延伸） */}
          {unit.shield > 0 && (
            <div 
              className="absolute top-0 h-full bg-gold/80 z-20 transition-all duration-500 shadow-[0_0_4px_rgba(255,215,0,0.5)]"
              style={{ 
                width: `${Math.min(100, (unit.shield / unit.hp.max) * 100)}%`,
                [isOpponent ? 'right' : 'left']: isOpponent 
                  ? `${Math.max(0, 100 - unit.hp.percent - (unit.shield / unit.hp.max) * 100)}%`
                  : `${Math.max(0, unit.hp.percent - (unit.shield / unit.hp.max) * 100)}%`
              }}
            />
          )}
        </div>
      </div>

      {/* 灵力条 */}
      <div className="mb-2">
        <div className="flex justify-between text-[10px] mb-0.5 px-1 opacity-80">
          <span>{isOpponent ? '' : '灵力'}</span>
          <span className="font-mono">{unit.mp.current} / {unit.mp.max}</span>
          <span>{isOpponent ? '灵力' : ''}</span>
        </div>
        <div className="h-1.5 bg-ink/5 overflow-hidden shadow-[inset_0_1px_2px_rgba(0,0,0,0.1)]">
          <div 
            className="h-full bg-teal transition-all duration-500 ease-out" 
            style={{ 
              width: `${unit.mp.percent}%`, 
              float: isOpponent ? 'right' : 'left' 
            }}
          />
        </div>
      </div>

      {/* 紧凑型属性显示 */}
      <div 
        className={cn(
          "flex gap-2 text-[9px] mb-2 px-1 opacity-60 cursor-pointer hover:opacity-100 transition-opacity",
          isOpponent && "justify-end"
        )}
        onClick={onShowDetails}
        title="点击查看详细属性"
      >
        <span>攻 {mainAtk}</span>
        <span className="opacity-30">|</span>
        <span>暴 {critRate}%</span>
        <span className="opacity-30">|</span>
        <span>闪 {evasionRate}%</span>
      </div>


      {/* Buff 列表 */}
      <div className={cn("flex flex-wrap gap-1 mt-1 px-1", isOpponent && "justify-end")}>
        {unit.buffs.map((buff) => (
          <div 
            key={buff.id} 
            className={cn(
              "text-[10px] px-1 border border-ink/30 bg-paper/80 leading-tight",
              buff.type === 'debuff' ? "text-crimson border-crimson/30" : "text-teal border-teal/30"
            )}
            title={`${buff.name}${buff.layers > 1 ? ` x${buff.layers}` : ''} (${buff.remaining === -1 ? '永久' : `${buff.remaining}回合`})`}
          >
            {buff.name.substring(0, 1)}
            {buff.layers > 1 && <span className="scale-75 inline-block">x{buff.layers}</span>}
          </div>
        ))}
        {unit.buffs.length === 0 && (
          <div className="text-[10px] text-ink/30 italic">无状态</div>
        )}
      </div>

      {/* 死亡阴影 */}
      {!unit.alive && (
        <div className="absolute inset-0 bg-ink/20 backdrop-grayscale flex items-center justify-center pointer-events-none">
          <span className="font-heading text-xl text-ink/60 border-2 border-ink/40 px-3 py-1 rotate-12">已败</span>
        </div>
      )}
    </div>
  );
}

/**
 * 战斗顶部状态栏：集成双方卡片
 */
export function CombatStatusHeader({ 
  player, 
  opponent,
  onShowPlayerDetails,
  onShowOpponentDetails
}: { 
  player: UnitStateSnapshot; 
  opponent: UnitStateSnapshot;
  onShowPlayerDetails?: () => void;
  onShowOpponentDetails?: () => void;
}) {
  return (
    <div className="flex justify-between gap-4 mb-4 select-none">
      <UnitCard unit={player} onShowDetails={onShowPlayerDetails} />
      <UnitCard unit={opponent} isOpponent onShowDetails={onShowOpponentDetails} />
    </div>
  );
}
