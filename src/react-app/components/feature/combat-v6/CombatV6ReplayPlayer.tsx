import type { CombatV6ReplayView } from '@shared/combat-v6/replay';
import { replaySeeker } from '@shared/combat-v6/replay-timeline';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Link } from 'react-router';
import { CombatV6Details } from './CombatV6Details';
import { CombatV6Log } from './CombatV6Log';
import { CombatV6Roster } from './CombatV6Roster';
import { appendBattleEntries, unitLabels } from './presentation';

const none: string[] = [];
const outcomes: Record<string, string> = {
  victory: '胜利',
  defeat: '落败',
  draw: '平局',
  aborted: '已结束',
};
export function CombatV6ReplayPlayer({
  record,
  autoPlay = false,
  title = '战斗回放',
  back = '/game/battle/history',
  backLabel = '返回战绩',
  endContent,
}: {
  record: CombatV6ReplayView;
  autoPlay?: boolean;
  title?: string;
  back?: string;
  backLabel?: string;
  endContent?: ReactNode;
}) {
  const timeline = record.timeline;
  const [seek] = useState(() => replaySeeker(timeline));
  const [position, setPosition] = useState(() => seek(0));
  const [running, setRunning] = useState(autoPlay);
  const [speed, setSpeed] = useState(1);
  const [inspected, setInspected] = useState<string>();
  const count = timeline.frames.length;
  const playing = running && position.index < count;
  const ended = position.index === count;
  const move = useCallback(
    (index: number) => {
      setRunning(false);
      setPosition(seek(index));
    },
    [seek],
  );
  useEffect(() => {
    if (!playing) return;
    const timer = setTimeout(
      () => setPosition(seek(position.index + 1)),
      1000 / speed,
    );
    return () => clearTimeout(timer);
  }, [playing, position.index, speed, seek]);
  const labels = useMemo(() => unitLabels(position.units), [position.units]);
  const log = useMemo(() => {
    const units = new Map(record.units.map((u) => [u.id, u]));
    for (const u of record.timeline.initialUnits) units.set(u.id, u);
    for (const frame of record.timeline.frames)
      for (const u of frame.added ?? []) units.set(u.id, u);
    return appendBattleEntries(
      { entries: [], round: 0, open: false, seq: -1 },
      record.events,
      { units: [...units.values()], display: record.display },
    );
  }, [record]);
  const rounds = useMemo(() => {
    const result = new Map<number, number>([[timeline.initialRound, 0]]);
    timeline.frames.forEach((frame, index) => {
      if (!result.has(frame.round)) result.set(frame.round, index + 1);
    });
    return [...result].map(([round, index]) => ({ round, index }));
  }, [timeline]);
  const unit = position.units.find((u) => u.id === inspected);
  const close = useCallback(() => setInspected(undefined), []);
  return (
    <section className="cv6-battle" aria-label="战斗回放">
      <header className="cv6-header">
        <h1>{title}</h1>
        <span>
          {ended ? outcomes[record.outcome] : `第 ${position.round} 回合`}
        </span>
        <Link to={back}>{backLabel}</Link>
      </header>
      <div className="cv6-field">
        <CombatV6Roster
          units={position.units}
          labels={labels}
          controlledId={record.controlledUnitId}
          selectedIds={none}
          onInspect={setInspected}
          onPick={setInspected}
        />
        <CombatV6Log entries={log.entries} visibleSeq={position.visibleSeq} />
      </div>
      {ended ? endContent : null}
      <footer className="cv6-replay-controls" aria-label="回放控制">
        <div className="cv6-replay-actions">
          <button
            onClick={() => move(0)}
            disabled={position.index === 0 && !playing}
          >
            重播
          </button>
          <button
            onClick={() => move(position.index - 1)}
            disabled={!position.index}
          >
            上一行动
          </button>
          <button
            onClick={() => {
              if (ended) setPosition(seek(0));
              setRunning(!playing);
            }}
            disabled={!count}
          >
            {playing ? '暂停' : '播放'}
          </button>
          <button onClick={() => move(position.index + 1)} disabled={ended}>
            下一行动
          </button>
        </div>
        <div className="cv6-replay-settings">
          <label>
            回合{' '}
            <select
              aria-label="跳转回合"
              value={position.round}
              onChange={(e) =>
                move(
                  rounds.find((r) => r.round === Number(e.target.value))!.index,
                )
              }
            >
              {rounds.map((r) => (
                <option key={r.round} value={r.round}>
                  {r.round}
                </option>
              ))}
            </select>
          </label>
          <label>
            速度{' '}
            <select
              aria-label="播放速度"
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
            >
              {[0.5, 1, 2, 4].map((s) => (
                <option key={s} value={s}>
                  {s}×
                </option>
              ))}
            </select>
          </label>
          <span>
            {position.index} / {count}
          </span>
        </div>
      </footer>
      {unit ? (
        <CombatV6Details
          detailUnit={unit}
          label={labels.get(unit.id) ?? unit.name}
          display={record.display}
          onClose={close}
        />
      ) : null}
    </section>
  );
}
