import { InkButton } from '@app/components/ui/InkButton';
import { cn } from '@shared/lib/cn';
import type { TaskInstance } from '@shared/types/task';
import { TaskObjectiveRow } from './TaskObjectiveRow';

function StatusPill({
  text,
  tone,
}: {
  text: string;
  tone: 'ready' | 'pending';
}) {
  return (
    <span
      className={cn(
        'rounded-full border px-2 py-0.5 text-[11px] tracking-[0.08em]',
        tone === 'ready'
          ? 'border-emerald-700/25 bg-emerald-50 text-emerald-800'
          : 'border-amber-700/25 bg-amber-50 text-amber-900',
      )}
    >
      {text}
    </span>
  );
}

export function BreakthroughTaskCard({
  task,
  className,
}: {
  task: TaskInstance;
  className?: string;
}) {
  const currentStage = task.snapshot.stages.find((stage) => stage.current) ?? null;
  const fromRealm = task.snapshot.fromRealm ?? task.metadata.fromRealm ?? null;
  const toRealm = task.snapshot.toRealm ?? task.metadata.toRealm ?? null;
  const contextText =
    fromRealm && toRealm
      ? `${task.snapshot.title} · ${fromRealm} → ${toRealm}`
      : task.snapshot.title;

  if (task.status === 'completed' || !currentStage) {
    return (
      <div
        className={cn(
          'space-y-4 border border-dashed border-ink/8 bg-[rgba(248,243,230,0.6)] p-4',
          className,
        )}
      >
        <div className="flex items-center justify-between gap-3 border-b border-ink/10 pb-3">
          <p className="text-ink-secondary min-w-0 truncate text-xs">{contextText}</p>
          <StatusPill text="前置已成" tone="ready" />
        </div>

        <div className="space-y-2">
          <p className="text-ink text-base font-semibold tracking-[0.04em]">
            可回静室冲关
          </p>
          <p className="text-ink-secondary text-sm leading-7">
            这一份破境卷宗已经办妥，现在可以回静室正式冲击
            {toRealm ?? '下一重境界'}。
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <InkButton href="/game/retreat">回静室冲关</InkButton>
        </div>
      </div>
    );
  }

  const stageIndex = task.snapshot.stages.findIndex((stage) => stage.current);
  const stageNumber = stageIndex >= 0 ? stageIndex + 1 : 1;
  const totalStages = task.snapshot.totalStages;
  const doneCount = currentStage.objectives.filter(
    (objective) => objective.completed,
  ).length;
  const totalCount = currentStage.objectives.length;

  return (
    <div
      className={cn(
        'space-y-4 border border-dashed border-ink/10 bg-[rgba(248,243,230,0.82)] p-4',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b border-ink/10 pb-3">
        <p className="text-ink-secondary min-w-0 truncate text-xs">{contextText}</p>
        <StatusPill
          text={`第 ${stageNumber}/${totalStages} 阶段`}
          tone="pending"
        />
      </div>

      <div className="space-y-2">
        <p className="text-ink text-base font-semibold tracking-[0.04em]">
          {currentStage.title}
        </p>
        <p className="text-ink-secondary text-sm leading-7">
          {currentStage.description}
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-ink-secondary text-xs leading-5">
          本阶段目标 · {doneCount}/{totalCount} 已完成
        </p>
        <div className="space-y-2">
          {currentStage.objectives.map((objective) => (
            <TaskObjectiveRow key={objective.id} objective={objective} />
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {currentStage.links.map((link) => (
          <InkButton key={`${task.id}:${link.href}:${link.label}`} href={link.href}>
            {link.label}
          </InkButton>
        ))}
      </div>
    </div>
  );
}
