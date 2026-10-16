import { describe, expect, it } from 'vitest';
import { BEAST_SPECIES } from '@daoyou/game-content/beasts';
import { generateCapturedBeast, generateStarterBeast } from './generator.js';
import { beastPointBudget } from './identity.js';
import { gainBeastExp, allocateBeast } from './progression.js';
import { beastRejuvenationReason, rejuvenateBeast } from './rejuvenation.js';
import { GeneratedBeastSchema } from './schema.js';

const owner = '00000000-0000-4000-8000-000000000001';
const id = '00000000-0000-4000-8000-000000000002';
const species = BEAST_SPECIES[0].id;
const spend = {
  constitution: 12, strength: 8, magic: 0, endurance: 0, agility: 0,
};

describe('化生果', () => {
  it('只重置已分配属性点，保留等级、修为和个体培养事实', () => {
    const original = generateStarterBeast(id, owner, species, 42);
    const allocated = allocateBeast(original, spend, 180);
    const before = { ...gainBeastExp(allocated, 1, 180), currentLifespan: 700 };
    expect(before.level).toBe(original.level);
    expect(before.exp).toBe(1);
    const result = rejuvenateBeast(before);
    expect(result).toMatchObject({
      ...before,
      allocatedAttributes: {
        constitution: 0, strength: 0, magic: 0, endurance: 0, agility: 0,
      },
      unallocatedPoints: beastPointBudget(before),
      revision: before.revision + 1,
    });
    expect(result.level).toBe(before.level);
    expect(result.exp).toBe(before.exp);
    expect(result.skills).toEqual(before.skills);
    expect(result.aptitudes).toEqual(before.aptitudes);
    expect(beastRejuvenationReason(original)).toBe('灵兽尚未分配属性点');
    expect(beastRejuvenationReason(before)).toBe('');
  });

  it('捕获野生洗点后保留当前等级，原有点数亏损不补回', () => {
    const wild = generateCapturedBeast(id, owner, species, 30, 42);
    const grown = gainBeastExp(wild, 1, 180);
    const allocated = allocateBeast(grown, {
      constitution: 20, strength: 0, magic: 0, endurance: 0, agility: 0,
    }, 180);
    const reset = rejuvenateBeast(allocated);
    expect(reset).toMatchObject({
      originKind: 'wild',
      initialLevel: 30,
      level: grown.level,
      exp: grown.exp,
      unallocatedPoints: beastPointBudget(grown),
    });
    expect(reset.unallocatedPoints).toBe(90);
    expect(beastPointBudget({ ...reset, level: 31 })).toBe(95);
    const raised = gainBeastExp(reset, 1000000, 180);
    expect(raised.level).toBeGreaterThan(30);
    expect(raised.unallocatedPoints).toBe(beastPointBudget(raised));
    expect(raised.unallocatedPoints).toBe(
      beastPointBudget({ ...raised, originKind: 'baby' }) - 50 - 60,
    );
  });

  it('变异保留变异与等级，无捕获等级的野生不会得到宝宝的50点', () => {
    const mutant = generateCapturedBeast(id, owner, species, 0, 42, true);
    const raisedMutant = gainBeastExp(mutant, 1000, 180);
    const allocatedMutant = allocateBeast(raisedMutant, {
      constitution: 5, strength: 0, magic: 0, endurance: 0, agility: 0,
    }, 180);
    expect(rejuvenateBeast(allocatedMutant)).toMatchObject({
      isMutant: true,
      originKind: 'baby',
      level: raisedMutant.level,
      exp: raisedMutant.exp,
      unallocatedPoints: beastPointBudget(raisedMutant),
    });
    const starter = generateStarterBeast(id, owner, species, 43);
    const pseudo = GeneratedBeastSchema.parse({
      ...starter,
      originKind: 'pseudo_baby',
      initialLevel: 0,
      unallocatedPoints: beastPointBudget({
        originKind: 'pseudo_baby',
        initialLevel: 0,
        level: starter.level,
      }),
    });
    const allocated = allocateBeast(pseudo, {
      constitution: 10, strength: 0, magic: 0, endurance: 0, agility: 0,
    }, 180);
    expect(rejuvenateBeast(allocated)).toMatchObject({
      originKind: 'pseudo_baby',
      level: starter.level,
      exp: starter.exp,
      unallocatedPoints: beastPointBudget(pseudo),
    });
    expect(beastPointBudget(pseudo)).toBe(starter.level * 5);
  });
});
