import { InkButton } from '@app/components/ui/InkButton';
import { InkTag } from '@app/components/ui/InkTag';
import type { MysteryPlayerView } from '@daoyou/game-domain/dungeon/mystery';
import { mysteryAnswerLabel } from './mysteryQuestions';
import type { MysteryNotes } from './useMysteryNotes';

interface MysteryBriefProps {
  view: MysteryPlayerView;
  notes: MysteryNotes;
  onAnswer: (questionId: string) => void;
}

/** 宽屏右栏的“此行”：身份和目标各最多两行，每道题一行，完整内容在案情板。 */
export function MysteryBriefCompact({
  view,
  notes,
  onAnswer,
}: MysteryBriefProps) {
  return (
    <div className="space-y-2 text-sm leading-6">
      <p className="line-clamp-2" title={view.brief.identity}>
        <span className="text-ink-secondary">身份 </span>
        {view.brief.identity}
      </p>
      <p className="line-clamp-2" title={view.brief.goal}>
        <span className="text-ink-secondary">目标 </span>
        {view.brief.goal}
      </p>
      <ul className="space-y-1">
        {view.questions.map((question) => {
          const label = mysteryAnswerLabel(view, question, notes.answers);
          return (
            <li key={question.id}>
              <button
                type="button"
                title={label ? `${question.prompt}：${label}` : question.prompt}
                className="hover:text-crimson flex w-full items-baseline justify-between gap-2 text-left"
                onClick={() => onAnswer(question.id)}
              >
                <span className="min-w-0 truncate underline decoration-dotted underline-offset-4">
                  {question.prompt}
                </span>
                <span className="text-ink-secondary shrink-0 text-xs">
                  {label
                    ? '已作答'
                    : question.judgement
                      ? '抉择'
                      : question.supported
                        ? '有依据'
                        : '无依据'}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** 此行：你是谁、来做什么、要查明什么。开局看过之后也一直在手边。 */
export function MysteryBrief({ view, notes, onAnswer }: MysteryBriefProps) {
  return (
    <div className="space-y-4 text-sm leading-7">
      <div className="space-y-2">
        <p>
          <span className="text-ink-secondary">身份 </span>
          {view.brief.identity}
        </p>
        <p>
          <span className="text-ink-secondary">目标 </span>
          {view.brief.goal}
        </p>
      </div>
      <div className="space-y-3">
        <div className="text-ink-secondary">要查明</div>
        {view.questions.map((question) => {
          const label = mysteryAnswerLabel(view, question, notes.answers);
          return (
            <div
              key={question.id}
              className="border-ink/20 space-y-1 border-l-2 pl-3"
            >
              <button
                type="button"
                className="hover:text-crimson text-left font-semibold underline decoration-dotted underline-offset-4"
                onClick={() => onAnswer(question.id)}
              >
                {question.prompt}
              </button>
              <div className="flex flex-wrap items-center gap-2">
                {question.judgement ? (
                  <InkTag tone="info">你的抉择</InkTag>
                ) : (
                  <InkTag tone={question.supported ? 'good' : 'neutral'}>
                    {question.supported ? '已有依据' : '尚无依据'}
                  </InkTag>
                )}
                <span className="text-ink-secondary">
                  {label ? `草稿：${label}` : '还没想好'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      <InkButton variant="secondary" onClick={() => onAnswer('')}>
        整理答案
      </InkButton>
    </div>
  );
}
