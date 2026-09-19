import { InkButton, InkDetailDrawer } from '@app/components/ui';
import { getPillToxicityStage } from '@shared/lib/condition';
import { getConditionStatusTemplate } from '@shared/lib/conditionStatusRegistry';
import { useState } from 'react';
import { CharacterSheetRow } from './CharacterSheetRow';
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
              <dl className="text-sm">
                <CharacterSheetRow
                  label={label}
                  className="grid-cols-[auto_minmax(0,1fr)] py-0 [&_dd]:text-right"
                >
                  <span className="font-mono">
                    {Math.floor(resource.current)} / {Math.floor(resource.max)}
                  </span>
                </CharacterSheetRow>
              </dl>
              <div
                className="bg-battle-faint mt-1.5 h-1 overflow-hidden rounded-full"
                role="progressbar"
                aria-label={label}
                aria-valuemin={0}
                aria-valuemax={Math.floor(resource.max)}
                aria-valuenow={Math.floor(resource.current)}
              >
                <div
                  className={
                    key === 'hp' ? 'bg-resource-hp h-full' : 'bg-resource-mp h-full'
                  }
                  style={{
                    width: `${Math.max(0, Math.min(100, (resource.current / Math.max(1, resource.max)) * 100))}%`,
                  }}
                />
              </div>
            </div>
          );
        })}
        <dl className="col-span-full">
          <CharacterSheetRow label="状态">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              {toxicity > 0 ? (
                <button
                  className="text-crimson text-left"
                  onClick={() => setDetails(true)}
                >
                  丹毒 · {getPillToxicityStage(cultivator.condition).label}{' '}
                  <span className="font-mono">{Math.floor(toxicity)}</span>
                </button>
              ) : null}
              {statuses.map((status, index) => (
                <button
                  key={`${status.key}:${index}`}
                  className="text-left"
                  onClick={() => setDetails(true)}
                >
                  {getConditionStatusTemplate(status.key)?.name ?? status.key}
                </button>
              ))}
              {toxicity === 0 && statuses.length === 0 ? (
                <span className="text-ink-secondary">无异常</span>
              ) : null}
              <InkButton
                className="p-0 text-sm leading-6 tracking-normal"
                onClick={() => setDetails(true)}
              >
                状态详情
              </InkButton>
            </div>
          </CharacterSheetRow>
        </dl>
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
