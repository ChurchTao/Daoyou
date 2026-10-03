import type { ReactNode } from 'react';
import { BeastSkillTile } from './BeastSkillTile';

export function BeastSkillGrid({
  skills,
  label = '灵兽技能',
  captions,
  slots = 16,
}: {
  skills: string[];
  label?: string;
  captions?: Readonly<Record<string, ReactNode>>;
  slots?: number;
}) {
  return (
    <div
      className="grid w-full grid-cols-4 items-start gap-2 lg:grid-cols-8"
      role="group"
      aria-label={label}
    >
      {skills.map((id) =>
        captions?.[id] ? (
          <div key={id} className="min-w-0">
            <BeastSkillTile skillId={id} />
            {captions[id]}
          </div>
        ) : (
          <BeastSkillTile key={id} skillId={id} />
        ),
      )}
      {Array.from(
        { length: Math.max(0, slots - skills.length) },
        (_, index) => (
          <div
            key={`empty-${index}`}
            aria-hidden
            className="border-ink/10 bg-ink/[0.025] flex aspect-square min-w-0 items-center justify-center rounded-xs border"
          >
            <span className="bg-ink/10 h-1 w-1 rounded-full" />
          </div>
        ),
      )}
    </div>
  );
}
