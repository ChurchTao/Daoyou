import { describe, expect, it } from 'vitest';
import {
  CommandType, EffectType, EventType, HookAim, HookName,
  HpZeroOutcome, SkillTag, StatusCategory, StatusTick, TargetMode, TargetSide, TickKind,
} from './enums.js';
import { evalExpr } from './expr.js';
import { createBattle, restoreBattle } from './session.js';
import type { CreateBattleInput, Ruleset, SkillDef, StatusDef } from './types.js';

const rules: Ruleset = {
  name: 'status-source-and-mp-shield', maxRounds: 20,
  formulas: {
    fluctuationMin: 1, fluctuationMax: 1, physicalFluctuationMin: 1, physicalFluctuationMax: 1,
    critMultiplier: 2, furyAtkMultiplier: 1, defendPhysicalFactor: 1,
    physicalBase: (attack, defense) => Math.max(1, attack - defense),
    spellBase: (attack, defense, power) => Math.max(1, attack - defense + power),
    baseDamage: ({ power }) => power,
    physicalHitChance: () => 1, spellHitChance: () => 1,
    sealHitChance: () => 1, fleeChance: () => 0,
  },
  hpZeroOutcome: () => HpZeroOutcome.Downed,
  decideCommand: () => ({ type: CommandType.Defend }),
};

function skill(id: string, effects: SkillDef['effects']): SkillDef {
  return { id, name: id, tags: [SkillTag.Spell], targeting: { side: TargetSide.Enemy, count: 1 }, effects };
}

function config(skills: SkillDef[] = [], statusDefs: StatusDef[] = []): CreateBattleInput {
  return {
    seed: 17, ruleset: rules, skills, statusDefs,
    versions: { engineVersion: 'combat-v6', rulesetVersion: 'daoyou_rules_v1', contentVersion: 'empty_content_v1', projectionVersion: 'character_panel_v1' },
    units: ['a', 'b', 'target', 'ally'].map((id, index) => ({
      id, name: id, side: index < 2 ? 0 : 1, kind: 'player', level: 100,
      skills: skills.filter(s => !s.tags.includes(SkillTag.Passive)).map(s => s.id),
      skillLevels: Object.fromEntries(skills.map(s => [s.id, index === 0 ? 50 : 80])),
      attrs: { hp: 1000, maxHp: 1000, mp: 300, maxMp: 300, speed: 40 - index, physicalAtk: 100, physicalDef: 0 },
    })),
  };
}

function cast(battle: ReturnType<typeof createBattle>, id: string, actor = 'a', target = 'target') {
  battle.submit(actor, { type: CommandType.Skill, skillId: id, targets: [target] });
  battle.lockAndResolve();
}

describe('source-bound status lifecycle', () => {
  const dot: StatusDef = {
    id: 'dot', name: 'dot', kind: 'owned_dot', category: StatusCategory.Dot,
    sourceBound: true, maxStacks: 3, ticks: StatusTick.RoundEnd,
    onTick: { type: TickKind.Dot, ratioOfMaxHp: 1, hpCap: '10*ownedTargetStatusStacks.owned_dot' },
  };

  it('stacks and refreshes only the same caster while keeping independent levels and ages', () => {
    const apply = skill('apply', [{ type: EffectType.ApplyStatus, statusId: dot.id, duration: 4 }]);
    const battle = createBattle(config([apply], [dot]));
    cast(battle, 'apply');
    cast(battle, 'apply', 'b');
    cast(battle, 'apply');
    const target = battle.unit('target');
    expect(target.statuses.map(s => [s.sourceId, s.stacks, s.appliedSkillLevel])).toEqual([['a', 2, 50], ['b', 1, 80]]);
    expect(evalExpr('ownedTargetStatusStacks.owned_dot', { source: battle.unit('a'), target, skillLevel: 0, targets: 1 })).toBe(2);
    expect(evalExpr('ownedTargetStatusRounds.owned_dot', { source: battle.unit('b'), target, skillLevel: 0, targets: 1 })).toBe(2);
    expect(evalExpr('targetStatusAge.owned_dot', { source: battle.unit('a'), target, skillLevel: 0, targets: 1, state: battle.state })).toBe(1);
    expect(evalExpr('targetStatusAge.owned_dot', { source: battle.unit('b'), target, skillLevel: 0, targets: 1, state: battle.state })).toBe(2);
    expect(target.attrs.hp).toBe(940);
  });

  it('expires one source without deleting another instance with the same status ID', () => {
    const battle = createBattle(config([], [dot]));
    battle.applyStatus('target', dot.id, 1, 'a');
    battle.applyStatus('target', dot.id, 3, 'b');
    const removed: unknown[] = [];
    battle.hooks.on(HookName.OnStatusRemoved, h => removed.push([h.removedStatusSourceId, h.removedStatusRounds]));
    battle.lockAndResolve();
    expect(battle.unit('target').statuses.map(s => [s.sourceId, s.remainingRounds])).toEqual([['b', 2]]);
    expect(removed).toEqual([['a', 1]]);
    expect(battle.log().filter(e => e.type === EventType.StatusRemoved)).toEqual([
      { type: EventType.StatusRemoved, unitId: 'target', statusId: 'dot', sourceId: 'a', reason: 'expired' },
    ]);
  });

  it('dispels individual instances and exposes the removed snapshot to data hooks after restoration', () => {
    const buff: StatusDef = { id: 'buff', name: 'buff', kind: 'owned-buff', category: StatusCategory.Buff, sourceBound: true };
    const apply = skill('apply', [{ type: EffectType.ApplyStatus, statusId: 'buff', duration: 4 }]);
    const dispel = skill('dispel', [{ type: EffectType.Dispel, statusIds: ['buff'], maxCount: 1 }]);
    dispel.targeting.side = TargetSide.Any;
    const observe: SkillDef = {
      id: 'observe', name: 'observe', tags: [SkillTag.Passive], targeting: { side: TargetSide.Self }, effects: [],
      hooks: [{ on: HookName.OnStatusRemoved, sourceIsSelf: true, aim: HookAim.Self,
        when: { removedStatusKind: 'owned-buff', statusRemoveReason: 'dispel' },
        effects: [{ type: EffectType.ModifyFact, key: 'refund', value: 'removedStatusRounds*removedStatusSkillLevel' }] }],
    };
    const input = config([apply, dispel, observe], [buff]);
    input.units[0]!.passives = ['observe'];
    const battle = createBattle(input);
    cast(battle, 'apply');
    cast(battle, 'apply', 'b');
    const restored = restoreBattle(input, battle.snapshot(), [...battle.log()]);
    cast(restored, 'dispel', 'ally');
    expect(restored.unit('target').statuses.map(s => s.sourceId)).toEqual(['b']);
    expect(restored.unit('a').combatFacts?.refund).toBe(150);
    cast(restored, 'dispel', 'ally');
    expect(restored.unit('target').statuses).toEqual([]);
    expect(restored.log().filter(e => e.type === EventType.StatusRemoved && e.reason === 'dispel').map(e => e.sourceId)).toEqual(['a', 'b']);
  });

  it('removes every source individually when an unscoped removal consumes the status kind', () => {
    const remove = skill('remove', [{ type: EffectType.RemoveStatus, kinds: [dot.kind] }]);
    const battle = createBattle(config([remove], [dot]));
    battle.applyStatus('target', dot.id, 4, 'a');
    battle.applyStatus('target', dot.id, 4, 'b');
    cast(battle, 'remove');
    expect(battle.unit('target').statuses).toEqual([]);
    expect(battle.log().filter(e => e.type === EventType.StatusRemoved).map(e => e.sourceId)).toEqual(['a', 'b']);
  });

  it('copies a selected snapshot without replacing the other caster on the recipient', () => {
    const copy = skill('copy', [{ type: EffectType.CopyStatus, kinds: [dot.kind], maxCount: 1 }]);
    copy.targeting = { side: TargetSide.Enemy, mode: TargetMode.Fill, count: 2 };
    const battle = createBattle(config([copy], [dot]));
    battle.applyStatus('target', dot.id, 4, 'a');
    battle.applyStatus('target', dot.id, 4, 'a');
    battle.applyStatus('ally', dot.id, 4, 'a');
    battle.applyStatus('ally', dot.id, 4, 'b');
    cast(battle, copy.id);
    expect(Object.fromEntries(battle.unit('ally').statuses.map(s => [s.sourceId, s.stacks]))).toEqual({ a: 2, b: 1 });
  });

  it('applies priority independently and excludes only the refreshing source from attribute snapshots', () => {
    const buff: StatusDef = { id: 'buff', name: 'buff', kind: 'buff', sourceBound: true, priority: 'skillLevel', attrMods: { magicAtk: 'target.magicAtk*0.1' } };
    const apply = skill('apply', [{ type: EffectType.ApplyStatus, statusId: buff.id, duration: 4 }]);
    const battle = createBattle(config([apply], [buff]));
    battle.unit('target').attrs.magicAtk = 100;
    cast(battle, apply.id);
    cast(battle, apply.id, 'b');
    cast(battle, apply.id);
    const statuses = battle.unit('target').statuses;
    expect(statuses.map(s => [s.sourceId, s.priority])).toEqual([['b', 80], ['a', 50]]);
    expect(statuses[0]!.attrMods.magicAtk).toBeCloseTo(11);
    expect(statuses[1]!.attrMods.magicAtk).toBeCloseTo(11.1);
  });

  it('allocates repeated random effects only to recipients with room for the source stacks', () => {
    const allocate = skill('allocate', [{ type: EffectType.Repeat, min: 3, max: 3, effects: [
      { type: EffectType.ApplyStatus, statusId: dot.id, duration: 4,
        targeting: { side: TargetSide.Enemy, mode: TargetMode.Random, count: 1, ownedStatusStackLimit: { kind: dot.kind, max: 3 } } },
    ] }]);
    const battle = createBattle(config([allocate], [dot]));
    battle.applyStatus('target', dot.id, 4, 'a');
    battle.applyStatus('target', dot.id, 4, 'a');
    for (let i = 0; i < 3; i++) battle.applyStatus('ally', dot.id, 4, 'b');
    cast(battle, allocate.id);
    const owned = ['target', 'ally'].flatMap(id => battle.unit(id).statuses.filter(s => s.sourceId === 'a'));
    expect(owned.reduce((sum, s) => sum + s.stacks, 0)).toBe(5);
    expect(owned.every(s => s.stacks <= 3)).toBe(true);
    expect(battle.unit('ally').statuses.find(s => s.sourceId === 'b')?.stacks).toBe(3);
  });
});

describe('MP-funded damage absorption', () => {
  const shield: StatusDef = { id: 'mp-shield', name: 'mp-shield', kind: 'mp-shield', category: StatusCategory.Buff, mpShieldRatio: 0.5 };
  const hit = skill('hit', [{ type: EffectType.FixedHit, power: 101 }]);

  it.each([[0, 101, 0], [1, 100, 1], [20, 81, 20], [300, 51, 50]])('spends available MP once at MP=%i', (mp, damage, spent) => {
    const battle = createBattle(config([hit], [shield]));
    battle.unit('target').attrs.mp = mp;
    battle.applyStatus('target', shield.id, 4);
    cast(battle, hit.id);
    expect(battle.unit('target').attrs.hp).toBe(1000 - damage);
    expect(battle.unit('target').attrs.mp).toBe(mp - spent);
    const costs = battle.log().filter(e => e.type === EventType.MpCost && e.unitId === 'target');
    expect(costs.map(e => [e.amount, e.absorbedDamage, e.statusId])).toEqual(spent ? [[spent, spent, shield.id]] : []);
  });

  it('absorbs ordinary barriers before funding the remainder, without paying for shielded damage', () => {
    const barrier = skill('barrier', [{ type: EffectType.ApplyBarrier, id: 'barrier', kind: 'barrier', name: 'barrier', power: 61, duration: 4 }]);
    barrier.targeting = { side: TargetSide.Self };
    const battle = createBattle(config([hit, barrier], [shield]));
    battle.applyStatus('target', shield.id, 4);
    cast(battle, barrier.id, 'target', 'target');
    cast(battle, hit.id);
    expect(battle.unit('target').attrs.hp).toBe(980);
    expect(battle.unit('target').attrs.mp).toBe(280);
  });

  it('charges nominal overkill damage and lets the existing fatal rescue run exactly once', () => {
    const battle = createBattle(config([hit], [shield]));
    battle.unit('target').attrs.hp = 10;
    battle.applyStatus('target', shield.id, 4);
    let fatalities = 0;
    battle.hooks.on(HookName.OnFatal, h => { if (h.target?.id === 'target') { fatalities++; h.target.attrs.hp = 7; } });
    cast(battle, hit.id);
    expect(battle.unit('target').attrs.hp).toBe(7);
    expect(battle.unit('target').attrs.mp).toBe(250);
    expect(fatalities).toBe(1);
    expect(battle.unit('target').flags.downed).toBe(false);
  });

  it('does not make an overkill attack nonfatal and respects an explicit nonlethal strike', () => {
    const nonlethal = skill('nonlethal', [{ type: EffectType.FixedHit, power: 101, cannotKill: true }]);
    const battle = createBattle(config([hit, nonlethal], [shield]));
    battle.unit('target').attrs.hp = 10;
    battle.applyStatus('target', shield.id, 4);
    cast(battle, nonlethal.id);
    expect(battle.unit('target').attrs.hp).toBe(1);
    expect(battle.unit('target').attrs.mp).toBe(250);
    cast(battle, hit.id);
    expect(battle.unit('target').flags.downed).toBe(true);
    expect(battle.unit('target').attrs.mp).toBe(200);
  });

  it('applies independently to both recipients of redirected damage and to DOT', () => {
    const redirect: StatusDef = { id: 'redirect', name: 'redirect', kind: 'redirect', redirectTaken: { keep: 0.5, toCaster: 0.5 } };
    const dot: StatusDef = { id: 'dot', name: 'dot', kind: 'dot', ticks: StatusTick.RoundEnd, onTick: { type: TickKind.Dot, ratioOfMaxHp: 0.1 } };
    const battle = createBattle(config([hit], [shield, redirect, dot]));
    battle.applyStatus('target', shield.id, 4);
    battle.applyStatus('ally', shield.id, 4);
    battle.applyStatus('target', redirect.id, 4, 'ally');
    cast(battle, hit.id);
    expect([battle.unit('target').attrs.hp, battle.unit('ally').attrs.hp]).toEqual([975, 975]);
    expect([battle.unit('target').attrs.mp, battle.unit('ally').attrs.mp]).toEqual([275, 275]);
    battle.applyStatus('target', dot.id, 1, 'a');
    battle.lockAndResolve();
    expect([battle.unit('target').attrs.hp, battle.unit('ally').attrs.hp]).toEqual([950, 950]);
    expect([battle.unit('target').attrs.mp, battle.unit('ally').attrs.mp]).toEqual([250, 250]);
  });

  it('does not stack multiple MP shield ratios or charge for fully shielded damage', () => {
    const weaker = { ...shield, id: 'weaker', kind: 'weaker', mpShieldRatio: 0.25 };
    const barrier = skill('barrier', [{ type: EffectType.ApplyBarrier, id: 'barrier', kind: 'barrier', name: 'barrier', power: 200, duration: 4 }]);
    barrier.targeting.side = TargetSide.Self;
    const battle = createBattle(config([hit, barrier], [shield, weaker]));
    battle.applyStatus('target', shield.id, 4);
    battle.applyStatus('target', weaker.id, 4);
    cast(battle, hit.id);
    expect(battle.unit('target').attrs.hp).toBe(949);
    expect(battle.unit('target').attrs.mp).toBe(250);
    cast(battle, barrier.id, 'target', 'target');
    cast(battle, hit.id);
    expect(battle.unit('target').attrs.hp).toBe(949);
    expect(battle.unit('target').attrs.mp).toBe(250);
  });

  it('funds each critical/native repeat strike once and leaves paid HP costs unchanged', () => {
    const spell = skill('spell', [{ type: EffectType.SpellHit, power: 100 }]);
    spell.costHp = 100;
    const repeat: SkillDef = { ...skill('repeat', []), tags: [SkillTag.Passive], innate: { spellRepeat: { chance: 1, factor: 0.4 } } };
    const input = config([spell, repeat], [shield]);
    input.units[0]!.passives = [repeat.id];
    input.units[0]!.attrs.spellCritRate = 1;
    const battle = createBattle(input);
    battle.applyStatus('a', shield.id, 4);
    battle.applyStatus('target', shield.id, 4);
    cast(battle, spell.id);
    expect([battle.unit('target').attrs.hp, battle.unit('target').attrs.mp]).toEqual([860, 160]);
    expect([battle.unit('a').attrs.hp, battle.unit('a').attrs.mp]).toEqual([900, 300]);
  });
});
