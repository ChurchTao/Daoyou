import {
  ItemDetailModal,
  type ItemDetailPayload,
} from '@app/components/feature/items';
import { CultivatorInspectionModal } from '@app/components/feature/cultivator-inspection';
import {
  BattleRankingCard,
  ItemRankingCard,
} from '@app/components/feature/ranking/RankingListItem';
import {
  GameSceneAsideSection,
  GameSceneFrame,
  GameSceneNote,
  GameSceneSection,
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
import { cn } from '@shared/lib/cn';
import { getGameConceptInfo } from '@shared/lib/gameConceptDisplay';
import {
  RANKING_REWARDS,
  REALM_VALUES,
  type RealmType,
} from '@shared/types/constants';
import type { Cultivator } from '@shared/types/cultivator';
import type {
  BattleRankingItem,
  ItemRankingEntry,
  RankingsDisplayItem,
} from '@shared/types/rankings';
import { useCallback, useEffect, useState } from 'react';
import { toRankingDetailItem } from './rankingDetailItem';
import { useNavigate, useSearchParams } from 'react-router';

type MyRankInfo = {
  rank: number | null;
  remainingChallenges: number;
};

type LoadingState = 'idle' | 'loading' | 'loaded';

type RankingTab = 'battle' | 'artifact' | 'technique' | 'skill' | 'elixir';
const REPUTATION_INFO = getGameConceptInfo('reputation');
const REPUTATION_LABEL = `${REPUTATION_INFO.icon} ${REPUTATION_INFO.label}`;

type DirectEntryResponse = {
  type: 'direct_entry';
  realm: RealmType;
  rank: number;
  remainingChallenges: number;
};

function resolveRealm(value?: string | null): RealmType {
  return REALM_VALUES.includes(value as RealmType)
    ? (value as RealmType)
    : '炼气';
}

function getExpectedRankingReputation(rank: number | null | undefined) {
  if (!rank) return null;
  if (rank === 1) return RANKING_REWARDS[1];
  if (rank <= 10) return RANKING_REWARDS['2-10'];
  if (rank <= 50) return RANKING_REWARDS['11-50'];
  if (rank <= 100) return RANKING_REWARDS['51-100'];
  return null;
}

function MyChallengeLedger({
  activeRealm,
  myRank,
  remainingChallenges,
  isLoadingChallenges,
}: {
  activeRealm: RealmType;
  myRank: number | null | undefined;
  remainingChallenges: number | undefined;
  isLoadingChallenges: boolean;
}) {
  const rankLabel = myRank ? `第 ${myRank} 名` : '未留名';
  const challengeLabel = isLoadingChallenges
    ? '推演中'
    : `${remainingChallenges ?? 0} / 10`;
  const expectedReputation = getExpectedRankingReputation(myRank);

  return (
    <div className="scrollbar-ink overflow-x-auto border border-dashed border-crimson/20">
      <div className="flex min-w-max items-center text-sm leading-6 whitespace-nowrap">
        <div className="px-3 py-2">
          <span className="text-battle-muted text-xs">分榜</span>
          <span className="ml-2 font-semibold text-ink">{activeRealm}</span>
        </div>
        <div className="px-3 py-2">
          <span className="text-battle-muted text-xs">排名</span>
          <span className="ml-2 font-semibold text-ink">{rankLabel}</span>
        </div>
        <div className="px-3 py-2">
          <span className="text-battle-muted text-xs">挑战次数</span>
          <span className="ml-2 font-semibold text-ink">{challengeLabel}</span>
        </div>
        <div className="px-3 py-2">
          <span className="text-battle-muted text-xs">
            {REPUTATION_INFO.icon} 预计声望
          </span>
          <span className="ml-2 font-semibold text-ink">
            {expectedReputation ?? '--'}
          </span>
        </div>
      </div>
    </div>
  );
}

function RealmTokenBar({
  activeRealm,
  ownRealm,
  onChange,
}: {
  activeRealm: RealmType;
  ownRealm?: RealmType;
  onChange: (realm: RealmType) => void;
}) {
  return (
    <div className="scrollbar-ink -mx-1 flex min-w-0 gap-2 overflow-x-auto px-1 pb-1">
      {REALM_VALUES.map((realm) => {
        const isActive = activeRealm === realm;
        const isOwnRealm = ownRealm === realm;

        return (
          <button
            key={realm}
            type="button"
            onClick={() => onChange(realm)}
            aria-pressed={isActive}
            className={cn(
              'shrink-0 border px-3 py-2 text-sm leading-5 transition-colors',
              isActive
                ? 'border-crimson/45 bg-crimson/8 text-crimson'
                : 'border-ink/15 bg-paper/60 text-ink-secondary hover:border-crimson/30 hover:text-ink',
            )}
          >
            <span className="font-semibold">{realm}</span>
            {isOwnRealm ? (
              <span className="ml-2 text-xs text-battle-muted">本境</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

function RankingEmptyState({
  activeTab,
  activeRealm,
  canDirectEntry,
  challenging,
  onDirectEntry,
}: {
  activeTab: RankingTab;
  activeRealm: RealmType;
  canDirectEntry: boolean;
  challenging: boolean;
  onDirectEntry: () => void;
}) {
  if (canDirectEntry) {
    return (
      <div className="border border-crimson/20 bg-crimson/6 px-4 py-5 text-center">
        <p className="text-base font-semibold text-ink">
          {activeRealm}天骄榜尚无席位
        </p>
        <p className="mt-2 text-sm leading-6 text-ink-secondary">
          此境金榜初开，可直接登榜留名。
        </p>
        <div className="mt-4">
          <InkButton
            onClick={onDirectEntry}
            variant="primary"
            disabled={challenging}
          >
            {challenging ? '登榜中' : '登榜留名'}
          </InkButton>
        </div>
      </div>
    );
  }

  return (
    <InkNotice>
      {activeTab === 'battle'
        ? `${activeRealm}天骄榜暂无记录。越境榜单不可直接上榜，需等待本境修士留名后方可切磋。`
        : '此榜单暂无记录，静待宝物出世。'}
    </InkNotice>
  );
}

export default function RankingsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
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
  const activeRealm = resolveRealm(searchParams.get('realm') ?? cultivator?.realm);

  const loadRankings = useCallback(
    async (tab: RankingTab, realm: RealmType = activeRealm) => {
      setLoadingRankings(true);
      setError('');
      try {
        let url = `/api/rankings?realm=${encodeURIComponent(realm)}`;
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
    [activeRealm, pushToast],
  );

  const loadMyRankInfo = useCallback(async (realm: RealmType = activeRealm) => {
    if (!cultivator?.id) return;

    setMyRankInfoLoadingState('loading');
    try {
      const response = await fetch(
        `/api/rankings/my-rank?realm=${encodeURIComponent(realm)}`,
      );
      const result = await response.json();
        if (response.ok && result.success) {
          setMyRankInfo({
            rank: result.data.rank,
            remainingChallenges: result.data.remainingChallenges,
          });
          setMyRankInfoLoadingState('loaded');
        }
    } catch (err) {
      console.error('获取我的排名失败:', err);
      pushToast({ message: '获取排名信息失败', tone: 'danger' });
      setMyRankInfoLoadingState('loaded');
    }
  }, [activeRealm, cultivator?.id, pushToast]);

  useEffect(() => {
    let cancelled = false;

    const loadInitialRankings = async () => {
      try {
        let url = `/api/rankings?realm=${encodeURIComponent(activeRealm)}`;
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
  }, [activeRealm, activeTab, pushToast]);

  useEffect(() => {
    if (!cultivator?.id || activeTab !== 'battle') {
      return;
    }

    let cancelled = false;

    const loadInitialMyRank = async () => {
      try {
        const response = await fetch(
          `/api/rankings/my-rank?realm=${encodeURIComponent(activeRealm)}`,
        );
        const result = await response.json();
        if (cancelled) return;

        if (response.ok && result.success) {
          setMyRankInfo({
            rank: result.data.rank,
            remainingChallenges: result.data.remainingChallenges,
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
  }, [activeRealm, activeTab, cultivator?.id, pushToast]);

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
          realm: activeRealm,
        }),
      }),
    );
    await Promise.all([
      loadRankings(activeTab, activeRealm),
      loadMyRankInfo(activeRealm),
    ]);
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
          realm: activeRealm,
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
          realm: activeRealm,
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
      const params = new URLSearchParams({
        targetId,
        realm: activeRealm,
      });
      navigate(`/game/battle/challenge?${params.toString()}`);
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
          realm: activeRealm,
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
  const isOwnRealmRanking = activeRealm === resolveRealm(cultivator?.realm);
  const ownRealm = cultivator?.realm ? resolveRealm(cultivator.realm) : undefined;
  const rankingTabs = [
    { label: '天骄榜', value: 'battle' },
    { label: '法宝榜', value: 'artifact' },
    { label: '功法榜', value: 'technique' },
    { label: '神通榜', value: 'skill' },
    { label: '丹药榜', value: 'elixir' },
  ];
  const activeTabLabel =
    rankingTabs.find((tab) => tab.value === activeTab)?.label ?? '天骄榜';
  const podiumEntries = rankings.slice(0, 3);
  const listEntries = rankings.slice(3);
  const canDirectEntry =
    isEmpty && myRank === null && activeTab === 'battle' && isOwnRealmRanking;

  const resolveChallengeReason = (isSelf: boolean) => {
    if (isSelf) return undefined;
    if (isLoadingChallenges) return '挑战次数载入中';
    if (remainingChallenges === 0) return '今日挑战次数已尽';
    return undefined;
  };

  const canChallengeItem = (isSelf: boolean) =>
    activeTab === 'battle' &&
    !isSelf &&
    !isLoadingChallenges &&
    remainingChallenges !== undefined &&
    remainingChallenges > 0;

  return (
    <>
      <GameSceneFrame
        variant="workflow"
        title="【万界金榜】"
        description={
          activeTab === 'battle'
            ? '择敌、查探、挑战，一切夺位都从榜前决断。'
            : '诸般名器留影于榜，观其品阶、评分与持有者。'
        }
        headerMeta={
          activeTab === 'battle' || note || error ? (
            <div className="space-y-2">
              {activeTab === 'battle' ? (
                <MyChallengeLedger
                  activeRealm={activeRealm}
                  myRank={myRank}
                  remainingChallenges={remainingChallenges}
                  isLoadingChallenges={isLoadingChallenges}
                />
              ) : null}
              {note || error ? (
                <GameSceneNote tone={error ? 'danger' : 'default'}>
                  <p className="text-sm leading-7">{note || error}</p>
                </GameSceneNote>
              ) : null}
            </div>
          ) : null
        }
        aside={
          <>
            <GameSceneAsideSection
              title={activeTab === 'battle' ? '我的挑战' : '榜单摘要'}
            >
              <div className="space-y-2 text-sm leading-7">
                <p>榜种：{activeTabLabel}</p>
                {activeTab === 'battle' ? <p>当前分榜：{activeRealm}</p> : null}
                <p>
                  {REPUTATION_LABEL}：{cultivator?.reputation ?? 0}
                </p>
                <p>
                  当前收录：{rankings.length} {activeTab === 'battle' ? '条' : '件'}
                </p>
                {activeTab === 'battle' ? (
                  <p>
                    今日挑战次数：
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
                      每周一凌晨分别结算各大境界分榜；同境界胜者夺位，越境切磋不改名次。
                    </InkNotice>
                    <InkList dense>
                      <InkListItem
                        title="第一名"
                        meta={`${RANKING_REWARDS[1]} ${REPUTATION_LABEL}`}
                      />
                      <InkListItem
                        title="第 2-10 名"
                        meta={`${RANKING_REWARDS['2-10']} ${REPUTATION_LABEL}`}
                      />
                      <InkListItem
                        title="第 11-50 名"
                        meta={`${RANKING_REWARDS['11-50']} ${REPUTATION_LABEL}`}
                      />
                      <InkListItem
                        title="第 51-100 名"
                        meta={`${RANKING_REWARDS['51-100']} ${REPUTATION_LABEL}`}
                      />
                    </InkList>
                  </div>
                ),
              }}
            >
              <p>
                {activeTab === 'battle' && myRank
                  ? `当前排名预计结算 ${getExpectedRankingReputation(myRank) ?? '--'} ${REPUTATION_LABEL}`
                  : `天骄榜留名后可参与每周${REPUTATION_LABEL}结算。`}
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
        {activeTab === 'battle' ? (
          <RealmTokenBar
            activeRealm={activeRealm}
            ownRealm={ownRealm}
            onChange={(nextRealm) => {
              setRankings([]);
              setMyRankInfo(null);
              setMyRankInfoLoadingState('idle');
              setLoadingRankings(true);
              setSearchParams((prev) => {
                const next = new URLSearchParams(prev);
                next.set('realm', nextRealm);
                return next;
              });
            }}
          />
        ) : null}

        {!cultivator ? (
          <InkNotice>请先觉醒角色再来挑战万界金榜。</InkNotice>
        ) : loadingRankings ? (
          <div className="text-muted animate-pulse py-12 text-center opacity-80">
            <div>正在推演金榜天机...</div>
          </div>
        ) : isEmpty ? (
          <RankingEmptyState
            activeTab={activeTab}
            activeRealm={activeRealm}
            canDirectEntry={canDirectEntry}
            challenging={challenging === 'direct'}
            onDirectEntry={handleDirectEntry}
          />
        ) : (
          <>
            {activeTab === 'battle' &&
              !isLoadingChallenges &&
              remainingChallenges === 0 && (
                <InkNotice tone="warning">
                  今日挑战次数已用完（每日限10次），请明日再来。
                </InkNotice>
              )}
            {activeTab === 'battle' ? (
              <>
                {podiumEntries.length > 0 ? (
                  <GameSceneSection title="榜首三席">
                    <div className="grid gap-3">
                      {(podiumEntries as BattleRankingItem[]).map((item) => {
                        const isSelf = item.id === cultivator.id;
                        const canChallenge = canChallengeItem(isSelf);
                        return (
                          <BattleRankingCard
                            key={item.id}
                            item={item}
                            isSelf={isSelf}
                            canChallenge={canChallenge}
                            challengeUnavailableReason={resolveChallengeReason(
                              isSelf,
                            )}
                            isChallenging={challenging === item.id}
                            isProbing={probing === item.id}
                            onChallenge={handleChallenge}
                            onProbe={handleProbe}
                            variant="podium"
                          />
                        );
                      })}
                    </div>
                  </GameSceneSection>
                ) : null}

                {listEntries.length > 0 ? (
                  <GameSceneSection title="榜单名录">
                    <div className="grid gap-3">
                      {(listEntries as BattleRankingItem[]).map((item) => {
                        const isSelf = item.id === cultivator.id;
                        const canChallenge = canChallengeItem(isSelf);
                        return (
                          <BattleRankingCard
                            key={item.id}
                            item={item}
                            isSelf={isSelf}
                            canChallenge={canChallenge}
                            challengeUnavailableReason={resolveChallengeReason(
                              isSelf,
                            )}
                            isChallenging={challenging === item.id}
                            isProbing={probing === item.id}
                            onChallenge={handleChallenge}
                            onProbe={handleProbe}
                          />
                        );
                      })}
                    </div>
                  </GameSceneSection>
                ) : null}
              </>
            ) : (
              <>
                {podiumEntries.length > 0 ? (
                  <GameSceneSection title="镇榜之物">
                    <div className="grid gap-3">
                      {(podiumEntries as ItemRankingEntry[]).map((item) => (
                        <ItemRankingCard
                          key={item.id}
                          item={item}
                          viewerRealm={cultivator?.realm}
                          onViewDetails={(selectedItem) =>
                            setSelectedItemDetail(
                              toRankingDetailItem(selectedItem),
                            )
                          }
                          variant="podium"
                        />
                      ))}
                    </div>
                  </GameSceneSection>
                ) : null}

                {listEntries.length > 0 ? (
                  <GameSceneSection title="珍宝名录">
                    <div className="grid gap-3">
                      {(listEntries as ItemRankingEntry[]).map((item) => (
                        <ItemRankingCard
                          key={item.id}
                          item={item}
                          viewerRealm={cultivator?.realm}
                          onViewDetails={(selectedItem) =>
                            setSelectedItemDetail(
                              toRankingDetailItem(selectedItem),
                            )
                          }
                        />
                      ))}
                    </div>
                  </GameSceneSection>
                ) : null}
              </>
            )}
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
