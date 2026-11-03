import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkButton } from '@app/components/ui/InkButton';
import { InkChoiceButton } from '@app/components/ui/InkChoiceButton';
import { InkDetailDrawer } from '@app/components/ui/InkDetailDrawer';
import type {
  MysteryAnswers,
  MysteryPlayerView,
} from '@daoyou/game-domain/dungeon/mystery';
import { useState } from 'react';
import { MysteryWaiting } from './MysteryWaiting';

interface DungeonMysteryDeductionProps {
  view: MysteryPlayerView;
  /** 玩家在案情板上把线索钉到的问题：clueId → questionId。 */
  pins: Record<string, string>;
  isOpen: boolean;
  processing: boolean;
  onClose: () => void;
  onSubmit: (answers: MysteryAnswers) => Promise<void>;
}

/**
 * 结案：人物题从已结识的人物中选，线索题只能用已掌握的线索作答；
 * 每题上方列出玩家在案情板上钉下的依据，没钉也可以直接作答。
 */
export function DungeonMysteryDeduction({
  view,
  pins,
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
      title="提交推理"
      description={
        view.confrontation
          ? '提交后调查结束，按答对的题结算，答得越准、线索越全奖励越好。答对关键题后对手可能动手，打赢才能拿满分。'
          : '提交后调查结束，按答对的题结算，答得越准、线索越全奖励越好。'
      }
      footer={
        <InkButton
          variant="primary"
          disabled={!complete || processing}
          pending={processing}
          pendingLabel="推演中……"
          onClick={() =>
            openDialog({
              title: '确认提交推理',
              content: '提交后不能再回去调查，将按你的回答结算。确定提交吗？',
              confirmLabel: '提交',
              cancelLabel: '再想想',
              onConfirm: async () => {
                await onSubmit(answers);
                onClose();
              },
            })
          }
        >
          提交推理
        </InkButton>
      }
    >
      <div className="space-y-5">
        <MysteryWaiting active={processing} kind="deduce" />
        {view.questions.map((question) => {
          const choices = choicesFor(question);
          return (
            <div key={question.id}>
              <div className="mb-1 font-semibold">{question.prompt}</div>
              <p className="text-ink-secondary mb-2 text-sm">
                {(() => {
                  if (question.judgement)
                    return '此题没有对错，你的抉择决定此事的结局。';
                  const pinned = view.clues.filter(
                    (c) => pins[c.id] === question.id,
                  );
                  return pinned.length > 0
                    ? `你的依据：${pinned.map((c) => c.name).join('、')}`
                    : '还没有钉上线索（可在案情板的线索页钉到此题）';
                })()}
              </p>
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
