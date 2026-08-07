import { useMemo } from 'react';
import { AttributeType } from '@shared/engine/battle-v5/core/types';
import { buildLibrary5v5Roster } from '@shared/engine/battle-team';
import type { RosterUnitInfo } from '@shared/engine/battle-team';

const POSITION_LABEL: Record<string, string> = {
  front: '前排',
  back: '后排',
};

const SIDE_LABEL: Record<string, string> = {
  A: '甲队',
  B: '乙队',
};

/** 队伍主题色 */
const SIDE_THEME: Record<string, { border: string; title: string; chip: string }> = {
  A: {
    border: 'border-teal/25',
    title: 'text-teal',
    chip: 'text-teal bg-teal/8',
  },
  B: {
    border: 'border-crimson/25',
    title: 'text-crimson',
    chip: 'text-crimson bg-crimson/8',
  },
};

const KIND_LABEL: Record<string, string> = {
  aura: '光环',
  chance_trigger: '概率触发',
  conditional_response: '条件响应',
  active: '主动',
  pursuit: '追击',
  basic: '普攻',
};

/** 技能类型对应的色调 */
const KIND_TONE: Record<string, string> = {
  aura: 'text-teal',
  chance_trigger: 'text-wood',
  conditional_response: 'text-teal',
  active: 'text-crimson',
  pursuit: 'text-wood',
  basic: 'text-ink-secondary',
};

/** 六维基础属性的展示顺序与中文名 */
const ATTR_DISPLAY: Array<{ key: AttributeType; label: string }> = [
  { key: AttributeType.VITALITY, label: '体魄' },
  { key: AttributeType.STRENGTH, label: '力道' },
  { key: AttributeType.SPIRIT, label: '灵力' },
  { key: AttributeType.ENDURANCE, label: '根骨' },
  { key: AttributeType.SPEED, label: '身法' },
  { key: AttributeType.WILLPOWER, label: '神识' },
];

function RosterCard({ unit }: { unit: RosterUnitInfo }) {
  const theme = SIDE_THEME[unit.side] ?? SIDE_THEME.A;

  return (
    <div className={`border ${theme.border} border-dashed bg-bgpaper/40 p-3`}>
      {/* 头部：名字 + 阵营/位置 */}
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold text-ink">{unit.name}</span>
        <span className={`px-1.5 text-[10px] ${theme.chip}`}>
          {SIDE_LABEL[unit.side]}·{POSITION_LABEL[unit.position]}
        </span>
      </div>

      {/* 气血上限 */}
      <div className="mb-2 flex items-center gap-1.5">
        <span className="text-ink-secondary text-[10px]">气血上限</span>
        <span className="text-crimson font-mono text-xs font-bold">{unit.maxHp}</span>
      </div>

      {/* 六维属性 */}
      <div className="mb-2.5 grid grid-cols-3 gap-x-2 gap-y-1">
        {ATTR_DISPLAY.map(({ key, label }) => {
          const val = unit.baseAttrs[key] ?? 0;
          return (
            <div key={key} className="flex items-center justify-between text-[10px]">
              <span className="text-ink-secondary">{label}</span>
              <span className="text-ink font-mono">{val}</span>
            </div>
          );
        })}
      </div>

      {/* 技能列表 */}
      <div className="space-y-1.5">
        {unit.abilities.length === 0 && (
          <div className="text-ink-secondary/60 px-2 py-1 text-[10px]">
            无特殊技能（仅普攻）
          </div>
        )}
        {unit.abilities.map((ability) => (
          <div key={ability.id} className="border-ink/10 border-dashed border bg-bgpaper/30 px-2 py-1.5">
            <div className="mb-0.5 flex items-center gap-1.5">
              <span className={`text-[9px] ${KIND_TONE[ability.kind] ?? KIND_TONE.basic}`}>
                {KIND_LABEL[ability.kind] ?? ability.kind}
              </span>
              <span className="text-wood text-xs font-semibold">{ability.name}</span>
            </div>
            {ability.description && (
              <p className="text-ink-secondary text-[10px] leading-relaxed">{ability.description}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

interface TeamBattleRosterProps {
  /** 是否显示，默认 true */
  visible?: boolean;
}

/**
 * 5v5 阵容展示面板。
 * 列出 10 个角色的属性与技能说明，按队伍分两列。
 * 静态数据，开战前即可查看。
 */
export function TeamBattleRoster({ visible = true }: TeamBattleRosterProps) {
  const roster = useMemo(() => buildLibrary5v5Roster(), []);

  if (!visible) return null;

  const teamA = roster.filter((u) => u.side === 'A');
  const teamB = roster.filter((u) => u.side === 'B');

  return (
    <div className="border-ink/15 border-dashed border bg-bgpaper/30 p-4">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-crimson font-heading text-lg">阵容一览</h2>
        <span className="text-ink-secondary text-[11px]">十位角色 · 六维属性 · 技能说明</span>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="text-teal text-xs font-bold">甲队 · 续航连携流</span>
            <span className="text-ink-secondary/60 text-[10px]">二前三后</span>
          </div>
          <div className="space-y-2">
            {teamA.map((u) => (
              <RosterCard key={u.id} unit={u} />
            ))}
          </div>
        </div>
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="text-crimson text-xs font-bold">乙队 · 物理爆发流</span>
            <span className="text-ink-secondary/60 text-[10px]">三前二后</span>
          </div>
          <div className="space-y-2">
            {teamB.map((u) => (
              <RosterCard key={u.id} unit={u} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
