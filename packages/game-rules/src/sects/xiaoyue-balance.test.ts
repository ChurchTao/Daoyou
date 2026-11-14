import { createBattle } from '@daoyou/combat-core/session';
import type { Command, CreateBattleInput } from '@daoyou/combat-core/types';
import { XIAOYUE_V6_DEFINITION, XIAOYUE_SKILL_ID } from '@daoyou/game-content/sects/xiaoyue';
import { BEAST_SKILLS } from '@daoyou/game-content/beasts';
import { COMBAT_V6_CHARACTER_BUILD_VERSIONS as versions } from '@daoyou/game-domain/combat';
import { describe, expect, it } from 'vitest';
import { createDaoyouRuleset } from '../combat/daoyou/index.js';
import { createEmptySectCombatProgressV6 } from './build-state.js';
import { compileSectDefinitionV6 } from './compiler.js';

type Path = 'blood' | 'bond';
type Scenario = 'single' | 'three' | 'six';
type Loadout = 'baseline' | 'matched-healing';

function makeBattle(path: Path, scenario: Scenario, level: number, seed: number, loadout: Loadout, guaranteedCombo = false, withPet = true) {
  const pathId = `xiaoyue.path.${path}`;
  const progress = createEmptySectCombatProgressV6('xiaoyue', pathId,
    Object.fromEntries(XIAOYUE_V6_DEFINITION.methods.map(method => [method.id, level])));
  progress.meridianDepth = loadout === 'baseline' ? 0 : level >= 170 ? 6 : level >= 90 ? 3 : 1;
  const nodes = loadout === 'baseline' ? [] : level >= 170
    ? path === 'blood' ? ['1.1', '2.1', '3.2', '4.2', '5.1', '6.2'] : ['1.1', '2.2', '3.3', '4.2', '5.3', '6.2']
    : level >= 90 ? path === 'blood' ? ['1.1', '2.1', '3.2'] : ['1.1', '2.2', '3.3'] : ['1.1'];
  progress.meridianLoadouts.find(loadout => loadout.pathId === pathId)!.nodeIds = nodes.map(node => `xiaoyue.node.${path}.${node}`);
  const compiled = compileSectDefinitionV6({ definition: XIAOYUE_V6_DEFINITION, progress, characterLevel: level });
  if (!compiled.ok) throw new Error(JSON.stringify(compiled.diagnostics));
  const content = compiled.projection;
  const enemyCount = scenario === 'single' ? 1 : scenario === 'three' ? 3 : 6;
  const input: CreateBattleInput = {
    seed,
    versions,
    ruleset: { ...createDaoyouRuleset({ formulas: {
      physicalHitChance: () => 1,
      fluctuationMin: 1, fluctuationMax: 1,
      physicalFluctuationMin: 1, physicalFluctuationMax: 1,
    } }), deferredPlayerCommands: true },
    skills: guaranteedCombo
      ? [...content.skills, ...BEAST_SKILLS.filter(skill => skill.id === 'beast.advanced-combo').map(skill => ({
        ...skill,
        hooks: skill.hooks?.map(hook => hook.on === 'afterHit' ? { ...hook, chance: 1 } : hook),
      }))]
      : content.skills,
    statusDefs: content.statusDefs,
    units: [
      { id: 'owner', name: '主人', side: 0, kind: 'player', level,
        attrs: { hp: 10000, maxHp: 10000, mp: 10000, maxMp: 10000, speed: 1000,
          physicalAtk: 500 + level * 6, physicalDef: 100 },
        tags: content.unitTags, skills: content.activeSkillIds, passives: content.passiveSkillIds,
        skillLevels: content.skillLevels, skillOverrides: content.skillOverrides,
        combatFacts: { metalEquipmentCount: 2 } },
      { id: 'pet', name: '本宠', side: 0, kind: 'pet', ownerId: 'owner', level, benched: !withPet,
        attrs: { hp: 10000, maxHp: 10000, speed: 500,
          physicalAtk: 250 + level * 4, physicalDef: 100 },
        passives: guaranteedCombo ? ['beast.advanced-combo'] : [] },
      ...Array.from({ length: enemyCount }, (_, index) => ({
        id: `enemy${index}`, name: '木桩', side: 1 as const, kind: 'npc' as const, level,
        attrs: { hp: 1000000, maxHp: 1000000, speed: 10, physicalAtk: 0,
          physicalDef: 120 + level * 2 },
      })),
    ],
  };
  return createBattle(input);
}

function simulate(path: Path, scenario: Scenario, level: number, seed: number, loadout: Loadout, guaranteedCombo = false, withPet = true, opening: 'lion' | 'transform' = 'lion') {
  const battle = makeBattle(path, scenario, level, seed, loadout, guaranteedCombo, withPet);
  const enemyIds = battle.state.units.filter(unit => unit.side === 1).map(unit => unit.id);
  for (let turn = 0; turn < 6; turn++) {
    const owner = battle.unit('owner');
    const available = (skillId: string) => battle.queryCommands('owner').skills.some(skill =>
      skill.skillId === skillId && skill.reasons.length === 0);
    let command: Command;
    if (turn === 0 && opening === 'lion' && available(XIAOYUE_SKILL_ID.LionStrike))
      command = { type: 'skill', skillId: XIAOYUE_SKILL_ID.LionStrike, targets: ['enemy0'] };
    else if (!owner.flags.skipNextAction && available(XIAOYUE_SKILL_ID.Transform))
      command = { type: 'skill', skillId: XIAOYUE_SKILL_ID.Transform, targets: ['owner'] };
    else if (!owner.flags.skipNextAction && scenario !== 'single' && available(XIAOYUE_SKILL_ID.EagleStrike))
      command = { type: 'skill', skillId: XIAOYUE_SKILL_ID.EagleStrike, targets: ['enemy0'] };
    else if (!owner.flags.skipNextAction && available(XIAOYUE_SKILL_ID.LionStrike))
      command = { type: 'skill', skillId: XIAOYUE_SKILL_ID.LionStrike, targets: ['enemy0'] };
    else command = { type: 'defend' };
    battle.submit('owner', command);
    if (withPet) battle.submit('pet', { type: 'attack', target: 'enemy0' });
    for (const id of enemyIds) battle.submit(id, { type: 'defend' });
    battle.lockAndResolve();
  }
  const damage = Object.fromEntries(['owner', 'pet'].map(id => [id, battle.log()
    .filter(event => event.type === 'damage' && event.sourceId === id && enemyIds.includes(event.targetId))
    .reduce((sum, event) => sum + event.amount, 0)])) as Record<'owner' | 'pet', number>;
  return {
    damage,
    total: damage.owner + damage.pet,
    petActions: battle.log().filter(event => event.type === 'actionStart' && event.unitId === 'pet').length,
    petHits: battle.log().filter(event => event.type === 'damage' && event.sourceId === 'pet').length,
    lionActions: battle.log().filter(event => event.type === 'actionStart' && event.unitId === 'owner' &&
      event.command.type === 'skill' && event.command.skillId === XIAOYUE_SKILL_ID.LionStrike).length,
    failedOwnerActions: battle.log().filter(event => event.type === 'actionFailed' && event.unitId === 'owner').length,
  };
}

describe('百兽崖同属性六回合伤害边界', () => {
  // 首版评审预算保留为主动兽形起手的历史轮转对照，不代表现行默认战术的强度验收。
  it.each([50, 90, 170] as const)('%i 级历史主动兽形轮转保持双流派六回合预算', level => {
    for (const scenario of ['single', 'three', 'six'] as const)
      for (const loadout of ['baseline', 'matched-healing'] as const) {
        const samples = [11, 23, 37, 53, 71, 89, 107].map(seed => ({
          blood: simulate('blood', scenario, level, seed, loadout, false, true, 'transform'),
          bond: simulate('bond', scenario, level, seed, loadout, false, true, 'transform'),
        }));
        const ratios = samples.map(({ blood, bond }) => bond.total / blood.total).sort((a, b) => a - b);
        expect(ratios[3], `${scenario}/${loadout}`).toBeGreaterThanOrEqual(0.9);
        expect(ratios[3], `${scenario}/${loadout}`).toBeLessThanOrEqual(1.1);
        for (const { blood, bond } of samples) {
          if (loadout === 'baseline') {
            expect(bond.damage.owner).toBe(blood.damage.owner);
            if (scenario === 'single') expect(bond.damage.pet).toBeGreaterThan(blood.damage.pet);
            else {
              expect(blood.lionActions).toBe(0);
              expect(bond.lionActions).toBe(0);
              expect(bond.damage.pet).toBe(blood.damage.pet);
            }
          }
          expect(blood.failedOwnerActions).toBe(0);
          expect(bond.failedOwnerActions).toBe(0);
          expect(blood.petActions).toBe(6);
          expect(bond.petActions).toBe(6);
          expect(blood.petHits).toBe(6);
          expect(bond.petHits).toBe(6);
          expect(bond.damage.pet).toBeGreaterThanOrEqual(blood.damage.pet);
        }
      }
  });

  it.each([50, 90, 170] as const)('%i 级合并狮搏开局提高各流派六回合输出，狮魂只增强本宠正常行动', level => {
    for (const scenario of ['single', 'three', 'six'] as const)
      for (const loadout of ['baseline', 'matched-healing'] as const) {
        const samples = [11, 23, 37, 53, 71, 89, 107].map(seed => ({
          blood: simulate('blood', scenario, level, seed, loadout),
          bond: simulate('bond', scenario, level, seed, loadout),
          beforeBlood: simulate('blood', scenario, level, seed, loadout, false, true, 'transform'),
          beforeBond: simulate('bond', scenario, level, seed, loadout, false, true, 'transform'),
        }));
        for (const path of ['blood', 'bond'] as const) {
          const beforeKey = path === 'blood' ? 'beforeBlood' : 'beforeBond';
          const before = samples.reduce((sum, sample) => sum + sample[beforeKey].total, 0);
          const after = samples.reduce((sum, sample) => sum + sample[path].total, 0);
          expect(after, `${scenario}/${loadout}/${path}`).toBeGreaterThan(before);
        }
        for (const { blood, bond } of samples) {
          if (loadout === 'baseline') {
            expect(bond.damage.owner).toBe(blood.damage.owner);
            expect(bond.damage.pet).toBeGreaterThan(blood.damage.pet);
          }
          for (const result of [blood, bond]) {
            expect(result.lionActions).toBeGreaterThan(0);
            expect(result.petActions).toBe(6);
            expect(result.petHits).toBe(6);
            expect(result.failedOwnerActions).toBe(0);
          }
        }
      }
  });

  it('高级连击仍只消耗本宠一次行动，不由同契生成额外行动', () => {
    const bond = simulate('bond', 'single', 90, 11, 'matched-healing', true);
    expect(bond.petActions).toBe(6);
    expect(bond.petHits).toBe(12);
    expect(bond.failedOwnerActions).toBe(0);
  });

  it('没有在场本宠时同契仍能施放共通攻击且不生成宠物行动', () => {
    const bond = simulate('bond', 'three', 90, 11, 'matched-healing', false, false);
    expect(bond.damage.owner).toBeGreaterThan(0);
    expect(bond.damage.pet).toBe(0);
    expect(bond.petActions).toBe(0);
    expect(bond.failedOwnerActions).toBe(0);
  });
});
