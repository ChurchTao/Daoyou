import { InkButton } from '@app/components/ui/InkButton';
import type { SectCombatPathView } from '@daoyou/game-domain/sects';

export function SectPathChoice({
  paths,
  pending,
  disabled = false,
  onChoose,
}: {
  paths: SectCombatPathView[];
  pending: boolean;
  disabled?: boolean;
  onChoose: (pathId: string) => void;
}) {
  return (
    <div data-guide="sect.path-choice" className="space-y-4">
      <p className="text-ink-secondary text-sm leading-7">
        两流派共用六心法，可免费切换，经脉方案分别保留。
      </p>
      <div className="grid gap-5 md:grid-cols-2" aria-label="宗门流派">
        {paths.map((path) => (
          <section
            key={path.id}
            className="border-ink/10 flex flex-col items-start border-b pb-4"
          >
            <h3 className="font-medium">{path.name}</h3>
            <p className="text-ink-secondary mt-2 flex-1 text-sm leading-7">
              {path.description}
            </p>
            <InkButton
              variant="primary"
              className="focus-visible:outline-crimson/60 mt-3 min-h-11 focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none"
              pending={pending}
              pendingLabel="启用中……"
              disabled={disabled}
              onClick={() => onChoose(path.id)}
            >
              启用{path.name}
            </InkButton>
          </section>
        ))}
      </div>
    </div>
  );
}
