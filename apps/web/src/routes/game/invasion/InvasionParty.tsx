import { useParty } from '@app/components/feature/party/useParty';
import { InkButton } from '@app/components/ui';
import type {
  InvasionCommand,
  InvasionStatus,
} from '@daoyou/contracts/invasion';
import { invasionBossWave } from '@daoyou/game-rules/invasion';
import { invasionClock } from './request';

type Team = NonNullable<InvasionStatus['team']>;

export function InvasionParty({
  team,
  busy,
  open,
  remaining,
  send,
}: {
  team: Team;
  busy: boolean;
  open: boolean;
  remaining: number;
  send: (input: InvasionCommand) => Promise<boolean>;
}) {
  const { openParty } = useParty();
  const total = team.members.length;
  const reason =
    total < 2
      ? '至少两人才能出战，可在队伍面板招募道友。'
      : team.startBlockedReason ?? (team.leader ? null : '由队长开启本波。');

  return (
    <section className="invasion-assembly" aria-label="镇魔营地">
      <header className="invasion-assembly-heading">
        <div>
          <p className="invasion-eyebrow">坠魔谷外围</p>
          <h2>镇魔营地</h2>
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
      {reason && <p className="invasion-note">{reason}</p>}
      <div className="invasion-action-row">
        {!reason && (
          <InkButton
            variant="primary"
            pending={busy}
            pendingLabel="正在开阵……"
            disabled={!open}
            onClick={() => void send({ type: 'start' })}
          >
            开启第 {team.wave} 波
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
