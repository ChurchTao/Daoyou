import {
  GameSceneFrame,
  GameSceneSection,
} from '@app/components/game-shell';
import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkBadge, InkButton, InkNotice } from '@app/components/ui';
import {
  getQiErrorMessage,
  useQiActionConfirm,
} from '@app/components/feature/cultivator/useQiActionConfirm';
import {
  useActiveCultivatorProfile,
  usePlayerStateStatus,
} from '@app/lib/player-state/selectors';
import { usePlayerStateActions } from '@app/lib/player-state/store';
import {
  MARROW_WASH_BREAKTHROUGH_QI_COST,
  getMarrowWashSummary,
} from '@shared/lib/marrowWash';
import { useState } from 'react';

function RootStrengthList({
  roots,
}: {
  roots: NonNullable<ReturnType<typeof useActiveCultivatorProfile>>['spiritual_roots'];
}) {
  if (roots.length === 0) {
    return <InkNotice>尚无灵根信息。</InkNotice>;
  }

  return (
    <div className="grid gap-2 md:grid-cols-2">
      {roots.map((root, index) => {
        const base = root.baseStrength ?? root.strength;
        const bonus = root.marrowWashBonus ?? 0;
        return (
          <div
            key={`${root.element}-${index}`}
            className="border-ink/15 bg-bgpaper/60 border border-dashed px-3 py-2"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-ink text-sm font-semibold">{root.element}</p>
                <p className="text-ink-secondary text-xs leading-5">
                  原始 {base} · 后天 +{bonus}
                </p>
              </div>
              <InkBadge tone="default">强度 {root.strength}</InkBadge>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function MarrowWashPage() {
  const cultivator = useActiveCultivatorProfile();
  const { isLoading } = usePlayerStateStatus();
  const { mutate } = usePlayerStateActions();
  const { pushToast } = useInkUI();
  const { openQiActionConfirm } = useQiActionConfirm();
  const [isBreakingThrough, setIsBreakingThrough] = useState(false);

  if (isLoading && !cultivator) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="loading-tip">正在观照洗髓进度……</p>
      </div>
    );
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
    <GameSceneFrame
      title="洗髓池"
      description="服用洗髓丹推动洗髓进度。洗髓升级会沉淀为自由属性点，破限后会增强后天灵根强度。"
    >
      <GameSceneSection
        title="洗髓总览"
        actions={
          summary.canBreakthrough ? (
            <InkButton
              variant="primary"
              disabled={isBreakingThrough}
              onClick={openBreakthroughConfirm}
            >
              破限
            </InkButton>
          ) : null
        }
      >
        <div className="border-ink/15 bg-bgpaper/70 border border-dashed px-3 py-3">
          <div className="grid gap-3 md:grid-cols-4">
            <div>
              <p className="text-ink-secondary text-xs leading-5">洗髓等级</p>
              <p className="text-ink text-lg leading-8 font-semibold">
                Lv.{summary.level}
              </p>
            </div>
            <div>
              <p className="text-ink-secondary text-xs leading-5">洗髓境界</p>
              <p className="text-ink text-lg leading-8 font-semibold">
                {summary.realmLabel}
              </p>
            </div>
            <div>
              <p className="text-ink-secondary text-xs leading-5">当前上限</p>
              <p className="text-ink text-lg leading-8 font-semibold">
                Lv.{summary.levelCap}
              </p>
            </div>
            <div>
              <p className="text-ink-secondary text-xs leading-5">自由属性点</p>
              <p className="text-wood text-lg leading-8 font-semibold">
                {unallocatedPoints}
              </p>
            </div>
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between gap-2 text-xs leading-5">
              <span className="text-ink-secondary">
                {summary.progress} / {summary.threshold}
              </span>
              <span className="text-ink-secondary">
                {summary.nextBreakthroughLevel
                  ? `破限门槛 Lv.${summary.nextBreakthroughLevel}`
                  : '当前修为暂不可继续破限'}
              </span>
            </div>
            <div className="bg-ink/10 mt-1 h-1.5 overflow-hidden">
              <div
                className="bg-teal h-full"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>
      </GameSceneSection>

      <GameSceneSection title="后天灵根">
        <RootStrengthList roots={cultivator.spiritual_roots} />
      </GameSceneSection>
    </GameSceneFrame>
  );
}
