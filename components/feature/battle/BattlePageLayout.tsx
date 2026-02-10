import { InkButton } from '@/components/ui/InkButton';
import { BattleEngineResult } from '@/engine/battle';
import Link from 'next/link';
import type { ReactNode } from 'react';

interface BattlePageLayoutProps {
  title: string;
  backHref: string;
  backLabel?: string;
  error?: string;
  loading?: boolean;
  battleResult?: BattleEngineResult;
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
  backHref,
  backLabel = '返回',
  error,
  loading,
  battleResult,
  isStreaming,
  children,
  actions,
}: BattlePageLayoutProps) {
  return (
    <div className="bg-paper min-h-screen">
      <div className="main-content mx-auto flex max-w-xl flex-col px-4 pt-8 pb-16">
        {/* 返回按钮 */}
        <Link
          href={backHref}
          className="text-ink hover:text-crimson mb-4 transition"
        >
          [← {backLabel}]
        </Link>

        {/* 标题 */}
        <div className="mb-6 text-center">
          <h1 className="font-ma-shan-zheng text-ink text-2xl">{title}</h1>
        </div>

        {/* 错误提示 */}
        {error && <p className="text-crimson mb-6 text-center">{error}</p>}

        {/* 内容 */}
        {children}

        {/* 操作按钮 */}
        {battleResult && !isStreaming && actions && (
          <div className="flex flex-wrap justify-center gap-x-3 gap-y-2">
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
          <div className="text-center">
            <p className="loading-tip">正在推演天机……</p>
          </div>
        )}
      </div>
    </div>
  );
}
