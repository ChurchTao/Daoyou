'use client';

import {
  FateQuality,
  RealmType,
  SkillGrade,
  SpiritualRootGrade,
} from '@/types/constants';
import Link from 'next/link';
import { type ChangeEvent, type KeyboardEvent, type ReactNode } from 'react';

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
    <nav className="ink-nav max-w-xl mx-auto">
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

/**
 * 品阶/状态徽记
 */
type Tier = FateQuality | SpiritualRootGrade | SkillGrade | RealmType;
const tierSlugMap: Record<Tier, string> = {
  凡品: 'fan',
  灵品: 'ling',
  玄品: 'xuan',
  真品: 'zhen',
  地品: 'di',
  天品: 'tian',
  仙品: 'xian',
  神品: 'shen',
  天灵根: 'tian',
  真灵根: 'zhen',
  伪灵根: 'fan',
  变异灵根: 'shen',
  天阶上品: 'shen',
  天阶中品: 'xian',
  天阶下品: 'xian',
  地阶上品: 'di',
  地阶中品: 'di',
  地阶下品: 'di',
  玄阶上品: 'xuan',
  玄阶中品: 'xuan',
  玄阶下品: 'xuan',
  黄阶上品: 'ling',
  黄阶中品: 'ling',
  黄阶下品: 'ling',
  炼气: 'fan',
  筑基: 'ling',
  金丹: 'xuan',
  元婴: 'zhen',
  化神: 'shen',
  炼虚: 'di',
  合体: 'tian',
  大乘: 'xian',
  渡劫: 'shen',
};

/**
 * 品阶徽记
 * @param children 徽记内容
 * @param tier 品阶
 * @param tone 色调
 * @param compact 是否紧凑
 * @param className 额外类名
 * @returns 品阶徽记
 */
interface InkBadgeProps {
  children?: ReactNode;
  tier?: Tier;
  tierText?: string;
  tone?: 'default' | 'accent' | 'warning' | 'danger';
  compact?: boolean;
  className?: string;
  expandText?: string;
}

export function InkBadge({
  children,
  tier,
  tierText,
  tone = 'default',
  compact = false,
  className = '',
}: InkBadgeProps) {
  const tierClass = tier ? `ink-badge-tier-${tierSlugMap[tier]}` : '';
  const toneClass = `ink-badge-${tone}`;
  const densityClass = compact ? 'ink-badge-compact' : '';
  const combined =
    `ink-badge ${toneClass} ${tierClass} ${densityClass} ${className}`.trim();
  return (
    <span className={combined}>
      {tier ? `「${tierText || tier}」${children || ''}` : children || ''}
    </span>
  );
}

/**
 * 标签 - 元素/状态等
 */
interface InkTagProps {
  children: ReactNode;
  variant?: 'default' | 'outline' | 'ghost';
  tone?: 'neutral' | 'good' | 'bad' | 'info';
  className?: string;
}

export function InkTag({
  children,
  variant = 'default',
  tone = 'neutral',
  className = '',
}: InkTagProps) {
  const combined =
    `ink-tag ink-tag-${variant} ink-tag-${tone} ${className}`.trim();
  return <span className={combined}>{children}</span>;
}

/**
 * 属性行
 */
interface InkStatRowProps {
  label: ReactNode;
  code?: string;
  base: number | string;
  final?: number | string;
  detail?: ReactNode;
  emphasize?: boolean;
}

export function InkStatRow({
  label,
  code,
  base,
  final,
  detail,
  emphasize = false,
}: InkStatRowProps) {
  const changed = final !== undefined && final !== base;
  return (
    <div className={`ink-stat-row ${emphasize ? 'ink-stat-row-strong' : ''}`}>
      <div className="ink-stat-label">
        <span>{label}</span>
        {code && <span className="ink-stat-code">（{code}）</span>}
      </div>
      <div className="ink-stat-values">
        <span className={`ink-stat-base `}>{base}</span>
        {changed && <span className="ink-stat-final"> → {final}</span>}
      </div>
      {detail && <div className="ink-stat-detail">{detail}</div>}
    </div>
  );
}

/**
 * 列表容器 & 项
 */
interface InkListProps {
  children: ReactNode;
  dense?: boolean;
  className?: string;
}

export function InkList({
  children,
  dense = false,
  className = '',
}: InkListProps) {
  const combined =
    `ink-list ${dense ? 'ink-list-dense' : ''} ${className}`.trim();
  return <div className={combined}>{children}</div>;
}

interface InkListItemProps {
  title: ReactNode;
  meta?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  highlight?: boolean;
  newMark?: boolean;
}

export function InkListItem({
  title,
  meta,
  description,
  actions,
  highlight = false,
  newMark = false,
}: InkListItemProps) {
  return (
    <div
      className={`ink-list-item ${highlight ? 'ink-list-item-highlight' : ''}`}
    >
      <div className="ink-list-main">
        <div className="ink-list-title">
          <span>{title}</span>
          {newMark && <span className="new-mark">← 新悟</span>}
        </div>
        {meta && <div className="ink-list-meta">{meta}</div>}
        {description && <div className="ink-list-desc">{description}</div>}
      </div>
      {actions && <div className="ink-list-actions">{actions}</div>}
    </div>
  );
}

/**
 * 输入组件
 */
interface InkInputProps {
  label?: string;
  placeholder?: string;
  value: string;
  onChange: (
    value: string,
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => void;
  multiline?: boolean;
  rows?: number;
  hint?: string;
  error?: string;
  disabled?: boolean;
  onKeyDown?: (
    event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => void;
}

export function InkInput({
  label,
  placeholder,
  value,
  onChange,
  multiline = false,
  rows = 4,
  hint,
  error,
  disabled = false,
  onKeyDown,
}: InkInputProps) {
  const sharedProps = {
    placeholder,
    value,
    disabled,
    className: `ink-input-field ${multiline ? 'ink-input-multiline' : ''}`,
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onChange(event.target.value, event),
    onKeyDown,
  };

  return (
    <label className="ink-input">
      {label && <span className="ink-input-label">{label}</span>}
      {multiline ? (
        <textarea {...sharedProps} rows={rows} />
      ) : (
        <input {...sharedProps} type="text" />
      )}
      {hint && !error && <span className="ink-input-hint">{hint}</span>}
      {error && <span className="ink-input-error">{error}</span>}
    </label>
  );
}

/**
 * 空状态 / 提示
 */
interface InkNoticeProps {
  tone?: 'muted' | 'info' | 'warning' | 'danger';
  children: ReactNode;
}

export function InkNotice({ tone = 'muted', children }: InkNoticeProps) {
  return <div className={`ink-notice ink-notice-${tone}`}>{children}</div>;
}

/**
 * 状态条：HP / MP / 寿元等
 */
interface InkStatusDatum {
  label: string;
  value: number | string;
  icon?: string;
  hint?: string;
}

interface InkStatusBarProps {
  items: InkStatusDatum[];
  stacked?: boolean;
  className?: string;
}

export function InkStatusBar({
  items,
  stacked = false,
  className = '',
}: InkStatusBarProps) {
  const combined =
    `ink-status-bar ${stacked ? 'ink-status-bar-stacked' : ''} ${className}`.trim();
  return (
    <div className={combined}>
      {items.map((item) => (
        <div key={item.label} className="ink-status-item">
          {item.icon && <span className="ink-status-icon">{item.icon}</span>}
          <span className="ink-status-label">{item.label}</span>
          <span className="ink-status-value">{item.value}</span>
          {item.hint && <span className="ink-status-hint">· {item.hint}</span>}
        </div>
      ))}
    </div>
  );
}

/**
 * Toast
 */
export type InkToastTone = 'default' | 'success' | 'warning' | 'danger';

export interface InkToastData {
  id: string;
  message: string;
  tone?: InkToastTone;
  actionLabel?: string;
  onAction?: () => void;
}

interface InkToastProps extends InkToastData {
  onDismiss: (id: string) => void;
}

export function InkToast({
  id,
  message,
  tone = 'default',
  actionLabel,
  onAction,
  onDismiss,
}: InkToastProps) {
  return (
    <div className={`ink-toast ink-toast-${tone}`}>
      <span className="ink-toast-message">{message}</span>
      <div className="ink-toast-actions">
        {actionLabel && onAction && (
          <button type="button" onClick={onAction}>
            [{actionLabel}]
          </button>
        )}
        <button type="button" onClick={() => onDismiss(id)}>
          [撤去]
        </button>
      </div>
    </div>
  );
}

interface InkToastHostProps {
  toasts: InkToastData[];
  onDismiss: (id: string) => void;
}

export function InkToastHost({ toasts, onDismiss }: InkToastHostProps) {
  if (!toasts.length) {
    return null;
  }

  return (
    <div className="ink-toast-host">
      {toasts.map((toast) => (
        <InkToast key={toast.id} {...toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

/**
 * Dialog
 */
export interface InkDialogState {
  id: string;
  title?: string;
  content: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void | Promise<void>;
  onCancel?: () => void | Promise<void>;
}

interface InkDialogProps {
  dialog: InkDialogState | null;
  onClose: () => void;
}

export function InkDialog({ dialog, onClose }: InkDialogProps) {
  if (!dialog) {
    return null;
  }

  const {
    title,
    content,
    confirmLabel = '允',
    cancelLabel = '罢',
    onConfirm,
    onCancel,
  } = dialog;

  return (
    <div className="ink-dialog-overlay" role="dialog" aria-modal="true">
      <div className="ink-dialog">
        {title && <h3 className="ink-dialog-title">{title}</h3>}
        <div className="ink-dialog-content">{content}</div>
        <div className="ink-dialog-actions">
          <InkButton
            onClick={() => {
              onCancel?.();
              onClose();
            }}
          >
            {cancelLabel}
          </InkButton>
          <InkButton
            variant="primary"
            onClick={() => {
              onConfirm?.();
              onClose();
            }}
          >
            {confirmLabel}
          </InkButton>
        </div>
      </div>
    </div>
  );
}
