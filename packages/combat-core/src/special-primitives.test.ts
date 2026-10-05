import { describe, expect, it } from 'vitest';
import {
  CommandType,
  DamageKind,
  EffectType,
  EventType,
  HookName,
  HpZeroOutcome,
  SkillTag,
  StatusTick,
  TargetMode,
  TargetSide,
  TickKind,
} from './enums.js';
import { evalExpr } from './expr.js';
import { createBattle, restoreBattle } from './session.js';
import type {
  CreateBattleInput,
  LineupUnit,
  Ruleset,
  SkillDef,
} from './types.js';

const ruleset: Ruleset = {
  name: 'special-primitives',
  maxRounds: 20,
  formulas: {
    fluctuationMin: 1,
    fluctuationMax: 1,
    physicalFluctuationMin: 1,
    physicalFluctuationMax: 1,
    critMultiplier: 2,
    furyAtkMultiplier: 1,
    defendPhysicalFactor: 0.5,
    physicalBase: (attack, defense) => Math.max(1, attack - defense),
    spellBase: (attack, defense, power) =>
      Math.max(1, attack - defense + power),
    baseDamage: ({ source, target, kind, power, coeff }) =>
      kind === DamageKind.Fixed
        ? power
        : Math.max(
            1,
            ((kind === DamageKind.Spell
              ? source.attrs.magicAtk - target.attrs.magicDef
              : source.attrs.physicalAtk - target.attrs.physicalDef) +
              power) *
              coeff,
          ),
    physicalHitChance: () => 1,
    spellHitChance: () => 1,
    sealHitChance: () => 1,
    fleeChance: () => 0,
  },
  hpZeroOutcome: () => HpZeroOutcome.Dead,
  decideCommand: () => ({ type: CommandType.Defend }),
};

function skill(id: string, overrides: Partial<SkillDef> = {}): SkillDef {
  return {
    id,
    name: id,
    tags: [SkillTag.Spell],
    targeting: { side: TargetSide.Enemy, count: 1 },
    effects: [{ type: EffectType.SpellHit }],
    ...overrides,
  };
}

const novelty = skill('novelty', {
  tags: [SkillTag.Passive],
  effects: [],
  hooks: [undefined, DamageKind.Fixed].map((requireKind) => ({
    on: HookName.OnHitCalc,
    sourceIsSelf: true,
    requireKind,
    effects: [
      {
        type: EffectType.ModifyStrike,
        factor: 'if(allyPetSkillUnused, 1.15, 1)',
      },
    ],
  })),
});

function lineup(
  extra: Partial<Omit<LineupUnit, 'attrs'>> & {
    attrs?: Partial<LineupUnit['attrs']>;
  },
): LineupUnit {
  return {
    name: 'unit',
    side: 0,
    kind: 'npc',
    ...extra,
    attrs: {
      hp: 10000,
      speed: 1,
      physicalAtk: 0,
      physicalDef: 0,
      ...extra.attrs,
    },
  };
}

function config(skills: SkillDef[]): CreateBattleInput {
  return {
    seed: 1,
    ruleset,
    skills: [novelty, ...skills],
    versions: {
      engineVersion: 'combat-v6',
      rulesetVersion: 'daoyou_rules_v1',
      contentVersion: 'empty_content_v1',
      projectionVersion: 'character_panel_v1',
    },
    units: [
      lineup({
        id: 'source',
        name: 'source',
        side: 0,
        kind: 'pet',
        skills: skills.map((s) => s.id),
        passives: ['novelty'],
        combatFacts: { strength: 120 },
        attrs: {
          hp: 10000,
          mp: 200,
          speed: 10,
          physicalAtk: 1000,
          magicAtk: 1000,
        },
      }),
      lineup({
        id: 'target',
        name: 'target',
        side: 1,
        kind: 'player',
        combatFacts: { defenseContribution: 50 },
        attrs: { hp: 10000, mp: 200, speed: 1, physicalDef: 200 },
      }),
      lineup({
        id: 'other',
        name: 'other',
        side: 1,
        kind: 'npc',
        attrs: { hp: 10000, speed: 1 },
      }),
    ],
  };
}

function damage(
  events: ReturnType<ReturnType<typeof createBattle>['log']>,
  sourceId = 'source',
): number[] {
  return events.flatMap((e) =>
    e.type === EventType.Damage && e.sourceId === sourceId ? [e.amount] : [],
  );
}

describe('generic special-skill primitives', () => {
  it('subtracts only supplied defense and overrides the defend factor without mutating the target panel', () => {
    const attack = skill('break', {
      tags: [SkillTag.Physical],
      effects: [
        {
          type: EffectType.PhysicalHit,
          defenseSubtract: 'targetFact.defenseContribution',
          defendFactor: 1.5,
          cannotMiss: true,
        },
      ],
    });
    const input = config([attack]);
    input.units[0]!.passives = [];
    const battle = createBattle(input);
    battle.submit('source', {
      type: CommandType.Skill,
      skillId: attack.id,
      targets: ['target'],
    });
    battle.lockAndResolve();
    expect(damage(battle.log())).toEqual([1275]);
    expect(battle.unit('target').attrs.physicalDef).toBe(200);
    const source = battle.unit('source');
    const target = battle.unit('target');
    target.flags.defending = true;
    expect(
      evalExpr(
        'targetIsPlayer + targetDefending + targetFact.defenseContribution',
        { source, target, skillLevel: 1, targets: 1 },
      ),
    ).toBe(52);
  });

  it('keeps one novelty decision across all group targets and the whole spell repeat, then resets next round', () => {
    const group = skill('group', {
      targeting: { side: TargetSide.Enemy, count: 2, mode: TargetMode.Fill },
    });
    const repeat = skill('repeat', {
      tags: [SkillTag.Passive],
      effects: [],
      innate: { spellRepeat: { chance: 1, factor: 0.5 } },
    });
    const battle = createBattle(config([group, repeat]));
    battle.unit('source').passives.push('repeat');
    for (let round = 0; round < 2; round++) {
      battle.submit('source', {
        type: CommandType.Skill,
        skillId: group.id,
        targets: ['target'],
      });
      battle.lockAndResolve();
    }
    expect(damage(battle.log())).toEqual([
      1150, 1150, 575, 575, 1150, 1150, 575, 575,
    ]);
  });

  it('counts allied beast casts without the novelty passive, but excludes characters using the same skill', () => {
    for (const isBeast of [0, 1]) {
      const spell = skill('spell');
      const input = config([spell]);
      input.units.push(
        lineup({
          id: 'ally',
          name: 'ally',
          side: 0,
          kind: 'npc',
          skills: ['spell'],
          combatFacts: { isBeast },
          attrs: { hp: 10000, mp: 200, speed: 20, magicAtk: 1000 },
        }),
      );
      const battle = createBattle(input);
      battle.submit('ally', {
        type: CommandType.Skill,
        skillId: 'spell',
        targets: ['target'],
      });
      battle.submit('source', {
        type: CommandType.Skill,
        skillId: 'spell',
        targets: ['target'],
      });
      battle.lockAndResolve();
      expect(damage(battle.log())).toEqual([isBeast ? 1000 : 1150]);
    }
  });

  it('supports physical and fixed attack novelty and does not record rejected MP payment', () => {
    for (const type of [EffectType.PhysicalHit, EffectType.FixedHit]) {
      const attack = skill('strike', {
        costMp: 5,
        effects: [{ type, power: type === EffectType.FixedHit ? 1000 : 0 }],
      });
      const input = config([attack]);
      input.units[1]!.attrs.physicalDef = 0;
      const battle = createBattle(input);
      battle.submit('target', { type: CommandType.Attack, target: 'source' });
      battle.submit('source', {
        type: CommandType.Skill,
        skillId: 'strike',
        targets: ['target'],
      });
      battle.lockAndResolve();
      expect(damage(battle.log())).toEqual([1150]);
      const rejected = createBattle(input);
      rejected.unit('source').attrs.mp = 0;
      rejected.submit('source', {
        type: CommandType.Skill,
        skillId: 'strike',
        targets: ['target'],
      });
      rejected.lockAndResolve();
      expect(rejected.unit('source').skillsUsedThisRound).toBeUndefined();
    }
  });

  it('checks each invoked child skill independently against every allied beast use', () => {
    const first = skill('first');
    const second = skill('second');
    const invoke = skill('invoke', {
      effects: [{ type: EffectType.InvokeAttackSkills }],
    });
    const input = config([first, second, invoke]);
    input.units.push(
      lineup({
        id: 'ally',
        name: 'ally',
        side: 0,
        kind: 'pet',
        skills: ['first'],
        attrs: { hp: 10000, mp: 200, speed: 20, magicAtk: 1000 },
      }),
    );
    const battle = createBattle(input);
    battle.submit('ally', {
      type: CommandType.Skill,
      skillId: 'first',
      targets: ['target'],
    });
    battle.submit('source', {
      type: CommandType.Skill,
      skillId: 'invoke',
      targets: ['target'],
    });
    battle.lockAndResolve();
    expect(damage(battle.log()).sort((a, b) => a - b)).toEqual([1000, 1150]);
  });

  it('snapshots the strongest same-kind MP tick, fires next round only, and expires at that round end after restoration', () => {
    const apply = skill('apply', {
      effects: [
        { type: EffectType.ApplyStatus, statusId: 'drain', duration: 1 },
        { type: EffectType.ModifyFact, key: 'strength', value: 12 },
        { type: EffectType.ApplyStatus, statusId: 'drain', duration: 1 },
      ],
    });
    const input = config([apply]);
    input.statusDefs = [
      {
        id: 'drain',
        name: 'drain',
        kind: 'drain',
        ticks: StatusTick.RoundStart,
        priority: 'floor(fact.strength / 12 + 1)',
        onTick: {
          type: TickKind.Dot,
          mpPower: 'floor(fact.strength / 12 + 1)',
          snapshot: true,
        },
      },
    ];
    const battle = createBattle(input);
    battle.submit('source', {
      type: CommandType.Skill,
      skillId: 'apply',
      targets: ['target'],
    });
    battle.lockAndResolve((state) => {
      if (!state.units.find((u) => u.id === 'target')?.statuses.length) return;
      expect(state.units.find((u) => u.id === 'target')?.attrs.mp).toBe(200);
    });
    expect(battle.unit('target').attrs.mp).toBe(189);
    expect(battle.unit('target').statuses[0]?.tickMpPower).toBe(11);
    expect(battle.unit('target').statuses[0]?.priority).toBe(11);
    expect(battle.unit('target').statuses[0]?.tickMpPower).toBe(11);
    const restored = restoreBattle(
      input,
      JSON.parse(JSON.stringify(battle.snapshot())),
      [...battle.log()],
    );
    battle.lockAndResolve();
    restored.lockAndResolve();
    expect(battle.unit('target').attrs.mp).toBe(189);
    expect(battle.unit('target').statuses).toEqual([]);
    expect(restored.snapshot()).toEqual(battle.snapshot());
    expect(restored.log()).toEqual(battle.log());
  });

  it('allows a weaker replacement after the previous round-start tick was consumed', () => {
    const apply = skill('apply', {
      effects: [
        { type: EffectType.ApplyStatus, statusId: 'drain', duration: 1 },
      ],
    });
    const input = config([apply]);
    input.statusDefs = [
      {
        id: 'drain',
        name: 'drain',
        kind: 'drain',
        ticks: StatusTick.RoundStart,
        priority: 'floor(fact.strength / 12 + 1)',
        onTick: {
          type: TickKind.Dot,
          mpPower: 'floor(fact.strength / 12 + 1)',
          snapshot: true,
        },
      },
    ];
    const battle = createBattle(input);
    battle.submit('source', {
      type: CommandType.Skill,
      skillId: 'apply',
      targets: ['target'],
    });
    battle.lockAndResolve();
    expect(battle.unit('target').attrs.mp).toBe(189);
    battle.unit('source').combatFacts!.strength = 12;
    battle.submit('source', {
      type: CommandType.Skill,
      skillId: 'apply',
      targets: ['target'],
    });
    battle.lockAndResolve();
    expect(battle.unit('target').attrs.mp).toBe(187);
    expect(battle.unit('target').statuses[0]?.priority).toBe(2);
    battle.lockAndResolve();
    expect(battle.unit('target').attrs.mp).toBe(187);
    expect(battle.unit('target').statuses).toEqual([]);
  });
});
