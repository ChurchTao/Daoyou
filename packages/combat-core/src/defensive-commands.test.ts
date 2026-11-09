import { describe, expect, it } from 'vitest';
import { CommandType, DamageKind, EffectType, EventType, HookAim, HookName, HpZeroOutcome, SkillTag, TargetSide } from './enums.js';
import { createBattle } from './session.js';
import type { CreateBattleInput, SkillDef } from './types.js';

const defense: SkillDef = {
  id: 'defense', name: 'defense', tags: [SkillTag.Passive], targeting: { side: TargetSide.Self }, effects: [],
  hooks: [{ on: HookName.AfterDefend, sourceIsSelf: true, aim: HookAim.Self, effects: [
    { type: EffectType.ApplyBarrier, id: 'shield', kind: 'shield', name: 'shield', power: 40, duration: 1 },
    { type: EffectType.ModifyFact, key: 'prepared', value: 'round + 1' },
  ] }],
};

function setup(skills: SkillDef[] = [defense]) {
  const input: CreateBattleInput = {
    seed: 7,
    versions: { engineVersion: 'combat-v6', rulesetVersion: 'test', contentVersion: 'test', projectionVersion: 'test' },
    ruleset: {
      name: 'defensive-commands', maxRounds: 10,
      formulas: {
        fluctuationMin: 1, fluctuationMax: 1, physicalFluctuationMin: 1, physicalFluctuationMax: 1,
        critMultiplier: 2, furyAtkMultiplier: 1, defendPhysicalFactor: 0.5,
        physicalBase: (attack, defense) => attack - defense,
        spellBase: (attack, defense, power) => attack - defense + power,
        baseDamage: ({ source, kind, power }) => kind === DamageKind.Fixed ? power : source.attrs.physicalAtk,
        physicalHitChance: () => 1, spellHitChance: () => 1, sealHitChance: () => 1, fleeChance: () => 0,
      },
      hpZeroOutcome: () => HpZeroOutcome.Dead,
      decideCommand: () => ({ type: CommandType.Defend }),
    },
    skills,
    statusDefs: [
      { id: 'stun', name: 'stun', kind: 'stun', blocksAction: true },
      { id: 'forced', name: 'forced', kind: 'forced', commandPolicy: 'storedAttack', storedTargetId: 'enemy' },
    ],
    units: [
      { id: 'defender', name: 'defender', side: 0, kind: 'player', passives: skills.map(skill => skill.id), attrs: { hp: 1000, mp: 100, maxMp: 100, speed: 1, physicalAtk: 100 } },
      { id: 'ally', name: 'ally', side: 0, kind: 'player', attrs: { hp: 1000, speed: 2, physicalAtk: 100 } },
      { id: 'enemy', name: 'enemy', side: 1, kind: 'player', attrs: { hp: 1000, speed: 100, physicalAtk: 100 } },
    ],
  };
  return createBattle(input);
}

describe('defensive commands at round lock', () => {
  it('applies a slow defender’s barrier and preparation before a faster attack, exactly once', () => {
    const battle = setup();
    battle.submit('defender', { type: CommandType.Defend });
    battle.submit('enemy', { type: CommandType.Attack, target: 'defender' });
    battle.lockAndResolve();
    expect(battle.unit('defender').attrs.hp).toBe(990);
    expect(battle.unit('defender').combatFacts?.prepared).toBe(2);
    const log = battle.log();
    expect(log.findIndex(event => event.type === EventType.BarrierChanged)).toBeLessThan(
      log.findIndex(event => event.type === EventType.ActionStart && event.unitId === 'enemy'),
    );
    expect(log.filter(event => event.type === EventType.ActionStart && event.unitId === 'defender')).toHaveLength(1);
    expect(log.filter(event => event.type === EventType.BarrierChanged && event.reason === 'applied')).toHaveLength(1);
    expect(battle.unit('defender').attrs.mp).toBe(100);
    expect(battle.unit('defender').skillUses).toEqual({});
    expect(battle.unit('defender').spellActionsSinceEntry).toBe(0);
  });

  it('commits a slow protector before attacks and keeps its ordinary action-window tail at its speed slot', () => {
    const battle = setup([]);
    const order: string[] = [];
    battle.hooks.on(HookName.BeforeAction, h => { if (h.source?.id === 'defender') order.push('prepare'); });
    battle.hooks.on(HookName.AfterAction, h => { if (h.source?.id === 'enemy') order.push('attack'); });
    battle.hooks.on(HookName.AfterActionWindow, h => { if (h.source?.id === 'defender') order.push('tail'); });
    battle.submit('defender', { type: CommandType.Protect, target: 'ally' });
    battle.submit('enemy', { type: CommandType.Attack, target: 'ally' });
    battle.lockAndResolve();
    expect(order).toEqual(['prepare', 'attack', 'tail']);
    expect(battle.unit('defender').attrs.hp).toBe(950);
    expect(battle.unit('ally').attrs.hp).toBe(1000);
    expect(battle.log().filter(event => event.type === EventType.ActionStart && event.unitId === 'defender')).toHaveLength(1);
  });

  it.each(['rest', 'control', 'cancelled', 'no-command'] as const)(
    'does not grant early defense or a barrier when %s prevents the command', mode => {
      const battle = setup();
      if (mode === 'rest') battle.unit('defender').flags.skipNextAction = true;
      if (mode === 'control') battle.applyStatus('defender', 'stun', 2, 'enemy');
      if (mode === 'cancelled' || mode === 'no-command') battle.hooks.on(HookName.BeforeAction, h => {
        if (h.source?.id !== 'defender') return;
        if (mode === 'cancelled') h.cancelled = true;
        else h.source.command = undefined;
      });
      battle.submit('defender', { type: CommandType.Defend });
      battle.submit('enemy', { type: CommandType.Attack, target: 'defender' });
      battle.lockAndResolve();
      expect(battle.unit('defender').attrs.hp).toBe(900);
      expect(battle.unit('defender').barriers).toEqual([]);
      expect(battle.unit('defender').combatFacts?.prepared).toBeUndefined();
      expect(battle.unit('defender').flags.skipNextAction).toBe(false);
      expect(battle.log().filter(event => event.type === EventType.ActionSkip && event.unitId === 'defender')).toHaveLength(1);
    },
  );

  it('keeps a forced attack at the original speed and does not grant a defensive shield', () => {
    const battle = setup();
    const order: string[] = [];
    battle.hooks.on(HookName.AfterAction, h => { if (h.source) order.push(h.source.id); });
    battle.applyStatus('defender', 'forced', 2, 'defender');
    battle.submit('defender', { type: CommandType.Defend });
    battle.submit('enemy', { type: CommandType.Attack, target: 'defender' });
    battle.lockAndResolve();
    expect(order).toEqual(['enemy', 'defender']);
    expect(battle.unit('defender').attrs.hp).toBe(900);
    expect(battle.unit('defender').barriers).toEqual([]);
    expect(battle.unit('enemy').attrs.hp).toBe(900);
  });

  it.each(['rest', 'control', 'cancelled'] as const)('does not allow a %s protector to intercept an early attack', mode => {
    const battle = setup([]);
    if (mode === 'rest') battle.unit('defender').flags.skipNextAction = true;
    if (mode === 'control') battle.applyStatus('defender', 'stun', 2, 'enemy');
    if (mode === 'cancelled') battle.hooks.on(HookName.BeforeAction, h => {
      if (h.source?.id === 'defender') h.cancelled = true;
    });
    battle.submit('defender', { type: CommandType.Protect, target: 'ally' });
    battle.submit('enemy', { type: CommandType.Attack, target: 'ally' });
    battle.lockAndResolve();
    expect(battle.unit('defender').attrs.hp).toBe(1000);
    expect(battle.unit('ally').attrs.hp).toBe(950);
    expect(battle.log().some(event => event.type === EventType.ProtectTrigger)).toBe(false);
  });

  it('does not move an attack produced by a BeforeAction hook into the defensive phase', () => {
    const battle = setup([]);
    const order: string[] = [];
    battle.hooks.on(HookName.BeforeAction, h => {
      if (h.source?.id === 'defender') h.source.command = { type: CommandType.Attack, target: 'enemy' };
    });
    battle.hooks.on(HookName.AfterAction, h => { if (h.source) order.push(h.source.id); });
    battle.submit('defender', { type: CommandType.Defend });
    battle.submit('enemy', { type: CommandType.Attack, target: 'defender' });
    battle.lockAndResolve();
    expect(order).toEqual(['enemy', 'defender']);
    expect(battle.unit('defender').attrs.hp).toBe(900);
  });

  it.each(['defensive-effect', 'ordinary-attack'] as const)('cancels open defensive windows without effects when %s ends the battle', mode => {
    const finish: SkillDef = {
      ...defense, id: 'finish', hooks: [{ on: HookName.AfterDefend, sourceIsSelf: true,
        targeting: { side: TargetSide.Enemy, mode: 'all' },
        effects: [{ type: EffectType.FixedHit, power: 2000 }],
      }],
    };
    const tail: SkillDef = {
      ...defense, id: 'tail', hooks: [{ on: HookName.AfterActionWindow, sourceIsSelf: true, aim: HookAim.Self,
        effects: [{ type: EffectType.ApplyBarrier, id: 'tail', kind: 'tail', name: 'tail', power: 999, duration: 2 }],
      }],
    };
    const battle = setup(mode === 'defensive-effect' ? [defense, finish, tail] : [defense, tail]);
    battle.unit('defender').attrs.speed = 3;
    battle.unit('ally').passives = ['defense', 'tail'];
    const windows: string[] = [];
    battle.hooks.on(HookName.BeforeActionWindow, h => { if (h.source?.side === 0) windows.push(`before:${h.source.id}`); });
    battle.hooks.on(HookName.AfterActionWindow, h => {
      if (h.source?.side === 0) windows.push(`after:${h.source.id}:${Boolean(h.cancelled)}`);
    });
    if (mode === 'ordinary-attack') {
      battle.unit('ally').attrs.hp = 0;
      battle.unit('ally').flags.dead = true;
      battle.unit('defender').attrs.hp = 1;
      battle.submit('enemy', { type: CommandType.Attack, target: 'defender' });
    }
    battle.submit('defender', { type: CommandType.Defend });
    battle.lockAndResolve();
    expect(battle.finished).toBe(true);
    expect(windows).toEqual(mode === 'defensive-effect'
      ? ['before:defender', 'before:ally', 'after:defender:true', 'after:ally:true']
      : ['before:defender', 'after:defender:true']);
    const afterEnd = battle.log().slice(battle.log().findIndex(event => event.type === EventType.BattleEnd) + 1);
    expect(afterEnd.some(event => event.type === EventType.ActionStart || event.type === EventType.BarrierChanged)).toBe(false);
    expect(battle.unit('ally').barriers).toEqual([]);
  });
});
