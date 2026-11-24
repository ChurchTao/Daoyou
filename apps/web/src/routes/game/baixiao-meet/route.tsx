import { BaixiaoScorecard } from '@app/components/feature/baixiao/BaixiaoScorecard';
import {
  BaixiaoFeedback,
  BaixiaoTurn,
} from '@app/components/feature/baixiao/BaixiaoTurn';
import { baixiaoCountdown } from '@app/components/feature/baixiao/time';
import { GameLoadingState } from '@app/components/game-shell';
import { InkButton, InkNotice } from '@app/components/ui';
import type {
  BaixiaoSessionView,
  BaixiaoStatus,
} from '@daoyou/contracts/baixiao/meet';
import {
  BAIXIAO_MISS_LIMIT,
  BAIXIAO_NODE_ID,
  BAIXIAO_QUESTION_COUNT,
  BAIXIAO_QUESTION_MS,
} from '@daoyou/game-domain/baixiao/meet';
import { useEffect, useRef } from 'react';
import { Link, Navigate } from 'react-router';
import './baixiao.css';
import type { mountBaixiaoScene } from './BaixiaoScene';
import { useBaixiao } from './useBaixiao';

const mapHref = `/game/map-v2?nodeId=${BAIXIAO_NODE_ID}`;
const rankingHref = '/game/rankings?tab=baixiao';
const date = new Intl.DateTimeFormat('zh-CN', {
  weekday: 'short',
  month: 'long',
  day: 'numeric',
  timeZone: 'Asia/Shanghai',
});

function Landscape({ turn }: { turn: number }) {
  const art = useRef<HTMLDivElement>(null);
  const scene = useRef<ReturnType<typeof mountBaixiaoScene> | null>(null);
  useEffect(() => {
    let mounted = true;
    const element = art.current;
    if (!element) return undefined;
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
  busy,
  start,
}: {
  status: BaixiaoStatus;
  busy: boolean;
  start: () => void;
}) {
  let notice = '';
  if (status.otherCharacter) notice = '本期已由同账号的另一位角色入场。';
  else if (status.phase === 'waiting')
    notice = `本期 ${date.format(status.opensAt)} 14:00 开场`;
  else if (status.phase === 'unavailable')
    notice = '本期正在备题，请稍后再来。';
  else if (status.phase === 'closing') notice = '本期已截止入场。';
  else if (status.phase === 'closed' || status.phase === 'settled')
    notice = '本期盛会已结束。';
  return (
    <section className="baixiao-invitation">
      <p className="baixiao-location">大晋 · 晋京</p>
      <h1>百晓盛会</h1>
      <p className="baixiao-schedule">
        每周四 14:00–16:00 北京时间 · 15:45 截止入场
      </p>
      <ul className="baixiao-rules">
        <li>免费入场，每账号每期可参赛一次。</li>
        <li>
          一场 25 关，限时 15 分钟，每题 {BAIXIAO_QUESTION_MS / 1000}{' '}
          秒。答错、超时或离开作答窗口均罚时 20 秒，累计 10 次失误即淘汰。
        </li>
        <li>入场领五张对策卡。每连对四题，等概率补一张。</li>
        <li>答对即得修为、灵石和感悟。通关可登才子榜并额外抽一件奖品。</li>
      </ul>
      {notice && <p role="status">{notice}</p>}
      <div className="baixiao-actions">
        <InkButton
          disabled={status.phase !== 'open' || status.otherCharacter}
          pending={busy}
          onClick={start}
        >
          入场答题
        </InkButton>
        <Link className="baixiao-link" to={rankingHref}>
          查看才子榜
        </Link>
      </div>
      <details className="baixiao-odds">
        <summary>通关奖品与概率</summary>
        <p>功法典籍 90% · 传承灵印 9% · 上品传承灵印 1%</p>
      </details>
    </section>
  );
}

function Results({ session }: { session: BaixiaoSessionView }) {
  const title =
    session.finished === 'cleared'
      ? '二十五关已过'
      : session.finished === 'eliminated'
        ? '本场止步'
        : '作答已结束';
  return (
    <section className="baixiao-invitation baixiao-result">
      <h1>{title}</h1>
      {session.finished === 'eliminated' && (
        <p>累计失误 10 次，已答对的收益照常到账。</p>
      )}
      {session.finished === 'cleared' && <p>成绩将在本期封榜后公布。</p>}
      <BaixiaoScorecard score={session.score} />
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
      {session.itemName && <p>通关所得：{session.itemName}，已随传音送达。</p>}
      <div className="baixiao-actions">
        <Link className="baixiao-link" to={rankingHref}>
          查看才子榜
        </Link>
        <Link className="baixiao-link" to={mapHref}>
          返回大晋
        </Link>
      </div>
    </section>
  );
}

export default function BaixiaoMeetRoute() {
  const meet = useBaixiao();
  const session = meet.status?.session;
  const question = session?.question;
  const seconds = question
    ? Math.max(0, Math.ceil((question.deadline - meet.now) / 1000))
    : 0;
  const remaining = session
    ? Math.max(0, Math.ceil((session.endsAt - meet.now) / 1000))
    : 0;
  const position = Math.min(
    (session?.position ?? 0) + 1,
    BAIXIAO_QUESTION_COUNT,
  );
  if (session?.challengeId && !session.finished)
    return (
      <Navigate
        to={`/game/baixiao-meet/battle/${session.challengeId}`}
        replace
      />
    );
  return (
    <main className="baixiao-hall">
      <Landscape turn={session?.latest?.position ?? -1} />
      <div className="baixiao-scene">
        <header className="baixiao-header">
          {session && !session.finished ? (
            <div className="baixiao-hud">
              <span>
                第{' '}
                <b>
                  {position} / {BAIXIAO_QUESTION_COUNT}
                </b>{' '}
                关
              </span>
              <div className="baixiao-time">
                <span
                  className="baixiao-clock"
                  data-urgent={Boolean(question && seconds <= 5)}
                  aria-label={question ? `本题剩余 ${seconds} 秒` : '候题'}
                >
                  {question ? `${String(seconds).padStart(2, '0')} 秒` : '候题'}
                </span>
                <small>
                  全场 <b>{baixiaoCountdown(remaining)}</b>
                </small>
              </div>
              <span>
                失误{' '}
                <b>
                  {session.score.mistakes} / {BAIXIAO_MISS_LIMIT}
                </b>
              </span>
            </div>
          ) : (
            <Link className="baixiao-link" to={mapHref}>
              返回舆图
            </Link>
          )}
        </header>
        {meet.error && (
          <div className="baixiao-error">
            <InkNotice>{meet.error}</InkNotice>
            <InkButton onClick={meet.recover}>重连</InkButton>
          </div>
        )}
        {!meet.status && !meet.error && (
          <GameLoadingState variant="scene" message="正在展开题签…" />
        )}
        {meet.status && !session && (
          <Lobby status={meet.status} busy={meet.busy} start={meet.start} />
        )}
        {session?.finished && <Results session={session} />}
        {session && !session.finished && (
          <section className="baixiao-paper" aria-label="作答区">
            {question ? (
              <div className="baixiao-question" key={question.position}>
                <BaixiaoTurn
                  question={question}
                  hand={session.hand}
                  streak={session.streak}
                  disabled={meet.busy || meet.locked || !meet.foreground}
                  onAnswer={meet.answer}
                  onCard={meet.useCard}
                />
                <p role="status" className="baixiao-turn-message">
                  {meet.busy ? '正在判定…' : meet.locked ? '本题正在结算…' : ''}
                </p>
              </div>
            ) : (
              <div
                className="baixiao-between"
                role="status"
                data-verdict={session.latest?.verdict}
              >
                {session.latest ? (
                  <BaixiaoFeedback answer={session.latest} />
                ) : (
                  '正在展开首题…'
                )}
                {!meet.foreground && <small>返回作答窗口后继续</small>}
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
