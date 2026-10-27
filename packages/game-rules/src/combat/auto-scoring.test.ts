import { expect, it } from 'vitest';
import type { Unit } from '@daoyou/combat-core/types';
import { createUnit } from '@daoyou/combat-core';
import { daoyouFormulas } from './daoyou/formulas.js';
import {
  expressionReadsHiddenTarget,
  visibleOutgoingDamage,
  visiblePhysicalHitChance,
  visibleSealHitChance,
} from './auto-scoring.js';

function unit(partial: Partial<Unit> & Pick<Unit, 'kind'>): Unit {
  return {
    id: 'u',
    name: 'u',
    side: 0,
    slot: 0,
    level: 60,
    attrs: {
      hp: 1000,
      maxHp: 1000,
      mp: 100,
      maxMp: 100,
      physicalAtk: 100,
      physicalDef: 9999,
      magicAtk: 100,
      magicDef: 9999,
      healPower: 0,
      speed: 10,
      hit: 100,
      dodge: 9999,
      critRate: 0,
      spellCritRate: 0,
      physicalFuryRate: 0,
      sealHit: 0,
      sealResist: 9999,
      attackCultivate: 0,
      defenseCultivate: 99,
      spellCultivate: 0,
      resistSpellCultivate: 99,
    },
    skills: [],
    passives: [],
    skillLevels: {},
    skillOverrides: {},
    tags: [],
    marks: [],
    resources: [],
    barriers: [],
    statuses: [],
    flags: {
      dead: false,
      downed: false,
      escaped: false,
      benched: false,
      defending: false,
      auto: false,
      skipNextAction: false,
    },
    ...partial,
  };
}

it('对敌物攻不减防御，人物法攻保留自身放大', () => {
  const pet = unit({ kind: 'pet' });
  const player = unit({ kind: 'player' });
  expect(
    visibleOutgoingDamage({
      source: pet,
      family: 'physical',
      coeff: 1,
      power: 0,
      skillLevel: 60,
      targetCount: 1,
    }),
  ).toBe(130);
  expect(
    visibleOutgoingDamage({
      source: pet,
      family: 'spell',
      coeff: 0.8,
      power: 10,
      skillLevel: 60,
      targetCount: 1,
    }),
  ).toBe(88);
  expect(
    visibleOutgoingDamage({
      source: player,
      family: 'spell',
      coeff: 1,
      power: 10,
      skillLevel: 60,
      targetCount: 1,
    }),
  ).toBe(180);
});

it('攻差和破防分支不因对方面板改变估分', () => {
  const source = unit({ kind: 'pet' });
  expect(
    visibleOutgoingDamage({
      source,
      family: 'attackDifference',
      coeff: 1,
      power: 480,
      skillLevel: 60,
      targetCount: 1,
    }),
  ).toBe(100);
  expect(
    visibleOutgoingDamage({
      source,
      family: 'guardBreak',
      coeff: 3,
      power: 0,
      skillLevel: 60,
      targetCount: 1,
    }),
  ).toBe(130);
});

it('命中和封印不读取对方闪避与抵抗', () => {
  const source = unit({ kind: 'pet', level: 60 });
  expect(visiblePhysicalHitChance(source, 60)).toBeCloseTo(0.983333, 5);
  expect(visibleSealHitChance(source, 60, 60, 0.55)).toBeGreaterThan(0);
  expect(expressionReadsHiddenTarget('effective.speed > targetEffective.speed')).toBe(true);
  expect(expressionReadsHiddenTarget('targetFact.defenseTraining')).toBe(true);
  expect(expressionReadsHiddenTarget('targetIsPlayer + targetFact.isCharacter')).toBe(false);
});

it('修炼估分使用 60→25 换算，封印与真实零抵抗目标一致', () => {
  const source = unit({ kind: 'player' });
  source.attrs.spellCultivate = 60;
  source.attrs.attackCultivate = 60;
  expect(visibleOutgoingDamage({ source, family: 'physical', coeff: 1, power: 0, skillLevel: 60, targetCount: 1 })).toBe(320);
  expect(visibleOutgoingDamage({ source, family: 'fixed', coeff: 1, power: 1000, skillLevel: 60, targetCount: 1 })).toBe(1625);
  const target = createUnit({ id: 'target', name: '目标', kind: 'npc', side: 1, level: 60, attrs: { hp: 1000, speed: 1 } }, 0);
  expect(visibleSealHitChance(source, 60, 60, 55)).toBe(daoyouFormulas.sealHitChance(source, target, 60, 55));
});

it('局部封印上限与统一公式一致，且不改变普通技能的上限', () => {
  const source = unit({ kind: 'player' });
  source.attrs.sealHit = 100000;
  const target = createUnit({ id: 'target', name: '目标', kind: 'npc', side: 1, level: 60, attrs: { hp: 1000, speed: 1 } }, 0);
  const ordinary = visibleSealHitChance(source, 60, 60, 55);
  expect(ordinary).toBeLessThanOrEqual(0.95);
  expect(visibleSealHitChance(source, 60, 60, 55, 0, 1)).toBeGreaterThan(0.95);
  for (const ceiling of [0.2, 0.5, 0.95, 1]) {
    expect(visibleSealHitChance(source, 60, 60, 55, 0, ceiling))
      .toBe(daoyouFormulas.sealHitChance(source, target, 60, 55, 0, ceiling));
  }
  expect(visibleSealHitChance(source, 60, 60, 55)).toBe(ordinary);
});
