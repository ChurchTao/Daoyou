import { cn } from '@shared/lib/cn';
import { iconRegistry } from './icons/registry';

export interface GameIconProps {
  value: string;
  className?: string;
  /** Omit when adjacent text already names the icon. */
  label?: string;
}

/** Emoji or registered SVG/WebP/PNG via icon:name; size follows the font. */
export function GameIcon({ value, className, label }: GameIconProps) {
  const isRegisteredIcon = value.startsWith('icon:');
  const source = isRegisteredIcon
    ? iconRegistry.get(value.slice(5))
    : undefined;

  return (
    <span
      className={cn(
        'inline-flex h-[1em] w-[1em] shrink-0 items-center justify-center align-[-0.125em] font-sans leading-none',
        className,
      )}
      role={label ? 'img' : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
    >
      {source ? (
        <img
          src={source}
          alt=""
          draggable={false}
          className="block size-full object-contain"
        />
      ) : isRegisteredIcon || !value.trim() ? (
        '❔'
      ) : (
        value
      )}
    </span>
  );
}
