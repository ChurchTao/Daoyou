import { apiFetch } from '@app/lib/api/fetch';
import {
  GameLoadingState,
  GameSceneAsideSection,
  GameSceneFrame,
} from '@app/components/game-shell';
import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkButton } from '@app/components/ui/InkButton';
import { InkIdentifyCelebration } from '@app/components/ui/InkIdentifyCelebration';
import { InkInput } from '@app/components/ui/InkInput';
import { InkNotice } from '@app/components/ui/InkNotice';
import { useResourceMutation } from '@app/lib/resources/mutations';
import { useCultivatorIdentity } from '@app/lib/resources/player';
import {
  hasReachedLateQiRefining,
  LATE_QI_REDEEM_DENIED,
} from '@daoyou/game-rules/progression/realm-access';
import { useState } from 'react';

export default function RedeemCodePage() {
  const { pushToast } = useInkUI();
  const { mutate } = useResourceMutation();
  const profile = useCultivatorIdentity();
  const identity = profile.data?.cultivator;
  const canRedeem = identity
    ? hasReachedLateQiRefining(identity.realm, identity.realm_stage)
    : false;
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [celebrationTick, setCelebrationTick] = useState(0);

  const submit = async () => {
    if (!canRedeem) {
      pushToast({ message: LATE_QI_REDEEM_DENIED, tone: 'warning' });
      return;
    }
    const normalizedCode = code.trim().toUpperCase();
    if (!normalizedCode) {
      pushToast({ message: '请输入兑换码', tone: 'warning' });
      return;
    }

    setLoading(true);
    try {
      await mutate(
        apiFetch('/api/cultivator/redeem-code/claim', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: normalizedCode }),
        }),
      );
      setSuccess(true);
      setCelebrationTick((prev) => prev + 1);
      setCode('');
    } catch (error) {
      pushToast({
        message: error instanceof Error ? error.message : '兑换失败',
        tone: 'danger',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <GameSceneFrame
      variant="lite"
      title="兑换码"
      description="输入兑换码，奖励会通过传音玉简送达。"
      aside={
        <GameSceneAsideSection
          title="使用说明"
          className="text-sm leading-7"
          help={{
            title: '兑换码使用说明',
            content: (
              <div className="space-y-2 text-sm leading-7">
                <p>兑换成功后，奖励会通过传音玉简发放。</p>
                <p>码值会自动转为大写，避免手误失配。</p>
              </div>
            ),
          }}
        />
      }
    >
      {!identity ? (
        profile.loading ? (
          <GameLoadingState message="正在确认境界……" variant="inline" />
        ) : (
          <InkNotice tone="warning">
            {profile.error || '角色信息读取失败'}
          </InkNotice>
        )
      ) : canRedeem ? (
        <div className="space-y-4">
          <InkInput
            label="兑换码"
            value={code}
            onChange={(value) => setCode(value.toUpperCase())}
            placeholder="请输入兑换码"
            disabled={loading}
          />

          <div className="flex flex-wrap gap-3">
            <InkButton
              variant="primary"
              onClick={submit}
              pending={loading}
              pendingLabel="兑换中……"
            >
              立即兑换
            </InkButton>
          </div>

          {success && (
            <p className="text-sm text-emerald-700">
              兑换成功，奖励已送达传音玉简。
            </p>
          )}
        </div>
      ) : (
        <InkNotice>{LATE_QI_REDEEM_DENIED}</InkNotice>
      )}

      {celebrationTick > 0 && (
        <InkIdentifyCelebration key={celebrationTick} variant="basic" />
      )}
    </GameSceneFrame>
  );
}
