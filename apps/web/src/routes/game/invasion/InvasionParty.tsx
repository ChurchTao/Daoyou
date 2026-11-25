import { openPartyChat } from '@app/components/feature/party/partyEvents';
import { InkButton, InkDialog } from '@app/components/ui';
import { GameIcon } from '@app/components/ui/GameIcon';
import type {
  InvasionCommand,
  InvasionIdentity,
  InvasionStatus,
} from '@daoyou/contracts/invasion';
import { invasionBossWave } from '@daoyou/game-rules/invasion';
import { useState } from 'react';
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
  const [target, setTarget] = useState<InvasionIdentity>();
  const total = team.members.length;
  const ready = team.ready.length;
  const readySelf = !!playerId && team.ready.includes(playerId);
  const canStart =
    open && team.leader && total >= 2 && ready === total && !team.busyMembers;
  const note = team.busyMembers
    ? '有道友尚在另一轮挑战中，或需要切回本期出战的角色。'
    : total < 2
      ? '至少两人才能出战。'
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
        <h3>出战队伍</h3>
        <span>
          <b className="font-mono">
            {ready}/{total}
          </b>{' '}
          已准备
        </span>
      </div>
      <ul className="invasion-roster">
        {team.members.map((member) => {
          const captain = member.cultivatorId === team.captainId;
          const prepared = team.ready.includes(member.cultivatorId);
          return (
            <li
              key={member.cultivatorId}
              className="invasion-member"
              data-ready={prepared}
            >
              <InvasionPortrait member={member} />
              <div className="invasion-member-identity">
                <div className="invasion-member-name">
                  <strong>{member.name}</strong>
                  {captain && <span className="invasion-captain">队长</span>}
                  {member.cultivatorId === playerId && <small>我</small>}
                </div>
                <p>
                  {member.realm}
                  {member.realmStage}
                  {member.title && <> · {member.title}</>}
                </p>
              </div>
              <div className="invasion-member-controls">
                <span className="invasion-readiness" data-ready={prepared}>
                  {prepared ? '已准备' : '待准备'}
                </span>
                {team.leader && !captain && (
                  <InkButton
                    variant="secondary"
                    disabled={busy || !open}
                    onClick={() => setTarget(member)}
                  >
                    请离<span className="sr-only">{member.name}</span>
                  </InkButton>
                )}
              </div>
            </li>
          );
        })}
      </ul>
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
        ) : (
          <InkButton
            variant={readySelf ? 'secondary' : 'primary'}
            disabled={busy || !open}
            onClick={() => void send({ type: 'ready', ready: !readySelf })}
          >
            {readySelf ? '取消准备' : '准备出战'}
          </InkButton>
        )}
        {canStart && (
          <InkButton
            variant="secondary"
            disabled={busy}
            onClick={() => void send({ type: 'ready', ready: false })}
          >
            取消准备
          </InkButton>
        )}
        {team.leader && (team.recruiting || total < 4) && (
          <InkButton
            variant="secondary"
            disabled={busy || !open}
            onClick={() =>
              void send({ type: 'recruit', advertised: !team.recruiting })
            }
          >
            {team.recruiting ? '停止招募' : '营地招募'}
          </InkButton>
        )}
        <InkButton
          variant="secondary"
          disabled={busy || !open}
          onClick={() => void send({ type: 'leave' })}
        >
          退出队伍
        </InkButton>
        <InkButton variant="secondary" onClick={openPartyChat}>
          队伍传音
        </InkButton>
      </div>
      <InkDialog
        dialog={
          target
            ? {
                id: `invasion-kick-${target.cultivatorId}`,
                title: '请离队伍',
                content: `请离「${target.name}」后，全队需重新确认准备。`,
                confirmLabel: '确认请离',
                cancelLabel: '取消',
                onConfirm: async () => {
                  await send({
                    type: 'kick',
                    cultivatorId: target.cultivatorId,
                  });
                },
              }
            : null
        }
        onClose={() => setTarget(undefined)}
      />
    </section>
  );
}
