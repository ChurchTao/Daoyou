'use client';

import { InkCard } from '@/components/InkComponents';
import type { PersistentStatusSnapshot } from '@/lib/dungeon/types';
import { getStatusesDisplay } from '@/lib/utils/statusDisplay';

interface StatusCardProps {
  statuses: PersistentStatusSnapshot[];
  title?: string;
  compact?: boolean;
  emptyMessage?: string;
}

/**
 * 通用状态卡片组件
 * 可在副本和主页中复用，显示角色的持久状态或环境状态
 */
export function StatusCard({
  statuses,
  title = '状态',
  compact = false,
  emptyMessage = '无异常状态',
}: StatusCardProps) {
  const displayInfos = getStatusesDisplay(statuses);

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
            <span className="text-base">{info.icon}</span>
            <div className="flex-1">
              <div className={`font-bold ${info.color}`}>{info.name}</div>
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
