import { GameIcon } from '@app/components/ui/GameIcon';
import { InkButton } from '@app/components/ui/InkButton';
import { InkDetailDrawer } from '@app/components/ui/InkDetailDrawer';
import { InkNotice } from '@app/components/ui/InkNotice';
import type { HuntLobby } from '@daoyou/contracts/hunts';
import { HUNT_BOSSES } from '@daoyou/game-content/hunts';
import { useState } from 'react';
import { HuntRewardPreview } from './HuntRewardPreview';
import { notifyHuntTeamChanged } from './huntTeamView';
import { useHuntBattleNavigation } from './useHuntBattleNavigation';
import { huntRequest, useHunts } from './useHunts';

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
  const [pending, setPending] = useState(false);
  const [actionError, setActionError] = useState('');
  const team = data?.myTeam;
  const boss = data && HUNT_BOSSES[data.event.bossId];
  useHuntBattleNavigation(team, actorId, refresh);

  async function setTarget() {
    if (!team || pending) return;
    setPending(true);
    setActionError('');
    try {
      await huntRequest(`/api/hunts/teams/${team.id}`, actorId, {
        type: 'target',
        eventId,
        revision: team.revision,
      });
      notifyHuntTeamChanged();
    } catch (cause) {
      setActionError(
        cause instanceof Error ? cause.message : '暂时无法选定目标',
      );
    } finally {
      refresh();
      setPending(false);
    }
  }

  return (
    <InkDetailDrawer
      isOpen
      title={data && boss ? `${data.event.realm}期 · ${boss.name}` : '结伴讨伐'}
      onClose={onClose}
      size="md"
    >
      {(error || actionError) && (
        <InkNotice tone="warning">
          {actionError || error}{' '}
          <InkButton variant="secondary" onClick={refresh}>
            重试
          </InkButton>
        </InkNotice>
      )}
      {data && boss ? (
        <div className="space-y-5 text-sm">
          <div className="flex items-center gap-4">
            <GameIcon value={boss.icon} className="text-7xl" />
            <p>
              {data.event.locationName}
              <span className="text-ink-secondary mt-1 block">
                {data.open
                  ? `行踪将于 ${new Date(data.event.expiresAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Shanghai' })} 隐去`
                  : '此处异动已平息'}
              </span>
            </p>
          </div>
          <p>{boss.hint}</p>
          {data.claimed && (
            <p className="text-ink-secondary">你已领过本场报酬，仍可助战。</p>
          )}
          {team?.event?.id === eventId &&
          team.status === 'in_battle' &&
          team.battleId ? (
            <InkButton
              variant="primary"
              href={`/game/combat-v6/hunt/${team.battleId}`}
            >
              返回战斗
            </InkButton>
          ) : (
            data.open &&
            (!team ? (
              <p className="text-ink-secondary">
                在展开菜单的「组队」中集结，再来选定讨伐目标。
              </p>
            ) : team.event?.id === eventId ? (
              <InkButton variant="primary" href="/game/hunt-team">
                前往讨伐备战
              </InkButton>
            ) : team.status === 'assembling' && team.leaderId === actorId ? (
              <InkButton
                variant="primary"
                pending={pending}
                onClick={() => void setTarget()}
              >
                设为讨伐目标
              </InkButton>
            ) : (
              <p className="text-ink-secondary">
                {team.status === 'assembling'
                  ? '由队长选定讨伐目标。'
                  : '本场结束后可换目标。'}
              </p>
            ))
          )}
          <HuntRewardPreview realm={data.event.realm} />
          <details className="text-ink-secondary">
            <summary className="cursor-pointer">出战须知</summary>
            <div className="mt-2 space-y-2 leading-7">
              <p>2～4 人结伴即可出战。全员准备后，由队长发起讨伐。</p>
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
