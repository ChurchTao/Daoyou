import { InkTooltip } from '@app/components/ui/InkTooltip';
import { sectStatusDetails } from '@daoyou/game-content/sects';
import type { ReactNode } from 'react';

const statuses = sectStatusDetails();
const statusTriggerClass =
  'inline cursor-help border-0 bg-transparent p-0 align-baseline font-[inherit] text-inherit underline decoration-dashed decoration-current/70 underline-offset-4 focus-visible:outline-ink focus-visible:outline-2 focus-visible:outline-offset-2';

/** 状态名。有说明时用虚线下划线展开，悬停或点击都能看到。 */
export function StatusMention({ id, name }: { id: string; name: string }) {
  const status = statuses[id];
  if (!status) return <>{name}</>;
  return (
    <InkTooltip
      label={`${status.name}说明`}
      triggerContent={name}
      triggerClassName={statusTriggerClass}
    >
      <span className="mb-1 block font-medium">{status.name}</span>
      {status.description}
    </InkTooltip>
  );
}

/** 技能说明：意象与效果为正文，状态名用虚线下划线展开详细说明。 */
export function SkillDescription({ text }: { text: string }) {
  const nodes: ReactNode[] = [];
  const token = /\[\[([a-z0-9_.]+)\]\]/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let index = 0;
  while ((match = token.exec(text))) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const status = statuses[match[1]];
    nodes.push(
      status ? (
        <StatusMention
          key={`${match[1]}-${index}`}
          id={match[1]}
          name={status.name}
        />
      ) : (
        match[0]
      ),
    );
    last = match.index + match[0].length;
    index += 1;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return <>{nodes}</>;
}
