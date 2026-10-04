import { describe, expect, it } from 'vitest';
import { BEAST_SPECIES } from '@daoyou/game-content/beasts';
import { generateCapturedBeast, generateStarterBeast } from './generator.js';
import { beastPointBudget } from './identity.js';
import { gainBeastExp, allocateBeast } from './progression.js';
import { rejuvenateBeast } from './rejuvenation.js';
import { GeneratedBeastSchema } from './schema.js';

const owner = '00000000-0000-4000-8000-000000000001';
const id = '00000000-0000-4000-8000-000000000002';
const species = BEAST_SPECIES[0].id;

describe('化生果', () => {
  it('宝宝回到0级并保留全部个体培养事实', () => {
    const original = generateStarterBeast(id, owner, species, 42);
    const allocated = allocateBeast(original, {
      constitution: 12, strength: 8, magic: 0, endurance: 0, agility: 0,
    }, 180);
    const before = { ...allocated, currentLifespan: 700 };
    const result = rejuvenateBeast(before);
    expect(result).toMatchObject({
      ...before,
      level: 0,
      exp: 0,
      allocatedAttributes: {
        constitution: 0, strength: 0, magic: 0, endurance: 0, agility: 0,
      },
      unallocatedPoints: 50,
      revision: before.revision + 1,
    });
    expect(result.skills).toEqual(before.skills);
    expect(result.aptitudes).toEqual(before.aptitudes);
  });

  it('纯野生重养到捕获等级后，原有点数亏损不增加', () => {
    const wild = generateCapturedBeast(id, owner, species, 30, 42);
    const reset = rejuvenateBeast(wild);
    expect(reset).toMatchObject({
      originKind: 'wild', initialLevel: 30, level: 0, unallocatedPoints: 0,
    });
    expect(beastPointBudget({ ...reset, level: 29 })).toBe(87);
    expect(beastPointBudget({ ...reset, level: 30 })).toBe(90);
    expect(beastPointBudget({ ...reset, level: 31 })).toBe(95);
    const raised = gainBeastExp(reset, 1000000, 30);
    expect(raised.level).toBe(30);
    expect(raised.unallocatedPoints).toBe(wild.unallocatedPoints);
    expect(rejuvenateBeast(reset).unallocatedPoints).toBe(0);
  });

  it('变异宝宝保留变异，假宝宝不会得到初始50点', () => {
    const mutant = generateCapturedBeast(id, owner, species, 0, 42, true);
    const raisedMutant = gainBeastExp(mutant, 1000, 180);
    expect(rejuvenateBeast(raisedMutant)).toMatchObject({
      isMutant: true, originKind: 'baby', level: 0, unallocatedPoints: 50,
    });
    const pseudo = GeneratedBeastSchema.parse({
      ...generateStarterBeast(id, owner, species, 43),
      originKind: 'pseudo_baby',
      initialLevel: 0,
      unallocatedPoints: 50,
    });
    expect(rejuvenateBeast(pseudo)).toMatchObject({
      originKind: 'pseudo_baby', level: 0, unallocatedPoints: 0,
    });
  });
});
