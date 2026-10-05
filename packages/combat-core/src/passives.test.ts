import { describe, expect, it } from 'vitest';
import { BUILTIN_SKILL_ID } from './constants.js';
import {
  CommandType,
  EffectType,
  EventType,
  HookAim,
  HookName,
  HpZeroOutcome,
  SkillTag,
  TargetMode,
  TargetSide,
} from './enums.js';
import { createBattle } from './session.js';
import type { Ruleset, SkillDef } from './types.js';

const ruleset: Ruleset = {
  name: 'passive-targeting',
  maxRounds: 10,
  formulas: {
    fluctuationMin: 1,
    fluctuationMax: 1,
    physicalFluctuationMin: 1,
    physicalFluctuationMax: 1,
    critMultiplier: 2,
    furyAtkMultiplier: 1,
    defendPhysicalFactor: 1,
    physicalBase: (attack, defense) => Math.max(1, attack - defense),
    spellBase: (attack, defense, power) =>
      Math.max(1, attack - defense + power),
    baseDamage: ({ source, target, coeff, power }) =>
      Math.max(
        1,
        (source.attrs.physicalAtk - target.attrs.physicalDef) * coeff + power,
      ),
    physicalHitChance: () => 1,
    spellHitChance: () => 1,
    sealHitChance: () => 1,
    fleeChance: () => 0,
  },
  hpZeroOutcome: () => HpZeroOutcome.Dead,
  decideCommand: () => ({ type: CommandType.Defend }),
};

const pursuit: SkillDef = {
  id: 'pursuit',
  name: '追击',
  tags: [SkillTag.Passive],
  targeting: { side: TargetSide.Self },
  effects: [],
  hooks: [
    {
      on: HookName.AfterAction,
      sourceIsSelf: true,
      when: {
        skillIds: [BUILTIN_SKILL_ID.Attack],
        actionReducedTargetToZero: true,
        oncePerRound: true,
      },
      aim: HookAim.Others,
      aimMode: TargetMode.LowestHp,
      effects: [{ type: EffectType.PhysicalHit, resultFactors: [0.5] }],
    },
  ],
};

function battleWith(reveal?: 'passive' | 'status') {
  const awareness: SkillDef = {
    id: 'awareness',
    name: '灵觉',
    tags: [SkillTag.Passive],
    targeting: { side: TargetSide.Self },
    effects: [],
    innate: { revealStealth: true },
  };
  const battle = createBattle({
    seed: 1,
    versions: {
      engineVersion: 'combat-v6',
      rulesetVersion: 'daoyou_rules_v1',
      contentVersion: 'empty_content_v1',
      projectionVersion: 'character_panel_v1',
    },
    ruleset,
    skills: [pursuit, awareness],
    statusDefs: [
      { id: 'hidden', name: '隐身', kind: 'stealth', untargetable: true },
      { id: 'reveal', name: '看破', kind: 'reveal', revealStealth: true },
    ],
    units: [
      {
        id: 'source',
        name: 'source',
        side: 0,
        kind: 'npc',
        passives: reveal === 'passive' ? ['pursuit', 'awareness'] : ['pursuit'],
        attrs: { hp: 1000, speed: 10, physicalAtk: 100, physicalDef: 0 },
      },
      {
        id: 'target',
        name: 'target',
        side: 1,
        kind: 'npc',
        attrs: { hp: 10, speed: 1, physicalAtk: 0, physicalDef: 0 },
      },
      {
        id: 'hidden',
        name: 'hidden',
        side: 1,
        kind: 'npc',
        attrs: { hp: 100, maxHp: 1000, speed: 1, physicalAtk: 0, physicalDef: 0 },
      },
      {
        id: 'visible',
        name: 'visible',
        side: 1,
        kind: 'npc',
        attrs: { hp: 1000, speed: 1, physicalAtk: 0, physicalDef: 0 },
      },
    ],
  });
  battle.applyStatus('hidden', 'hidden', 5);
  if (reveal === 'status') battle.applyStatus('source', 'reveal', 5);
  return battle;
}

describe('passive targeting', () => {
  it('skips untargetable enemies when pursuing another target after a normal attack kill', () => {
    const battle = battleWith();
    expect(battle.queryCommands('source').attackTargetIds).not.toContain(
      'hidden',
    );
    battle.submit('source', { type: CommandType.Attack, target: 'target' });
    battle.lockAndResolve();

    expect(battle.unit('target').flags.dead).toBe(true);
    expect(
      battle
        .log()
        .flatMap((event) =>
          event.type === EventType.Hit && event.sourceId === 'source'
            ? [event.targetId]
            : [],
        ),
    ).toEqual(['target', 'visible']);
    expect(battle.unit('hidden').attrs.hp).toBe(100);
    expect(battle.unit('visible').attrs.hp).toBe(950);
  });

  it.each(['passive', 'status'] as const)(
    'allows pursuit to reveal hidden enemies through a %s',
    (reveal) => {
      const battle = battleWith(reveal);
      expect(battle.queryCommands('source').attackTargetIds).toContain(
        'hidden',
      );
      battle.submit('source', { type: CommandType.Attack, target: 'target' });
      battle.lockAndResolve();

      expect(
        battle
          .log()
          .flatMap((event) =>
            event.type === EventType.Hit && event.sourceId === 'source'
              ? [event.targetId]
              : [],
          ),
      ).toEqual(['target', 'hidden']);
      expect(battle.unit('hidden').attrs.hp).toBe(50);
      expect(battle.unit('visible').attrs.hp).toBe(1000);
    },
  );
});
