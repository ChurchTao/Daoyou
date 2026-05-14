import { getCombatStatusTemplate } from '@shared/engine/battle-v5/setup/CombatStatusTemplateRegistry';
import type { PersistentCombatStatusV5 } from '@shared/engine/battle-v5/setup/types';
import { useCultivator } from '@app/lib/contexts/CultivatorContext';
import { InkListItem } from '@app/components/ui/InkList';
import { useState } from 'react';

function formatRemainingTime(
  expiresAt: number | undefined,
  now: number,
): string {
  if (!expiresAt || expiresAt <= 0) return '永久';
  const remaining = expiresAt - now;

  if (remaining <= 0) return '已过期';

  const days = Math.floor(remaining / (24 * 60 * 60 * 1000));
  const hours = Math.floor(remaining / (60 * 60 * 1000));
  const minutes = Math.floor(remaining / (60 * 1000));

  if (days >= 1) return `${days}日`;
  if (hours >= 1) return `${hours}时`;
  return `${minutes}分`;
}

function isActiveStatus(status: PersistentCombatStatusV5, now: number): boolean {
  if (typeof status.expiresAt === 'number' && status.expiresAt <= now) {
    return false;
  }
  if (
    typeof status.usesRemaining === 'number' &&
    status.usesRemaining <= 0
  ) {
    return false;
  }
  return true;
}

export function PersistentStatusesCard() {
  const { cultivator, finalAttributes } = useCultivator();
  const [now] = useState(() => Date.now());

  if (!cultivator) return null;
  const statuses = (cultivator.persistent_statuses ?? []).filter((status) =>
    isActiveStatus(status, now),
  );
  const maxHp = Math.max(0, Math.floor(finalAttributes?.maxHp ?? 0));
  const maxMp = Math.max(0, Math.floor(finalAttributes?.maxMp ?? 0));
  const currentHp = Math.max(
    0,
    Math.floor(cultivator.persistent_state?.currentHp ?? maxHp),
  );
  const currentMp = Math.max(
    0,
    Math.floor(cultivator.persistent_state?.currentMp ?? maxMp),
  );
  const pillToxicity = Math.max(
    0,
    Math.floor(cultivator.persistent_state?.pillToxicity ?? 0),
  );

  const showResourceState =
    currentHp < maxHp || currentMp < maxMp || pillToxicity > 0;

  if (!showResourceState && statuses.length === 0) return null;

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
              </div>
            </div>
          )}

          {statuses.map((status, index) => {
            const template = getCombatStatusTemplate(status.templateId);
            return (
              <div
                key={`${status.templateId}:${index}`}
                className="bg-ink/5 flex items-center justify-between rounded p-2"
              >
                <div className="flex flex-1 items-center gap-2">
                  <span className="text-xl">
                    {template?.display.icon ?? '💫'}
                  </span>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">
                      {template?.name ?? status.templateId}
                    </span>
                    <span className="text-xs opacity-60">
                      {template?.display.shortDesc ?? template?.description ?? '长期状态影响'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  {typeof status.expiresAt === 'number' && (
                    <div className="text-right">
                      <div className="opacity-60">剩余</div>
                      <div className="font-bold">
                      {formatRemainingTime(status.expiresAt, now)}
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
        </div>
      }
    />
  );
}
