import {
  BEAST_PROGRESSION,
  BEAST_RARE_SPECIES_IDS,
  BEAST_SKILL_CONTENT,
  BEAST_SPECIES,
  BEAST_STARTER_SPECIES,
} from '@daoyou/game-content/beasts';
import { findItemDefinition } from '@daoyou/game-content/items';
import { BEAST_MARKET_PACK } from '@daoyou/game-content/market/beast-pack';
import { expect, it } from 'vitest';
import { generateCapturedBeast } from './generator.js';
import {
  activeBeastSkills,
  beastAttributes,
  beastPanel,
  projectBeastRoster,
} from './projection.js';

const id = '00000000-0000-4000-8000-000000000001';
function beast(skills: string[], level = 60) {
  return {
    ...generateCapturedBeast(id, id, BEAST_SPECIES[0].id, level, 42),
    skills,
    skillSlotCapacity: skills.length,
  };
}
it.each(['flight', 'fortune', 'coordination'])(
  '%s双档灵印注册、货架开放并只激活高级',
  (name) => {
    const normal = `beast.${name}`,
      advanced = `beast.advanced-${name}`;
    expect(activeBeastSkills(beast([normal, advanced]))).toEqual([advanced]);
    for (const skillId of [normal, advanced]) {
      expect(
        BEAST_SKILL_CONTENT.some((skill) => skill.id === skillId && skill.book),
      ).toBe(true);
      expect(findItemDefinition(`book.${skillId}`)).toBeDefined();
      expect(
        [
          ...BEAST_MARKET_PACK.books.normal,
          ...BEAST_MARKET_PACK.books.advanced,
        ].some((book) => book.definitionId === `book.${skillId}`),
      ).toBe(true);
    }
  },
);
it.each([
  'sweeping-strike',
  'spirit-surge',
  'spirit-conversion',
  'wind-pursuit',
  'golden-strike',
  'eightfold-flame',
])('%s特殊技能不开放灵印，允许跨物种投影', (name) => {
  const skillId = `beast.${name}`;
  expect(findItemDefinition(`book.${skillId}`)).toBeUndefined();
  const b = beast([skillId]);
  const [unit] = projectBeastRoster(
    {
      beasts: [b],
      lineup: { carriedBeastIds: [id], leadBeastId: id, revision: 0 },
    },
    id,
    0,
    0,
  );
  expect([...unit.skills!, ...unit.passives!]).toContain(skillId);
  expect(unit.tags).toEqual([`beastSpecies.${b.speciesId}`]);
});
it('飞行面板与灵觉躲避相乘，高级覆盖普通且不增加速度', () => {
  const b = beast(['beast.advanced-perception']);
  const base = beastPanel(b);
  const normal = beastPanel({
    ...b,
    skills: [...b.skills, 'beast.flight'],
    skillSlotCapacity: 2,
  });
  expect(normal).toEqual({
    ...base,
    hit: Math.floor(base.hit * 1.2),
    dodge: 12,
  });
  expect(
    beastPanel({
      ...b,
      skills: [...b.skills, 'beast.flight', 'beast.advanced-flight'],
      skillSlotCapacity: 3,
    }),
  ).toEqual({ ...base, hit: Math.floor(base.hit * 1.2), dodge: 13 });
});
it.each([0, 60, 180])(
  '宝相在%d级只转换魔力贡献，独立灵慧保留，法防与资源上限投影一致',
  (level) => {
    const b = beast(['beast.spirit-conversion', 'beast.innate-wisdom'], level);
    b.allocatedAttributes.magic = 80;
    const attrs = beastAttributes(b),
      rule = BEAST_PROGRESSION.panel;
    const base = beastPanel({ ...b, skills: [], skillSlotCapacity: 0 });
    const panel = beastPanel(b);
    expect(panel.magicAtk).toBe(
      Math.floor(level * b.aptitudes.mana * rule.magicAtk.aptitudeCoefficient) +
        Math.floor(attrs.magic * 0.4),
    );
    expect(panel.mp).toBe(
      Math.floor(
        level * b.aptitudes.mana * rule.mana.aptitudeCoefficient +
          attrs.magic * b.growth * rule.mana.attributeCoefficient * 0.5,
      ),
    );
    const magicDefAttributes = Object.entries(
      rule.magicDef.attributeCoefficients,
    ).reduce(
      (sum, [key, coefficient]) =>
        sum + attrs[key as keyof typeof attrs] * coefficient,
      0,
    );
    expect(panel.magicDef).toBe(
      Math.floor(
        level * b.aptitudes.mana * rule.magicDef.aptitudeCoefficient +
          magicDefAttributes * b.growth +
          attrs.magic * Math.max(0, b.growth - 0.3),
      ),
    );
    expect(panel.maxMp).toBe(panel.mp);
    expect(panel.hp).toBe(base.hp);
    expect(panel.physicalAtk).toBe(base.physicalAtk);
    expect(b.allocatedAttributes.magic).toBe(80);
  },
);
it('低阶稀有的咪咪保留携带门槛，并且是唯一的初始伙伴', () => {
  const mimi = BEAST_SPECIES.find((species) => species.id === 'combat.wild.species.mimi')!;
  expect(mimi.realm).toBe('炼气');
  expect(mimi.carryLevel).toBe(5);
  expect(BEAST_RARE_SPECIES_IDS.has(mimi.id)).toBe(true);
  expect(BEAST_STARTER_SPECIES.map((species) => species.id)).toEqual([mimi.id]);
});
