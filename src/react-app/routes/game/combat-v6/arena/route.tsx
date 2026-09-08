import { CombatV6Battle } from '@app/components/feature/combat-v6/CombatV6Battle';
import { CombatV6Page } from '@app/components/feature/combat-v6/CombatV6Page';
import { useArenaV6Session } from '@app/components/feature/combat-v6/useArenaV6Session';
import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';

export default function ArenaBattleRoute() {
  const { battleId = '' } = useParams();
  const [params] = useSearchParams();
  const spectator = params.get('watch') === '1';
  return (
    <ArenaBattle
      key={`${battleId}:${spectator}`}
      battleId={battleId}
      spectator={spectator}
    />
  );
}
const noResolve = async () => {};
function ArenaBattle({
  battleId,
  spectator,
}: {
  battleId: string;
  spectator: boolean;
}) {
  const navigate = useNavigate();
  const controller = useArenaV6Session(battleId, spectator);
  const { state, connected, error, pending } = controller;
  const [now, setNow] = useState(Date.now);
  const [leaving, setLeaving] = useState(false);
  const [leaveError, setLeaveError] = useState<string>();
  const leave = async () => {
    if (leaving) return;
    setLeaving(true);
    try {
      if (spectator && state.session) {
        const response = await fetch(
          `/api/arena/rooms/${state.session.roomId}/leave`,
          {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: '{}',
          },
        );
        if (!response.ok && response.status !== 404)
          throw new Error('退出观战失败，请重试');
      }
      navigate('/game/arena');
    } catch (cause) {
      setLeaveError(cause instanceof Error ? cause.message : '退出观战失败');
    } finally {
      setLeaving(false);
    }
  };
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, []);
  const session = state.session;
  const playing = state.queue.length > 0;
  return (
    <CombatV6Page
      title={spectator ? '擂台观战' : '擂台切磋'}
      active={!!session}
      loading={!session && !error}
      error={leaveError ?? error}
      onRetry={controller.refresh}
      back="/game/arena"
      backLabel="返回擂台"
    >
      {controller.retry ? (
        <button disabled={pending} onClick={controller.retryCommand}>
          重试提交原指令
        </button>
      ) : null}
      {session ? (
        <>
          <p className="cv6-muted text-xs" aria-live="polite">
            {!connected && session.stage !== 'finished'
              ? '连接恢复中……'
              : session.stage === 'collecting'
                ? `下令剩余 ${Math.max(0, Math.ceil((session.commandDeadlineAt - now - controller.clockOffset) / 1000))} 秒 · ${session.units.filter((unit) => unit.kind === 'player' && session.submittedUnitIds.includes(unit.id)).length} 人已提交`
                : session.stage === 'resolving'
                  ? '指令已锁定'
                  : session.stage === 'playback' || playing
                    ? '逐行动播报中'
                    : session.terminalReason === 'expired'
                      ? '战斗已超时结束'
                      : '战斗已结束'}
          </p>
          <CombatV6Battle
            title={spectator ? '擂台观战' : '擂台切磋'}
            session={session}
            online={session}
            shown={state.shown}
            log={state.log}
            playing={playing}
            pending={
              spectator ? leaving : pending || !connected || !!controller.retry
            }
            onCommand={controller.submit}
            onResolve={noResolve}
            onAuto={controller.submitAuto}
            onClose={() => void leave()}
            back="/game/arena"
            backLabel="返回擂台"
          />
        </>
      ) : null}
    </CombatV6Page>
  );
}
