import type { CombatV6SkillCommandOption } from '@daoyou/combat-core/types';

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
