'use client';

import type { BattleEngineResult } from '@/engine/battleEngine';
import Link from 'next/link';
import { useEffect, useState } from 'react';

type BattleSummary = {
  id: string;
  createdAt: string | null;
} & Pick<BattleEngineResult, 'winner' | 'loser' | 'turns'>;

export function RecentBattles() {
  const [records, setRecords] = useState<BattleSummary[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchRecords = async () => {
      setLoading(true);
      try {
        // 列表接口已改为分页，这里只取第一页前 5 条
        const res = await fetch('/api/battles?page=1&pageSize=5', {
          cache: 'no-store',
        });
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
    return <p className="text-sm text-ink-secondary">近期战绩加载中……</p>;
  }

  if (!records.length) {
    return <p className="text-sm text-ink-secondary">暂无战斗记录。</p>;
  }

  return (
    <div className="space-y-2 text-sm">
      {records.map((r) => {
        const winnerName = r.winner?.name ?? '未知';
        const loserName = r.loser?.name ?? '未知';
        const isWin = !!r.winner?.name && !!r.loser?.name;
        const turns = r.turns ?? 0;

        return (
          <Link
            key={r.id}
            href={`/battle/${r.id}`}
            className="block text-ink/80 hover:text-crimson transition"
          >
            <span className={isWin ? 'text-emerald-600' : 'text-crimson'}>
              {isWin ? '胜' : '战斗'}
            </span>
            <span className="mx-1">·</span>
            <span>
              {winnerName} vs {loserName}
            </span>
            {turns > 0 && (
              <>
                <span className="mx-1">·</span>
                <span>{turns} 回合</span>
              </>
            )}
            {r.createdAt && (
              <>
                <span className="mx-1">·</span>
                <span className="text-ink/50">
                  {new Date(r.createdAt).toLocaleString()}
                </span>
              </>
            )}
          </Link>
        );
      })}

      <div className="pt-1">
        <Link
          href="/battle/history"
          className="text-xs text-ink-secondary hover:text-ink"
        >
          查看全部战绩 →
        </Link>
      </div>
    </div>
  );
}
