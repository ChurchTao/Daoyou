import { ItemDetailModal } from '@app/routes/game/inventory/components/ItemDetailModal';
import type { ItemDetailPayload } from '@app/routes/game/inventory/components/itemDetailPayload';
import { CultivatorInspectionModal } from '@app/components/feature/cultivator-inspection';
import { RankingListItem } from '@app/components/feature/ranking/RankingListItem';
import {
  GameSceneAsideSection,
  GameSceneFrame,
  GameSceneNote,
  GameSceneTabs,
} from '@app/components/game-shell';
import { useInkUI } from '@app/components/providers/InkUIProvider';
import {
  InkButton,
  InkList,
  InkListItem,
  InkNotice,
} from '@app/components/ui';
import { usePlayerStateView } from '@app/lib/player-state/selectors';
import { consumePlayerStateMutation } from '@app/lib/player-state/store';
import { getGameConceptInfo } from '@shared/lib/gameConceptDisplay';
import { RANKING_REWARDS } from '@shared/types/constants';
import type { Cultivator } from '@shared/types/cultivator';
import { ItemRankingEntry, RankingsDisplayItem } from '@shared/types/rankings';
import { useCallback, useEffect, useState } from 'react';
import { toRankingDetailItem } from './rankingDetailItem';
import { useNavigate } from 'react-router';

type MyRankInfo = {
  rank: number | null;
  remainingChallenges: number;
  isProtected: boolean;
};

type LoadingState = 'idle' | 'loading' | 'loaded';

type RankingTab = 'battle' | 'artifact' | 'technique' | 'skill' | 'elixir';
const REPUTATION_INFO = getGameConceptInfo('reputation');

type DirectEntryResponse = {
  type: 'direct_entry';
  rank: number;
  remainingChallenges: number;
};

export default function RankingsPage() {
  const navigate = useNavigate();
  const { pushToast } = useInkUI();
  const { cultivator, isLoading, note } = usePlayerStateView();
  const [activeTab, setActiveTab] = useState<RankingTab>('battle');
  const [rankings, setRankings] = useState<RankingsDisplayItem[]>([]); // Use strict type
  const [myRankInfo, setMyRankInfo] = useState<MyRankInfo | null>(null);
  const [myRankInfoLoadingState, setMyRankInfoLoadingState] =
    useState<LoadingState>('idle');
  const [loadingRankings, setLoadingRankings] = useState(true);
  const [challenging, setChallenging] = useState<string | null>(null);
  const [error, setError] = useState<string>('');
  const [probing, setProbing] = useState<string | null>(null);
  const [inspectedCultivator, setInspectedCultivator] =
    useState<Cultivator | null>(null);
  const [selectedItemDetail, setSelectedItemDetail] =
    useState<ItemDetailPayload | null>(null);

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
    let cancelled = false;

    const loadInitialRankings = async () => {
      try {
        let url = '/api/rankings';
        if (activeTab !== 'battle') {
          url = `/api/rankings/items?type=${activeTab}`;
        }

        const response = await fetch(url);
        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.error || '榜单暂不可用');
        }

        if (cancelled) return;

        setRankings(result.data || []);
        setError('');
      } catch (err) {
        if (cancelled) return;
        console.error('获取排行榜失败:', err);
        const errorMessage = '获取排行榜失败，请稍后重试';
        setError(errorMessage);
        pushToast({ message: errorMessage, tone: 'danger' });
        setRankings([]);
      } finally {
        if (!cancelled) {
          setLoadingRankings(false);
        }
      }
    };

    void loadInitialRankings();

    return () => {
      cancelled = true;
    };
  }, [activeTab, pushToast]);

  useEffect(() => {
    if (!cultivator?.id || activeTab !== 'battle') {
      return;
    }

    let cancelled = false;

    const loadInitialMyRank = async () => {
      try {
        const response = await fetch('/api/rankings/my-rank');
        const result = await response.json();
        if (cancelled) return;

        if (response.ok && result.success) {
          setMyRankInfo({
            rank: result.data.rank,
            remainingChallenges: result.data.remainingChallenges,
            isProtected: result.data.isProtected,
          });
        }
      } catch (err) {
        if (cancelled) return;
        console.error('获取我的排名失败:', err);
        pushToast({ message: '获取排名信息失败', tone: 'danger' });
      } finally {
        if (!cancelled) {
          setMyRankInfoLoadingState('loaded');
        }
      }
    };

    void loadInitialMyRank();

    return () => {
      cancelled = true;
    };
  }, [activeTab, cultivator?.id, pushToast]);

  const handleTabChange = (val: string) => {
    setRankings([]);
    setLoadingRankings(true);
    setActiveTab(val as RankingTab);
  };

  const executeDirectEntry = async () => {
    const data = await consumePlayerStateMutation<DirectEntryResponse>(
      await fetch('/api/rankings/challenge-battle/v5', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          targetId: null,
        }),
      }),
    );
    await Promise.all([loadRankings(activeTab), loadMyRankInfo()]);
    pushToast({
      message: `成功上榜，占据第${data.rank}名！`,
      tone: 'success',
    });
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

      setInspectedCultivator(result.data.cultivator);
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
        await executeDirectEntry();
        return;
      }

      // 验证通过，跳转到挑战战斗页面
      navigate(`/game/battle/challenge?targetId=${targetId}`);
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
      // 验证直接上榜条件，真正上榜只走 v5 mutation。
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

      if (result.data.directEntry) {
        await executeDirectEntry();
        return;
      }

      throw new Error('当前无法直接上榜');
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
      <div className="flex h-full items-center justify-center">
        <p className="loading-tip">万界金榜刷新中……</p>
      </div>
    );
  }

  const myRank = myRankInfo?.rank;
  const remainingChallenges = myRankInfo?.remainingChallenges;
  const isEmpty = rankings.length === 0;
  const isLoadingChallenges = myRankInfoLoadingState !== 'loaded';
  const rankingTabs = [
    { label: '天骄榜', value: 'battle' },
    { label: '法宝榜', value: 'artifact' },
    { label: '功法榜', value: 'technique' },
    { label: '神通榜', value: 'skill' },
    { label: '丹药榜', value: 'elixir' },
  ];
  const activeTabLabel =
    rankingTabs.find((tab) => tab.value === activeTab)?.label ?? '天骄榜';

  return (
    <>
      <GameSceneFrame
        variant="workflow"
        title="【万界金榜】"
        description="战天下英豪，登万界金榜。榜单切换、挑战校验与物品详情都保留原逻辑，只把战况摘要与奖励规则归到侧栏。"
        headerMeta={
          <div className="space-y-2">
            {activeTab === 'battle' && myRankInfo ? (
              <GameSceneNote>
                <p className="text-sm leading-7">
                  我的排名：{myRank ? `第${myRank}名` : '未上榜'} ｜ 今日剩余挑战：
                  {isLoadingChallenges ? '推演中…' : `${remainingChallenges}/10`}
                </p>
              </GameSceneNote>
            ) : null}
            {note || error ? (
              <GameSceneNote tone={error ? 'danger' : 'default'}>
                <p className="text-sm leading-7">{note || error}</p>
              </GameSceneNote>
            ) : null}
          </div>
        }
        aside={
          <>
            <GameSceneAsideSection title="榜单摘要">
              <div className="space-y-2 text-sm leading-7">
                <p>当前榜单：{activeTabLabel}</p>
                <p>
                  {REPUTATION_INFO.label}：{cultivator?.reputation ?? 0}
                </p>
                <p>当前收录：{rankings.length} 条</p>
                {activeTab === 'battle' ? (
                  <p>
                    今日挑战：
                    {isLoadingChallenges
                      ? '推演中…'
                      : `${remainingChallenges ?? 0} / 10`}
                  </p>
                ) : null}
              </div>
            </GameSceneAsideSection>
            <GameSceneAsideSection
              title="结算奖励"
              className="text-sm leading-7"
              help={{
                title: '万界金榜奖励规则',
                content: (
                  <div className="space-y-3">
                    <InkNotice tone="info" className="text-sm">
                      每日凌晨自动结算，根据排名发放声望值。
                    </InkNotice>
                    <InkList dense>
                      <InkListItem
                        title="🏆 第一名"
                        meta={`${RANKING_REWARDS[1]} ${REPUTATION_INFO.label}`}
                      />
                      <InkListItem
                        title="🥈 第二名"
                        meta={`${RANKING_REWARDS[2]} ${REPUTATION_INFO.label}`}
                      />
                      <InkListItem
                        title="🥉 第三名"
                        meta={`${RANKING_REWARDS[3]} ${REPUTATION_INFO.label}`}
                      />
                      <InkListItem
                        title="✨ 第 4-10 名"
                        meta={`${RANKING_REWARDS['4-10']} ${REPUTATION_INFO.label}`}
                      />
                      <InkListItem
                        title="🔹 第 11-50 名"
                        meta={`${RANKING_REWARDS['11-50']} ${REPUTATION_INFO.label}`}
                      />
                      <InkListItem
                        title="🔸 第 51-100 名"
                        meta={`${RANKING_REWARDS['51-100']} ${REPUTATION_INFO.label}`}
                      />
                    </InkList>
                  </div>
                ),
              }}
            >
              <p>
                第一名：{RANKING_REWARDS[1]} {REPUTATION_INFO.label}
              </p>
              <p>
                第二名：{RANKING_REWARDS[2]} {REPUTATION_INFO.label}
              </p>
              <p>
                第三名：{RANKING_REWARDS[3]} {REPUTATION_INFO.label}
              </p>
            </GameSceneAsideSection>
          </>
        }
      >
        <GameSceneTabs
          activeValue={activeTab}
          onChange={handleTabChange}
          items={rankingTabs}
        />
        <div className="flex flex-wrap items-center justify-end gap-2">
          <InkButton
            onClick={() => loadRankings(activeTab)}
            disabled={loadingRankings}
          >
            {loadingRankings ? '推演中…' : '刷新榜单'}
          </InkButton>
        </div>

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
                    viewerRealm={cultivator?.realm}
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
      </GameSceneFrame>

      <CultivatorInspectionModal
        cultivator={inspectedCultivator}
        isOpen={Boolean(inspectedCultivator)}
        onClose={() => setInspectedCultivator(null)}
        mode="cultivator"
      />
      <ItemDetailModal
        item={selectedItemDetail}
        isOpen={Boolean(selectedItemDetail)}
        onClose={() => setSelectedItemDetail(null)}
        viewerRealm={cultivator?.realm}
      />
    </>
  );
}
