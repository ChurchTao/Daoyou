import { useInkUI } from '@app/components/providers/InkUIProvider';
import { CultivatorInspectionModal } from '@app/components/feature/cultivator-inspection';
import {
  GameSceneFrame,
  GameSceneLoading,
  GameSceneNote,
  GameSceneSection,
} from '@app/components/game-shell';
import { useCultivator } from '@app/lib/contexts/CultivatorContext';
import {
  useTowerActions,
  type TowerProbeResponse,
} from '@app/lib/hooks/tower/useTowerActions';
import { useTowerLeaderboard } from '@app/lib/hooks/tower/useTowerLeaderboard';
import { useTowerState } from '@app/lib/hooks/tower/useTowerState';
import {
  getTowerBlessingDefinition,
  getTowerBlessingEffectPreview,
  resolveTowerFloorKind,
  resolveTowerMilestoneTier,
  isTowerRealmEligible,
  TOWER_ELIGIBLE_REALMS,
  TOWER_DIFFICULTY_STEP,
  TOWER_MAX_FLOOR,
  TOWER_MIN_REALM,
  type TowerBlessingId,
  type TowerSeasonMeta,
  type TowerSettlement,
  type TowerState,
} from '@shared/lib/tower';
import { getConditionStatusTemplate } from '@shared/lib/conditionStatusRegistry';
import type { RealmType } from '@shared/types/constants';
import { InkButton } from '@app/components/ui/InkButton';
import { InkBadge } from '@app/components/ui/InkBadge';
import { InkCard } from '@app/components/ui/InkCard';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { TowerBlessingDetailModal } from './components/TowerBlessingDetailModal';
import { TowerLeaderboard } from './components/TowerLeaderboard';
import {
  describeEncounterLabel,
  formatDepthLabel,
  formatSeasonReset,
} from './utils';

const TOWER_SCENE_NAME = '蜃楼幻境';

function buildScenePulse(season?: TowerSeasonMeta) {
  if (!season) {
    return null;
  }

  return `下次境门改换：${formatSeasonReset(season.nextResetAt)}。`;
}

function summarizeBlessings(blessings: TowerState['blessings']) {
  return Object.entries(blessings).flatMap(([id, stacks]) => {
    if (typeof stacks !== 'number' || stacks <= 0) {
      return [];
    }

    const blessingId = id as TowerBlessingId;
    return [
      {
        id: blessingId,
        stacks,
        definition: getTowerBlessingDefinition(blessingId),
      },
    ];
  });
}

function getMeterPercent(current: number, max: number) {
  if (!Number.isFinite(max) || max <= 0) {
    return 0;
  }

  const percent = (current / max) * 100;
  return Math.max(0, Math.min(100, percent));
}

function formatHighestFloorLabel(floor: number | null | undefined) {
  return floor && floor > 0 ? formatDepthLabel(floor) : '未留痕';
}

function formatFloorList(floors: number[]) {
  return floors.map((floor) => formatDepthLabel(floor)).join('、');
}

function collectFloorsByKind(kind: 'elite' | 'boss') {
  return Array.from({ length: TOWER_MAX_FLOOR }, (_, index) => index + 1).filter(
    (floor) => resolveTowerFloorKind(floor) === kind,
  );
}

function getFloorSummaryCopy(args: {
  state: TowerState | null;
  settlement?: TowerSettlement;
}) {
  if (!args.state) {
    return {
      currentLabel: '当前层数',
      currentValue: '本周未入境',
    };
  }

  if (args.state.status === 'FINISHED') {
    return {
      currentLabel: '最终止步',
      currentValue: formatDepthLabel(
        args.settlement?.finalFloor ?? args.state.currentFloor,
      ),
    };
  }

  return {
    currentLabel: '当前层数',
    currentValue: formatDepthLabel(args.state.currentFloor),
  };
}

const MILESTONE_FLOORS = [5, 10, 15, 20] as const;

function TowerFloorSummaryCard({
  state,
  settlement,
  onOpenGuide,
}: {
  state: TowerState | null;
  settlement?: TowerSettlement;
  onOpenGuide: () => void;
}) {
  const currentCopy = getFloorSummaryCopy({ state, settlement });
  const highestFloor =
    state?.highestFloorCleared ?? settlement?.highestFloorCleared ?? 0;

  const claimedFloors = new Set(
    state?.claimedMilestones ??
      settlement?.milestoneRewards.map((r) => r.floor) ??
      [],
  );

  return (
    <InkCard className="mb-0 p-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="border-ink/12 bg-ink/4 min-w-0 rounded-none border border-dashed px-3 py-2.5">
          <div className="text-battle-muted text-[0.68rem] tracking-[0.14em]">
            {currentCopy.currentLabel}
          </div>
          <div className="mt-1 truncate text-base font-semibold sm:text-lg">
            {currentCopy.currentValue}
          </div>
        </div>
        <div className="border-ink/12 bg-ink/4 min-w-0 rounded-none border border-dashed px-3 py-2.5">
          <div className="text-battle-muted text-[0.68rem] tracking-[0.14em]">
            本周最高
          </div>
          <div className="mt-1 truncate text-base font-semibold sm:text-lg">
            {formatHighestFloorLabel(highestFloor)}
          </div>
        </div>
      </div>

      <div className="border-ink/15 mt-3 border-t border-dashed pt-3">
        <div className="text-battle-muted mb-2 text-[0.68rem] tracking-[0.14em]">
          本周机缘进度
        </div>
        <div className="grid grid-cols-4 gap-2">
          {MILESTONE_FLOORS.map((floor) => {
            const tier = resolveTowerMilestoneTier(floor);
            const claimed = claimedFloors.has(floor);
            return (
              <div
                key={floor}
                className={`rounded-none border border-dashed px-2 py-1.5 text-center transition-colors ${
                  claimed
                    ? 'border-crimson/30 bg-crimson/6'
                    : 'border-ink/12 bg-ink/2'
                }`}
              >
                <div
                  className={`text-[0.68rem] tracking-[0.08em] ${
                    claimed ? 'text-crimson' : 'text-battle-muted'
                  }`}
                >
                  {tier}级
                </div>
                <div
                  className={`mt-0.5 text-xs font-medium ${
                    claimed ? 'text-ink' : 'text-ink-secondary'
                  }`}
                >
                  第{floor}层
                </div>
                <div
                  className={`mt-0.5 text-[0.62rem] ${
                    claimed ? 'text-crimson/80' : 'text-battle-muted/70'
                  }`}
                >
                  {claimed ? '已领取' : '未领取'}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="border-ink/15 mt-3 flex justify-end border-t border-dashed pt-3">
        <button
          type="button"
          className="text-ink-secondary hover:text-ink text-xs underline decoration-dotted underline-offset-4 transition-colors"
          onClick={onOpenGuide}
        >
          查看境规与机缘
        </button>
      </div>
    </InkCard>
  );
}

function TowerRunResourceMeter({
  label,
  current,
  max,
  tone,
}: {
  label: string;
  current: number;
  max: number;
  tone: 'hp' | 'mp';
}) {
  const percent = getMeterPercent(current, max);
  const toneClass = tone === 'hp' ? 'bg-crimson' : 'bg-teal';

  return (
    <div className="min-w-0 space-y-1.5">
      <div className="flex items-center justify-between gap-2 text-[0.68rem] leading-4 sm:text-[0.72rem]">
        <span className="text-battle-muted shrink-0 tracking-[0.14em]">
          {label}
        </span>
        <span className="text-ink shrink-0 text-right font-mono text-[0.72rem] sm:text-[0.82rem]">
          {current} / {max}
        </span>
      </div>
      <div className="bg-battle-faint h-[5px] min-w-0 overflow-hidden rounded-full">
        <div
          className={`${toneClass} h-full rounded-full`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

function TowerRunStatusCard({
  state,
  maxHp,
  maxMp,
  onOpenBlessing,
  onOpenStatuses,
}: {
  state: TowerState;
  maxHp: number;
  maxMp: number;
  onOpenBlessing: (blessingId: TowerBlessingId, currentStacks: number) => void;
  onOpenStatuses: () => void;
}) {
  const blessings = summarizeBlessings(state.blessings);
  const statusSummary = state.condition.statuses.length
    ? state.condition.statuses
        .map((status) => {
          const template = getConditionStatusTemplate(status.key);
          const label = template?.name ?? status.key;
          return status.stacks > 1 ? `${label} ${status.stacks} 层` : label;
        })
        .join('，')
    : '暂无明显伤势，境中气息尚稳。';

  return (
    <GameSceneSection
      title="境内状态"
      className="[&+&]:mt-4! [&+&]:pt-3"
    >
      <InkCard className="space-y-3 p-4">
        <div className="space-y-2.5">
          <TowerRunResourceMeter
            label="境内气血"
            current={state.condition.resources.hp.current}
            max={maxHp}
            tone="hp"
          />
          <TowerRunResourceMeter
            label="境内法力"
            current={state.condition.resources.mp.current}
            max={maxMp}
            tone="mp"
          />
        </div>

        <div className="border-ink/15 border-t border-dashed pt-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold">伤势与余痕</div>
            {state.condition.statuses.length > 0 ? (
              <button
                type="button"
                className="text-ink-secondary hover:text-ink text-xs underline decoration-dotted underline-offset-4 transition-colors"
                onClick={onOpenStatuses}
              >
                查看详情
              </button>
            ) : null}
          </div>
          <p className="text-ink-secondary mt-1.5 text-sm leading-6">
            {statusSummary}
          </p>
        </div>

        <div className="border-ink/15 border-t border-dashed pt-3">
          <div className="text-sm font-semibold">已承机缘</div>
          {blessings.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {blessings.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="border-ink/15 hover:border-crimson/35 hover:text-ink rounded-none border border-dashed px-2 py-0.5 text-left text-xs leading-6 transition-colors"
                  onClick={() => onOpenBlessing(item.id, item.stacks)}
                >
                  {item.definition.name} · {item.stacks}/{item.definition.maxStacks}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-ink-secondary mt-1.5 text-sm leading-6">
              尚未承接塔中机缘。
            </p>
          )}
        </div>
      </InkCard>
    </GameSceneSection>
  );
}

function TowerReadyCard({
  state,
  processing,
  onStartRun,
  onProbeBattle,
}: {
  state: TowerState | null;
  processing: boolean;
  onStartRun: () => Promise<void>;
  onProbeBattle: () => Promise<boolean>;
}) {
  return (
    <InkCard className="mb-0 space-y-3 p-4">
      {!state ? (
        <>
          <p className="text-sm leading-6">
            蜃气已聚，此刻踏入后，境内气血与法力便会独立记账。
          </p>
          <div className="flex justify-end">
            <InkButton
              variant="primary"
              disabled={processing}
              onClick={() => void onStartRun()}
            >
              踏入本周幻境
            </InkButton>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm leading-6">
            前路幻影尚未照见，先定神观其形，再决定何时入境交手。
          </p>
          <div className="flex justify-end">
            <InkButton
              variant="primary"
              disabled={processing}
              onClick={() => void onProbeBattle()}
            >
              照见前路幻影
            </InkButton>
          </div>
        </>
      )}
    </InkCard>
  );
}

function TowerEncounterCard({
  probe,
  loading,
  onRetryProbe,
  onStartBattle,
  onOpenDetail,
}: {
  probe: TowerProbeResponse | null;
  loading: boolean;
  onRetryProbe: () => void;
  onStartBattle: () => void;
  onOpenDetail: () => void;
}) {
  if (!probe) {
    return (
      <InkCard className="mb-0 space-y-3 p-4">
        <p className="text-sm leading-6">
          这道幻影尚未显形，需先凝神照见其轮廓，方可入境交手。
        </p>
        <div className="flex justify-end">
          <InkButton
            variant="primary"
            disabled={loading}
            onClick={onRetryProbe}
          >
            {loading ? '照见中...' : '照见前路幻影'}
          </InkButton>
        </div>
      </InkCard>
    );
  }

  const enemy = probe.enemy;
  const atmosphereCopy =
    enemy.description ??
    enemy.background ??
    '那道幻影已在塔中凝实，正静候你踏入此战。';

  return (
    <InkCard className="mb-0 space-y-4 p-4">
      <div className="min-w-0">
        <div className="text-base leading-6 font-semibold sm:text-lg">
          {enemy.name}
        </div>
        <div className="text-ink-secondary mt-1 text-sm leading-6">
          {probe.encounter.realm} {probe.encounter.realmStage}
          {enemy.title ? ` · 「${enemy.title}」` : ''}
        </div>
      </div>

      <p className="text-sm leading-6">{atmosphereCopy}</p>

      <div className="flex justify-end gap-3">
        <InkButton variant="secondary" onClick={onOpenDetail}>
          查看详情
        </InkButton>
        <InkButton variant="primary" onClick={onStartBattle}>
          入境交手
        </InkButton>
      </div>
    </InkCard>
  );
}

function TowerBlessingChoices({
  state,
  processing,
  currentHp,
  maxHp,
  currentMp,
  maxMp,
  onChoose,
  onOpenDetail,
}: {
  state: TowerState;
  processing: boolean;
  currentHp: number;
  maxHp: number;
  currentMp: number;
  maxMp: number;
  onChoose: (blessingId: TowerBlessingId) => Promise<void>;
  onOpenDetail: (
    blessingId: TowerBlessingId,
    currentStacks: number,
    nextStacks: number,
  ) => void;
}) {
  const [selectedBlessingId, setSelectedBlessingId] =
    useState<TowerBlessingId | null>(
      state.pendingBlessingChoices[0]?.id ?? null,
    );
  const focusedId =
    selectedBlessingId &&
    state.pendingBlessingChoices.some((choice) => choice.id === selectedBlessingId)
      ? selectedBlessingId
      : state.pendingBlessingChoices[0]?.id ?? null;

  return (
    <div className="grid gap-2.5 md:grid-cols-3">
      {state.pendingBlessingChoices.map((choice) => {
        const isFocused = focusedId === choice.id;
        const preview = getTowerBlessingEffectPreview({
          blessingId: choice.id,
          currentStacks: choice.currentStacks,
          nextStacks: choice.nextStacks,
          currentHp,
          maxHp,
          currentMp,
          maxMp,
        });

        return (
          <InkCard
            key={choice.id}
            variant={isFocused ? 'highlighted' : 'default'}
            className="mb-0"
            padding="md"
          >
            <div className="flex h-full flex-col gap-2.5">
              <button
                type="button"
                className="min-w-0 text-left"
                onClick={() => setSelectedBlessingId(choice.id)}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="truncate text-sm font-semibold sm:text-base">
                    {choice.name}
                  </div>
                  <div className="text-ink-secondary shrink-0 text-[0.7rem] tracking-[0.08em]">
                    {choice.currentStacks} → {choice.nextStacks}
                  </div>
                </div>
                <div className="text-ink-secondary mt-1.5 text-sm leading-6">
                  {preview.nextLabel}
                </div>
              </button>

              <div className="mt-auto flex items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  className="text-ink-secondary hover:text-ink text-xs underline decoration-dotted underline-offset-4 transition-colors"
                  onClick={() =>
                    onOpenDetail(choice.id, choice.currentStacks, choice.nextStacks)
                  }
                >
                  查看详情
                </button>
                {isFocused ? (
                  <InkButton
                    variant="primary"
                    disabled={processing}
                    className="px-0 py-0 text-sm leading-6"
                    onClick={() => void onChoose(choice.id)}
                  >
                    承此机缘
                  </InkButton>
                ) : (
                  <span className="text-ink-secondary text-xs">点选机缘</span>
                )}
              </div>
            </div>
          </InkCard>
        );
      })}
    </div>
  );
}

function TowerSettlementCard({
  settlement,
  onRestart,
}: {
  settlement: TowerSettlement;
  onRestart: () => Promise<void>;
}) {
  return (
    <InkCard className="mb-0 space-y-3 p-4">
      <div className="space-y-1.5">
        <div className="text-base leading-6 font-semibold sm:text-lg">
          {settlement.endReason === 'clear'
            ? '幻境尽处已现，本周这一回已走到尽头。'
            : `此行止于${formatDepthLabel(settlement.finalFloor)}。`}
        </div>
      </div>

      {settlement.milestoneRewards.length > 0 ? (
        <div className="border-ink/15 space-y-1.5 border-t border-dashed pt-3">
          <div className="text-sm font-semibold">此行已得机缘</div>
          <div className="space-y-1.5 text-sm leading-6">
            {settlement.milestoneRewards.map((reward) => (
              <div key={`${reward.floor}-${reward.grantedAt}`}>
                {formatDepthLabel(reward.floor)} · {reward.tier} 级奖励 ·
                {reward.rewards.map((item) => `${item.type} +${item.value}`).join('，')}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex justify-end">
        <InkButton variant="primary" onClick={() => void onRestart()}>
          重开本周幻境
        </InkButton>
      </div>
    </InkCard>
  );
}

export default function TowerPage() {
  const { cultivator, display, isLoading: cultivatorLoading } =
    useCultivator();
  const { openDialog } = useInkUI();
  const navigate = useNavigate();
  const { payload, setPayload, loading } = useTowerState(!!cultivator);
  const { startRun, probeBattle, chooseBlessing, resetRun, processing } =
    useTowerActions();
  const [selectedRealm, setSelectedRealm] = useState<RealmType | null>(null);
  const cultivatorRealm = cultivator?.realm as RealmType | undefined;
  const activeRealm =
    selectedRealm ??
    (cultivatorRealm && isTowerRealmEligible(cultivatorRealm)
      ? cultivatorRealm
      : TOWER_ELIGIBLE_REALMS[0]);
  const { payload: leaderboardPayload, loading: leaderboardLoading } =
    useTowerLeaderboard(!!cultivator, activeRealm);
  const [probe, setProbe] = useState<TowerProbeResponse | null>(null);
  const [selectedBlessingDetail, setSelectedBlessingDetail] = useState<{
    blessingId: TowerBlessingId;
    currentStacks: number;
    nextStacks?: number;
  } | null>(null);
  const [isEnemyDetailOpen, setIsEnemyDetailOpen] = useState(false);
  const probeRequestBattleIdRef = useRef<string | null>(null);

  const towerState = payload?.state ?? null;
  const settlement = payload?.settlement;
  const season = payload?.season ?? leaderboardPayload?.season;
  const eligible =
    payload?.eligible ??
    (cultivatorRealm ? isTowerRealmEligible(cultivatorRealm) : false);
  const minRealm = payload?.minRealm ?? TOWER_MIN_REALM;
  const maxHp = display?.resources.hp.max ?? 0;
  const maxMp = display?.resources.mp.max ?? 0;
  const scenePulse = buildScenePulse(season);
  const encounterProbe =
    towerState?.status === 'WAITING_BATTLE' &&
    probe?.battleId === towerState.activeBattleId
      ? probe
      : null;
  const requestProbeBattleInEffect = useEffectEvent(() => probeBattle());
  const eliteFloors = collectFloorsByKind('elite');
  const bossFloors = collectFloorsByKind('boss');

  const handleStartRun = async () => {
    const data = await startRun();
    if (!data) return;
    setPayload({ ...data, eligible: true, minRealm });
    setProbe(null);
    probeRequestBattleIdRef.current = null;
  };

  const handleResetRun = async () => {
    const success = await resetRun();
    if (!success) return false;
    setPayload((current) =>
      current?.season ?? leaderboardPayload?.season
        ? {
            season: current?.season ?? leaderboardPayload!.season,
            state: null,
            eligible: current?.eligible ?? eligible,
            minRealm: current?.minRealm ?? minRealm,
            settlement: undefined,
          }
        : null,
    );
    setProbe(null);
    probeRequestBattleIdRef.current = null;
    return true;
  };

  const handleProbeBattle = async () => {
    const data = await probeBattle();
    if (!data) return false;
    probeRequestBattleIdRef.current = data.battleId;
    setPayload({
      season: data.season,
      state: data.state,
      eligible: true,
      minRealm,
    });
    setProbe(data);
    return true;
  };

  const handleChooseBlessing = async (blessingId: TowerBlessingId) => {
    const data = await chooseBlessing(blessingId);
    if (!data) return;
    setPayload({ ...data, eligible: true, minRealm });
    setProbe(null);
    probeRequestBattleIdRef.current = null;
    setSelectedBlessingDetail(null);
  };

  const handleOpenStatusDetails = () => {
    if (!towerState || towerState.condition.statuses.length === 0) {
      return;
    }

    openDialog({
      title: '塔中伤势与余痕',
      confirmLabel: '知晓',
      cancelLabel: null,
      content: (
        <div className="space-y-3 text-sm leading-7">
          {towerState.condition.statuses.map((status, index) => {
            const template = getConditionStatusTemplate(status.key);
            return (
              <div key={`${status.key}:${index}`} className="space-y-1">
                <div className="font-semibold">
                  {template?.name ?? status.key}
                  {status.stacks > 1 ? ` · ${status.stacks} 层` : ''}
                </div>
                <div className="text-ink-secondary">
                  {template?.description ?? '未知状态'}
                </div>
                {template?.effectDetails?.length ? (
                  <div className="text-ink-secondary">
                    {template.effectDetails.join(' ')}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ),
    });
  };

  const handleOpenTowerGuide = () => {
    openDialog({
      title: '蜃楼境规',
      confirmLabel: '知晓',
      cancelLabel: null,
      content: (
        <div className="space-y-4 text-sm leading-7">
          <div className="space-y-1.5">
            <div className="font-semibold">此境如何推进</div>
            <p className="text-ink-secondary">
              本周幻境共 {TOWER_MAX_FLOOR} 层，每深入一层，敌方难度额外抬升{' '}
              {TOWER_DIFFICULTY_STEP} 点。异化幻影出现在
              {formatFloorList(eliteFloors)}，压阵主影出现在
              {formatFloorList(bossFloors)}。
            </p>
          </div>

          <div className="space-y-1.5">
            <div className="font-semibold">角色与状态</div>
            <p className="text-ink-secondary">
              每次开战都会实时读取你当前的境界、功法、技能与装备，但境内气血、法力与伤势独立记账。场外换装会影响面板，场外吃药与恢复不会替你回满此境状态。
            </p>
          </div>

          <div className="space-y-1.5">
            <div className="font-semibold">机缘与奖励</div>
            <p className="text-ink-secondary">
              每次胜出后，都会从三道随机机缘里择一承接，只在本轮幻境内生效，不会带出境外。每逢第 5、10、15、20 层胜出时，会依次发放 C、B、A、S 级固定机缘；当前已实现的掉落池为灵石与修为，奖励强弱按你当时的大境界与该层凶险一并结算。
            </p>
          </div>

          <div className="space-y-1.5">
            <div className="font-semibold">本周重置</div>
            <p className="text-ink-secondary">
              幻境按 Asia/Shanghai 自然周轮转，每周一 00:00 改换境门。你也可以手动重开当前进度，但本周已留在榜上的最高层不会因此抹去。
            </p>
          </div>
        </div>
      ),
    });
  };

  useEffect(() => {
    const activeBattleId = towerState?.activeBattleId;
    if (towerState?.status !== 'WAITING_BATTLE' || !activeBattleId) {
      probeRequestBattleIdRef.current = null;
      return;
    }

    if (encounterProbe || processing) {
      return;
    }

    if (probeRequestBattleIdRef.current === activeBattleId) {
      return;
    }

    probeRequestBattleIdRef.current = activeBattleId;
    let cancelled = false;

    const loadProbe = async () => {
      const data = await requestProbeBattleInEffect();
      if (!data || cancelled) {
        return;
      }
      probeRequestBattleIdRef.current = data.battleId;
      setPayload({
        season: data.season,
        state: data.state,
        eligible: true,
        minRealm,
      });
      setProbe(data);
    };

    void loadProbe();

    return () => {
      cancelled = true;
    };
  }, [
    encounterProbe,
    minRealm,
    processing,
    setPayload,
    towerState?.activeBattleId,
    towerState?.status,
  ]);

  if (cultivatorLoading || loading) {
    return <GameSceneLoading message="幻境正在聚形……" />;
  }

  if (!cultivator) {
    return (
      <GameSceneFrame title={TOWER_SCENE_NAME}>
        <GameSceneNote>需先有活跃角色，方可踏入这重幻境。</GameSceneNote>
      </GameSceneFrame>
    );
  }

  if (!eligible) {
    return (
      <GameSceneFrame
        title={TOWER_SCENE_NAME}
        variant="workflow"
        contentClassName="min-w-0 [&>*+*]:mt-3"
        headerMeta={scenePulse ? (
          <GameSceneNote>
            <p className="text-sm leading-6">{scenePulse}</p>
          </GameSceneNote>
        ) : undefined}
      >
        <GameSceneSection title="当前事件">
          <InkCard className="mb-0 p-4">
            <p className="text-ink-secondary text-sm leading-6">
              蜃楼幻境仅向{minRealm}及以上境界开放。待道行稳固后，此境门自会显现。
            </p>
          </InkCard>
        </GameSceneSection>

        <TowerLeaderboard
          activeRealm={activeRealm}
          entries={leaderboardPayload?.entries ?? []}
          loading={leaderboardLoading}
          onRealmChange={setSelectedRealm}
        />
      </GameSceneFrame>
    );
  }

  return (
    <>
      <GameSceneFrame
        title={TOWER_SCENE_NAME}
        variant="workflow"
        contentClassName="min-w-0 [&>*+*]:mt-3"
        headerMeta={scenePulse ? (
          <GameSceneNote>
            <p className="text-sm leading-6">{scenePulse}</p>
          </GameSceneNote>
        ) : undefined}
      >
        <TowerFloorSummaryCard
          state={towerState}
          settlement={settlement}
          onOpenGuide={handleOpenTowerGuide}
        />

        <GameSceneSection
          title="当前事件"
          className="[&+&]:mt-4! [&+&]:pt-3"
        >
          {!towerState || towerState.status === 'READY' ? (
            <TowerReadyCard
              state={towerState}
              processing={processing}
              onStartRun={handleStartRun}
              onProbeBattle={handleProbeBattle}
            />
          ) : null}

          {towerState?.status === 'WAITING_BATTLE' ? (
            <TowerEncounterCard
              probe={encounterProbe}
              loading={processing}
              onRetryProbe={() => void handleProbeBattle()}
              onOpenDetail={() => setIsEnemyDetailOpen(true)}
              onStartBattle={() => {
                const nextBattleId =
                  encounterProbe?.battleId ?? towerState.activeBattleId ?? null;
                if (!nextBattleId) {
                  return;
                }

                navigate(
                  `/game/tower/battle?battleId=${encodeURIComponent(nextBattleId)}`,
                );
              }}
            />
          ) : null}

          {towerState?.status === 'CHOOSING_BLESSING' ? (
            <TowerBlessingChoices
              state={towerState}
              processing={processing}
              currentHp={towerState.condition.resources.hp.current}
              maxHp={maxHp}
              currentMp={towerState.condition.resources.mp.current}
              maxMp={maxMp}
              onChoose={handleChooseBlessing}
              onOpenDetail={(blessingId, currentStacks, nextStacks) =>
                setSelectedBlessingDetail({
                  blessingId,
                  currentStacks,
                  nextStacks,
                })
              }
            />
          ) : null}

          {towerState?.status === 'FINISHED' ? (
            settlement ? (
              <TowerSettlementCard
                settlement={settlement}
                onRestart={async () => {
                  const success = await handleResetRun();
                  if (success) {
                    await handleStartRun();
                  }
                }}
              />
            ) : (
              <InkCard className="mb-0 space-y-3 p-4">
                <p className="text-sm leading-6">本周幻境已暂告一段。</p>
                <div className="flex justify-end">
                  <InkButton
                    variant="primary"
                    onClick={async () => {
                      const success = await handleResetRun();
                      if (success) {
                        await handleStartRun();
                      }
                    }}
                  >
                    重开本周幻境
                  </InkButton>
                </div>
              </InkCard>
            )
          ) : null}
        </GameSceneSection>

        {towerState ? (
          <TowerRunStatusCard
            state={towerState}
            maxHp={maxHp}
            maxMp={maxMp}
            onOpenBlessing={(blessingId, currentStacks) =>
              setSelectedBlessingDetail({
                blessingId,
                currentStacks,
              })
            }
            onOpenStatuses={handleOpenStatusDetails}
          />
        ) : null}

        <TowerLeaderboard
          activeRealm={activeRealm}
          entries={leaderboardPayload?.entries ?? []}
          loading={leaderboardLoading}
          onRealmChange={setSelectedRealm}
        />
      </GameSceneFrame>

      <CultivatorInspectionModal
        cultivator={encounterProbe?.enemy ?? null}
        isOpen={isEnemyDetailOpen}
        onClose={() => setIsEnemyDetailOpen(false)}
        mode="enemy"
        badges={
          encounterProbe
            ? [
                <InkBadge key="kind" tone="accent">
                  {describeEncounterLabel(encounterProbe.encounter.kind)}
                </InkBadge>,
              ]
            : undefined
        }
      />
      <TowerBlessingDetailModal
        blessingId={selectedBlessingDetail?.blessingId ?? null}
        isOpen={!!selectedBlessingDetail}
        onClose={() => setSelectedBlessingDetail(null)}
        currentStacks={selectedBlessingDetail?.currentStacks ?? 0}
        nextStacks={selectedBlessingDetail?.nextStacks}
        currentHp={towerState?.condition.resources.hp.current}
        maxHp={maxHp}
        currentMp={towerState?.condition.resources.mp.current}
        maxMp={maxMp}
      />
    </>
  );
}
