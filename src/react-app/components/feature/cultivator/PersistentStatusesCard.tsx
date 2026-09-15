import { GameSceneSection } from '@app/components/game-shell/GameSceneSection';
import { InkButton } from '@app/components/ui';
import { useCultivatorProgress } from '@app/lib/resources/player';
import { getBodyCultivationSummary } from '@shared/lib/bodyCultivation/summary';
import { cn } from '@shared/lib/cn';
import {
  getBreakthroughPenaltyPercent,
  getPillToxicityRecoveryMultiplier,
  getPillToxicityStage,
  isConditionStatusActive,
} from '@shared/lib/condition';
import { evaluateFateContext } from '@shared/lib/fates';
import { getAllTrackConfigs } from '@shared/lib/trackConfigRegistry';
import type { ConditionTrackPath } from '@shared/types/condition';
import { useCultivatorDisplayProjection } from './useCultivatorDisplayProjection';

const TRACK_ORDER: ConditionTrackPath[] = [
  'marrow_wash',
  'body.skin',
  'body.sinew_bone',
  'body.organs',
  'body.qi_blood',
  'body.primordial_spirit',
];

function usePersistentStatusState() {
  const projection = useCultivatorDisplayProjection();
  const progress = useCultivatorProgress();
  const cultivator =
    projection.data && progress.data
      ? {
          ...projection.data.cultivator,
          cultivation_progress: progress.data,
        }
      : null;

  if (!cultivator || !projection.data) return null;
  const display = projection.data.display;
  const now = projection.data.now.getTime();
  const statuses = (cultivator.condition?.statuses ?? []).filter((status) =>
    isConditionStatusActive(status, new Date(now)),
  );
  const hp = display?.resources.hp;
  const mp = display?.resources.mp;
  const maxHp = Math.max(0, Math.floor(hp?.max ?? 0));
  const maxMp = Math.max(0, Math.floor(mp?.max ?? 0));
  const currentHp = Math.max(0, Math.floor(hp?.current ?? maxHp));
  const currentMp = Math.max(0, Math.floor(mp?.current ?? maxMp));
  const cultivationExp = Math.max(
    0,
    Math.floor(cultivator.cultivation_progress?.cultivation_exp ?? 0),
  );
  const cultivationCap = Math.max(
    1,
    Math.floor(cultivator.cultivation_progress?.exp_cap ?? 100),
  );
  const cultivationPercent = Math.round(
    Math.max(0, (cultivationExp / cultivationCap) * 100),
  );
  const comprehensionInsight = Math.round(
    Math.max(
      0,
      Math.min(
        cultivator.cultivation_progress?.comprehension_insight ?? 0,
        100,
      ),
    ),
  );
  const pillToxicity = Math.max(
    0,
    Math.floor(cultivator.condition?.gauges.pillToxicity ?? 0),
  );
  const fateContext = evaluateFateContext(cultivator.pre_heaven_fates ?? []);
  const pillToxicityStage = getPillToxicityStage(cultivator.condition);
  const pillToxicityRecoveryEfficiency = Math.round(
    getPillToxicityRecoveryMultiplier(
      cultivator.condition,
      fateContext.toxicityPenaltyMultiplier,
    ) * 100,
  );
  const breakthroughPenaltyPercent = getBreakthroughPenaltyPercent(
    cultivator.condition,
    fateContext.toxicityPenaltyMultiplier,
  );
  const trackConfigs = getAllTrackConfigs().sort(
    (left, right) =>
      TRACK_ORDER.indexOf(left.key) - TRACK_ORDER.indexOf(right.key),
  );
  const bodySummary = getBodyCultivationSummary(cultivator.condition, {
    cultivatorRealm: cultivator.realm,
  });
  const trackEntries = trackConfigs.map((config) => {
    const state =
      config.key === 'marrow_wash'
        ? cultivator.condition?.tracks.marrowWash
        : bodySummary.tracks.find((track) => track.path === config.key);
    const level = state?.level ?? 0;
    const progress = state?.progress ?? 0;
    const threshold = config.thresholdByLevel(level);
    return {
      config,
      level,
      progress,
      threshold,
    };
  });
  const hpRecovery = projection.data.recovery.hp;
  const mpRecovery = projection.data.recovery.mp;

  return {
    currentHp,
    currentMp,
    cultivator,
    hpRecovery,
    maxHp,
    maxMp,
    mpRecovery,
    now,
    breakthroughPenaltyPercent,
    comprehensionInsight,
    cultivationCap,
    cultivationExp,
    cultivationPercent,
    pillToxicity,
    pillToxicityRecoveryEfficiency,
    pillToxicityStage,
    statuses,
    bodySummary,
    trackEntries,
  };
}

function CompactInfoRow({
  icon,
  label,
  note,
  value,
  trailing,
  actionLabel,
  muted = false,
  onAction,
}: {
  icon: string;
  label: string;
  note?: string;
  value?: string;
  trailing?: string;
  actionLabel?: string;
  muted?: boolean;
  onAction?: () => void;
}) {
  const hasMeta = Boolean(value) || Boolean(trailing) || Boolean(actionLabel);

  return (
    <div
      className={cn(
        'border-ink/10 flex items-start justify-between gap-3 border-b border-dashed py-2.5 last:border-b-0',
        muted && 'opacity-60',
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span className="shrink-0 text-base leading-6" aria-hidden="true">
          {icon}
        </span>
        <div className="min-w-0">
          <div className="text-ink text-sm leading-6">{label}</div>
          {note ? (
            <div className="text-ink-secondary text-xs leading-5">{note}</div>
          ) : null}
        </div>
      </div>
      {hasMeta ? (
        <div className="shrink-0 text-right">
          {value ? (
            <div className="text-ink text-sm leading-6 font-semibold">
              {value}
            </div>
          ) : null}
          {trailing ? (
            <div className="text-ink-secondary text-xs leading-5">
              {trailing}
            </div>
          ) : null}
          {actionLabel ? (
            <button
              type="button"
              className="text-ink-secondary hover:text-ink mt-1 text-xs underline decoration-dotted underline-offset-4 transition-colors"
              onClick={onAction}
            >
              {actionLabel}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function CultivatorTrackSection() {
  const state = usePersistentStatusState();
  const nextRealm = state?.bodySummary.nextRealm ?? null;

  if (!state || state.trackEntries.length === 0) {
    return null;
  }

  const breakthroughStatus = nextRealm?.canAttempt ? '可升阶' : '未满足';

  return (
    <GameSceneSection title="肉身炼体">
      <div className="space-y-4">
        <div>
          <CompactInfoRow
            icon="🥋"
            label={`肉身·${state.bodySummary.realm.label}`}
            note={state.bodySummary.realm.unlockText}
            value={`总 Lv.${state.bodySummary.totalLevel}`}
            trailing={`单轨上限 Lv.${state.bodySummary.realm.softTrackCap}`}
          />
          {nextRealm ? (
            <div className="border-ink/10 border-b border-dashed py-2.5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <span
                    className="shrink-0 text-base leading-6"
                    aria-hidden="true"
                  >
                    ⛰️
                  </span>
                  <div className="min-w-0">
                    <div className="text-ink text-sm leading-6">
                      下阶·{nextRealm.label}
                    </div>
                    <div className="text-ink-secondary text-xs leading-5">
                      {nextRealm.unlockText}
                    </div>
                  </div>
                </div>
                <div className="text-ink shrink-0 text-right text-sm leading-6 font-semibold">
                  {breakthroughStatus}
                </div>
              </div>
              <div className="text-ink-secondary mt-2 space-y-1 pl-9 text-xs leading-5">
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                  {nextRealm.requirements.map((requirement) => (
                    <span
                      key={requirement.label}
                      className={requirement.met ? 'text-wood' : undefined}
                    >
                      {requirement.met ? '✓' : '·'} {requirement.label}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </div>
        {nextRealm?.canAttempt ? (
          <div className="flex justify-end">
            <InkButton
              href="/game/body-cultivation/breakthrough"
              variant="primary"
              className="text-sm"
            >
              前往升阶
            </InkButton>
          </div>
        ) : null}
        {state.trackEntries.map(({ config, level, progress, threshold }) =>
          config.key === 'marrow_wash' ? (
            <CompactInfoRow
              key={config.key}
              icon="🫧"
              label={config.name}
              note={config.shortDesc}
              value={`Lv.${level}`}
              trailing={`${progress} / ${threshold}`}
              muted={level === 0 && progress === 0}
            />
          ) : (
            (() => {
              const track = state.bodySummary.tracks.find(
                (entry) => entry.path === config.key,
              );
              return (
                <CompactInfoRow
                  key={config.key}
                  icon="🥋"
                  label={config.name}
                  note={
                    track
                      ? `${config.shortDesc} · 下个节点 Lv.${track.nextMilestoneLevel}`
                      : config.shortDesc
                  }
                  value={`Lv.${level}`}
                  trailing={`${progress} / ${threshold}`}
                  muted={level === 0 && progress === 0}
                />
              );
            })()
          ),
        )}
      </div>
    </GameSceneSection>
  );
}
