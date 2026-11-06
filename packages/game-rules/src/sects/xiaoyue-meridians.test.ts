import { createBattle } from '@daoyou/combat-core/session';
import { SeededRng } from '@daoyou/combat-core/rng';
import { BEAST_SKILLS } from '@daoyou/game-content/beasts';
import type { Command, CreateBattleInput, LineupUnit, StatusDef } from '@daoyou/combat-core/types';
import { XIAOYUE_V6_DEFINITION, XIAOYUE_SKILL_ID } from '@daoyou/game-content/sects/xiaoyue';
import { COMBAT_V6_CHARACTER_BUILD_VERSIONS as versions } from '@daoyou/game-domain/combat';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDaoyouRuleset } from '../combat/daoyou/index.js';
import { createEmptySectCombatProgressV6 } from './build-state.js';
import { compileSectDefinitionV6 } from './compiler.js';

const definition = structuredClone(XIAOYUE_V6_DEFINITION);
for (const path of definition.paths) path.requiresConnectedNodes = false;
const lionSoul = 'xiaoyue.status.lion_soul';
const partnerMark = 'xiaoyue.status.best_partner_mark';
const partnerPet = 'xiaoyue.status.best_partner_pet';
const groupSpell = 'beast.thunderstorm';
const spellRepeat = 'beast.spell-combo';
const fixedAttack = 'beast.wind-strike';

function setup(pathId = 'xiaoyue.path.bond', nodes: string[] = [], withPet = true, extraStatuses: StatusDef[] = [], petSpellHitChance?: () => number) {
  const progress = createEmptySectCombatProgressV6('xiaoyue', pathId,
    Object.fromEntries(definition.methods.map(method => [method.id, 180])));
  progress.meridianDepth = 7;
  progress.meridianLoadouts.find(loadout => loadout.pathId === pathId)!.nodeIds = nodes.map(node => `xiaoyue.node.${pathId.endsWith('bond') ? 'bond' : 'blood'}.${node}`);
  const result = compileSectDefinitionV6({ definition, progress, characterLevel: 180 });
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  const content = result.projection;
  const units: LineupUnit[] = [
    { id: 's', name: '啸岳', side: 0, kind: 'player', level: 180,
      attrs: { hp: 10000, maxHp: 10000, mp: 10000, maxMp: 10000, speed: 1000, physicalAtk: 1000, physicalDef: 100 },
      tags: content.unitTags, skills: content.activeSkillIds, passives: content.passiveSkillIds,
      skillLevels: content.skillLevels, skillOverrides: content.skillOverrides },
    { id: 'ally', name: '队友', side: 0, kind: 'player', attrs: { hp: 10000, maxHp: 10000, speed: 100 } },
    { id: 'ownPet', name: '本宠', side: 0, kind: 'pet', ownerId: 's', benched: !withPet,
      ...(petSpellHitChance ? { level: 180, skills: [groupSpell, fixedAttack], passives: [spellRepeat] } : {}),
      attrs: { hp: 10000, maxHp: 10000, speed: 500, physicalAtk: 500, physicalDef: 100, magicDef: 100,
        ...(petSpellHitChance ? { mp: 1000, maxMp: 1000, magicAtk: 500 } : {}) } },
    { id: 'reserve', name: '替补', side: 0, kind: 'pet', ownerId: 's', benched: true,
      attrs: { hp: 10000, maxHp: 10000, speed: 450, physicalAtk: 500, physicalDef: 100, magicDef: 100 } },
    { id: 'allyPet', name: '队友宠', side: 0, kind: 'pet', ownerId: 'ally',
      attrs: { hp: 10000, maxHp: 10000, speed: 400, physicalAtk: 500, physicalDef: 100, magicDef: 100 } },
    { id: 't0', name: '敌人', side: 1, kind: 'player',
      attrs: { hp: 100000, maxHp: 100000, speed: 50, physicalAtk: 100, physicalDef: 100 } },
    { id: 'guard', name: '护卫', side: 1, kind: 'player',
      attrs: { hp: 100000, maxHp: 100000, speed: 40, physicalAtk: 100, physicalDef: 100 } },
    { id: 'enemyPet', name: '敌宠', side: 1, kind: 'pet', ownerId: 't0',
      attrs: { hp: 100000, maxHp: 100000, speed: 30, physicalAtk: 100, physicalDef: 100 } },
    { id: 'guardPet', name: '护卫宠', side: 1, kind: 'pet', ownerId: 'guard',
      attrs: { hp: 100000, maxHp: 100000, speed: 20, physicalAtk: 100, physicalDef: 100 } },
  ];
  const input: CreateBattleInput = {
    seed: 43,
    versions,
    ruleset: { ...createDaoyouRuleset({ formulas: {
      physicalHitChance: () => 1, sealHitChance: () => 1,
      ...(petSpellHitChance ? { spellHitChance: petSpellHitChance } : {}),
      fluctuationMin: 1, fluctuationMax: 1, physicalFluctuationMin: 1, physicalFluctuationMax: 1,
    } }), deferredPlayerCommands: true },
    skills: petSpellHitChance ? [...content.skills, ...BEAST_SKILLS.filter(skill =>
      [groupSpell, fixedAttack, spellRepeat].includes(skill.id)).map(skill =>
      skill.id === spellRepeat ? { ...skill, innate: { spellRepeat: { chance: 1, factor: 0.5 } } } : skill)] : content.skills,
    statusDefs: [...content.statusDefs, ...extraStatuses],
    units,
  };
  return createBattle(input);
}

type Battle = ReturnType<typeof setup>;
const setupSpellPet = (nodes: string[] = [], spellHitChance = () => 1) => setup('xiaoyue.path.bond', nodes, true, [], spellHitChance);
const cast = (skillId: string, targets = ['t0']): Command => ({ type: 'skill', skillId, targets });
function round(battle: Battle, commands: Record<string, Command> = {}) {
  for (const unit of battle.state.units) {
    if (unit.flags.dead || unit.flags.downed || unit.flags.benched) continue;
    battle.submit(unit.id, commands[unit.id] ?? { type: 'defend' });
  }
  battle.lockAndResolve();
}
const hits = (battle: Battle, sourceId: string) => battle.log()
  .filter(event => event.type === 'damage')
  .filter(event => event.sourceId === sourceId);

afterEach(() => vi.restoreAllMocks());

describe('啸岳岭同契与真实灵兽', () => {
  it('健壮仅作用于本宠；无本宠时仍保留共通攻击技能', () => {
    const own = setup('xiaoyue.path.bond', ['1.2']);
    const ally = setup('xiaoyue.path.bond', ['1.2']);
    for (const battle of [own, ally]) battle.unit('t0').attrs.physicalAtk = 1000;
    round(own, { t0: { type: 'attack', target: 'ownPet' } });
    round(ally, { t0: { type: 'attack', target: 'allyPet' } });
    const ownDamage = hits(own, 't0')[0];
    const allyDamage = hits(ally, 't0')[0];
    if (ownDamage?.type === 'damage' && allyDamage?.type === 'damage')
      expect(ownDamage.amount).toBeLessThan(allyDamage.amount);
    const noPet = setup('xiaoyue.path.bond', ['1.2'], false);
    expect(noPet.unit('reserve').flags.benched).toBe(true);
    expect(noPet.unit('s').skills).toContain(XIAOYUE_SKILL_ID.LionStrike);
  });

  it('狮魂只给本宠，收回时清除，替补换入不继承', () => {
    const battle = setup();
    round(battle, { s: cast(XIAOYUE_SKILL_ID.Transform, ['s']) });
    battle.unit('t0').attrs.hp = 1;
    round(battle, { s: cast(XIAOYUE_SKILL_ID.LionStrike) });
    expect(battle.unit('ownPet').statuses.some(status => status.id === lionSoul)).toBe(true);
    expect(battle.unit('allyPet').statuses.some(status => status.id === lionSoul)).toBe(false);
    round(battle, { s: { type: 'summon', petId: 'reserve' } });
    expect(battle.unit('ownPet').flags.benched).toBe(true);
    expect(battle.unit('ownPet').statuses.some(status => status.id === lionSoul)).toBe(false);
    expect(battle.unit('reserve').statuses.some(status => status.id === lionSoul)).toBe(false);
  });

  it('狮魂只增强群法的首个命中，不强化其他目标或法连', () => {
    vi.spyOn(SeededRng.prototype, 'chance').mockImplementation(probability => probability >= 1);
    const baseline = setupSpellPet();
    const enhanced = setupSpellPet();
    enhanced.applyStatus('ownPet', lionSoul, 99, 's');
    for (const battle of [baseline, enhanced]) round(battle, { ownPet: cast(groupSpell) });

    const baselineHits = hits(baseline, 'ownPet');
    expect(baselineHits.map(hit => hit.targetId)).toEqual(['t0', 'guard', 'enemyPet', 't0', 'guard', 'enemyPet']);
    expect(hits(enhanced, 'ownPet').map(hit => [hit.targetId, hit.amount])).toEqual(
      baselineHits.map((hit, index) => [hit.targetId, index === 0 ? Math.floor(hit.amount * 1.08) : hit.amount]),
    );
    expect(enhanced.unit('ownPet').statuses.some(status => status.id === lionSoul)).toBe(false);
  });

  it('直接固定伤害和原施法全部落空后的法连不消耗狮魂', () => {
    vi.spyOn(SeededRng.prototype, 'chance').mockImplementation(probability => probability >= 1);
    let spellRolls = 0;
    const battle = setupSpellPet([], () => ++spellRolls > 3 ? 1 : 0);
    battle.applyStatus('ownPet', lionSoul, 99, 's');
    round(battle, { ownPet: cast(fixedAttack) });
    expect(hits(battle, 'ownPet').map(hit => hit.kind)).toEqual(['fixed']);
    expect(battle.unit('ownPet').statuses.some(status => status.id === lionSoul)).toBe(true);

    round(battle, { ownPet: cast(groupSpell) });
    expect(spellRolls).toBe(6);
    expect(hits(battle, 'ownPet').map(hit => hit.kind)).toEqual(['fixed', 'spell', 'spell', 'spell']);
    expect(battle.unit('ownPet').statuses.some(status => status.id === lionSoul)).toBe(true);
  });

  it('图腾只在狮魂实际赋予原本宠时建立主人与灵兽的同契标记', () => {
    const battle = setup('xiaoyue.path.bond', ['1.3']);
    round(battle, { s: cast(XIAOYUE_SKILL_ID.Transform, ['s']) });
    battle.unit('t0').attrs.hp = 1;
    round(battle, { s: cast(XIAOYUE_SKILL_ID.LionStrike) });
    expect(battle.unit('ownPet').statuses.some(status => status.id === lionSoul)).toBe(true);
    expect(battle.unit('s').statuses.some(status => status.id === 'xiaoyue.status.totem')).toBe(true);
    expect(battle.unit('ownPet').statuses.some(status => status.id === 'xiaoyue.status.totem_link')).toBe(true);
    expect(battle.unit('allyPet').statuses.some(status => status.id === 'xiaoyue.status.totem_link')).toBe(false);
    round(battle, { s: { type: 'summon', petId: 'reserve' } });
    expect(battle.unit('ownPet').statuses.some(status => status.id === 'xiaoyue.status.totem_link')).toBe(false);
    expect(battle.unit('reserve').statuses.some(status => status.id === 'xiaoyue.status.totem_link')).toBe(false);
  });

  it('图腾增强下一回合的狮搏，结算后消耗且不会在触发当回合误消耗', () => {
    const base = setup();
    const enhanced = setup('xiaoyue.path.bond', ['1.3']);
    for (const battle of [base, enhanced]) {
      round(battle, { s: cast(XIAOYUE_SKILL_ID.Transform, ['s']) });
      battle.unit('t0').attrs.hp = 1;
      round(battle, { s: cast(XIAOYUE_SKILL_ID.LionStrike) });
    }
    expect(enhanced.unit('s').statuses.some(status => status.id === 'xiaoyue.status.totem')).toBe(true);
    for (const battle of [base, enhanced]) round(battle, { s: cast(XIAOYUE_SKILL_ID.LionStrike, ['guard']) });
    const baseHit = hits(base, 's').find(event => event.type === 'damage' && event.targetId === 'guard');
    const enhancedHit = hits(enhanced, 's').find(event => event.type === 'damage' && event.targetId === 'guard');
    expect(baseHit?.type).toBe('damage');
    expect(enhancedHit?.type).toBe('damage');
    if (baseHit?.type === 'damage' && enhancedHit?.type === 'damage')
      expect(enhancedHit.amount).toBeGreaterThan(baseHit.amount);
    expect(enhanced.unit('s').statuses.some(status => status.id === 'xiaoyue.status.totem')).toBe(false);
  });

  it('最佳搭档只合并主人和本宠的正常行动，标记目标的两次攻击都在保护前结算', () => {
    vi.spyOn(SeededRng.prototype, 'chance').mockImplementation(probability => probability >= 1);
    const battle = setup('xiaoyue.path.bond', ['7.2']);
    expect(battle.queryCommands('s').skills.find(skill => skill.skillId === XIAOYUE_SKILL_ID.BestPartners)?.cooldownRemaining).toBe(4);
    round(battle, { s: cast(XIAOYUE_SKILL_ID.Transform, ['s']) });
    battle.unit('s').cooldowns![XIAOYUE_SKILL_ID.BestPartners] = 0;
    round(battle, {
      s: cast(XIAOYUE_SKILL_ID.BestPartners),
      ownPet: { type: 'attack', target: 't0' },
      guard: { type: 'protect', target: 't0' },
    });
    expect(hits(battle, 's')).toHaveLength(1);
    expect(hits(battle, 'ownPet')).toHaveLength(1);
    expect(hits(battle, 's')[0]).toMatchObject({ targetId: 't0' });
    expect(hits(battle, 'ownPet')[0]).toMatchObject({ targetId: 't0' });
    expect(battle.unit('s').attrs.mp).toBe(10000 - 20 - 500);
    expect(battle.unit('guard').attrs.hp).toBe(100000);
    expect(battle.log().filter(event => event.type === 'protectTrigger')).toHaveLength(0);
  });

  it('最佳搭档只强化群法中命中的标记目标，不强化主目标或法连', () => {
    vi.spyOn(SeededRng.prototype, 'chance').mockImplementation(probability => probability >= 1);
    const baseline = setupSpellPet(['7.2']);
    const enhanced = setupSpellPet(['7.2']);
    for (const [battle, markTarget] of [[baseline, 'guardPet'], [enhanced, 'guard']] as const) {
      round(battle, { s: cast(XIAOYUE_SKILL_ID.Transform, ['s']) });
      battle.unit('s').cooldowns![XIAOYUE_SKILL_ID.BestPartners] = 0;
      round(battle, { s: cast(XIAOYUE_SKILL_ID.BestPartners, [markTarget]), ownPet: cast(groupSpell) });
    }
    const baselineHits = hits(baseline, 'ownPet');
    expect(baselineHits.map(hit => hit.targetId)).toEqual(['t0', 'guard', 'enemyPet', 't0', 'guard', 'enemyPet']);
    expect(hits(enhanced, 'ownPet').map(hit => [hit.targetId, hit.amount])).toEqual(
      baselineHits.map((hit, index) => [hit.targetId, index === 1 ? Math.floor(hit.amount * 1.2) : hit.amount]),
    );
  });

  it.each([
    ['物理', { type: 'attack', target: 't0' }, 1],
    ['法术', cast(groupSpell), 5],
  ] as const)('本宠以%s击倒最佳搭档标记目标后，旧狮魂已消耗且新狮魂留到下一次行动', (_kind, command, expectedHits) => {
    vi.spyOn(SeededRng.prototype, 'chance').mockImplementation(probability => probability >= 1);
    const battle = setupSpellPet(['7.2']);
    battle.applyStatus('t0', partnerMark, 2, 's');
    battle.applyStatus('ownPet', partnerPet, 2, 's');
    battle.applyStatus('ownPet', lionSoul, 99, 's');
    battle.unit('t0').attrs.hp = 1;
    const logStart = battle.log().length;
    round(battle, { ownPet: command });

    expect(battle.unit('t0').flags.downed).toBe(true);
    expect(hits(battle, 'ownPet')).toHaveLength(expectedHits);
    const events = battle.log().slice(logStart);
    const soulEvents = events.filter(event => 'statusId' in event && event.statusId === lionSoul);
    expect(soulEvents.map(event => event.type)).toEqual(['statusRemoved', 'statusApplied']);
    expect(events.indexOf(soulEvents[1])).toBeGreaterThan(events.findLastIndex(event => event.type === 'damage' && event.sourceId === 'ownPet'));
    expect(battle.unit('ownPet').statuses.some(status => status.id === lionSoul)).toBe(true);

    round(battle, { ownPet: { type: 'attack', target: 'guard' } });
    expect(battle.unit('ownPet').statuses.some(status => status.id === lionSoul)).toBe(false);
  });

  it('最佳搭档在无本宠时不可施放；出手前本宠倒地不扣 500 法力', () => {
    const noPet = setup('xiaoyue.path.bond', ['7.2'], false);
    round(noPet, { s: cast(XIAOYUE_SKILL_ID.Transform, ['s']) });
    noPet.unit('s').cooldowns![XIAOYUE_SKILL_ID.BestPartners] = 0;
    expect(noPet.queryCommands('s').skills.find(skill => skill.skillId === XIAOYUE_SKILL_ID.BestPartners)?.reasons)
      .toContain('skill-condition');

    const battle = setup('xiaoyue.path.bond', ['7.2']);
    round(battle, { s: cast(XIAOYUE_SKILL_ID.Transform, ['s']) });
    battle.unit('s').cooldowns![XIAOYUE_SKILL_ID.BestPartners] = 0;
    battle.unit('t0').attrs.speed = 2000;
    battle.unit('ownPet').attrs.hp = 1;
    const beforeMp = battle.unit('s').attrs.mp;
    round(battle, {
      s: cast(XIAOYUE_SKILL_ID.BestPartners),
      t0: { type: 'attack', target: 'ownPet' },
    });
    expect(battle.unit('ownPet').flags.dead).toBe(true);
    expect(battle.unit('s').attrs.mp).toBe(beforeMp);
    expect(hits(battle, 's')).toHaveLength(0);
  });

  it('最佳搭档的旧目标标记不能让换入灵兽领取狮魂', () => {
    const battle = setup('xiaoyue.path.bond', ['7.2']);
    battle.applyStatus('t0', partnerMark, 2, 's');
    battle.applyStatus('ownPet', partnerPet, 2, 's');
    battle.unit('ownPet').flags.benched = true;
    battle.unit('ownPet').statuses = [];
    battle.unit('reserve').flags.benched = false;
    battle.unit('t0').attrs.hp = 1;
    round(battle, { reserve: { type: 'attack', target: 't0' } });
    expect(battle.unit('t0').flags.downed).toBe(true);
    expect(battle.unit('reserve').statuses.some(status => status.id === lionSoul)).toBe(false);
  });

  it('救主只在本宠足额且无禁复活时精确支付气血，每场不重复触发', () => {
    vi.spyOn(SeededRng.prototype, 'chance').mockImplementation(probability => probability >= 0.5);
    const battle = setup('xiaoyue.path.bond', ['6.3']);
    battle.unit('s').attrs.hp = 0;
    battle.unit('s').flags.downed = true;
    battle.unit('ownPet').attrs.hp = 3001;
    round(battle);
    expect(battle.unit('s').flags.downed).toBe(false);
    expect(battle.unit('s').attrs.hp).toBe(1000);
    expect(battle.unit('ownPet').attrs.hp).toBe(1);
    expect(battle.log().filter(event => event.type === 'hpCost')).toHaveLength(1);
    battle.unit('s').attrs.hp = 0;
    battle.unit('s').flags.downed = true;
    round(battle);
    expect(battle.unit('s').flags.downed).toBe(true);
    expect(battle.log().filter(event => event.type === 'hpCost')).toHaveLength(1);

    const blocked = setup('xiaoyue.path.bond', ['6.3'], true,
      [{ id: 'test.revive-block', name: '禁复活', kind: 'test.revive-block', blocksRevive: true, persistWhenDowned: true }]);
    blocked.applyStatus('s', 'test.revive-block', 3);
    blocked.unit('s').attrs.hp = 0;
    blocked.unit('s').flags.downed = true;
    blocked.unit('ownPet').attrs.hp = 3001;
    round(blocked);
    expect(blocked.unit('s').flags.downed).toBe(true);
    expect(blocked.unit('ownPet').attrs.hp).toBe(3001);
  });

  it('逞凶只增强对被击倒玩家所属灵兽的伤害，倒地标记保留且不波及其他敌宠', () => {
    const baseline = setup();
    const marked = setup('xiaoyue.path.bond', ['6.2']);
    const other = setup('xiaoyue.path.bond', ['6.2']);
    for (const [battle, petTarget] of [[baseline, 'enemyPet'], [marked, 'enemyPet'], [other, 'guardPet']] as const) {
      round(battle, { s: cast(XIAOYUE_SKILL_ID.Transform, ['s']) });
      battle.unit('t0').attrs.hp = 1;
      round(battle, {
        s: cast(XIAOYUE_SKILL_ID.LionStrike),
        ownPet: { type: 'attack', target: petTarget },
      });
    }
    expect(marked.unit('t0').flags.downed).toBe(true);
    expect(marked.unit('t0').statuses.some(status => status.id === 'xiaoyue.status.chengxiong')).toBe(true);
    const amount = (battle: Battle) => hits(battle, 'ownPet').find(event => event.type === 'damage')?.amount ?? 0;
    expect(amount(marked)).toBeGreaterThan(amount(baseline));
    expect(amount(other)).toBe(amount(baseline));
  });
});

describe('啸岳岭血啸关键经脉', () => {
  it('威压只由狮搏命中敌方灵兽触发，并限制其下一行动', () => {
    vi.spyOn(SeededRng.prototype, 'chance').mockImplementation(probability => probability >= 0.35);
    const battle = setup('xiaoyue.path.blood', ['3.1']);
    round(battle, { s: cast(XIAOYUE_SKILL_ID.Transform, ['s']) });
    round(battle, { s: cast(XIAOYUE_SKILL_ID.LionStrike, ['enemyPet']) });
    expect(battle.unit('enemyPet').statuses.some(status => status.id === 'xiaoyue.status.pressure_pending' ||
      status.id === 'xiaoyue.status.pressure_stun')).toBe(true);
    expect(battle.unit('t0').statuses.some(status => status.id.startsWith('xiaoyue.status.pressure'))).toBe(false);
    const before = hits(battle, 'enemyPet').length;
    round(battle, { enemyPet: { type: 'attack', target: 's' } });
    expect(hits(battle, 'enemyPet')).toHaveLength(before);
  });
  it('爪印由本人首次命中叠层，下一回合同目标首击追加固定人物等级伤害', () => {
    const battle = setup('xiaoyue.path.blood', ['1.1']);
    round(battle, { s: cast(XIAOYUE_SKILL_ID.Transform, ['s']) });
    round(battle, { s: cast(XIAOYUE_SKILL_ID.LionStrike) });
    const first = hits(battle, 's').at(-1);
    expect(first?.type).toBe('damage');
    expect(battle.unit('t0').statuses.find(status => status.id === 'xiaoyue.status.claw')?.stacks).toBe(1);
    round(battle, { s: cast(XIAOYUE_SKILL_ID.LionStrike) });
    const second = hits(battle, 's').at(-1);
    if (first?.type === 'damage' && second?.type === 'damage') expect(second.amount - first.amount).toBe(180);
    expect(battle.unit('t0').statuses.find(status => status.id === 'xiaoyue.status.claw')?.stacks).toBe(2);
  });

  it('无旧爪印的连环击首段叠印，不让后续段偷取本回合首次攻击加值', () => {
    const base = setup('xiaoyue.path.blood');
    const marked = setup('xiaoyue.path.blood', ['1.1']);
    for (const battle of [base, marked]) {
      round(battle, { s: cast(XIAOYUE_SKILL_ID.Transform, ['s']) });
      round(battle, { s: cast(XIAOYUE_SKILL_ID.ChainStrike) });
    }
    expect(hits(marked, 's')).toEqual(hits(base, 's'));
    expect(marked.unit('t0').statuses.find(status => status.id === 'xiaoyue.status.claw')?.stacks).toBe(1);
  });

  it('乱击把连环击取消兽形改为扣两回合，同时只增强本次连环击', () => {
    const normal = setup('xiaoyue.path.blood');
    const enhanced = setup('xiaoyue.path.blood', ['6.2']);
    for (const battle of [normal, enhanced]) {
      round(battle, { s: cast(XIAOYUE_SKILL_ID.Transform, ['s']) });
      round(battle, { s: cast(XIAOYUE_SKILL_ID.ChainStrike) });
    }
    expect(normal.unit('s').statuses.some(status => status.id === 'xiaoyue.status.transform')).toBe(false);
    expect(enhanced.unit('s').statuses.some(status => status.id === 'xiaoyue.status.transform')).toBe(true);
    expect(hits(enhanced, 's')[0].amount).toBeGreaterThan(hits(normal, 's')[0].amount);
  });
});
