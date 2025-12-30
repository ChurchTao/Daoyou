'use client';

import { InkButton } from '@/components/ui';
import { quickActionsConfig } from '../hooks/useHomeViewModel';

interface QuickActionsGridProps {
  isAnonymous: boolean;
  unreadMailCount: number;
  onLogout: () => void;
}

/**
 * 快捷入口网格
 */
export function QuickActionsGrid({
  isAnonymous,
  unreadMailCount,
  onLogout,
}: QuickActionsGridProps) {
  return (
    <div className="flex flex-wrap gap-3">
      {/* 传音玉简（邮件）- 特殊处理未读提示 */}
      <InkButton href="/mail" className="text-sm relative">
        🔔 传音玉简
        {unreadMailCount > 0 && (
          <span className="absolute -top-0.5 -right-1 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-crimson opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-crimson" />
          </span>
        )}
      </InkButton>

      {/* 常规快捷入口 */}
      {quickActionsConfig
        .filter((action) => !action.anonymousOnly || isAnonymous)
        .map((action) => (
          <InkButton key={action.label} href={action.href} className="text-sm">
            {action.label}
          </InkButton>
        ))}

      {/* 登出 */}
      <InkButton className="text-sm" onClick={onLogout}>
        👻 神魂出窍
      </InkButton>
    </div>
  );
}
