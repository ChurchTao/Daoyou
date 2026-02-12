'use client';

import { BattleReplayViewer } from '@/components/feature/battle/BattleReplayViewer';
import type { BattleEngineResult, TurnSnapshot } from '@/engine/battle';
import { useCultivator } from '@/lib/contexts/CultivatorContext';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

type BattleRecord = {
  id: string;
  createdAt: string | null;
  battleResult: BattleEngineResult;
  battleReport?: string | null;
};

type BattleRecordResponse = {
  success: boolean;
  data: BattleRecord;
};

export default function BattleReplayPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { cultivator } = useCultivator();

  const [record, setRecord] = useState<BattleRecord | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!id) return;

    const fetchBattleRecord = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/battles/${id}`, { cache: 'no-store' });
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
  const currentCultivatorId = cultivator?.id;

  const selfIsOpponent =
    !!battleResult &&
    !!currentCultivatorId &&
    battleResult.opponent === currentCultivatorId;

  const getCultivatorNameById = (
    result: BattleEngineResult,
    cultivatorId: string,
  ) => {
    if (result.winner?.id === cultivatorId) return result.winner.name;
    if (result.loser?.id === cultivatorId) return result.loser.name;
    return cultivatorId === currentCultivatorId ? '道友' : '对手';
  };

  const playerName = battleResult
    ? selfIsOpponent
      ? getCultivatorNameById(battleResult, battleResult.opponent)
      : getCultivatorNameById(battleResult, battleResult.player)
    : '道友';
  const opponentName = battleResult
    ? selfIsOpponent
      ? getCultivatorNameById(battleResult, battleResult.player)
      : getCultivatorNameById(battleResult, battleResult.opponent)
    : '对手';

  let timeline: TurnSnapshot[] = battleResult?.timeline ?? [];
  if (selfIsOpponent && battleResult?.timeline?.length) {
    // 回放组件固定以 player/opponent 渲染，这里按“当前角色视角”交换左右两侧。
    timeline = battleResult.timeline.map((snap) => ({
      ...snap,
      player: snap.opponent,
      opponent: snap.player,
    }));
  }

  const turns = record?.battleResult.turns;
  const isWin = currentCultivatorId
    ? record?.battleResult.winner?.id === currentCultivatorId
    : !!record?.battleResult.winner?.name;

  return (
    <div className="bg-paper min-h-screen">
      <div className="main-content mx-auto flex max-w-xl flex-col px-4 pt-8 pb-16">
        <Link href="/game" className="text-ink hover:text-crimson mb-4">
          [← 返回]
        </Link>

        <div className="mb-6 text-center">
          <h1 className="font-ma-shan-zheng text-ink text-2xl">
            【战报回放 · {playerName} vs {opponentName}】
          </h1>
          {record?.createdAt && (
            <p className="text-ink/60 mt-1 text-xs">
              {new Date(record.createdAt).toLocaleString()}
            </p>
          )}
        </div>

        {record && (
          <BattleReplayViewer
            playerName={playerName}
            opponentName={opponentName}
            timeline={timeline}
            battleReport={record.battleReport}
            turns={turns}
            isWin={isWin}
          />
        )}
      </div>
    </div>
  );
}
