import { CombatV6Battle } from '@app/components/feature/combat-v6/CombatV6Battle';
import { CombatV6Page } from '@app/components/feature/combat-v6/CombatV6Page';
import { useArenaV6Session } from '@app/components/feature/combat-v6/useArenaV6Session';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';

export default function ArenaBattleRoute() {
  const { battleId = '' } = useParams();
  return <ArenaBattle key={battleId} battleId={battleId} />;
}
const noResolve = async () => {};
function ArenaBattle({ battleId }: { battleId: string }) {
  const navigate = useNavigate();
  const controller = useArenaV6Session(battleId);
  const { state, connected, error, pending } = controller;
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, []);
  const session = state.session;
  const playing = state.queue.length > 0;
  return (
    <CombatV6Page
      title="擂台切磋"
      active={!!session}
      loading={!session && !error}
      error={error}
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
            {!connected
              ? '连接恢复中……'
              : session.stage === 'collecting'
                ? `下令剩余 ${Math.max(0, Math.ceil((session.commandDeadlineAt - now - controller.clockOffset) / 1000))} 秒 · ${session.submittedUnitIds.length} 人已提交`
                : session.stage === 'resolving'
                  ? '指令已锁定'
                  : session.stage === 'playback' || playing
                    ? '逐行动播报中'
                    : session.terminalReason === 'expired'
                      ? '战斗已超时结束'
                      : '战斗已结束'}
          </p>
          <CombatV6Battle
            title="擂台切磋"
            session={session}
            online={session}
            shown={state.shown}
            log={state.log}
            playing={playing}
            pending={pending || !connected || !!controller.retry}
            onCommand={controller.submit}
            onResolve={noResolve}
            onClose={() => navigate('/game/arena')}
            back="/game/arena"
            backLabel="返回擂台"
          />
        </>
      ) : null}
    </CombatV6Page>
  );
}
