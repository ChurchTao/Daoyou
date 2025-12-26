'use client';

import { InkTabs } from '@/components/InkComponents';
import Zhanji from '@/components/func/Zhanji';
import type { BattleEngineResult } from '@/engine/battle';
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
        <InkTabs
          className="mb-4"
          activeValue={activeTab}
          onChange={(val) => setActiveTab(val as TabType)}
          items={[
            { label: '全部', value: 'all' },
            { label: '我的挑战', value: 'challenge' },
            { label: '我被挑战', value: 'challenged' },
          ]}
        />

        {loading && <p className="text-ink-secondary">战绩加载中……</p>}

        {!loading && !records.length && (
          <p className="text-ink-secondary">暂无战斗记录。</p>
        )}

        {!loading && (
          <div className="mt-4 space-y-3">
            {records.map((r) => (
              <Zhanji
                key={r.id}
                record={r}
                currentCultivatorId={cultivator?.id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
