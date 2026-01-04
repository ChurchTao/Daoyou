'use client';

import { InkCard } from '@/components/ui';
import { buffRegistry } from '@/engine/buff';
import type { BuffInstanceState } from '@/engine/buff/types';

interface StatusCardProps {
  buffs: BuffInstanceState[];
  title?: string;
  compact?: boolean;
  emptyMessage?: string;
}

/**
 * 通用状态卡片组件
 * 显示角色的持久 Buff 状态
 */
export function StatusCard({
  buffs,
  title = '状态',
  compact = false,
  emptyMessage = '无异常状态',
}: StatusCardProps) {
  const displayInfos = buffs.map((b) => {
    const config = buffRegistry.get(b.configId);
    return {
      key: b.configId,
      name: config?.name || b.configId,
      description: config?.description || '未知状态',
      stacks: b.currentStacks,
    };
  });

  if (displayInfos.length === 0) {
    return compact ? null : (
      <InkCard className="p-4">
        <p className="text-ink-secondary text-sm text-center">{emptyMessage}</p>
      </InkCard>
    );
  }

  return (
    <InkCard className={compact ? 'p-3' : 'p-4'}>
      {!compact && <h3 className="font-bold mb-3">{title}</h3>}
      <div className="space-y-2">
        {displayInfos.map((info) => (
          <div key={info.key} className="flex items-start gap-2 text-sm">
            <span className="text-base">💫</span>
            <div className="flex-1">
              <div className="font-bold text-blue-600">
                {info.name}
                {info.stacks > 1 && ` (${info.stacks}层)`}
              </div>
              <div className="text-ink-secondary text-xs">
                {info.description}
              </div>
            </div>
          </div>
        ))}
      </div>
    </InkCard>
  );
}
