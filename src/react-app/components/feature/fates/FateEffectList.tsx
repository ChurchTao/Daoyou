import type { FateDetailGroup } from './FateDisplayAdapter';

interface FateEffectListProps {
  groups: FateDetailGroup[];
}

export function FateEffectList({ groups }: FateEffectListProps) {
  if (groups.length === 0) return null;

  return (
    <div className="space-y-3">
      {groups.map((group) => (
        <section key={group.key} className="space-y-1.5">
          <h3 className="text-ink-secondary text-xs font-semibold tracking-wide uppercase">
            {group.title}
          </h3>
          <ul className="space-y-1.5">
            {group.lines.map((line, index) => (
              <li
                key={`${group.key}-${line}-${index}`}
                className="border-ink/10 text-ink-secondary rounded-md border px-2 py-1.5 text-sm leading-relaxed"
              >
                {line}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
