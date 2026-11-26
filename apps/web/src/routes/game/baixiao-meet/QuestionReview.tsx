import {
  categoryLabels,
  difficultyLabels,
} from '@app/components/feature/baixiao/questionLabels';
import { baixiaoTime } from '@app/components/feature/baixiao/time';
import type { BaixiaoQuestionReview } from '@daoyou/contracts/baixiao/meet';
import { BAIXIAO_PENALTY_MS } from '@daoyou/game-domain/baixiao/meet';
import { useEffect, useRef } from 'react';

const outcomes = {
  wrong: '本题未答对',
  timeout: '本题超时',
  focus: '本题因失焦判错',
};

export function QuestionMetadata({
  question,
}: {
  question: Pick<BaixiaoQuestionReview, 'category' | 'difficulty'>;
}) {
  return (
    <p className="baixiao-question-meta">
      {categoryLabels[question.category]} <span aria-hidden="true">·</span> 难度{' '}
      {difficultyLabels[question.difficulty]}
    </p>
  );
}

export function QuestionReview({
  review,
  totalMs,
}: {
  review: BaixiaoQuestionReview;
  totalMs: number;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus({ preventScroll: true }), []);
  return (
    <div className="baixiao-question baixiao-review">
      <div className="baixiao-review-outcome">
        <h2 tabIndex={-1} ref={heading}>
          {outcomes[review.verdict]}
        </h2>
        <p>
          罚时 <b className="font-mono">+{BAIXIAO_PENALTY_MS / 1000}</b> 秒{' '}
          <span aria-hidden="true">·</span> 累计用时{' '}
          <b className="font-mono">{baixiaoTime(totalMs)}</b>
        </p>
      </div>
      <QuestionMetadata question={review} />
      <p className="baixiao-review-prompt">{review.prompt}</p>
      <dl>
        <div className="baixiao-review-answer">
          <dt>正确答案</dt>
          <dd>{review.answer}</dd>
        </div>
        <div>
          <dt>解析</dt>
          <dd>{review.explanation}</dd>
        </div>
      </dl>
    </div>
  );
}
