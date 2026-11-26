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
import { GameIcon } from '@app/components/ui/GameIcon';
import { InkButton } from '@app/components/ui/InkButton';
import { InkSelect } from '@app/components/ui/InkSelect';
import { REALM_VALUES, type RealmType } from '@daoyou/constants/realms';
import type { HuntMine } from '@daoyou/contracts/hunts';
import { HUNT_BOSSES } from '@daoyou/game-content/hunts';
import type { HuntEvent, HuntTeam } from '@daoyou/game-domain/hunts';
import { huntMapHref } from '@daoyou/game-rules/hunts';
import { useState } from 'react';

function HuntRealmRange({
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
  const { data, error, actorId, refresh } = useHunts<HuntMine>('/api/hunts/me');
  const feed = useHunts<{ events: HuntEvent[] }>('/api/hunts', 15000);
  const { openParty } = useParty();
  const { act, pending, actionError } = useHuntActions(actorId, refresh);
  const team = data?.team;
  useHuntBattleNavigation(team, actorId, refresh);

  return (
    <GameSceneFrame variant="workflow">
      {(actionError || error || feed.error) && (
        <GameSceneNote tone="danger">
          {actionError || error || feed.error}
        </GameSceneNote>
      )}
      {team?.battleId && team.status === 'in_battle' && (
        <InkButton
          variant="primary"
          className="min-h-11"
          href={`/game/combat-v6/hunt/${team.battleId}`}
        >
          返回战斗
        </InkButton>
      )}
      {!feed.data ? (
        !feed.error && <GameSceneLoading message="正在探听妖兽行踪……" />
      ) : !feed.data.events.length ? (
        <p className="text-ink-secondary text-sm">暂无可讨伐的目标。</p>
      ) : (
        <ul className="divide-ink-border divide-y" aria-label="当前讨伐目标">
          {feed.data.events.map((event) => (
            <li key={event.id} className="flex items-center gap-3 py-2">
              <GameIcon
                value={HUNT_BOSSES[event.bossId].icon}
                className="text-4xl"
              />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{huntTargetLabel(event)}</p>
                <p className="text-ink-secondary text-sm">
                  {event.locationName}
                </p>
              </div>
              <InkButton
                variant="primary"
                className="min-h-11"
                href={huntMapHref(event)}
              >
                前往查看
              </InkButton>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-start gap-x-3 text-sm">
        <InkButton
          variant="secondary"
          className="min-h-11"
          onClick={() => openParty({ kind: 'hunt' })}
        >
          查看队伍
        </InkButton>
        {team?.leaderId === actorId && team.status === 'assembling' && (
          <details className="min-w-0 flex-1">
            <summary className="text-ink-secondary flex min-h-11 cursor-pointer items-center">
              出战境界 · {team.minRealm}至{team.maxRealm}
            </summary>
            <HuntRealmRange
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
        )}
      </div>
    </GameSceneFrame>
  );
}
