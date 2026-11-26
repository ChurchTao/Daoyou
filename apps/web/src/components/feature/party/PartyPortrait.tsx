import { GameIcon } from '@app/components/ui/GameIcon';
import type { PartyPublicMember } from '@daoyou/contracts/party';

export function PartyPortrait({
  member,
  className,
}: {
  member: PartyPublicMember;
  className: string;
}) {
  return (
    <GameIcon
      purpose="artwork"
      value={
        member.gender === '女'
          ? 'icon:cultivator-female-avatar'
          : 'icon:cultivator-male-avatar'
      }
      className={className}
    />
  );
}
