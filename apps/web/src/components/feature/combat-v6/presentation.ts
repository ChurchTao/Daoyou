import type { CombatV6SkillCommandOption } from '@daoyou/combat-core/types';
import type { CombatV6UnitAppearance } from '@daoyou/game-domain/combat';
import type { CombatV6Unit } from './session';

export {
  appendBattleEntries,
  compactLogLines,
  frameFeedback,
  reasonText,
  unitLabels,
} from '@daoyou/game-rules/combat/log';
export type {
  ActionEntry,
  BattleLog,
  LogLine,
} from '@daoyou/game-rules/combat/log';

export const combatV6HistorySources = {
  ranking: '天骄榜',
  hunt: '结伴讨伐',
  'arena-sparring': '擂台切磋',
};

export function combatPortraitValue(
  unit: Pick<CombatV6Unit, 'name' | 'ownerId' | 'kind'>,
  appearance?: CombatV6UnitAppearance,
) {
  if (appearance?.icon) return appearance.icon;
  if (unit.ownerId || unit.kind === 'pet') return '🐾';
  // Older replays can lack any visual identity. Use a name mark without guessing.
  return Array.from(unit.name.trim())[0] ?? '？';
}

export function skillNeedsTarget(
  skill: CombatV6SkillCommandOption,
  unitId?: string,
) {
  return (
    !['all', 'random', 'lowestHp', 'lowestDef'].includes(skill.targetMode) &&
    !(
      skill.selectableTargetIds.length === 1 &&
      skill.selectableTargetIds[0] === unitId
    )
  );
}
