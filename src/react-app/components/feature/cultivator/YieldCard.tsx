import { InkModal } from '@app/components/layout';
import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkBadge } from '@app/components/ui/InkBadge';
import { InkButton } from '@app/components/ui/InkButton';
import { GeneratedMaterial } from '@shared/engine/material/creation/types';
import type { Cultivator } from '@shared/types/cultivator';
import { useEffect, useState } from 'react';

interface YieldCardProps {
  cultivator: Cultivator;
  onOk?: () => void;
}

export function YieldCard({ cultivator, onOk }: YieldCardProps) {
  const { pushToast } = useInkUI();
  const [timeSinceYield, setTimeSinceYield] = useState(0);
  const [yieldResult, setYieldResult] = useState<{
    amount: number;
    hours: number;
    story: string;
    materials?: GeneratedMaterial[];
    expGain?: number;
    insightGain?: number;
    materialCount?: number; // 材料生成数量（异步）
  } | null>(null);

  const [claiming, setClaiming] = useState(false);

  // 历练相关
  const handleClaimYield = async () => {
    if (!cultivator) return;
    setClaiming(true);

    try {
      const response = await fetch('/api/cultivator/yield', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || '领取失败');
      }

      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let done = false;

      // Initialize empty result to show modal immediately
      setYieldResult({
        amount: 0,
        hours: 0,
        story: '天机推演中...',
      });

      let currentStory = '';

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        const chunkValue = decoder.decode(value, { stream: true });

        // Process SSE chunks
        const lines = chunkValue.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6);
            if (!dataStr || dataStr === '[DONE]') continue;

            try {
              const data = JSON.parse(dataStr);
              if (data.type === 'result') {
                // Initial calculation result
                setYieldResult(() => ({
                  amount: data.data.amount,
                  hours: data.data.hours,
                  materials: data.data.materials,
                  expGain: data.data.expGain,
                  insightGain: data.data.insightGain,
                  materialCount: data.data.materialCount,
                  story: currentStory || '',
                }));
              } else if (data.type === 'chunk') {
                // Story text chunk
                currentStory += data.text;
                setYieldResult((prev) =>
                  prev ? { ...prev, story: currentStory } : null,
                );
              } else if (data.type === 'error') {
                pushToast({ message: data.error, tone: 'danger' });
              }
            } catch (e) {
              console.error('Error parsing SSE data', e);
            }
          }
        }
      }
    } catch (error) {
      pushToast({
        message: error instanceof Error ? error.message : '领取失败',
        tone: 'danger',
      });
      setYieldResult(null); // Close modal on error
    } finally {
      setClaiming(false);
    }
  };

  const handleCloseYieldModal = () => {
    setYieldResult(null);
    onOk?.();
  };

  useEffect(() => {
    if (cultivator?.last_yield_at) {
      const update = () => {
        const diff = Date.now() - new Date(cultivator.last_yield_at!).getTime();
        setTimeSinceYield(Math.floor(diff / (1000 * 60 * 60)));
      };
      update();
      // Optional: interval if we want auto-update, but not strictly requested
    }
  }, [cultivator?.last_yield_at]);

  return (
    <div className="border-ink/20 bg-bgpaper relative mb-6 overflow-hidden border border-dashed p-4">
      <div className="relative z-10 flex items-center justify-between">
        <div>
          <div className="text-ink-primary flex items-center gap-2 text-lg font-bold">
            <span>🗺️ 历练收益</span>
            {timeSinceYield >= 24 && <InkBadge tone="danger">已满</InkBadge>}
          </div>
          <div className="text-ink-secondary mt-1 text-sm">
            已历练{' '}
            <span className="text-ink-primary font-bold">{timeSinceYield}</span>{' '}
            小时
            <span className="opacity-60"> (上限24h)</span>
          </div>
        </div>
        <InkButton
          variant={timeSinceYield >= 1 ? 'primary' : 'secondary'}
          disabled={timeSinceYield < 1 || claiming}
          onClick={handleClaimYield}
          className="min-w-20"
        >
          {claiming ? '结算中' : timeSinceYield < 1 ? '历练中' : '领取'}
        </InkButton>
      </div>

      {/* 历练结果弹窗 */}
      <InkModal
        isOpen={!!yieldResult}
        onClose={handleCloseYieldModal}
        title="历练归来"
        footer={
          <InkButton
            variant="primary"
            className="w-full"
            onClick={handleCloseYieldModal}
          >
            收入囊中
          </InkButton>
        }
      >
        <div className="text-ink bg-ink/5 border-ink/10 mb-6 max-w-none border border-dashed p-4 text-sm leading-relaxed whitespace-pre-line">
          {yieldResult?.story}
        </div>

        <div className="mb-4 flex items-center justify-center gap-2">
          <span className="text-ink-secondary">获得灵石：</span>
          <span className="text-gold flex items-center gap-1 text-2xl font-bold">
            💎 {yieldResult?.amount}
          </span>
        </div>

        {yieldResult?.expGain && (
          <div className="mb-4 flex items-center justify-center gap-2">
            <span className="text-ink-secondary">修为精进：</span>
            <span className="text-teal text-2xl font-bold">
              ✨ {yieldResult.expGain}
            </span>
          </div>
        )}

        {yieldResult?.insightGain && (
          <div className="mb-4 flex items-center justify-center gap-2">
            <span className="text-ink-secondary">道心感悟：</span>
            <span className="text-wood text-2xl font-bold">
              💡 {yieldResult.insightGain}
            </span>
          </div>
        )}

        {yieldResult?.materials && yieldResult.materials.length > 0 && (
          <div className="mb-6">
            <p className="text-ink mb-2 text-sm font-bold">天材地宝：</p>
            <div className="flex flex-wrap gap-2">
              {yieldResult.materials.map(
                (m: GeneratedMaterial, idx: number) => (
                  <InkBadge key={idx} tier={m.rank}>
                    {`${m.name} x ${m.quantity}`}
                  </InkBadge>
                ),
              )}
            </div>
          </div>
        )}

        {/* 材料异步生成提示 */}
        {yieldResult?.materialCount &&
          yieldResult.materialCount > 0 &&
          (!yieldResult.materials || yieldResult.materials.length === 0) && (
            <div className="border-crimson/30 bg-bgpaper mb-6 border border-dashed p-3 text-center">
              <p className="text-ink-secondary text-sm">
                另有{' '}
                <span className="text-crimson font-bold">
                  {yieldResult.materialCount}
                </span>{' '}
                份天材地宝正在运送中， 稍后将通过传音玉简（邮件）送达。
              </p>
            </div>
          )}
      </InkModal>
    </div>
  );
}
