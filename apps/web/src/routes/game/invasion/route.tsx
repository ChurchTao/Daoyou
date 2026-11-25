import { WeeklyActivityHeader } from '@app/components/feature/weekly-activity/WeeklyActivity';
import { GameLoadingState } from '@app/components/game-shell';
import { InkModal } from '@app/components/layout/InkModal';
import { InkButton, InkNotice } from '@app/components/ui';
import { usePlayerSession } from '@app/lib/resources/player';
import type {
  InvasionCommand,
  InvasionStatus,
} from '@daoyou/contracts/invasion';
import {
  INVASION_CARD_COPY,
  INVASION_CARDS,
  INVASION_NODE_ID,
} from '@daoyou/game-domain/invasion';
import { invasionBossWave } from '@daoyou/game-rules/invasion';
import { dungeonRewardItemName } from '@daoyou/game-rules/rewards/dungeon';
import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router';
import './invasion.css';
import type { mountInvasionScene } from './InvasionScene';
import { invasionClock, requestInvasion } from './request';

const art = '/assets/maps/taiyue-baishui-v1.webp';
const mapHref = `/game/map-v2?nodeId=${INVASION_NODE_ID}`;
const rankHref = '/game/rankings?tab=invasion';

function Landscape({ phase }: { phase: string }) {
  const holder = useRef<HTMLDivElement>(null);
  const scene = useRef<ReturnType<typeof mountInvasionScene>>(null);
  useEffect(() => {
    let mounted = true;
    const element = holder.current!;
    void import('./InvasionScene')
      .then(({ mountInvasionScene }) => {
        if (mounted) scene.current = mountInvasionScene(element, art);
      })
      .catch(() => {});
    return () => {
      mounted = false;
      scene.current?.destroy();
      scene.current = null;
    };
  }, []);
  useEffect(() => {
    scene.current?.setPhase(phase);
  }, [phase]);
  return <div ref={holder} className="invasion-landscape" aria-hidden="true" />;
}

export default function InvasionRoute() {
  const id = usePlayerSession().data?.activeCultivator?.id;
  return <Camp key={id ?? 'waiting'} playerId={id} />;
}

function Camp({ playerId }: { playerId?: string }) {
  const [params] = useSearchParams();
  const [clockOffset, setClockOffset] = useState(0);
  const [status, setStatus] = useState<InvasionStatus>();
  const [now, setNow] = useState(Date.now);
  const [busy, setBusy] = useState(false);
  const [rules, setRules] = useState(false);
  const [error, setError] = useState('');
  const latest = useRef(0);
  const cadence = status?.open || status?.rewardsPending ? 1200 : 12000;
  useEffect(() => {
    if (!playerId) return;
    const abort = new AbortController();
    let timer: number;
    const poll = () => {
      const sequence = latest.current;
      void requestInvasion<InvasionStatus>('', undefined, abort.signal)
        .then((value) => {
          if (latest.current === sequence && !abort.signal.aborted) {
            setStatus(value);
            setClockOffset(value.serverNow - Date.now());
          }
        })
        .catch((cause: unknown) => {
          if (latest.current === sequence && !abort.signal.aborted)
            setError(
              cause instanceof Error ? cause.message : '暂时无法读取营地',
            );
        })
        .finally(() => {
          if (!abort.signal.aborted) timer = window.setTimeout(poll, cadence);
        });
    };
    poll();
    return () => {
      abort.abort();
      window.clearTimeout(timer);
    };
  }, [playerId, cadence]);
  useEffect(() => {
    const timer = window.setInterval(
      () => setNow(Date.now() + clockOffset),
      250,
    );
    return () => window.clearInterval(timer);
  }, [clockOffset]);

  async function send(command: InvasionCommand) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      ++latest.current;
      const next = await requestInvasion<InvasionStatus>('', command);
      ++latest.current;
      setStatus(next);
      setClockOffset(next.serverNow - Date.now());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '操作未完成');
    } finally {
      setBusy(false);
    }
  }

  const team = status?.team;
  if (
    team?.phase === 'battle' &&
    team.battleId &&
    team.battleId !== params.get('from')
  )
    return (
      <Navigate replace to={`/game/combat-v6/invasion/${team.battleId}`} />
    );
  const ready = !!playerId && !!team?.ready.includes(playerId);
  const mine = playerId ? team?.resources[playerId] : undefined;
  const open = status?.open && now < status.closesAt;
  const rest =
    team?.phase === 'rest' && team.restEndsAt !== null && now < team.restEndsAt;
  const remaining = status ? Math.max(0, status.closesAt - now) : 0;
  const reward = status?.reward;

  return (
    <div className="invasion-view">
      <WeeklyActivityHeader
        title="古魔入侵"
        place="天南舆图"
        mapHref={mapHref}
        onRules={() => setRules(true)}
      />
      <main className="invasion-camp">
        <Landscape
          phase={team?.phase ?? (status && !open ? 'finished' : 'assembling')}
        />
        <div className="invasion-body">
          <section className="invasion-panel" aria-label="镇魔营地">
            {error && <InkNotice tone="danger">{error}</InkNotice>}
            {status && (open || status.completedWave > 0) && (
              <div className="invasion-kicker">
                {status.completedWave > 0 && (
                  <span>
                    本期通关 <b className="font-mono">{status.completedWave}</b>{' '}
                    波
                  </span>
                )}
                {open && (
                  <span>
                    距收阵{' '}
                    <b className="font-mono">
                      {invasionClock(remaining, true)}
                    </b>
                  </span>
                )}
              </div>
            )}
            {!status && !error && (
              <GameLoadingState message="正在探查营地……" variant="inline" />
            )}
            {status && !team ? (
              <>
                <h2>镇魔营地</h2>
                <p className="text-ink-secondary">
                  每周二 14:00–16:00 · 北京时间
                </p>
                {status.otherCharacter ? (
                  <p>请使用本账号本期参战的角色。</p>
                ) : !open ? (
                  <p>界隙已封，待下次集结。</p>
                ) : (
                  <>
                    <p>2–4 人结队，随队出战。</p>
                    <div className="invasion-actions">
                      <InkButton
                        variant="primary"
                        disabled={busy}
                        onClick={() => void send({ type: 'create' })}
                      >
                        发起集结
                      </InkButton>
                      {status.teams.length > 0 && (
                        <InkButton
                          disabled={busy}
                          onClick={() => void send({ type: 'join' })}
                        >
                          快速入队
                        </InkButton>
                      )}
                    </div>
                    <ul className="invasion-list">
                      {status.teams.map((entry) => (
                        <li key={entry.id}>
                          <span>
                            {entry.members
                              .map((member) => member.name)
                              .join('、')}{' '}
                            <small>{entry.members.length}/4 人</small>
                          </span>
                          <InkButton
                            disabled={busy}
                            onClick={() =>
                              void send({ type: 'join', teamId: entry.id })
                            }
                          >
                            入队
                          </InkButton>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </>
            ) : null}
            {team?.phase === 'assembling' && (
              <>
                <h2>
                  第 {team.wave} 波 · {team.realm}难度
                </h2>
                <p className="text-ink-secondary">
                  <span className="font-mono">{team.members.length}/4</span> 人
                  · {team.firstClear ? '可推进本期进度' : '本波为助战'}
                </p>
                {team.busyMembers && (
                  <p>有队员尚在另一轮挑战中，或需要切回本期出战的角色。</p>
                )}
                <ul className="invasion-list">
                  {team.members.map((member) => (
                    <li key={member.cultivatorId}>
                      <span>
                        {member.name} <small>{member.realm}</small>
                      </span>
                      <span>
                        {team.ready.includes(member.cultivatorId)
                          ? '已准备'
                          : '待准备'}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="invasion-actions">
                  <InkButton
                    variant={ready ? 'secondary' : 'primary'}
                    disabled={busy || !open}
                    onClick={() => void send({ type: 'ready', ready: !ready })}
                  >
                    {ready ? '取消准备' : '准备'}
                  </InkButton>
                  {team.leader && (
                    <InkButton
                      variant="primary"
                      disabled={
                        busy ||
                        !open ||
                        team.members.length < 2 ||
                        team.busyMembers ||
                        team.ready.length !== team.members.length
                      }
                      onClick={() => void send({ type: 'start' })}
                    >
                      开启挑战
                    </InkButton>
                  )}
                  {team.leader &&
                    (team.recruiting || team.members.length < 4) && (
                      <InkButton
                        disabled={busy || !open}
                        onClick={() =>
                          void send({
                            type: 'recruit',
                            advertised: !team.recruiting,
                          })
                        }
                      >
                        {team.recruiting ? '停止招募' : '营地招募'}
                      </InkButton>
                    )}
                  <InkButton
                    disabled={busy || !open}
                    onClick={() => void send({ type: 'leave' })}
                  >
                    退出队伍
                  </InkButton>
                </div>
              </>
            )}
            {team?.phase === 'battle' && (
              <GameLoadingState message="正在清点战果……" variant="inline" />
            )}
            {team?.phase === 'launching' && (
              <GameLoadingState
                message={`第 ${team.wave} 波正在布阵……`}
                variant="inline"
              />
            )}
            {team?.phase === 'rest' && team.regrouping && (
              <>
                <h2>重新集结</h2>
                <p>
                  队伍已有变化。结束本轮后，可随当前队伍继续挑战，已过波次保留。
                </p>
                <InkButton
                  variant="primary"
                  disabled={!open || busy}
                  onClick={() => void send({ type: 'withdraw' })}
                >
                  返回集结
                </InkButton>
              </>
            )}
            {team?.phase === 'rest' && !team.regrouping && (
              <>
                <h2>
                  休憩 · 第 {team.wave} 波
                  {invasionBossWave(team.wave) ? '首领来袭' : ''}
                </h2>
                <p>
                  休憩剩余{' '}
                  <b className="font-mono">
                    {invasionClock((team.restEndsAt ?? now) - now, true)}
                  </b>{' '}
                  · {team.firstClear ? '可推进本期进度' : '本波为助战'}
                </p>
                <ul className="invasion-list">
                  {team.members.map((member) => {
                    const resource = team.resources[member.cultivatorId];
                    return (
                      <li key={member.cultivatorId}>
                        <span>
                          {member.name}{' '}
                          <small>
                            {team.ready.includes(member.cultivatorId)
                              ? '已就绪'
                              : ''}
                          </small>
                        </span>
                        {resource && (
                          <small className="font-mono">
                            {resource.hp > 0
                              ? `气血 ${resource.hp}/${resource.maxHp} · 法力 ${resource.mp}/${resource.maxMp}`
                              : '已倒地'}
                          </small>
                        )}
                      </li>
                    );
                  })}
                </ul>
                {mine &&
                  mine.hp > 0 &&
                  team.recovery.length > 0 &&
                  (mine.hp < mine.maxHp || mine.mp < mine.maxMp) && (
                    <div>
                      <h3>回复品</h3>
                      <div className="invasion-actions">
                        {team.recovery.map((item) => (
                          <InkButton
                            key={item.id}
                            disabled={!rest || busy}
                            onClick={() =>
                              void send({
                                type: 'recover',
                                itemId: item.id,
                                requestId: crypto.randomUUID(),
                              })
                            }
                          >
                            服用{item.name}{' '}
                            <span className="font-mono">×{item.quantity}</span>
                          </InkButton>
                        ))}
                      </div>
                    </div>
                  )}
                {INVASION_CARDS.some((card) => team.self.cards[card]) && (
                  <div>
                    <h3>
                      增益卡 <small>本场最多启用一张</small>
                    </h3>
                    <div className="invasion-cards">
                      {INVASION_CARDS.filter(
                        (card) => team.self.cards[card],
                      ).map((card) => (
                        <button
                          type="button"
                          key={card}
                          aria-pressed={team.self.selected === card}
                          disabled={!rest || busy || !mine?.hp}
                          onClick={() =>
                            void send({
                              type: 'card',
                              card: team.self.selected === card ? null : card,
                            })
                          }
                        >
                          <b>
                            {INVASION_CARD_COPY[card].name}{' '}
                            <span className="font-mono">
                              ×{team.self.cards[card]}
                            </span>
                          </b>
                          <small>{INVASION_CARD_COPY[card].effect}</small>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="invasion-actions">
                  <InkButton
                    variant="primary"
                    disabled={!rest || busy}
                    onClick={() => void send({ type: 'ready', ready: !ready })}
                  >
                    {ready ? '取消就绪' : '准备迎战'}
                  </InkButton>
                  {team.leader && (
                    <InkButton
                      disabled={!rest || busy}
                      onClick={() => void send({ type: 'withdraw' })}
                    >
                      全队返回集结
                    </InkButton>
                  )}
                </div>
              </>
            )}
            {status &&
              (!team || team.phase === 'assembling') &&
              status.completedWave > 0 && (
                <section aria-label="本期战果">
                  <h3>本期战果</h3>
                  {reward && (
                    <>
                      <p>
                        修为{' '}
                        <b className="font-mono">+{reward.cultivationExp}</b> ·
                        灵石 <b className="font-mono">+{reward.spiritStones}</b>{' '}
                        · 感悟 <b className="font-mono">+{reward.insight}</b>
                      </p>
                      {reward.drops.length > 0 && (
                        <p>
                          战利品已寄出 ·{' '}
                          {reward.drops.map(dungeonRewardItemName).join('、')}
                        </p>
                      )}
                    </>
                  )}
                  {status.rewardsPending && (
                    <p role="status">正在清点战利品……</p>
                  )}
                  {status.lastBattleId && (
                    <Link
                      className="text-teal underline"
                      to={`/game/battle/${status.lastBattleId}`}
                    >
                      回看最近通关
                    </Link>
                  )}
                </section>
              )}
            <div className="invasion-actions">
              <Link className="invasion-ranking-link" to={rankHref}>
                查看除魔榜
              </Link>
              <Link className="invasion-ranking-link" to="/game/party">
                我的队伍
              </Link>
            </div>
          </section>
        </div>
      </main>
      <InkModal
        isOpen={rules}
        onClose={() => setRules(false)}
        title="规则与奖励"
      >
        <ul className="list-disc space-y-3 pl-5">
          <li>
            每周二北京时间 14:00–16:00 开放。每队 2–4
            人，从队长的下一波开打，难度取参战成员中的最高境界。
          </li>
          <li>
            每五波出现首领。休憩可使用储物袋里的回复品，扣除实际库存。增益卡可留到后续波次，每人每场至多启用一张。
          </li>
          <li>
            打赢个人待挑战的下一波，获得相当于 2 小时 24
            分钟历练的修为、灵石和感悟。重打或跳过波次均为助战。
          </li>
          <li>
            个人首次通关首领波时独立抽取一次。妖兽材料 85%，传承灵印
            13%，上品传承灵印 2%。
          </li>
          <li>除魔榜以最近一次有效通关的队伍和实际难度记名。同波并列。</li>
        </ul>
      </InkModal>
    </div>
  );
}
