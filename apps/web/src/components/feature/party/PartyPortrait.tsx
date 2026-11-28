import type { PartyPublicMember } from '@daoyou/contracts/party';
import { CultivatorAvatar } from '../cultivator/CultivatorAvatar';

export function PartyPortrait({
  member,
  className,
}: {
  member: Pick<PartyPublicMember, 'gender' | 'name'>;
  className: string;
}) {
  return <CultivatorAvatar {...member} className={className} />;
}
