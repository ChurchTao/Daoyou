import { useInkUI } from '@app/components/providers/InkUIProvider';
import { GameIcon } from '@app/components/ui/GameIcon';
import { InkButton } from '@app/components/ui/InkButton';
import { cn } from '@app/lib/cn';
import type { HuntMember, HuntTeam } from '@daoyou/game-domain/hunts';

export function HuntMemberList({
  team,
  actorId,
  pending,
  onKick,
}: {
  team: HuntTeam;
  actorId: string;
  pending: boolean;
  onKick: (cultivatorId: string) => Promise<unknown>;
}) {
  const { openDialog } = useInkUI();
  const askKick = (member: HuntMember) => {
    openDialog({
      title: '请离道友',
      content: (
        <p>请离{member.name}后，对方会离开队伍，其余道友需要重新准备。</p>
      ),
      confirmLabel: '请离',
      cancelLabel: '留下',
      onConfirm: async () => {
        await onKick(member.cultivatorId);
      },
    });
  };

  return (
    <ul aria-label="队伍成员" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {team.members.map((member) => {
        const canKick =
          team.leaderId === actorId &&
          member.cultivatorId !== actorId &&
          team.status === 'assembling';
        const leader = member.cultivatorId === team.leaderId;
        return (
          <li
            key={member.cultivatorId}
            aria-label={`${member.name}，${leader ? '队长，' : ''}${member.realm}，${member.ready ? '已准备' : '未准备'}`}
            className="bg-ink/4 flex min-w-0 items-center gap-2 px-2.5 py-2"
          >
            <span
              aria-hidden="true"
              className={cn(
                'flex size-11 shrink-0 items-center justify-center rounded-full',
                member.ready
                  ? 'border-teal border-2'
                  : 'border-ink/30 border border-dashed',
              )}
            >
              <GameIcon
                value="icon:cultivator-male-avatar"
                className={cn('text-3xl', !member.ready && 'opacity-40')}
              />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate">{member.name}</span>
              <span className="text-ink-secondary block truncate text-xs">
                {leader ? '队长 · ' : ''}
                {member.realm}
                {member.assisting ? ' · 助战' : ''}
              </span>
            </span>
            <span
              className={cn(
                'shrink-0 text-xs font-semibold',
                member.ready ? 'text-teal' : 'text-ink-muted',
              )}
            >
              {member.ready ? '已准备' : '未准备'}
            </span>
            {canKick ? (
              <InkButton
                variant="secondary"
                disabled={pending}
                onClick={() => askKick(member)}
              >
                请离
              </InkButton>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
