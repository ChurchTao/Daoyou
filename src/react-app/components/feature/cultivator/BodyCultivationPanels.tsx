import {
  GameSceneSection,
} from '@app/components/game-shell/GameSceneSection';
import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkBadge, InkButton, InkNotice } from '@app/components/ui';
import {
  usePlayerStateDomainVersion,
  usePlayerStateView,
} from '@app/lib/player-state/selectors';
import { consumePlayerStateMutation } from '@app/lib/player-state/store';
import type { ApiFailure } from '@shared/contracts/http';
import type {
  BodyCultivationBreakthroughReadinessData,
  BodyCultivationBreakthroughReadinessResponse,
} from '@shared/contracts/bodyCultivation';
import { cn } from '@shared/lib/cn';
import {
  getBodyCultivationSummary,
  type BodyCultivationSummary,
  type BodyCultivationTrackSummary,
} from '@shared/lib/bodyCultivation/summary';
import type { Cultivator } from '@shared/types/cultivator';
import { useEffect, useState, type ReactNode } from 'react';

type BreakthroughReadinessState = {
  readiness: BodyCultivationBreakthroughReadinessData | null;
  error: { realmKey: string; message: string } | null;
  pending: boolean;
};

function BodyMetric({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: ReactNode;
  tone?: 'default' | 'success' | 'muted';
}) {
  return (
    <div className="min-w-0">
      <p className="text-ink-secondary text-[0.68rem] leading-5">{label}</p>
      <p
        className={cn(
          'truncate text-sm leading-6 font-semibold',
          tone === 'success'
            ? 'text-wood'
            : tone === 'muted'
              ? 'text-ink-secondary'
              : 'text-ink',
        )}
      >
        {value}
      </p>
    </div>
  );
}

function RequirementLine({
  met,
  children,
}: {
  met: boolean;
  children: ReactNode;
}) {
  return (
    <span className={cn(met ? 'text-wood' : 'text-ink-secondary')}>
      {met ? '✓' : '·'} {children}
    </span>
  );
}

function formatRequirementCost(
  readiness: BodyCultivationBreakthroughReadinessData | null,
): string | null {
  const requirements = readiness?.inventoryRequirements ?? [];
  if (requirements.length === 0) return null;

  return requirements
    .map(
      (requirement) =>
        `${requirement.met ? '✓' : '·'} ${requirement.label ?? requirement.name} ${requirement.ownedQuantity}/${requirement.quantity}`,
    )
    .join(' / ');
}

function getTrackProgressPercent(track: BodyCultivationTrackSummary): number {
  return Math.round(
    Math.max(0, Math.min(track.progress / track.threshold, 1)) * 100,
  );
}

function BodyCultivationOverviewCard({
  summary,
  nextRealm = summary.nextRealm,
  status,
  statusTone = 'default',
  action,
  children,
}: {
  summary: BodyCultivationSummary;
  nextRealm?: BodyCultivationSummary['nextRealm'];
  status?: string;
  statusTone?: 'default' | 'success' | 'muted';
  action?: ReactNode;
  children?: ReactNode;
}) {
  const nextRealmLabel = nextRealm?.label ?? '已至顶阶';

  return (
    <div className="border-ink/15 bg-bgpaper/75 overflow-hidden border border-dashed">
      <div className="flex flex-wrap items-start justify-between gap-3 px-3 py-3">
        <div className="min-w-0">
          <p className="text-ink-secondary text-xs leading-5">当前肉身</p>
          <p className="text-ink text-xl leading-8 font-semibold">
            {summary.realm.label}
          </p>
          <p className="text-ink-secondary text-xs leading-5">
            {summary.realm.unlockText}
          </p>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>

      <div className="border-ink/10 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-dashed px-3 py-3 md:grid-cols-4">
        <BodyMetric label="炼体等级" value={`Lv.${summary.totalLevel}`} />
        <BodyMetric label="当前承载" value={`Lv.${summary.realm.softTrackCap}`} />
        <BodyMetric label="下一境界" value={nextRealmLabel} />
        <BodyMetric
          label="破关状态"
          value={status ?? (nextRealm ? '条件未齐' : '已圆满')}
          tone={statusTone}
        />
      </div>

      {children ? (
        <div className="border-ink/10 border-t border-dashed px-3 py-3">
          {children}
        </div>
      ) : null}
    </div>
  );
}

function BodyCultivationTrackCard({
  track,
  dense = false,
  showNextEffects = true,
}: {
  track: BodyCultivationTrackSummary;
  dense?: boolean;
  showNextEffects?: boolean;
}) {
  return (
    <div className="border-ink/15 bg-bgpaper/60 border border-dashed px-3 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-ink text-sm font-semibold">{track.name}</h3>
          <p className="text-ink-secondary text-xs leading-5">{track.shortDesc}</p>
        </div>
        <InkBadge tone="default">{`Lv.${track.level}`}</InkBadge>
      </div>

      <div className="mt-3">
        <div className="flex items-center justify-between gap-2 text-xs leading-5">
          <span className="text-ink-secondary">
            {track.progress} / {track.threshold}
          </span>
          <span className="text-ink-secondary">
            下一次蜕变 Lv.{track.nextMilestoneLevel}
          </span>
        </div>
        <div className="bg-ink/10 mt-1 h-1.5 overflow-hidden">
          <div
            className="bg-crimson h-full"
            style={{ width: `${getTrackProgressPercent(track)}%` }}
          />
        </div>
      </div>

      <div
        className={cn(
          'mt-3 grid gap-3 text-xs leading-5',
          showNextEffects && !dense ? 'md:grid-cols-2' : 'grid-cols-1',
        )}
      >
        <div>
          <p className="text-ink mb-1 font-medium">当前加成</p>
          <div className="text-ink-secondary flex flex-wrap gap-x-3 gap-y-1">
            {track.currentEffects.map((effect) => (
              <span key={effect}>{effect}</span>
            ))}
          </div>
        </div>
        {showNextEffects && !dense ? (
          <div>
            <p className="text-ink mb-1 font-medium">下级变化</p>
            <div className="text-ink-secondary flex flex-wrap gap-x-3 gap-y-1">
              {track.nextLevelEffects.map((effect) => (
                <span key={effect}>{effect}</span>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function BodyCultivationTrackGrid({
  summary,
  dense = false,
  showNextEffects = true,
}: {
  summary: BodyCultivationSummary;
  dense?: boolean;
  showNextEffects?: boolean;
}) {
  return (
    <div className={cn('grid gap-3', dense && 'gap-2 md:grid-cols-2')}>
      {summary.tracks.map((track) => (
        <BodyCultivationTrackCard
          key={track.key}
          track={track}
          dense={dense}
          showNextEffects={showNextEffects}
        />
      ))}
    </div>
  );
}

function useBodyBreakthroughReadiness(
  nextRealmKey: string | null,
): BreakthroughReadinessState {
  const conditionVersion = usePlayerStateDomainVersion('condition');
  const inventoryVersion = usePlayerStateDomainVersion('inventory');
  const [readiness, setReadiness] =
    useState<BodyCultivationBreakthroughReadinessData | null>(null);
  const [error, setError] = useState<{
    realmKey: string;
    message: string;
  } | null>(null);

  useEffect(() => {
    if (!nextRealmKey) {
      return;
    }

    const abortController = new AbortController();

    void fetch('/api/cultivator/body-cultivation/breakthrough', {
      signal: abortController.signal,
    })
      .then(async (response) => {
        const payload = (await response.json()) as
          | BodyCultivationBreakthroughReadinessResponse
          | ApiFailure;
        if (!response.ok || !payload.success) {
          throw new Error(
            'error' in payload ? payload.error : '破关资粮读取失败',
          );
        }
        setReadiness(payload.data);
        setError(null);
      })
      .catch((caught) => {
        if (abortController.signal.aborted) return;
        setReadiness(null);
        setError({
          realmKey: nextRealmKey,
          message:
            caught instanceof Error ? caught.message : '破关资粮读取失败',
        });
      });

    return () => abortController.abort();
  }, [conditionVersion, inventoryVersion, nextRealmKey]);

  if (!nextRealmKey) {
    return {
      readiness: null,
      error: null,
      pending: false,
    };
  }

  return {
    readiness,
    error,
    pending: Boolean(nextRealmKey) && !readiness && !error,
  };
}

export function BodyCultivationSummaryContent({
  summary,
  dense = false,
}: {
  summary: BodyCultivationSummary;
  dense?: boolean;
}) {
  return (
    <div className={cn('space-y-3', dense && 'space-y-2')}>
      <BodyCultivationOverviewCard
        summary={summary}
        status={summary.nextRealm ? '继续修炼' : '已圆满'}
        statusTone={summary.nextRealm ? 'default' : 'success'}
      />
      <BodyCultivationTrackGrid
        summary={summary}
        dense={dense}
        showNextEffects={!dense}
      />
    </div>
  );
}

export function BodyCultivationEntrySection() {
  const { cultivator } = usePlayerStateView();
  if (!cultivator) return null;

  const summary = getBodyCultivationSummary(cultivator.condition, {
    cultivatorRealm: cultivator.realm,
  });
  const nextRealm = summary.nextRealm;
  const nextRealmStatus = nextRealm
    ? nextRealm.canAttempt
      ? '可筹备破关'
      : '条件未齐'
    : '已圆满';

  return (
    <GameSceneSection title="肉身炼体">
      <BodyCultivationOverviewCard
        summary={summary}
        nextRealm={nextRealm}
        status={nextRealmStatus}
        statusTone={nextRealm?.canAttempt ? 'success' : 'default'}
        action={
          <InkButton href="/game/body-cultivation" className="text-xs">
            查看详情
          </InkButton>
        }
      >
        {nextRealm ? (
          <div className="text-ink-secondary flex flex-wrap gap-x-3 gap-y-1 text-xs leading-5">
            {nextRealm.requirements.map((requirement) => (
              <RequirementLine key={requirement.label} met={requirement.met}>
                {requirement.label}
              </RequirementLine>
            ))}
          </div>
        ) : (
          <p className="text-ink-secondary text-xs leading-5">
            此身已至当前肉身极境，可继续查看五轨收益。
          </p>
        )}
      </BodyCultivationOverviewCard>
    </GameSceneSection>
  );
}

export function BodyCultivationDetailPanel() {
  const { cultivator } = usePlayerStateView();
  const { pushToast } = useInkUI();
  const [breakthroughPending, setBreakthroughPending] = useState(false);
  const summary = cultivator
    ? getBodyCultivationSummary(cultivator.condition, {
        cultivatorRealm: cultivator.realm,
      })
    : null;
  const nextRealm = summary?.nextRealm ?? null;
  const readinessState = useBodyBreakthroughReadiness(nextRealm?.key ?? null);

  if (!cultivator || !summary) return <InkNotice>尚无角色资料。</InkNotice>;
  const matchingReadiness =
    readinessState.readiness &&
    readinessState.readiness.nextRealm === nextRealm?.key
      ? readinessState.readiness
      : null;
  const matchingError =
    readinessState.error && readinessState.error.realmKey === nextRealm?.key
      ? readinessState.error.message
      : null;
  const inventoryReady =
    (matchingReadiness?.inventoryRequirements ?? []).length > 0 &&
    (matchingReadiness?.inventoryRequirements ?? []).every(
      (requirement) => requirement.met,
    );
  const canAttemptBreakthrough =
    Boolean(nextRealm?.canAttempt) && Boolean(matchingReadiness?.canAttempt);
  const breakthroughStatus = readinessState.pending
    ? '清点中'
    : canAttemptBreakthrough
      ? '可破关'
      : matchingError
        ? '清点受阻'
        : nextRealm?.canAttempt
          ? inventoryReady
            ? '资粮已齐'
            : '资粮未齐'
          : '根基未足';
  const costText = matchingError
    ? matchingError
    : readinessState.pending
      ? '正在清点破关资粮'
      : formatRequirementCost(matchingReadiness);

  const handleBodyBreakthrough = async () => {
    if (!canAttemptBreakthrough || breakthroughPending) return;
    const targetRealmLabel = nextRealm?.label ?? '下一阶';

    setBreakthroughPending(true);
    try {
      const response = await fetch('/api/cultivator/body-cultivation/breakthrough', {
        method: 'POST',
      });
      const payload = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(payload.error || '肉身破关失败');
      }

      await consumePlayerStateMutation(payload);
      const result = payload.data as {
        success?: boolean;
        guaranteeProgress?: number;
      };
      pushToast({
        message:
          result.success === false
            ? `肉身破关未成，破关蓄势 ${Math.floor(result.guaranteeProgress ?? 0)}%`
            : `肉身已破入${targetRealmLabel}`,
        tone: result.success === false ? 'warning' : 'success',
      });
    } catch (caught) {
      pushToast({
        message: caught instanceof Error ? caught.message : '肉身破关失败',
        tone: 'danger',
      });
    } finally {
      setBreakthroughPending(false);
    }
  };

  return (
    <div className="space-y-5">
      <GameSceneSection title="肉身总览">
        <BodyCultivationOverviewCard
          summary={summary}
          nextRealm={nextRealm}
          status={breakthroughStatus}
          statusTone={canAttemptBreakthrough ? 'success' : 'default'}
          action={
            nextRealm?.canAttempt ? (
              <InkButton
                type="button"
                variant="primary"
                className="text-sm"
                disabled={breakthroughPending || !canAttemptBreakthrough}
                onClick={handleBodyBreakthrough}
              >
                {breakthroughPending
                  ? '破关中'
                  : readinessState.pending
                    ? '清点中'
                    : `破入${nextRealm.label}`}
              </InkButton>
            ) : null
          }
        >
          {nextRealm ? (
            <div className="space-y-3">
              <div className="grid gap-2 text-xs leading-5 md:grid-cols-2">
                <BodyMetric label="下阶开启" value={nextRealm.unlockText} />
                <BodyMetric
                  label="破关把握"
                  value={
                    <>
                      {Math.round((matchingReadiness?.successChance ?? 0) * 100)}
                      % · 蓄势 {matchingReadiness?.guaranteeProgress ?? 0}%
                    </>
                  }
                />
              </div>
              <div className="text-ink-secondary flex flex-wrap gap-x-3 gap-y-1 text-xs leading-5">
                {nextRealm.requirements.map((requirement) => (
                  <RequirementLine key={requirement.label} met={requirement.met}>
                    {requirement.label}
                  </RequirementLine>
                ))}
              </div>
              {costText ? (
                <p className="text-ink-secondary break-words text-xs leading-5">
                  资粮：{costText}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="text-ink-secondary text-xs leading-5">
              此身已臻当前极境，可继续查看五轨收益。
            </p>
          )}
        </BodyCultivationOverviewCard>
      </GameSceneSection>

      <GameSceneSection title="五轨修炼">
        <BodyCultivationTrackGrid summary={summary} />
      </GameSceneSection>

      <GameSceneSection title="炼体门径">
        <div className="text-ink-secondary space-y-2 text-sm leading-7">
          <p>
            五轨各司其职：皮肤护外邪，筋骨撑气血，脏腑催爆发，气血续久战，元神稳心念。每一轨提升，都会让道身在不同处更扎实。
          </p>
          <p>
            炼体丹的丹力会滋养对应肉身根基。丹名可随炼制手法而变，只要丹力归属相同，便能推动同一处根基成长。
          </p>
          <p>
            破关前需要根基、修为与资粮都到位；所用炼体丹还需丹力合用、丹品火候足够，方可助你跨入下一重肉身。
          </p>
        </div>
      </GameSceneSection>
    </div>
  );
}

export function BodyCultivationInspectionSection({
  cultivator,
}: {
  cultivator: Cultivator;
}) {
  const summary = getBodyCultivationSummary(cultivator.condition, {
    cultivatorRealm: cultivator.realm,
  });

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h5 className="text-ink text-sm font-semibold">肉身炼体</h5>
        <InkBadge tone="default">
          {`${summary.realm.label} · 总 Lv.${summary.totalLevel}`}
        </InkBadge>
      </div>
      <BodyCultivationSummaryContent summary={summary} dense />
    </section>
  );
}
