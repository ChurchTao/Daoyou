import { describe, expect, it } from 'vitest';
import {
  CommandType, DamageKind, DamageOrigin, EffectType, HookAim, HookName,
  HpZeroOutcome, SkillTag, StatusCategory, StatusFlag, StatusTick, TargetSide, TickKind,
} from './enums.js';
import { evalExpr } from './expr.js';
import { createBattle, restoreBattle } from './session.js';
import type { CreateBattleInput, Ruleset, SkillDef } from './types.js';

const ruleset: Ruleset = {
  name: 'action-lifecycle',
  maxRounds: 20,
  formulas: {
    fluctuationMin: 1, fluctuationMax: 1,
    physicalFluctuationMin: 1, physicalFluctuationMax: 1,
    critMultiplier: 2, furyAtkMultiplier: 1, defendPhysicalFactor: 1,
    physicalBase: (attack, defense) => Math.max(1, attack - defense),
    spellBase: (attack, defense, power) => Math.max(1, attack - defense + power),
    baseDamage: ({ kind, source, coeff, power }) =>
      kind === DamageKind.Fixed ? power : source.attrs.physicalAtk * coeff + power,
    physicalHitChance: () => 1, spellHitChance: () => 1,
    sealHitChance: () => 1, fleeChance: () => 0,
  },
  hpZeroOutcome: () => HpZeroOutcome.Dead,
  decideCommand: () => ({ type: CommandType.Defend }),
};

function active(id: string, effects: SkillDef['effects']): SkillDef {
  return { id, name: id, tags: [SkillTag.Physical], targeting: { side: TargetSide.Enemy, count: 1 }, effects };
}

function input(skills: SkillDef[] = []): CreateBattleInput {
  return {
    seed: 17,
    versions: { engineVersion: 'combat-v6', rulesetVersion: 'test', contentVersion: 'test', projectionVersion: 'test' },
    ruleset,
    skills,
    statusDefs: [{ id: 'stun', name: 'stun', kind: 'stun', category: StatusCategory.Control, blocksAction: true }],
    units: [
      { id: 'a', name: 'a', side: 0, kind: 'player', skills: skills.filter(s => !s.tags.includes(SkillTag.Passive)).map(s => s.id),
        passives: skills.filter(s => s.tags.includes(SkillTag.Passive)).map(s => s.id),
        attrs: { hp: 1000, maxHp: 1000, mp: 100, speed: 20, physicalAtk: 100, physicalDef: 0 } },
      { id: 'b', name: 'b', side: 1, kind: 'player', attrs: { hp: 1000, maxHp: 1000, mp: 100, speed: 1, physicalAtk: 1, physicalDef: 0 } },
    ],
  };
}

describe('generic action lifecycle and damage facts', () => {
  it.each(['defend', 'rest', 'control', 'no-command', 'cancelled'] as const)(
    'closes exactly one action window for %s, and only completed defend fires AfterDefend', mode => {
      const battle = createBattle(input());
      const windows: string[] = [];
      let defenses = 0;
      battle.hooks.on(HookName.BeforeActionWindow, h => { if (h.source?.id === 'a') windows.push('before'); });
      battle.hooks.on(HookName.AfterActionWindow, h => { if (h.source?.id === 'a') windows.push('after'); });
      battle.hooks.on(HookName.AfterDefend, h => { if (h.source?.id === 'a') defenses += 1; });
      if (mode === 'rest') battle.unit('a').flags.skipNextAction = true;
      if (mode === 'control') battle.applyStatus('a', 'stun', 2, 'b');
      if (mode === 'no-command' || mode === 'cancelled') battle.hooks.on(HookName.BeforeAction, h => {
        if (h.source?.id !== 'a') return;
        if (mode === 'no-command') h.source.command = undefined;
        else h.cancelled = true;
      });
      battle.submit('a', { type: CommandType.Defend });
      battle.lockAndResolve();
      expect(windows).toEqual(['before', 'after']);
      expect(defenses).toBe(mode === 'defend' ? 1 : 0);
    },
  );

  it('sums native main-target actual HP loss without shield, percentage, derived or secondary damage', () => {
    const strike = active('mixed', [
      { type: EffectType.FixedHit, power: 100 },
      { type: EffectType.FixedHit, power: 100, percentageDamage: true },
      { type: EffectType.FixedHit, power: 100, origin: DamageOrigin.HookDerived },
      { type: EffectType.PhysicalHit, hits: 3 },
    ]);
    strike.targeting.count = 2;
    const setup = input([strike]);
    setup.units.push({ id: 'c', name: 'c', side: 1, kind: 'player', attrs: { hp: 1000, speed: 1, physicalAtk: 1, physicalDef: 0 } });
    const battle = createBattle(setup);
    battle.unit('b').barriers.push({ id: 'shield', kind: 'shield', name: 'shield', current: 50, remainingRounds: 3, appliedRound: 1 });
    const flags: boolean[] = [];
    let total = 0;
    battle.hooks.on(HookName.AfterHit, h => { if (h.source?.id === 'a') flags.push(Boolean(h.percentageDamage)); });
    battle.hooks.on(HookName.AfterAction, h => { if (h.source?.id === 'a') total = h.hpDamage ?? 0; });
    battle.submit('a', { type: CommandType.Skill, skillId: strike.id, targets: ['b', 'c'] });
    battle.lockAndResolve();
    expect(total).toBe(350);
    expect(flags.filter(Boolean)).toHaveLength(2);
    expect(battle.unit('b').attrs.hp).toBe(450);

    const lethal = createBattle(input([active('triple', [{ type: EffectType.PhysicalHit, hits: 3 }])]));
    lethal.unit('b').attrs.hp = 70;
    lethal.hooks.on(HookName.AfterAction, h => { if (h.source?.id === 'a') total = h.hpDamage ?? 0; });
    lethal.submit('a', { type: CommandType.Skill, skillId: 'triple', targets: ['b'] });
    lethal.lockAndResolve();
    expect(total).toBe(70);
  });

  it('freezes repeated incoming skill and focus memory across all segments, preserving forced rest', () => {
    const triple = active('triple', [{ type: EffectType.PhysicalHit, hits: 3 }]);
    const focus: SkillDef = { id: 'focus', name: 'focus', tags: [SkillTag.Passive], targeting: { side: TargetSide.Self }, effects: [], hooks: [
      { on: HookName.OnHitCalc, sourceIsSelf: true, when: { sameAttackTarget: true, previousAttackKind: DamageKind.Physical }, effects: [{ type: EffectType.ModifyStrike, factor: 2 }] },
    ] };
    const recognize: SkillDef = { ...focus, id: 'recognize', hooks: [
      { on: HookName.OnHitCalc, targetIsSelf: true, when: { repeatedIncomingSkill: true }, effects: [{ type: EffectType.ModifyStrike, factor: 0.25 }] },
    ] };
    const setup = input([triple, focus, recognize]);
    setup.units[0]!.passives = ['focus'];
    setup.units[1]!.passives = ['recognize'];
    const battle = createBattle(setup);
    battle.submit('a', { type: CommandType.Skill, skillId: 'triple', targets: ['b'] });
    battle.lockAndResolve();
    expect(battle.unit('b').attrs.hp).toBe(700);
    battle.unit('a').flags.skipNextAction = true;
    battle.submit('a', { type: CommandType.Defend });
    battle.lockAndResolve();
    battle.submit('a', { type: CommandType.Skill, skillId: 'triple', targets: ['b'] });
    battle.lockAndResolve();
    expect(battle.unit('b').attrs.hp).toBe(550);
    const snapshot = battle.snapshot();
    const restored = restoreBattle(setup, snapshot, [...battle.log()]);
    expect(restored.snapshot()).toEqual(snapshot);
    snapshot.units[0]!.actionHistory!.lastAttackTargetId = 'changed';
    expect(battle.unit('a').actionHistory!.lastAttackTargetId).toBe('b');
    battle.submit('a', { type: CommandType.Defend });
    battle.lockAndResolve();
    expect(battle.unit('a').actionHistory!.lastAttackTargetId).toBeUndefined();
  });

  it('modifies capped natural HP DOT once, preserving shield bypass and MP tick values', () => {
    const damage: SkillDef = { id: 'dot-power', name: 'dot-power', tags: [SkillTag.Passive], targeting: { side: TargetSide.Self }, effects: [], hooks: [
      { on: HookName.OnDotCalc, sourceIsSelf: true, when: { dotStatusIds: ['poison'] }, effects: [{ type: EffectType.ModifyStrike, factor: 2 }] },
    ] };
    const resist: SkillDef = { ...damage, id: 'dot-resist', hooks: [
      { on: HookName.OnDotCalc, targetIsSelf: true, effects: [{ type: EffectType.ModifyStrike, factor: 0.75 }] },
    ] };
    const setup = input([damage, resist]);
    setup.units[0]!.passives = ['dot-power'];
    setup.units[1]!.passives = ['dot-resist'];
    setup.statusDefs!.push({ id: 'poison', name: 'poison', kind: 'poison', category: StatusCategory.Dot, ticks: StatusTick.RoundEnd, onTick: { type: TickKind.Dot, ratioOfMaxHp: 0.1, hpCap: 40, ratioOfMaxMp: 0.1 } });
    const battle = createBattle(setup);
    battle.unit('b').barriers.push({ id: 'shield', kind: 'shield', name: 'shield', current: 500, remainingRounds: 3, appliedRound: 1 });
    battle.applyStatus('b', 'poison', 2, 'a');
    battle.lockAndResolve();
    expect(battle.unit('b').attrs.hp).toBe(940);
    expect(battle.unit('b').attrs.mp).toBe(90);
    expect(battle.unit('b').barriers[0]!.current).toBe(500);
  });

  it('records HP costs and self-loss even when later recovery restores full HP', () => {
    const selfCost = active('self-cost', [
      { type: EffectType.LoseHp, power: 20, targeting: { side: TargetSide.Self } },
      { type: EffectType.RestoreHp, power: 1000, targeting: { side: TargetSide.Self } },
    ]);
    selfCost.costHp = 30;
    const battle = createBattle(input([selfCost]));
    let loss = 0;
    let damage = 0;
    battle.hooks.on(HookName.OnRoundEnd, () => {
      const env = { state: battle.state, source: battle.unit('a'), skillLevel: 1, targets: 1 };
      loss = evalExpr('roundHpLoss', env);
      damage = evalExpr('roundHpDamage', env);
    });
    battle.submit('a', { type: CommandType.Skill, skillId: selfCost.id, targets: ['b'] });
    battle.lockAndResolve();
    expect(battle.unit('a').attrs.hp).toBe(1000);
    expect(loss).toBe(50);
    expect(damage).toBe(20);
  });

  it('excludes invoked child skills from root-only hooks while allowing ordinary direct casts', () => {
    const strike = active('strike', [{ type: EffectType.PhysicalHit }]);
    const invoke = active('invoke', [{ type: EffectType.InvokeAttackSkills }]);
    invoke.tags = [SkillTag.Art];
    const direct: SkillDef = { id: 'direct', name: 'direct', tags: [SkillTag.Passive], targeting: { side: TargetSide.Self }, effects: [], hooks: [
      { on: HookName.OnHitCalc, sourceIsSelf: true, when: { rootActionOnly: true }, effects: [{ type: EffectType.ModifyStrike, factor: 2 }] },
    ] };
    const battle = createBattle(input([strike, invoke, direct]));
    battle.submit('a', { type: CommandType.Skill, skillId: 'invoke', targets: ['b'] });
    battle.lockAndResolve();
    expect(battle.unit('b').attrs.hp).toBe(900);
    battle.submit('a', { type: CommandType.Skill, skillId: 'strike', targets: ['b'] });
    battle.lockAndResolve();
    expect(battle.unit('b').attrs.hp).toBe(700);
  });

  it('filters enemy damage hooks separately from self-inflicted HP loss', () => {
    const selfLoss = active('self-loss', [{ type: EffectType.LoseHp, power: 20, targeting: { side: TargetSide.Self } }]);
    const enemyOnly: SkillDef = { id: 'enemy-only', name: 'enemy-only', tags: [SkillTag.Passive], targeting: { side: TargetSide.Self }, effects: [], hooks: [
      { on: HookName.AfterDamage, targetIsSelf: true, sourceIsEnemy: true,
        effects: [{ type: EffectType.ModifyFact, key: 'enemyHits', value: 'fact.enemyHits+1' }] },
    ] };
    const battle = createBattle(input([selfLoss, enemyOnly]));
    battle.submit('a', { type: CommandType.Skill, skillId: 'self-loss', targets: ['b'] });
    battle.submit('b', { type: CommandType.Attack, target: 'a' });
    battle.lockAndResolve();
    expect(battle.unit('a').combatFacts!.enemyHits).toBe(1);
  });

  it('exposes removed control classification and the allied dispeller without changing original source', () => {
    const cleanse = active('cleanse', [{ type: EffectType.Dispel, categories: [StatusCategory.Control], maxCount: 1 }]);
    cleanse.targeting.side = TargetSide.Ally;
    const protection: SkillDef = { id: 'protection', name: 'protection', tags: [SkillTag.Passive], targeting: { side: TargetSide.Self }, effects: [], hooks: [
      { on: HookName.OnStatusRemoved, targetIsSelf: true, aim: HookAim.Self, when: {
        removedStatusCategory: StatusCategory.Control, removedStatusDispellable: true,
        removedStatusFlags: [StatusFlag.BlocksSpell, StatusFlag.BlocksAction],
        excludedRemovedStatusFlags: [StatusFlag.BlocksRevive], statusRemovedByAlly: true,
      }, effects: [{ type: EffectType.ModifyFact, key: 'protected', value: 1 }] },
    ] };
    const setup = input([cleanse, protection]);
    setup.units.push({ id: 'ally', name: 'ally', side: 0, kind: 'player', skills: ['cleanse'], attrs: { hp: 1000, speed: 30, physicalAtk: 1, physicalDef: 0 } });
    const battle = createBattle(setup);
    battle.applyStatus('a', 'stun', 3, 'b');
    let sourceId: string | undefined;
    battle.hooks.on(HookName.OnStatusRemoved, h => { sourceId = h.source?.id; });
    battle.submit('ally', { type: CommandType.Skill, skillId: 'cleanse', targets: ['a'] });
    battle.lockAndResolve();
    expect(sourceId).toBe('b');
    expect(battle.unit('a').combatFacts!.protected).toBe(1);
  });

  it('filters removable status classes without treating rule statuses or locked numeric states as ordinary debuffs', () => {
    const cleanse = active('cleanse-numeric', [{ type: EffectType.Dispel, dispelClasses: ['numeric'], maxCount: 1 }]);
    cleanse.targeting.side = TargetSide.Self;
    const observe: SkillDef = { id: 'observe', name: 'observe', tags: [SkillTag.Passive], targeting: { side: TargetSide.Self }, effects: [], hooks: [
      { on: HookName.BeforeAction, sourceIsSelf: true, when: { sourceStatusDispelClasses: ['numeric'] }, effects: [{ type: EffectType.ModifyFact, key: 'numeric', value: 1 }] },
      { on: HookName.OnHitCalc, sourceIsSelf: true, when: { targetStatusDispelClasses: ['numeric'] }, effects: [{ type: EffectType.ModifyStrike, factor: 2 }] },
    ] };
    const setup = input([cleanse, observe]);
    setup.statusDefs!.push(
      { id: 'numeric', name: 'numeric', kind: 'numeric', category: StatusCategory.Debuff, dispelClass: 'numeric' },
      { id: 'rule', name: 'rule', kind: 'rule', category: StatusCategory.Debuff },
      { id: 'locked-numeric', name: 'locked-numeric', kind: 'locked-numeric', category: StatusCategory.Debuff, dispelClass: 'numeric', dispellable: false },
    );
    const battle = createBattle(setup);
    for (const statusId of ['numeric', 'rule', 'locked-numeric']) battle.applyStatus('a', statusId, 3);
    battle.applyStatus('b', 'locked-numeric', 3);
    battle.submit('a', { type: CommandType.Skill, skillId: cleanse.id, targets: ['a'] });
    battle.lockAndResolve();
    expect(battle.unit('a').combatFacts!.numeric).toBe(1);
    expect(battle.unit('a').statuses.map(s => s.id)).toEqual(['rule', 'locked-numeric']);
    battle.submit('a', { type: CommandType.Attack, target: 'b' });
    battle.lockAndResolve();
    expect(battle.unit('b').attrs.hp).toBe(900);
  });
});
