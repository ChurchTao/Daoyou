import { describe, expect, it } from 'vitest';
import {
  CommandType, DamageKind, DamageOrigin, EffectType, EventType, HookAim, HookName,
  HpZeroOutcome, SkillTag, StatusCategory, StatusHit, StatusTick, TargetSide, TickKind,
} from './enums.js';
import { createBattle, restoreBattle } from './session.js';
import { SeededRng } from './rng.js';
import type { CreateBattleInput, Ruleset, SkillDef, StatusDef } from './types.js';

const rules: Ruleset = {
  name: 'control-primitives', maxRounds: 30,
  formulas: {
    fluctuationMin: 1, fluctuationMax: 1, physicalFluctuationMin: 1, physicalFluctuationMax: 1,
    critMultiplier: 2, furyAtkMultiplier: 1, defendPhysicalFactor: 1,
    physicalBase: (attack, defense) => Math.max(1, attack - defense),
    spellBase: (attack, defense, power) => Math.max(1, attack - defense + power),
    baseDamage: ({ kind, source, coeff, power }) => kind === DamageKind.Fixed ? power :
      (kind === DamageKind.Spell ? source.attrs.magicAtk : source.attrs.physicalAtk) * coeff + power,
    physicalHitChance: () => 1, spellHitChance: () => 1,
    sealHitChance: () => 1, fleeChance: () => 0,
  },
  hpZeroOutcome: unit => unit.kind === 'player' ? HpZeroOutcome.Downed : HpZeroOutcome.Dead,
  decideCommand: () => ({ type: CommandType.Defend }),
};

function active(id: string, effects: SkillDef['effects']): SkillDef {
  return { id, name: id, tags: [SkillTag.Spell], targeting: { side: TargetSide.Enemy, count: 1 }, effects };
}

function passive(id: string, hooks: SkillDef['hooks']): SkillDef {
  return { id, name: id, tags: [SkillTag.Passive], targeting: { side: TargetSide.Self }, effects: [], hooks };
}

const statuses: StatusDef[] = [
  { id: 'seal', name: 'seal', kind: 'control', category: StatusCategory.Control, blocksSpell: true },
  { id: 'strong', name: 'strong', kind: 'control', category: StatusCategory.Control, blocksSpell: true, priority: 2 },
  { id: 'weak', name: 'weak', kind: 'control', category: StatusCategory.Control, blocksSpell: true, priority: 1 },
  { id: 'guard', name: 'guard', kind: 'guard', category: StatusCategory.Buff, interceptHostileAction: true },
  { id: 'sleep', name: 'sleep', kind: 'sleep', category: StatusCategory.Control, blocksAction: true, breakOnDamage: true, breakOnDamageAbove: 30 },
  { id: 'buff', name: 'buff', kind: 'buff', category: StatusCategory.Buff },
  { id: 'immune', name: 'immune', kind: 'immune', category: StatusCategory.Buff, immuneToSeal: true },
  { id: 'harmful', name: 'harmful', kind: 'harmful', category: StatusCategory.Debuff },
];

function setup(skills: SkillDef[] = []): CreateBattleInput {
  return {
    seed: 17, ruleset: rules, skills, statusDefs: [...statuses],
    versions: { engineVersion: 'combat-v6', rulesetVersion: 'daoyou_rules_v1', contentVersion: 'empty_content_v1', projectionVersion: 'character_panel_v1' },
    units: [
      { id: 'a', name: 'a', side: 0, kind: 'player', level: 50,
        skills: skills.filter(skill => !skill.tags.includes(SkillTag.Passive)).map(skill => skill.id),
        passives: skills.filter(skill => skill.tags.includes(SkillTag.Passive)).map(skill => skill.id),
        attrs: { hp: 1000, maxHp: 1000, mp: 300, speed: 30, physicalAtk: 100, magicAtk: 100, physicalDef: 0 } },
      { id: 'b', name: 'b', side: 1, kind: 'player', level: 50,
        attrs: { hp: 1000, maxHp: 1000, mp: 300, speed: 10, physicalAtk: 100, physicalDef: 0 } },
    ],
  };
}

function cast(battle: ReturnType<typeof createBattle>, skillId: string, targets = ['b']) {
  battle.submit('a', { type: CommandType.Skill, skillId, targets });
  battle.lockAndResolve();
}

describe('status outcomes', () => {
  it('reports actual application and priority rejection with independent command success', () => {
    const observe = passive('observe', [{ on: HookName.OnStatusResolved, sourceIsSelf: true,
      when: { statusHit: StatusHit.Seal, resolvedStatusKinds: ['control'], statusResults: ['applied'] },
      effects: [{ type: EffectType.ModifyFact, key: 'successes', value: 'fact.successes+1' }] }]);
    const strong = active('strong-cast', [{ type: EffectType.ApplyStatus, statusId: 'strong', duration: 4, hit: StatusHit.Seal }]);
    const weak = active('weak-cast', [{ type: EffectType.ApplyStatus, statusId: 'weak', duration: 2, hit: StatusHit.Seal }]);
    const battle = createBattle(setup([strong, weak, observe]));
    const results: string[] = [];
    battle.hooks.on(HookName.OnStatusResolved, h => results.push(`${h.statusId}:${h.statusResult}:${h.statusReason ?? ''}`));
    cast(battle, strong.id);
    cast(battle, weak.id);
    expect(results).toEqual(['strong:applied:', 'weak:rejected:priority']);
    expect(battle.unit('a').combatFacts!.successes).toBe(1);
    expect(battle.unit('a').skillUses![weak.id]).toBe(1);
    expect(battle.unit('b').statuses.map(status => status.id)).toEqual(['strong']);
  });

  it('distinguishes a random miss from absolute immunity', () => {
    const seal = active('seal-cast', [{ type: EffectType.ApplyStatus, statusId: 'seal', duration: 3, hit: StatusHit.Seal }]);
    const input = setup([seal]);
    input.ruleset = { ...rules, formulas: { ...rules.formulas, sealHitChance: () => 0 } };
    const battle = createBattle(input);
    const results: string[] = [];
    battle.hooks.on(HookName.OnStatusResolved, h => {
      if (h.statusId === 'seal') results.push(h.statusResult!);
    });
    cast(battle, seal.id);
    battle.applyStatus('b', 'immune', 3, 'b');
    cast(battle, seal.id);
    expect(results).toEqual(['miss', 'immune']);
    expect(battle.unit('a').skillUses![seal.id]).toBe(2);
  });

  it('forwards a local ceiling through the formula and final multiplier without changing other skills', () => {
    const high = active('high', [{ type: EffectType.ApplyStatus, statusId: 'seal', duration: 2, hit: StatusHit.Seal }]);
    high.sealChanceCeil = 0.8;
    high.modifiers = [{ when: { skillIds: ['high'] }, sealChanceCeilAdd: 0.1, sealChanceFactor: 2 }];
    const ordinary = active('ordinary', high.effects);
    const ceilings: Array<number | undefined> = [];
    const input = setup([high, ordinary]);
    input.ruleset = { ...rules, formulas: { ...rules.formulas, sealChanceCeil: 0.5,
      sealHitChance: (_source, _target, _level, _base, _add, ceiling) => {
        ceilings.push(ceiling); return ceiling!;
      } } };
    const battle = createBattle(input);
    const chances: number[] = [];
    battle.hooks.on(HookName.OnStatusResolved, h => chances.push(h.statusChance!));
    cast(battle, high.id);
    cast(battle, ordinary.id);
    expect(ceilings).toEqual([0.9, 0.5]);
    expect(chances).toEqual([0.9, 0.5]);
  });

  it('uses conditional guaranteed seals while keeping innate resistance and absolute immunity distinct', () => {
    const seal = active('seal-cast', [{ type: EffectType.ApplyStatus, statusId: 'seal', duration: 2, hit: StatusHit.Seal }]);
    seal.modifiers = [{ when: { targetHasNegativeSpellResistance: false }, sealAlwaysHit: true }];
    const resistant = passive('resistant', []);
    resistant.innate = { sealHitTakenFactor: 0.7 };
    const input = setup([seal, resistant]);
    input.units[0]!.passives = [];
    input.ruleset = { ...rules, formulas: { ...rules.formulas, sealChanceCeil: 0.5, sealHitChance: () => 0 } };
    const battle = createBattle(input);
    const results: string[] = [];
    battle.hooks.on(HookName.OnStatusResolved, h => { if (h.statusId === 'seal') results.push(h.statusResult!); });
    cast(battle, seal.id);
    battle.unit('b').passives.push('resistant');
    cast(battle, seal.id);
    battle.unit('b').passives = [];
    battle.applyStatus('b', 'immune', 3, 'b');
    cast(battle, seal.id);
    expect(results).toEqual(['applied', 'miss', 'immune']);
  });

  it('keeps independent negative-spell resistance unless an explicit bypass is enabled', () => {
    const seal = active('seal-cast', [{ type: EffectType.ApplyStatus, statusId: 'seal', duration: 2, hit: StatusHit.Seal }]);
    seal.modifiers = [{ sealAlwaysHit: true }];
    const resistance = passive('resistance', []);
    resistance.innate = { negativeSpellResistance: 0.25 };
    const input = setup([seal, resistance]);
    input.units[0]!.passives = [];
    input.units[1]!.passives = ['resistance'];
    input.seed = Array.from({ length: 100 }, (_, index) => index + 1).find(seed => new SeededRng(seed).next() < 0.25)!;
    const battle = createBattle(input);
    const results: string[] = [];
    battle.hooks.on(HookName.OnStatusResolved, h => results.push(h.statusResult!));
    cast(battle, seal.id);
    seal.modifiers[0]!.bypassNegativeSpellResistance = true;
    cast(battle, seal.id);
    expect(results).toEqual(['immune', 'applied']);
  });

  it('retries once with the event skill parameters and a fraction of the ordinary chance', () => {
    const seal = active('seal-cast', [{ type: EffectType.ApplyStatus, statusId: 'seal', duration: 3, hit: StatusHit.Seal }]);
    seal.sealBase = 80;
    const retry = passive('retry', [{ on: HookName.OnStatusResolved, sourceIsSelf: true,
      effectSkill: 'eventSkill', limitConsumption: 'onAttempt',
      when: { resolvedStatusIds: ['seal'], statusResults: ['miss'], oncePerBattle: true },
      effects: [{ type: EffectType.ApplyStatus, statusId: 'seal', duration: 3, hit: StatusHit.Seal, chanceFactor: 0.5 }] }]);
    const input = setup([seal, retry]);
    input.units[0]!.skillLevels = { [seal.id]: 72 };
    const levels: Array<number | undefined> = [];
    input.ruleset = { ...rules, formulas: { ...rules.formulas,
      sealHitChance: (_source, _target, level, base) => { levels.push(level); return (base ?? 10) / 100; } } };
    input.seed = Array.from({ length: 1000 }, (_, index) => index + 1).find(seed => {
      const rng = new SeededRng(seed); return rng.next() >= 0.8 && rng.next() < 0.4;
    })!;
    const battle = createBattle(input);
    const chances: number[] = [];
    const durations: number[] = [];
    battle.hooks.on(HookName.OnStatusResolved, h => { chances.push(h.statusChance!); durations.push(h.statusDuration!); });
    cast(battle, seal.id);
    expect(levels).toEqual([72, 72]);
    expect(chances.sort()).toEqual([0.4, 0.8]);
    expect(durations).toEqual([3, 3]);
    expect(battle.unit('b').statuses.map(status => status.id)).toEqual(['seal']);
  });
});

describe('hostile root-action guards', () => {
  it('blocks only the first segment, later segments connect, and hostile attachments stay blocked', () => {
    const strike = active('mixed', [
      { type: EffectType.PhysicalHit, hits: 3 },
      { type: EffectType.FixedHit, power: 20 },
      { type: EffectType.ApplyStatus, statusId: 'seal', duration: 2, hit: StatusHit.Seal },
      { type: EffectType.DamageMp, power: 10 },
      { type: EffectType.ApplyStatus, statusId: 'buff', duration: 3, self: true },
      { type: EffectType.ModifyFact, key: 'completed', value: 1 },
    ]);
    strike.targeting.count = 2;
    strike.costMp = 30;
    strike.cooldownRounds = 3;
    const input = setup([strike]);
    input.units.push({ ...input.units[1]!, id: 'c', name: 'c', slot: 1 });
    const battle = createBattle(input);
    battle.applyStatus('b', 'guard', 4, 'b');
    const intercepted: string[] = [];
    battle.hooks.on(HookName.OnHostileActionIntercepted, h => intercepted.push(h.target!.id));
    cast(battle, strike.id, ['b', 'c']);
    expect(intercepted).toEqual(['b']);
    expect(battle.unit('b').attrs.hp).toBe(800);
    expect(battle.unit('b').attrs.mp).toBe(300);
    expect(battle.unit('b').statuses.map(status => status.id)).toEqual(['guard']);
    expect(battle.unit('c').attrs.hp).toBe(680);
    expect(battle.unit('c').attrs.mp).toBe(290);
    expect(battle.unit('c').statuses.map(status => status.id)).toEqual(['seal']);
    expect(battle.unit('a').attrs.mp).toBe(270);
    expect(battle.unit('a').cooldowns![strike.id]).toBe(4);
    expect(battle.unit('a').combatFacts!.completed).toBe(1);
    expect(battle.unit('a').statuses.map(status => status.id)).toEqual(['buff']);
    expect(battle.log().filter(event => event.type === EventType.ActionFailed)).toEqual([]);
  });

  it.each(['spell-repeat', 'invoked-skills'] as const)('retains protection across %s in one command', mode => {
    const spell = active('spell', [{ type: EffectType.SpellHit, hits: 2 }]);
    const physical = active('physical', [{ type: EffectType.PhysicalHit, hits: 2 }]);
    physical.tags = [SkillTag.Spell, SkillTag.Physical];
    const invoke = active('invoke', [{ type: EffectType.InvokeAttackSkills }]);
    invoke.tags = [SkillTag.Art];
    const repeat = passive('repeat', []);
    repeat.innate = { spellRepeat: { chance: 1, factor: 0.5 } };
    const battle = createBattle(setup([spell, physical, invoke, repeat]));
    battle.applyStatus('b', 'guard', 4, 'b');
    cast(battle, mode === 'spell-repeat' ? 'spell' : 'invoke');
    expect(battle.unit('b').attrs.hp).toBeLessThan(1000);
    expect(battle.log().filter(event => event.type === EventType.MechanicTriggered && event.mechanicId === 'guard')).toHaveLength(1);
  });

  it('shares the round budget through status refresh and snapshot restoration', () => {
    const input = setup();
    input.units.push({ ...input.units[0]!, id: 'd', name: 'd', slot: 1, attrs: { ...input.units[0]!.attrs, speed: 20 } });
    const battle = createBattle(input);
    battle.applyStatus('b', 'guard', 4, 'b');
    battle.hooks.on(HookName.AfterAction, h => { if (h.source?.id === 'a') battle.applyStatus('b', 'guard', 4, 'b'); });
    battle.submit('a', { type: CommandType.Attack, target: 'b' });
    battle.submit('d', { type: CommandType.Attack, target: 'b' });
    battle.lockAndResolve();
    expect(battle.unit('b').attrs.hp).toBe(900);
    battle.unit('b').flags.hostileActionGuardRound = battle.state.round;
    const restored = restoreBattle(input, battle.snapshot(), [...battle.log()]);
    restored.submit('a', { type: CommandType.Attack, target: 'b' });
    restored.lockAndResolve();
    expect(restored.unit('b').attrs.hp).toBe(800);
  });

  it('does not spend protection on periodic or explicitly derived damage', () => {
    const derived = active('derived', [{ type: EffectType.FixedHit, power: 31, origin: DamageOrigin.HookDerived }]);
    const input = setup([derived]);
    input.statusDefs!.push({ id: 'dot', name: 'dot', kind: 'dot', category: StatusCategory.Dot,
      ticks: StatusTick.RoundEnd, onTick: { type: TickKind.Dot, ratioOfMaxHp: 0.02 } });
    const battle = createBattle(input);
    battle.applyStatus('b', 'guard', 4, 'b');
    battle.applyStatus('b', 'dot', 3, 'a');
    cast(battle, derived.id);
    expect(battle.unit('b').attrs.hp).toBe(949);
    expect(battle.unit('b').flags.hostileActionGuardRound).toBeUndefined();
  });

  it('does not treat source-owned mark cleanup on other targets as an attack', () => {
    const transfer = active('transfer', [
      { type: EffectType.RemoveStatus, kinds: ['mark'], ownedOnly: true, targeting: { side: TargetSide.Enemy, mode: 'all' } },
      { type: EffectType.FixedHit, power: 20 },
    ]);
    const input = setup([transfer]);
    input.statusDefs!.push({ id: 'mark', name: 'mark', kind: 'mark', category: StatusCategory.Debuff, sourceBound: true });
    input.units.push({ ...input.units[1]!, id: 'c', name: 'c', slot: 1 });
    const battle = createBattle(input);
    battle.applyStatus('c', 'guard', 4, 'c');
    battle.applyStatus('c', 'mark', 4, 'a');
    cast(battle, transfer.id);
    expect(battle.unit('c').flags.hostileActionGuardRound).toBeUndefined();
    expect(battle.unit('c').statuses.map(status => status.id)).toEqual(['guard']);
    expect(battle.unit('b').attrs.hp).toBe(980);
  });
});

describe('sleep and attack restrictions', () => {
  it.each([
    { power: 30, shield: 0, awake: false },
    { power: 31, shield: 0, awake: true },
    { power: 45, shield: 15, awake: false },
    { power: 46, shield: 15, awake: true },
    { power: 31, shield: 100, awake: false },
  ])('uses actual single-strike HP loss for $power damage with $shield shield', ({ power, shield, awake }) => {
    const strike = active('strike', [{ type: EffectType.FixedHit, power }]);
    const battle = createBattle(setup([strike]));
    battle.applyStatus('b', 'sleep', 4, 'a');
    if (shield) battle.unit('b').barriers.push({ id: 'shield', name: 'shield', kind: 'shield', current: shield, remainingRounds: 3, sourceId: 'b', appliedRound: 1 });
    cast(battle, strike.id);
    expect(battle.unit('b').statuses.some(status => status.id === 'sleep')).toBe(!awake);
  });

  it('blocks attack spells and fixed spells while allowing support and physical school skills', () => {
    const support = active('support', [{ type: EffectType.ApplyStatus, statusId: 'buff', duration: 3, self: true }]);
    support.targeting.side = TargetSide.Self;
    const magic = active('magic', [{ type: EffectType.SpellHit }]);
    const fixed = active('fixed', [{ type: EffectType.FixedHit, power: 10 }]);
    const physical = active('physical', [{ type: EffectType.PhysicalHit }]);
    physical.tags.push(SkillTag.Physical);
    const input = setup([support, magic, fixed, physical]);
    input.statusDefs!.push({ id: 'attack-block', name: 'attack-block', kind: 'attack-block', category: StatusCategory.Control, blocksDamagingSpells: true });
    const battle = createBattle(input);
    battle.applyStatus('a', 'attack-block', 4, 'b');
    const options = battle.queryCommands('a');
    expect(options.skills.filter(option => option.ready).map(option => option.skillId)).toEqual(['support', 'physical']);
    cast(battle, support.id, ['a']);
    expect(battle.unit('a').statuses.some(status => status.id === 'buff')).toBe(true);
    cast(battle, physical.id);
    expect(battle.unit('b').attrs.hp).toBe(900);
  });
});

describe('triggered actors, paid casts and source history', () => {
  it('applies an owned-pet hook as that pet while retaining its owner budget and spell level', () => {
    const spell = active('spell', [{ type: EffectType.SpellHit }]);
    const teach = passive('teach', [{ on: HookName.AfterStrike, sourceIsOwnedPet: true, effectSource: 'eventSource',
      requireKind: DamageKind.Spell, aim: HookAim.HookTarget, when: { oncePerRound: true, excludeSpellRepeat: true },
      effects: [{ type: EffectType.ApplyStatus, statusId: 'pet-seal', duration: 2, hit: StatusHit.Seal }] }]);
    const input = setup([spell, teach]);
    input.statusDefs!.push({ id: 'pet-seal', name: 'pet-seal', kind: 'pet-seal', category: StatusCategory.Control, attrMods: { physicalDef: 'skillLevel' } });
    input.units.push(
      { ...input.units[0]!, id: 'own-pet', name: 'own-pet', ownerId: 'a', kind: 'pet', level: 40, passives: [], skills: ['spell'], skillLevels: { spell: 17 }, attrs: { ...input.units[0]!.attrs, speed: 40 } },
      { ...input.units[0]!, id: 'ally', name: 'ally', slot: 1, skills: [], passives: [] },
      { ...input.units[0]!, id: 'other-pet', name: 'other-pet', ownerId: 'ally', kind: 'pet', slot: 1, passives: [], skills: ['spell'], attrs: { ...input.units[0]!.attrs, speed: 50 } },
    );
    const battle = createBattle(input);
    battle.submit('own-pet', { type: CommandType.Skill, skillId: 'spell', targets: ['b'] });
    battle.submit('other-pet', { type: CommandType.Skill, skillId: 'spell', targets: ['b'] });
    battle.lockAndResolve();
    const seal = battle.unit('b').statuses.find(status => status.id === 'pet-seal')!;
    expect(seal.sourceId).toBe('own-pet');
    expect(seal.attrMods.physicalDef).toBe(17);
    expect(battle.unit('a').marks.filter(mark => mark.includes('teach'))).toHaveLength(1);
    expect(battle.unit('own-pet').marks).not.toContain('round:1:teach:0');
  });

  it.each(['paid', 'insufficient', 'sealed'] as const)('triggered casts respect %s eligibility without replacing the normal action', mode => {
    const support = active('support', [{ type: EffectType.ApplyStatus, statusId: 'buff', duration: 3, self: true }]);
    support.targeting.side = TargetSide.Self;
    support.costMp = 50;
    const trigger = passive('trigger', [{ on: HookName.BeforeActionWindow, sourceIsSelf: true, when: { oncePerBattle: true },
      effects: [{ type: EffectType.InvokeSkill, skillId: support.id }] }]);
    const battle = createBattle(setup([support, trigger]));
    if (mode === 'insufficient') battle.unit('a').attrs.mp = 40;
    if (mode === 'sealed') battle.applyStatus('a', 'seal', 3, 'b');
    battle.submit('a', { type: CommandType.Attack, target: 'b' });
    battle.lockAndResolve();
    expect(battle.unit('a').statuses.some(status => status.id === 'buff')).toBe(mode === 'paid');
    expect(battle.unit('a').attrs.mp).toBe(mode === 'paid' ? 250 : mode === 'insufficient' ? 40 : 300);
    expect(battle.unit('b').attrs.hp).toBe(900);
  });

  it('records attack and successful-hit source facts before death and distinguishes blocked attacks', () => {
    const strike = active('strike', [{ type: EffectType.SpellHit }]);
    const input = setup([strike]);
    const battle = createBattle(input);
    battle.applyStatus('b', 'guard', 4, 'b');
    cast(battle, strike.id);
    expect(battle.unit('b').combatFacts![`spellAttackedRound:a`]).toBe(1);
    expect(battle.unit('b').combatFacts![`spellHitRound:a`]).toBeUndefined();
    battle.unit('b').statuses = [];
    battle.unit('b').attrs.hp = 10;
    let seenOnDeath = false;
    battle.hooks.on(HookName.OnDeath, h => { seenOnDeath = h.target!.combatFacts![`spellHitRound:a`] === 2; });
    cast(battle, strike.id);
    expect(seenOnDeath).toBe(true);
  });
});
