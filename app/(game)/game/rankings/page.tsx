'use client';

import { ItemDetailModal } from '@/app/(game)/game/inventory/components/ItemDetailModal';
import type { ItemDetailPayload } from '@/app/(game)/game/inventory/components/itemDetailPayload';
import { RankingListItem } from '@/components/feature/ranking/RankingListItem';
import { formatProbeResultContent } from '@/components/func/ProbeResult';
import { InkModal, InkPageShell } from '@/components/layout';
import { useInkUI } from '@/components/providers/InkUIProvider';
import {
  InkActionGroup,
  InkButton,
  InkDialog,
  type InkDialogState,
  InkList,
  InkListItem,
  InkNotice,
  InkTabs,
} from '@/components/ui';
import { useCultivator } from '@/lib/contexts/CultivatorContext';
import { RANKING_REWARDS } from '@/types/constants';
import { ItemRankingEntry, RankingsDisplayItem } from '@/types/rankings';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { toRankingDetailItem } from './rankingDetailItem';
type MyRankInfo = {
  rank: number | null;
  remainingChallenges: number;
  isProtected: boolean;
};

type LoadingState = 'idle' | 'loading' | 'loaded';

type RankingTab = 'battle' | 'artifact' | 'technique' | 'skill' | 'elixir';

export default function RankingsPage() {
  const router = useRouter();
  const { pushToast } = useInkUI();
  const { cultivator, isLoading, note } = useCultivator();
  const [activeTab, setActiveTab] = useState<RankingTab>('battle');
  const [rankings, setRankings] = useState<RankingsDisplayItem[]>([]); // Use strict type
  const [myRankInfo, setMyRankInfo] = useState<MyRankInfo | null>(null);
  const [myRankInfoLoadingState, setMyRankInfoLoadingState] =
    useState<LoadingState>('idle');
  const [loadingRankings, setLoadingRankings] = useState(false);
  const [challenging, setChallenging] = useState<string | null>(null);
  const [error, setError] = useState<string>('');
  const [probing, setProbing] = useState<string | null>(null);
  const [dialog, setDialog] = useState<InkDialogState | null>(null);
  const [showRules, setShowRules] = useState(false);
  const [selectedItemDetail, setSelectedItemDetail] =
    useState<ItemDetailPayload | null>(null);
  const pathname = usePathname();

  const loadRankings = useCallback(
    async (tab: RankingTab) => {
      setLoadingRankings(true);
      setError('');
      try {
        let url = '/api/rankings';
        if (tab !== 'battle') {
          url = `/api/rankings/items?type=${tab}`;
        }

        const response = await fetch(url);
        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.error || '榜单暂不可用');
        }
        setRankings(result.data || []);
      } catch (err) {
        console.error('获取排行榜失败:', err);
        const errorMessage = '获取排行榜失败，请稍后重试';
        setError(errorMessage);
        pushToast({ message: errorMessage, tone: 'danger' });
        setRankings([]);
      } finally {
        setLoadingRankings(false);
      }
    },
    [pushToast],
  );

  const loadMyRankInfo = useCallback(async () => {
    if (!cultivator?.id) return;

    setMyRankInfoLoadingState('loading');
    try {
      const response = await fetch('/api/rankings/my-rank');
      const result = await response.json();
      if (response.ok && result.success) {
        setMyRankInfo({
          rank: result.data.rank,
          remainingChallenges: result.data.remainingChallenges,
          isProtected: result.data.isProtected,
        });
        setMyRankInfoLoadingState('loaded');
      }
    } catch (err) {
      console.error('获取我的排名失败:', err);
      pushToast({ message: '获取排名信息失败', tone: 'danger' });
      setMyRankInfoLoadingState('loaded');
    }
  }, [cultivator?.id, pushToast]);

  useEffect(() => {
    void loadRankings(activeTab);
  }, [loadRankings, activeTab]);

  useEffect(() => {
    if (cultivator?.id && activeTab === 'battle') {
      void loadMyRankInfo();
    }
  }, [cultivator?.id, loadMyRankInfo, activeTab]);

  const handleTabChange = (val: string) => {
    setRankings([]);
    setLoadingRankings(true);
    setActiveTab(val as RankingTab);
  };

  const handleProbe = async (targetId: string) => {
    if (!cultivator?.id) return;
    setProbing(targetId);
    try {
      const response = await fetch('/api/rankings/probe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          targetId,
        }),
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || '神识查探失败');
      }

      // 设置对话框
      setDialog({
        id: 'probe-result',
        content: formatProbeResultContent(result.data),
        confirmLabel: '关闭',
      });
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : '神识查探失败，请稍后重试';
      pushToast({ message: errorMessage, tone: 'danger' });
    } finally {
      setProbing(null);
    }
  };

  const handleChallenge = async (targetId: string) => {
    if (!cultivator?.id) return;

    setChallenging(targetId);
    try {
      // 先验证挑战条件
      const response = await fetch('/api/rankings/challenge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          targetId,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || '挑战验证失败');
      }

      // 如果是直接上榜，显示提示并刷新
      if (result.data.directEntry) {
        pushToast({
          message: `成功上榜，占据第${result.data.rank}名！`,
          tone: 'success',
        });
        await Promise.all([loadRankings(activeTab), loadMyRankInfo()]);
        return;
      }

      // 验证通过，跳转到挑战战斗页面
      router.push(`/game/battle/challenge?targetId=${targetId}`);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : '挑战验证失败，请稍后重试';
      pushToast({ message: errorMessage, tone: 'danger' });
    } finally {
      setChallenging(null);
    }
  };

  const handleDirectEntry = async () => {
    if (!cultivator?.id) return;

    setChallenging('direct');
    try {
      // 验证直接上榜条件并直接上榜
      const response = await fetch('/api/rankings/challenge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          targetId: null, // null表示直接上榜
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || '上榜失败');
      }

      // 直接上榜成功，刷新排行榜和我的排名信息
      await Promise.all([loadRankings(activeTab), loadMyRankInfo()]);

      // 显示成功提示
      if (result.data.directEntry) {
        pushToast({
          message: `成功上榜，占据第${result.data.rank}名！`,
          tone: 'success',
        });
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : '上榜失败，请稍后重试';
      pushToast({ message: errorMessage, tone: 'danger' });
    } finally {
      setChallenging(null);
    }
  };

  if (isLoading && !cultivator) {
    return (
      <div className="bg-paper flex min-h-screen items-center justify-center">
        <p className="loading-tip">万界金榜刷新中……</p>
      </div>
    );
  }

  const myRank = myRankInfo?.rank;
  const remainingChallenges = myRankInfo?.remainingChallenges;
  const isEmpty = rankings.length === 0;
  const isLoadingChallenges = myRankInfoLoadingState !== 'loaded';

  return (
    <>
      <InkPageShell
        title={`【万界金榜】`}
        subtitle="战天下英豪，登万界金榜"
        lead={
          activeTab === 'battle' && myRankInfo
            ? `我的排名: ${myRank ? `第${myRank}名` : '未上榜'} | 今日剩余挑战: ${isLoadingChallenges ? '推演中…' : `${remainingChallenges}/10`}`
            : ''
        }
        backHref="/game"
        note={note || error}
        currentPath={pathname}
        footer={
          <InkActionGroup align="between">
            <InkButton
              onClick={() => loadRankings(activeTab)}
              disabled={loadingRankings}
            >
              {loadingRankings ? '推演中…' : '刷新榜单'}
            </InkButton>
            <InkButton onClick={() => setShowRules(true)} variant="secondary">
              奖励说明
            </InkButton>
            <InkButton href="/game">返回</InkButton>
          </InkActionGroup>
        }
      >
        <InkTabs
          className="mb-6"
          activeValue={activeTab}
          onChange={handleTabChange}
          items={[
            { label: '天骄榜', value: 'battle' },
            { label: '法宝榜', value: 'artifact' },
            { label: '功法榜', value: 'technique' },
            { label: '神通榜', value: 'skill' },
            { label: '丹药榜', value: 'elixir' },
          ]}
        />

        {!cultivator ? (
          <InkNotice>请先觉醒角色再来挑战万界金榜。</InkNotice>
        ) : loadingRankings ? (
          <div className="text-muted animate-pulse py-12 text-center opacity-80">
            <div>正在推演金榜天机...</div>
          </div>
        ) : isEmpty && myRank === null && activeTab === 'battle' ? (
          <div className="space-y-4">
            <InkNotice>万界金榜当前为空，你可以直接上榜占据第一名！</InkNotice>
            <InkButton
              onClick={handleDirectEntry}
              variant="primary"
              disabled={challenging === 'direct'}
              className="w-full"
            >
              {challenging === 'direct' ? '上榜中…' : '直接上榜'}
            </InkButton>
          </div>
        ) : isEmpty && activeTab !== 'battle' ? (
          <InkNotice>此榜单暂无记录，静待宝物出世。</InkNotice>
        ) : (
          <>
            {activeTab === 'battle' &&
              !isLoadingChallenges &&
              remainingChallenges === 0 && (
                <InkNotice tone="warning">
                  今日挑战次数已用完（每日限10次），请明日再来。
                </InkNotice>
              )}
            <div>
              {rankings.map((item) => {
                const isSelf = item.id === cultivator.id; // For items, id is itemId, so this is false usually.
                // For battle, item.id is cultivatorId.
                const isBattle = activeTab === 'battle';

                // Battle Logic
                const canChallenge =
                  isBattle &&
                  !isSelf &&
                  !isLoadingChallenges &&
                  remainingChallenges !== undefined &&
                  remainingChallenges > 0 &&
                  !item.is_new_comer; // 新天骄不可被挑战

                const isChallenging = challenging === item.id;
                const isProbing = probing === item.id;

                return (
                  <RankingListItem
                    key={item.id}
                    item={item}
                    isSelf={isBattle ? isSelf : false} // Only show "Self" highlight on battle rank for now, or check ownerName
                    canChallenge={canChallenge}
                    isChallenging={isChallenging}
                    isProbing={isProbing}
                    onChallenge={handleChallenge}
                    onProbe={handleProbe}
                    // Pass extra props if component supports them or rely on generic fields
                    // Note: RankingListItem needs to be robust to handle Item data
                    // Item Data: { rank, name, ownerName, score, quality, description }
                    // Battle Data: { rank, name, title, level... }
                    customSubtitle={
                      !isBattle
                        ? `持有者: ${(item as ItemRankingEntry).ownerName}`
                        : undefined
                    }
                    customMeta={
                      !isBattle
                        ? `评分: ${(item as ItemRankingEntry).score}`
                        : undefined
                    }
                    isItem={!isBattle}
                    onViewDetails={
                      !isBattle
                        ? (selectedItem) =>
                            setSelectedItemDetail(
                              toRankingDetailItem(selectedItem),
                            )
                        : undefined
                    }
                  />
                );
              })}
            </div>
          </>
        )}
      </InkPageShell>

      <InkDialog dialog={dialog} onClose={() => setDialog(null)} />
      <ItemDetailModal
        item={selectedItemDetail}
        isOpen={Boolean(selectedItemDetail)}
        onClose={() => setSelectedItemDetail(null)}
      />

      <InkModal
        isOpen={showRules}
        onClose={() => setShowRules(false)}
        title="万界金榜奖励规则"
      >
        <InkNotice tone="info" className="text-sm">
          每日凌晨自动结算，根据排名发放灵石奖励。
        </InkNotice>
        <InkList dense>
          <InkListItem title="🏆 第一名" meta={`${RANKING_REWARDS[1]} 灵石`} />
          <InkListItem title="🥈 第二名" meta={`${RANKING_REWARDS[2]} 灵石`} />
          <InkListItem title="🥉 第三名" meta={`${RANKING_REWARDS[3]} 灵石`} />
          <InkListItem
            title="✨ 第 4-10 名"
            meta={`${RANKING_REWARDS['4-10']} 灵石`}
          />
          <InkListItem
            title="🔹 第 11-50 名"
            meta={`${RANKING_REWARDS['11-50']} 灵石`}
          />
          <InkListItem
            title="🔸 第 51-100 名"
            meta={`${RANKING_REWARDS['51-100']} 灵石`}
          />
        </InkList>
      </InkModal>
    </>
  );
}
