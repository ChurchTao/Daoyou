import { cn } from '@app/lib/cn';

export interface InkLoadingBarProps {
  tone?: 'ink' | 'inverse' | 'accent';
  size?: 'boot' | 'scene' | 'inline' | 'navigation';
  immediate?: boolean;
  className?: string;
}

export function InkLoadingBar({
  tone = 'ink',
  size = 'scene',
  immediate = false,
  className,
}: InkLoadingBarProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'ink-loading-bar',
        !immediate && 'ink-loading-delay',
        className,
      )}
      data-tone={tone}
      data-size={size}
    >
      <span className="ink-loading-bar__segment" />
    </div>
  );
}
