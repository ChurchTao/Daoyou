import type { CombatV6SkillCommandOption } from '@shared/engine/combat-v6/core/types';

export {
  appendBattleEntries,
  compactLogLines,
  frameFeedback,
  reasonText,
  unitLabels,
} from '@shared/combat-v6/battle-log';
export type {
  ActionEntry,
  BattleLog,
  LogLine,
} from '@shared/combat-v6/battle-log';

export const combatV6HistorySources = {
  ranking: '天骄榜',
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
