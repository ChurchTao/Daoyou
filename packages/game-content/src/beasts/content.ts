import {
  StatusCategory,
  StatusTick,
  TickKind,
} from '@daoyou/combat-core/enums';
import { type StatusDef } from '@daoyou/combat-core/types';
import { REALM_ORDER } from '@daoyou/constants/realms';
import { loadBeastPacks } from '@daoyou/game-domain/beasts/authoring';
import progressionData from './data/progression.json' with { type: 'json' };
import skillsData from './data/skills.json' with { type: 'json' };
import speciesData from './data/species.json' with { type: 'json' };
import { compileBeastSkill } from './skill-compiler.js';

const packs = loadBeastPacks(speciesData, skillsData, progressionData);
export const BEAST_SPECIES_REVISION = packs.species.contentRevision;
export const BEAST_SPECIES = packs.species.species;
export const BEAST_RARE_SPECIES_IDS: ReadonlySet<string> = new Set(
  BEAST_SPECIES.filter((s) => REALM_ORDER[s.realm] >= REALM_ORDER['合体']).map(
    (s) => s.id,
  ),
);
export const BEAST_STARTER_SPECIES = BEAST_SPECIES.filter((s) => s.starter);
export const BEAST_SKILL_CONTENT = packs.skills.skills;
export const BEAST_GENERATION = packs.species.generation;
export const BEAST_SKILLS = packs.skills.skills.map(compileBeastSkill);
export const BEAST_SKILL_FAMILIES = packs.skills.families;
export const BEAST_BOOK_SKILLS = packs.skills.skills.filter((s) => s.book);
export const BEAST_ADVANCED_SKILL_IDS = new Set(
  BEAST_SKILL_CONTENT.filter((skill) => skill.advanced).map(
    (skill) => skill.id,
  ),
);
export const BEAST_SUPERIOR_BOOK_SKILL_IDS = new Set(
  BEAST_BOOK_SKILLS.filter((skill) => skill.advanced).map((skill) => skill.id),
);
export const BEAST_COMBO_SKILL_IDS = packs.skills.skills
  .filter((s) => s.effect.type === 'combo')
  .map((s) => s.id);
export const BEAST_PROGRESSION = packs.progression;

export const BEAST_STATUS_DEFS: StatusDef[] =
  packs.skills.skills.flatMap<StatusDef>((skill) =>
    skill.effect.type === 'stealth'
      ? [
          {
            id: `${skill.id}.status`,
            name: skill.name,
            kind: 'beast.stealth',
            category: StatusCategory.Buff,
            untargetable: true,
            blocksSpell: true,
            expireSameRound: true,
          },
        ]
      : skill.effect.type === 'poison'
        ? [
            {
              id: `${skill.id}.status`,
              name: '中毒',
              kind: 'beast.poison',
              category: StatusCategory.Dot,
              ticks: StatusTick.RoundEnd,
              onTick: {
                type: TickKind.Dot,
                ratioOfMaxHp: skill.effect.hpRatio,
                ratioOfMaxMp: skill.effect.mpRatio,
              },
            },
          ]
        : skill.effect.type === 'spellDefense'
          ? [{
              id: `${skill.id}.status`,
              name: skill.name,
              kind: 'beast.spell-defense',
              category: StatusCategory.Buff,
              damageTakenSpell: skill.effect.takenFactor,
              expireSameRound: true,
            }]
          : skill.effect.type === 'mindShatter'
            ? [{
                id: `${skill.id}.status`,
                name: '灵息震乱',
                kind: 'beast.mp-drain',
                category: StatusCategory.Dot,
                ticks: StatusTick.RoundStart,
                priority: `floor(fact.strength / ${skill.effect.periodicStrengthDivisor} + ${skill.effect.periodicBase})`,
                onTick: {
                  type: TickKind.Dot,
                  mpPower: `floor(fact.strength / ${skill.effect.periodicStrengthDivisor} + ${skill.effect.periodicBase})`,
                  snapshot: true,
                },
              }]
            : [],
  );
