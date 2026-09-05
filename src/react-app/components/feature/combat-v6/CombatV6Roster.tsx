import { memo, useMemo } from 'react';
import type { CombatV6Unit } from './session';
type UnitProps = {
  u?: CombatV6Unit;
  label: string;
  controlled: boolean;
  selecting: boolean;
  targetable: boolean;
  selected: boolean;
  statusName?: string;
  onInspect: (id: string) => void;
  onPick: (id: string) => void;
};
const UnitRow = memo(function UnitRow({
  u,
  label,
  controlled,
  selecting,
  targetable,
  selected,
  statusName,
  onInspect,
  onPick,
}: UnitProps) {
  return u ? (
    <div
      className={`cv6-unit ${u.ownerId ? 'is-pet' : ''} ${controlled ? 'is-controlled' : ''} ${u.dead || u.escaped ? 'is-ended' : ''}`}
      key={u.id}
    >
      <button
        className="cv6-unit-name"
        onClick={() => onInspect(u.id)}
        aria-label={`查看${label}详情`}
      >
        {u.ownerId ? '↳ ' : ''}
        {u.name}
      </button>
      <button
        className={`cv6-unit-bars ${targetable ? 'is-target' : ''} ${selected ? 'is-selected' : ''}`}
        aria-label={`${label}${selecting ? (targetable ? '，选择目标' : '，不是合法目标') : '，查看详情'}`}
        aria-pressed={selected}
        onClick={() => (selecting ? onPick(u.id) : onInspect(u.id))}
      >
        <span
          className="cv6-hp"
          role="img"
          aria-label={`气血 ${u.hp}/${u.maxHp}，护盾 ${u.barriers.reduce((sum, b) => sum + b.current, 0)}`}
        >
          <span
            className="cv6-hp-fill"
            style={{ width: `${ratio(u.hp, u.maxHp)}%` }}
          />
          <span
            className="cv6-shield"
            style={{
              width: `${ratio(
                u.barriers.reduce((sum, b) => sum + b.current, 0),
                u.maxHp,
              )}%`,
            }}
          />
        </span>
        <span
          className="cv6-mp"
          role="img"
          aria-label={`法力 ${u.mp}/${u.maxMp}`}
        >
          <span style={{ width: `${ratio(u.mp, u.maxMp)}%` }} />
        </span>
        <span className="cv6-status">
          {u.dead
            ? '死亡'
            : u.downed
              ? '倒地'
              : u.escaped
                ? '离场'
                : u.statuses.length
                  ? `${u.statuses[0].name ?? statusName ?? '状态'}${u.statuses.length > 1 ? ` +${u.statuses.length - 1}` : ''}`
                  : '\u00a0'}
        </span>
      </button>
    </div>
  ) : (
    <div className="cv6-unit cv6-empty" aria-hidden="true" />
  );
});
function ratio(value: number, max: number) {
  return max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
}
export function CombatV6Roster({
  units,
  labels,
  controlledId,
  targetIds,
  selectedIds,
  onInspect,
  onPick,
}: {
  units: CombatV6Unit[];
  labels: Map<string, string>;
  controlledId?: string;
  targetIds?: string[];
  selectedIds: string[];
  onInspect: (id: string) => void;
  onPick: (id: string) => void;
}) {
  const rows = useMemo(() => {
    const mains = new Map<string, CombatV6Unit>();
    const pets = new Map<string, CombatV6Unit>();
    const slots = new Set<number>();
    for (const u of units) {
      if (u.ownerId) pets.set(u.ownerId, u);
      else {
        mains.set(`${u.side}:${u.slot}`, u);
        slots.add(u.slot);
      }
    }
    return [...slots]
      .sort((a, b) => a - b)
      .map((slot) => {
        const sides = [0, 1].map((side) => {
          const main = mains.get(`${side}:${slot}`);
          return { main, pet: main ? pets.get(main.id) : undefined };
        });
        return { slot, sides, hasPet: sides.some((s) => s.pet) };
      });
  }, [units]);
  const targets = new Set(targetIds);
  const selected = new Set(selectedIds);
  const renderUnit = (u?: CombatV6Unit) => (
    <UnitRow
      u={u}
      label={u ? (labels.get(u.id) ?? u.name) : ''}
      controlled={u?.id === controlledId}
      selecting={!!targetIds}
      targetable={!!u && targets.has(u.id)}
      selected={!!u && selected.has(u.id)}
      onInspect={onInspect}
      onPick={onPick}
    />
  );
  return (
    <>
      {[0, 1].map((side) => (
        <aside
          key={side}
          className={`cv6-roster cv6-side-${side}`}
          aria-label={side === 0 ? '我方' : '敌方'}
        >
          <h2>{side === 0 ? '我方' : '敌方'}</h2>
          <div className="cv6-lineup">
            {rows.map((row) => (
              <div className="cv6-pair" key={row.slot}>
                {renderUnit(row.sides[side].main)}
                {row.hasPet ? renderUnit(row.sides[side].pet) : null}
              </div>
            ))}
          </div>
        </aside>
      ))}
    </>
  );
}
