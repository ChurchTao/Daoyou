import { BattlePageLayout } from '@app/components/feature/battle/BattlePageLayout';
import { BattlePlaybackPanel } from '@app/components/feature/battle/BattlePlaybackPanel';
import { useBattlePlaybackState } from '@app/components/feature/battle/useBattlePlaybackState';
import Link from '@app/components/router/AppLink';
import { GameImmersiveLoading } from '@app/components/game-shell';
import type { BattleRecord as BattleRecordNative } from '@shared/types/battle';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router';

type BattleRecordRow = {
  id: string;
  createdAt: string | null;
  battleResult: BattleRecordNative;
  battleReport?: string | null;
};

type BattleRecordResponse = {
  success: boolean;
  data: BattleRecordRow;
};

export default function BattleReplayPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [record, setRecord] = useState<BattleRecordRow | null>(null);
  const [loading, setLoading] = useState(true);
  const battleResult = record?.battleResult;
  const playback = useBattlePlaybackState(battleResult);

  useEffect(() => {
    if (!id) return;

    const fetchBattleRecord = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/battle-records/v2/${id}`, {
          cache: 'no-store',
        });
        if (!res.ok) return;
        const data = (await res.json()) as BattleRecordResponse;
        if (data.success) {
          setRecord(data.data);
        }
      } catch (error) {
        console.error('获取战斗记录失败:', error);
      } finally {
        setLoading(false);
      }
    };

    void fetchBattleRecord();
  }, [id]);

  if (loading && !record) {
    return <GameImmersiveLoading message="回溯战斗回放……" />;
  }

  if (!record && !loading) {
    return (
      <div className="flex h-full items-center justify-center px-4 py-20">
        <div className="border-battle-rule-strong bg-[rgba(248,243,230,0.92)] max-w-md border border-dashed px-5 py-5 text-center">
          <p className="text-ink mb-4">未找到该战斗记录</p>
          <Link
            href="/game/battle/history"
            className="text-ink hover:text-crimson"
          >
            [返回战绩]
          </Link>
        </div>
      </div>
    );
  }

  return (
    <BattlePageLayout
      title={`战斗回放 · ${playback.playerName} vs ${playback.opponentName}`}
      subtitle="按时间顺序查看这场战斗的全过程。"
      loading={loading}
      battleResult={battleResult}
      actions={{
        primary: {
          label: '返回战绩',
          href: '/game/battle/history',
        },
      }}
    >
      <BattlePlaybackPanel
        battleResult={battleResult}
        playback={playback}
        unsupportedNotice={
          <p className="text-ink-secondary">
            该战斗记录不支持新版回放（缺少关键时间线数据）。
          </p>
        }
      />

      {record?.createdAt && (
        <p className="text-ink/40 text-center text-xs mt-4">
          记录时间：{new Date(record.createdAt).toLocaleString()}
        </p>
      )}
    </BattlePageLayout>
  );
}
