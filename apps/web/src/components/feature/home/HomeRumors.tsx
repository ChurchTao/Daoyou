import { activityDate } from '@app/components/feature/weekly-activity/schedule';
import { fetchJsonCached } from '@app/lib/client/requestCache';
import type { RealmType } from '@daoyou/constants/realms';
import type {
  HomeActivityRumor,
  HomeRumorsResponse,
} from '@daoyou/contracts/player/home-rumors';
import { CONTEST_NODE_ID } from '@daoyou/game-domain/alchemy/contest';
import { BAIXIAO_NODE_ID } from '@daoyou/game-domain/baixiao/meet';
import { INVASION_NODE_ID } from '@daoyou/game-domain/invasion';
import { useEffect, useState } from 'react';
import { HomeAct, HomeLabel } from './HomeAct';

const RUMORS_URL = '/api/player/home-rumors';
const RETRY_MS = 60_000;
const beijingClock = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});
const activityInfo = {
  invasion: { title: '古魔入侵', nodeId: INVASION_NODE_ID },
  'alchemy-contest': { title: '炼丹大会', nodeId: CONTEST_NODE_ID },
  baixiao: { title: '百晓盛会', nodeId: BAIXIAO_NODE_ID },
} as const;

function activityNote(activity: HomeActivityRumor) {
  switch (activity.phase) {
    case 'open':
      return `${activityDate(activity.time)} ${beijingClock.format(activity.time)} ${activity.kind === 'invasion' ? '结束' : '截止入场'}`;
    case 'unavailable':
      return '仍在准备';
    case 'unknown':
      return '查看入场状态';
  }
}

export function HomeRumors({
  realm,
  showHunts,
  showAlchemy,
}: {
  realm: RealmType;
  showHunts: boolean;
  showAlchemy: boolean;
}) {
  const url = showHunts
    ? `${RUMORS_URL}?realm=${encodeURIComponent(realm)}`
    : RUMORS_URL;
  const [summary, setSummary] = useState<HomeRumorsResponse | null>();

  useEffect(() => {
    const request = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let requesting = false;
    let nextRequestAt = 0;

    function schedule() {
      clearTimeout(timer);
      if (request.signal.aborted || requesting || document.hidden) return;
      timer = setTimeout(
        () => void refresh(),
        Math.max(0, nextRequestAt - Date.now()),
      );
    }

    async function refresh() {
      if (request.signal.aborted || requesting) return;
      requesting = true;
      try {
        const data = await fetchJsonCached<HomeRumorsResponse>(url, {
          key: url,
          signal: request.signal,
        });
        if (!request.signal.aborted) {
          setSummary(data);
          nextRequestAt = Date.now() + (data.nextRefreshAt - data.serverNow);
        }
      } catch {
        if (!request.signal.aborted) {
          setSummary(null);
          nextRequestAt = Date.now() + RETRY_MS;
        }
      } finally {
        requesting = false;
        schedule();
      }
    }

    queueMicrotask(() => void refresh());
    document.addEventListener('visibilitychange', schedule);
    return () => {
      request.abort();
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', schedule);
    };
  }, [url]);

  const target = showHunts ? summary?.hunt : undefined;

  return (
    <section>
      <HomeLabel>传闻</HomeLabel>
      {summary?.activities
        .filter(({ kind }) => kind !== 'alchemy-contest' || showAlchemy)
        .map((activity) => {
          const { title, nodeId } = activityInfo[activity.kind];
          return (
            <HomeAct
              key={activity.kind}
              href={`/game/map-v2?nodeId=${encodeURIComponent(nodeId)}`}
              lead={title}
              note={activityNote(activity)}
            />
          );
        })}
      {summary ? (
        <HomeAct lead={`云游商人在${summary.wandererLocation}。`} />
      ) : (
        <p className="text-ink-secondary py-2 text-sm">
          {summary === null
            ? '暂时无法获取云游商人的位置。'
            : '正在查看云游商人的位置…'}
        </p>
      )}
      {target && (
        <HomeAct
          href={target.href}
          lead={target.label}
          note={target.locationName}
        />
      )}
    </section>
  );
}
