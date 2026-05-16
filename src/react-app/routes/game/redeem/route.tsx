import { GameSceneAsideSection, GameSceneFrame } from '@app/components/game-shell';
import { InkSection } from '@app/components/layout';
import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkButton } from '@app/components/ui/InkButton';
import { InkIdentifyCelebration } from '@app/components/ui/InkIdentifyCelebration';
import { InkInput } from '@app/components/ui/InkInput';
import { useState } from 'react';

export default function RedeemCodePage() {
  const { pushToast } = useInkUI();
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
      const res = await fetch('/api/cultivator/redeem-code/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: normalizedCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '兑换失败');
      }
      setSuccess(true);
      setCelebrationTick((prev) => prev + 1);
      setCode('');
      pushToast({
        message: '兑换成功，奖励已通过传音玉简发放',
        tone: 'success',
      });
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
      description="天机有契，凭码领缘。奖励不直接落袋，而是经由玉简投递，适合作为轻量服务页嵌回主游戏壳。"
      aside={
        <GameSceneAsideSection title="使用说明" className="text-sm leading-7">
          <p>兑换成功后，奖励会通过传音玉简发放。</p>
          <p className="mt-2">码值会自动转为大写，避免手误失配。</p>
        </GameSceneAsideSection>
      }
      actionBar={
        <div className="flex flex-wrap gap-2">
          <InkButton href="/game/mail" variant="primary">
            前往传音玉简
          </InkButton>
          <InkButton href="/game/world-chat">查看世界传音</InkButton>
        </div>
      }
    >
      <InkSection title="【兑换】">
        <div className="space-y-4">
          <InkInput
            label="兑换码"
            value={code}
            onChange={(value) => setCode(value.toUpperCase())}
            placeholder="请输入兑换码"
            disabled={loading}
          />

          <div className="flex flex-wrap gap-3">
            <InkButton variant="primary" onClick={submit} disabled={loading}>
              {loading ? '兑换中...' : '立即兑换'}
            </InkButton>
            <InkButton href="/game/mail" variant="secondary">
              前往传音玉简
            </InkButton>
          </div>

          {success && (
            <p className="text-sm text-emerald-700">
              兑换成功，奖励已通过传音玉简发放，请及时查收。
            </p>
          )}
        </div>
      </InkSection>

      {celebrationTick > 0 && (
        <InkIdentifyCelebration key={celebrationTick} variant="basic" />
      )}
    </GameSceneFrame>
  );
}
