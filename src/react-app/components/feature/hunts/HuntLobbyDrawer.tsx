import { GameIcon } from '@app/components/ui/GameIcon';
import { InkButton } from '@app/components/ui/InkButton';
import { InkDetailDrawer } from '@app/components/ui/InkDetailDrawer';
import { useCultivatorIdentity } from '@app/lib/resources/player';
import type { HuntLobby, HuntTeam } from '@shared/contracts/hunts';
import { HUNT_BOSSES, huntMapHref } from '@shared/hunts/config';
import { huntRealmAllowed } from '@shared/hunts/rules';
import { REALM_VALUES, type RealmType } from '@shared/types/constants';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { HuntRewardPreview } from './HuntRewardPreview';
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
  const identity = useCultivatorIdentity().data?.cultivator;
  const [pending, setPending] = useState(false);
  const [actionError, setActionError] = useState('');
  const [creating, setCreating] = useState(false);
  const [minRealm, setMinRealm] = useState<RealmType>('炼气');
  const [maxRealm, setMaxRealm] = useState<RealmType>('渡劫');
  const navigate = useNavigate();
  const team = data?.myTeam;
  const self = team?.members.find((m) => m.cultivatorId === actorId);
  const boss = data && HUNT_BOSSES[data.event.bossId];
  const act = async (url: string, body: unknown, enter = false) => {
    if (pending) return;
    setPending(true);
    setActionError('');
    try {
      const next = await huntRequest<HuntTeam | null>(url, actorId, body);
      setCreating(false);
      refresh();
      if (enter && next?.battleId)
        navigate(`/game/combat-v6/hunt/${next.battleId}`);
    } catch (cause) {
      setActionError(
        cause instanceof Error ? cause.message : '暂时未能办妥，请稍后再试',
      );
      refresh();
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
  return (
    <InkDetailDrawer
      isOpen
      title={boss ? `${data!.event.realm}期 · ${boss.name}` : '结伴讨伐'}
      onClose={onClose}
      size="md"
    >
      {error || actionError ? (
        <p role="alert" className="text-crimson mb-3 text-sm">
          {actionError || error}
          <button
            onClick={() => {
              setActionError('');
              refresh();
            }}
            className="ml-2 underline"
          >
            刷新
          </button>
        </p>
      ) : null}
      {!data ? (
        <p className="text-sm">正在探听讨伐消息……</p>
      ) : (
        <div className="space-y-5 text-sm">
          <div className="flex items-center gap-4">
            <GameIcon value={boss!.icon} className="text-7xl" />
            <div>
              <p>{data.event.locationName}</p>
              <p className="text-ink-secondary mt-1">
                {data.open
                  ? `行踪将于 ${new Date(data.event.expiresAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })} 隐去`
                  : '此处异动已平息'}
              </p>
            </div>
          </div>
          <p className="leading-7">{boss!.hint}</p>
          {data.claimed ? (
            <p className="text-ink-secondary">
              你已领过此次讨伐的报酬，仍可助道友一战，助战不再获酬。
            </p>
          ) : null}
          {team && team.event.id !== eventId ? (
            <p>
              你已有一支讨伐队伍。
              <Link
                className="text-teal underline"
                to={huntMapHref(team.event)}
              >
                查看我的队伍
              </Link>
            </p>
          ) : team ? (
            <>
              <div className="flex items-center justify-between">
                <span>
                  我的队伍{' '}
                  <span className="font-mono">{team.members.length}/4</span>
                </span>
                <span className="text-ink-secondary">
                  {team.minRealm}至{team.maxRealm}
                </span>
              </div>
              <ul className="divide-ink/10 divide-y">
                {team.members.map((m) => (
                  <li
                    key={m.cultivatorId}
                    className="flex items-center gap-2 py-3"
                  >
                    <GameIcon
                      value="icon:cultivator-male-avatar"
                      className="text-3xl"
                    />
                    <span className="min-w-0 flex-1">
                      {m.name}
                      {m.cultivatorId === team.leaderId ? ' · 队长' : ''}
                      <span className="text-ink-secondary block text-xs">
                        {m.realm}
                        {m.assisting ? ' · 助战' : ''}
                      </span>
                    </span>
                    <span>{m.ready ? '已准备' : '未准备'}</span>
                  </li>
                ))}
              </ul>
              {team.status === 'in_battle' && team.battleId ? (
                <InkButton
                  onClick={() =>
                    navigate(`/game/combat-v6/hunt/${team.battleId}`)
                  }
                >
                  进入战斗
                </InkButton>
              ) : (
                <div className="flex flex-wrap gap-3">
                  <InkButton
                    disabled={
                      pending || !data.open || team.status === 'starting'
                    }
                    onClick={() => command('ready')}
                  >
                    {self?.ready ? '取消准备' : '准备'}
                  </InkButton>
                  {team.leaderId === actorId ? (
                    <InkButton
                      disabled={
                        pending ||
                        !data.open ||
                        team.members.length < 2 ||
                        team.members.some((m) => !m.ready)
                      }
                      onClick={() => command('start')}
                    >
                      {team.status === 'starting' ? '继续出战' : '开始讨伐'}
                    </InkButton>
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
                <p className="text-ink-secondary">
                  再邀一位道友，准备妥当便可出战。
                </p>
              ) : null}
            </>
          ) : data.open ? (
            <>
              {creating ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void act('/api/hunts/teams', {
                      eventId,
                      minRealm,
                      maxRealm,
                    });
                  }}
                  className="space-y-3"
                >
                  <p>招募何等境界的道友？</p>
                  <div className="flex gap-3">
                    <label className="flex-1">
                      最低境界
                      <select
                        className="border-ink/20 mt-1 block w-full border bg-transparent p-2"
                        value={minRealm}
                        onChange={(e) =>
                          setMinRealm(e.target.value as RealmType)
                        }
                      >
                        {REALM_VALUES.map((r) => (
                          <option key={r}>{r}</option>
                        ))}
                      </select>
                    </label>
                    <label className="flex-1">
                      最高境界
                      <select
                        className="border-ink/20 mt-1 block w-full border bg-transparent p-2"
                        value={maxRealm}
                        onChange={(e) =>
                          setMaxRealm(e.target.value as RealmType)
                        }
                      >
                        {REALM_VALUES.map((r) => (
                          <option key={r}>{r}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <InkButton
                    type="submit"
                    disabled={
                      pending ||
                      REALM_VALUES.indexOf(minRealm) >
                        REALM_VALUES.indexOf(maxRealm)
                    }
                  >
                    确认创建
                  </InkButton>{' '}
                  <InkButton onClick={() => setCreating(false)}>取消</InkButton>
                </form>
              ) : (
                <div className="flex gap-3">
                  <InkButton
                    disabled={pending}
                    onClick={() => setCreating(true)}
                  >
                    创建队伍
                  </InkButton>
                  <InkButton
                    disabled={pending}
                    onClick={() => void act(`/api/hunts/${eventId}/join`, {})}
                  >
                    快速匹配
                  </InkButton>
                </div>
              )}
              <div className="divide-ink/10 divide-y">
                {data.teams.length ? (
                  data.teams.map((t) => (
                    <div key={t.id} className="flex items-center gap-3 py-3">
                      <GameIcon
                        value="icon:cultivator-male-avatar"
                        className="text-4xl"
                      />
                      <div className="min-w-0 flex-1">
                        <p>
                          {
                            t.members.find((m) => m.cultivatorId === t.leaderId)
                              ?.name
                          }
                          的队伍{' '}
                          <span className="font-mono">
                            {t.members.length}/4
                          </span>
                        </p>
                        <p className="text-ink-secondary mt-1 text-xs">
                          {t.minRealm}至{t.maxRealm} ·{' '}
                          {t.members
                            .map(
                              (m) =>
                                `${m.name}${m.assisting ? '（助战）' : ''}`,
                            )
                            .join('、')}
                        </p>
                      </div>
                      <InkButton
                        disabled={
                          pending ||
                          t.members.length >= 4 ||
                          !identity ||
                          !huntRealmAllowed(t, identity.realm)
                        }
                        onClick={() =>
                          void act(`/api/hunts/${eventId}/join`, {
                            teamId: t.id,
                          })
                        }
                      >
                        加入
                      </InkButton>
                    </div>
                  ))
                ) : (
                  <p className="text-ink-secondary py-6 text-center">
                    还没有队伍，先召集几位道友吧。
                  </p>
                )}
              </div>
            </>
          ) : null}
          <HuntRewardPreview realm={data.event.realm} />
          <details className="text-ink-secondary">
            <summary className="cursor-pointer">出战须知</summary>
            <div className="mt-2 space-y-2 leading-7">
              <p>
                2～4 人结伴即可出战，不必等到满员。全员准备后，由队长发起讨伐。
              </p>
              <p>
                各队均可挑战，不必争抢。此次行踪消失前，每人只领一次报酬；落败可再战，领过报酬也能助战。
              </p>
              <p>
                入战时气血、法力充盈，战后不损原有气血、法力，也不折损灵兽寿元。
              </p>
              <p>行踪隐去后便无法出战，已经交手的队伍仍可战至终局。</p>
            </div>
          </details>
        </div>
      )}
    </InkDetailDrawer>
  );
}
