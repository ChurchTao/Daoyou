import type { TeamUnitSnapshot } from '@shared/engine/battle-team';

interface TeamUnitCardProps {
  unit: TeamUnitSnapshot;
  isActing: boolean;
  /** 紧凑模式（5v5 等多单位场景缩小卡片） */
  compact?: boolean;
}

const POSITION_LABEL: Record<string, string> = {
  front: '前排',
  back: '后排',
};

const SIDE_LABEL: Record<string, string> = {
  A: '甲',
  B: '乙',
};

/** 队伍边框色：A 队用青(teal)，B 队用朱(crimson) */
const SIDE_BORDER: Record<string, string> = {
  A: 'border-teal/35',
  B: 'border-crimson/35',
};

export function TeamUnitCard({ unit, isActing, compact = false }: TeamUnitCardProps) {
  const hpPercent = unit.maxHp > 0 ? (unit.currentHp / unit.maxHp) * 100 : 0;
  const shieldPercent = unit.maxHp > 0 ? (unit.shield / unit.maxHp) * 100 : 0;

  return (
    <div
      className={[
        compact ? 'w-32 border p-2' : 'w-44 border p-3',
        'relative bg-bgpaper/60 transition-all',
        SIDE_BORDER[unit.side] ?? 'border-ink/20',
        isActing ? 'ring-1 ring-crimson/50' : '',
        unit.alive ? 'opacity-100' : 'opacity-40',
      ].join(' ')}
    >
      {/* 名字 + 位置 */}
      <div className="mb-1.5 flex items-center justify-between">
        <span className={compact ? 'text-xs font-semibold text-ink' : 'text-sm font-semibold text-ink'}>
          {unit.name}
        </span>
        <span className="text-ink-secondary text-[10px]">
          {SIDE_LABEL[unit.side]}·{POSITION_LABEL[unit.position]}
        </span>
      </div>

      {/* 嘲讽标记 */}
      {unit.isTaunting && unit.alive && (
        <span className="text-wood absolute -right-1 -top-1.5 text-[10px] font-bold">
          「嘲」
        </span>
      )}

      {/* 蓄力标记 */}
      {unit.pendingCast && unit.alive && (
        <span className="text-gold absolute -left-1 -top-1.5 text-[10px] font-bold">
          「蓄」
        </span>
      )}

      {/* 血条 */}
      <div className={compact ? 'relative h-3 w-full overflow-hidden bg-ink/10' : 'relative h-4 w-full overflow-hidden bg-ink/10'}>
        <div
          className="bg-crimson h-full transition-all duration-300"
          style={{ width: `${hpPercent}%` }}
        />
        {/* 护盾覆盖 */}
        {shieldPercent > 0 && (
          <div
            className="bg-gold/60 absolute top-0 h-full"
            style={{ left: `${hpPercent}%`, width: `${Math.min(shieldPercent, 100 - hpPercent)}%` }}
          />
        )}
        {/* 血量数字 */}
        <span className="text-ink absolute inset-0 flex items-center justify-center text-[10px] font-mono">
          {Math.ceil(unit.currentHp)}/{unit.maxHp}
          {unit.shield > 0 && ` (+${Math.ceil(unit.shield)})`}
        </span>
      </div>

      {/* 光环标签 */}
      {unit.activeAuras.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {unit.activeAuras.map((aura) => (
            <span
              key={aura}
              className="text-wood bg-gold/10 px-1 text-[9px]"
            >
              {aura}
            </span>
          ))}
        </div>
      )}

      {/* 阵亡标记 */}
      {!unit.alive && (
        <div className="text-ink-secondary/60 absolute inset-0 flex items-center justify-center">
          <span className={compact ? 'text-base font-heading' : 'text-lg font-heading'}>阵亡</span>
        </div>
      )}
    </div>
  );
}
