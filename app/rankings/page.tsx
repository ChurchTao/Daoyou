'use client';

import { ProbeResultModal } from '@/components/func';
import type { ProbeResultData } from '@/components/func/ProbeResult';
import {
  InkActionGroup,
  InkButton,
  InkNotice,
} from '@/components/InkComponents';
import { InkPageShell } from '@/components/InkLayout';
import { useInkUI } from '@/components/InkUIProvider';
import { RankingListItem } from '@/components/RankingListItem';
import { useCultivatorBundle } from '@/lib/hooks/useCultivatorBundle';
import { RankingItem } from '@/lib/redis/rankings';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

type MyRankInfo = {
  rank: number | null;
  remainingChallenges: number;
  isProtected: boolean;
};

type LoadingState = 'idle' | 'loading' | 'loaded';

export default function RankingsPage() {
  const router = useRouter();
  const { pushToast } = useInkUI();
  const { cultivator, isLoading, note } = useCultivatorBundle();
  const [rankings, setRankings] = useState<RankingItem[]>([]);
  const [myRankInfo, setMyRankInfo] = useState<MyRankInfo | null>(null);
  const [myRankInfoLoadingState, setMyRankInfoLoadingState] =
    useState<LoadingState>('idle');
  const [loadingRankings, setLoadingRankings] = useState(false);
  const [challenging, setChallenging] = useState<string | null>(null);
  const [error, setError] = useState<string>('');
  const [probing, setProbing] = useState<string | null>(null);
  const [probeResult, setProbeResult] = useState<ProbeResultData | null>(null);
  const pathname = usePathname();

  const loadRankings = async () => {
    setLoadingRankings(true);
    setError('');
    try {
      const response = await fetch('/api/rankings');
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
  };

  const loadMyRankInfo = useCallback(async () => {
    if (!cultivator?.id) return;

    setMyRankInfoLoadingState('loading');
    try {
      const response = await fetch(
        `/api/rankings/my-rank?cultivatorId=${cultivator.id}`,
      );
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
    void loadRankings();
  }, []);

  useEffect(() => {
    if (cultivator?.id) {
      void loadMyRankInfo();
    }
  }, [cultivator?.id, loadMyRankInfo]);

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
          cultivatorId: cultivator.id,
          targetId,
        }),
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || '神识查探失败');
      }
      setProbeResult(result.data);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : '神识查探失败，请稍后重试';
      pushToast({ message: errorMessage, tone: 'danger' });
      setProbeResult(null);
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
          cultivatorId: cultivator.id,
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
        await Promise.all([loadRankings(), loadMyRankInfo()]);
        return;
      }

      // 验证通过，跳转到挑战战斗页面
      router.push(
        `/battle/challenge?cultivatorId=${cultivator.id}&targetId=${targetId}`,
      );
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
          cultivatorId: cultivator.id,
          targetId: null, // null表示直接上榜
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || '上榜失败');
      }

      // 直接上榜成功，刷新排行榜和我的排名信息
      await Promise.all([loadRankings(), loadMyRankInfo()]);

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
      <div className="bg-paper min-h-screen flex items-center justify-center">
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
          myRankInfo
            ? `我的排名: ${myRank ? `第${myRank}名` : '未上榜'} | 今日剩余挑战: ${isLoadingChallenges ? '推演中…' : `${remainingChallenges}/10`}`
            : ''
        }
        backHref="/"
        note={note || error}
        currentPath={pathname}
        footer={
          <InkActionGroup align="between">
            <InkButton
              onClick={() => loadRankings()}
              disabled={loadingRankings}
            >
              {loadingRankings ? '推演中…' : '刷新榜单'}
            </InkButton>
            <InkButton href="/">返回</InkButton>
          </InkActionGroup>
        }
      >
        {!cultivator ? (
          <InkNotice>请先觉醒角色再来挑战万界金榜。</InkNotice>
        ) : isEmpty && myRank === null ? (
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
        ) : (
          <>
            {!isLoadingChallenges && remainingChallenges === 0 && (
              <InkNotice tone="warning">
                今日挑战次数已用完（每日限10次），请明日再来。
              </InkNotice>
            )}
            <div>
              {rankings.map((item) => {
                const isSelf = item.id === cultivator.id;
                const canChallenge =
                  !isSelf &&
                  (!myRank || myRank > item.rank) &&
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
                    isSelf={isSelf}
                    canChallenge={canChallenge}
                    isChallenging={isChallenging}
                    isProbing={isProbing}
                    onChallenge={handleChallenge}
                    onProbe={handleProbe}
                  />
                );
              })}
            </div>
          </>
        )}
      </InkPageShell>
      <ProbeResultModal
        probeResult={probeResult}
        onClose={() => setProbeResult(null)}
      />
    </>
  );
}
