import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkButton } from '@app/components/ui/InkButton';
import { InkChoiceButton } from '@app/components/ui/InkChoiceButton';
import { InkDetailDrawer } from '@app/components/ui/InkDetailDrawer';
import type {
  MysteryAnswers,
  MysteryPlayerView,
} from '@daoyou/game-domain/dungeon/mystery';
import { useState } from 'react';

interface DungeonMysteryDeductionProps {
  view: MysteryPlayerView;
  isOpen: boolean;
  processing: boolean;
  onClose: () => void;
  onSubmit: (answers: MysteryAnswers) => Promise<void>;
}

/** 结案：人物题从已结识的人物中选，线索题只能用已掌握的线索作答。 */
export function DungeonMysteryDeduction({
  view,
  isOpen,
  processing,
  onClose,
  onSubmit,
}: DungeonMysteryDeductionProps) {
  const { openDialog } = useInkUI();
  const [answers, setAnswers] = useState<MysteryAnswers>({});
  const complete = view.questions.every((q) => answers[q.id]);

  const choicesFor = (question: MysteryPlayerView['questions'][number]) => {
    if (question.kind === 'npc')
      return view.knownNpcs.map((npc) => ({ id: npc.id, label: npc.name }));
    if (question.kind === 'clue')
      return view.clues.map((clue) => ({ id: clue.id, label: clue.name }));
    return question.options ?? [];
  };

  return (
    <InkDetailDrawer
      isOpen={isOpen}
      onClose={onClose}
      title="结案推理"
      description={
        view.confrontation
          ? '结案后不能再调查。指认真凶后对方可能负隅顽抗，擒下方得全功。推断越准确、线索越完整，所得越丰厚。'
          : '结案后不能再调查。推断越准确、线索越完整，所得越丰厚。'
      }
      footer={
        <InkButton
          variant="primary"
          disabled={!complete || processing}
          pending={processing}
          pendingLabel="推演中……"
          onClick={() =>
            openDialog({
              title: '确认结案',
              content: '结案后不能再回头调查。确定提交推断吗？',
              confirmLabel: '提交推断',
              cancelLabel: '再想想',
              onConfirm: async () => {
                await onSubmit(answers);
                onClose();
              },
            })
          }
        >
          提交推断
        </InkButton>
      }
    >
      <div className="space-y-5">
        {view.questions.map((question) => {
          const choices = choicesFor(question);
          return (
            <div key={question.id}>
              <div className="mb-2 font-semibold">{question.prompt}</div>
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
                      onClick={() =>
                        setAnswers((prev) => ({
                          ...prev,
                          [question.id]: choice.id,
                        }))
                      }
                    >
                      {choice.label}
                    </InkChoiceButton>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </InkDetailDrawer>
  );
}
