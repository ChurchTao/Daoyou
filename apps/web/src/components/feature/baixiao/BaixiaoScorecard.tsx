import {
  BAIXIAO_FOCUS_PENALTY_MS,
  type BaixiaoScore,
} from '@daoyou/game-domain/baixiao/meet';

import { baixiaoTime } from './time';

export function BaixiaoScorecard({
  score,
  showTotal = true,
}: {
  score: BaixiaoScore;
  showTotal?: boolean;
}) {
  const focusPenalties = score.focusPenalties ?? 0;
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
            答错 {score.wrong} · 超时 {score.timeout}
            {score.focus > 0 && ` · 失焦 ${score.focus}`}
          </dd>
        </>
      )}
      {focusPenalties > 0 && (
        <>
          <dt>失焦罚时</dt>
          <dd className="font-mono">
            {focusPenalties} 次 · +
            {(focusPenalties * BAIXIAO_FOCUS_PENALTY_MS) / 1000} 秒
          </dd>
        </>
      )}
      {showTotal && (
        <>
          <dt className="font-semibold">总用时</dt>
          <dd className="font-mono font-semibold">
            {baixiaoTime(score.totalMs)}
          </dd>
        </>
      )}
    </dl>
  );
}
