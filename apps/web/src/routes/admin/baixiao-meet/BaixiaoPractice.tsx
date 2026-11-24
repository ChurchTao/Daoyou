import { BaixiaoQuestionOptions } from '@app/components/feature/baixiao/BaixiaoTurn';
import { InkButton, InkNotice } from '@app/components/ui';
import type { BaixiaoAdminView } from '@daoyou/contracts/baixiao/meet';
import type { BaixiaoBankQuestion } from '@daoyou/game-domain/baixiao/meet';
import { createBaixiaoPaper } from '@daoyou/game-rules/baixiao/meet';
import { useState } from 'react';

type PracticeQuestion = Pick<
  BaixiaoBankQuestion,
  'id' | 'prompt' | 'kind' | 'options' | 'correct'
>;

export function BaixiaoPractice({ bank }: { bank: BaixiaoAdminView['bank'] }) {
  const [paper, setPaper] = useState<PracticeQuestion[]>([]);
  const [position, setPosition] = useState(0);
  const [correct, setCorrect] = useState<boolean | null>(null);
  const [error, setError] = useState('');
  const question = paper[position];

  function drawPaper() {
    const enabled = bank.filter((question) => question.status === 'published');
    const slots = createBaixiaoPaper(enabled, (size) =>
      Math.floor(Math.random() * size),
    );
    if (!slots) {
      setError('启用题目未达到正式组卷配额。');
      return;
    }
    const byId = new Map(enabled.map((item) => [item.id, item]));
    setPaper(
      slots.map(({ questionId, order }) => {
        const { id, prompt, kind, options, correct } = byId.get(questionId)!;
        return {
          id,
          prompt,
          kind,
          options: order.map((index) => options[index]),
          correct: order.indexOf(correct),
        };
      }),
    );
    setPosition(0);
    setCorrect(null);
    setError('');
  }

  return (
    <section
      className="border-ink/20 space-y-4 border-b pb-5"
      aria-label="答题试玩器"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">答题试玩器</h2>
          <p className="text-ink-secondary text-sm">
            按正式配额从当前启用题库抽题。
          </p>
        </div>
        <InkButton onClick={drawPaper}>
          {paper.length ? '重新抽卷' : '开始试玩'}
        </InkButton>
      </div>
      {error && <InkNotice>{error}</InkNotice>}
      {question ? (
        <div className="border-ink/15 bg-sheet mx-auto max-w-2xl border p-4 sm:p-6">
          <p className="text-ink-secondary mb-3 text-sm">
            第{' '}
            <span className="font-mono">
              {position + 1}/{paper.length}
            </span>{' '}
            题
          </p>
          <div className="baixiao-question" key={question.id}>
            <BaixiaoQuestionOptions
              question={question}
              disabled={correct !== null}
              onAnswer={(option) => setCorrect(option === question.correct)}
            />
          </div>
          {correct !== null && (
            <div className="mt-4 flex items-center justify-between gap-3">
              <p
                role="status"
                className={
                  correct
                    ? 'text-teal font-semibold'
                    : 'text-crimson font-semibold'
                }
              >
                {correct ? '答对' : '答错'}
              </p>
              <InkButton
                onClick={() => {
                  setPosition(position + 1);
                  setCorrect(null);
                }}
              >
                {position + 1 === paper.length ? '完成试玩' : '下一题'}
              </InkButton>
            </div>
          )}
        </div>
      ) : (
        paper.length > 0 && <p role="status">本卷已答完。</p>
      )}
    </section>
  );
}
