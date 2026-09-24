import type { ArenaSessionView } from '@shared/contracts/combatV6Arena';
import { useEffect, useState } from 'react';

/** Local clock drives presentation only; the host decides when commands lock. */
export function CombatV6Status({
  round,
  playing,
  online,
  connected = true,
  clockOffset = 0,
  outcome,
}: {
  round: number;
  playing: boolean;
  online?: ArenaSessionView;
  connected?: boolean;
  clockOffset?: number;
  outcome?: string;
}) {
  const [now, setNow] = useState(Date.now);
  const collecting = online?.stage === 'collecting' && !playing && !outcome;
  useEffect(() => {
    if (!collecting) return;
    const tick = () => setNow(Date.now());
    const timer = window.setInterval(tick, 250);
    window.addEventListener('focus', tick);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', tick);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [collecting]);
  const seconds = collecting
    ? Math.max(
        0,
        Math.min(
          30,
          Math.ceil((online.commandDeadlineAt - now - clockOffset) / 1000),
        ),
      )
    : undefined;
  const submitted = online?.submittedUnitIds.includes(online.controlledUnitId);
  const label =
    outcome ??
    (!connected
      ? '连接恢复中'
      : playing || online?.stage === 'playback'
        ? '战斗中'
        : online?.stage === 'resolving' || seconds === 0
          ? '指令锁定中'
          : submitted
            ? '已下令'
            : online?.spectator
              ? '观战中'
              : '下令中');
  return (
    <div className="cv6-phase" aria-label="战斗阶段">
      <span>
        第 <span className="font-mono">{round}</span> 回合
      </span>
      <span role="status">{label}</span>
      {seconds !== undefined && connected && seconds > 0 ? (
        <span
          className={`cv6-countdown font-mono ${seconds <= 5 ? 'is-urgent' : seconds <= 10 ? 'is-warning' : ''}`}
          aria-label={`下令剩余 ${seconds} 秒`}
        >
          {seconds}
          <small>秒</small>
        </span>
      ) : (
        <span className="cv6-countdown" aria-hidden />
      )}
    </div>
  );
}
