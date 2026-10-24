import { createUnit, UnitKind } from '@daoyou/combat-core';
import { BODY_CULTIVATION_PACK } from '@daoyou/game-content/body-cultivation';
import { describe, expect, it } from 'vitest';
import { applyCultivate, daoyouFormulas } from '../combat/daoyou/formulas.js';
import {
  bodyCultivationBenefits,
  bodyCultivationEffectValues,
} from './benefits.js';

const unit = (
  id: string,
  spellCultivate: number,
  resistSpellCultivate: number,
) =>
  createUnit(
    {
      id,
      name: id,
      side: 0,
      kind: UnitKind.Npc,
      level: 100,
      attrs: { hp: 100, speed: 10, spellCultivate, resistSpellCultivate },
    },
    0,
  );

describe('炼体效果展示', () => {
  it.each(['skin', 'sinew_bone', 'organs', 'primordial_spirit'] as const)(
    '%s 的百分比与固定值对应实际伤害公式',
    (key) => {
      const effect = bodyCultivationEffectValues(key, 15);
      expect(effect.kind).toBe('training');
      if (effect.kind !== 'training')
        throw new Error('expected training effect');
      expect(effect.damagePercent).toBe(12.5);
      expect(effect.damageFlat).toBe(31.25);
      const direction = key === 'skin' || key === 'primordial_spirit' ? -1 : 1;
      expect(
        applyCultivate(1000, direction * effect.trainingLevel),
      ).toBeCloseTo(
        1000 * (1 + (direction * effect.damagePercent) / 100) +
          direction * effect.damageFlat,
      );
    },
  );
  it('60 级修炼等效 25 级，提供 50% 与 125 点伤害修正', () => {
    const effect = bodyCultivationEffectValues('skin', 60);
    expect(effect).toMatchObject({
      kind: 'training',
      trainingLevel: 60,
      damagePercent: 50,
      damageFlat: 125,
    });
    expect(applyCultivate(1000, -60)).toBe(375);
  });
  it.each(['skin', 'sinew_bone', 'organs', 'primordial_spirit'] as const)(
    '%s 从 44 到 45 级继续成长，且不提前取整等效等级',
    (key) => {
      const current = bodyCultivationEffectValues(key, 44);
      const next = bodyCultivationEffectValues(key, 45);
      if (current.kind !== 'training' || next.kind !== 'training')
        throw new Error('expected training effect');
      expect(current.damagePercent).toBeCloseTo(36.6666667);
      expect(current.damageFlat).toBeCloseTo(91.6666667);
      expect(next.damagePercent).toBe(37.5);
      expect(next.damageFlat).toBe(93.75);
    },
  );
  it('封印展示的是线性基值修正，最终命中仍受软边界限制', () => {
    const effect = bodyCultivationEffectValues('organs', 60);
    expect(effect).toMatchObject({ sealBasePercent: 50 });
    const chance = daoyouFormulas.sealHitChance(unit('source', 60, 0), unit('target', 0, 0));
    expect(chance).toBeCloseTo((75 + 20 * (1 - Math.exp(-1.5))) / 100);
    expect(chance).toBeLessThan(0.95);
  });
  it('封印基值修正与实际封印命中公式一致', () => {
    const effect = bodyCultivationEffectValues('organs', 15);
    if (effect.kind !== 'training') throw new Error('expected training effect');
    const baseline = daoyouFormulas.sealHitChance(
      unit('source', 0, 0),
      unit('target', 0, 0),
    );
    const attacking = daoyouFormulas.sealHitChance(
      unit('source', 15, 0),
      unit('target', 0, 0),
    );
    const resisting = daoyouFormulas.sealHitChance(
      unit('source', 0, 0),
      unit('target', 0, 15),
    );
    expect(effect.sealBasePercent).toBeCloseTo((attacking - baseline) * 100);
    expect(effect.sealBasePercent).toBeCloseTo((baseline - resisting) * 100);
  });
  it('气血与治疗展示取自实际加成，并遵守战斗等级上限', () => {
    const levels = {
      skin: 0,
      sinew_bone: 0,
      organs: 0,
      primordial_spirit: 0,
      qi_blood: 15,
    };
    const actual = bodyCultivationBenefits(levels, 1000);
    const effect = bodyCultivationEffectValues('qi_blood', 15);
    expect(effect).toMatchObject({
      kind: 'life',
      hpPercent: actual.maxHpBonus / 10,
      healPower: actual.healPowerBonus,
    });
    expect(bodyCultivationEffectValues('qi_blood', 61)).toEqual(
      bodyCultivationEffectValues('qi_blood', 60),
    );
  });
  it('自定义数据包的每级收益同步到展示', () => {
    const pack = structuredClone(BODY_CULTIVATION_PACK);
    pack.tracks.skin.benefit.perLevel = 2;
    expect(bodyCultivationEffectValues('skin', 5, pack)).toMatchObject({
      trainingLevel: 10,
    });
    const effect = bodyCultivationEffectValues('skin', 5, pack);
    if (effect.kind !== 'training') throw new Error('expected training effect');
    expect(effect.damagePercent).toBeCloseTo(25 / 3);
    expect(effect.damageFlat).toBeCloseTo(125 / 6);
    pack.tracks.qi_blood.benefit.hpRatioPerLevel = 0.01;
    pack.tracks.qi_blood.benefit.healLevelsPerPoint = 3;
    expect(bodyCultivationEffectValues('qi_blood', 15, pack)).toMatchObject({
      hpPercent: 15,
      healPower: 5,
    });
  });
});
