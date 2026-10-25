import { cva, type VariantProps } from 'class-variance-authority';

export const INK_CONTROL_HEIGHTS = {
  sm: 'h-9',
  md: 'h-12',
  lg: 'h-14',
} as const;

export const inkFieldVariants = cva(
  'text-ink placeholder:text-ink-secondary/60 w-full bg-transparent font-sans leading-[1.6] focus:outline-none disabled:cursor-not-allowed',
  {
    variants: {
      variant: {
        default:
          'bg-bgpaper/70 border border-dashed border-ink/20 focus:border-crimson',
        outlined: 'bg-bgpaper border border-ink/30 focus:border-crimson',
        underlined:
          'border-b border-dashed border-ink/20 border-t-0 border-l-0 border-r-0 px-0 focus:border-b-crimson',
      },
      size: {
        // iOS 会在聚焦字号小于 16px 的输入框时放大整页，小号字段也保持 text-base。
        sm: `${INK_CONTROL_HEIGHTS.sm} px-2 text-base`,
        md: `${INK_CONTROL_HEIGHTS.md} px-3 text-base`,
        lg: `${INK_CONTROL_HEIGHTS.lg} px-4 text-lg`,
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  },
);

export type InkFieldVariantProps = VariantProps<typeof inkFieldVariants>;
