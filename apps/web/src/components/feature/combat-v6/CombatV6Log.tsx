import { memo, useEffect, useRef, useState } from 'react';
import { compactLogLines, type ActionEntry } from './presentation';
const LogEntry = memo(function LogEntry({
  entry,
  visibleSeq,
  details,
  showRound,
}: {
  entry: ActionEntry;
  visibleSeq: number;
  details: boolean;
  showRound: boolean;
}) {
  const visibleLines = entry.lines.filter(
    (l) => l.seq <= visibleSeq && (details || !l.detail),
  );
  const lines = details ? visibleLines : compactLogLines(visibleLines);
  return (
    <div>
      {showRound ? (
        <h3 className="cv6-round">
          {entry.round ? (
            <>
              第 <span className="font-mono">{entry.round}</span> 回合
            </>
          ) : (
            '开场'
          )}
        </h3>
      ) : null}
      <article className="cv6-entry">
        <strong>{entry.title}</strong>
        <div>
          {lines.map((line) => (
            <p
              key={line.seq}
              className={
                line.tone
                  ? `cv6-${line.tone}`
                  : line.detail
                    ? 'cv6-muted'
                    : undefined
              }
            >
              {line.text.split(/(\d+(?:\.\d+)?)/).map((part, i) =>
                /^(?:\d+(?:\.\d+)?)$/.test(part) ? (
                  <span className="font-mono" key={i}>
                    {part}
                  </span>
                ) : (
                  part
                ),
              )}
            </p>
          ))}
        </div>
      </article>
    </div>
  );
});
export const CombatV6Log = memo(function CombatV6Log({
  entries,
  visibleSeq,
}: {
  entries: ActionEntry[];
  visibleSeq: number;
}) {
  const [details, setDetails] = useState(false);
  const [readSeq, setReadSeq] = useState(visibleSeq);
  const [following, setFollowing] = useState(true);
  const logRef = useRef<HTMLDivElement>(null);
  const [pausedRound, setPausedRound] = useState(0);
  const [expandedRounds, setExpandedRounds] = useState<Set<number>>(
    () => new Set(),
  );
  const visible = entries.filter((e) => e.seq <= visibleSeq);
  const currentRound = visible[visible.length - 1]?.round ?? 0;
  const foldThrough = (following ? currentRound : pausedRound) - 2;
  const rounds = new Map<number, ActionEntry[]>();
  for (const entry of visible) {
    const group = rounds.get(entry.round) ?? [];
    group.push(entry);
    rounds.set(entry.round, group);
  }
  useEffect(() => {
    const node = logRef.current;
    if (node && following) node.scrollTop = node.scrollHeight;
  }, [visibleSeq, following, details, foldThrough]);
  return (
    <div className="cv6-log">
      <div className="cv6-log-toolbar">
        <span>战报</span>
        <button onClick={() => setDetails((v) => !v)} aria-pressed={details}>
          {details ? '收起细节' : '细节'}
        </button>
      </div>
      <div
        className="cv6-log-scroll"
        ref={logRef}
        onScroll={() => {
          const n = logRef.current;
          if (n) {
            const atEnd = n.scrollHeight - n.scrollTop - n.clientHeight < 40;
            if (atEnd !== following) {
              setFollowing(atEnd);
              setReadSeq(visibleSeq);
              setPausedRound(currentRound);
            }
          }
        }}
      >
        {visible.length === 0 ? <p className="cv6-muted">静候出招。</p> : null}
        {[...rounds].map(([round, actions]) => {
          const historical = round <= foldThrough;
          const expanded = !historical || expandedRounds.has(round);
          return (
            <section key={round}>
              {historical ? (
                <button
                  className="cv6-history-round"
                  aria-expanded={expanded}
                  onClick={() => {
                    setFollowing(false);
                    setPausedRound(currentRound);
                    setReadSeq(visibleSeq);
                    setExpandedRounds((previous) => {
                      const next = new Set(previous);
                      if (next.has(round)) next.delete(round);
                      else next.add(round);
                      return next;
                    });
                  }}
                >
                  {expanded ? '▾' : '▸'}{' '}
                  {round ? (
                    <>
                      第 <span className="font-mono">{round}</span> 回合
                    </>
                  ) : (
                    '开场'
                  )}{' '}
                  <small>
                    <span className="font-mono">{actions.length}</span> 次行动
                  </small>
                </button>
              ) : null}
              {expanded
                ? actions.map((entry, i) => (
                    <LogEntry
                      key={entry.seq}
                      entry={entry}
                      visibleSeq={Math.min(visibleSeq, entry.endSeq)}
                      details={details}
                      showRound={!historical && i === 0}
                    />
                  ))
                : null}
            </section>
          );
        })}
      </div>
      {!following && readSeq < visibleSeq ? (
        <button
          className="cv6-new-events"
          onClick={() => {
            setFollowing(true);
            setReadSeq(visibleSeq);
          }}
        >
          查看新战报 ↓
        </button>
      ) : null}
    </div>
  );
});
