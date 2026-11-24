import { GameLoadingState } from '@app/components/game-shell/GameLoadingState';
import { InkButton } from '@app/components/ui/InkButton';
import { useStory } from '@app/lib/story/useStory';
import { CONTEST_NODE_ID } from '@daoyou/game-domain/alchemy/contest';
import { storyGateOpen } from '@daoyou/game-domain/story/gates';
import { useState } from 'react';
import { Link } from 'react-router';
import './contest.css';
import { ContestLobby, ContestRewards } from './ContestLobby';
import { ContestModal, ContestScoringRules } from './ContestModal';
import { ContestWorkbench } from './ContestWorkbench';
import { useContestSession } from './useContestSession';

const rankHref = '/game/rankings?tab=alchemy';
const mapHref = `/game/map-v2?nodeId=${CONTEST_NODE_ID}`;

export default function AlchemyContestPage() {
  const { story, loading: storyLoading } = useStory();
  const { status, now, pending, error, refresh, send } = useContestSession();
  const session = status?.session;
  const seconds = session
    ? Math.max(0, Math.ceil((Date.parse(session.deadline) - now) / 1000))
    : 0;
  const [rulesOpen, setRulesOpen] = useState(false);
  const rulesTitle = session ? '评分规则' : '评分与奖励';
  return (
    <div className="contest-page">
      <header className="contest-top">
        <div className="contest-width contest-top-inner">
          <Link to={mapHref}>
            <span aria-hidden="true">‹ </span>丹塔
          </Link>
          <h1>炼丹大会</h1>
          <InkButton
            variant="secondary"
            disabled={!!pending}
            onClick={() => setRulesOpen(true)}
          >
            {rulesTitle}
          </InkButton>
        </div>
      </header>
      {error && (
        <div className="contest-width contest-error" role="status">
          <span>{error}</span>
          <InkButton variant="secondary" onClick={() => void refresh(true)}>
            刷新赛况
          </InkButton>
        </div>
      )}
      {!status ? (
        <div className="contest-loading">
          {!error && (
            <GameLoadingState message="正在读取赛况…" variant="scene" />
          )}
        </div>
      ) : session ? (
        <ContestWorkbench
          key={`${status.week}:${session.deadline}`}
          week={status.week}
          session={session}
          rankHref={rankHref}
          seconds={seconds}
          settled={status.phase === 'settled'}
          pending={pending}
          brew={(command) => send('brew', command)}
          finish={() => send('finish', { week: status.week })}
        />
      ) : (
        <ContestLobby
          status={status}
          now={now}
          rankHref={rankHref}
          unlocked={
            storyLoading ? null : storyGateOpen(story?.unlocked, 'alchemy')
          }
          pending={pending === 'start'}
          start={() => void send('start', { week: status.week })}
        />
      )}
      <ContestModal
        open={rulesOpen}
        title={rulesTitle}
        onClose={() => setRulesOpen(false)}
        footer={
          <InkButton variant="secondary" onClick={() => setRulesOpen(false)}>
            关闭
          </InkButton>
        }
      >
        <ContestScoringRules />
        {!session && <ContestRewards />}
      </ContestModal>
    </div>
  );
}
