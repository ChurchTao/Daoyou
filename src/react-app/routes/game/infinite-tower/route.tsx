import {
  GameLoadingState,
  GameSceneFrame,
  GameSceneLoading,
  GameSceneNote,
  GameSceneSection,
  GameSceneTabs,
} from '@app/components/game-shell';
import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkBadge } from '@app/components/ui/InkBadge';
import { InkButton } from '@app/components/ui/InkButton';
import { InkCard } from '@app/components/ui/InkCard';
import { InkSelect } from '@app/components/ui/InkSelect';
import {
  useCultivatorIdentity,
  usePlayerSession,
} from '@app/lib/resources/player';
import type {
  InfiniteTowerBattleContext,
  InfiniteTowerLeaderboardEntry,
  InfiniteTowerState,
} from '@shared/lib/infiniteTower';
import {
  RANKING_REWARDS,
  REALM_VALUES,
  type RealmType,
} from '@shared/types/constants';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';

type StatePayload = { state?: InfiniteTowerState; error?: string };
type ProbePayload = {
  state?: InfiniteTowerState;
  context?: InfiniteTowerBattleContext;
  error?: string;
};
type LeaderboardPayload = {
  entries?: InfiniteTowerLeaderboardEntry[];
  error?: string;
};

function formatStones(value: number) {
  return new Intl.NumberFormat('zh-CN').format(value);
}

function getExpectedReputation(rank: number) {
  if (rank === 1) return RANKING_REWARDS[1];
  if (rank <= 10) return RANKING_REWARDS['2-10'];
  if (rank <= 50) return RANKING_REWARDS['11-50'];
  return RANKING_REWARDS['51-100'];
}

export default function InfiniteTowerPage() {
  const navigate = useNavigate();
  const { pushToast } = useInkUI();
  const session = usePlayerSession();
  const identity = useCultivatorIdentity();
  const cultivator = session.data?.activeCultivator;
  const ownRealm = identity.data?.cultivator.realm;
  const [state, setState] = useState<InfiniteTowerState>();
  const [loadError, setLoadError] = useState<string>();
  const [leaderboard, setLeaderboard] = useState<
    InfiniteTowerLeaderboardEntry[]
  >([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(true);
  const [leaderboardError, setLeaderboardError] = useState<string>();
  const [activeRealm, setActiveRealm] = useState<RealmType | null>(null);
  const [probing, setProbing] = useState(false);
  const selectedRealm = activeRealm ?? ownRealm ?? '炼气';

  useEffect(() => {
    if (!cultivator) return;
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch('/api/infinite-tower/state');
        const payload = (await response.json()) as StatePayload;
        if (!response.ok || !payload.state) {
          throw new Error(payload.error ?? '读取通天塔进度失败');
        }
        if (!cancelled) setState(payload.state);
      } catch (error) {
        if (cancelled) return;
        const message =
          error instanceof Error ? error.message : '读取通天塔进度失败';
        setLoadError(message);
        pushToast({ message, tone: 'danger' });
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [cultivator, pushToast]);

  useEffect(() => {
    if (!cultivator) return;
    let cancelled = false;
    const loadLeaderboard = async () => {
      try {
        setLeaderboardLoading(true);
        setLeaderboardError(undefined);
        const response = await fetch(
          `/api/infinite-tower/leaderboard?realm=${encodeURIComponent(selectedRealm)}&limit=100`,
        );
        const payload = (await response.json()) as LeaderboardPayload;
        if (!response.ok || !payload.entries) {
          throw new Error(payload.error ?? '读取通天塔排行榜失败');
        }
        if (!cancelled) setLeaderboard(payload.entries);
      } catch (error) {
        if (!cancelled) {
          setLeaderboardError(
            error instanceof Error ? error.message : '读取通天塔排行榜失败',
          );
        }
      } finally {
        if (!cancelled) setLeaderboardLoading(false);
      }
    };
    void loadLeaderboard();
    return () => {
      cancelled = true;
    };
  }, [cultivator, selectedRealm]);

  const challenge = async () => {
    try {
      setProbing(true);
      const response = await fetch('/api/infinite-tower/battle/probe', {
        method: 'POST',
      });
      const payload = (await response.json()) as ProbePayload;
      if (!response.ok || !payload.context) {
        throw new Error(payload.error ?? '照见守塔者失败');
      }
      navigate(
        `/game/infinite-tower/battle?battleId=${encodeURIComponent(payload.context.battleId)}`,
      );
    } catch (error) {
      pushToast({
        message: error instanceof Error ? error.message : '照见守塔者失败',
        tone: 'danger',
      });
    } finally {
      setProbing(false);
    }
  };

  if (session.loading || (cultivator && !state && !loadError)) {
    return <GameSceneLoading message="通天塔云阶显化中……" />;
  }

  if (!cultivator) {
    return (
      <GameSceneFrame title="通天塔">
        <GameSceneNote>需先有活跃角色，方可踏上通天云阶。</GameSceneNote>
      </GameSceneFrame>
    );
  }

  if (!state) {
    return (
      <GameSceneFrame title="通天塔">
        <GameSceneNote tone="danger">通天塔进度暂时无法读取。</GameSceneNote>
      </GameSceneFrame>
    );
  }

  const reward = state.currentReward;
  const rule = state.currentRule;

  return (
    <GameSceneFrame
      title="通天塔"
      variant="workflow"
      contentClassName="min-w-0 [&>*+*]:mt-3"
      headerMeta={
        <GameSceneNote>
          云阶无尽，败退不失层数；每层首胜皆有灵石，逢二十、五十层另有符箓。
        </GameSceneNote>
      }
    >
      <InkCard className="mb-0 p-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="border-ink/12 bg-ink/4 border border-dashed px-3 py-2.5">
            <div className="text-battle-muted text-[0.68rem] tracking-[0.14em]">
              当前云阶
            </div>
            <div className="mt-1 font-mono text-lg font-semibold">
              第 {state.currentFloor} 层
            </div>
          </div>
          <div className="border-ink/12 bg-ink/4 border border-dashed px-3 py-2.5">
            <div className="text-battle-muted text-[0.68rem] tracking-[0.14em]">
              历史最高
            </div>
            <div className="mt-1 font-mono text-lg font-semibold">
              {state.highestFloorCleared > 0
                ? `第 ${state.highestFloorCleared} 层`
                : '尚未登塔'}
            </div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <InkBadge tone="accent">
            {rule.realm} · {rule.realmStage}
          </InkBadge>
          {rule.kind !== 'normal' ? (
            <InkBadge tone="danger">
              {rule.kind === 'boss' ? '首领层' : '精英层'}
            </InkBadge>
          ) : null}
          <span className="text-ink-secondary text-sm">
            本层首通：{formatStones(reward.totalReward)} 灵石
          </span>
          {reward.itemRewards.map((item) => (
            <InkBadge key={item.kind} tone="warning">
              {item.name} ×{item.quantity}
            </InkBadge>
          ))}
        </div>
      </InkCard>

      <GameSceneSection title="当前守关">
        <InkCard className="mb-0 space-y-3 p-4">
          <p className="text-ink-secondary text-sm leading-6">
            第 {state.currentFloor}{' '}
            层守塔者已在云上候战。此战以完整气血与灵力入场，自动推演当前人物与灵兽的战斗，胜后进度永久保存。
          </p>
          {reward.bossBonus > 0 ? (
            <p className="text-sm leading-6">
              本层含首领额外奖励 {formatStones(reward.bossBonus)} 灵石。
            </p>
          ) : null}
          <div className="flex justify-end">
            <InkButton
              variant="primary"
              pending={probing}
              onClick={() => void challenge()}
            >
              登阶挑战
            </InkButton>
          </div>
        </InkCard>
      </GameSceneSection>

      <GameSceneSection title="通天留名榜">
        <InkCard className="mb-0 w-full min-w-0 overflow-hidden p-4">
          <p className="text-ink-secondary mb-4 text-sm leading-6">
            九境各自排行。每周一零点分别结算各境前一百名，声望奖励通过传音附件发放；榜位与最高层不会重置。
          </p>
          <div className="mb-4 md:hidden">
            <InkSelect
              value={selectedRealm}
              onChange={(value) => setActiveRealm(value as RealmType)}
              className="w-full"
            >
              {REALM_VALUES.map((realm) => (
                <option key={realm} value={realm}>
                  {realm}榜
                </option>
              ))}
            </InkSelect>
          </div>
          <GameSceneTabs
            className="mb-4 hidden md:block"
            items={REALM_VALUES.map((realm) => ({
              label: `${realm}榜`,
              value: realm,
            }))}
            activeValue={selectedRealm}
            onChange={(value) => setActiveRealm(value as RealmType)}
          />
          {leaderboardLoading ? (
            <GameLoadingState message="正在校准通天榜位……" variant="inline" />
          ) : leaderboardError ? (
            <p className="text-crimson py-4 text-center text-sm">
              {leaderboardError}
            </p>
          ) : leaderboard.length === 0 ? (
            <p className="text-ink-secondary py-6 text-center text-sm">
              {selectedRealm}分榜尚无人登阶留名。
            </p>
          ) : (
            <div className="max-h-96 space-y-3 overflow-y-auto pr-1">
              {leaderboard.map((entry) => (
                <div
                  key={`${selectedRealm}:${entry.cultivatorId}`}
                  className="border-ink/15 grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-dashed pb-3 last:border-b-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <span className="text-crimson min-w-12 text-sm font-semibold">
                        第 {entry.rank} 名
                      </span>
                      <span className="min-w-0 truncate font-semibold">
                        {entry.name}
                        {entry.title ? `「${entry.title}」` : ''}
                      </span>
                      {entry.isSelf ? (
                        <InkBadge tone="accent">本尊</InkBadge>
                      ) : null}
                    </div>
                    <div className="text-ink-secondary mt-1 text-xs">
                      {entry.realm} · {entry.realmStage}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-lg font-semibold">
                      {entry.highestFloor} 层
                    </div>
                    <div className="text-ink-secondary mt-1 text-xs">
                      预计 {getExpectedReputation(entry.rank)} 声望
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </InkCard>
      </GameSceneSection>
    </GameSceneFrame>
  );
}
