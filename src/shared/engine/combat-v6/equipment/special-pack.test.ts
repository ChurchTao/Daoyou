import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import data from './data/equipment-special.json';
import schema from './data/equipment-special.schema.json';
import before from './fixtures/special-before-g2.json';
import {
  compileEquipmentArt,
  compileEquipmentEssence,
  compileRageGainPassive,
} from './special-compiler';
import {
  DAO_EQUIPMENT_ARTS_V1,
  DAO_EQUIPMENT_ESSENCES_V1,
  DAO_EQUIPMENT_MULTI_SECT_DOWNED_SKILL_IDS,
  DAO_RAGE_RESOURCE,
  createDaoRageGainPassive,
} from './special-content';
import {
  EquipmentSpecialPackShape,
  loadEquipmentSpecialPack,
} from './special-pack';

describe('equipment special configuration', () => {
  it('preserves every pre-G2 skill, status, essence and rage hook', () => {
    expect({
      arts: DAO_EQUIPMENT_ARTS_V1,
      essences: DAO_EQUIPMENT_ESSENCES_V1,
      passives: [createDaoRageGainPassive(1), createDaoRageGainPassive(1.2)],
    }).toEqual(before);
    expect(schema).toEqual(z.toJSONSchema(EquipmentSpecialPackShape));
    expect(DAO_EQUIPMENT_MULTI_SECT_DOWNED_SKILL_IDS).toEqual(['dao_equipment.skill.qingxin']);
    expect(DAO_RAGE_RESOURCE).toEqual({ id: 'combat.resource.rage', name: '战意', current: 0, max: 150 });
  });

  it.each<[string, (p: typeof data) => void, string]>([
    [
      'duplicate essence',
      (p) => {
        p.essences[1].id = p.essences[0].id;
      },
      'essences.1.id',
    ],
    [
      'duplicate skill',
      (p) => {
        p.arts[1].skillId = p.arts[0].skillId;
      },
      'arts.1.skillId',
    ],
    [
      'duplicate status',
      (p) => {
        p.arts[5].effect.statusId = p.arts[4].effect.statusId;
      },
      'statusId',
    ],
    [
      'invalid mechanism',
      (p) => {
        p.arts[0].effect.type = 'script';
      },
      'effect',
    ],
    [
      'raw formula',
      (p) => {
        Object.assign(p.arts[0].effect, { formula: 'target.maxHp' });
      },
      'effect',
    ],
    [
      'negative cost',
      (p) => {
        p.arts[0].rageCost = -1;
      },
      'rageCost',
    ],
    [
      'invalid ratio',
      (p) => {
        p.arts[0].effect.ratio = 2;
      },
      'ratio',
    ],
    [
      'unsafe expression precision',
      (p) => {
        p.arts[0].effect.ratio = 1e-8;
      },
      'ratio',
    ],
    [
      'negative factor',
      (p) => {
        p.essences[5].effect.factor = -1;
      },
      'factor',
    ],
    [
      'invalid stack',
      (p) => {
        p.essences[0].stackPolicy = 'whatever';
      },
      'stackPolicy',
    ],
    [
      'invalid slot',
      (p) => {
        Object.assign(p.arts[0], { allowedSlots: ['ring'] });
      },
      'allowedSlots',
    ],
    [
      'repeated slots',
      (p) => {
        Object.assign(p.arts[0], { allowedSlots: ['weapon', 'weapon'] });
      },
      'allowedSlots',
    ],
    [
      'reversed rage bounds',
      (p) => {
        p.rageGain.minPerHit = 21;
      },
      'minPerHit',
    ],
    [
      'invalid resource initial',
      (p) => {
        p.rageResource.initial = 151;
      },
      'initial',
    ],
  ])('rejects %s with a file and field', (_, change, field) => {
    const copy = structuredClone(data);
    change(copy);
    expect(() => loadEquipmentSpecialPack(copy)).toThrow(
      'equipment-special.json',
    );
    expect(() => loadEquipmentSpecialPack(copy)).toThrow(field);
  });

  it('compiles changed numbers once into both metadata and executable effects', () => {
    const copy = structuredClone(data);
    copy.arts[0].rageCost = 35;
    copy.arts[0].effect.ratio = 0.3;
    copy.essences[5].effect.factor = 1.5;
    copy.rageGain.maxPerHit = 25;
    const pack = loadEquipmentSpecialPack(copy);
    const art = compileEquipmentArt(pack.arts[0]);
    expect(art.rageCost).toBe(35);
    expect(art.skill.resourceCosts?.[0].amount).toBe(35);
    expect(art.skill.effects[0]).toMatchObject({ power: 'target.maxHp * 0.3' });
    expect(
      compileEquipmentEssence(pack.essences[5]).resourceGainFactors,
    ).toEqual({ 'combat.resource.rage': 1.5 });
    expect(
      compileRageGainPassive(1.5, pack.rageGain).hooks?.[0].effects[0],
    ).toMatchObject({
      amount:
        'min(25, max(1, floor(floor(hpDamage / target.maxHp * 100) * 1.5)))',
    });
  });
});
