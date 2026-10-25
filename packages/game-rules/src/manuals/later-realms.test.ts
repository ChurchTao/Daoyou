import { describe, expect, it } from 'vitest';
import { CommandType, DamageKind, DamageOrigin, EffectType, EventType, SkillTag, StatusCategory, StatusHit, TargetSide } from '@daoyou/combat-core/enums';
import { createBattle, restoreBattle } from '@daoyou/combat-core/session';
import type { BattleSession } from '@daoyou/combat-core/session';
import type { CreateBattleInput, SkillDef } from '@daoyou/combat-core/types';
import { COMBAT_V6_BASE_PROJECTION_VERSIONS } from '@daoyou/game-domain/combat';
import type { ManualSlotV1 } from '@daoyou/game-domain/manuals';
import { CHARACTER_MANUALS_V1 } from '@daoyou/game-content/manuals';
import { COMBAT_V6_SECT_DEFINITIONS } from '@daoyou/game-content/sects';
import { createDaoyouRuleset } from '../combat/daoyou/index.js';
import { compileCharacterManualsV1 } from './compiler.js';
import { classifyManualStatuses } from './later-mechanisms.js';

const sects = Object.values(COMBAT_V6_SECT_DEFINITIONS);
const sectSkills = sects.flatMap(sect => [
  ...sect.skills,
  ...sect.paths.flatMap(path => [
    ...(path.grantSkills ?? []), ...(path.foundationPassives ?? []),
    ...path.nodes.flatMap(node => [...(node.grantSkills ?? []), ...(node.passives ?? [])]),
  ]),
]).map(skill => skill.definition);
const sectStatuses = sects.flatMap(sect => sect.statuses);

function realSkill(id: string): SkillDef {
  const skill = sectSkills.find(skill => skill.id === id);
  if (!skill) throw new Error(`Missing sect skill ${id}`);
  return structuredClone(skill);
}

function projection(names: string[], level = 9, guaranteedChance = false) {
  const definitions = CHARACTER_MANUALS_V1.map(manual =>
    guaranteedChance && names.includes(manual.name) && ['attackDispel', 'selfCleanse'].includes(manual.mechanism.type)
      ? { ...manual, mechanism: { ...manual.mechanism, valueAt1: 0.99, valueAt9: 1 } }
      : manual,
  );
  const manuals = names.map(name => {
    const manual = definitions.find(manual => manual.name === name);
    if (!manual) throw new Error(`Missing manual ${name}`);
    return manual;
  });
  const result = compileCharacterManualsV1({
    realm: '大乘',
    state: {
      version: 1, revision: 0,
      learned: manuals.map((manual, index) => ({ manualId: manual.id, level, unlockedLevel: level <= 3 ? 3 : level <= 6 ? 6 : 9, slot: (5 + index) as ManualSlotV1 })),
      build: { slots: manuals.map((manual, index) => ({ slot: (5 + index) as ManualSlotV1, manualId: manual.id })) },
    },
  }, definitions);
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  return result.projection;
}

const strikeId = 'lingxiao.skill.triple';
function controlledStrike(effects: SkillDef['effects'] = [{ type: EffectType.PhysicalHit }]): SkillDef {
  const skill = realSkill(strikeId);
  return {
    ...skill, tags: [SkillTag.Physical], targeting: { side: TargetSide.Enemy, count: 1 },
    effects, successEffects: undefined, costHp: undefined, costMp: undefined,
    successCostHp: undefined, successCostMp: undefined,
    requireHpRatio: undefined, requireHpAboveRatio: undefined, recoveryStatusId: undefined,
  };
}

function setup(options: {
  names?: string[]; targetNames?: string[]; level?: number; skills?: SkillDef[];
  ally?: boolean; secondary?: boolean; guaranteedChance?: boolean;
  hp?: number; mp?: number; maxMp?: number; sourceSpeed?: number; targetSpeed?: number;
  seed?: number;
} = {}) {
  const own = projection(options.names ?? [], options.level, options.guaranteedChance);
  const opponent = projection(options.targetNames ?? [], options.level, options.guaranteedChance);
  const skills = options.skills ?? [controlledStrike()];
  const attrs = { hp: options.hp ?? 10000, maxHp: 10000, mp: options.mp ?? 10000, maxMp: options.maxMp ?? 10000,
    physicalAtk: 1000, magicAtk: 1000, physicalDef: 0, magicDef: 0, speed: options.sourceSpeed ?? 20,
    critRate: 0, spellCritRate: 0, physicalFuryRate: 0 };
  const input: CreateBattleInput = {
    seed: options.seed ?? 42,
    versions: COMBAT_V6_BASE_PROJECTION_VERSIONS,
    ruleset: {
      ...createDaoyouRuleset({ formulas: {
        baseDamage: ({ source, target, coeff, power, kind, fury, furyMultiplier }) => kind === DamageKind.Fixed ? power :
          Math.max(1, ((kind === DamageKind.Spell ? source.attrs.magicAtk - target.attrs.magicDef : source.attrs.physicalAtk * (fury ? furyMultiplier ?? 1 : 1) - target.attrs.physicalDef) * coeff) + power),
        physicalHitChance: () => 1, spellHitChance: () => 1,
        sealHitChance: () => 1, sealChanceCeil: 1,
        fluctuationMin: 1, fluctuationMax: 1, defendPhysicalFactor: 1,
      } }),
      decideCommand: () => ({ type: CommandType.Defend }),
    },
    skills: [...skills, ...own.skills, ...opponent.skills],
    statusDefs: classifyManualStatuses([...sectStatuses, ...own.statusDefs, ...opponent.statusDefs]),
    units: [
      { id: 'a', name: 'a', side: 0, kind: 'player', level: 10, attrs,
        skills: skills.map(skill => skill.id), skillLevels: Object.fromEntries(skills.map(skill => [skill.id, 10])), passives: own.passiveSkillIds },
      { id: 'b', name: 'b', side: 1, kind: 'player', level: 10, attrs: { ...attrs, hp: 10000, speed: options.targetSpeed ?? 10 },
        skills: skills.map(skill => skill.id), skillLevels: Object.fromEntries(skills.map(skill => [skill.id, 10])), passives: opponent.passiveSkillIds },
      ...(options.ally ? [{ id: 'ally', name: 'ally', side: 0 as const, kind: 'player' as const, attrs: { ...attrs, hp: 5000, speed: 1 } }] : []),
      ...(options.secondary ? [{ id: 'secondary', name: 'secondary', side: 1 as const, kind: 'player' as const, attrs: { ...attrs, speed: 1 } }] : []),
    ],
  };
  return { battle: createBattle(input), input };
}

function cast(battle: BattleSession, skillId = strikeId, sourceId = 'a', targetIds = ['b']) {
  battle.submit(sourceId, { type: CommandType.Skill, skillId, targets: targetIds });
  battle.lockAndResolve();
}
function shield(battle: BattleSession, unitId: string, current: number) {
  battle.unit(unitId).barriers.push({ id: 'fixture', kind: 'fixture', name: 'fixture', current, sourceId: unitId, appliedRound: battle.state.round, remainingRounds: 5 });
}
function barrierTotal(battle: BattleSession, unitId: string) {
  return battle.unit(unitId).barriers.reduce((sum, barrier) => sum + barrier.current, 0);
}

describe('later realm manual battle contracts', () => {
  it('道经 strengthens only active primary direct damage, including ordinary fixed damage', () => {
    const group = controlledStrike([
      { type: EffectType.FixedHit, power: 1000 },
      { type: EffectType.FixedHit, power: 1000, percentageDamage: true },
      { type: EffectType.FixedHit, power: 1000, origin: DamageOrigin.HookDerived },
    ]);
    group.targeting.count = 2;
    const { battle } = setup({ names: ['道经'], skills: [group], secondary: true });
    cast(battle, group.id, 'a', ['b', 'secondary']);
    expect(battle.unit('b').attrs.hp).toBe(6930);
    expect(battle.unit('secondary').attrs.hp).toBe(7000);
    const basic = setup({ names: ['道经'] }).battle;
    basic.submit('a', { type: CommandType.Attack, target: 'b' });
    basic.lockAndResolve();
    expect(basic.unit('b').attrs.hp).toBe(9000);
  });

  it('六道 strengthens real group secondary fixed damage, while primary, percentage and derived damage remain unchanged', () => {
    const group = realSkill('youdu.skill.edict');
    group.targeting = { side: TargetSide.Enemy, count: 2 };
    group.effects = [
      { type: EffectType.FixedHit, power: 1000 },
      { type: EffectType.FixedHit, power: 1000, percentageDamage: true },
      { type: EffectType.FixedHit, power: 1000, origin: DamageOrigin.HookDerived },
    ];
    group.costMp = undefined;
    const { battle } = setup({ names: ['六道轮回天功'], skills: [group], secondary: true });
    cast(battle, group.id, 'a', ['b', 'secondary']);
    expect(battle.unit('b').attrs.hp).toBe(7000);
    expect(battle.unit('secondary').attrs.hp).toBe(6820);
  });

  it('五藏 creates one capped opening barrier and restoring a snapshot does not generate it again', () => {
    const low = setup({ names: ['五藏锻元功'], maxMp: 1000, mp: 1000 });
    const high = setup({ names: ['五藏锻元功'], maxMp: 100000, mp: 1 });
    const lowShield = barrierTotal(low.battle, 'a');
    const highShield = barrierTotal(high.battle, 'a');
    expect(lowShield).toBe(160);
    expect(highShield).toBeGreaterThan(lowShield);
    expect(highShield).toBeLessThanOrEqual(1000);
    expect(high.battle.unit('a').attrs.mp).toBe(1);
    const restored = restoreBattle(high.input, high.battle.snapshot(), [...high.battle.log()]);
    expect(barrierTotal(restored, 'a')).toBe(highShield);
    restored.lockAndResolve();
    expect(barrierTotal(restored, 'a')).toBeLessThanOrEqual(highShield);
    expect(restored.log().filter(event => event.type === EventType.BarrierChanged && event.sourceId === 'a')).toHaveLength(1);
  });

  it('百脉 creates one refreshed shield only after an executed defend, never from a controlled or resting command', () => {
    const normal = setup({ names: ['百脉炼宝决'] }).battle;
    normal.submit('a', { type: CommandType.Defend });
    normal.lockAndResolve();
    expect(barrierTotal(normal, 'a')).toBe(700);
    normal.submit('a', { type: CommandType.Defend });
    normal.lockAndResolve();
    expect(barrierTotal(normal, 'a')).toBe(700);
    expect(normal.unit('a').barriers).toHaveLength(1);
    const controlled = setup({ names: ['百脉炼宝决'] }).battle;
    controlled.applyStatus('a', 'lingxiao.status.recovery', 2, 'a');
    controlled.submit('a', { type: CommandType.Defend });
    controlled.lockAndResolve();
    expect(barrierTotal(controlled, 'a')).toBe(0);
    const resting = setup({ names: ['百脉炼宝决'] }).battle;
    resting.unit('a').flags.skipNextAction = true;
    resting.submit('a', { type: CommandType.Defend });
    resting.lockAndResolve();
    expect(barrierTotal(resting, 'a')).toBe(0);
  });

  it('虚空 protects group secondary physical and spell targets, without protecting the primary or fixed damage', () => {
    const group = controlledStrike([
      { type: EffectType.PhysicalHit }, { type: EffectType.SpellHit }, { type: EffectType.FixedHit, power: 1000 },
    ]);
    group.targeting.count = 2;
    const { battle, input } = setup({ targetNames: ['虚空经'], skills: [group], secondary: true });
    input.units.find(unit => unit.id === 'secondary')!.passives = [...battle.unit('b').passives];
    const both = createBattle(input);
    cast(both, group.id, 'a', ['b', 'secondary']);
    expect(both.unit('b').attrs.hp).toBe(7000);
    expect(both.unit('secondary').attrs.hp).toBe(7360);
  });

  it('太阳 consumes extra shield without increasing unshielded HP damage or spilling bonus destruction into HP', () => {
    const spell = realSkill('tianyan.skill.fire');
    spell.effects = [{ type: EffectType.SpellHit }];
    spell.costMp = undefined;
    const large = setup({ names: ['太阳真经'], skills: [spell] }).battle;
    shield(large, 'b', 2000);
    cast(large, spell.id);
    expect(barrierTotal(large, 'b')).toBe(820);
    expect(large.unit('b').attrs.hp).toBe(10000);
    const small = setup({ names: ['太阳真经'], skills: [spell] }).battle;
    shield(small, 'b', 500);
    cast(small, spell.id);
    expect(small.unit('b').attrs.hp).toBe(9500);
    const split = setup({ names: ['太阳真经'], skills: [spell] }).battle;
    shield(split, 'b', 1000);
    split.unit('b').barriers.push({ ...split.unit('b').barriers[0]!, id: 'second', kind: 'second' });
    cast(split, spell.id);
    expect(barrierTotal(split, 'b')).toBe(820);
    expect(split.unit('b').attrs.hp).toBe(10000);
    const bare = setup({ names: ['太阳真经'], skills: [spell] }).battle;
    cast(bare, spell.id);
    expect(bare.unit('b').attrs.hp).toBe(9000);
  });

  it('杀戮 uses whole-action actual main-target damage rather than the first segment', () => {
    const triple = controlledStrike([{ type: EffectType.PhysicalHit, hits: 3 }]);
    const single = controlledStrike([{ type: EffectType.PhysicalHit, coeff: 3 }]);
    const many = setup({ names: ['杀戮仙诀'], skills: [triple] }).battle;
    const one = setup({ names: ['杀戮仙诀'], skills: [single] }).battle;
    shield(many, 'b', 500);
    shield(one, 'b', 500);
    cast(many);
    cast(one);
    expect(barrierTotal(many, 'a')).toBe(300);
    expect(barrierTotal(one, 'a')).toBe(300);
    const overkill = setup({ names: ['杀戮仙诀'], skills: [triple] }).battle;
    overkill.unit('b').attrs.hp = 500;
    cast(overkill);
    expect(barrierTotal(overkill, 'a')).toBe(60);
  });

  it('梵圣 restores real wounds from native actual damage, without counting shields or direct percentage damage', () => {
    const normal = setup({ names: ['梵圣真魔功'], hp: 5000 }).battle;
    cast(normal);
    expect(normal.unit('a').attrs.hp, JSON.stringify(normal.log())).toBe(5070);
    const blocked = setup({ names: ['梵圣真魔功'], hp: 5000 }).battle;
    shield(blocked, 'b', 10000);
    cast(blocked);
    expect(blocked.unit('a').attrs.hp).toBe(5000);
    const ratio = setup({ names: ['梵圣真魔功'], hp: 5000, skills: [controlledStrike([{ type: EffectType.FixedHit, power: 1000, percentageDamage: true }])] }).battle;
    cast(ratio);
    expect(ratio.unit('a').attrs.hp).toBe(5000);
  });

  it('杀戮 and 梵圣 include spell copies in one shared action budget, without treating each copy or segment as a new action', () => {
    const spell = realSkill('tianyan.skill.fire');
    spell.effects = [{ type: EffectType.SpellHit, hits: 3 }];
    spell.costMp = undefined;
    const repeat: SkillDef = { id: 'fixture.repeat', name: 'repeat', tags: [SkillTag.Passive],
      targeting: { side: TargetSide.Self }, effects: [], innate: { spellRepeat: { chance: 1, factor: 1 } } };
    const { input } = setup({ names: ['杀戮仙诀', '梵圣真魔功'], skills: [spell], hp: 5000 });
    input.skills!.push(repeat);
    input.units[0]!.passives!.push(repeat.id);
    const battle = createBattle(input);
    cast(battle, spell.id);
    expect(battle.unit('b').attrs.hp).toBe(4000);
    expect(battle.unit('a').attrs.hp).toBe(5350);
    expect(barrierTotal(battle, 'a')).toBe(600);
    expect(battle.log().filter(event => event.type === EventType.BarrierChanged && event.sourceId === 'a')).toHaveLength(1);
  });

  it('古神 reduces only the excess of large physical or spell hits, before shields, and leaves ordinary fixed damage unchanged', () => {
    for (const effect of [EffectType.PhysicalHit, EffectType.SpellHit] as const) {
      const small = setup({ targetNames: ['古神诀'], skills: [controlledStrike([{ type: effect }])] }).battle;
      cast(small);
      expect(small.unit('b').attrs.hp).toBe(9000);
      const large = setup({ targetNames: ['古神诀'], skills: [controlledStrike([{ type: effect, coeff: 3 }])] }).battle;
      shield(large, 'b', 500);
      cast(large);
      expect(large.unit('b').attrs.hp).toBe(7770);
    }
    const fixed = setup({ targetNames: ['古神诀'], skills: [controlledStrike([{ type: EffectType.FixedHit, power: 3000 }])] }).battle;
    cast(fixed);
    expect(fixed.unit('b').attrs.hp).toBe(7000);
  });

  it('太皇 adds actual physical fury using seeded rolls, without adding fury to spells', () => {
    const base = setup({ seed: 7 }).battle;
    const empowered = setup({ names: ['太皇经'], seed: 7 }).battle;
    cast(base);
    cast(empowered);
    expect(empowered.log().some(event => event.type === EventType.Hit && event.sourceId === 'a' && event.fury)).toBe(true);
    expect(empowered.unit('b').attrs.hp).toBeLessThan(base.unit('b').attrs.hp);
    const spell = controlledStrike([{ type: EffectType.SpellHit }]);
    const unaltered = setup({ names: ['太皇经'], skills: [spell], seed: 7 }).battle;
    cast(unaltered);
    expect(unaltered.unit('b').attrs.hp).toBe(9000);
  });

  it('九转 ignores spell defense only against pre-existing ordinary numeric debuffs, not rule markers or a debuff applied after the hit', () => {
    const spell = controlledStrike([{ type: EffectType.SpellHit }, { type: EffectType.ApplyStatus, statusId: 'youdu.status.slow', duration: 3 }]);
    const normal = setup({ names: ['九转天功'], skills: [spell] }).battle;
    normal.unit('b').attrs.magicDef = 500;
    cast(normal);
    expect(normal.unit('b').attrs.hp).toBe(9500);
    cast(normal);
    expect(normal.unit('b').attrs.hp).toBe(8910);
    const rule = setup({ names: ['九转天功'], skills: [spell] }).battle;
    rule.unit('b').attrs.magicDef = 500;
    rule.applyStatus('b', 'youdu.status.soul_seal', 3, 'a');
    cast(rule);
    expect(rule.unit('b').attrs.hp).toBe(9500);
  });

  it('金刚 prepares on defend, weakens the next enemy whole attack after a next-round hit, and consumes the effect only once', () => {
    const twice = controlledStrike([{ type: EffectType.PhysicalHit, hits: 2 }]);
    const { battle } = setup({ names: ['金刚仙天功'], skills: [twice] });
    battle.submit('a', { type: CommandType.Defend });
    battle.lockAndResolve();
    expect(battle.unit('a').statuses.some(status => status.id === 'character_manual.jingang_xian.ready')).toBe(true);
    battle.submit('a', { type: CommandType.Skill, skillId: strikeId, targets: ['b'] });
    cast(battle, strikeId, 'b', ['a']);
    expect(battle.unit('a').attrs.hp).toBe(8300);
    expect(battle.unit('b').statuses.some(status => status.kind === 'character_manual.jingang_xian.weaken')).toBe(false);
    cast(battle, strikeId, 'b', ['a']);
    expect(battle.unit('a').attrs.hp).toBe(6300);
    const blocked = setup({ names: ['金刚仙天功'] }).battle;
    blocked.submit('a', { type: CommandType.Defend });
    blocked.lockAndResolve();
    shield(blocked, 'b', 5000);
    cast(blocked);
    expect(blocked.unit('b').statuses.some(status => status.kind === 'character_manual.jingang_xian.weaken')).toBe(false);
  });

  it('金刚 keeps each owner’s learned strength when different levels share one battle and one status registry', () => {
    const low = projection(['金刚仙天功'], 1);
    const high = projection(['金刚仙天功'], 9);
    const { input } = setup();
    input.skills = [controlledStrike(), ...low.skills, ...high.skills];
    input.statusDefs = classifyManualStatuses([...sectStatuses, ...low.statusDefs, ...high.statusDefs]);
    input.units[0]!.passives = low.passiveSkillIds;
    input.units[0]!.skillOverrides = low.skills;
    input.units[1]!.passives = high.passiveSkillIds;
    input.units[1]!.skillOverrides = high.skills;
    const battle = createBattle(input);
    battle.submit('a', { type: CommandType.Defend });
    battle.submit('b', { type: CommandType.Defend });
    battle.lockAndResolve();
    battle.submit('a', { type: CommandType.Skill, skillId: strikeId, targets: ['b'] });
    cast(battle, strikeId, 'b', ['a']);
    expect(battle.unit('a').attrs.hp).toBe(9050);
    expect(battle.unit('b').attrs.hp).toBe(9000);
    expect(battle.unit('a').statuses.some(status => status.kind === 'character_manual.jingang_xian.weaken')).toBe(true);
    cast(battle);
    expect(battle.unit('b').attrs.hp).toBe(8150);
  });

  it.each(['魂毒', '余火'])('太阴 and 万毒 modify capped %s HP ticks exactly once without changing MP ticks or shield bypass', name => {
    const status = sectStatuses.find(status => status.name === name)!;
    const apply = controlledStrike([{ type: EffectType.ApplyStatus, statusId: status.id, duration: 2 }]);
    const base = setup({ skills: [apply] }).battle;
    const modified = setup({ names: ['太阴真经'], targetNames: ['万毒混元身'], skills: [apply] }).battle;
    shield(base, 'b', 2000);
    shield(modified, 'b', 2000);
    cast(base);
    cast(modified);
    const tick = 10000 - base.unit('b').attrs.hp;
    expect(tick).toBeGreaterThan(0);
    expect(10000 - modified.unit('b').attrs.hp).toBe(Math.floor(tick * 1.18 * 0.82));
    expect(modified.unit('b').attrs.mp).toBe(base.unit('b').attrs.mp);
    expect(barrierTotal(modified, 'b')).toBe(2000);
  });

  it('西皇 follows actual 无相 main-target healing and ignores hostile or downed targets', () => {
    const healing = realSkill('wuxiang.skill.nectar');
    const { battle } = setup({ names: ['西皇经'], skills: [healing], ally: true, guaranteedChance: true });
    const slow = sectStatuses.find(status => status.name === '滞魂')!;
    battle.applyStatus('ally', slow.id, 3, 'b');
    cast(battle, healing.id, 'a', ['ally']);
    expect(battle.unit('ally').attrs.hp).toBeGreaterThan(5000);
    expect(barrierTotal(battle, 'ally')).toBeGreaterThan(0);
    expect(battle.unit('ally').statuses.some(status => status.id === slow.id)).toBe(true);
    expect(barrierTotal(battle, 'b')).toBe(0);
    const downed = setup({ names: ['西皇经'], skills: [healing], ally: true, guaranteedChance: true }).battle;
    downed.unit('ally').attrs.hp = 0;
    downed.unit('ally').flags.downed = true;
    cast(downed, healing.id, 'a', ['ally']);
    expect(barrierTotal(downed, 'ally')).toBe(0);
    expect(barrierTotal(downed, 'b')).toBe(0);
  });

  it.each([[1, 7080], [9, 7240]])('九天 protects subsequent native segments at level %i and resets each round', (level, hp) => {
    const triple = controlledStrike([{ type: EffectType.PhysicalHit, hits: 3 }]);
    const { battle } = setup({ targetNames: ['九天十地经'], level, skills: [triple] });
    cast(battle);
    expect(battle.unit('b').attrs.hp).toBe(hp);
    cast(battle);
    expect(battle.unit('b').attrs.hp).toBe(2 * hp - 10000);
  });

  it('九天 carries protection across attackers and physical/spell damage, without depending on the defender sect', () => {
    const spell = realSkill('tianyan.skill.fire');
    spell.effects = [{ type: EffectType.SpellHit }];
    spell.costMp = undefined;
    const { battle, input } = setup({ targetNames: ['九天十地经'], skills: [controlledStrike(), spell], ally: true });
    input.units.find(unit => unit.id === 'ally')!.skills = [spell.id];
    input.units.find(unit => unit.id === 'ally')!.attrs = { ...input.units[0]!.attrs, speed: 15 };
    const multiple = createBattle(input);
    multiple.submit('a', { type: CommandType.Skill, skillId: strikeId, targets: ['b'] });
    multiple.submit('ally', { type: CommandType.Skill, skillId: spell.id, targets: ['b'] });
    multiple.lockAndResolve();
    expect(multiple.unit('b').attrs.hp).toBe(8120);
    expect(battle.unit('b').attrs.hp).toBe(10000);
  });

  it('九天 ignores fully absorbed hits, fixed damage, DOT and self damage as activation sources', () => {
    const { battle } = setup({ targetNames: ['九天十地经'], skills: [controlledStrike([
      { type: EffectType.FixedHit, power: 1000 },
      { type: EffectType.FixedHit, power: 1000, origin: DamageOrigin.Status },
      { type: EffectType.PhysicalHit },
      { type: EffectType.SpellHit },
    ])] });
    cast(battle);
    expect(battle.unit('b').attrs.hp).toBe(6120);
    const blocked = setup({ targetNames: ['九天十地经'], skills: [controlledStrike([{ type: EffectType.PhysicalHit, hits: 4 }])] }).battle;
    shield(blocked, 'b', 2000);
    cast(blocked);
    expect(blocked.unit('b').attrs.hp).toBe(8120);
    const dot = setup({ targetNames: ['九天十地经'] }).battle;
    dot.applyStatus('b', 'youdu.status.poison', 3, 'a');
    dot.lockAndResolve();
    expect(dot.unit('b').attrs.hp).toBeLessThan(10000);
    expect(dot.unit('b').combatFacts?.['character_manual.jiutian_shidi.hurtRound']).toBeUndefined();
    const self = setup({ names: ['九天十地经'], skills: [controlledStrike([{ type: EffectType.LoseHp, power: 100, targeting: { side: TargetSide.Self } }])] }).battle;
    self.submit('a', { type: CommandType.Skill, skillId: strikeId, targets: ['b'] });
    self.submit('b', { type: CommandType.Attack, target: 'a' });
    self.lockAndResolve();
    expect(self.unit('a').attrs.hp).toBe(8900);
  });

  it('九天 also protects later spell copies within the same action', () => {
    const spell = realSkill('tianyan.skill.fire');
    spell.effects = [{ type: EffectType.SpellHit }];
    spell.costMp = undefined;
    const repeat: SkillDef = { id: 'fixture.repeat', name: 'repeat', tags: [SkillTag.Passive],
      targeting: { side: TargetSide.Self }, effects: [], innate: { spellRepeat: { chance: 1, factor: 1 } } };
    const { input } = setup({ targetNames: ['九天十地经'], skills: [spell] });
    input.skills!.push(repeat);
    input.units[0]!.passives!.push(repeat.id);
    const battle = createBattle(input);
    cast(battle, spell.id);
    expect(battle.unit('b').attrs.hp).toBe(8120);
  });

  it('吞天 removes an eligible numeric buff once per two rounds, retaining rule markers and non-dispellable effects', () => {
    const { battle } = setup({ names: ['吞天魔功'], guaranteedChance: true });
    battle.applyStatus('b', 'lingxiao.status.sword_aura', 5, 'b');
    battle.applyStatus('b', 'youdu.status.insight', 5, 'b');
    battle.applyStatus('b', 'lingxiao.status.bravery', 5, 'a');
    cast(battle);
    expect(battle.unit('b').statuses.some(status => status.id === 'lingxiao.status.sword_aura')).toBe(false);
    expect(battle.unit('b').statuses.some(status => status.id === 'youdu.status.insight')).toBe(true);
    expect(battle.unit('b').statuses.some(status => status.id === 'lingxiao.status.bravery')).toBe(true);
    battle.applyStatus('b', 'lingxiao.status.clarity', 5, 'b');
    cast(battle);
    expect(battle.unit('b').statuses.some(status => status.id === 'lingxiao.status.clarity')).toBe(true);
    cast(battle);
    expect(battle.unit('b').statuses.some(status => status.id === 'lingxiao.status.clarity')).toBe(false);
  });

  it('不灭天功 cleans enemy ordinary numeric debuffs and HP DOT at round start while leaving seals and self-applied negatives intact', () => {
    const { battle } = setup({ names: ['不灭天功'], guaranteedChance: true });
    battle.applyStatus('a', 'youdu.status.slow', 5, 'b');
    battle.applyStatus('a', 'youdu.status.poison', 5, 'b');
    battle.applyStatus('a', 'tianyan.status.seal', 5, 'b');
    battle.lockAndResolve();
    expect(battle.unit('a').statuses.some(status => status.id === 'youdu.status.slow')).toBe(false);
    expect(battle.unit('a').statuses.some(status => status.id === 'youdu.status.poison')).toBe(true);
    expect(battle.unit('a').statuses.some(status => status.id === 'tianyan.status.seal')).toBe(true);
    battle.lockAndResolve();
    expect(battle.unit('a').statuses.some(status => status.id === 'youdu.status.poison')).toBe(false);
    expect(battle.unit('a').statuses.some(status => status.id === 'tianyan.status.seal')).toBe(true);
    battle.applyStatus('a', 'youdu.status.slow', 5, 'a');
    battle.applyStatus('a', 'youdu.status.poison', 5, 'a');
    battle.lockAndResolve();
    expect(battle.unit('a').statuses.filter(status => ['youdu.status.slow', 'youdu.status.poison'].includes(status.id))).toHaveLength(2);
  });

  it('不灭经 recovers missing HP on unhurt rounds at most three times, including rounds fully protected by shields', () => {
    const { battle } = setup({ names: ['不灭经'], hp: 5000 });
    shield(battle, 'a', 10000);
    cast(battle, strikeId, 'b', ['a']);
    expect(battle.unit('a').attrs.hp).toBe(5350);
    battle.lockAndResolve();
    battle.lockAndResolve();
    expect(battle.unit('a').attrs.hp).toBe(6050);
    battle.lockAndResolve();
    expect(battle.unit('a').attrs.hp).toBe(6050);
  });

  it.each(['costHp', 'successCostHp'] as const)('不灭经 cannot recover in a round that paid %s', cost => {
    const skill = controlledStrike();
    skill[cost] = 100;
    const { battle } = setup({ names: ['不灭经'], hp: 5000, skills: [skill] });
    cast(battle);
    expect(battle.unit('a').attrs.hp).toBe(4900);
  });

  it('不灭经 records HP loss even when a same-action recovery restores it, and does not spend recovery uses at the wound cap', () => {
    const selfLoss = controlledStrike([
      { type: EffectType.LoseHp, power: 100, targeting: { side: TargetSide.Self } },
      { type: EffectType.RestoreHp, power: 100, targeting: { side: TargetSide.Self } },
    ]);
    const restored = setup({ names: ['不灭经'], hp: 5000, skills: [selfLoss] }).battle;
    cast(restored);
    expect(restored.unit('a').attrs.hp).toBe(5000);
    const capped = setup({ names: ['不灭经'], hp: 5000 }).battle;
    capped.unit('a').wound = 5000;
    for (let i = 0; i < 4; i++) capped.lockAndResolve();
    expect(capped.unit('a').attrs.hp).toBe(5000);
    capped.unit('a').wound = 0;
    for (let i = 0; i < 3; i++) capped.lockAndResolve();
    expect(capped.unit('a').attrs.hp).toBe(6050);
  });

  it('炼神 grants short resistance only after a hostile seal expires, and never proactively removes the seal', () => {
    const seal = controlledStrike([{ type: EffectType.ApplyStatus, statusId: 'tianyan.status.seal', duration: 2, hit: StatusHit.Seal }]);
    seal.tags = [SkillTag.Spell, SkillTag.Seal];
    const { battle } = setup({ names: ['炼神术'], skills: [seal], seed: 4 });
    battle.applyStatus('a', 'tianyan.status.seal', 1, 'b');
    battle.lockAndResolve();
    expect(battle.unit('a').statuses.some(status => status.id === 'tianyan.status.seal')).toBe(true);
    expect(battle.unit('a').statuses.some(status => status.kind === 'character_manual.lianshen.respite')).toBe(false);
    battle.lockAndResolve();
    expect(battle.unit('a').statuses.some(status => status.id === 'tianyan.status.seal')).toBe(false);
    expect(battle.unit('a').statuses.some(status => status.kind === 'character_manual.lianshen.respite')).toBe(true);
    cast(battle, seal.id, 'b', ['a']);
    expect(battle.unit('a').statuses.some(status => status.id === 'tianyan.status.seal')).toBe(false);
    expect(battle.log().some(event => event.type === EventType.Miss && event.sourceId === 'b' && event.targetId === 'a')).toBe(true);
    expect(battle.unit('a').statuses.some(status => status.kind === 'character_manual.lianshen.respite')).toBe(false);
    cast(battle, seal.id, 'b', ['a']);
    expect(battle.unit('a').statuses.some(status => status.id === 'tianyan.status.seal')).toBe(true);
  });

  it('炼神 recognizes friendly removal of ordinary seals, without rewarding hostile dispels or unremovable forced rest', () => {
    const cleanse = realSkill('wuxiang.skill.cleanse');
    cleanse.effects = [{ type: EffectType.Dispel, categories: [StatusCategory.Control], maxCount: 1 }];
    cleanse.targeting = { side: TargetSide.Ally, count: 1 };
    cleanse.costMp = undefined;
    cleanse.resourceCosts = undefined;
    cleanse.requirement = undefined;
    cleanse.initialCooldownRounds = undefined;
    cleanse.cooldownRounds = undefined;
    const friendly = setup({ names: ['炼神术'], skills: [cleanse], ally: true }).battle;
    friendly.unit('ally').skills = [cleanse.id];
    friendly.applyStatus('a', 'tianyan.status.seal', 3, 'b');
    cast(friendly, cleanse.id, 'ally', ['a']);
    expect(friendly.unit('a').statuses.some(status => status.kind === 'character_manual.lianshen.respite')).toBe(true);
    const hostileCleanse = { ...cleanse, targeting: { side: TargetSide.Enemy, count: 1 } };
    const hostile = setup({ names: ['炼神术'], skills: [hostileCleanse] }).battle;
    hostile.applyStatus('a', 'tianyan.status.seal', 3, 'b');
    cast(hostile, cleanse.id, 'b', ['a']);
    expect(hostile.unit('a').statuses.some(status => status.id === 'tianyan.status.seal')).toBe(false);
    expect(hostile.unit('a').statuses.some(status => status.kind === 'character_manual.lianshen.respite')).toBe(false);
    const rest = setup({ names: ['炼神术'] }).battle;
    rest.applyStatus('a', 'lingxiao.status.recovery', 1, 'a');
    rest.lockAndResolve();
    rest.lockAndResolve();
    expect(rest.unit('a').statuses.some(status => status.kind === 'character_manual.lianshen.respite')).toBe(false);
    // Confusion is a removable control via commandPolicy, without blocksSpell.
    const confused = setup({ names: ['炼神术'] }).battle;
    confused.applyStatus('a', 'lingxiao.status.confuse', 1, 'b');
    confused.lockAndResolve();
    confused.lockAndResolve();
    expect(confused.unit('a').statuses.some(status => status.kind === 'character_manual.lianshen.respite')).toBe(true);
    const selfApplied = setup({ names: ['炼神术'] }).battle;
    selfApplied.applyStatus('a', 'tianyan.status.seal', 1, 'a');
    selfApplied.lockAndResolve();
    selfApplied.lockAndResolve();
    expect(selfApplied.unit('a').statuses.some(status => status.kind === 'character_manual.lianshen.respite')).toBe(false);
  });

  it('恒宇 retains focus through forced rest and loses it after a deliberate support action', () => {
    const support = realSkill('wuxiang.skill.nectar');
    const { battle } = setup({ names: ['恒宇经'], skills: [controlledStrike(), support] });
    battle.unit('b').attrs.physicalDef = 500;
    cast(battle);
    const afterFirst = battle.unit('b').attrs.hp;
    battle.unit('a').flags.skipNextAction = true;
    battle.submit('a', { type: CommandType.Defend });
    battle.lockAndResolve();
    cast(battle);
    expect(afterFirst - battle.unit('b').attrs.hp).toBe(560);
    cast(battle, support.id, 'a', ['a']);
    const beforeFinal = battle.unit('b').attrs.hp;
    cast(battle);
    expect(beforeFinal - battle.unit('b').attrs.hp).toBe(500);
  });

  it('惊蛰 adapts only from the following round and physical memory does not reduce spells', () => {
    const physical = controlledStrike([{ type: EffectType.PhysicalHit, hits: 2 }]);
    const spell = realSkill('tianyan.skill.fire');
    spell.effects = [{ type: EffectType.SpellHit }];
    spell.costMp = undefined;
    const { battle } = setup({ targetNames: ['惊蛰十二变'], skills: [physical, spell] });
    cast(battle);
    expect(battle.unit('b').attrs.hp).toBe(8000);
    cast(battle);
    expect(battle.unit('b').attrs.hp).toBe(6240);
    cast(battle, spell.id);
    expect(battle.unit('b').attrs.hp).toBe(5240);
  });

  it('原始 does not recognize later segments of the first use, but resists the next whole repeated attack', () => {
    const triple = controlledStrike([{ type: EffectType.PhysicalHit, hits: 3 }]);
    const { battle } = setup({ targetNames: ['原始真解'], skills: [triple] });
    cast(battle);
    expect(battle.unit('b').attrs.hp).toBe(7000);
    cast(battle);
    expect(battle.unit('b').attrs.hp).toBe(4450);
  });

  it('无始 protection closes when a controlled action window is skipped', () => {
    const source = projection(['无始经']);
    const { battle } = setup({ names: ['无始经'], sourceSpeed: 20, targetSpeed: 1 });
    const control = sectStatuses.find(status => status.blocksAction)!;
    battle.applyStatus('a', control.id, 2, 'b');
    battle.submit('b', { type: CommandType.Skill, skillId: strikeId, targets: ['a'] });
    battle.lockAndResolve();
    expect(source.passiveSkillIds).toHaveLength(1);
    expect(battle.unit('a').attrs.hp).toBe(9000);
    const before = setup({ names: ['无始经'], sourceSpeed: 1, targetSpeed: 20 }).battle;
    before.applyStatus('a', control.id, 2, 'b');
    cast(before, strikeId, 'b', ['a']);
    expect(before.unit('a').attrs.hp).toBe(9120);
  });
});
