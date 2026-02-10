'use client';

import { InkButton } from '@/components/ui/InkButton';
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
      <InkButton href="/game/mail" className="relative text-sm">
        🔔 传音玉简
        {unreadMailCount > 0 && (
          <span className="absolute -top-0.5 -right-1 flex h-3 w-3">
            <span className="bg-crimson absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" />
            <span className="bg-crimson relative inline-flex h-3 w-3 rounded-full" />
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
