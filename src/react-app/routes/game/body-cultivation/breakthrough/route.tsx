import {
  GameSceneFrame,
  GameSceneLoading,
  GameSceneSection,
} from '@app/components/game-shell';
import { useInkUI } from '@app/components/providers/InkUIProvider';
import {
  InkActionGroup,
  InkBadge,
  InkButton,
  InkIdentifyCelebration,
  InkNotice,
} from '@app/components/ui';
import { consumeResourceMutation } from '@app/lib/resources/mutations';
import {
  useCultivatorCondition,
  useCultivatorIdentity,
} from '@app/lib/resources/player';
import type { BodyCultivationBreakthroughResultData } from '@shared/contracts/bodyCultivation';
import { previewBodyCultivationRealmBreakthrough } from '@shared/lib/bodyCultivation/breakthrough';
import { BODY_REALM_LABELS } from '@shared/lib/bodyCultivation/config';
import { cn } from '@shared/lib/cn';
import { useState } from 'react';
import { useNavigate } from 'react-router';

export default function BodyCultivationBreakthroughPage() {
  const profile = useCultivatorIdentity();
  const condition = useCultivatorCondition();
  const identity = profile.data?.cultivator;
  const cultivator =
    identity && condition.data
      ? { realm: identity.realm, condition: condition.data }
      : null;
  const isLoading = profile.loading || condition.loading;
  const { pushToast } = useInkUI();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] =
    useState<BodyCultivationBreakthroughResultData | null>(null);
  const [celebrationTick, setCelebrationTick] = useState(0);

  const preview = cultivator
    ? previewBodyCultivationRealmBreakthrough(cultivator.condition, {
        cultivatorRealm: cultivator.realm,
      })
    : null;

  const submitBreakthrough = async () => {
    if (!preview?.canAdvance || submitting || result) return;

    setSubmitting(true);
    try {
      const response = await fetch(
        '/api/cultivator/body-cultivation/breakthrough',
        { method: 'POST' },
      );
      const nextResult =
        await consumeResourceMutation<BodyCultivationBreakthroughResultData>(
          response,
        );
      setResult(nextResult);
      setCelebrationTick((tick) => tick + 1);
    } catch (caught) {
      pushToast({
        message: caught instanceof Error ? caught.message : '肉身位阶提升失败',
        tone: 'danger',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading && !cultivator) {
    return <GameSceneLoading message="正在读取肉身状态……" />;
  }

  if (!cultivator || !preview) {
    return (
      <div className="flex h-full items-center justify-center px-4">
        <InkNotice>尚无角色资料，暂时无法提升肉身位阶。</InkNotice>
      </div>
    );
  }

  const nextRealmLabel = preview.nextRealm
    ? BODY_REALM_LABELS[preview.nextRealm]
    : null;

  return (
    <GameSceneFrame
      title="肉身升阶"
      description="五轨根基与修为境界俱足，便可直接提升肉身位阶。"
    >
      <div className="space-y-5">
        {result ? (
          <InkNotice tone="info">
            肉身已由{BODY_REALM_LABELS[result.fromRealm]}提升至
            {BODY_REALM_LABELS[result.toRealm]}。
          </InkNotice>
        ) : null}

        <GameSceneSection title="升阶条件">
          <div className="border-ink/15 bg-bgpaper/75 space-y-4 border border-dashed px-3 py-3">
            <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-3">
              <div>
                <p className="text-ink-secondary text-xs leading-5">当前肉身</p>
                <p className="text-ink font-semibold">
                  {BODY_REALM_LABELS[preview.currentRealm]}
                </p>
              </div>
              <div>
                <p className="text-ink-secondary text-xs leading-5">下一位阶</p>
                <p className="text-ink font-semibold">
                  {nextRealmLabel ?? '已至顶阶'}
                </p>
              </div>
              <div>
                <p className="text-ink-secondary text-xs leading-5">五轨总等级</p>
                <p className="text-ink font-semibold">
                  Lv.{preview.totalLevel}
                  {preview.requiredTotalLevel !== null
                    ? ` / ${preview.requiredTotalLevel}`
                    : ''}
                </p>
              </div>
            </div>

            {preview.requirements.length > 0 ? (
              <div className="text-ink-secondary flex flex-wrap gap-x-3 gap-y-1 text-xs leading-5">
                {preview.requirements.map((requirement) => (
                  <span
                    key={requirement.label}
                    className={cn(requirement.met && 'text-wood')}
                  >
                    {requirement.met ? '✓' : '·'} {requirement.label}
                  </span>
                ))}
              </div>
            ) : null}

            <div>
              <InkBadge tone={preview.canAdvance ? 'accent' : 'default'}>
                {preview.nextRealm
                  ? preview.canAdvance
                    ? '条件已齐，可直接升阶'
                    : '根基尚未圆满'
                  : '肉身已至最高位阶'}
              </InkBadge>
            </div>
          </div>
        </GameSceneSection>

        <InkActionGroup>
          <InkButton
            type="button"
            variant="primary"
            disabled={!preview.canAdvance || Boolean(result)}
            pending={submitting}
            pendingLabel="升阶中……"
            onClick={submitBreakthrough}
          >
            提升至{nextRealmLabel ?? '下一位阶'}
          </InkButton>
          <InkButton href="/game/body-cultivation" variant="secondary">
            返回炼体详情
          </InkButton>
        </InkActionGroup>
      </div>

      {celebrationTick > 0 ? (
        <InkIdentifyCelebration
          key={celebrationTick}
          variant="basic"
          onComplete={() => navigate('/game/body-cultivation')}
        />
      ) : null}
    </GameSceneFrame>
  );
}
