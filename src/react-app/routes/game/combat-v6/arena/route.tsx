import { CombatV6Battle } from '@app/components/feature/combat-v6/CombatV6Battle';
import { CombatV6Page } from '@app/components/feature/combat-v6/CombatV6Page';
import { useArenaV6Session } from '@app/components/feature/combat-v6/useArenaV6Session';
import { useState } from 'react';
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
      {session ? (
        <>
          <CombatV6Battle
            title={spectator ? '擂台观战' : '擂台切磋'}
            session={session}
            online={session}
            connected={connected}
            onRetryCommand={
              controller.retry ? controller.retryCommand : undefined
            }
            clockOffset={controller.clockOffset}
            shown={state.shown}
            log={state.log}
            playing={playing}
            pending={spectator ? leaving : pending}
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
