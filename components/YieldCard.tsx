'use client';

import { InkBadge, InkButton } from '@/components/ui';
import type { Cultivator } from '@/types/cultivator';
import { GeneratedMaterial } from '@/utils/materialGenerator';
import { useEffect, useState } from 'react';
import { InkModal } from './layout';
import { useInkUI } from './providers/InkUIProvider';

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
  } | null>(null);

  const [claiming, setClaiming] = useState(false);

  // 历练相关
  const handleClaimYield = async () => {
    if (!cultivator) return;
    setClaiming(true);

    try {
      const response = await fetch('/api/cultivators/yield', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cultivatorId: cultivator.id }),
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

  const yieldProgress = Math.min((timeSinceYield / 24) * 100, 100);

  return (
    <div className="mb-6 p-4 border border-ink/20 rounded-lg bg-ink/5 shadow-sm relative overflow-hidden">
      {/* 进度条背景 */}
      <div
        className="absolute bottom-0 left-0 h-1 bg-primary/40 transition-all duration-1000"
        style={{ width: `${yieldProgress}%` }}
      />

      <div className="flex justify-between items-center relative z-10">
        <div>
          <div className="font-bold text-lg text-ink-primary flex items-center gap-2">
            <span>🗺️ 历练收益</span>
            {timeSinceYield >= 24 && <InkBadge tone="danger">已满</InkBadge>}
          </div>
          <div className="text-sm text-ink-secondary mt-1">
            已历练{' '}
            <span className="font-bold text-ink-primary">{timeSinceYield}</span>{' '}
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
        <div className="prose prose-sm prose-invert max-w-none mb-6 text-foreground/90 leading-relaxed bg-ink/5 p-4 rounded-lg border border-ink/10">
          {yieldResult?.story}
        </div>

        <div className="flex justify-center items-center gap-2 mb-6">
          <span className="text-ink-secondary">获得灵石：</span>
          <span className="text-2xl font-bold text-yellow-500 flex items-center gap-1">
            💎 {yieldResult?.amount}
          </span>
        </div>

        {yieldResult?.materials && yieldResult.materials.length > 0 && (
          <div className="mb-6">
            <p className="text-sm font-bold text-ink mb-2">天材地宝：</p>
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
      </InkModal>
    </div>
  );
}
