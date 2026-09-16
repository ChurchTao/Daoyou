import {
  getQiErrorMessage,
  useQiActionConfirm,
} from '@app/components/feature/cultivator/useQiActionConfirm';
import { GameSceneLoading } from '@app/components/game-shell';
import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkButton, InkNotice } from '@app/components/ui';
import { GameIcon } from '@app/components/ui/GameIcon';
import { useResourceMutation } from '@app/lib/resources/mutations';
import {
  useCultivatorCondition,
  useCultivatorIdentity,
} from '@app/lib/resources/player';
import type { PlayerIdentityCultivator } from '@shared/contracts/player';
import { getElementInfo } from '@shared/lib/gameConceptDisplay';
import {
  MARROW_WASH_BREAKTHROUGH_QI_COST,
  getMarrowWashSummary,
} from '@shared/lib/marrowWash';
import { useState } from 'react';

function RootStrengthList({
  roots,
}: {
  roots: PlayerIdentityCultivator['spiritual_roots'];
}) {
  if (roots.length === 0) {
    return <InkNotice>尚无灵根信息。</InkNotice>;
  }

  return (
    <dl className="grid gap-3 lg:grid-cols-2">
      {roots.map((root, index) => {
        const base = root.baseStrength ?? root.strength;
        const bonus = root.marrowWashBonus ?? 0;
        return (
          <div
            key={`${root.element}-${index}`}
            className="bg-ink/3 flex items-center gap-3 rounded-sm p-4"
          >
            <GameIcon
              value={getElementInfo(root.element).icon}
              className="size-8 text-3xl"
            />
            <div className="min-w-0 flex-1">
              <dt className="text-base font-semibold">{root.element}灵根</dt>
              <dd className="text-ink-secondary mt-1 text-xs">
                先天 <span className="font-mono">{base}</span> · 当前{' '}
                <span className="font-mono">{root.strength}</span>
              </dd>
            </div>
            <dd className="shrink-0 text-right">
              <span className="text-wood block font-mono text-2xl font-semibold tracking-tight">
                +{bonus}
              </span>
              <span className="text-ink-secondary text-xs">后天增益</span>
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

export function MarrowWashPanel() {
  const profile = useCultivatorIdentity();
  const condition = useCultivatorCondition();
  const identity = profile.data?.cultivator;
  const cultivator =
    identity && condition.data
      ? {
          realm: identity.realm,
          condition: condition.data,
          spiritual_roots: identity.spiritual_roots,
          unallocated_attribute_points: identity.unallocated_attribute_points,
        }
      : null;
  const isLoading = profile.loading || condition.loading;
  const { mutate } = useResourceMutation();
  const { pushToast } = useInkUI();
  const { openQiActionConfirm } = useQiActionConfirm();
  const [isBreakingThrough, setIsBreakingThrough] = useState(false);

  if (profile.error || condition.error)
    return <InkNotice>{profile.error || condition.error}</InkNotice>;

  if (isLoading && !cultivator) {
    return <GameSceneLoading message="正在观照洗髓进度……" />;
  }

  if (!cultivator) {
    return (
      <div className="flex h-full items-center justify-center px-4">
        <InkNotice>
          尚无角色资料，先创建角色后再进入洗髓池。
          <InkButton href="/game/create" variant="primary" className="ml-2">
            觉醒灵根
          </InkButton>
        </InkNotice>
      </div>
    );
  }

  const summary = getMarrowWashSummary(cultivator.condition, {
    cultivatorRealm: cultivator.realm,
  });
  const unallocatedPoints = cultivator.unallocated_attribute_points ?? 0;
  const progressPercent = Math.round(
    Math.max(0, Math.min(summary.progress / summary.threshold, 1)) * 100,
  );

  const executeBreakthrough = async () => {
    if (isBreakingThrough) return;

    try {
      setIsBreakingThrough(true);
      const result = await mutate<{
        toRealm: number;
        breakthroughLevel: number;
      }>(
        fetch('/api/cultivator/marrow-wash/breakthrough', {
          method: 'POST',
        }),
      );
      pushToast({
        message: `洗髓已破入第 ${result.toRealm} 重，灵根后天强度已提升。`,
        tone: 'success',
      });
    } catch (error) {
      if (error instanceof Error) {
        pushToast({
          message: getQiErrorMessage(
            { error: error.message, message: error.message },
            '洗髓破限失败',
          ),
          tone: 'danger',
        });
      } else {
        pushToast({ message: '洗髓破限失败', tone: 'danger' });
      }
    } finally {
      setIsBreakingThrough(false);
    }
  };

  const openBreakthroughConfirm = () => {
    openQiActionConfirm({
      actionName: '洗髓破限',
      qiCost: MARROW_WASH_BREAKTHROUGH_QI_COST,
      confirmLabel: '确认破限',
      onConfirm: executeBreakthrough,
    });
  };

  return (
    <div className="space-y-8">
      <section aria-labelledby="marrow-wash-heading">
        <h3 id="marrow-wash-heading" className="mb-3 text-base font-semibold">
          洗髓
        </h3>
        <div className="bg-ink/3 rounded-sm p-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <GameIcon value="💧" className="size-9 text-3xl" />
              <div>
                <p className="text-xl font-semibold">{summary.realmLabel}</p>
                <p className="text-ink-secondary mt-1 text-xs">
                  当前上限{' '}
                  <span className="font-mono">Lv.{summary.levelCap}</span>
                </p>
              </div>
            </div>
            <div className="ml-auto text-right">
              <p className="font-mono text-2xl font-semibold tracking-tight">
                Lv.{summary.level}
              </p>
              <p className="text-ink-secondary text-xs">洗髓等级</p>
            </div>
            {summary.canBreakthrough ? (
              <InkButton
                variant="primary"
                disabled={isBreakingThrough}
                onClick={openBreakthroughConfirm}
              >
                破限
              </InkButton>
            ) : null}
          </div>
          <div className="mt-5">
            <div className="text-ink-secondary flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-xs">
              <span>
                洗髓进度{' '}
                <span className="font-mono">
                  {summary.progress} / {summary.threshold}
                </span>
              </span>
              <span>
                {summary.nextBreakthroughLevel ? (
                  <>
                    破限门槛{' '}
                    <span className="font-mono">
                      Lv.{summary.nextBreakthroughLevel}
                    </span>
                  </>
                ) : (
                  '当前修为暂不可继续破限'
                )}
              </span>
            </div>
            <div
              className="bg-ink/10 mt-2 h-1.5 overflow-hidden rounded-full"
              aria-hidden="true"
            >
              <div
                className="bg-teal h-full rounded-full"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between gap-3">
            <span className="text-ink-secondary text-xs">自由属性点</span>
            <span className="text-wood font-mono text-lg font-semibold">
              {unallocatedPoints}
            </span>
          </div>
        </div>
      </section>
      <section aria-labelledby="acquired-roots-heading">
        <h3
          id="acquired-roots-heading"
          className="mb-3 text-base font-semibold"
        >
          灵根后天增益
        </h3>
        <RootStrengthList roots={cultivator.spiritual_roots} />
      </section>
    </div>
  );
}
