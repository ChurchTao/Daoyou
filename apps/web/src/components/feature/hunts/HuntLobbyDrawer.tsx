import { useParty } from '@app/components/feature/party/useParty';
import { GameIcon } from '@app/components/ui/GameIcon';
import { InkButton } from '@app/components/ui/InkButton';
import { InkDetailDrawer } from '@app/components/ui/InkDetailDrawer';
import { InkNotice } from '@app/components/ui/InkNotice';
import type { HuntLobby } from '@daoyou/contracts/hunts';
import { HUNT_BOSSES } from '@daoyou/game-content/hunts';
import { HuntBattleActions } from './HuntBattleActions';
import { HuntRewardPreview } from './HuntRewardPreview';
import { huntTargetLabel } from './huntTeamView';
import { useHuntActions } from './useHuntActions';
import { useHuntBattleNavigation } from './useHuntBattleNavigation';
import { useHunts } from './useHunts';

export function HuntLobbyDrawer({
  eventId,
  onClose,
}: {
  eventId: string;
  onClose: () => void;
}) {
  const { data, error, actorId, refresh } = useHunts<HuntLobby>(
    `/api/hunts/${eventId}`,
  );
  const { openParty, value } = useParty();
  const { act, pending, actionError } = useHuntActions(actorId, refresh);
  const team = data?.myTeam;
  const boss = data && HUNT_BOSSES[data.event.bossId];
  const openBoard = () => openParty({ kind: 'hunt' });
  const teamUrl = team && `/api/hunts/teams/${team.id}`;
  useHuntBattleNavigation(team, actorId, refresh);

  return (
    <InkDetailDrawer
      isOpen
      title={data ? huntTargetLabel(data.event) : '结伴讨伐'}
      onClose={onClose}
      size="md"
    >
      {error && (
        <InkNotice tone="warning">
          {error}{' '}
          <InkButton variant="secondary" onClick={refresh}>
            重试
          </InkButton>
        </InkNotice>
      )}
      {data && boss ? (
        <div className="space-y-5 text-sm">
          <div className="flex items-center gap-4">
            <GameIcon value={boss.icon} className="text-7xl" />
            <div>
              <p className="font-semibold">{data.event.locationName}</p>
              <p className="text-ink-secondary mt-1">
                {data.open
                  ? `行踪将于 ${new Date(data.event.expiresAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Shanghai' })} 隐去`
                  : '此处异动已平息'}
              </p>
            </div>
          </div>

          {data.claimed && (
            <p className="text-ink-secondary">本场报酬已领，仍可助战。</p>
          )}
          {team?.status === 'in_battle' && team.battleId ? (
            <InkButton
              variant="primary"
              className="min-h-11"
              href={`/game/combat-v6/hunt/${team.battleId}`}
            >
              返回战斗
            </InkButton>
          ) : data.open ? (
            <>
              {actionError && (
                <InkNotice tone="warning">{actionError}</InkNotice>
              )}
              {team && teamUrl ? (
                <HuntBattleActions
                  team={team}
                  event={data.event}
                  actorId={actorId}
                  now={data.serverNow}
                  busy={pending}
                  onParty={openBoard}
                  onStart={() =>
                    void act(teamUrl, {
                      type: 'start',
                      eventId,
                      revision: team.revision,
                    })
                  }
                />
              ) : (
                <section
                  className="border-ink-border space-y-2 border-y py-3"
                  aria-label="讨伐"
                >
                  <p className="text-ink-secondary">
                    {value?.roleMismatch
                      ? '请切回在队角色参加讨伐。'
                      : '讨伐需要 2～4 人结队，由队长开战。'}
                  </p>
                  <InkButton
                    variant="primary"
                    className="min-h-11"
                    onClick={openBoard}
                  >
                    {value?.roleMismatch ? '查看队伍' : '组队讨伐'}
                  </InkButton>
                </section>
              )}
            </>
          ) : null}

          <HuntRewardPreview realm={data.event.realm} />
          <details className="text-ink-secondary">
            <summary className="cursor-pointer">出战须知</summary>
            <div className="mt-2 space-y-2 leading-7">
              <p>{boss.hint}</p>
              <p>
                每处行踪存续期间，每人只领一次报酬。落败可再战，领过报酬也能助战。
              </p>
              <p>
                出战会消耗自身气血、法力。战斗结束时仍倒地的道友可养伤后再战，灵兽寿元不受影响。
              </p>
              <p>行踪隐去后，已经交手的队伍仍可战至终局。</p>
            </div>
          </details>
        </div>
      ) : (
        !error && <p className="text-sm">正在探听讨伐消息……</p>
      )}
    </InkDetailDrawer>
  );
}
