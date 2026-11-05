import { InkButton } from '@app/components/ui/InkButton';
import { cn } from '@app/lib/cn';
import type { MysteryPlayerView } from '@daoyou/game-domain/dungeon/mystery';

/** 开局一幕：正式进入故事之前，先交代这一局你是谁、来做什么、要查明什么。 */
export function MysteryIntro({
  view,
  sceneUrl,
  onStart,
}: {
  view: MysteryPlayerView;
  sceneUrl?: string;
  onStart: () => void;
}) {
  return (
    <div className="mx-auto flex min-h-[70dvh] w-full max-w-2xl flex-col gap-6">
      <div
        className={cn(
          'flex items-center justify-center',
          sceneUrl
            ? 'aspect-[2/1] [mask-image:linear-gradient(to_bottom,transparent,black_18%)] bg-cover bg-bottom'
            : 'py-6',
        )}
        style={sceneUrl ? { backgroundImage: `url(${sceneUrl})` } : undefined}
      >
        <div className="text-center">
          <h2 className="text-2xl font-semibold tracking-[0.2em]">
            {view.title}
          </h2>
          <p className="text-ink-secondary mt-1 text-sm">{view.templateName}</p>
        </div>
      </div>

      <section className="space-y-1">
        <h3 className="text-ink-secondary text-sm">你的身份</h3>
        <p className="text-lg leading-8">{view.brief.identity}</p>
      </section>

      <section className="space-y-1">
        <h3 className="text-ink-secondary text-sm">此行目标</h3>
        <p className="text-lg leading-8">{view.brief.goal}</p>
      </section>

      <section className="space-y-2">
        <h3 className="text-ink-secondary text-sm">
          你要查明这几件事，最后逐一作答
        </h3>
        <ol className="space-y-2">
          {view.questions.map((question, index) => (
            <li key={question.id} className="flex gap-3 leading-7">
              <span className="text-crimson font-mono">{index + 1}</span>
              <span>{question.prompt}</span>
            </li>
          ))}
        </ol>
      </section>

      <p className="text-ink-secondary border-ink/15 border-t border-dashed pt-4 text-sm leading-7">
        第一次进入一处地方、调查物件、继续追问都要耗行动力；回到去过的地方、和每个人的第一次交谈不耗。提示每局{' '}
        <span className="font-mono">{view.hintsLeft}</span> 次，也不耗行动力。
      </p>

      <InkButton variant="primary" className="self-center" onClick={onStart}>
        开始调查
      </InkButton>
    </div>
  );
}
