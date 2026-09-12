import { BeastSkillTile } from './BeastSkillTile';

export function BeastSkillGrid({ skills }: { skills: string[] }) {
  return (
    <div
      className="grid w-full grid-cols-4 gap-2 lg:grid-cols-8"
      role="group"
      aria-label="灵兽技能"
    >
      {skills.map((id) => (
        <BeastSkillTile key={id} skillId={id} />
      ))}
      {Array.from({ length: Math.max(0, 16 - skills.length) }, (_, index) => (
        <div
          key={`empty-${index}`}
          aria-hidden
          className="border-ink/10 bg-ink/[0.025] flex aspect-square min-w-0 items-center justify-center rounded-xs border"
        >
          <span className="bg-ink/10 h-1 w-1 rounded-full" />
        </div>
      ))}
    </div>
  );
}
