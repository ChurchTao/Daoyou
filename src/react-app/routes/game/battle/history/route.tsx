import {
  GameSceneAsideSection,
  GameSceneFrame,
  GameSceneTabs,
} from '@app/components/game-shell';
import Zhanji from '@app/components/func/Zhanji';
import { InkList, InkNotice } from '@app/components/ui';
import { usePlayerStateView } from '@app/lib/player-state/selectors';
import type { BattleRecord } from '@shared/types/battle';
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
  const { cultivator } = usePlayerStateView();

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
    <GameSceneFrame
      variant="lite"
      title="【全部战绩】"
      description="战绩页回归常规场景流，只保留筛选、卷宗列表与回到榜单的路径，不再独立占用旧页壳。"
      aside={
        <>
          <GameSceneAsideSection title="卷宗摘要">
            <div className="space-y-2 text-sm leading-7">
              <p>当前筛选：{activeTab === 'all' ? '全部' : activeTab === 'challenge' ? '我的挑战' : '我被挑战'}</p>
              <p>收录战绩：{records.length} 场</p>
            </div>
          </GameSceneAsideSection>
          <GameSceneAsideSection
            title="查看建议"
            className="text-sm leading-7"
            help={{
              title: '战绩查看建议',
              content: (
                <div className="space-y-2 text-sm leading-7">
                  <p>想继续挑战可回天骄榜；想看单场过程则点入战绩卡片。</p>
                </div>
              ),
            }}
          />
        </>
      }
    >
      <GameSceneTabs
        activeValue={activeTab}
        onChange={(val) => setActiveTab(val as TabType)}
        items={[
          { label: '全部', value: 'all' },
          { label: '我的挑战', value: 'challenge' },
          { label: '我被挑战', value: 'challenged' },
        ]}
      />
      {loading ? (
        <InkNotice>战绩加载中……</InkNotice>
      ) : !records.length ? (
        <InkNotice>暂无战斗记录。</InkNotice>
      ) : (
        <InkList dense className="gap-1">
          {records.map((r) => (
            <Zhanji
              key={r.id}
              record={r}
              currentCultivatorId={cultivator?.id}
            />
          ))}
        </InkList>
      )}
    </GameSceneFrame>
  );
}
