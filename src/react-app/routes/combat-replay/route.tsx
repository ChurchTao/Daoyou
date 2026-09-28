import { CombatV6Page } from '@app/components/feature/combat-v6/CombatV6Page';
import { CombatV6ReplayPlayer } from '@app/components/feature/combat-v6/CombatV6ReplayPlayer';
import { combatV6Request } from '@app/components/feature/combat-v6/request';
import type { CombatV6ReplayView } from '@shared/combat-v6/replay';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';

export default function BattleSharePage() {
  const { shareCode = '' } = useParams();
  const [record, setRecord] = useState<CombatV6ReplayView>();
  const [error, setError] = useState('');
  useEffect(() => {
    const abort = new AbortController();
    void combatV6Request<CombatV6ReplayView>(
      `/api/combat-v6-shares/${encodeURIComponent(shareCode)}`,
      { signal: abort.signal },
    ).then(setRecord).catch((reason: Error) => {
      if (!abort.signal.aborted) setError(reason.message);
    });
    return () => abort.abort();
  }, [shareCode]);
  if (record) return (
    <CombatV6Page title="公开战谱" active>
      <CombatV6ReplayPlayer record={record} title="公开战谱" back="/" backLabel="返回首页" />
    </CombatV6Page>
  );
  return (
    <main className="bg-paper text-ink flex min-h-svh flex-col items-center justify-center gap-4 px-4 text-sm">
      <p role={error ? 'alert' : 'status'}>{error || '正在载入公开战谱……'}</p>
      <Link className="underline" to="/">返回首页</Link>
    </main>
  );
}
