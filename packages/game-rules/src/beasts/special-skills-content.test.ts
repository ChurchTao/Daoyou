import {
  BEAST_SKILL_CONTENT,
  BEAST_SPECIES,
} from '@daoyou/game-content/beasts';
import { findItemDefinition } from '@daoyou/game-content/items';
import type { SummonedBeast } from '@daoyou/game-domain/beasts';
import { expect, it } from 'vitest';
import { learnBeastSkill } from '../inventory/index.js';
import { fuseBeasts } from './fusion.js';
import { generateCapturedBeast } from './generator.js';
import {
  beastAttributes,
  beastCombatFacts,
  beastPanel,
  projectBeastRoster,
} from './projection.js';

const id = '00000000-0000-4000-8000-000000000001';
function beast(name: string, skills: string[], level = 60): SummonedBeast {
  const species = BEAST_SPECIES.find((entry) => entry.name === name)!;
  return {
    ...generateCapturedBeast(id, id, species.id, level, 42),
    skills,
    skillSlotCapacity: skills.length,
  };
}
function project(input: SummonedBeast) {
  return projectBeastRoster(
    {
      beasts: [input],
      lineup: { carriedBeastIds: [id], leadBeastId: id, revision: 0 },
    },
    id,
    0,
    0,
  )[0];
}

it.each([0, 60, 180])(
  '瑞气盈身在 %d 级使用完整体质与成长，只增加气血面板',
  (level) => {
    const base = beast('麒麟', [], level);
    base.allocatedAttributes.constitution = 57;
    const enhanced = {
      ...base,
      skills: ['beast.auspicious-vitality'],
      skillSlotCapacity: 1,
    };
    const hp = Math.floor(beastAttributes(base).constitution * base.growth * 2);
    const panel = beastPanel(base);
    expect(beastPanel(enhanced)).toEqual({
      ...panel,
      hp: panel.hp + hp,
      maxHp: panel.maxHp + hp,
    });
    expect(project(enhanced).attrs).toEqual(beastPanel(enhanced));
  },
);

it.each(['鸣蛇', '烛尾狐', '九尾狐'])(
  '出奇制胜在%s中均正常投影为被动',
  (name) => {
    const unit = project(beast(name, ['beast.surprise-spell'], 0));
    expect(unit.passives).toEqual(['beast.surprise-spell']);
  },
);

it('观照万象在其他物种中仍正常投影为主动技能', () => {
  const unit = project(beast('鸣蛇', ['beast.all-seeing'], 0));
  expect(unit.skills).toEqual(['beast.all-seeing']);
  expect(unit.passives).toEqual([]);
});

it.each([
  'beast.all-seeing',
  'beast.mountain-breaker',
  'beast.karmic-retribution',
  'beast.radiant-barrier',
  'beast.auspicious-vitality',
  'beast.bloodthirsty-pursuit',
  'beast.surprise-spell',
  'beast.innate-wisdom',
  'beast.overwhelming-might',
  'beast.spirit-guard',
  'beast.wind-strike',
  'beast.barrier-breaker',
  'beast.mind-shatter',
  'beast.unanticipated',
])('特殊技能%s不注册灵印，不能通过伪造灵印ID领悟', (skillId) => {
  const definitionId = `book.${skillId}`;
  expect(findItemDefinition(definitionId)).toBeUndefined();
  expect(() =>
    learnBeastSkill(beast('鸣蛇', [], 0), definitionId, 180, 0),
  ).toThrow();
});

it.each([0, 60, 180])(
  '灵慧与凶威在%d级按完整属性进入同一展示／战斗面板',
  (level) => {
    const base = beast('鸣蛇', [], level);
    base.allocatedAttributes.strength = 41;
    base.allocatedAttributes.magic = 23;
    const attributes = beastAttributes(base);
    const panel = beastPanel(base);
    const enhanced = {
      ...base,
      skills: ['beast.innate-wisdom', 'beast.overwhelming-might'],
      skillSlotCapacity: 2,
    };
    expect(beastPanel(enhanced)).toEqual({
      ...panel,
      physicalAtk:
        panel.physicalAtk + Math.floor(attributes.strength * base.growth * 0.2),
      physicalDef: Math.max(
        0,
        panel.physicalDef - Math.floor(attributes.strength * 0.2),
      ),
      magicAtk: panel.magicAtk + Math.floor(attributes.magic * 0.4),
    });
    expect(project(enhanced).attrs).toEqual(beastPanel(enhanced));
    expect(base.allocatedAttributes).toMatchObject({ strength: 41, magic: 23 });
  },
);

it('战斗事实保留完整力量，只记录实际生效铁骨的防御贡献', () => {
  const input = beast('鸣蛇', ['beast.defense', 'beast.advanced-defense'], 60);
  expect(beastCombatFacts(input)).toEqual({
    isBeast: 1,
    strength: beastAttributes(input).strength,
    defenseTraining: 48,
  });
  expect(project(input).combatFacts).toEqual(beastCombatFacts(input));
});

it('第二轮出生池为六种新增、饕餮替换蛮力，原必带与其余技能保留', () => {
  const expected: Record<string, { core: string[]; candidates: string[] }> = {
    白泽: {
      core: [],
      candidates: [
        'beast.advanced-miracle',
        'beast.water-attack',
        'beast.wisdom',
        'beast.parry',
        'beast.innate-wisdom',
      ],
    },
    饕餮: {
      core: [],
      candidates: [
        'beast.advanced-lifesteal',
        'beast.overwhelming-might',
        'beast.sluggish',
        'beast.regeneration',
        'beast.defense',
      ],
    },
    旋龟: {
      core: [],
      candidates: [
        'beast.advanced-reflection',
        'beast.water-attack',
        'beast.regeneration',
        'beast.sluggish',
        'beast.spirit-guard',
      ],
    },
    鸣蛇: {
      core: [],
      candidates: [
        'beast.advanced-agility',
        'beast.sneak-attack',
        'beast.perception',
        'beast.critical',
        'beast.wind-strike',
      ],
    },
    狰: {
      core: [],
      candidates: [
        'beast.advanced-counter',
        'beast.parry',
        'beast.strength',
        'beast.perception',
        'beast.barrier-breaker',
      ],
    },
    祸斗: {
      core: ['beast.wildfire'],
      candidates: [
        'beast.spell-resistance',
        'beast.meditation',
        'beast.wisdom',
        'beast.mind-shatter',
      ],
    },
    九尾狐: {
      core: ['beast.water-attack'],
      candidates: [
        'beast.advanced-spell-combo',
        'beast.surprise-spell',
        'beast.regeneration',
        'beast.unanticipated',
      ],
    },
  };
  for (const [name, birthSkills] of Object.entries(expected)) {
    const species = BEAST_SPECIES.find((entry) => entry.name === name)!;
    expect(species.birthSkills).toEqual(birthSkills);
    expect(birthSkills.core.length + birthSkills.candidates.length).toBe(5);
  }
  expect(BEAST_SKILL_CONTENT).toHaveLength(81);
  expect(BEAST_SKILL_CONTENT.filter((skill) => skill.book)).toHaveLength(67);
});

it.each([
  'beast.innate-wisdom',
  'beast.overwhelming-might',
  'beast.spirit-guard',
  'beast.wind-strike',
  'beast.barrier-breaker',
  'beast.mind-shatter',
  'beast.unanticipated',
])('%s可以融合到其他物种并正常投影', (skillId) => {
  const first = beast('鸣蛇', [skillId]);
  const second = {
    ...beast('钢背猪', []),
    id: '00000000-0000-4000-8000-000000000002',
  };
  const resultId = '00000000-0000-4000-8000-000000000003';
  const results = Array.from({ length: 32 }, (_, seed) =>
    fuseBeasts(first, second, resultId, seed),
  );
  const inherited = results.find(
    (result) =>
      result.speciesId === second.speciesId && result.skills.includes(skillId),
  );
  expect(inherited).toBeDefined();
  const unit = projectBeastRoster(
    {
      beasts: [inherited!],
      lineup: {
        carriedBeastIds: [resultId],
        leadBeastId: resultId,
        revision: 0,
      },
    },
    id,
    0,
    0,
  )[0];
  expect([...(unit.skills ?? []), ...(unit.passives ?? [])]).toContain(skillId);
});
