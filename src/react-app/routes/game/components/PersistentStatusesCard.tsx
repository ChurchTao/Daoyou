import { getPillToxicityStage, isConditionStatusActive } from '@shared/lib/condition';
import { getConditionStatusTemplate } from '@shared/lib/conditionStatusRegistry';
import { getAllTrackConfigs } from '@shared/lib/trackConfigRegistry';
import { useCultivator } from '@app/lib/contexts/CultivatorContext';
import { InkListItem } from '@app/components/ui/InkList';
import { useState } from 'react';

function formatRemainingTime(expiresAt: string | undefined, now: number): string {
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

export function PersistentStatusesCard() {
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
  const pillToxicity = Math.max(
    0,
    Math.floor(cultivator.condition?.gauges.pillToxicity ?? 0),
  );
  const pillToxicityStage = getPillToxicityStage(cultivator.condition);
  const trackConfigs = getAllTrackConfigs();
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

  const showResourceState =
    currentHp < maxHp || currentMp < maxMp || pillToxicity > 0;

  if (!showResourceState && statuses.length === 0 && trackEntries.length === 0) {
    return null;
  }

  return (
    <InkListItem
      title={
        <div className="flex items-center justify-between">
          <span>✨ 持久状态</span>
          <span className="text-sm opacity-60">
            {statuses.length > 0 ? `${statuses.length}项长期影响` : '当前无伤势词缀'}
          </span>
        </div>
      }
      description={
        <div className="mt-2 space-y-2">
          {showResourceState && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div className="bg-ink/5 rounded p-2 text-sm">
                <div className="opacity-60">当前气血</div>
                <div className="font-bold">
                  {currentHp} / {maxHp}
                </div>
              </div>
              <div className="bg-ink/5 rounded p-2 text-sm">
                <div className="opacity-60">当前真元</div>
                <div className="font-bold">
                  {currentMp} / {maxMp}
                </div>
              </div>
              <div className="bg-ink/5 rounded p-2 text-sm">
                <div className="opacity-60">丹毒积累</div>
                <div className="font-bold">{pillToxicity}</div>
                <div className="text-xs opacity-60">{pillToxicityStage.label}</div>
              </div>
            </div>
          )}

          {statuses.map((status, index) => {
            const template = getConditionStatusTemplate(status.key);
            return (
              <div
                key={`${status.key}:${index}`}
                className="bg-ink/5 flex items-center justify-between rounded p-2"
              >
                <div className="flex flex-1 items-center gap-2">
                  <span className="text-xl">
                    {template?.display.icon ?? '💫'}
                  </span>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">
                      {template?.name ?? status.key}
                    </span>
                    <span className="text-xs opacity-60">
                      {template?.display.shortDesc ?? template?.description ?? '长期状态影响'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  {status.duration.kind === 'time' && (
                    <div className="text-right">
                      <div className="opacity-60">剩余</div>
                      <div className="font-bold">
                        {formatRemainingTime(status.duration.expiresAt, now)}
                      </div>
                    </div>
                  )}
                  {typeof status.usesRemaining === 'number' &&
                    status.usesRemaining > 0 && (
                      <div className="text-right">
                        <div className="opacity-60">次数</div>
                        <div className="font-bold">{status.usesRemaining}</div>
                      </div>
                    )}
                </div>
              </div>
            );
          })}

          <div className="space-y-2 pt-1">
            <div className="text-sm font-medium opacity-80">炼体 / 洗髓进度</div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {trackEntries.map(({ config, level, progress, threshold }) => (
                <div key={config.key} className="bg-ink/5 rounded p-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span>{config.name}</span>
                    <span className="font-bold">Lv.{level}</span>
                  </div>
                  <div className="mt-1 text-xs opacity-60">{config.shortDesc}</div>
                  <div className="mt-1 font-mono text-xs">
                    {progress} / {threshold}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      }
    />
  );
}
