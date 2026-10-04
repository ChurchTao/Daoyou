import type {
  CharacterPanelV1,
  PublicCombatV6Build,
} from '@daoyou/game-domain/combat';
import { COMBAT_V6_SECT_DEFINITIONS } from '@daoyou/game-content/sects';
import { projectCharacterToCombatV6 } from './projection/project-character.js';
import {
  type CharacterDisplayBuild,
  type CultivatorDisplayInput,
} from '@daoyou/game-domain/character';
import { projectCharacterDisplay } from '../character/display.js';
import { combatV6SkillDetails } from './skill-details.js';

/** Only currently equipped and usable build facts, never the persistence/profile object. */
export function publicCombatV6Build(
  character: Pick<
    CultivatorDisplayInput,
    'id' | 'name' | 'realm' | 'realm_stage' | 'attributes' | 'condition'
  >,
  build: CharacterDisplayBuild,
): { combatPanel: CharacterPanelV1; build: PublicCombatV6Build } {
  const projection = projectCharacterToCombatV6({
    cultivator: { ...character, id: character.id! },
    ...build,
    side: 0,
    slot: 0,
    resourcePolicy: 'full',
  });
  if (!projection.ok)
    throw new Error(projection.diagnostics.map((d) => d.message).join('；'));
  const definition = build.sect
    ? COMBAT_V6_SECT_DEFINITIONS[build.sect.sectId]
    : undefined;
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
      pathName:
        definition?.paths.find((p) => p.id === build.sect?.activePathId)
          ?.name ?? null,
      equipment: structuredClone(build.equipment),
      manuals: build.manuals.build.slots.map((entry) => ({
        ...entry,
        level: build.manuals.learned.find((m) => m.manualId === entry.manualId)!
          .level,
      })),
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
