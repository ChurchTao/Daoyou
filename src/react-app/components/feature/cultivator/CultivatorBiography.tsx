import { FateDetailModal } from '@app/components/feature/fates/FateDetailModal';
import { InkBadge, InkNotice } from '@app/components/ui';
import { GameIcon } from '@app/components/ui/GameIcon';
import { tierColorMap } from '@app/components/ui/inkBadgeTiers';
import { useCultivatorIdentity } from '@app/lib/resources/player';
import { cn } from '@shared/lib/cn';
import { getElementInfo } from '@shared/lib/gameConceptDisplay';
import type { Cultivator } from '@shared/types/cultivator';
import { useState } from 'react';
import { CultivatorReincarnation } from './CultivatorReincarnation';

export function CultivatorBiography() {
  const profile = useCultivatorIdentity();
  const cultivator = profile.data?.cultivator;
  const [detailFate, setDetailFate] = useState<
    Cultivator['pre_heaven_fates'][number] | null
  >(null);
  if (profile.error) return <InkNotice>{profile.error}</InkNotice>;
  if (!cultivator) return <InkNotice>正在读取先天设定……</InkNotice>;

  return (
    <div className="space-y-8 text-sm leading-6">
      <section aria-labelledby="innate-roots-heading">
        <h3 id="innate-roots-heading" className="mb-3 text-base font-semibold">
          灵根
        </h3>
        {cultivator.spiritual_roots.length ? (
          <dl className="grid gap-3 lg:grid-cols-2">
            {cultivator.spiritual_roots.map((root, index) => (
              <div
                key={`${root.element}-${index}`}
                className="bg-ink/3 flex items-center gap-3 rounded-sm px-4 py-4"
              >
                <GameIcon
                  value={getElementInfo(root.element).icon}
                  className="size-8 text-3xl"
                />
                <dt className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-1.5">
                  <span className="text-base font-semibold">
                    {root.element}灵根
                  </span>
                  {root.grade ? (
                    <InkBadge
                      tier={root.grade}
                      className="px-0 whitespace-nowrap"
                    />
                  ) : null}
                </dt>
                <dd className="shrink-0 text-right">
                  <span className="block font-mono text-2xl font-semibold tracking-tight">
                    {root.baseStrength ?? root.strength}
                  </span>
                  <span className="text-ink-secondary text-xs">先天强度</span>
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-ink-secondary">暂无灵根记录。</p>
        )}
      </section>
      <section aria-labelledby="innate-fates-heading">
        <h3 id="innate-fates-heading" className="mb-3 text-base font-semibold">
          先天命格
        </h3>
        {cultivator.pre_heaven_fates.length ? (
          <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
            {cultivator.pre_heaven_fates.map((fate, index) => {
              return (
                <article
                  key={`${fate.name}-${index}`}
                  className="bg-ink/3 flex min-w-0 flex-col rounded-sm p-4"
                >
                  <div className="flex items-center gap-2">
                    <GameIcon value="🔮" className="size-6 text-2xl" />
                    <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-1.5">
                      <h4
                        className={cn(
                          'text-base font-semibold break-words',
                          fate.quality && tierColorMap[fate.quality],
                        )}
                      >
                        {fate.name}
                      </h4>
                      {fate.quality ? (
                        <InkBadge
                          tier={fate.quality}
                          className="px-0 whitespace-nowrap"
                        />
                      ) : null}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDetailFate(fate)}
                    aria-label={`查看${fate.name}详情`}
                    className="text-ink-secondary hover:text-ink mt-1 -mb-2 min-h-11 self-end text-sm focus-visible:outline-2 focus-visible:outline-offset-2"
                  >
                    详情 ›
                  </button>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="text-ink-secondary">暂无先天命格记录。</p>
        )}
      </section>
      <section aria-labelledby="innate-biography-heading">
        <h3
          id="innate-biography-heading"
          className="mb-4 flex items-center gap-2 text-base font-semibold"
        >
          <GameIcon value="📜" />
          人物志
        </h3>
        <dl className="bg-ink/3 grid grid-cols-2 gap-x-6 gap-y-4 rounded-sm p-4">
          <div>
            <dt className="text-ink-secondary mb-1 text-xs">性别</dt>
            <dd>{cultivator.gender}</dd>
          </div>
          <div>
            <dt className="text-ink-secondary mb-1 text-xs">出身</dt>
            <dd className="break-words">{cultivator.origin || '散修出身'}</dd>
          </div>
          <div className="col-span-full">
            <dt className="text-ink-secondary mb-1 text-xs">性情</dt>
            <dd className="break-words whitespace-pre-wrap">
              {cultivator.personality || '未明'}
            </dd>
          </div>
          <div className="col-span-full">
            <dt className="text-ink-secondary mb-1 text-xs">生平</dt>
            <dd className="max-w-prose leading-7 break-words whitespace-pre-wrap">
              {cultivator.background || '未录'}
            </dd>
          </div>
          {cultivator.balance_notes ? (
            <div className="col-span-full">
              <dt className="text-ink-secondary mb-1 text-xs">天道评语</dt>
              <dd className="max-w-prose leading-7 break-words whitespace-pre-wrap">
                {cultivator.balance_notes}
              </dd>
            </div>
          ) : null}
        </dl>
      </section>
      <CultivatorReincarnation key={cultivator.id} />
      <FateDetailModal
        isOpen={detailFate !== null}
        onClose={() => setDetailFate(null)}
        fate={detailFate}
      />
    </div>
  );
}
