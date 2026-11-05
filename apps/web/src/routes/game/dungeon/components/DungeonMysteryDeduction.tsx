import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkButton } from '@app/components/ui/InkButton';
import { InkChoiceButton } from '@app/components/ui/InkChoiceButton';
import { InkDetailDrawer } from '@app/components/ui/InkDetailDrawer';
import { cn } from '@app/lib/cn';
import { useBodyScrollLock } from '@app/lib/hooks/useBodyScrollLock';
import type {
  MysteryAnswers,
  MysteryEvidence,
  MysteryPlayerView,
} from '@daoyou/game-domain/dungeon/mystery';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import './mystery-scenes.css';
import { MysteryCaseBoard, type MysteryBoardTab } from './MysteryCaseBoard';
import {
  mysteryAnswerLabel,
  mysteryQuestionChoices,
  type MysteryQuestion,
} from './mysteryQuestions';
import { MysteryWaiting } from './MysteryWaiting';
import { useMinWidth } from './useMinWidth';
import type { MysteryNotes } from './useMysteryNotes';

interface DungeonMysteryDeductionProps {
  view: MysteryPlayerView;
  notes: MysteryNotes;
  /** 打开时停在哪道题；为空时从第一道没答的题开始。 */
  initialQuestion: string | null;
  isOpen: boolean;
  processing: boolean;
  onAnswer: (questionId: string, choiceId: string) => void;
  onToggleEvidence: (clueId: string, questionId: string) => void;
  onOpenNotebook: () => void;
  onClose: () => void;
  onSubmit: (
    answers: MysteryAnswers,
    evidence: MysteryEvidence,
  ) => Promise<void>;
}

/**
 * 推理场景：一次看一道题，案情板就在手边（宽屏并排，窄屏从底部抽屉翻），不必退出去对照。
 * 答案和证据随选随存，回到调查、刷新都不会丢；最后一页核对全部回答再提交。
 */
export function DungeonMysteryDeduction(props: DungeonMysteryDeductionProps) {
  return props.isOpen ? <DeductionScene {...props} /> : null;
}

function DeductionScene({
  view,
  notes,
  initialQuestion,
  processing,
  onAnswer,
  onToggleEvidence,
  onOpenNotebook,
  onClose,
  onSubmit,
}: DungeonMysteryDeductionProps) {
  useBodyScrollLock(true);
  const { openDialog } = useInkUI();
  const wide = useMinWidth(1024);
  const count = view.questions.length;
  const [step, setStep] = useState(() => {
    const asked = view.questions.findIndex((q) => q.id === initialQuestion);
    if (asked >= 0) return asked;
    const open = view.questions.findIndex(
      (q) => !mysteryAnswerLabel(view, q, notes.answers),
    );
    return open >= 0 ? open : count;
  });
  const [boardTab, setBoardTab] = useState<MysteryBoardTab>('clues');
  const [boardOpen, setBoardOpen] = useState(false);
  const question: MysteryQuestion | undefined = view.questions[step];
  const answered = view.questions.filter((q) =>
    mysteryAnswerLabel(view, q, notes.answers),
  ).length;
  const complete = answered === count;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !processing && !boardOpen) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [boardOpen, onClose, processing]);

  const evidenceOf = (questionId: string) =>
    view.clues.filter((c) => notes.evidence[questionId]?.includes(c.id));

  const submit = () =>
    openDialog({
      title: '确认提交推理',
      content: '提交后不能再回去调查，将按你的回答结算。确定提交吗？',
      confirmLabel: '提交',
      cancelLabel: '再想想',
      onConfirm: async () => {
        const answers: MysteryAnswers = {};
        const evidence: MysteryEvidence = {};
        for (const q of view.questions) {
          const answer = notes.answers[q.id];
          if (answer) answers[q.id] = answer;
          const clues = evidenceOf(q.id);
          if (clues.length > 0) evidence[q.id] = clues.map((c) => c.id);
        }
        await onSubmit(answers, evidence);
        onClose();
      },
    });

  const board = (
    <MysteryCaseBoard
      view={view}
      notes={notes}
      tab={boardTab}
      onTabChange={setBoardTab}
      processing={processing}
      onToggleEvidence={onToggleEvidence}
      readOnly
      activeQuestion={question}
    />
  );

  const choices = (q: MysteryQuestion) => {
    const list = mysteryQuestionChoices(view, q);
    if (list.length === 0)
      return (
        <p className="text-ink-secondary text-sm">
          {q.kind === 'clue' ? '你还没有掌握可以作答的线索。' : '暂无可选项。'}
        </p>
      );
    // 抉择题：两方对立，居中的选项（如调停）放在中轴上。
    if (q.judgement)
      return (
        <div
          className={cn(
            'grid gap-3',
            list.length >= 3 ? 'md:grid-cols-3' : 'md:grid-cols-2',
          )}
        >
          {list.map((choice) => {
            const selected = notes.answers[q.id] === choice.id;
            return (
              <button
                key={choice.id}
                type="button"
                aria-pressed={selected}
                className={cn(
                  'border px-4 py-5 text-center leading-7 transition-colors',
                  selected
                    ? 'border-crimson bg-crimson/5 text-crimson'
                    : 'border-ink/20 hover:border-ink',
                )}
                onClick={() => onAnswer(q.id, choice.id)}
              >
                {choice.label}
              </button>
            );
          })}
        </div>
      );
    return (
      <div className="flex flex-col gap-2">
        {list.map((choice) => (
          <InkChoiceButton
            key={choice.id}
            layout="card"
            selected={notes.answers[q.id] === choice.id}
            onClick={() => onAnswer(q.id, choice.id)}
          >
            {choice.label}
          </InkChoiceButton>
        ))}
      </div>
    );
  };

  const questionPage = (q: MysteryQuestion) => {
    const clues = evidenceOf(q.id);
    return (
      <section className="space-y-5">
        <div>
          <span className="text-crimson font-mono text-sm">
            第{step + 1}题{q.judgement ? ' · 抉择' : ''}
          </span>
          <h3 className="mt-1 text-xl font-semibold">{q.prompt}</h3>
          {q.judgement ? (
            <p className="text-ink-secondary mt-1 text-sm">
              这是你的抉择，不分对错，会决定此事的结局和最后的对手。
            </p>
          ) : null}
        </div>
        {choices(q)}
        <div className="border-ink/15 space-y-2 border-t border-dashed pt-4 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-ink-secondary">证据（选填）</span>
            {clues.length === 0 ? (
              <span className="text-ink-secondary">
                {wide
                  ? '在右边的线索上点“作为本题证据”'
                  : '打开案情板时可以选上'}
              </span>
            ) : (
              clues.map((clue) => (
                <button
                  key={clue.id}
                  type="button"
                  aria-label={`移除证据${clue.name}`}
                  className="border-ink/30 hover:text-crimson border-l-2 px-2 py-0.5"
                  onClick={() => onToggleEvidence(clue.id, q.id)}
                >
                  {clue.name} ×
                </button>
              ))
            )}
          </div>
        </div>
      </section>
    );
  };

  const missingEvidence = view.questions.filter(
    (q) => !q.judgement && evidenceOf(q.id).length === 0,
  ).length;

  const reviewPage = (
    <section className="space-y-4">
      <h3 className="text-xl font-semibold">核对你的回答</h3>
      {view.questions.map((q, index) => {
        const label = mysteryAnswerLabel(view, q, notes.answers);
        const clues = evidenceOf(q.id);
        return (
          <button
            key={q.id}
            type="button"
            className="border-ink/20 hover:border-ink block w-full border px-4 py-3 text-left"
            onClick={() => setStep(index)}
          >
            <div className="text-ink-secondary text-sm">{q.prompt}</div>
            <div className={cn('font-semibold', !label && 'text-crimson')}>
              {label ?? '还没有作答'}
            </div>
            {clues.length > 0 ? (
              <div className="text-ink-secondary mt-1 text-sm">
                证据：{clues.map((c) => c.name).join('、')}
              </div>
            ) : null}
          </button>
        );
      })}
      <p className="text-ink-secondary text-sm leading-7">
        提交后调查结束，按答对的题结算。答对还要有线索能证明才得满分。
        {missingEvidence > 0
          ? `还有 ${missingEvidence} 道题没选证据，选对能多得线索分。`
          : ''}
        {view.confrontation ? '答对关键题后对手可能动手，打赢才能拿满分。' : ''}
      </p>
    </section>
  );

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="提交推理"
      className="mystery-scene bg-paper fixed inset-0 z-50 overflow-y-auto"
    >
      <div
        className={cn(
          'mx-auto min-h-full px-4 md:px-8',
          wide
            ? 'grid max-w-6xl grid-cols-[minmax(0,1fr)_24rem] items-start gap-10'
            : 'flex max-w-3xl flex-col',
        )}
      >
        <div className="flex min-h-dvh flex-col gap-5 pt-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-ink-secondary text-sm">{view.title}</div>
              <h2 className="text-xl font-semibold">提交推理</h2>
            </div>
            <InkButton variant="ghost" disabled={processing} onClick={onClose}>
              回到调查
            </InkButton>
          </div>

          <nav aria-label="题目" className="flex flex-wrap gap-2 text-sm">
            {view.questions.map((q, index) => (
              <button
                key={q.id}
                type="button"
                aria-current={step === index ? 'step' : undefined}
                className={cn(
                  'border px-2 py-1 sm:px-3',
                  step === index
                    ? 'border-crimson text-crimson'
                    : 'border-ink/20 hover:border-ink',
                )}
                onClick={() => setStep(index)}
              >
                第{index + 1}题
                {mysteryAnswerLabel(view, q, notes.answers) ? ' ✓' : ''}
              </button>
            ))}
            <button
              type="button"
              aria-current={step === count ? 'step' : undefined}
              className={cn(
                'border px-2 py-1 sm:px-3',
                step === count
                  ? 'border-crimson text-crimson'
                  : 'border-ink/20 hover:border-ink',
              )}
              onClick={() => setStep(count)}
            >
              核对提交
            </button>
          </nav>

          <MysteryWaiting active={processing} kind="deduce" />

          {question ? questionPage(question) : reviewPage}

          <div className="bg-paper border-ink/15 sticky bottom-0 mt-auto flex flex-wrap items-center justify-between gap-x-2 gap-y-1 border-t py-3">
            <div className="flex w-full items-center gap-2 lg:w-auto">
              <span className="text-ink-secondary text-sm whitespace-nowrap">
                已作答 <span className="font-mono">{answered}</span> /{' '}
                <span className="font-mono">{count}</span>
              </span>
              {wide ? null : (
                <>
                  <InkButton
                    variant="outline"
                    onClick={() => setBoardOpen(true)}
                  >
                    案情板
                  </InkButton>
                  <InkButton variant="secondary" onClick={onOpenNotebook}>
                    笔记
                  </InkButton>
                </>
              )}
            </div>
            <div className="ml-auto flex items-center gap-2">
              {step > 0 ? (
                <InkButton
                  variant="secondary"
                  onClick={() => setStep((s) => s - 1)}
                >
                  上一题
                </InkButton>
              ) : null}
              {question ? (
                <InkButton
                  variant="primary"
                  onClick={() => setStep((s) => s + 1)}
                >
                  {step === count - 1 ? '去核对' : '下一题'}
                </InkButton>
              ) : (
                <InkButton
                  variant="primary"
                  disabled={!complete || processing}
                  pending={processing}
                  pendingLabel="推演中……"
                  onClick={submit}
                >
                  提交推理
                </InkButton>
              )}
            </div>
          </div>
        </div>

        {wide ? (
          <aside className="border-ink/15 sticky top-0 max-h-dvh overflow-y-auto border-l border-dashed py-6 pl-6">
            {board}
          </aside>
        ) : null}
      </div>

      <InkDetailDrawer
        isOpen={!wide && boardOpen}
        onClose={() => setBoardOpen(false)}
        size="md"
        title="案情板"
        description={
          question ? question.prompt : '线索、人物、地点与调查经过。'
        }
      >
        {board}
      </InkDetailDrawer>
    </div>,
    document.body,
  );
}
