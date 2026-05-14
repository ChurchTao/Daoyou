import Zhanji from '@app/components/func/Zhanji';
import { InkTabs } from '@app/components/ui/InkTabs';
import type { BattleRecord } from '@shared/types/battle';
import { useCultivator } from '@app/lib/contexts/CultivatorContext';
import Link from '@app/components/router/AppLink';
import { useEffect, useState } from 'react';

type BattleSummary = {
  id: string;
  createdAt: string | null;
  battleType?: 'challenge' | 'challenged' | 'normal';
  opponentCultivatorId?: string | null;
} & Pick<BattleRecord, 'winner' | 'loser' | 'turns'>;

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
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const { cultivator } = useCultivator();

  useEffect(() => {
    let cancelled = false;

    const loadBattleHistory = async () => {
      try {
        const typeParam = activeTab === 'all' ? '' : `&type=${activeTab}`;
        const res = await fetch(
          `/api/battle-records/v2?page=1&pageSize=100${typeParam}`,
          { cache: 'no-store' },
        );
        if (!res.ok || cancelled) return;

        const data = (await res.json()) as BattleListResponse;
        if (cancelled) return;

        if (data.success && Array.isArray(data.data)) {
          setRecords(data.data);
        }
      } catch (e) {
        if (!cancelled) {
          console.error('获取战斗历史失败:', e);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadBattleHistory();

    return () => {
      cancelled = true;
    };
  }, [activeTab]);

  return (
    <div className="bg-paper min-h-screen">
      <div className="main-content mx-auto max-w-xl px-4 pt-8 pb-16">
        <Link
          href="/game"
          className="text-ink hover:text-crimson mb-4 inline-block"
        >
          [← 返回]
        </Link>

        <h1 className="font-ma-shan-zheng text-ink mb-4 text-2xl">
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
