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


describe('手游参照召唤兽派生公式', () => {
  const sample = () => BeastSchema.parse({
    ...starter(),
    skills: ['beast.spirit-flame'],
    skillSlotCapacity: 1,
    unallocatedPoints: 0,
    level: 50,
    growth: 1.2,
    aptitudes: { health: 4000, mana: 2400, attack: 1500, defense: 1400, speed: 1300 },
    allocatedAttributes: { constitution: 10, strength: 70, magic: 100, endurance: 40, agility: 30 },
  });

  it('完整累加等级资质项与成长属性项后取整', () => {
    expect(beastPanel(sample())).toMatchObject({
      hp: 1167, maxHp: 1167, mp: 1210, maxMp: 1210,
      physicalAtk: 437, magicAtk: 351, physicalDef: 522,
      magicDef: 346, speed: 308,
    });
  });

  it('零级只有天生五维贡献，没有旧面板固定底值', () => {
    const beast = BeastSchema.parse({
      ...sample(), level: 0, growth: 1,
      allocatedAttributes: { constitution: 0, strength: 0, magic: 0, endurance: 0, agility: 0 },
    });
    expect(beastPanel(beast)).toMatchObject({
      maxHp: 70, maxMp: 50, physicalAtk: 16, magicAtk: 13,
      physicalDef: 24, magicDef: 17, speed: 16,
    });
  });

  it('资质不放大加点收益，成长不放大等级资质项', () => {
    const base = sample();
    const stronger = { ...base, aptitudes: { ...base.aptitudes, attack: 2500 } };
    const grown = { ...base, growth: 1.5 };
    expect(beastPanel(stronger).physicalAtk - beastPanel(base).physicalAtk).toBe(125);
    expect(beastPanel({ ...stronger, growth: 1.5 }).physicalAtk - beastPanel(grown).physicalAtk).toBe(125);
    const allocated = {
      ...base, allocatedAttributes: { ...base.allocatedAttributes, strength: 80, magic: 90 },
    };
    expect(beastPanel(allocated).physicalAtk).toBe(456);
    expect(beastPanel({ ...allocated, aptitudes: stronger.aptitudes }).physicalAtk).toBe(581);
  });

  it('法防采用法力资质与四维贡献，防御资质和敏捷不参与', () => {
    const base = sample();
    const changed = {
      ...base,
      aptitudes: { ...base.aptitudes, defense: 5000 },
      allocatedAttributes: { ...base.allocatedAttributes, agility: 0 },
      unallocatedPoints: 30,
    };
    expect(beastPanel(changed).magicDef).toBe(346);
    expect(beastPanel({ ...base, aptitudes: { ...base.aptitudes, mana: 3400 } }).magicDef).toBe(376);
  });
});
