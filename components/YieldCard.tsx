'use client';

import { InkBadge, InkButton } from '@/components/InkComponents';
import type { Cultivator } from '@/types/cultivator';
import { useEffect, useState } from 'react';

interface YieldCardProps {
  cultivator: Cultivator;
  onClaim: () => void;
  isClaiming?: boolean;
}

export function YieldCard({
  cultivator,
  onClaim,
  isClaiming = false,
}: YieldCardProps) {
  const [timeSinceYield, setTimeSinceYield] = useState(0);

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
            <span className="font-mono font-bold text-ink-primary">
              {timeSinceYield}
            </span>{' '}
            小时
            <span className="opacity-60"> (上限24h)</span>
          </div>
        </div>
        <InkButton
          variant={timeSinceYield >= 1 ? 'primary' : 'secondary'}
          disabled={timeSinceYield < 1 || isClaiming}
          onClick={onClaim}
          className="min-w-20"
        >
          {isClaiming ? '结算中' : timeSinceYield < 1 ? '历练中' : '领取'}
        </InkButton>
      </div>
    </div>
  );
}
