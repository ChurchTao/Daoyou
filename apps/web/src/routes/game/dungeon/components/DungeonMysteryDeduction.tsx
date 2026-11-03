import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkButton } from '@app/components/ui/InkButton';
import { InkChoiceButton } from '@app/components/ui/InkChoiceButton';
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
import { MysteryWaiting } from './MysteryWaiting';

type Question = MysteryPlayerView['questions'][number];

interface DungeonMysteryDeductionProps {
  view: MysteryPlayerView;
  /** 玩家作为证据的线索归属哪道题：clueId → questionId。 */
  pins: Record<string, string>;
  isOpen: boolean;
  processing: boolean;
  onPin: (clueId: string, questionId: string | null) => void;
  onClose: () => void;
  onSubmit: (
    answers: MysteryAnswers,
    evidence: MysteryEvidence,
  ) => Promise<void>;
}

/**
 * 推理场景：整屏切换，每道题一张签，上方是作为证据的线索（可在此直接增删），
 * 下方作答；抉择题画成两方对立的卷轴，注明不分对错。
 */
export function DungeonMysteryDeduction(props: DungeonMysteryDeductionProps) {
  return props.isOpen ? <DeductionScene {...props} /> : null;
}

function DeductionScene({
  view,
  pins,
  processing,
  onPin,
  onClose,
  onSubmit,
}: DungeonMysteryDeductionProps) {
  useBodyScrollLock(true);
  const { openDialog } = useInkUI();
  const [answers, setAnswers] = useState<MysteryAnswers>({});
  const [pinning, setPinning] = useState<string | null>(null);
  const answered = view.questions.filter((q) => answers[q.id]).length;
  const complete = answered === view.questions.length;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !processing) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, processing]);

  const choicesFor = (question: Question) => {
    if (question.kind === 'npc')
      return view.knownNpcs.map((npc) => ({ id: npc.id, label: npc.name }));
    if (question.kind === 'clue')
      return view.clues.map((clue) => ({ id: clue.id, label: clue.name }));
    return question.options ?? [];
  };

  const choose = (questionId: string, choiceId: string) =>
    setAnswers((prev) => ({ ...prev, [questionId]: choiceId }));

  const submit = () =>
    openDialog({
      title: '确认提交推理',
      content: '提交后不能再回去调查，将按你的回答结算。确定提交吗？',
      confirmLabel: '提交',
      cancelLabel: '再想想',
      onConfirm: async () => {
        // 把本机记下的证据按题整理后一并提交，每题最多 5 条。
        const evidence: MysteryEvidence = {};
        for (const clue of view.clues) {
          const questionId = pins[clue.id];
          if (!questionId) continue;
          const list = (evidence[questionId] ??= []);
          if (list.length < 5) list.push(clue.id);
        }
        await onSubmit(answers, evidence);
        onClose();
      },
    });

  const evidence = (question: Question) => {
    const pinned = view.clues.filter((c) => pins[c.id] === question.id);
    const open = pinning === question.id;
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-ink-secondary">证据</span>
          {pinned.length === 0 ? (
            <span className="text-ink-secondary">还没有选证据</span>
          ) : (
            pinned.map((clue) => (
              <span
                key={clue.id}
                className="border-ink/30 border-l-2 px-2 py-0.5"
              >
                {clue.name}
              </span>
            ))
          )}
          {view.clues.length > 0 ? (
            <button
              type="button"
              className="text-ink-secondary hover:text-ink underline decoration-dotted underline-offset-4"
              onClick={() => setPinning(open ? null : question.id)}
            >
              {open ? '收起' : '选择证据'}
            </button>
          ) : null}
        </div>
        {open ? (
          <div className="bg-ink/5 flex flex-wrap gap-2 p-3">
            {view.clues.map((clue) => {
              const here = pins[clue.id] === question.id;
              const elsewhere = view.questions.find(
                (q) => q.id !== question.id && pins[clue.id] === q.id,
              );
              return (
                <InkChoiceButton
                  key={clue.id}
                  selected={here}
                  onClick={() => onPin(clue.id, here ? null : question.id)}
                >
                  {clue.name}
                  {elsewhere ? (
                    <span className="text-ink-secondary ml-1 text-xs">
                      （已用于别题）
                    </span>
                  ) : null}
                </InkChoiceButton>
              );
            })}
          </div>
        ) : null}
      </div>
    );
  };

  const questionCard = (question: Question, index: number) => {
    const choices = choicesFor(question);
    return (
      <section
        key={question.id}
        className="border-ink/20 bg-paper space-y-4 border p-5"
      >
        <div className="flex items-baseline gap-3">
          <span className="text-crimson font-mono text-sm">
            第{index + 1}题
          </span>
          <h3 className="text-lg font-semibold">{question.prompt}</h3>
        </div>
        {evidence(question)}
        {choices.length === 0 ? (
          <p className="text-ink-secondary text-sm">
            {question.kind === 'clue'
              ? '你还没有掌握可以作答的线索。'
              : '暂无可选项。'}
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {choices.map((choice) => (
              <InkChoiceButton
                key={choice.id}
                selected={answers[question.id] === choice.id}
                onClick={() => choose(question.id, choice.id)}
              >
                {choice.label}
              </InkChoiceButton>
            ))}
          </div>
        )}
      </section>
    );
  };

  // 抉择题：两方对立的卷轴，居中的选项（如调停）放在中轴上。
  const judgementScroll = (question: Question, index: number) => {
    const choices = choicesFor(question);
    return (
      <section
        key={question.id}
        className="border-crimson/50 bg-paper space-y-4 border-y-4 px-5 py-6"
      >
        <div className="text-center">
          <span className="text-crimson font-mono text-sm">
            第{index + 1}题 · 抉择
          </span>
          <h3 className="mt-1 text-lg font-semibold">{question.prompt}</h3>
          <p className="text-ink-secondary mt-1 text-sm">
            这是你的抉择，不分对错，会决定此事的结局和最后的对手。
          </p>
        </div>
        {evidence(question)}
        <div
          className={cn(
            'grid gap-3',
            choices.length >= 3 ? 'md:grid-cols-3' : 'md:grid-cols-2',
          )}
        >
          {choices.map((choice) => {
            const selected = answers[question.id] === choice.id;
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
                onClick={() => choose(question.id, choice.id)}
              >
                {choice.label}
              </button>
            );
          })}
        </div>
      </section>
    );
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="提交推理"
      className="mystery-scene bg-paper fixed inset-0 z-50 overflow-y-auto"
    >
      <div className="mx-auto flex min-h-full max-w-3xl flex-col gap-6 px-4 pt-6 md:px-8">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-ink-secondary text-sm">{view.title}</div>
            <h2 className="text-xl font-semibold">提交推理</h2>
            <p className="text-ink-secondary mt-1 text-sm leading-7">
              提交后调查结束，按答对的题结算。答对还要有线索能证明才得满分；给每道题选上能证明它的线索作为证据，还能多得线索分。
              {view.confrontation
                ? '答对关键题后对手可能动手，打赢才能拿满分。'
                : ''}
            </p>
          </div>
          <InkButton variant="ghost" disabled={processing} onClick={onClose}>
            回到调查
          </InkButton>
        </div>

        <MysteryWaiting active={processing} kind="deduce" />

        {view.questions.map((question, index) =>
          question.judgement
            ? judgementScroll(question, index)
            : questionCard(question, index),
        )}

        <div className="bg-paper border-ink/15 sticky bottom-0 mt-auto flex items-center justify-between gap-3 border-t py-3">
          <span className="text-ink-secondary text-sm">
            已作答 <span className="font-mono">{answered}</span> /{' '}
            <span className="font-mono">{view.questions.length}</span>
          </span>
          <InkButton
            variant="primary"
            disabled={!complete || processing}
            pending={processing}
            pendingLabel="推演中……"
            onClick={submit}
          >
            提交推理
          </InkButton>
        </div>
      </div>
    </div>,
    document.body,
  );
}
