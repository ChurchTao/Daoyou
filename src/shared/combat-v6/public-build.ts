import { COMBAT_V6_SECT_DEFINITIONS } from '../engine/combat-v6/content';
import { projectCharacterToCombatV6 } from '../engine/combat-v6/projection';
import {
  projectCharacterDisplay,
  type CharacterDisplayBuild,
  type CultivatorDisplayInput,
} from '../lib/cultivatorDisplay';
import { combatV6SkillDetails } from './skill-details';

/** Only currently equipped and usable build facts, never the persistence/profile object. */
export function publicCombatV6Build(
  character: Pick<
    CultivatorDisplayInput,
    'id' | 'name' | 'realm' | 'realm_stage' | 'attributes' | 'condition'
  >,
  build: CharacterDisplayBuild,
) {
  const projection = projectCharacterToCombatV6({
    cultivator: { ...character, id: character.id! },
    ...build,
    side: 0,
    slot: 0,
    resourcePolicy: 'full',
  });
  if (!projection.ok)
    throw new Error(projection.diagnostics.map((d) => d.message).join('；'));
  const definition = build.sect ? COMBAT_V6_SECT_DEFINITIONS[build.sect.sectId] : undefined;
  const skills = projection.skills.map(
    (skill) =>
      projection.unit.skillOverrides?.find(
        (override) => override.id === skill.id,
      ) ?? skill,
  );
  const details = combatV6SkillDetails(skills, projection.statusDefs);
  return {
    combatPanel: projectCharacterDisplay(character, build),
    build: {
      sectName: definition?.name ?? null,
      pathName: definition?.paths.find((p) => p.id === build.sect?.activePathId)?.name ?? null,
      equipment: structuredClone(build.equipment),
      manuals: build.manuals.build.slots.map(entry => ({ ...entry, level: build.manuals.learned.find(m => m.manualId === entry.manualId)!.level })),
      skills: (projection.unit.skills ?? []).map((id) => {
        const skill = skills.find((s) => s.id === id)!;
        return {
          id,
          name: skill.name,
          level: projection.unit.skillLevels?.[id] ?? 1,
          ...details[id],
        };
      }),
    },
  };
}
export type PublicCombatV6Build = ReturnType<
  typeof publicCombatV6Build
>['build'];
