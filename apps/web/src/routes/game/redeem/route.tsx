import { apiFetch } from '@app/lib/api/fetch';
import {
  GameSceneAsideSection,
  GameSceneFrame,
} from '@app/components/game-shell';
import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkButton } from '@app/components/ui/InkButton';
import { InkIdentifyCelebration } from '@app/components/ui/InkIdentifyCelebration';
import { InkInput } from '@app/components/ui/InkInput';
import { useResourceMutation } from '@app/lib/resources/mutations';
import { useState } from 'react';

export default function RedeemCodePage() {
  const { pushToast } = useInkUI();
  const { mutate } = useResourceMutation();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [celebrationTick, setCelebrationTick] = useState(0);

  const submit = async () => {
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

      {celebrationTick > 0 && (
        <InkIdentifyCelebration key={celebrationTick} variant="basic" />
      )}
    </GameSceneFrame>
  );
}
