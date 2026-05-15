import { cn } from '@shared/lib/cn';
import { cva, type VariantProps } from 'class-variance-authority';
import Link from '@app/components/router/AppLink';
import type { ReactNode } from 'react';

/**
 * InkButton 变体定义
 */
const inkButtonVariants = cva(
  // 基础样式
  'inline-flex items-center px-1.5 py-1 font-sans text-[0.95rem] leading-[1.6] tracking-[0.08em] whitespace-nowrap cursor-pointer no-underline transition-colors duration-150',
  {
    variants: {
      variant: {
        default: 'text-ink hover:text-crimson',
        primary: 'ink-emphasis text-crimson font-semibold hover:text-crimson/80',
        secondary: 'text-ink-secondary hover:text-ink',
        outline:
          'border-b border-dashed border-ink/30 text-ink hover:border-crimson/50 hover:text-crimson',
        ghost: 'text-ink-secondary/80 hover:text-ink',
      },
      disabled: {
        true: 'text-ink-secondary opacity-50 cursor-not-allowed pointer-events-none',
      },
    },
    defaultVariants: {
      variant: 'default',
      disabled: false,
    },
  },
);

export interface InkButtonProps extends VariantProps<typeof inkButtonVariants> {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  className?: string;
  type?: 'button' | 'submit' | 'reset';
}

/**
 * 文字化按钮组件 - 使用方括号样式 [按钮文字]
 * 注：根据规范，按钮禁止使用 text-xs，最小建议使用 text-sm。
 */
export function InkButton({
  children,
  onClick,
  href,
  disabled = false,
  variant = 'default',
  className = '',
  type = 'button',
}: InkButtonProps) {
  const combinedClass = cn(
    inkButtonVariants({ variant, disabled: disabled ?? false }),
    className,
  );

  // 如果有 href 且未禁用，渲染为 Link
  if (href && !disabled) {
    return (
      <Link href={href} className={combinedClass}>
        [{children}]
      </Link>
    );
  }

  // 否则渲染为 button
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled ?? false}
      className={combinedClass}
    >
      [{children}]
    </button>
  );
}
