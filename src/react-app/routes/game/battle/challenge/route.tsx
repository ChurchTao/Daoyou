import { CombatV6Page } from '@app/components/feature/combat-v6/CombatV6Page';
import { CombatV6ReplayPlayer } from '@app/components/feature/combat-v6/CombatV6ReplayPlayer';
import {
  combatV6Request,
  mutationBody,
} from '@app/components/feature/combat-v6/request';
import { usePlayerSession } from '@app/lib/resources/player';
import type { CombatV6ReplayView } from '@shared/combat-v6/replay';
import {
  RankingChallengeSchema,
  type RankingChallengeRequest,
  type RankingChallengeResult,
} from '@shared/contracts/combatV6Ranking';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';

const inFlight = new Map<string, Promise<RankingChallengeResult>>();
function execute(owner: string, request: RankingChallengeRequest) {
  const key = owner + ':' + request.requestId;
  const existing = inFlight.get(key);
  if (existing) return existing;
  const promise = combatV6Request<RankingChallengeResult>(
    '/api/rankings/challenge-battle/v6',
    mutationBody(request),
  ).finally(() => inFlight.delete(key));
  inFlight.set(key, promise);
  return promise;
}
export default function RankingChallengeRoute() {
  const [params] = useSearchParams();
  const owner = usePlayerSession().data?.activeCultivator?.id;
  const parsed = RankingChallengeSchema.safeParse({
    requestId: params.get('requestId'),
    realm: params.get('realm'),
    targetId: params.get('targetId'),
  });
  if (!owner)
    return (
      <CombatV6Page title="天骄榜挑战" loading>
        {null}
      </CombatV6Page>
    );
  if (!parsed.success)
    return (
      <CombatV6Page
        title="天骄榜挑战"
        error="挑战链接已失效，请返回榜单重新发起"
        back="/game/rankings"
      >
        {null}
      </CombatV6Page>
    );
  return (
    <Challenge
      key={owner + ':' + params.toString()}
      owner={owner}
      request={parsed.data}
    />
  );
}
function Challenge({
  owner,
  request,
}: {
  owner: string;
  request: RankingChallengeRequest;
}) {
  const [input] = useState(request);
  const [data, setData] = useState<{
    result: RankingChallengeResult;
    replay?: CombatV6ReplayView;
  }>();
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const back = '/game/rankings?realm=' + encodeURIComponent(input.realm);
  useEffect(() => {
    const abort = new AbortController();
    void execute(owner, input)
      .then(async (result) => {
        const replay = result.battleId
          ? await combatV6Request<CombatV6ReplayView>(
              '/api/combat-v6/replays/' + result.battleId,
              { signal: abort.signal, cache: 'no-store' },
            )
          : undefined;
        if (!abort.signal.aborted) setData({ result, replay });
      })
      .catch((e: Error) => {
        if (!abort.signal.aborted) setError(e.message);
      });
    return () => abort.abort();
  }, [owner, input, attempt]);
  const summary = data ? (
    <div className="px-4 py-3 text-sm" role="status">
      <p>
        {data.result.affectsRanking
          ? data.result.challengerRank
            ? '本次结算名次：第 ' + data.result.challengerRank + ' 名'
            : '本次未上榜'
          : '越境切磋，不改变榜单名次'}
      </p>
      <p>挑战当日剩余次数：{data.result.remainingChallenges}/10</p>
      {data.replay ? <Link to={back}>返回天骄榜</Link> : null}
    </div>
  ) : null;
  return (
    <CombatV6Page
      title="天骄榜挑战"
      active={!!data?.replay}
      loading={!data && !error}
      error={error}
      back={back}
      backLabel="返回天骄榜"
      onRetry={() => {
        setError('');
        setAttempt((n) => n + 1);
      }}
    >
      {data?.replay ? (
        <CombatV6ReplayPlayer
          key={data.replay.battleId}
          record={data.replay}
          autoPlay
          title="天骄榜挑战"
          back={back}
          backLabel="返回天骄榜"
          endContent={summary}
        />
      ) : (
        summary
      )}
    </CombatV6Page>
  );
}
