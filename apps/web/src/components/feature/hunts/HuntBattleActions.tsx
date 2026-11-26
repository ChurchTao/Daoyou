import { InkButton } from '@app/components/ui/InkButton';
import type { HuntEvent, HuntTeam } from '@daoyou/game-domain/hunts';
import { huntStartError } from '@daoyou/game-rules/hunts';

export function HuntBattleActions({
  team,
  event,
  actorId,
  now,
  busy,
  onStart,
  onParty,
}: {
  team: HuntTeam;
  event: HuntEvent;
  actorId: string;
  now: number;
  busy: boolean;
  onStart: () => void;
  onParty: () => void;
}) {
  const starting = team.status === 'starting';
  const blocked =
    starting && team.event?.id !== event.id
      ? '队伍正在向另一目标出战。'
      : huntStartError(
          { ...team, event, status: starting ? 'assembling' : team.status },
          actorId,
          now,
        );
  const short = team.members.length < 2;

  return (
    <section
      aria-label="讨伐"
      className="border-ink-border space-y-2 border-y py-3"
    >
      {blocked && (
        <p className="text-ink-secondary text-sm">
          {short && team.leaderId === actorId && !starting
            ? '至少两人才能讨伐，可在队伍面板招募道友。'
            : blocked}
        </p>
      )}
      <div className="flex flex-wrap gap-x-2">
        {!blocked && (
          <InkButton
            variant="primary"
            className="min-h-11"
            pending={busy}
            pendingLabel="正在开战……"
            onClick={onStart}
          >
            {starting ? '继续出战' : '开始讨伐'}
          </InkButton>
        )}
        <InkButton
          variant={short ? 'primary' : 'secondary'}
          className="min-h-11"
          onClick={onParty}
        >
          查看队伍
        </InkButton>
      </div>
    </section>
  );
}
