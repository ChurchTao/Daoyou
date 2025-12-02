'use client';

import { BattleReplayViewer } from '@/components/BattleReplayViewer';
import type { BattleEngineResult } from '@/engine/battleEngine';
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
      <div className="bg-paper min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="mb-4 text-ink">未找到该战斗记录</p>
          <Link href="/" className="text-ink hover:text-crimson">
            [返回主页]
          </Link>
        </div>
      </div>
    );
  }

  const playerName = record?.battleResult.winner?.name ?? '道友';
  const opponentName = record?.battleResult.loser?.name ?? '对手';
  const timeline = record?.battleResult.timeline ?? [];
  const turns = record?.battleResult.turns;

  // 这里用 winner 是否存在来简单判断胜负（真实逻辑可按需要调整）
  const isWin = !!record?.battleResult.winner?.name;

  return (
    <div className="bg-paper min-h-screen">
      <div className="mx-auto flex max-w-xl flex-col px-4 pt-8 pb-16 main-content">
        <Link href="/" className="mb-4 text-ink hover:text-crimson">
          [← 返回]
        </Link>

        <div className="mb-6 text-center">
          <h1 className="font-ma-shan-zheng text-2xl text-ink">
            【战报回放 · {playerName} vs {opponentName}】
          </h1>
          {record?.createdAt && (
            <p className="mt-1 text-xs text-ink/60">
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
