import Zhanji from '@app/components/func/Zhanji';
import { InkButton } from '@app/components/ui/InkButton';
import { InkList } from '@app/components/ui/InkList';
import { InkNotice } from '@app/components/ui/InkNotice';
import type { BattleRecord } from '@shared/types/battle';
import { fetchJsonCached } from '@app/lib/client/requestCache';
import { useCultivator } from '@app/lib/contexts/CultivatorContext';
import { useEffect, useState } from 'react';

type BattleSummary = {
  id: string;
  createdAt: string | null;
} & Pick<BattleRecord, 'winner' | 'loser' | 'turns'>;

export function RecentBattles() {
  const [records, setRecords] = useState<BattleSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const { cultivator } = useCultivator();

  useEffect(() => {
    let cancelled = false;

    const fetchRecords = async () => {
      setLoading(true);
      try {
        // 列表接口已改为分页，这里只取第一页前 5 条
        const data = await fetchJsonCached<{
          success: boolean;
          data?: BattleSummary[];
        }>('/api/battle-records/v2?page=1&pageSize=3', {
          key: 'home:recent-battles:v2:page=1&pageSize=3',
          ttlMs: 30 * 1000,
        });
        if (cancelled) return;
        if (data.success && Array.isArray(data.data)) {
          setRecords(data.data);
        }
      } catch (e) {
        if (cancelled) return;
        console.error('获取近期战绩失败:', e);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void fetchRecords();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <InkNotice>近期战绩加载中……</InkNotice>;
  }

  if (!records.length) {
    return <InkNotice>暂无战斗记录。</InkNotice>;
  }

  return (
    <InkList dense>
      {records.map((r) => (
        <Zhanji key={r.id} record={r} currentCultivatorId={cultivator?.id} />
      ))}

      <InkButton href="/game/battle/history">查看全部战绩 →</InkButton>
    </InkList>
  );
}
