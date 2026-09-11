import { SkillTag, UnitKind, type LineupUnit, type Side } from '../core';
import { DEFAULT_ATTRS } from '../core/units';
import {
  BEAST_PROGRESSION,
  BEAST_SKILLS,
  BEAST_SKILL_FAMILIES,
  BEAST_SPECIES,
} from './content';
import {
  BeastLineupSchema,
  BeastSchema,
  type BeastRoster,
  type SummonedBeast,
} from './schema';

export function activeBeastSkills(beast: SummonedBeast) {
  return beast.skills.filter(
    (id) =>
      !BEAST_SKILL_FAMILIES.some(
        (family) =>
          id === family.normal && beast.skills.includes(family.advanced),
      ),
  );
}

export function beastRealm(level: number) {
  if (!Number.isInteger(level) || level < 0 || level > 180)
    throw new Error('召唤兽等级无效');
  const realms = BEAST_PROGRESSION.realms.filter((realm) => realm.minLevel <= level);
  return realms[realms.length - 1].name;
}

export function beastPanel(input: SummonedBeast) {
  const b = BeastSchema.parse(input);
  const rule = BEAST_PROGRESSION.panel;
  const natural = rule.naturalBase + b.level * rule.naturalPerLevel;
  const a = Object.fromEntries(
    Object.entries(b.allocatedAttributes).map(([key, value]) => [
      key,
      natural + value,
    ]),
  );
  // Aptitude contributes with level; growth multiplies attributes only.
  // Sum both terms before flooring so fractional contributions are retained.
  const contribution = (
    value: number,
    aptitude: keyof SummonedBeast['aptitudes'],
    term: { aptitudeCoefficient: number; attributeCoefficient: number },
  ) => Math.floor(
    b.level * b.aptitudes[aptitude] * term.aptitudeCoefficient +
    value * b.growth * term.attributeCoefficient,
  );
  const hp = contribution(a.constitution, 'health', rule.health);
  const mp = contribution(a.magic, 'mana', rule.mana);
  const magicDefAttributes = Object.entries(rule.magicDef.attributeCoefficients)
    .reduce((sum, [key, coefficient]) => sum + a[key] * coefficient, 0);
  return {
    ...DEFAULT_ATTRS,
    hp,
    maxHp: hp,
    mp,
    maxMp: mp,
    physicalAtk: contribution(a.strength, 'attack', rule.physicalAtk),
    physicalDef: contribution(a.endurance, 'defense', rule.physicalDef),
    magicAtk: contribution(a.magic, 'mana', rule.magicAtk),
    magicDef: Math.floor(
      b.level * b.aptitudes.mana * rule.magicDef.aptitudeCoefficient +
      magicDefAttributes * b.growth,
    ),
    speed: contribution(a.agility, 'speed', rule.speed),
  };
}

export function projectBeastRoster(
  roster: BeastRoster | undefined,
  ownerId: string,
  side: Side,
  slot: number,
  ownerLevel = 180,
): LineupUnit[] {
  if (!roster) return [];
  const lineup = BeastLineupSchema.parse(roster.lineup);
  return lineup.carriedBeastIds
    .map((id) => {
      const beast = BeastSchema.parse(roster.beasts.find((b) => b.id === id));
      if (beast.ownerCultivatorId !== ownerId)
        throw new Error('召唤兽归属不符');
      // Low lifespan reserves never enter the runtime, so they cannot be summoned.
      return !canDeployBeast(beast, ownerLevel)
        ? []
        : [
            {
              id: `beast:${beast.id}`,
              name: beast.name,
              ownerId,
              kind: UnitKind.Pet,
              side,
              slot,
              benched: id !== lineup.leadBeastId,
              level: beast.level,
              attrs: beastPanel(beast),
              skills: activeBeastSkills(beast).filter(
                (id) =>
                  !BEAST_SKILLS.find((s) => s.id === id)!.tags.includes(
                    SkillTag.Passive,
                  ),
              ),
              passives: activeBeastSkills(beast).filter((id) =>
                BEAST_SKILLS.find((s) => s.id === id)!.tags.includes(
                  SkillTag.Passive,
                ),
              ),
              skillLevels: Object.fromEntries(
                beast.skills.map((skill) => [skill, beast.level]),
              ),
            },
          ];
    })
    .flat();
}

export function canDeployBeast(beast: SummonedBeast, ownerLevel: number) {
  return (
    beast.currentLifespan >= BEAST_PROGRESSION.lifespan.deployMinimum &&
    beast.level <= ownerLevel &&
    BEAST_SPECIES.some(
      (s) => s.id === beast.speciesId && s.carryLevel <= ownerLevel,
    )
  );
}
