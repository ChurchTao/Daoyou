'use client';

import type { BattleEngineResult } from '@/engine/battleEngine';
import { useCultivatorBundle } from '@/lib/hooks/useCultivatorBundle';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { InkButton, InkList, InkListItem, InkNotice } from './InkComponents';

type BattleSummary = {
  id: string;
  createdAt: string | null;
} & Pick<BattleEngineResult, 'winner' | 'loser' | 'turns'>;

export function RecentBattles() {
  const [records, setRecords] = useState<BattleSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const { cultivator } = useCultivatorBundle();

  useEffect(() => {
    const fetchRecords = async () => {
      setLoading(true);
      try {
        // 列表接口已改为分页，这里只取第一页前 5 条
        const res = await fetch('/api/battles?page=1&pageSize=3');
        const data = await res.json();
        if (data.success && Array.isArray(data.data)) {
          setRecords(data.data);
        }
      } catch (e) {
        console.error('获取近期战绩失败:', e);
      } finally {
        setLoading(false);
      }
    };

    fetchRecords();
  }, []);

  if (loading) {
    return <InkNotice tone="info">近期战绩加载中……</InkNotice>;
  }

  if (!records.length) {
    return <InkNotice>暂无战斗记录。</InkNotice>;
  }

  return (
    <InkList dense>
      {records.map((r) => {
        const winnerName = r.winner?.name ?? '未知';
        const loserName = r.loser?.name ?? '未知';
        const isWin = cultivator?.id === r.winner?.id;
        const turns = r.turns ?? 0;
        const battleTime = r.createdAt
          ? new Date(r.createdAt).toLocaleString()
          : undefined;

        return (
          <Link key={r.id} href={`/battle/${r.id}`} className="ink-list-link">
            <InkListItem
              title={`${isWin ? '✓ 胜' : '✗ 败'} ${winnerName} vs ${loserName}`}
              meta={turns ? `${turns} 回合` : undefined}
              description={battleTime}
            />
          </Link>
        );
      })}

      <InkButton href="/battle/history">查看全部战绩 →</InkButton>
    </InkList>
  );
}
