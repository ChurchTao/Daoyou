import { GameIcon } from '@app/components/ui/GameIcon';
import { cn } from '@app/lib/cn';
import type { HuntMember } from '@daoyou/game-domain/hunts';

export function HuntMemberPortrait({
  member,
  className,
}: {
  member?: Pick<HuntMember, 'name' | 'gender'>;
  className?: string;
}) {
  if (member?.gender === '男' || member?.gender === '女') {
    return (
      <GameIcon
        value={
          member.gender === '女'
            ? 'icon:cultivator-female-avatar'
            : 'icon:cultivator-male-avatar'
        }
        className={className}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={cn(
        'text-ink-secondary inline-flex size-[1em] shrink-0 items-center justify-center',
        className,
      )}
    >
      <span className="text-base">{member?.name.slice(0, 1) || '队'}</span>
    </span>
  );
}
