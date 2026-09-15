import { InkButton, InkDetailDrawer } from '@app/components/ui';
import { getPillToxicityStage } from '@shared/lib/condition';
import { getConditionStatusTemplate } from '@shared/lib/conditionStatusRegistry';
import { useState } from 'react';
import {
  getPillToxicityEffectDetails,
  getStatusEffectDetails,
} from './persistentStatusDetails';
import type { CultivatorDisplayProjection } from './useCultivatorDisplayProjection';

export function CultivatorVitals({
  projection,
}: {
  projection: CultivatorDisplayProjection;
}) {
  const [details, setDetails] = useState(false);
  const { display, cultivator, recovery, now } = projection;
  const toxicity = cultivator.condition.gauges.pillToxicity;
  const statuses = cultivator.condition.statuses;
  return (
    <>
      <div className="space-y-3">
        {(['hp', 'mp'] as const).map((key) => {
          const resource = display.resources[key];
          const label = key === 'hp' ? '气血' : '法力';
          return (
            <div key={key}>
              <div className="mb-1 flex justify-between gap-3 text-sm">
                <span>{label}</span>
                <span className="font-mono">
                  {Math.floor(resource.current)} / {Math.floor(resource.max)}
                </span>
              </div>
              <div
                role="meter"
                aria-label={label}
                aria-valuemin={0}
                aria-valuemax={resource.max}
                aria-valuenow={resource.current}
                className="bg-ink/10 h-1.5 overflow-hidden rounded-full"
              >
                <div
                  className={
                    key === 'hp' ? 'bg-crimson/70 h-full' : 'bg-teal/70 h-full'
                  }
                  style={{ width: `${Math.min(100, resource.percent)}%` }}
                />
              </div>
            </div>
          );
        })}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs">
          <span className="text-ink-secondary">状态</span>
          {toxicity > 0 ? (
            <button
              className="text-crimson py-1"
              onClick={() => setDetails(true)}
            >
              丹毒 · {getPillToxicityStage(cultivator.condition).label}{' '}
              <span className="font-mono">{Math.floor(toxicity)}</span>
            </button>
          ) : null}
          {statuses.map((status, index) => (
            <button
              key={`${status.key}:${index}`}
              className="bg-ink/5 px-2 py-1"
              onClick={() => setDetails(true)}
            >
              {getConditionStatusTemplate(status.key)?.name ?? status.key}
            </button>
          ))}
          {toxicity === 0 && statuses.length === 0 ? (
            <span className="text-ink-secondary">无异常</span>
          ) : null}
          <InkButton
            className="ml-auto text-xs"
            onClick={() => setDetails(true)}
          >
            状态详情
          </InkButton>
        </div>
      </div>
      <InkDetailDrawer
        isOpen={details}
        onClose={() => setDetails(false)}
        title="当前状态"
        size="md"
      >
        <div className="space-y-5 text-sm">
          <section className="space-y-2">
            <h3 className="font-semibold">自然恢复</h3>
            {(['hp', 'mp'] as const).map((key) => {
              const value = recovery[key];
              return (
                <p key={key} className="text-ink-secondary">
                  {key === 'hp' ? '气血' : '法力'}：
                  {value.isFull ? (
                    '已满'
                  ) : value.perHour > 0 ? (
                    <>
                      每小时约{' '}
                      <span className="font-mono">
                        {Number(value.perHour.toFixed(1))}
                      </span>
                      {value.timeToFullMs !== null ? (
                        <>
                          ，约{' '}
                          <span className="font-mono">
                            {Math.ceil(value.timeToFullMs / 60000)}
                          </span>{' '}
                          分钟回满
                        </>
                      ) : null}
                    </>
                  ) : (
                    '恢复暂停'
                  )}
                </p>
              );
            })}
          </section>
          <section className="space-y-2">
            <h3 className="font-semibold">丹毒</h3>
            {getPillToxicityEffectDetails(
              cultivator.condition,
              cultivator.pre_heaven_fates,
            ).map((line) => (
              <p key={line} className="text-ink-secondary">
                {line}
              </p>
            ))}
          </section>
          {statuses.map((status, index) => (
            <section key={`${status.key}:${index}`} className="space-y-2">
              <h3 className="font-semibold">
                {getConditionStatusTemplate(status.key)?.name ?? status.key}
              </h3>
              <p className="text-ink-secondary">
                {getConditionStatusTemplate(status.key)?.description}
              </p>
              {status.duration.kind === 'time' && status.duration.expiresAt ? (
                <p>
                  剩余约{' '}
                  <span className="font-mono">
                    {Math.max(
                      1,
                      Math.ceil(
                        (Date.parse(status.duration.expiresAt) -
                          now.getTime()) /
                          60000,
                      ),
                    )}
                  </span>{' '}
                  分钟
                </p>
              ) : null}
              {status.usesRemaining !== undefined ? (
                <p>
                  剩余 <span className="font-mono">{status.usesRemaining}</span>{' '}
                  次
                </p>
              ) : null}
              {getStatusEffectDetails(status).map((line) => (
                <p key={line} className="text-ink-secondary">
                  {line}
                </p>
              ))}
            </section>
          ))}
        </div>
      </InkDetailDrawer>
    </>
  );
}
