import { BaixiaoScorecard } from '@app/components/feature/baixiao/BaixiaoScorecard';
import {
  BaixiaoFeedbackToast,
  BaixiaoHandPanel,
  BaixiaoQuestionOptions,
} from '@app/components/feature/baixiao/BaixiaoTurn';
import {
  baixiaoCountdown,
  baixiaoTime,
} from '@app/components/feature/baixiao/time';
import { activityState } from '@app/components/feature/weekly-activity/schedule';
import {
  WeeklyActivityHeader,
  WeeklyActivityLobby,
} from '@app/components/feature/weekly-activity/WeeklyActivity';
import { GameLoadingState } from '@app/components/game-shell';
import { useInkUI } from '@app/components/providers/useInkUI';
import { InkButton } from '@app/components/ui';
import { GameImage } from '@app/components/ui/GameImage';
import { InkDetailDrawer } from '@app/components/ui/InkDetailDrawer';
import type {
  BaixiaoSessionView,
  BaixiaoStatus,
} from '@daoyou/contracts/baixiao/meet';
import {
  BAIXIAO_FOCUS_PENALTY_MS,
  BAIXIAO_MISS_LIMIT,
  BAIXIAO_NODE_ID,
  BAIXIAO_QUESTION_COUNT,
  BAIXIAO_QUESTION_MS,
} from '@daoyou/game-domain/baixiao/meet';
import { type CSSProperties, useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router';
import './baixiao.css';
import type { mountBaixiaoScene } from './BaixiaoScene';
import { useBaixiao } from './useBaixiao';

const mapHref = `/game/map-v2?nodeId=${BAIXIAO_NODE_ID}`;
const rankingHref = '/game/rankings?tab=baixiao';
const hallArt = '/assets/weekly/baixiao-jinjing-hall.webp';
const focusPenaltySeconds = BAIXIAO_FOCUS_PENALTY_MS / 1000;

function Landscape({ turn }: { turn: number }) {
  const art = useRef<HTMLDivElement>(null);
  const scene = useRef<ReturnType<typeof mountBaixiaoScene> | null>(null);
  useEffect(() => {
    let mounted = true;
    if (!art.current) return undefined;
    const element = art.current;
    void import('./BaixiaoScene')
      .then(({ mountBaixiaoScene }) => {
        if (mounted) scene.current = mountBaixiaoScene(element);
      })
      .catch(() => {});
    return () => {
      mounted = false;
      scene.current?.destroy();
      scene.current = null;
    };
  }, []);
  useEffect(() => {
    if (turn >= 0) scene.current?.turn();
  }, [turn]);
  return <div className="baixiao-landscape" aria-hidden="true" ref={art} />;
}

function Lobby({
  status,
  now,
  busy,
  start,
}: {
  status: BaixiaoStatus;
  now: number;
  busy: boolean;
  start: () => void;
}) {
  const phase =
    status.phase === 'open' && now > status.lastStartAt
      ? 'closing'
      : status.phase;
  const state = activityState(
    phase,
    status.opensAt,
    status.lastStartAt,
    status.closesAt,
  );
  const canStart = phase === 'open' && !status.otherCharacter;
  return (
    <WeeklyActivityLobby
      art={hallArt}
      place="大晋 · 晋京"
      title={state.title}
      note={status.otherCharacter ? '本账号已用另一位角色参赛。' : state.note}
      schedule="每周四 14:00–16:00 · 北京时间"
      facts={['个人赛时 15 分钟', '共 25 关', '不限境界 · 免费参赛']}
      admission={
        canStart &&
        `每账号每期一场，入场即开始计时。作答时失焦罚时 ${focusPenaltySeconds} 秒，累计 10 次失误即淘汰。`
      }
      action={
        canStart && (
          <InkButton
            variant="primary"
            pending={busy}
            pendingLabel="正在入场…"
            onClick={start}
          >
            入场答题
          </InkButton>
        )
      }
      rankHref={rankingHref}
      rankName="才子榜"
    />
  );
}

function Rules({ open, close }: { open: boolean; close: () => void }) {
  return (
    <InkDetailDrawer isOpen={open} title="规则与奖励" size="md" onClose={close}>
      <div className="weekly-activity-rules">
        <section>
          <h3>入场与作答</h3>
          <p>
            每账号每期免费参赛一次，入场后开始计时，锁定本期参赛角色。全场 15
            分钟，每题最多 45 秒。
          </p>
          <p>答错或超时各记一次失误，罚时 20 秒。累计 10 次失误即淘汰。</p>
          <p>
            作答时每次失焦计入 {focusPenaltySeconds}{' '}
            秒罚时。返回后仍可作答原题， 本题和全场倒计时照常进行。
          </p>
          <p>每卷 25 题，文学与文史 11 题、历史地理 8 题、脑洞与谜语 6 题。</p>
        </section>
        <section>
          <h3>对策卡</h3>
          <p>
            开场获得免答卡 1 张、天机卡与挑战卡各 2 张。每连对 4
            题，从三种卡中等概率补一张。
          </p>
          <p>
            免答卡直接判对。天机卡有 50%
            概率判对。这两种卡都按出卡前的用时计分。
          </p>
          <p>
            挑战卡邀考官交手。胜计 25 秒。战败、平局或逃离计 45 秒，另罚 20 秒。
          </p>
        </section>
        <section>
          <h3>成绩与奖励</h3>
          <p>
            通关后按作答计时与罚时之和排名。总用时以十分之一秒比较，同用时答对多者在前，仍相同则并列。
          </p>
          <p>
            答对即得修为、灵石和感悟。通关另抽一件奖品，功法典籍 90%、传承灵印
            9%、上品传承灵印 1%。
          </p>
        </section>
      </div>
    </InkDetailDrawer>
  );
}

function Results({
  session,
  phase,
}: {
  session: BaixiaoSessionView;
  phase: BaixiaoStatus['phase'];
}) {
  const resultHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => resultHeading.current?.focus({ preventScroll: true }), []);
  const title =
    session.finished === 'cleared'
      ? '二十五关已过'
      : session.finished === 'eliminated'
        ? '本场止步'
        : '作答已结束';
  return (
    <div className="baixiao-result-scroll">
      <section className="baixiao-result">
        <h2 ref={resultHeading} tabIndex={-1}>
          {title}
        </h2>
        <p>
          总用时{' '}
          <strong className="font-mono">
            {baixiaoTime(session.score.totalMs)}
          </strong>
        </p>
        {session.finished === 'eliminated' && (
          <p>累计失误 10 次，已答对的收益照常到账。</p>
        )}
        {session.finished === 'cleared' && (
          <p>
            {phase === 'settled'
              ? '本期名次已公布。'
              : '本期名次将在封榜后公布。'}
          </p>
        )}
        <dl className="baixiao-earned" aria-label="本场所得">
          <div>
            <dt>修为</dt>
            <dd>{session.earned.cultivationExp.toLocaleString()}</dd>
          </div>
          <div>
            <dt>灵石</dt>
            <dd>{session.earned.spiritStones.toLocaleString()}</dd>
          </div>
          <div>
            <dt>感悟</dt>
            <dd>{session.earned.insight.toLocaleString()}</dd>
          </div>
        </dl>
        {session.itemName && (
          <p>通关所得 · {session.itemName}（已随传音送达）</p>
        )}
        <details className="baixiao-result-details">
          <summary>成绩明细</summary>
          <BaixiaoScorecard score={session.score} showTotal={false} />
        </details>
        <div className="weekly-activity-actions">
          <InkButton href={rankingHref} variant="primary">
            查看才子榜
          </InkButton>
          <InkButton href={mapHref} variant="secondary">
            返回舆图
          </InkButton>
        </div>
      </section>
    </div>
  );
}

function Timer({ session, now }: { session: BaixiaoSessionView; now: number }) {
  const { question, endsAt, position, score } = session;
  const remaining = Math.max(0, Math.ceil((endsAt - now) / 1000));
  const questionMs = question ? Math.max(0, question.deadline - now) : 0;
  const seconds = Math.ceil(questionMs / 1000);
  const endsWithSession = question?.deadline === endsAt;
  const questionUrgent = !!question && seconds <= 5 && !endsWithSession;
  const sessionUrgent = remaining <= 5 && !questionUrgent;
  return (
    <header className="baixiao-hud">
      <div className="baixiao-progress">
        <span>
          第{' '}
          <b className="font-mono">
            {Math.min(position + 1, BAIXIAO_QUESTION_COUNT)} /{' '}
            {BAIXIAO_QUESTION_COUNT}
          </b>{' '}
          关
        </span>
        <span
          data-warning={score.mistakes >= BAIXIAO_MISS_LIMIT - 2 || undefined}
        >
          失误{' '}
          <b className="font-mono">
            {score.mistakes} / {BAIXIAO_MISS_LIMIT}
          </b>
        </span>
      </div>
      <div
        className="baixiao-question-time"
        data-level={
          !question
            ? undefined
            : seconds <= 5
              ? 'urgent'
              : seconds <= 10
                ? 'warning'
                : undefined
        }
      >
        <div
          className="baixiao-clock"
          role="timer"
          aria-label={question ? `本题剩余 ${seconds} 秒` : '候题'}
          data-pulse={questionUrgent || undefined}
          style={
            {
              '--baixiao-time': `${Math.min(100, (questionMs / BAIXIAO_QUESTION_MS) * 100)}%`,
            } as CSSProperties
          }
        >
          <span className="font-mono" aria-hidden="true">
            {question ? seconds : '—'}
          </span>
        </div>
        <span>
          {!question
            ? '候题'
            : questionUrgent
              ? '本题将超时'
              : '本题剩余（秒）'}
        </span>
      </div>
      <div
        className="baixiao-session-time"
        data-warning={remaining <= 60 || undefined}
        data-pulse={sessionUrgent || undefined}
      >
        <span>
          {endsWithSession || remaining <= 10 ? '本场即将结束' : '本场剩余'}
        </span>
        <b
          className="font-mono"
          role="timer"
          aria-label={`本场还剩 ${Math.floor(remaining / 60)} 分 ${remaining % 60} 秒`}
        >
          {baixiaoCountdown(remaining)}
        </b>
      </div>
    </header>
  );
}

function QuestionSeat({
  meet,
  session,
}: {
  meet: ReturnType<typeof useBaixiao>;
  session: BaixiaoSessionView;
}) {
  const { question, latest } = session;
  const scroll = useRef<HTMLDivElement>(null);
  const position = question?.position;
  useEffect(() => {
    if (position !== undefined)
      scroll.current?.scrollTo({ top: 0, behavior: 'instant' });
  }, [position]);
  const blocked =
    !question || meet.busy || meet.locked || !meet.foreground || !!meet.error;
  const pendingOption =
    meet.intent?.action === 'answer' ? meet.intent.option : undefined;
  const pendingCard =
    meet.intent?.action === 'card' ? meet.intent.card : undefined;
  return (
    <section className="baixiao-hall" aria-label="百晓盛会">
      <div className="baixiao-backdrop" aria-hidden="true">
        <GameImage src={hallArt} alt="" />
      </div>
      <Landscape turn={latest?.position ?? -1} />
      <div className="baixiao-seat">
        <Timer session={session} now={meet.now} />
        <section
          className="baixiao-paper"
          aria-label="作答区"
          aria-busy={meet.busy || undefined}
          ref={scroll}
        >
          {question ? (
            <div className="baixiao-question" key={position}>
              <BaixiaoQuestionOptions
                question={question}
                disabled={blocked}
                onAnswer={meet.answer}
                pendingOption={pendingOption}
              />
            </div>
          ) : (
            <div className="baixiao-between">
              {!meet.error && (
                <div role="status">
                  <p>
                    {meet.foreground ? '正在展开题签…' : '返回作答窗口后继续'}
                  </p>
                  <span className="baixiao-turn-line" aria-hidden="true" />
                </div>
              )}
            </div>
          )}
        </section>
        <BaixiaoHandPanel
          hand={session.hand}
          streak={session.streak}
          position={position}
          disabled={blocked}
          pendingCard={pendingCard}
          latest={latest}
          onCard={meet.useCard}
        />
      </div>
    </section>
  );
}

function BaixiaoScreen({ meet }: { meet: ReturnType<typeof useBaixiao> }) {
  const [rulesOpen, setRulesOpen] = useState(false);
  const session = meet.status?.session;
  if (session?.challengeId && !session.finished)
    return (
      <Navigate
        to={`/game/baixiao-meet/battle/${session.challengeId}`}
        replace
      />
    );
  if (session && !session.finished)
    return <QuestionSeat meet={meet} session={session} />;
  return (
    <div className="baixiao-activity">
      <WeeklyActivityHeader
        title="百晓盛会"
        place="晋京"
        mapHref={mapHref}
        onRules={() => setRulesOpen(true)}
        disabled={meet.busy}
      />
      {!meet.status && !meet.error && (
        <GameLoadingState variant="scene" message="正在读取赛况…" />
      )}
      {meet.status &&
        (session ? (
          <Results session={session} phase={meet.status.phase} />
        ) : (
          <Lobby
            status={meet.status}
            now={meet.now}
            busy={meet.busy}
            start={meet.start}
          />
        ))}
      <Rules open={rulesOpen} close={() => setRulesOpen(false)} />
    </div>
  );
}

function FocusPenaltyToast({
  count,
  totalMs,
  foreground,
}: {
  count: number;
  totalMs: number;
  foreground: boolean;
}) {
  const reported = useRef(count);
  const toast = useRef<string | null>(null);
  const { pushToast, dismissToast } = useInkUI();
  useEffect(() => {
    if (!foreground || count <= reported.current) return;
    const delta = count - reported.current;
    reported.current = count;
    if (toast.current) dismissToast(toast.current);
    toast.current = pushToast({
      tone: 'warning',
      duration: 3000,
      message: `作答窗口失焦，加 ${delta * focusPenaltySeconds} 秒罚时 · 累计用时 ${baixiaoTime(totalMs)}`,
    });
  }, [count, dismissToast, foreground, pushToast, totalMs]);
  useEffect(
    () => () => {
      if (toast.current) dismissToast(toast.current);
    },
    [dismissToast],
  );
  return null;
}

export default function BaixiaoMeetRoute() {
  const meet = useBaixiao();
  const { error, recover } = meet;
  const { pushToast, dismissToast } = useInkUI();
  const session = meet.status?.session;
  useEffect(() => {
    if (!error) return;
    const id = pushToast({
      message: error,
      tone: 'warning',
      duration: 0,
      dismissible: false,
      actionLabel: '重连',
      onAction: recover,
    });
    return () => dismissToast(id);
  }, [dismissToast, error, pushToast, recover]);
  return (
    <>
      <BaixiaoScreen meet={meet} />
      {session && (
        <FocusPenaltyToast
          key={session.endsAt}
          count={session.score.focusPenalties ?? 0}
          totalMs={session.score.totalMs}
          foreground={meet.foreground}
        />
      )}
      {session?.latest && (
        <BaixiaoFeedbackToast
          key={`${session.endsAt}:${session.latest.position}`}
          answer={session.latest}
          totalMs={session.score.totalMs}
          foreground={meet.foreground}
        />
      )}
    </>
  );
}
