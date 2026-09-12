import { InkTooltip } from '@app/components/ui/InkTooltip';
import { beastSkillPresentation } from '@shared/combat-v6/beast-skill-presentation';

const styles = {
  normal: 'border-ink/20 bg-bgpaper text-ink hover:border-ink/40',
  advanced:
    'border-amber-600/65 bg-amber-100/50 text-amber-950 hover:border-amber-700',
  unavailable:
    'border-stone-300 bg-stone-100 text-stone-500 hover:border-stone-400',
};
export function BeastSkillTile({ skillId }: { skillId: string }) {
  const skill = beastSkillPresentation(skillId);
  const unavailable = skill.style === 'unavailable';
  return (
    <InkTooltip
      label={`查看${skill.name}${unavailable ? '（已失效）' : ''}说明`}
      triggerClassName={`flex aspect-square w-full min-w-0 [container-type:inline-size] flex-col items-center justify-center gap-1 rounded-xs border px-1 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal ${styles[skill.style]}`}
      triggerContent={
        <>
          <span
            aria-hidden
            className={`text-[min(24px,40cqw)] leading-none ${unavailable ? 'opacity-50 grayscale' : ''}`}
          >
            {skill.icon}
          </span>
          <span
            className={`flex h-[22px] items-center justify-center text-center ${skill.style === 'advanced' ? 'font-medium' : ''}`}
          >
            <span
              className={
                skill.name.length > 5
                  ? 'max-w-[5em] text-[min(10px,20cqw)] leading-[11px] text-balance'
                  : 'text-[min(12px,20cqw)] leading-4'
              }
            >
              {skill.name}
            </span>
          </span>
        </>
      }
    >
      <p className="font-medium">
        {skill.name}
        {unavailable ? '（已失效）' : ''}
      </p>
      <p>{skill.description}</p>
    </InkTooltip>
  );
}
