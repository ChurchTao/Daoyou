'use client';

import type { BattleEngineResult } from '@/engine/battleEngine';
import { useCultivatorBundle } from '@/lib/hooks/useCultivatorBundle';
import Link from 'next/link';
import { useEffect, useState } from 'react';

type BattleSummary = {
  id: string;
  createdAt: string | null;
  challengeType?: 'challenge' | 'challenged' | 'normal';
  opponentCultivatorId?: string | null;
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

type TabType = 'all' | 'challenge' | 'challenged';

export default function BattleHistoryPage() {
  const [records, setRecords] = useState<BattleSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const { cultivator } = useCultivatorBundle();

  const fetchBattleHistory = async (type?: TabType) => {
    setLoading(true);
    try {
      const typeParam = type === 'all' ? '' : `&type=${type}`;
      const res = await fetch(`/api/battles?page=1&pageSize=100${typeParam}`, {
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

  useEffect(() => {
    void fetchBattleHistory(activeTab);
  }, [activeTab]);

  const getChallengeTypeLabel = (type?: string) => {
    switch (type) {
      case 'challenge':
        return '← 挑战';
      case 'challenged':
        return '← 被挑战';
      default:
        return '';
    }
  };

  const getChallengeTypeColor = (type?: string) => {
    switch (type) {
      case 'challenge':
        return 'text-blue-600';
      case 'challenged':
        return 'text-purple-600';
      default:
        return 'text-ink/80';
    }
  };

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

        {/* 标签页 */}
        <div className="mb-4 flex gap-2 border-b border-ink/10">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 text-sm transition ${
              activeTab === 'all'
                ? 'border-b-2 border-crimson text-crimson'
                : 'text-ink/60 hover:text-ink'
            }`}
          >
            全部
          </button>
          <button
            onClick={() => setActiveTab('challenge')}
            className={`px-4 py-2 text-sm transition ${
              activeTab === 'challenge'
                ? 'border-b-2 border-crimson text-crimson'
                : 'text-ink/60 hover:text-ink'
            }`}
          >
            我的挑战
          </button>
          <button
            onClick={() => setActiveTab('challenged')}
            className={`px-4 py-2 text-sm transition ${
              activeTab === 'challenged'
                ? 'border-b-2 border-crimson text-crimson'
                : 'text-ink/60 hover:text-ink'
            }`}
          >
            我被挑战
          </button>
        </div>

        {loading && <p className="text-ink-secondary">战绩加载中……</p>}

        {!loading && !records.length && (
          <p className="text-ink-secondary">暂无战斗记录。</p>
        )}

        <div className="mt-4 space-y-3">
          {records.map((r) => {
            const winnerName = r.winner?.name ?? '未知';
            const loserName = r.loser?.name ?? '未知';
            const isWin = cultivator?.id === r.winner?.id;
            const turns = r.turns ?? 0;
            const typeLabel = getChallengeTypeLabel(r.challengeType);
            const typeColor = getChallengeTypeColor(r.challengeType);

            return (
              <Link
                key={r.id}
                href={`/battle/${r.id}`}
                className="block border border-ink/10 bg-white/60 px-3 py-2 text-sm text-ink/80 hover:border-crimson/40 hover:text-ink transition"
              >
                <div className="flex justify-between">
                  <div>
                    <span
                      className={`${typeColor} ${
                        isWin ? 'text-emerald-600' : 'text-crimson'
                      }`}
                    >
                      {isWin ? '【胜】' : '【败】'}
                    </span>
                    <span className="ml-1">
                      {winnerName} vs {loserName}
                    </span>
                    <span className="ml-1">{typeLabel}</span>
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
