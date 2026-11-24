import type { BaixiaoScore } from '@daoyou/game-domain/baixiao/meet';

import { baixiaoTime } from './time';

export function BaixiaoScorecard({ score }: { score: BaixiaoScore }) {
  return (
    <dl className="grid grid-cols-[1fr_auto] gap-x-5 gap-y-2 text-sm">
      <dt>答对</dt>
      <dd className="font-mono">{score.correct} / 25</dd>
      <dt>作答计时</dt>
      <dd className="font-mono">{baixiaoTime(score.elapsedMs)}</dd>
      <dt>罚时</dt>
      <dd className="font-mono">+{score.penaltyMs / 1000} 秒</dd>
      {score.mistakes > 0 && (
        <>
          <dt>失误明细</dt>
          <dd>
            答错 {score.wrong} · 超时 {score.timeout} · 失焦 {score.focus}
          </dd>
        </>
      )}
      <dt className="font-semibold">总用时</dt>
      <dd className="font-mono font-semibold">{baixiaoTime(score.totalMs)}</dd>
    </dl>
  );
}
