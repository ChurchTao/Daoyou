'use client';

import { InkPageShell, InkSection } from '@/components/layout';
import { useInkUI } from '@/components/providers/InkUIProvider';
import { InkButton } from '@/components/ui/InkButton';
import { InkIdentifyCelebration } from '@/components/ui/InkIdentifyCelebration';
import { InkInput } from '@/components/ui/InkInput';
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
    <InkPageShell
      title="兑换码"
      subtitle="天机有契，凭码领缘"
      backHref="/game"
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
    </InkPageShell>
  );
}
