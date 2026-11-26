import { HuntBattleActions } from '@app/components/feature/hunts/HuntBattleActions';
import { huntTargetLabel } from '@app/components/feature/hunts/huntTeamView';
import { useHuntActions } from '@app/components/feature/hunts/useHuntActions';
import { useHuntBattleNavigation } from '@app/components/feature/hunts/useHuntBattleNavigation';
import { useHunts } from '@app/components/feature/hunts/useHunts';
import { useParty } from '@app/components/feature/party/useParty';
import {
  GameSceneFrame,
  GameSceneLoading,
  GameSceneNote,
} from '@app/components/game-shell';
import { InkButton } from '@app/components/ui/InkButton';
import { InkSelect } from '@app/components/ui/InkSelect';
import { REALM_VALUES, type RealmType } from '@daoyou/constants/realms';
import type { HuntMine } from '@daoyou/contracts/hunts';
import { HUNT_BOSSES } from '@daoyou/game-content/hunts';
import type { HuntEvent, HuntTeam } from '@daoyou/game-domain/hunts';
import { useState } from 'react';

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

function HuntRecruitmentForm({
  team,
  pending,
  onSave,
}: {
  team: HuntTeam;
  pending: boolean;
  onSave: (minRealm: RealmType, maxRealm: RealmType) => void;
}) {
  const [minRealm, setMinRealm] = useState<RealmType>(team.minRealm);
  const [maxRealm, setMaxRealm] = useState<RealmType>(team.maxRealm);
  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        onSave(minRealm, maxRealm);
      }}
    >
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
          REALM_VALUES.indexOf(minRealm) > REALM_VALUES.indexOf(maxRealm) ||
          (minRealm === team.minRealm && maxRealm === team.maxRealm)
        }
      >
        保存境界范围
      </InkButton>
    </form>
  );
}

export default function HuntTeamPage() {
  const { data, error, actorId, refresh } = useHunts<HuntMine>(
    '/api/hunts/me',
    5000,
  );
  const { value, openParty } = useParty();
  const { act, pending, actionError } = useHuntActions(actorId, refresh);
  const team = data?.team;
  const leader = team?.leaderId === actorId;
  const openBoard = () => openParty({ kind: 'hunt' });
  useHuntBattleNavigation(team, actorId, refresh);

  if (!data && !error) return <GameSceneLoading message="正在确认队伍……" />;

  return (
    <GameSceneFrame variant="workflow">
      {(actionError || error) && (
        <GameSceneNote tone="danger">{actionError || error}</GameSceneNote>
      )}
      {!team ? (
        <div className="space-y-3">
          <p className="text-ink-secondary">
            {value?.roleMismatch
              ? '请切回在队角色参加讨伐。'
              : '创建队伍或加入正在招募的队伍，再随队讨伐。'}
          </p>
          <InkButton variant="primary" onClick={openBoard}>
            {value?.roleMismatch ? '查看队伍' : '组队讨伐'}
          </InkButton>
          <InkButton variant="secondary" href="/game/map-v2">
            寻找讨伐目标
          </InkButton>
        </div>
      ) : (
        <div className="space-y-4 text-sm">
          {leader && team.status === 'assembling' ? (
            <>
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
              <details>
                <summary className="text-ink-secondary mb-2 cursor-pointer">
                  调整出战境界 · {team.minRealm}至{team.maxRealm}
                </summary>
                <HuntRecruitmentForm
                  key={`${team.id}:${team.minRealm}:${team.maxRealm}`}
                  team={team}
                  pending={pending}
                  onSave={(minRealm, maxRealm) =>
                    void act('/api/hunts/teams', {
                      minRealm,
                      maxRealm,
                      eventId: team.event?.id,
                    })
                  }
                />
              </details>
            </>
          ) : (
            <p>
              {team.event
                ? `${huntTargetLabel(team.event)} · ${team.event.locationName}`
                : '等待队长选定讨伐目标。'}
            </p>
          )}
          {team.event ? (
            <HuntBattleActions
              team={team}
              actorId={actorId}
              now={data.serverNow}
              busy={pending}
              onParty={openBoard}
              onReady={(ready) =>
                void act(`/api/hunts/teams/${team.id}`, {
                  type: 'ready',
                  ready,
                  revision: team.revision,
                })
              }
              onStart={() =>
                void act(`/api/hunts/teams/${team.id}`, {
                  type: 'start',
                  revision: team.revision,
                })
              }
            />
          ) : (
            <>
              {leader && (
                <p className="text-ink-secondary">
                  选定目标后，全员确认准备即可出战。
                </p>
              )}
              <InkButton variant="secondary" onClick={openBoard}>
                查看队伍
              </InkButton>
            </>
          )}
        </div>
      )}
    </GameSceneFrame>
  );
}
