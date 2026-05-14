import { InkButton } from '@app/components/ui/InkButton';
import type { BattleRecord } from '@shared/types/battle';
import Link from '@app/components/router/AppLink';
import type { ReactNode } from 'react';

interface BattlePageLayoutProps {
  title: string;
  subtitle?: string;
  backHref: string;
  backLabel?: string;
  onBack?: () => void;
  error?: string;
  loading?: boolean;
  battleResult?: BattleRecord;
  isStreaming?: boolean;
  children: ReactNode;
  // 操作按钮配置
  actions?: {
    primary?: {
      label: string;
      onClick?: () => void;
      href?: string;
      disabled?: boolean;
    };
    secondary?: Array<{
      label: string;
      onClick?: () => void;
      href?: string;
      disabled?: boolean;
    }>;
  };
}

/**
 * 战斗页面布局组件：统一的页面结构和操作按钮
 */
export function BattlePageLayout({
  title,
  subtitle,
  backHref,
  backLabel = '返回',
  onBack,
  error,
  loading,
  battleResult,
  isStreaming,
  children,
  actions,
}: BattlePageLayoutProps) {
  return (
    <div className="bg-paper min-h-screen">
      <div className="main-content mx-auto flex max-w-4xl flex-col px-4 pt-6 pb-64 md:px-6 md:pt-7 md:pb-68">
        <header className="mb-3">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="font-heading text-ink text-3xl leading-none md:text-4xl">
                {title}
              </h1>
              {subtitle && (
                <p className="text-battle-muted mt-1.5 max-w-2xl text-sm leading-7 md:text-base">
                  {subtitle}
                </p>
              )}
            </div>

            {onBack ? (
              <button
                type="button"
                onClick={onBack}
                className="text-battle-muted hover:text-ink shrink-0 text-sm transition"
              >
                [{backLabel}]
              </button>
            ) : (
              <Link
                href={backHref}
                className="text-battle-muted hover:text-ink shrink-0 text-sm transition"
              >
                [{backLabel}]
              </Link>
            )}
          </div>
        </header>

        {/* 错误提示 */}
        {error && (
          <div className="battle-note mb-6">
            <p className="text-crimson text-sm leading-7">{error}</p>
          </div>
        )}

        {/* 内容 */}
        <div className="flex-1">{children}</div>

        {/* 操作按钮 */}
        {battleResult && !isStreaming && actions && (
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
            {actions.secondary?.map((action, index) => (
              <InkButton
                key={index}
                onClick={action.onClick}
                href={action.href}
                disabled={action.disabled}
              >
                {action.label}
              </InkButton>
            ))}
            {actions.primary && (
              <InkButton
                onClick={actions.primary.onClick}
                href={actions.primary.href}
                variant="primary"
                disabled={actions.primary.disabled}
              >
                {actions.primary.label}
              </InkButton>
            )}
          </div>
        )}

        {/* 加载中提示 */}
        {loading && !battleResult && (
          <div className="py-16 text-center">
            <p className="loading-tip">正在加载战斗...</p>
          </div>
        )}
      </div>
    </div>
  );
}
