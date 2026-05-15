import { cva, type VariantProps } from 'class-variance-authority';

export const inkFieldVariants = cva(
  'text-ink placeholder:text-ink-secondary/60 w-full bg-transparent font-sans leading-[1.6] focus:outline-none',
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
        sm: 'px-2 py-2 text-sm',
        md: 'px-3 py-3 text-base',
        lg: 'px-4 py-4 text-lg',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  },
);

export type InkFieldVariantProps = VariantProps<typeof inkFieldVariants>;
