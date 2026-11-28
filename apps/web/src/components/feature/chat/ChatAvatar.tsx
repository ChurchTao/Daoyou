import { cn } from '@app/lib/cn';
import type { CultivatorPortraitRef } from '@daoyou/contracts/player/avatar';
import { CultivatorAvatar } from '../cultivator/CultivatorAvatar';

export function ChatAvatar({
  name,
  portrait,
  className,
}: {
  name: string;
  portrait?: CultivatorPortraitRef;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'bg-ink/5 text-ink-secondary inline-flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full text-sm',
        className,
      )}
    >
      {portrait ? (
        <CultivatorAvatar {...portrait} name={name} size="96" lazy decorative />
      ) : (
        Array.from(name)[0]
      )}
    </span>
  );
}
