'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * 文字化按钮组件 - 使用方括号样式
 */
interface InkButtonProps {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
  variant?: 'default' | 'primary' | 'secondary';
  className?: string;
}

export function InkButton({
  children,
  onClick,
  href,
  disabled = false,
  variant = 'default',
  className = '',
}: InkButtonProps) {
  const baseClass = 'ink-button';
  const variantClass = `ink-button-${variant}`;
  const disabledClass = disabled ? 'ink-button-disabled' : '';
  const combinedClass =
    `${baseClass} ${variantClass} ${disabledClass} ${className}`.trim();

  if (href && !disabled) {
    return (
      <Link href={href} className={combinedClass}>
        [{children}]
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={combinedClass}
    >
      [{children}]
    </button>
  );
}

/**
 * 文字化链接组件 - 使用方括号样式
 */
interface InkLinkProps {
  children: ReactNode;
  href: string;
  className?: string;
  active?: boolean;
}

export function InkLink({
  children,
  href,
  className = '',
  active = false,
}: InkLinkProps) {
  const baseClass = 'ink-link';
  const activeClass = active ? 'ink-link-active' : '';
  const combinedClass = `${baseClass} ${activeClass} ${className}`.trim();

  return (
    <Link href={href} className={combinedClass}>
      {active ? `【${children}】` : `[${children}]`}
    </Link>
  );
}

/**
 * 文字化导航栏组件
 */
interface InkNavProps {
  items: Array<{ label: string; href: string }>;
  currentPath?: string;
}

export function InkNav({ items, currentPath }: InkNavProps) {
  return (
    <nav className="ink-nav">
      {items.map((item) => {
        const isActive = currentPath === item.href;
        return (
          <InkLink key={item.href} href={item.href} active={isActive}>
            {item.label}
          </InkLink>
        );
      })}
    </nav>
  );
}

/**
 * 文字化分隔线组件
 */
interface InkDividerProps {
  variant?: 'line' | 'symbol';
  symbol?: string;
  className?: string;
}

export function InkDivider({
  variant = 'line',
  symbol = '☯',
  className = '',
}: InkDividerProps) {
  if (variant === 'symbol') {
    return (
      <div className={`ink-divider ink-divider-symbol ${className}`.trim()}>
        {symbol.repeat(10)}
      </div>
    );
  }

  return (
    <div className={`ink-divider ink-divider-line ${className}`.trim()}>
      <span className="ink-divider-content">
        ──────────────────────────────
      </span>
    </div>
  );
}

/**
 * 文字化卡片组件 - 最小化视觉元素
 */
interface InkCardProps {
  children: ReactNode;
  className?: string;
  highlighted?: boolean;
}

export function InkCard({
  children,
  className = '',
  highlighted = false,
}: InkCardProps) {
  const baseClass = 'ink-card';
  const highlightedClass = highlighted ? 'ink-card-highlighted' : '';
  const combinedClass = `${baseClass} ${highlightedClass} ${className}`.trim();

  return <div className={combinedClass}>{children}</div>;
}

/**
 * 文字化操作组 - 用于底部操作按钮
 */
interface InkActionGroupProps {
  children: ReactNode;
  align?: 'left' | 'center' | 'right' | 'between';
  className?: string;
}

export function InkActionGroup({
  children,
  align = 'between',
  className = '',
}: InkActionGroupProps) {
  const alignClass = `ink-action-group-${align}`;
  const combinedClass = `ink-action-group ${alignClass} ${className}`.trim();

  return <div className={combinedClass}>{children}</div>;
}
