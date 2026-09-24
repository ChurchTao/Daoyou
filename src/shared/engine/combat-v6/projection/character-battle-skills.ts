import type { LineupUnit, SkillDef } from '../core';

/** Compiled skills may contain path/meridian patches. Freeze every character's
 * effective definitions on the unit so an unpatched character never inherits
 * another participant's patch from the battle-wide lookup table. */
export function characterBattleSkills(
  unit: LineupUnit,
  skills: SkillDef[],
  battleSkills: Map<string, SkillDef>,
): LineupUnit {
  const own = new Map(skills.map((skill) => [skill.id, skill]));
  for (const skill of unit.skillOverrides ?? []) own.set(skill.id, skill);
  for (const skill of own.values()) {
    if (!battleSkills.has(skill.id)) battleSkills.set(skill.id, structuredClone(skill));
  }
  return {
    ...unit,
    skillOverrides: structuredClone([...own.values()]),
  };
}
