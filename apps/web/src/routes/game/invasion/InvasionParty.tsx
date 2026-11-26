import { useParty } from '@app/components/feature/party/useParty';
import { InkButton } from '@app/components/ui';
import { GameIcon } from '@app/components/ui/GameIcon';
import type {
  InvasionCommand,
  InvasionIdentity,
  InvasionStatus,
} from '@daoyou/contracts/invasion';
import { invasionBossWave } from '@daoyou/game-rules/invasion';
import { invasionClock } from './request';

type Team = NonNullable<InvasionStatus['team']>;

export function InvasionPortrait({ member }: { member: InvasionIdentity }) {
  return (
    <GameIcon
      className="invasion-portrait"
      purpose="artwork"
      value={
        member.gender === '女'
          ? 'icon:cultivator-female-avatar'
          : 'icon:cultivator-male-avatar'
      }
    />
  );
}

export function InvasionParty({
  team,
  playerId,
  busy,
  open,
  remaining,
  send,
}: {
  team: Team;
  playerId?: string;
  busy: boolean;
  open: boolean;
  remaining: number;
  send: (input: InvasionCommand) => Promise<boolean>;
}) {
  const { openParty } = useParty();
  const total = team.members.length;
  const ready = team.ready.length;
  const readySelf = !!playerId && team.ready.includes(playerId);
  const canStart =
    open && team.leader && total >= 2 && ready === total && !team.busyMembers;
  const note = team.busyMembers
    ? '有道友尚在另一轮挑战中，或需要切回本期出战的角色。'
    : total < 2
      ? '至少两人才能出战，可在队伍面板发布招募。'
      : ready < total
        ? '全员准备后，由队长开战。'
        : undefined;

  return (
    <section className="invasion-assembly" aria-label="队伍集结">
      <header className="invasion-assembly-heading">
        <div>
          <p className="invasion-eyebrow">坠魔谷外围 · 镇魔营地</p>
          <h2>整队待战</h2>
        </div>
        {open && (
          <p className="invasion-clock">
            <small>距收阵</small>{' '}
            <b className="font-mono">{invasionClock(remaining, true)}</b>
          </p>
        )}
      </header>
      <div className="invasion-brief">
        <div>
          <strong>
            第 <b className="font-mono">{team.wave}</b> 波
          </strong>
          <span>
            {team.realm}难度{invasionBossWave(team.wave) ? ' · 首领波' : ''}
          </span>
        </div>
        <span className={team.firstClear ? 'text-teal' : 'text-ink-secondary'}>
          {team.firstClear ? '本波可推进个人进度' : '本波为助战'}
        </span>
      </div>
      <div className="invasion-section-heading">
        <h3>备战</h3>
        <span>
          <b className="font-mono">
            {ready}/{total}
          </b>{' '}
          已准备
        </span>
      </div>
      {note && <p className="invasion-note">{note}</p>}
      <div className="invasion-action-row">
        {canStart ? (
          <InkButton
            variant="primary"
            disabled={busy}
            onClick={() => void send({ type: 'start' })}
          >
            开启第 {team.wave} 波
          </InkButton>
        ) : total >= 2 ? (
          <InkButton
            variant={readySelf ? 'secondary' : 'primary'}
            disabled={busy || !open}
            onClick={() => void send({ type: 'ready', ready: !readySelf })}
          >
            {readySelf ? '取消准备' : '准备出战'}
          </InkButton>
        ) : null}
        {canStart && (
          <InkButton
            variant="secondary"
            disabled={busy}
            onClick={() => void send({ type: 'ready', ready: false })}
          >
            取消准备
          </InkButton>
        )}
        <InkButton
          variant={total < 2 ? 'primary' : 'secondary'}
          onClick={() => openParty({ kind: 'invasion' })}
        >
          查看队伍
        </InkButton>
      </div>
    </section>
  );
}
