import { INVASION_PATH } from '@daoyou/game-domain/invasion';
import { CombatV6Battle } from '@app/components/feature/combat-v6/CombatV6Battle';
import { CombatV6Page } from '@app/components/feature/combat-v6/CombatV6Page';
import { useArenaV6Session } from '@app/components/feature/combat-v6/useArenaV6Session';
import { HuntResult } from '@app/components/feature/hunts/HuntResult';
import { apiFetch } from '@app/lib/api/fetch';
import { HUNT_BOSSES } from '@daoyou/game-content/hunts';
import { useEffect, useState } from 'react';
import { useMatch, useNavigate, useParams, useSearchParams } from 'react-router';
const HUNT_TEAM_HREF = '/game/hunt-team';

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
  const invasionRoute = useMatch('/game/combat-v6/invasion/:battleId');
  const huntRoute = useMatch('/game/combat-v6/hunt/:battleId');
  const controller = useArenaV6Session(battleId, spectator);
  const { state, connected, error, pending } = controller;
  const session = state.session;
  const invasion = session?.invasion;
  const huntBoss = session?.hunt ? HUNT_BOSSES[session.hunt.bossId] : undefined;
  const isInvasion = !!(invasion || invasionRoute);
  const isHunt = !!(session?.hunt || huntRoute);
  const back = isInvasion ? INVASION_PATH : isHunt ? HUNT_TEAM_HREF : '/game/arena';
  const backLabel = isInvasion ? '返回镇魔营地' : isHunt ? '返回讨伐' : '返回擂台';
  const [leaving, setLeaving] = useState(false);
  const [leaveError, setLeaveError] = useState<string>();
  const leave = async () => {
    if (leaving) return;
    setLeaving(true);
    try {
      if (spectator && state.session) {
        const response = await apiFetch(
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
      navigate(back);
    } catch (cause) {
      setLeaveError(cause instanceof Error ? cause.message : '退出观战失败');
    } finally {
      setLeaving(false);
    }
  };
  const playing = state.queue.length > 0;
  useEffect(() => {
    if (!invasion || session.stage !== 'finished' || playing) return;
    const timer = window.setTimeout(() => navigate(`${INVASION_PATH}?from=${battleId}`, { replace: true }), 600);
    return () => window.clearTimeout(timer);
  }, [invasion, session?.stage, playing, navigate, battleId]);
  const title = invasion
    ? `古魔入侵 · 第 ${invasion.wave} 波`
    : invasionRoute
      ? '古魔入侵'
      : isHunt
        ? huntBoss ? `结伴讨伐 · ${huntBoss.name}` : '结伴讨伐'
        : spectator
          ? '擂台观战'
          : '擂台切磋';
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
          {invasion ? <InvasionBattleClock endsAt={invasion.endsAt} offset={controller.clockOffset} /> : null}
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

function InvasionBattleClock({ endsAt, offset }: { endsAt: number; offset: number }) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, []);
  const seconds = Math.max(0, Math.ceil((endsAt - now - offset) / 1000));
  return <p className="text-ink-secondary px-4 pt-2 text-right text-sm">距收阵 <span className="font-mono">{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}</span></p>;
}
