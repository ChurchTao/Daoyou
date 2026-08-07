import { useMemo, useState } from 'react';
import type { TeamBattleRecord, TeamSide } from '@shared/engine/battle-team';

type StatMode = 'damage' | 'heal';

interface RoundAgg {
  round: number;
  damageA: number;
  damageB: number;
  healA: number;
  healB: number;
}

interface UnitAgg {
  unitId: string;
  name: string;
  side: TeamSide;
  damage: number;
  heal: number;
  damageTaken: number;
}

interface Aggregation {
  rounds: RoundAgg[];
  totals: { damageA: number; damageB: number; healA: number; healB: number };
  units: UnitAgg[];
  maxRound: number;
}

/** 聚合每回合伤害/治疗，以及每个单位的累计数据。 */
function aggregate(record: TeamBattleRecord): Aggregation {
  const teamAIds = new Set(record.participants.teamA.map((u) => u.id));
  const teamBIds = new Set(record.participants.teamB.map((u) => u.id));
  const maxRound = Math.max(1, record.outcome.turns);

  const rounds: RoundAgg[] = [];
  for (let r = 1; r <= maxRound; r++) {
    rounds.push({ round: r, damageA: 0, damageB: 0, healA: 0, healB: 0 });
  }

  const unitMap = new Map<string, UnitAgg>();
  const ensureUnit = (id: string, name: string, side: TeamSide) => {
    let u = unitMap.get(id);
    if (!u) {
      u = { unitId: id, name, side, damage: 0, heal: 0, damageTaken: 0 };
      unitMap.set(id, u);
    }
    return u;
  };
  for (const p of record.participants.teamA) ensureUnit(p.id, p.name, 'A');
  for (const p of record.participants.teamB) ensureUnit(p.id, p.name, 'B');

  const sideOf = (id: string): TeamSide | null =>
    teamAIds.has(id) ? 'A' : teamBIds.has(id) ? 'B' : null;

  for (const ev of record.events) {
    if (ev.round < 1 || ev.round > maxRound) continue;
    const agg = rounds[ev.round - 1];
    if (ev.kind === 'damage') {
      const side = sideOf(ev.actorId);
      if (side === 'A') agg.damageA += ev.amount;
      else if (side === 'B') agg.damageB += ev.amount;
      const actor = unitMap.get(ev.actorId);
      if (actor) actor.damage += ev.amount;
      const target = unitMap.get(ev.targetId);
      if (target) target.damageTaken += ev.amount;
    } else if (ev.kind === 'heal') {
      const side = sideOf(ev.actorId);
      if (side === 'A') agg.healA += ev.amount;
      else if (side === 'B') agg.healB += ev.amount;
      const actor = unitMap.get(ev.actorId);
      if (actor) actor.heal += ev.amount;
    }
  }

  const totals = {
    damageA: rounds.reduce((s, r) => s + r.damageA, 0),
    damageB: rounds.reduce((s, r) => s + r.damageB, 0),
    healA: rounds.reduce((s, r) => s + r.healA, 0),
    healB: rounds.reduce((s, r) => s + r.healB, 0),
  };

  const units = [...unitMap.values()].sort((a, b) => {
    if (a.side !== b.side) return a.side === 'A' ? -1 : 1;
    return b.damage - a.damage;
  });

  return { rounds, totals, units, maxRound };
}

/** 将数值向上取整到 1/2/5 × 10^n 的刻度，便于坐标轴分度。 */
function niceCeil(v: number): number {
  if (v <= 0) return 100;
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  const norm = v / mag;
  let nice: number;
  if (norm <= 1) nice = 1;
  else if (norm <= 2) nice = 2;
  else if (norm <= 5) nice = 5;
  else nice = 10;
  return nice * mag;
}

const MODE_LABEL: Record<StatMode, string> = {
  damage: '伤害输出',
  heal: '治疗量',
};

interface StatChartProps {
  rounds: RoundAgg[];
  mode: StatMode;
  maxRound: number;
}

function StatChart({ rounds, mode, maxRound }: StatChartProps) {
  const width = 760;
  const height = 300;
  const padL = 56;
  const padR = 20;
  const padT = 24;
  const padB = 38;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const aValues = rounds.map((r) => (mode === 'damage' ? r.damageA : r.healA));
  const bValues = rounds.map((r) => (mode === 'damage' ? r.damageB : r.healB));
  const rawMax = Math.max(1, ...aValues, ...bValues);
  const niceMax = niceCeil(rawMax);

  const xFor = (round: number) =>
    maxRound <= 1 ? padL + plotW / 2 : padL + ((round - 1) / (maxRound - 1)) * plotW;
  const yFor = (v: number) => padT + plotH - (v / niceMax) * plotH;

  const buildPath = (vals: number[]) =>
    vals
      .map((v, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i + 1).toFixed(1)} ${yFor(v).toFixed(1)}`)
      .join(' ');

  const aPath = buildPath(aValues);
  const bPath = buildPath(bValues);

  const yTickCount = 4;
  const yTicks = Array.from({ length: yTickCount + 1 }, (_, i) => (niceMax / yTickCount) * i);

  // X 轴标签步长：回合多时稀疏显示
  const xStep = maxRound <= 8 ? 1 : maxRound <= 16 ? 2 : Math.ceil(maxRound / 10);
  const xLabels = Array.from({ length: maxRound }, (_, i) => i + 1).filter(
    (r) => r === 1 || r === maxRound || r % xStep === 0,
  );

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={`${MODE_LABEL[mode]}曲线图`}
    >
      {/* 网格线 + Y 轴刻度 */}
      {yTicks.map((t, i) => {
        const y = yFor(t);
        return (
          <g key={`y-${i}`}>
            <line
              x1={padL}
              y1={y}
              x2={width - padR}
              y2={y}
              stroke="rgba(44,24,16,0.12)"
              strokeWidth={1}
              strokeDasharray={i === 0 ? '0' : '3 3'}
            />
            <text
              x={padL - 8}
              y={y + 4}
              textAnchor="end"
              fontSize={11}
              fill="rgba(44,24,16,0.6)"
              fontFamily="monospace"
            >
              {Math.round(t)}
            </text>
          </g>
        );
      })}

      {/* X 轴刻度 */}
      {xLabels.map((r) => (
        <text
          key={`x-${r}`}
          x={xFor(r)}
          y={height - padB + 18}
          textAnchor="middle"
          fontSize={11}
          fill="rgba(44,24,16,0.6)"
          fontFamily="monospace"
        >
          {r}
        </text>
      ))}

      {/* 坐标轴 */}
      <line x1={padL} y1={padT} x2={padL} y2={padT + plotH} stroke="rgba(44,24,16,0.3)" strokeWidth={1} />
      <line
        x1={padL}
        y1={padT + plotH}
        x2={width - padR}
        y2={padT + plotH}
        stroke="rgba(44,24,16,0.3)"
        strokeWidth={1}
      />

      {/* 轴标题 */}
      <text x={padL + plotW / 2} y={height - 4} textAnchor="middle" fontSize={12} fill="#2c1810">
        回合
      </text>
      <text
        x={14}
        y={padT + plotH / 2}
        textAnchor="middle"
        fontSize={12}
        fill="#2c1810"
        transform={`rotate(-90 14 ${padT + plotH / 2})`}
      >
        {MODE_LABEL[mode]}
      </text>

      {/* 乙队曲线 */}
      <path d={bPath} fill="none" stroke="#4a7c59" strokeWidth={2} strokeLinejoin="round" />
      {bValues.map((v, i) => (
        <circle key={`bd-${i}`} cx={xFor(i + 1)} cy={yFor(v)} r={2.5} fill="#4a7c59" />
      ))}

      {/* 甲队曲线 */}
      <path d={aPath} fill="none" stroke="#c1121f" strokeWidth={2} strokeLinejoin="round" />
      {aValues.map((v, i) => (
        <circle key={`ad-${i}`} cx={xFor(i + 1)} cy={yFor(v)} r={2.5} fill="#c1121f" />
      ))}
    </svg>
  );
}

interface TeamBattleStatsProps {
  record: TeamBattleRecord;
}

export function TeamBattleStats({ record }: TeamBattleStatsProps) {
  const [mode, setMode] = useState<StatMode>('damage');
  const agg = useMemo(() => aggregate(record), [record]);

  if (agg.maxRound <= 0) return null;

  const totals = agg.totals;
  const summaryCards =
    mode === 'damage'
      ? [
          { side: 'A' as TeamSide, label: '甲队总伤害', value: totals.damageA, color: 'text-crimson' },
          { side: 'B' as TeamSide, label: '乙队总伤害', value: totals.damageB, color: 'text-teal' },
        ]
      : [
          { side: 'A' as TeamSide, label: '甲队总治疗', value: totals.healA, color: 'text-crimson' },
          { side: 'B' as TeamSide, label: '乙队总治疗', value: totals.healB, color: 'text-teal' },
        ];

  return (
    <div className="border-ink/15 border-dashed border bg-bgpaper/40 space-y-4 p-4">
      {/* 标题 + 模式切换 */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-crimson font-heading text-lg">战后统计</h2>
          <span className="text-ink-secondary text-[11px]">
            共 {agg.maxRound} 回合 · {agg.units.length} 位角色
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-ink-secondary text-[11px]">纵轴</span>
          <div className="flex items-center gap-1">
            {(['damage', 'heal'] as StatMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={[
                  'px-2 py-0.5 text-xs',
                  mode === m
                    ? 'text-crimson border-b border-crimson font-semibold'
                    : 'text-ink-secondary hover:text-ink border-b border-transparent',
                ].join(' ')}
              >
                {MODE_LABEL[m]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 图例 */}
      <div className="flex items-center gap-4 text-xs">
        <span className="flex items-center gap-1.5">
          <span className="bg-crimson inline-block h-0.5 w-4" />
          <span className="text-ink">甲队</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="bg-teal inline-block h-0.5 w-4" />
          <span className="text-ink">乙队</span>
        </span>
      </div>

      {/* 曲线图 */}
      <div className="border-ink/10 border bg-paper/60 p-2">
        <StatChart rounds={agg.rounds} mode={mode} maxRound={agg.maxRound} />
      </div>

      {/* 汇总卡片 */}
      <div className="grid grid-cols-2 gap-3">
        {summaryCards.map((c) => (
          <div key={c.side} className="border-ink/15 border-dashed border bg-paper/60 p-3 text-center">
            <div className="text-ink-secondary text-[11px]">{c.label}</div>
            <div className={`font-mono text-xl font-semibold ${c.color}`}>{Math.round(c.value)}</div>
          </div>
        ))}
      </div>

      {/* 单位明细表 */}
      <div>
        <h3 className="text-ink-secondary mb-2 text-[11px]">单位明细</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-ink-secondary border-ink/15 border-b border-dashed">
                <th className="px-2 py-1 font-medium">角色</th>
                <th className="px-2 py-1 font-medium">阵营</th>
                <th className="px-2 py-1 text-right font-medium">伤害输出</th>
                <th className="px-2 py-1 text-right font-medium">承受伤害</th>
                <th className="px-2 py-1 text-right font-medium">治疗量</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {agg.units.map((u) => (
                <tr key={u.unitId} className="border-ink/10 border-b">
                  <td className="text-ink px-2 py-1">{u.name}</td>
                  <td className={`px-2 py-1 ${u.side === 'A' ? 'text-crimson' : 'text-teal'}`}>
                    {u.side === 'A' ? '甲' : '乙'}
                  </td>
                  <td className="text-crimson px-2 py-1 text-right">{u.damage}</td>
                  <td className="text-ink-secondary px-2 py-1 text-right">{u.damageTaken}</td>
                  <td className="text-teal px-2 py-1 text-right">{u.heal}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
