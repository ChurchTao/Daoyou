import { BaixiaoQuestionOptions } from '@app/components/feature/baixiao/BaixiaoTurn';
import {
  categoryLabels,
  difficultyLabels,
} from '@app/components/feature/baixiao/questionLabels';
import { InkButton, InkNotice } from '@app/components/ui';
import type { BaixiaoPracticeQuestion } from '@daoyou/contracts/baixiao/meet';
import { useEffect, useRef, useState } from 'react';
import { AdminDialog } from '../_components/AdminDialog';

export function BaixiaoPractice({
  loadPaper,
  open,
  onClose,
}: {
  loadPaper: () => Promise<BaixiaoPracticeQuestion[]>;
  open: boolean;
  onClose: () => void;
}) {
  const [paper, setPaper] = useState<BaixiaoPracticeQuestion[]>([]);
  const [drawing, setDrawing] = useState(false);
  const [position, setPosition] = useState(0);
  const [correct, setCorrect] = useState<boolean | null>(null);
  const [error, setError] = useState('');
  const question = paper[position];
  const stage = useRef<HTMLDivElement>(null);
  const feedback = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    if (correct === null) stage.current?.scrollIntoView({ block: 'start' });
    else feedback.current?.scrollIntoView({ block: 'nearest' });
  }, [open, correct, question]);

  async function drawPaper() {
    setDrawing(true);
    setError('');
    try {
      setPaper(await loadPaper());
      setPosition(0);
      setCorrect(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '试玩抽卷失败。');
    } finally {
      setDrawing(false);
    }
  }

  return (
    <AdminDialog
      open={open}
      onClose={onClose}
      title="答题试玩器"
      wide
      busy={drawing}
      footer={
        <>
          <InkButton
            variant={question ? 'secondary' : 'primary'}
            className="min-h-11"
            pending={drawing}
            pendingLabel="正在抽卷…"
            onClick={() => void drawPaper()}
          >
            {paper.length ? '重新抽卷' : '开始试玩'}
          </InkButton>
          {question && correct !== null && (
            <InkButton
              variant="primary"
              className="min-h-11"
              disabled={drawing}
              onClick={() => {
                setPosition(position + 1);
                setCorrect(null);
              }}
            >
              {position + 1 === paper.length ? '完成试玩' : '下一题'}
            </InkButton>
          )}
        </>
      }
    >
      {error && (
        <div role="alert" className="mb-3">
          <InkNotice tone="warning">{error}</InkNotice>
        </div>
      )}
      {question ? (
        <div className="mx-auto max-w-2xl" ref={stage}>
          <div className="text-ink-secondary mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm">
            <p>
              第{' '}
              <b className="font-mono">
                {position + 1}/{paper.length}
              </b>{' '}
              题
            </p>
            <p>
              {categoryLabels[question.category]} · 难度{' '}
              {difficultyLabels[question.difficulty]}
            </p>
          </div>
          <div className="baixiao-question" key={question.id}>
            <BaixiaoQuestionOptions
              question={question}
              disabled={drawing || correct !== null}
              onAnswer={(option) => setCorrect(option === question.correct)}
            />
          </div>
          {correct !== null && (
            <div
              role="status"
              ref={feedback}
              className="bg-paper-2 mt-4 space-y-1 border-l-2 p-3"
            >
              <p
                className={
                  correct
                    ? 'text-teal font-semibold'
                    : 'text-crimson font-semibold'
                }
              >
                {correct ? '答对' : '答错'}
              </p>
              {!correct && (
                <dl className="flex flex-wrap gap-x-2 text-sm">
                  <dt className="text-ink-secondary">正确答案</dt>
                  <dd className="font-semibold">
                    {question.options[question.correct]}
                  </dd>
                </dl>
              )}
            </div>
          )}
        </div>
      ) : (
        <p role={paper.length ? 'status' : undefined}>
          {paper.length ? '本卷已答完。' : '按正式配额从当前启用题库抽题。'}
        </p>
      )}
    </AdminDialog>
  );
}
