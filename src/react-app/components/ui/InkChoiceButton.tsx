import { cn } from '@shared/lib/cn';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ReactNode } from 'react';

const inkChoiceButtonVariants = cva(
  'cursor-pointer border font-sans transition-colors disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      layout: {
        inline: 'px-3 py-1 text-sm',
        card: 'w-full p-4 text-left',
      },
      selected: {
        true: 'border-crimson bg-crimson/5',
        false: '',
      },
    },
    compoundVariants: [
      {
        layout: 'inline',
        selected: true,
        className: 'text-crimson',
      },
      {
        layout: 'inline',
        selected: false,
        className: 'border-ink/20 text-ink-secondary hover:border-ink/40 hover:text-ink',
      },
      {
        layout: 'card',
        selected: true,
        className: 'text-ink',
      },
      {
        layout: 'card',
        selected: false,
        className: 'border-ink/20 bg-bgpaper text-ink hover:border-crimson/60',
      },
    ],
    defaultVariants: {
      layout: 'inline',
      selected: false,
    },
  },
);

export interface InkChoiceButtonProps
  extends VariantProps<typeof inkChoiceButtonVariants> {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  className?: string;
}

export function InkChoiceButton({
  children,
  onClick,
  disabled = false,
  type = 'button',
  layout,
  selected,
  className,
}: InkChoiceButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        inkChoiceButtonVariants({ layout, selected }),
        className,
      )}
    >
      {children}
    </button>
  );
}
