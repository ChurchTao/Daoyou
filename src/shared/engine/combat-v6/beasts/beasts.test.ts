import { describe, expect, it } from 'vitest';
import {
  BEAST_SPECIES,
  BeastLineupSchema,
  BeastSchema,
  activeBeastSkills,
  beastDeathIds,
  beastPanel,
  beastRealm,
  generateStarterBeast,
  loseBeastLifespan,
  projectBeastRoster,
} from './index';

const owner = '00000000-0000-4000-8000-000000000001';
const id = '00000000-0000-4000-8000-000000000002';
const starter = () => generateStarterBeast(id, owner, BEAST_SPECIES[0].id, 42);
describe('召唤兽正式个体', () => {
  it('同系高级覆盖普通的投影效果，但不改变两个出生格位', () => {
    const beast = BeastSchema.parse({
      ...starter(),
      skills: ['beast.combo', 'beast.advanced-combo'],
      skillSlotCapacity: 2,
    });
    expect(activeBeastSkills(beast)).toEqual(['beast.advanced-combo']);
    const [unit] = projectBeastRoster(
      {
        beasts: [beast],
        lineup: { carriedBeastIds: [id], leadBeastId: id, revision: 0 },
      },
      owner,
      0,
      0,
    );
    expect(unit.passives).toEqual(['beast.advanced-combo']);
    expect(unit.skills).toEqual([]);
    expect(beast.skills).toHaveLength(2);
  });
  it('相同种子和物种冻结同一事实，点数守恒', () => {
    expect(starter()).toEqual(starter());
    const beast = starter();
    expect(
      Object.values(beast.allocatedAttributes).reduce(
        (a, b) => a + b,
        beast.unallocatedPoints,
      ),
    ).toBe(beast.level * 5);
    expect(() =>
      BeastSchema.parse({ ...beast, unallocatedPoints: 1 }),
    ).toThrow();
    expect(() => BeastSchema.parse({ ...beast, skills: [] })).toThrow();
  });
  it('独立面板、零修炼、满资源，投影不改个体', () => {
    const beast = starter();
    const before = structuredClone(beast);
    const attrs = beastPanel(beast);
    expect(attrs.hp).toBe(attrs.maxHp);
    expect(attrs.mp).toBe(attrs.maxMp);
    expect(
      attrs.attackCultivate +
        attrs.spellCultivate +
        attrs.defenseCultivate +
        attrs.resistSpellCultivate,
    ).toBe(0);
    expect(beast).toEqual(before);
    expect(beastRealm(180)).toBe('妖圣');
    expect(() => beastRealm(181)).toThrow();
  });
  it('编组上限、唯一性、归属和低寿命入场边界', () => {
    expect(() =>
      BeastLineupSchema.parse({ carriedBeastIds: [id, id], revision: 0 }),
    ).toThrow();
    const roster = {
      beasts: [starter()],
      lineup: { carriedBeastIds: [id], leadBeastId: id, revision: 0 },
    };
    expect(projectBeastRoster(roster, owner, 0, 0)[0].benched).toBe(false);
    expect(() => projectBeastRoster(roster, id, 0, 0)).toThrow();
    roster.beasts[0].currentLifespan = 49;
    expect(projectBeastRoster(roster, owner, 0, 0)).toEqual([]);
    roster.beasts[0].currentLifespan = 50;
    expect(projectBeastRoster(roster, owner, 0, 0)).toHaveLength(1);
  });
  it('死亡事实按个体去重，寿尽保留个体', () => {
    expect(
      beastDeathIds([
        { type: 'unitDead', unitId: `beast:${id}` },
        { type: 'unitDead', unitId: `beast:${id}` },
        { type: 'unitDowned', unitId: owner },
      ]),
    ).toEqual([id]);
    const beast = loseBeastLifespan({ ...starter(), currentLifespan: 50 });
    expect(beast.currentLifespan).toBe(0);
    expect(beast.id).toBe(id);
    expect(beast.skills).toEqual(starter().skills);
  });
});
