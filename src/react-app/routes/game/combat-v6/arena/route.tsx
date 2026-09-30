import { CombatV6Battle } from '@app/components/feature/combat-v6/CombatV6Battle';
import { CombatV6Page } from '@app/components/feature/combat-v6/CombatV6Page';
import { useArenaV6Session } from '@app/components/feature/combat-v6/useArenaV6Session';
import { HuntResult } from '@app/components/feature/hunts/HuntResult';
import { HUNT_BOSSES, huntMapHref } from '@shared/hunts/config';
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
      navigate(
        state.session?.hunt ? huntMapHref(state.session.hunt) : '/game/arena',
      );
    } catch (cause) {
      setLeaveError(cause instanceof Error ? cause.message : '退出观战失败');
    } finally {
      setLeaving(false);
    }
  };
  const session = state.session;
  const playing = state.queue.length > 0;
  const title = session?.hunt
    ? `结伴讨伐 · ${HUNT_BOSSES[session.hunt.bossId].name}`
    : spectator
      ? '擂台观战'
      : '擂台切磋';
  const back = session?.hunt ? huntMapHref(session.hunt) : '/game/arena';
  const backLabel = session?.hunt ? '返回讨伐队伍' : '返回擂台';
  return (
    <CombatV6Page
      title={title}
      active={!!session}
      loading={!session && !error}
      error={leaveError ?? error}
      onRetry={controller.refresh}
      back={back}
      backLabel={backLabel}
    >
      {session ? (
        <>
          <CombatV6Battle
            title={title}
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
            endAction={
              session.hunt && session.outcome ? (
                <HuntResult battleId={battleId} onClose={() => void leave()} />
              ) : undefined
            }
            back={back}
            backLabel={backLabel}
          />
        </>
      ) : null}
    </CombatV6Page>
  );
}
