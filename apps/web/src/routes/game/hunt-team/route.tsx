import { HuntTeamChat } from '@app/components/feature/hunts/HuntTeamChat';
import {
  huntTargetLabel,
  huntTeamStatusLabel,
  notifyHuntTeamChanged,
} from '@app/components/feature/hunts/huntTeamView';
import { huntRequest, useHunts } from '@app/components/feature/hunts/useHunts';
import {
  GameSceneFrame,
  GameSceneLoading,
  GameSceneNote,
} from '@app/components/game-shell';
import { GameIcon } from '@app/components/ui/GameIcon';
import { InkButton } from '@app/components/ui/InkButton';
import { InkSelect } from '@app/components/ui/InkSelect';
import { REALM_VALUES, type RealmType } from '@daoyou/constants/realms';
import type { HuntMine } from '@daoyou/contracts/hunts';
import { HUNT_BOSSES } from '@daoyou/game-content/hunts';
import type { HuntEvent, HuntTeam } from '@daoyou/game-domain/hunts';
import { useState } from 'react';
import { useNavigate } from 'react-router';

function HuntTargetField({
  team,
  disabled,
  onPick,
}: {
  team: HuntTeam;
  disabled: boolean;
  onPick: (eventId: string | null) => void;
}) {
  const events = useHunts<{ events: HuntEvent[] }>('/api/hunts', 15000).data
    ?.events;
  return (
    <InkSelect
      label="讨伐目标"
      disabled={disabled}
      value={team.event?.id ?? ''}
      onChange={(value) => onPick(value || null)}
    >
      <option value="">暂不选定</option>
      {team.event && !events?.some((item) => item.id === team.event?.id) ? (
        <option value={team.event.id}>
          {huntTargetLabel(team.event)} · {team.event.locationName}
        </option>
      ) : null}
      {events?.map((event) => (
        <option key={event.id} value={event.id}>
          {event.realm}期 · {HUNT_BOSSES[event.bossId].name} ·{' '}
          {event.locationName}
        </option>
      ))}
    </InkSelect>
  );
}

export default function HuntTeamPage() {
  const { data, error, actorId, refresh } = useHunts<HuntMine>(
    '/api/hunts/me',
    5000,
  );
  const navigate = useNavigate();
  const [pending, setPending] = useState(false);
  const [actionError, setActionError] = useState('');
  const [note, setNote] = useState('');
  const [minRealm, setMinRealm] = useState<RealmType>('炼气');
  const [maxRealm, setMaxRealm] = useState<RealmType>('渡劫');
  const team = data?.team ?? null;
  const self = team?.members.find((member) => member.cultivatorId === actorId);
  const leader = team?.leaderId === actorId;
  const reload = () => {
    notifyHuntTeamChanged();
    refresh();
  };
  const act = async (url: string, body: unknown, enter = false) => {
    if (pending || !actorId) return false;
    setPending(true);
    setActionError('');
    setNote('');
    try {
      const next = await huntRequest<HuntTeam | null>(url, actorId, body);
      reload();
      if (enter && next?.battleId)
        navigate(`/game/combat-v6/hunt/${next.battleId}`);
      return true;
    } catch (cause) {
      setActionError(
        cause instanceof Error ? cause.message : '暂时未能办妥，请稍后再试',
      );
      reload();
      return false;
    } finally {
      setPending(false);
    }
  };
  const command = (type: 'ready' | 'leave' | 'start') =>
    team &&
    void act(
      `/api/hunts/teams/${team.id}`,
      {
        type,
        revision: team.revision,
        ...(type === 'ready' ? { ready: !self?.ready } : {}),
      },
      type === 'start',
    );

  if (!data && !error) return <GameSceneLoading message="正在确认队伍……" />;

  return (
    <GameSceneFrame variant="workflow">
      {actionError || (error && !team) ? (
        <GameSceneNote tone="danger">{actionError || error}</GameSceneNote>
      ) : null}
      {note ? <p className="text-ink-secondary text-sm">{note}</p> : null}
      {!team ? (
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void act('/api/hunts/teams', { minRealm, maxRealm });
          }}
        >
          <p>招募何等境界的道友？</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <InkSelect
              label="最低境界"
              value={minRealm}
              onChange={(value) => setMinRealm(value as RealmType)}
            >
              {REALM_VALUES.map((realm) => (
                <option key={realm}>{realm}</option>
              ))}
            </InkSelect>
            <InkSelect
              label="最高境界"
              value={maxRealm}
              onChange={(value) => setMaxRealm(value as RealmType)}
            >
              {REALM_VALUES.map((realm) => (
                <option key={realm}>{realm}</option>
              ))}
            </InkSelect>
          </div>
          <InkButton
            type="submit"
            pending={pending}
            disabled={
              REALM_VALUES.indexOf(minRealm) > REALM_VALUES.indexOf(maxRealm)
            }
          >
            确认组建
          </InkButton>
        </form>
      ) : (
        <div className="space-y-5 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span>
              {huntTeamStatusLabel(team.status)}{' '}
              <span className="font-mono">{team.members.length}/4</span>
            </span>
            <span className="text-ink-secondary">
              {team.minRealm}至{team.maxRealm}
            </span>
          </div>
          <ul className="divide-ink/10 divide-y">
            {team.members.map((member) => (
              <li
                key={member.cultivatorId}
                className="flex items-center gap-2 py-3"
              >
                <GameIcon
                  value="icon:cultivator-male-avatar"
                  className="text-3xl"
                />
                <span className="min-w-0 flex-1">
                  {member.name}
                  {member.cultivatorId === team.leaderId ? ' · 队长' : ''}
                  <span className="text-ink-secondary block text-xs">
                    {member.realm}
                    {member.assisting ? ' · 助战' : ''}
                  </span>
                </span>
                <span>{member.ready ? '已准备' : '未准备'}</span>
              </li>
            ))}
          </ul>
          {leader && team.status === 'assembling' ? (
            <HuntTargetField
              team={team}
              disabled={pending}
              onPick={(eventId) =>
                void act(`/api/hunts/teams/${team.id}`, {
                  type: 'target',
                  eventId,
                  revision: team.revision,
                })
              }
            />
          ) : (
            <p>
              目标：
              {team.event
                ? `${huntTargetLabel(team.event)} · ${team.event.locationName}`
                : '尚未选定'}
            </p>
          )}
          {team.status === 'in_battle' && team.battleId ? (
            <InkButton
              onClick={() => navigate(`/game/combat-v6/hunt/${team.battleId}`)}
            >
              进入战斗
            </InkButton>
          ) : (
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              <InkButton
                disabled={pending || team.status !== 'assembling'}
                onClick={() => command('ready')}
              >
                {self?.ready ? '取消准备' : '准备'}
              </InkButton>
              {leader ? (
                <>
                  <InkButton
                    disabled={
                      pending ||
                      !team.event ||
                      team.members.length < 2 ||
                      team.members.some((member) => !member.ready)
                    }
                    onClick={() => command('start')}
                  >
                    {team.status === 'starting' ? '继续出战' : '开始讨伐'}
                  </InkButton>
                  <InkButton
                    disabled={
                      pending ||
                      team.status !== 'assembling' ||
                      team.members.length >= 4
                    }
                    onClick={() =>
                      void act(`/api/hunts/teams/${team.id}`, {
                        type: 'recruit',
                      }).then((ok) => {
                        if (ok) setNote('已发到世界频道');
                      })
                    }
                  >
                    召集道友
                  </InkButton>
                </>
              ) : null}
              <InkButton
                disabled={pending || team.status === 'starting'}
                onClick={() => command('leave')}
              >
                离开队伍
              </InkButton>
            </div>
          )}
          {team.members.length < 2 ? (
            <p className="text-ink-secondary leading-7">
              再邀一位道友，准备妥当便可出战。
            </p>
          ) : null}
          {actorId ? (
            <HuntTeamChat key={team.id} team={team} actorId={actorId} />
          ) : null}
        </div>
      )}
    </GameSceneFrame>
  );
}
