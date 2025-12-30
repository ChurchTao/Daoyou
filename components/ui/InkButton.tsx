'use client';

import { cn } from '@/lib/cn';
import { cva, type VariantProps } from 'class-variance-authority';
import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * InkButton 变体定义
 */
const inkButtonVariants = cva(
  // 基础样式
  'inline-block px-2 py-1 font-sans text-[0.95rem] leading-[1.5] whitespace-nowrap cursor-pointer no-underline transition-colors duration-200',
  {
    variants: {
      variant: {
        default: 'text-ink hover:text-crimson',
        primary: 'text-crimson font-semibold hover:opacity-80',
        secondary: 'text-ink-secondary hover:text-ink',
        outline: 'text-ink hover:text-crimson',
        ghost: 'text-ink/60 hover:text-ink',
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
