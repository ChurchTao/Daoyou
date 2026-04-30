'use client';

import { BattlePageLayout } from '@/components/feature/battle/BattlePageLayout';
import { CombatStatusHeader } from '@/components/feature/battle/v5/CombatStatusHeader';
import { CombatActionLog } from '@/components/feature/battle/v5/CombatActionLog';
import { CombatControlBar } from '@/components/feature/battle/v5/CombatControlBar';
import { CombatAttributeModal } from '@/components/feature/battle/v5/CombatAttributeModal';
import { useCombatPlayer } from '../hooks/useCombatPlayer';
import type { UnitStateSnapshot } from '@/engine/battle-v5/systems/state/types';
import type { BattleRecord as BattleRecordNative } from '@/lib/services/battleResult';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

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
  const [loading, setLoading] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState<UnitStateSnapshot | null>(null);

  // 播放器 Hook
  const {
    currentIndex,
    isPlaying,
    playbackSpeed,
    setPlaybackSpeed,
    play,
    pause,
    reset,
    progress,
    unitSnapshots,
  } = useCombatPlayer(record?.battleResult);

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
      } catch (e) {
        console.error('获取战斗记录失败:', e);
      } finally {
        setLoading(false);
      }
    };

    fetchBattleRecord();
  }, [id]);

  if (!record && !loading) {
    return (
      <div className="bg-paper flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-ink mb-4">未找到该战斗记录</p>
          <Link href="/game" className="text-ink hover:text-crimson">
            [返回主页]
          </Link>
        </div>
      </div>
    );
  }

  const battleResult = record?.battleResult;
  const isReplaySupported =
    !!battleResult?.logSpans?.length &&
    !!battleResult?.stateTimeline?.frames?.length;
  const playerUnitId = battleResult?.player;
  const opponentUnitId = battleResult?.opponent;
  const getUnitName = (unitId: string) => {
    if (battleResult?.winner.id === unitId) return battleResult.winner.name;
    if (battleResult?.loser.id === unitId) return battleResult.loser.name;
    return '道友';
  };

  const playerName = playerUnitId ? getUnitName(playerUnitId) : '道友';
  const opponentName = opponentUnitId ? getUnitName(opponentUnitId) : '对手';

  // 计算实时快照
  const currentPlayerFrame = unitSnapshots[playerUnitId || ''];
  const currentOpponentFrame = unitSnapshots[opponentUnitId || ''];

  return (
    <BattlePageLayout
      title={`战斗回放 · ${playerName} vs ${opponentName}`}
      subtitle="按时间顺序查看这场战斗的全过程。"
      backHref="/game"
      loading={loading}
      battleResult={battleResult}
      isStreaming={false}
      actions={{
        primary: {
          label: '返回主页',
          href: '/game',
        },
      }}
    >
      <div className="flex flex-col gap-4 mb-8">
        {!isReplaySupported && battleResult && (
          <p className="text-ink-secondary">
            该战斗记录不支持新版回放（缺少关键时间线数据）。
          </p>
        )}
        {isReplaySupported && currentPlayerFrame && currentOpponentFrame && (
          <CombatStatusHeader
            player={currentPlayerFrame}
            opponent={currentOpponentFrame}
            onShowPlayerDetails={() => setSelectedUnit(currentPlayerFrame)}
            onShowOpponentDetails={() => setSelectedUnit(currentOpponentFrame)}
            controls={
              <CombatControlBar
                isPlaying={isPlaying}
                playbackSpeed={playbackSpeed}
                progress={progress}
                onToggle={() => (isPlaying ? pause() : play())}
                onSpeedChange={setPlaybackSpeed}
                onReset={reset}
              />
            }
          />
        )}

        {isReplaySupported && battleResult && (
          <CombatActionLog spans={battleResult.logSpans} currentIndex={currentIndex} />
        )}
      </div>

      <CombatAttributeModal
        unit={selectedUnit}
        isOpen={!!selectedUnit}
        onClose={() => setSelectedUnit(null)}
      />

      {record?.createdAt && (
        <p className="text-ink/40 text-center text-xs mt-4">
          记录时间：{new Date(record.createdAt).toLocaleString()}
        </p>
      )}
    </BattlePageLayout>
  );
}
