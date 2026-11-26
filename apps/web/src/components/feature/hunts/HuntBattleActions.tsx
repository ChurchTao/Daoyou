import { InkButton } from '@app/components/ui/InkButton';
import type { HuntTeam } from '@daoyou/game-domain/hunts';
import { huntStartError } from '@daoyou/game-rules/hunts';

export function HuntBattleActions({
  team,
  actorId,
  now,
  busy,
  onReady,
  onStart,
  onParty,
}: {
  team: HuntTeam;
  actorId: string;
  now: number;
  busy: boolean;
  onReady: (ready: boolean) => void;
  onStart: () => void;
  onParty: () => void;
}) {
  const { status, members } = team;
  const leader = team.leaderId === actorId;
  const short = members.length < 2;
  const ready = members.filter((member) => member.ready);
  const readySelf = ready.some((member) => member.cultivatorId === actorId);
  const starting = status === 'starting';
  const blocked = leader
    ? huntStartError({ ...team, status: 'assembling' }, actorId, now)
    : null;
  const canStart = leader && !blocked;
  const reason = starting
    ? '正在开战，队长可继续发起。'
    : short
      ? '还需一位道友同行，可在队伍面板发布招募。'
      : !readySelf
        ? '请确认准备，由队长发起讨伐。'
        : !leader
          ? '已准备，等待队长发起讨伐。'
          : blocked;

  if (status === 'in_battle' && team.battleId)
    return (
      <InkButton
        variant="primary"
        className="min-h-11"
        href={`/game/combat-v6/hunt/${team.battleId}`}
      >
        返回战斗
      </InkButton>
    );

  return (
    <section
      aria-label="讨伐备战"
      className="border-ink-border space-y-2 border-y py-3"
    >
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-semibold">出战准备</h3>
        <p className="text-ink-secondary text-sm">
          <b className="font-mono">
            {ready.length}/{members.length}
          </b>{' '}
          已准备
        </p>
      </div>
      {reason && <p className="text-ink-secondary text-sm">{reason}</p>}
      <div className="flex flex-wrap gap-x-2">
        {canStart && (
          <InkButton
            variant="primary"
            className="min-h-11"
            disabled={busy}
            onClick={onStart}
          >
            {starting ? '继续出战' : '开始讨伐'}
          </InkButton>
        )}
        {!starting && !short && (
          <InkButton
            variant={readySelf ? 'secondary' : 'primary'}
            className="min-h-11"
            disabled={busy}
            onClick={() => onReady(!readySelf)}
          >
            {readySelf ? '取消准备' : '准备出战'}
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
