import { memo, useEffect, useRef, useState } from 'react';
import type { ActionEntry } from './presentation';
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
  return (
    <div>
      {showRound ? (
        <h3 className="cv6-round">
          {entry.round ? `第 ${entry.round} 回合` : '开场'}
        </h3>
      ) : null}
      <article className="cv6-entry">
        <strong>{entry.title}</strong>
        <div>
          {entry.lines
            .filter((l) => l.seq <= visibleSeq && (details || !l.detail))
            .map((line) => (
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
                {line.text}
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
  useEffect(() => {
    const node = logRef.current;
    if (node && following) node.scrollTop = node.scrollHeight;
  }, [visibleSeq, following, details]);
  const visible = entries.filter((e) => e.seq <= visibleSeq);
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
            }
          }
        }}
      >
        {visible.length === 0 ? <p className="cv6-muted">静候出招。</p> : null}
        {visible.map((entry, i) => (
          <LogEntry
            key={entry.seq}
            entry={entry}
            visibleSeq={Math.min(visibleSeq, entry.endSeq)}
            details={details}
            showRound={i === 0 || visible[i - 1].round !== entry.round}
          />
        ))}
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
