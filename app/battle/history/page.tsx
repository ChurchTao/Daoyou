'use client';

import type { BattleEngineResult } from '@/engine/battleEngine';
import Link from 'next/link';
import { useEffect, useState } from 'react';

type BattleSummary = {
  id: string;
  createdAt: string | null;
} & Pick<BattleEngineResult, 'winner' | 'loser' | 'turns'>;

type BattleListResponse = {
  success: boolean;
  data: BattleSummary[];
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

export default function BattleHistoryPage() {
  const [records, setRecords] = useState<BattleSummary[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchBattleHistory = async () => {
      setLoading(true);
      try {
        // 简单取第一页 100 条
        const res = await fetch('/api/battles?page=1&pageSize=100', {
          cache: 'no-store',
        });
        if (!res.ok) return;
        const data = (await res.json()) as BattleListResponse;
        if (data.success && Array.isArray(data.data)) {
          setRecords(data.data);
        }
      } catch (e) {
        console.error('获取战斗历史失败:', e);
      } finally {
        setLoading(false);
      }
    };

    fetchBattleHistory();
  }, []);

  return (
    <div className="bg-paper min-h-screen">
      <div className="main-content mx-auto max-w-xl px-4 pt-8 pb-16">
        <Link
          href="/"
          className="mb-4 inline-block text-ink hover:text-crimson"
        >
          [← 返回]
        </Link>

        <h1 className="mb-4 font-ma-shan-zheng text-2xl text-ink">
          【全部战绩】
        </h1>

        {loading && <p className="text-ink-secondary">战绩加载中……</p>}

        {!loading && !records.length && (
          <p className="text-ink-secondary">暂无战斗记录。</p>
        )}

        <div className="mt-4 space-y-3">
          {records.map((r) => {
            const winnerName = r.winner?.name ?? '未知';
            const loserName = r.loser?.name ?? '未知';
            const isWin = !!r.winner?.name && !!r.loser?.name;
            const turns = r.turns ?? 0;

            return (
              <Link
                key={r.id}
                href={`/battle/${r.id}`}
                className="block border border-ink/10 bg-white/60 px-3 py-2 text-sm text-ink/80 hover:border-crimson/40 hover:text-ink transition"
              >
                <div className="flex justify-between">
                  <div>
                    <span
                      className={isWin ? 'text-emerald-600' : 'text-crimson'}
                    >
                      {isWin ? '【胜】' : '【战】'}
                    </span>
                    <span className="ml-1">
                      {winnerName} vs {loserName}
                    </span>
                  </div>
                  {r.createdAt && (
                    <span className="text-ink/50 text-xs">
                      {new Date(r.createdAt).toLocaleString()}
                    </span>
                  )}
                </div>
                {turns > 0 && (
                  <div className="mt-1 text-xs text-ink/60">
                    共 {turns} 回合 · 点击查看战报回放
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
