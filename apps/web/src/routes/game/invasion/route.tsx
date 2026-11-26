import { useParty } from '@app/components/feature/party/useParty';
import {
  WeeklyActivityHeader,
  WeeklyActivityLobby,
} from '@app/components/feature/weekly-activity/WeeklyActivity';
import { activityState } from '@app/components/feature/weekly-activity/schedule';
import { GameLoadingState } from '@app/components/game-shell';
import { useInkUI } from '@app/components/providers/useInkUI';
import { InkButton, InkDetailDrawer, InkNotice } from '@app/components/ui';
import { usePlayerSession } from '@app/lib/resources/player';
import type {
  InvasionCommand,
  InvasionStatus,
} from '@daoyou/contracts/invasion';
import { INVASION_NODE_ID } from '@daoyou/game-domain/invasion';
import { dungeonRewardItemName } from '@daoyou/game-rules/rewards/dungeon';
import { useEffect, useRef, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router';
import { InvasionParty } from './InvasionParty';
import { InvasionRest } from './InvasionRest';
import type { mountInvasionScene } from './InvasionScene';
import './invasion.css';
import { invasionClock, requestInvasion } from './request';

const art = '/assets/weekly/invasion-rift-camp.webp';
const mapHref = `/game/map-v2?nodeId=${INVASION_NODE_ID}`;
const rankHref = '/game/rankings?tab=invasion';

function Landscape({ phase }: { phase: string }) {
  const holder = useRef<HTMLDivElement>(null);
  const scene = useRef<ReturnType<typeof mountInvasionScene>>(null);
  const currentPhase = useRef(phase);
  useEffect(() => {
    currentPhase.current = phase;
    scene.current?.setPhase(phase);
  }, [phase]);
  useEffect(() => {
    let mounted = true;
    const element = holder.current!;
    void import('./InvasionScene')
      .then(({ mountInvasionScene }) => {
        if (mounted) {
          scene.current = mountInvasionScene(element, art);
          scene.current.setPhase(currentPhase.current);
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
      scene.current?.destroy();
      scene.current = null;
    };
  }, []);
  return <div ref={holder} className="invasion-landscape" aria-hidden="true" />;
}

function Receipt({ status }: { status: InvasionStatus }) {
  if (!status.completedWave) return null;
  const { reward } = status;
  return (
    <section className="invasion-receipt" aria-label="本期战果">
      <div className="invasion-section-heading">
        <h3>本期战果</h3>
        <span>
          已过 <strong className="font-mono">{status.completedWave}</strong> 波
        </span>
      </div>
      {reward && (
        <>
          <dl>
            <div>
              <dt>修为</dt>
              <dd>+{reward.cultivationExp}</dd>
            </div>
            <div>
              <dt>灵石</dt>
              <dd>+{reward.spiritStones}</dd>
            </div>
            <div>
              <dt>感悟</dt>
              <dd>+{reward.insight}</dd>
            </div>
          </dl>
          {reward.drops.length > 0 && (
            <p>
              战利品已寄出 ·{' '}
              {reward.drops.map(dungeonRewardItemName).join('、')}
            </p>
          )}
        </>
      )}
      {status.rewardsPending && <p role="status">正在清点战利品……</p>}
    </section>
  );
}

function Entry({
  status,
  open,
  now,
  error,
}: {
  status: InvasionStatus;
  open: boolean;
  now: number;
  error: string;
}) {
  const { openParty, value } = useParty();
  const state = activityState(
    open ? 'open' : 'waiting',
    open ? status.opensAt : status.nextOpensAt,
    status.closesAt,
    status.closesAt,
  );
  return (
    <WeeklyActivityLobby
      art={<Landscape phase={open ? 'assembling' : 'finished'} />}
      place="坠魔谷外围"
      title={
        open ? '镇魔营地' : status.completedWave ? '本期已收阵' : state.title
      }
      note={
        status.otherCharacter
          ? '请切回本账号本期参战的角色。'
          : open
            ? `距收阵 ${invasionClock(status.closesAt - now, true)}`
            : state.note
      }
      schedule="每周二 14:00–16:00 · 北京时间"
      facts={['2–4 人结队', '每 5 波遭遇首领']}
      rankHref={rankHref}
      rankName="除魔榜"
    >
      {error && <InkNotice tone="danger">{error}</InkNotice>}
      {open && !status.otherCharacter && (
        <div className="space-y-2">
          <p className="text-ink-secondary text-sm">
            {value?.roleMismatch
              ? '请切回在队角色，再到营地参战。'
              : '至少两人才能出战，结队后由队长开阵。'}
          </p>
          <InkButton
            variant="primary"
            onClick={() => openParty({ kind: 'invasion' })}
          >
            {value?.roleMismatch ? '查看队伍' : '组队迎战'}
          </InkButton>
        </div>
      )}
      <Receipt status={status} />
    </WeeklyActivityLobby>
  );
}

export default function InvasionRoute() {
  const id = usePlayerSession().data?.activeCultivator?.id;
  return <Camp key={id ?? 'waiting'} playerId={id} />;
}

function Camp({ playerId }: { playerId?: string }) {
  const [params] = useSearchParams();
  const { pushToast } = useInkUI();
  const [status, setStatus] = useState<InvasionStatus>();
  const [now, setNow] = useState(Date.now);
  const [busy, setBusy] = useState(false);
  const [rules, setRules] = useState(false);
  const [error, setError] = useState('');
  const clockOffset = useRef(0);
  const latest = useRef(0);
  const sending = useRef(false);
  const cadence =
    !status || status.open || status.rewardsPending ? 1200 : 12000;

  function update(value: InvasionStatus) {
    clockOffset.current = value.serverNow - Date.now();
    setNow(value.serverNow);
    setStatus(value);
  }

  useEffect(() => {
    if (!playerId) return;
    const abort = new AbortController();
    let timer: number;
    const poll = () => {
      const sequence = latest.current;
      void requestInvasion<InvasionStatus>('', undefined, abort.signal)
        .then((value) => {
          if (
            latest.current === sequence &&
            !abort.signal.aborted &&
            !sending.current
          ) {
            update(value);
            setError('');
          }
        })
        .catch((cause: unknown) => {
          if (
            latest.current === sequence &&
            !abort.signal.aborted &&
            !sending.current
          )
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
      () => setNow(Date.now() + clockOffset.current),
      250,
    );
    return () => window.clearInterval(timer);
  }, []);

  async function send(command: InvasionCommand) {
    if (sending.current) return false;
    sending.current = true;
    setBusy(true);
    setError('');
    try {
      ++latest.current;
      const next = await requestInvasion<InvasionStatus>('', command);
      ++latest.current;
      update(next);
      return true;
    } catch (cause) {
      pushToast({
        message: cause instanceof Error ? cause.message : '操作未完成',
        tone: 'warning',
      });
      return false;
    } finally {
      sending.current = false;
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
  const open = !!status?.open && now < status.closesAt;
  const staging = team?.phase === 'assembling';

  return (
    <div className="invasion-view">
      <WeeklyActivityHeader
        title="古魔入侵"
        place="天南舆图"
        mapHref={mapHref}
        onRules={() => setRules(true)}
      />
      {!status ? (
        <main className="invasion-camp invasion-initial">
          <Landscape phase="assembling" />
          {error ? (
            <InkNotice tone="danger">{error}</InkNotice>
          ) : (
            <GameLoadingState message="正在探查营地……" variant="inline" />
          )}
        </main>
      ) : !team || team.phase === 'finished' || (staging && !open) ? (
        <Entry status={status} open={open} now={now} error={error} />
      ) : (
        <main
          className="invasion-camp"
          data-stage={staging ? 'assembly' : 'operation'}
        >
          <Landscape phase={team.phase} />
          <div className="invasion-body">
            {error && <InkNotice tone="danger">{error}</InkNotice>}
            {staging ? (
              <InvasionParty
                key={team.id}
                team={team}
                busy={busy}
                open={open}
                remaining={status.closesAt - now}
                send={send}
              />
            ) : team.phase === 'rest' && !team.regrouping ? (
              <InvasionRest
                team={team}
                playerId={playerId}
                currentWave={status.completedWave}
                busy={busy}
                now={now}
                closesAt={status.closesAt}
                send={send}
              />
            ) : (
              <section className="invasion-transition">
                <p className="invasion-eyebrow">
                  第 <b className="font-mono">{team.wave}</b> 波
                </p>
                {team.regrouping ? (
                  <>
                    <h2>重新集结</h2>
                    <p>队伍已有变化。返回集结后，已通过的波次照常保留。</p>
                    <InkButton
                      variant="primary"
                      disabled={!open || busy}
                      onClick={() => void send({ type: 'withdraw' })}
                    >
                      返回集结
                    </InkButton>
                  </>
                ) : (
                  <GameLoadingState
                    message={
                      team.phase === 'battle' ? '正在清点战果……' : '正在开阵……'
                    }
                    variant="inline"
                  />
                )}
              </section>
            )}
            {staging && (
              <div className="invasion-secondary">
                <InkButton href={rankHref} variant="secondary">
                  查看除魔榜
                </InkButton>
                {status.completedWave > 0 && (
                  <details>
                    <summary>本期战果</summary>
                    <Receipt status={status} />
                  </details>
                )}
              </div>
            )}
          </div>
        </main>
      )}
      <InkDetailDrawer
        isOpen={rules}
        onClose={() => setRules(false)}
        title="规则与奖励"
        size="sm"
      >
        <div className="weekly-activity-rules">
          <section>
            <h3>出战</h3>
            <p>
              每周二北京时间 14:00–16:00。2–4
              人结队，从队长的下一波开打，难度取参战成员的最高境界。
            </p>
          </section>
          <section>
            <h3>波间休憩</h3>
            <p>
              休憩结束自动开阵，队长也可提前开阵。可用储物袋里的回复丹药，按实扣库存。每波至多启用一张增益卡。
            </p>
          </section>
          <section>
            <h3>首通与排名</h3>
            <p>
              打赢个人待挑战的下一波，获得约 2 小时 24
              分钟历练收益。重打或跳波均为助战。除魔榜按有效通关波次排名，同波并列。
            </p>
          </section>
          <section>
            <h3>首领战利品</h3>
            <p>
              个人首次击退第 5、10、15……波首领时独立抽取一次。妖兽材料
              85%，传承灵印 13%，上品传承灵印 2%。
            </p>
          </section>
        </div>
      </InkDetailDrawer>
    </div>
  );
}
