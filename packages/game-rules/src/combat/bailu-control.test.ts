import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBattle } from '@daoyou/combat-core/session';
import { SeededRng } from '@daoyou/combat-core/rng';
import type { Command, CreateBattleInput, LineupUnit, SkillDef } from '@daoyou/combat-core/types';
import { BAILU_V6_DEFINITION as definition, BAILU_SKILL_ID as skillId, BAILU_STATUS_ID as statusId } from '@daoyou/game-content/sects/bailu';
import { COMBAT_V6_CHARACTER_BUILD_VERSIONS as versions } from '@daoyou/game-domain/combat';
import { DAO_RAGE_RESOURCE_ID } from '@daoyou/game-domain/equipment';
import { createEmptySectCombatProgressV6 } from '../sects/build-state.js';
import { compileSectDefinitionV6 } from '../sects/compiler.js';
import { createDaoyouRuleset } from './daoyou/index.js';

function project(pathName: 'edict' | 'song' = 'edict', nodeNames: string[] = []) {
  const path = definition.paths.find(item => item.id.endsWith(`.${pathName}`))!;
  const chosen = nodeNames.map(name => path.nodes.find(node => node.id.endsWith(`.${name}`))!);
  const depth = Math.max(0, ...chosen.map(node => node.layer));
  const chain = Array.from({ length: depth }, (_, index) => chosen.find(node => node.layer === index + 1) ??
    path.nodes.find(node => node.layer === index + 1 && node.slot === 2)!);
  const progress = createEmptySectCombatProgressV6('bailu', path.id,
    Object.fromEntries(definition.methods.map(method => [method.id, 180])));
  progress.meridianDepth = 7;
  progress.meridianLoadouts.find(loadout => loadout.pathId === path.id)!.nodeIds = chain.map(node => node.id);
  const result = compileSectDefinitionV6({ definition, progress, characterLevel: 180 });
  if (!result.ok) throw new Error(JSON.stringify(result));
  return result.projection;
}

const attrs = { hp: 100000, maxHp: 100000, mp: 100000, maxMp: 100000, speed: 1000,
  physicalAtk: 1000, physicalDef: 300, magicAtk: 1000, magicDef: 300, critRate: 0, spellCritRate: 0 };

function scholar(id: string, projection: ReturnType<typeof project>, slot = 0): LineupUnit {
  return { id, name: id, side: 0, kind: 'player', slot, level: 180, attrs: { ...attrs, speed: 1000 - slot },
    tags: projection.unitTags, skills: projection.activeSkillIds, passives: projection.passiveSkillIds,
    skillLevels: { ...projection.skillLevels }, skillOverrides: projection.skillOverrides,
    combatFacts: { isCharacter: 1, weaponDamage: 0 },
    resources: [...projection.resources, { id: DAO_RAGE_RESOURCE_ID, name: '战意', current: 0, max: 150 }] };
}

function setup(pathName: 'edict' | 'song' = 'edict', nodes: string[] = []) {
  const projection = project(pathName, nodes);
  const input: CreateBattleInput = { seed: 19, versions,
    ruleset: createDaoyouRuleset({ formulas: { physicalHitChance: () => 1, spellHitChance: () => 1,
      fluctuationMin: 1, fluctuationMax: 1, physicalFluctuationMin: 1, physicalFluctuationMax: 1,
      defendPhysicalFactor: 1 } }),
    skills: [...projection.skills], statusDefs: [...projection.statusDefs],
    units: [scholar('s', projection),
      { id: 'a', name: '同伴', side: 0, kind: 'player', slot: 1, level: 180, attrs: { ...attrs, speed: 500 } },
      { id: 't', name: '对手', side: 1, kind: 'player', level: 180, attrs: { ...attrs, speed: 100 } },
      { id: 't1', name: '另一对手', side: 1, kind: 'player', slot: 1, level: 180, attrs: { ...attrs, speed: 50 } }],
  };
  return { input, projection };
}

type Battle = ReturnType<typeof createBattle>;
function round(battle: Battle, commands: Record<string, Command> = {}) {
  for (const unit of battle.state.units)
    if (!unit.flags.dead && !unit.flags.downed && !unit.flags.benched && !unit.flags.escaped)
      battle.submit(unit.id, commands[unit.id] ?? { type: 'defend' });
  battle.lockAndResolve();
}
const cast = (id: string, targets = ['t']): Command => ({ type: 'skill', skillId: id, targets });
const has = (battle: Battle, unitId: string, id: string) => battle.unit(unitId).statuses.some(status => status.id === id);
const successfulRolls = () => vi.spyOn(SeededRng.prototype, 'chance').mockImplementation(chance => chance > 0);
afterEach(() => vi.restoreAllMocks());

describe('白鹿书院封印与贤影纵切', () => {
  it.each([{ damage: 30, shield: 0, awake: false }, { damage: 31, shield: 0, awake: true },
    { damage: 46, shield: 16, awake: false }, { damage: 46, shield: 15, awake: true }])(
    '余音按实际单次气血损失唤醒：$damage伤害／$shield护盾', ({ damage, shield, awake }) => {
      successfulRolls();
      const { input } = setup('edict', ['yuyin']);
      const probe: SkillDef = { id: 'test.probe', name: '定量攻击', tags: ['spell'], targeting: { side: 'enemy' },
        effects: [{ type: 'fixedHit', power: damage }] };
      input.skills!.push(probe);
      input.units[1]!.skills = [probe.id];
      const battle = createBattle(input);
      if (shield) battle.unit('t').barriers.push({ id: 'test.shield', kind: 'test.shield', name: '护盾',
        current: shield, remainingRounds: 3, sourceId: 't', appliedRound: 1 });
      round(battle, { s: cast(skillId.Rumeng), a: cast(probe.id) });
      expect(has(battle, 't', 'bailu.status.sleep_deep')).toBe(!awake);
      expect(battle.unit('t').attrs.hp).toBe(attrs.hp - Math.max(0, damage - shield));
      expect(battle.unit('s').attrs.mp).toBe(attrs.mp - 45);
    },
  );

  it('普通入梦受1点气血伤害即醒，余音多段首段唤醒后后续段仍正常结算', () => {
    successfulRolls();
    for (const [nodes, damage, hits] of [[[], 1, 1], [['yuyin'], 31, 3]] as const) {
      const { input } = setup('edict', [...nodes]);
      const probe: SkillDef = { id: 'test.probe', name: '连续攻击', tags: ['spell'], targeting: { side: 'enemy' },
        effects: [{ type: 'fixedHit', power: damage, hits }] };
      input.skills!.push(probe); input.units[1]!.skills = [probe.id];
      const battle = createBattle(input);
      round(battle, { s: cast(skillId.Rumeng), a: cast(probe.id) });
      expect(battle.unit('t').statuses.some(status => status.kind === 'bailu.seal')).toBe(false);
      expect(battle.unit('t').attrs.hp).toBe(attrs.hp - damage * hits);
    }
  });

  it('护身阻挡整次多段和附带封印，其他群攻目标正常，费用与正声仅各结算一次', () => {
    successfulRolls();
    const { input } = setup('edict', ['zhengsheng']);
    const mixed: SkillDef = { id: 'test.mixed', name: '混合群攻', tags: ['spell'],
      targeting: { side: 'enemy', mode: 'fill', count: 2, maxSelected: 2 }, costMp: '45*targets', cooldownRounds: 4,
      effects: [{ type: 'physicalHit', hits: 3 }, { type: 'fixedHit', power: 20 },
        { type: 'applyStatus', statusId: statusId.Law, duration: 2, hit: 'seal' },
        { type: 'modifyFact', key: 'completed', value: 1 }] };
    const followup: SkillDef = { id: 'test.followup', name: '后续攻击', tags: ['spell'], targeting: { side: 'enemy' },
      effects: [{ type: 'fixedHit', power: 31 }] };
    input.skills!.push(mixed, followup);
    input.units[2]!.skills = [mixed.id]; input.units[3]!.skills = [followup.id];
    const battle = createBattle(input);
    round(battle, { s: cast(skillId.Hushen, ['s']), t: cast(mixed.id, ['s', 'a']), t1: cast(followup.id, ['s']) });
    expect(battle.unit('s').attrs.hp).toBe(attrs.hp - 31);
    expect(has(battle, 's', statusId.Law)).toBe(false);
    expect(battle.unit('a').attrs.hp).toBeLessThan(attrs.hp);
    expect(has(battle, 'a', statusId.Law)).toBe(true);
    expect(battle.unit('s').attrs.mp).toBe(attrs.mp - 80);
    expect(battle.unit('t').attrs.mp).toBe(attrs.mp - 90);
    expect(battle.unit('t').cooldowns![mixed.id]).toBe(5);
    expect(battle.unit('t').combatFacts!.completed).toBe(1);
    expect(battle.unit('s').resources.find(resource => resource.id === DAO_RAGE_RESOURCE_ID)!.current).toBe(8);
    expect(battle.log().filter(event => event.type === 'mechanicTriggered' && event.mechanicId === statusId.Guard)).toHaveLength(1);
  });

  it('蓄辞由凝神准备下一次破邪，护身不准备，点名不消费', () => {
    successfulRolls();
    const withXuci = (battleInput: CreateBattleInput) => {
      const passive = definition.paths.flatMap(path => path.nodes).find(node => node.id.endsWith('.xuci'))!.passives![0]!;
      battleInput.skills!.push(passive.definition);
      battleInput.units[0]!.passives!.push(passive.definition.id);
      return createBattle(battleInput);
    };
    const prepared = withXuci(setup('song').input);
    const plain = withXuci(setup('song').input);
    round(prepared, { s: cast(skillId.Hushen, ['s']) });
    round(plain, { s: cast(skillId.Hushen, ['s']) });
    expect(has(prepared, 's', statusId.Charged)).toBe(false);
    round(prepared, { s: cast(skillId.Ningshen, ['s']) });
    round(plain, { s: { type: 'defend' } });
    expect(has(prepared, 's', statusId.Charged)).toBe(true);
    expect(has(plain, 's', statusId.Charged)).toBe(false);
    const beforePrepared = prepared.unit('t').attrs.hp;
    const beforePlain = plain.unit('t').attrs.hp;
    round(prepared, { s: cast(skillId.Poxie, ['t']) });
    round(plain, { s: cast(skillId.Poxie, ['t']) });
    const preparedDamage = beforePrepared - prepared.unit('t').attrs.hp;
    const plainDamage = beforePlain - plain.unit('t').attrs.hp;
    expect(preparedDamage).toBe(Math.floor(plainDamage * 1.25));
    expect(has(prepared, 's', statusId.Charged)).toBe(false);
    round(prepared, { s: cast(skillId.Ningshen, ['s']) });
    round(prepared, { s: cast(skillId.Dianming, ['t']) });
    expect(has(prepared, 's', statusId.Charged)).toBe(true);
  });

  it('审辨仅重试首次机会，保留原言令的技能等级、概率、时长与一次费用', () => {
    const { input } = setup('edict', ['shenbian']);
    input.units[0]!.skillLevels![skillId.Rumeng] = 83;
    input.units[2]!.kind = 'pet'; input.units[2]!.ownerId = 't1'; input.units[2]!.level = 83;
    const chances: number[] = [];
    vi.spyOn(SeededRng.prototype, 'chance').mockImplementation(chance => {
      if (chance <= 0 || chance >= 1) return chance >= 1;
      chances.push(chance); return chances.length === 2;
    });
    const battle = createBattle(input);
    const resolutions: Array<{ result?: string; chance?: number; duration?: number; skill?: string }> = [];
    battle.hooks.on('onStatusResolved', event => {
      if (event.statusHit === 'seal') resolutions.push({ result: event.statusResult,
        chance: event.statusChance, duration: event.statusDuration, skill: event.skillId });
    });
    round(battle, { s: cast(skillId.Rumeng) });
    expect(chances).toHaveLength(2);
    expect(chances[1]).toBeCloseTo(chances[0]! / 2);
    expect(resolutions.map(result => result.skill)).toEqual([skillId.Rumeng, skillId.Rumeng]);
    expect(resolutions.map(result => result.duration)).toEqual([3, 3]);
    expect(has(battle, 't', statusId.Sleep)).toBe(true);
    expect(battle.unit('t').statuses.find(status => status.id === statusId.Sleep)!.remainingRounds).toBe(3);
    expect(battle.unit('s').attrs.mp).toBe(attrs.mp - 45);
    expect(battle.unit('s').combatFacts!.bailu_pet_seal_attempted).toBe(1);
    round(battle, { s: cast(skillId.Jinfa) });
    expect(chances).toHaveLength(3);
    expect(resolutions).toHaveLength(3);
    expect(battle.unit('s').attrs.mp).toBe(attrs.mp - 45 - 60);
  });

  it('审辨首次命中、免疫或被贤影拦截后均消费机会，后续未中不再补判', () => {
    for (const first of ['applied', 'immune', 'intercepted'] as const) {
      const { input } = setup('edict', ['shenbian']);
      input.units[2]!.kind = 'pet'; input.units[2]!.ownerId = 't1';
      input.statusDefs!.push({ id: 'test.immunity', name: '免封', kind: 'test.immunity', category: 'buff', immuneToSeal: true });
      let count = 0;
      vi.spyOn(SeededRng.prototype, 'chance').mockImplementation(chance => {
        if (chance <= 0 || chance >= 1) return chance >= 1;
        count += 1; return count === 1 && first === 'applied';
      });
      const battle = createBattle(input);
      if (first === 'immune') battle.applyStatus('t', 'test.immunity', 1, 't');
      if (first === 'intercepted') battle.applyStatus('t', statusId.Guard, 3, 't');
      round(battle, { s: cast(skillId.Jinfa) });
      expect(battle.unit('s').combatFacts!.bailu_pet_seal_attempted).toBe(1);
      battle.unit('t').statuses = [];
      round(battle, { s: cast(skillId.Jinfa) });
      expect(count).toBe(first === 'applied' ? 2 : 1);
      expect(has(battle, 't', statusId.Law)).toBe(false);
      vi.restoreAllMocks();
    }
  });

  it('两名书生的朱批独立转移，并只为本人破邪提供第二目标', () => {
    successfulRolls();
    const { input, projection } = setup('song');
    input.units[1] = scholar('a', projection, 1);
    input.units.push({ ...input.units[2]!, id: 't2', name: '第三对手', slot: 2 });
    const battle = createBattle(input);
    round(battle, { s: cast(skillId.Dianming), a: cast(skillId.Dianming) });
    expect(battle.unit('t').statuses.filter(status => status.id === statusId.Mark).map(status => status.sourceId).sort()).toEqual(['a', 's']);
    while (battle.state.round < 9) round(battle);
    round(battle, { s: cast(skillId.Dianming, ['t1']) });
    expect(battle.unit('t').statuses.filter(status => status.id === statusId.Mark).map(status => status.sourceId)).toEqual(['a']);
    expect(battle.unit('t1').statuses.find(status => status.id === statusId.Mark)!.sourceId).toBe('s');
    const cursor = battle.log().length;
    round(battle, { s: cast(skillId.Poxie, ['t2']), a: cast(skillId.Poxie, ['t2']) });
    const damage = battle.log().slice(cursor).filter(event => event.type === 'damage');
    expect(damage.filter(event => event.type === 'damage' && event.sourceId === 's').map(event => event.type === 'damage' ? event.targetId : '')).toEqual(['t2', 't1']);
    expect(damage.filter(event => event.type === 'damage' && event.sourceId === 'a').map(event => event.type === 'damage' ? event.targetId : '')).toEqual(['t2', 't']);
  });

  it('清理旧朱批不消耗未受攻击者的护身，本次点名目标的实际攻击仍受拦截', () => {
    successfulRolls();
    const { input } = setup('song');
    const battle = createBattle(input);
    battle.applyStatus('t', statusId.Guard, 4, 't');
    round(battle, { s: cast(skillId.Dianming, ['t1']) });
    expect(battle.unit('t').flags.hostileActionGuardRound).toBeUndefined();
    expect(battle.unit('t1').attrs.hp).toBeLessThan(attrs.hp);
    battle.unit('s').cooldowns![skillId.Dianming] = 0;
    round(battle, { s: cast(skillId.Dianming, ['t']) });
    expect(battle.unit('t').flags.hostileActionGuardRound).toBe(2);
    expect(battle.unit('t').attrs.hp).toBe(attrs.hp);
    expect(has(battle, 't', statusId.Mark)).toBe(false);
  });
});
