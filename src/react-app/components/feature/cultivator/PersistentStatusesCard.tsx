import { GameSceneSection } from '@app/components/game-shell/GameSceneSection';
import { InkDialog, type InkDialogState } from '@app/components/ui';
import { useCultivator } from '@app/lib/contexts/CultivatorContext';
import { cn } from '@shared/lib/cn';
import {
  getBreakthroughPenaltyPercent,
  getNaturalRecoveryEstimate,
  getPillToxicityRecoveryMultiplier,
  getPillToxicityStage,
  isConditionStatusActive,
} from '@shared/lib/condition';
import { getConditionStatusTemplate } from '@shared/lib/conditionStatusRegistry';
import { getResourceLabel, getResourceText } from '@shared/lib/resourceText';
import { getAllTrackConfigs } from '@shared/lib/trackConfigRegistry';
import type {
  ConditionStatusInstance,
  ConditionTrackPath,
} from '@shared/types/condition';
import { useState } from 'react';
import {
  getPillToxicityEffectDetails,
  getStatusEffectDetails,
} from './persistentStatusDetails';

const TRACK_ORDER: ConditionTrackPath[] = [
  'marrow_wash',
  'tempering.vitality',
  'tempering.spirit',
  'tempering.wisdom',
  'tempering.speed',
  'tempering.willpower',
];

function formatRemainingTime(
  expiresAt: string | undefined,
  now: number,
): string {
  if (!expiresAt) return '永久';
  const expiresAtMs = Date.parse(expiresAt);
  if (!Number.isFinite(expiresAtMs)) return '永久';

  const remaining = expiresAtMs - now;
  if (remaining <= 0) return '已过期';

  const days = Math.floor(remaining / (24 * 60 * 60 * 1000));
  const hours = Math.floor(remaining / (60 * 60 * 1000));
  const minutes = Math.floor(remaining / (60 * 1000));

  if (days >= 1) return `${days}日`;
  if (hours >= 1) return `${hours}时`;
  return `${minutes}分`;
}

function formatDurationMs(durationMs: number): string {
  const totalMinutes = Math.max(1, Math.ceil(durationMs / (60 * 1000)));
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;

  if (days >= 1) {
    return hours > 0 ? `${days}日${hours}时` : `${days}日`;
  }
  if (hours >= 1) {
    return minutes > 0 ? `${hours}时${minutes}分` : `${hours}时`;
  }
  return `${minutes}分`;
}

function formatRecoveryPerHour(value: number): string {
  const rounded = Number(value.toFixed(value >= 10 ? 1 : 2));
  return Number.isInteger(rounded) ? `${rounded}` : `${rounded}`;
}

function usePersistentStatusState() {
  const { cultivator, finalAttributes } = useCultivator();
  const [now] = useState(() => Date.now());

  if (!cultivator) return null;
  const statuses = (cultivator.condition?.statuses ?? []).filter((status) =>
    isConditionStatusActive(status, new Date(now)),
  );
  const maxHp = Math.max(0, Math.floor(finalAttributes?.maxHp ?? 0));
  const maxMp = Math.max(0, Math.floor(finalAttributes?.maxMp ?? 0));
  const currentHp = Math.max(
    0,
    Math.floor(cultivator.condition?.resources.hp.current ?? maxHp),
  );
  const currentMp = Math.max(
    0,
    Math.floor(cultivator.condition?.resources.mp.current ?? maxMp),
  );
  const cultivationExp = Math.max(
    0,
    Math.floor(cultivator.cultivation_progress?.cultivation_exp ?? 0),
  );
  const cultivationCap = Math.max(
    1,
    Math.floor(cultivator.cultivation_progress?.exp_cap ?? 100),
  );
  const cultivationPercent = Math.round(
    Math.max(0, Math.min((cultivationExp / cultivationCap) * 100, 100)),
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
  const pillToxicityStage = getPillToxicityStage(cultivator.condition);
  const pillToxicityRecoveryEfficiency = Math.round(
    getPillToxicityRecoveryMultiplier(cultivator.condition) * 100,
  );
  const breakthroughPenaltyPercent = getBreakthroughPenaltyPercent(
    cultivator.condition,
  );
  const trackConfigs = getAllTrackConfigs().sort(
    (left, right) =>
      TRACK_ORDER.indexOf(left.key) - TRACK_ORDER.indexOf(right.key),
  );
  const trackEntries = trackConfigs.map((config) => {
    const state =
      config.key === 'marrow_wash'
        ? cultivator.condition?.tracks.marrowWash
        : cultivator.condition?.tracks.tempering[
            config.key.replace('tempering.', '') as keyof NonNullable<
              typeof cultivator.condition
            >['tracks']['tempering']
          ];
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
  const hpRecovery = getNaturalRecoveryEstimate({
    resource: 'hp',
    current: currentHp,
    max: maxHp,
    conditionInput: cultivator.condition,
    now: new Date(now),
  });
  const mpRecovery = getNaturalRecoveryEstimate({
    resource: 'mp',
    current: currentMp,
    max: maxMp,
    conditionInput: cultivator.condition,
    now: new Date(now),
  });

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
    trackEntries,
  };
}

type DetailDialogState =
  | {
      kind: 'status';
      status: ConditionStatusInstance;
    }
  | { kind: 'toxicity' }
  | null;

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

export function CultivatorCurrentStatusSection() {
  const state = usePersistentStatusState();
  const [detailDialog, setDetailDialog] = useState<DetailDialogState>(null);

  if (!state) {
    return null;
  }

  const hasCultivationState = Boolean(state.cultivator.cultivation_progress);

  const dialog: InkDialogState | null =
    detailDialog?.kind === 'status'
      ? (() => {
          const template = getConditionStatusTemplate(detailDialog.status.key);
          const details = getStatusEffectDetails(detailDialog.status);
          if (!template || details.length === 0) {
            return null;
          }

          return {
            id: `status:${detailDialog.status.key}`,
            title: `【${template.name}】影响`,
            content: (
              <div className="space-y-3 text-sm leading-7">
                <p className="text-ink-secondary">{template.description}</p>
                <div className="space-y-1">
                  {details.map((detail) => (
                    <p key={detail}>{detail}</p>
                  ))}
                </div>
              </div>
            ),
            confirmLabel: '知道了',
            cancelLabel: null,
          };
        })()
      : detailDialog?.kind === 'toxicity'
        ? {
            id: 'toxicity',
            title: '【丹毒】影响',
            content: (
              <div className="space-y-3 text-sm leading-7">
                <div className="space-y-1">
                  {getPillToxicityEffectDetails(state.cultivator.condition).map(
                    (detail) => (
                      <p key={detail}>{detail}</p>
                    ),
                  )}
                </div>
              </div>
            ),
            confirmLabel: '知道了',
            cancelLabel: null,
          }
        : null;

  const cultivationRows = hasCultivationState ? (
    <>
      <CompactInfoRow
        icon="🧘"
        label={getResourceText('cultivation_exp')}
        value={`${state.cultivationExp} / ${state.cultivationCap}`}
        trailing={`${state.cultivationPercent}%`}
      />
      <CompactInfoRow
        icon="💡"
        label="道心感悟"
        value={`${state.comprehensionInsight} / 100`}
      />
    </>
  ) : null;

  return (
    <>
      <GameSceneSection title="当前状态" contentClassName="space-y-2">
        <div>
          {cultivationRows}
          <CompactInfoRow
            icon="❤️"
            label={getResourceLabel('hp')}
            note={
              state.hpRecovery.isFull
                ? '自然恢复已满'
                : `自然恢复每时约 ${formatRecoveryPerHour(state.hpRecovery.perHour)}/小时`
            }
            value={`${state.currentHp} / ${state.maxHp}`}
            trailing={
              state.hpRecovery.isFull
                ? undefined
                : state.hpRecovery.timeToFullMs !== null
                  ? `约 ${formatDurationMs(state.hpRecovery.timeToFullMs)}回满`
                  : '恢复时机未定'
            }
          />
          <CompactInfoRow
            icon="💧"
            label={getResourceLabel('mp')}
            note={
              state.mpRecovery.isFull
                ? '自然恢复已满'
                : `自然恢复约 ${formatRecoveryPerHour(state.mpRecovery.perHour)}/小时`
            }
            value={`${state.currentMp} / ${state.maxMp}`}
            trailing={
              state.mpRecovery.isFull
                ? undefined
                : state.mpRecovery.timeToFullMs !== null
                  ? `约 ${formatDurationMs(state.mpRecovery.timeToFullMs)}回满`
                  : '恢复时机未定'
            }
          />
          <CompactInfoRow
            icon="☠️"
            label="丹毒"
            note={state.pillToxicityStage.label}
            value={`${state.pillToxicity}`}
            trailing={`恢复 ${state.pillToxicityRecoveryEfficiency}% · 破境压制 ${state.breakthroughPenaltyPercent}%`}
            actionLabel="查看情况"
            onAction={() => setDetailDialog({ kind: 'toxicity' })}
          />
        </div>

        {state.statuses.map((status, index) => {
          const template = getConditionStatusTemplate(status.key);
          const effectDetails = getStatusEffectDetails(status);

          return (
            <CompactInfoRow
              key={`${status.key}:${index}`}
              icon={template?.display.icon ?? '💫'}
              label={template?.name ?? status.key}
              note={
                template?.display.shortDesc ??
                template?.description ??
                '长期状态影响'
              }
              value={
                status.duration.kind === 'time'
                  ? formatRemainingTime(status.duration.expiresAt, state.now)
                  : undefined
              }
              trailing={
                typeof status.usesRemaining === 'number' &&
                status.usesRemaining > 0
                  ? `${status.usesRemaining}次`
                  : undefined
              }
              actionLabel={effectDetails.length > 0 ? '查看情况' : undefined}
              onAction={
                effectDetails.length > 0
                  ? () => setDetailDialog({ kind: 'status', status })
                  : undefined
              }
            />
          );
        })}
      </GameSceneSection>

      <InkDialog dialog={dialog} onClose={() => setDetailDialog(null)} />
    </>
  );
}

export function CultivatorTrackSection() {
  const state = usePersistentStatusState();

  if (!state || state.trackEntries.length === 0) {
    return null;
  }

  return (
    <GameSceneSection title="洗髓与炼体">
      <div>
        {state.trackEntries.map(({ config, level, progress, threshold }) => (
          <CompactInfoRow
            key={config.key}
            icon={config.key === 'marrow_wash' ? '🫧' : '🥋'}
            label={config.name}
            note={config.shortDesc}
            value={`Lv.${level}`}
            trailing={`${progress} / ${threshold}`}
            muted={level === 0 && progress === 0}
          />
        ))}
      </div>
    </GameSceneSection>
  );
}
