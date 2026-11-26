import { CombatV6Battle } from '@app/components/feature/combat-v6/CombatV6Battle';
import { CombatV6Page } from '@app/components/feature/combat-v6/CombatV6Page';
import {
  combatV6Request,
  mutationBody,
} from '@app/components/feature/combat-v6/request';
import type { CombatV6Session } from '@app/components/feature/combat-v6/session';
import { useCombatV6Session } from '@app/components/feature/combat-v6/useCombatV6Session';
import { useEffect, useEffectEvent } from 'react';
import { useNavigate, useParams } from 'react-router';

const back = '/game/baixiao-meet';
const title = '与百晓考官交手';

export default function BaixiaoBattleRoute() {
  const { battleId = '' } = useParams();
  return <BaixiaoBattle key={battleId} battleId={battleId} />;
}

function BaixiaoBattle({ battleId }: { battleId: string }) {
  const base = `/api/baixiao-meet/duel/${battleId}`;
  const combat = useCombatV6Session<CombatV6Session>(base);
  const { session } = combat;
  const navigate = useNavigate();
  async function recover(signal?: AbortSignal) {
    const recovered = await combatV6Request<boolean>(
      `${base}/sessions/recover`,
      {
        method: 'POST',
        signal,
      },
    );
    if (recovered && !signal?.aborted) void navigate(back, { replace: true });
    return recovered;
  }

  const recoverMissing = useEffectEvent((signal: AbortSignal) => {
    void recover(signal).catch((cause: unknown) => {
      if (!signal.aborted) {
        combat.setError(
          cause instanceof Error ? cause.message : '暂时无法恢复题席。',
        );
      }
    });
  });

  useEffect(() => {
    if (combat.loading || combat.pending || session) return;
    const request = new AbortController();
    recoverMissing(request.signal);
    return () => request.abort();
  }, [combat.loading, combat.pending, session]);

  function finish() {
    if (!session?.outcome || combat.playing) return;
    void combat.run(async () => {
      await combatV6Request<CombatV6Session>(
        `${base}/sessions/${session.sessionId}/resolve`,
        mutationBody({ expectedRevision: session.revision }),
      );
      void navigate(back, { replace: true });
    });
  }
  return (
    <CombatV6Page
      title={title}
      active={Boolean(session)}
      loading={combat.loading}
      error={combat.error}
      onRetry={() =>
        void combat.run(async () => {
          if (!(await recover())) await combat.refresh(true);
        })
      }
      back={back}
      backLabel="返回题席"
    >
      {session && (
        <CombatV6Battle
          allowAbandon={false}
          title={title}
          session={session}
          shown={combat.shown}
          log={combat.log}
          playing={combat.playing}
          pending={combat.pending}
          onCommand={combat.submit}
          onResolve={combat.resolve}
          onAuto={combat.submitAuto}
          onClose={finish}
          onBack={finish}
          back={back}
          backLabel="返回题席"
        />
      )}
    </CombatV6Page>
  );
}
