import { CombatV6Page } from '@app/components/feature/combat-v6/CombatV6Page';
import { CombatV6ReplayPlayer } from '@app/components/feature/combat-v6/CombatV6ReplayPlayer';
import { combatV6Request } from '@app/components/feature/combat-v6/request';
import { usePlayerSession } from '@app/lib/resources/player';
import type { CombatV6ReplayView } from '@shared/combat-v6/replay';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router';

export default function BattleReplayRoute() {
  const { id = '' } = useParams();
  const characterId = usePlayerSession().data?.activeCultivator?.id;
  return <ReplayLoader key={`${characterId}:${id}`} id={id} />;
}
function ReplayLoader({ id }: { id: string }) {
  const [record, setRecord] = useState<CombatV6ReplayView>();
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    void combatV6Request<CombatV6ReplayView>(
      `/api/combat-v6/replays/${encodeURIComponent(id)}`,
      { signal: abort.signal, cache: 'no-store' },
    )
      .then((data) => {
        if (!abort.signal.aborted) setRecord(data);
      })
      .catch((e: Error) => {
        if (!abort.signal.aborted) setError(e.message);
      });
    return () => abort.abort();
  }, [id, attempt]);
  return (
    <CombatV6Page
      title="战斗回放"
      active={!!record}
      loading={!record && !error}
      error={error}
      back="/game/battle/history"
      backLabel="返回战绩"
      onRetry={() => {
        setError('');
        setAttempt((n) => n + 1);
      }}
    >
      {record ? <CombatV6ReplayPlayer record={record} /> : null}
    </CombatV6Page>
  );
}
