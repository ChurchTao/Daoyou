import { CombatV6Page } from '@app/components/feature/combat-v6/CombatV6Page';
import { CombatV6ReplayPlayer } from '@app/components/feature/combat-v6/CombatV6ReplayPlayer';
import { combatV6Request } from '@app/components/feature/combat-v6/request';
import { usePlayerSession } from '@app/lib/resources/player';
import type { CombatV6ReplayView } from '@daoyou/shared/combat-v6/replay';
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
  const [sharing, setSharing] = useState(false);
  const [shareMessage, setShareMessage] = useState('');
  async function share(kind: 'link' | 'world') {
    setSharing(true);
    setShareMessage('');
    try {
      if (kind === 'link') {
        const result = await combatV6Request<{ shareCode: string }>(
          `/api/combat-v6/replays/${encodeURIComponent(id)}/share`,
          { method: 'POST' },
        );
        await navigator.clipboard.writeText(
          `${window.location.origin}/combat-replay/${result.shareCode}`,
        );
        setShareMessage('公开回放链接已复制，可发给其他道友查看。');
      } else {
        await combatV6Request(
          '/api/world-chat/messages',
          { method: 'POST', body: JSON.stringify({ messageType: 'combat_v6_replay', battleId: id }) },
        );
        setShareMessage('战绩已分享到世界聊天。');
      }
    } catch (error) {
      setShareMessage(error instanceof Error ? error.message : '分享失败');
    } finally {
      setSharing(false);
    }
  }
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
      {record ? (
        <>
          <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-4 py-2 text-sm">
            <button type="button" disabled={sharing} className="text-teal underline disabled:opacity-50" onClick={() => void share('world')}>分享到世界聊天</button>
            <button type="button" disabled={sharing} className="text-teal underline disabled:opacity-50" onClick={() => void share('link')}>复制公开链接</button>
            {shareMessage ? <span role="status" className="text-ink-secondary">{shareMessage}</span> : null}
          </div>
          <CombatV6ReplayPlayer record={record} />
        </>
      ) : null}
    </CombatV6Page>
  );
}
