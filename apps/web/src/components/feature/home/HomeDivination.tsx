import { getDivination } from '@app/lib/divinationApi';
import type { DivinationView } from '@daoyou/contracts/divination';
import { useEffect, useState } from 'react';
import { HomeAct } from './HomeAct';

export function HomeDivination() {
  const [view, setView] = useState<DivinationView>();
  useEffect(() => {
    const request = new AbortController();
    void getDivination(request.signal)
      .then((status) => {
        if (!request.signal.aborted) setView(status);
      })
      .catch(() => undefined);
    return () => request.abort();
  }, []);

  let note;
  if (view?.canDraw) note = '今日未占卜';
  else if (view?.record?.rewardGranted) note = '今日已完成';
  else if (view?.record?.interpretation) note = '奖励待领取';
  else if (view?.record) note = '待解签';

  return <HomeAct href="/game/divination" lead="每日占卜" note={note} />;
}
