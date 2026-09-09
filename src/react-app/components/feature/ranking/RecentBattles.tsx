import { CombatV6HistoryList } from '@app/components/feature/combat-v6/CombatV6HistoryList';
import { combatV6Request } from '@app/components/feature/combat-v6/request';
import { GameLoadingState } from '@app/components/game-shell/GameLoadingState';
import { InkButton } from '@app/components/ui/InkButton';
import { InkNotice } from '@app/components/ui/InkNotice';
import { usePlayerSession } from '@app/lib/resources/player';
import type { CombatV6HistoryPage } from '@shared/contracts/combatV6Replay';
import { useEffect, useState } from 'react';

export function RecentBattles() {
  const id = usePlayerSession().data?.activeCultivator?.id;
  return id ? <RecentBattleList key={id} /> : null;
}

function RecentBattleList() {
  const [data, setData] = useState<CombatV6HistoryPage>();
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    void combatV6Request<CombatV6HistoryPage>('/api/combat-v6/replays?page=1', {
      signal: abort.signal,
      cache: 'no-store',
    })
      .then((result) => {
        if (!abort.signal.aborted) setData(result);
      })
      .catch((e: Error) => {
        if (!abort.signal.aborted) setError(e.message);
      });
    return () => abort.abort();
  }, [attempt]);

  if (error)
    return (
      <div role="alert">
        <InkNotice>近期战绩加载失败：{error}</InkNotice>
        <InkButton
          onClick={() => {
            setError('');
            setAttempt((n) => n + 1);
          }}
        >
          重试
        </InkButton>
      </div>
    );
  if (!data)
    return <GameLoadingState message="近期战绩加载中……" variant="inline" />;
  if (!data.items.length) return <InkNotice>暂无战斗记录。</InkNotice>;
  return (
    <>
      <CombatV6HistoryList items={data.items.slice(0, 3)} />
      <InkButton href="/game/battle/history" className="pt-2">
        查看全部战绩
      </InkButton>
    </>
  );
}
