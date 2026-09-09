import type {
  PresentedLogPartV3,
  PresentedLogToneV3,
} from '@shared/engine/battle-v5/v3';

const TONE_CLASS: Record<PresentedLogToneV3, string> = {
  neutral: 'text-ink',
  secondary: 'text-ink-secondary',
  ability: 'text-battle-log-ability',
  damage: 'text-battle-log-damage-generic',
  damage_physical: 'text-battle-log-damage-physical',
  damage_magical: 'text-battle-log-damage-magical',
  damage_true: 'text-battle-log-damage-true',
  damage_dot: 'text-battle-log-damage-dot',
  positive: 'text-battle-log-positive',
  negative: 'text-battle-log-negative',
  shield: 'text-battle-log-shield',
  resource: 'text-battle-log-resource',
  buff: 'text-battle-log-buff',
  debuff: 'text-battle-log-debuff',
  control: 'text-battle-log-control',
  mechanic: 'text-battle-log-mechanic',
  defense: 'text-battle-log-defense',
  fatal: 'text-battle-log-fatal',
};

export function getCombatLogPartClassNameV3(
  part: PresentedLogPartV3,
): string | undefined {
  const classes: string[] = [];

  if (part.kind === 'unit') classes.push('font-medium');
  if (part.kind === 'ability' || part.kind === 'status') {
    classes.push('font-medium');
  }
  if (part.emphasis === 'strong') classes.push('font-semibold');

  const fallbackTone: PresentedLogToneV3 | undefined =
    part.kind === 'unit'
      ? 'neutral'
      : part.kind === 'ability'
        ? 'ability'
        : part.kind === 'resource'
          ? 'resource'
          : part.kind === 'status'
            ? 'control'
            : undefined;
  const tone = part.tone ?? fallbackTone;
  if (tone) classes.push(TONE_CLASS[tone]);

  return classes.length > 0 ? classes.join(' ') : undefined;
}
