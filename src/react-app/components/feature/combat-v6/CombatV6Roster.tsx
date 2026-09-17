import { GameIcon } from '@app/components/ui/GameIcon';
import type { CombatV6UnitAppearance } from '@shared/contracts/combatV6';
import { memo, useMemo, type CSSProperties } from 'react';
import type { frameFeedback } from './presentation';
import type { CombatV6Unit } from './session';

type UnitProps = {
  u: CombatV6Unit;
  label: string;
  appearance?: CombatV6UnitAppearance;
  own: boolean;
  controlled: boolean;
  ready: boolean;
  feedback?: ReturnType<typeof frameFeedback>;
  selecting: boolean;
  targetable: boolean;
  selected: boolean;
  onInspect: (id: string) => void;
  onPick: (id: string) => void;
};
const UnitRow = memo(function UnitRow({
  u,
  label,
  appearance,
  own,
  controlled,
  ready,
  feedback,
  selecting,
  targetable,
  selected,
  onInspect,
  onPick,
}: UnitProps) {
  const importantStatus =
    u.statuses.find((s) => s.importance === 'control') ??
    u.statuses.find((s) => s.importance === 'harmful') ??
    u.statuses[0];
  const state = u.dead
    ? '死亡'
    : u.downed
      ? '倒地'
      : u.escaped
        ? '离场'
        : importantStatus?.name;
  const shield = u.barriers.reduce((sum, b) => sum + b.current, 0);
  return (
    <div
      className={`cv6-unit ${u.ownerId ? 'is-pet' : ''} ${controlled ? 'is-controlled' : ''} ${u.dead || u.escaped || u.downed ? 'is-ended' : ''} ${selected ? 'is-selected' : ''} ${targetable ? 'is-target' : ''}`}
    >
      <button
        className="cv6-unit-body"
        disabled={selecting && !targetable}
        aria-label={`${label}${appearance?.speciesName && appearance.speciesName !== u.name ? `，${appearance.speciesName}` : ''}${selecting ? (targetable ? '，选择目标' : '，不是合法目标') : '，查看详情'}`}
        aria-pressed={selecting ? selected : undefined}
        onClick={() => (selecting ? onPick(u.id) : onInspect(u.id))}
      >
        <span className="cv6-portrait">
          <GameIcon
            value={
              appearance?.icon ??
              (u.ownerId
                ? '🐾'
                : u.kind === 'player'
                  ? 'icon:cultivator-male-avatar'
                  : '👤')
            }
          />
          {ready ? (
            <span className="cv6-ready" aria-label="已下令">
              ✓
            </span>
          ) : null}
          {own ? <span className="cv6-self-mark">我</span> : null}
          {!u.ownerId && label !== u.name ? (
            <span className="cv6-slot-mark font-mono">{u.slot + 1}</span>
          ) : null}
        </span>
        <span className="cv6-unit-summary">
          <span className="cv6-unit-name" title={label}>
            {u.name}
          </span>
          <span className="cv6-unit-bars">
            <span
              className="cv6-hp"
              role="img"
              aria-label={
                u.publicBars
                  ? `气血 ${u.hp / 100}%`
                  : `气血 ${u.hp}/${u.maxHp}，护盾 ${shield}`
              }
            >
              <span
                className="cv6-hp-fill"
                style={{ width: `${ratio(u.hp, u.maxHp)}%` }}
              />
              <span
                className="cv6-shield"
                style={{ width: `${ratio(shield, u.maxHp)}%` }}
              />
            </span>
            <span
              className="cv6-mp"
              role="img"
              aria-label={
                u.publicBars ? `法力 ${u.mp / 100}%` : `法力 ${u.mp}/${u.maxMp}`
              }
            >
              <span style={{ width: `${ratio(u.mp, u.maxMp)}%` }} />
            </span>
          </span>
        </span>
        {state ? (
          <span
            className={`cv6-status ${importantStatus?.importance || u.dead || u.downed ? 'is-critical' : ''}`}
            title={state}
          >
            {state}
            {!u.dead && !u.downed && !u.escaped && u.statuses.length > 1
              ? ` +${u.statuses.length - 1}`
              : ''}
          </span>
        ) : null}
      </button>
      {feedback &&
      (feedback.actorId === u.id ||
        feedback.targets.some((t) => t.id === u.id)) ? (
        <span
          key={feedback.seq}
          aria-hidden
          className={`cv6-unit-feedback ${feedback.targets.find((t) => t.id === u.id)?.tone === 'heal' ? 'is-healing' : feedback.targets.some((t) => t.id === u.id) ? 'is-hit' : 'is-acting'}`}
        />
      ) : null}
      <button
        className="cv6-unit-inspect"
        onClick={() => onInspect(u.id)}
        aria-label={`查看${label}详情`}
      >
        ···
      </button>
    </div>
  );
});
function ratio(value: number, max: number) {
  return max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
}
export function CombatV6Roster({
  spectator = false,
  units,
  labels,
  appearances,
  ownId,
  controlledId,
  readyIds,
  recalledOwnerIds = [],
  feedback,
  targetIds,
  selectedIds,
  onInspect,
  onPick,
}: {
  spectator?: boolean;
  units: CombatV6Unit[];
  labels: Map<string, string>;
  appearances?: Record<string, CombatV6UnitAppearance>;
  ownId?: string;
  controlledId?: string;
  readyIds?: string[];
  recalledOwnerIds?: string[];
  feedback?: ReturnType<typeof frameFeedback>;
  targetIds?: string[];
  selectedIds: string[];
  onInspect: (id: string) => void;
  onPick: (id: string) => void;
}) {
  const sides = useMemo(() => {
    const pets = new Map(
      units.filter((u) => u.ownerId).map((u) => [u.ownerId, u]),
    );
    return [0, 1].map((side) =>
      units
        .filter((u) => u.side === side && !u.ownerId)
        .sort((a, b) => a.slot - b.slot)
        .map((main) => ({ main, pet: pets.get(main.id) })),
    );
  }, [units]);
  const targets = new Set(targetIds);
  const selected = new Set(selectedIds);
  const renderUnit = (u: CombatV6Unit) => (
    <UnitRow
      key={u.id}
      u={u}
      label={labels.get(u.id) ?? u.name}
      appearance={appearances?.[u.id]}
      own={!spectator && u.id === ownId}
      controlled={u.id === controlledId}
      ready={!!readyIds?.includes(u.ownerId ?? u.id)}
      feedback={feedback}
      selecting={!!targetIds}
      targetable={targets.has(u.id)}
      selected={selected.has(u.id)}
      onInspect={onInspect}
      onPick={onPick}
    />
  );
  return (
    <>
      {sides.map((rows, side) => {
        const label = spectator
          ? side === 0
            ? '青方'
            : '赤方'
          : side === 0
            ? '我方'
            : '敌方';
        return (
          <aside
            key={side}
            className={`cv6-roster cv6-side-${side} ${rows.length > 2 ? 'is-dense' : ''}`}
            aria-label={label}
          >
            <h2>{label}</h2>
            <div
              className="cv6-lineup"
              style={
                {
                  '--cv6-columns': Math.max(1, Math.min(4, rows.length)),
                } as CSSProperties
              }
            >
              {rows.map(({ main, pet }) => (
                <div
                  className={`cv6-pair ${pet ? 'has-pet' : ''}`}
                  key={main.id}
                  role={pet ? 'group' : undefined}
                  aria-label={
                    pet ? `${main.name}及其灵兽${pet.name}` : undefined
                  }
                >
                  {renderUnit(main)}
                  {pet ? (
                    renderUnit(pet)
                  ) : recalledOwnerIds.includes(main.id) ? (
                    <div
                      className="cv6-unit cv6-vacant-pet"
                      aria-label="灵兽已召回"
                    >
                      <span>已召回</span>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </aside>
        );
      })}
    </>
  );
}
