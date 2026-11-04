import { describe, expect, it } from 'vitest';
import { createBattle, restoreBattle } from './session.js';
import type { CreateBattleInput, Ruleset, SkillDef } from './types.js';

const rules: Ruleset = {
  name: 'deferred-retaliation', maxRounds: 4,
  formulas: {
    fluctuationMin: 1, fluctuationMax: 1, physicalFluctuationMin: 1, physicalFluctuationMax: 1,
    critMultiplier: 2, furyAtkMultiplier: 1, defendPhysicalFactor: 1,
    physicalBase: (attack, defense) => Math.max(1, attack - defense),
    spellBase: (attack, defense) => Math.max(1, attack - defense),
    baseDamage: ({ source, target, coeff, power }) => Math.max(1, (source.attrs.physicalAtk - target.attrs.physicalDef) * coeff + power),
    physicalHitChance: () => 1, spellHitChance: () => 1, sealHitChance: () => 1, fleeChance: () => 0,
  },
  hpZeroOutcome: unit => unit.kind === 'player' ? 'downed' : 'dead',
  decideCommand: () => ({ type: 'defend' }),
};
const versions = { engineVersion: 'combat-v6', rulesetVersion: 'test', contentVersion: 'test', projectionVersion: 'test' } as const;
const reflect: SkillDef = {
  id: 'reflect', name: 'reflect', tags: ['passive'], targeting: { side: 'self' }, effects: [],
  hooks: [{ on: 'onBeHit', targetIsSelf: true, retaliation: true, requireKind: 'physical', aim: 'hookSource', effects: [{ type: 'fixedHit', power: 120 }] }],
};
const defer: SkillDef = {
  id: 'defer', name: 'defer', tags: ['passive'], targeting: { side: 'self' }, effects: [],
  modifiers: [{ deferFatalRetaliation: true }],
  hooks: [{ on: 'afterDamage', targetIsSelf: true, when: { retaliationDamage: true, requireKind: 'fixed' }, aim: 'self', effects: [{ type: 'modifyFact', key: 'reflectGain', value: 'fact.reflectGain + floor(hpDamage * 0.05)' }] }],
};
const double: SkillDef = {
  id: 'double', name: 'double', tags: ['physical'], targeting: { side: 'enemy' },
  effects: [{ type: 'physicalHit', coeff: 1, hits: 2 }],
};

function input(foeHp: number, skill = false): CreateBattleInput {
  return {
    seed: 11, versions, ruleset: rules, skills: [reflect, defer, double],
    units: [
      { id: 'attacker', name: 'attacker', kind: 'player', side: 0, attrs: { hp: 100, maxHp: 100, speed: 100, physicalAtk: 100 }, passives: ['defer'], skills: skill ? ['double'] : [] },
      { id: 'foe', name: 'foe', kind: 'npc', side: 1, attrs: { hp: foeHp, maxHp: foeHp, speed: 10 }, passives: ['reflect'] },
    ],
  };
}

describe('deferred fatal fixed retaliation', () => {
  it('keeps the attacker standing through a multi-hit action, then downs it and snapshots the settled state', () => {
    const setup = input(1000, true);
    const b = createBattle(setup);
    let afterAction = b.snapshot();
    b.submit('attacker', { type: 'skill', skillId: 'double', targets: ['foe'] });
    b.lockAndResolve(state => { afterAction = state; });
    expect(b.log().filter(event => event.type === 'damage' && event.sourceId === 'attacker')).toHaveLength(2);
    expect(b.unit('attacker').flags.downed).toBe(true);
    expect(b.unit('attacker').combatFacts?.reflectGain).toBe(4);
    expect(afterAction.units.find(unit => unit.id === 'attacker')?.pendingRetaliationFatal).toBeUndefined();
    expect(afterAction.units.find(unit => unit.id === 'attacker')?.flags.downed).toBe(true);
    const restored = restoreBattle(setup, b.snapshot(), [...b.log()]);
    expect(restored.snapshot()).toEqual(b.snapshot());
  });

  it('decides a simultaneous wipe after settling the delayed fatal hit', () => {
    const b = createBattle(input(80));
    let afterAction = b.snapshot();
    b.submit('attacker', { type: 'attack', target: 'foe' });
    b.lockAndResolve(state => { afterAction = state; });
    expect(b.state.result).toEqual({ winner: 'draw', reason: 'wipe' });
    expect(afterAction.result).toEqual(b.state.result);
    const events = b.log().map(event => event.type);
    expect(events.indexOf('unitDead')).toBeLessThan(events.indexOf('unitDowned'));
    expect(events.indexOf('unitDowned')).toBeLessThan(events.indexOf('battleEnd'));
  });
});
