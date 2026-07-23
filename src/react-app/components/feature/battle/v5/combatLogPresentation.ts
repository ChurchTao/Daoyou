import type {
  PresentedLogPart,
  PresentedLogTone,
} from '@shared/engine/battle-v5/systems/log/types';

const TONE_CLASS: Record<PresentedLogTone, string> = {
  neutral: 'text-ink',
  secondary: 'text-ink-secondary',
  ability: 'text-battle-log-ability',
  'damage-generic': 'text-battle-log-damage-generic',
  'damage-physical': 'text-battle-log-damage-physical',
  'damage-magical': 'text-battle-log-damage-magical',
  'damage-true': 'text-battle-log-damage-true',
  'damage-dot': 'text-battle-log-damage-dot',
  positive: 'text-battle-log-positive',
  negative: 'text-battle-log-negative',
  shield: 'text-battle-log-shield',
  resource: 'text-battle-log-resource',
  buff: 'text-battle-log-buff',
  debuff: 'text-battle-log-debuff',
  control: 'text-battle-log-control',
  mechanic: 'text-battle-log-mechanic',
  defense: 'text-battle-log-defense',
  critical: 'text-battle-log-critical',
  fatal: 'text-battle-log-fatal',
};

export function getCombatLogPartClassName(
  part: PresentedLogPart,
): string | undefined {
  const classes: string[] = [];

  if (part.kind === 'unit') classes.push('font-medium');
  if (part.kind === 'number') classes.push('font-mono', 'tabular-nums');
  if (part.kind === 'ability') classes.push('font-medium');
  if (part.kind === 'status') classes.push('font-medium');
  if (part.emphasis === 'strong') classes.push('font-semibold');

  const fallbackTone: PresentedLogTone | undefined =
    part.kind === 'unit'
      ? 'neutral'
      : part.kind === 'ability'
        ? 'ability'
        : part.kind === 'resource'
          ? 'resource'
          : part.kind === 'critical'
            ? 'critical'
            : part.kind === 'status'
              ? 'control'
              : undefined;
  const tone = part.tone ?? fallbackTone;
  if (tone) classes.push(TONE_CLASS[tone]);

  return classes.length > 0 ? classes.join(' ') : undefined;
}
