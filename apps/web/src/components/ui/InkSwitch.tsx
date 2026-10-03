import { cn } from '@app/lib/cn';

export interface InkSwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  'aria-label': string;
  disabled?: boolean;
  className?: string;
}

/** 低噪音、受控的二态切换器。 */
export function InkSwitch({
  checked,
  onCheckedChange,
  disabled = false,
  className,
  'aria-label': ariaLabel,
}: InkSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'border-ink/25 relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border transition-colors',
        checked ? 'bg-crimson/15 border-crimson/45' : 'bg-ink/5',
        'focus-visible:ring-crimson/35 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
        'disabled:cursor-not-allowed disabled:opacity-45',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'bg-bgpaper border-ink/30 block size-3.5 rounded-full border shadow-sm transition-transform',
          checked ? 'translate-x-4' : 'translate-x-0.5',
        )}
      />
    </button>
  );
}
