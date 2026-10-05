import { describe, expect, it } from 'vitest';
import {
  CommandType,
  DamageKind,
  EffectType,
  EventType,
  HookName,
  HpZeroOutcome,
  SkillTag,
  StatusCategory,
  TargetSide,
} from './enums.js';
import { createBattle, restoreBattle, type BattleSession } from './session.js';
import { isActiveAttackSkill } from './skills.js';
import type { CreateBattleInput, Ruleset, SkillDef } from './types.js';

const ruleset: Ruleset = {
  name: 'skill-invocation',
  maxRounds: 200,
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
      Math.max(
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

const invocation: SkillDef = {
  id: 'invocation',
  name: '连续施法',
  tags: [SkillTag.Spell],
  targeting: { side: TargetSide.Enemy, count: 1 },
  cooldownRounds: 150,
  effects: [{ type: EffectType.InvokeAttackSkills }],
};

function attack(id: string, overrides: Partial<SkillDef> = {}): SkillDef {
  return {
    id,
    name: id,
    tags: [SkillTag.Spell],
    targeting: { side: TargetSide.Enemy, count: 1 },
    effects: [{ type: EffectType.SpellHit }],
    ...overrides,
  };
}

function input(skills: SkillDef[], seed = 1): CreateBattleInput {
  return {
    seed,
    versions: {
      engineVersion: 'combat-v6',
      rulesetVersion: 'daoyou_rules_v1',
      contentVersion: 'empty_content_v1',
      projectionVersion: 'character_panel_v1',
    },
    ruleset,
    skills: [invocation, ...skills],
    statusDefs: [
      {
        id: 'seal',
        name: '封法',
        kind: 'seal',
        category: StatusCategory.Control,
        blocksSpell: true,
      },
    ],
    units: [
      {
        id: 'source',
        name: 'source',
        side: 0,
        kind: 'npc',
        skills: [
          invocation.id,
          ...skills
            .filter((skill) => !skill.tags.includes(SkillTag.Passive))
            .map((skill) => skill.id),
        ],
        passives: skills
          .filter((skill) => skill.tags.includes(SkillTag.Passive))
          .map((skill) => skill.id),
        attrs: {
          hp: 1000,
          mp: 100,
          speed: 10,
          physicalAtk: 100,
          physicalDef: 0,
          magicAtk: 100,
        },
      },
      {
        id: 'target',
        name: 'target',
        side: 1,
        kind: 'npc',
        attrs: { hp: 10000, speed: 1, physicalAtk: 0, physicalDef: 0 },
      },
      {
        id: 'other',
        name: 'other',
        side: 1,
        kind: 'npc',
        attrs: { hp: 10000, speed: 1, physicalAtk: 0, physicalDef: 0 },
      },
    ],
  };
}

function invoke(battle: BattleSession): void {
  battle.submit('source', {
    type: CommandType.Skill,
    skillId: invocation.id,
    targets: ['target'],
  });
  battle.lockAndResolve();
}

function casts(battle: BattleSession): string[] {
  return battle
    .log()
    .flatMap((event) =>
      event.type === EventType.ActionStart &&
      event.unitId === 'source' &&
      event.command.type === CommandType.Skill
        ? [event.command.skillId]
        : [],
    );
}

describe('invoking learned attack skills', () => {
  it('casts on round 1 for any unit, excludes utility/passives/recursive invocations, and uses normal costs/cooldowns', () => {
    const first = attack('first', { costMp: 7, cooldownRounds: 3 });
    const branch = attack('branch', {
      costMp: 11,
      effects: [
        {
          type: EffectType.RandomBranch,
          branchId: 'branch',
          chance: 1,
          successEffects: [{ type: EffectType.SpellHit }],
          failureEffects: [],
        },
      ],
    });
    const utility = attack('utility', {
      effects: [{ type: EffectType.RestoreMp, power: 100 }],
    });
    const passive = attack('passive', { tags: [SkillTag.Passive] });
    const recursive = attack('recursive', {
      effects: [
        { type: EffectType.SpellHit },
        {
          type: EffectType.Repeat,
          min: 1,
          max: 1,
          effects: [{ type: EffectType.InvokeAttackSkills }],
        },
      ],
    });
    const battle = createBattle(
      input([first, branch, utility, passive, recursive]),
    );
    invoke(battle);

    expect(casts(battle)[0]).toBe(invocation.id);
    expect(casts(battle).slice(1).sort()).toEqual(['branch', 'first']);
    expect(battle.unit('source').attrs.mp).toBe(82);
    expect(battle.unit('source').cooldowns).toEqual({
      invocation: 151,
      first: 4,
    });
    expect(battle.unit('source').skillUses).toEqual({
      invocation: 1,
      branch: 1,
      first: 1,
    });
    expect(battle.unit('source').spellActionsSinceEntry).toBe(2);
    expect(
      battle
        .queryCommands('source')
        .skills.find((skill) => skill.skillId === invocation.id)
        ?.cooldownRemaining,
    ).toBe(149);
  });

  it('shuffles once deterministically and produces the same events after snapshot restoration', () => {
    const config = input([attack('one'), attack('two'), attack('three')], 41);
    const battle = createBattle(config);
    const restored = restoreBattle(config, battle.snapshot(), [
      ...battle.log(),
    ]);
    invoke(battle);
    invoke(restored);
    expect(restored.log()).toEqual(battle.log());
    expect(restored.snapshot()).toEqual(battle.snapshot());
    const orders = new Set(
      Array.from({ length: 8 }, (_, seed) => {
        const other = createBattle({ ...config, seed });
        invoke(other);
        return casts(other).join(',');
      }),
    );
    expect(orders.size).toBeGreaterThan(1);
  });

  it('stops on insufficient MP without a fallback normal attack and keeps the invocation cooldown', () => {
    const battle = createBattle(
      input([attack('one', { costMp: 4 }), attack('two', { costMp: 4 })]),
    );
    battle.unit('source').attrs.mp = 5;
    invoke(battle);
    expect(casts(battle)).toHaveLength(2);
    expect(battle.unit('source').attrs.mp).toBe(1);
    expect(battle.unit('source').skillUses?.invocation).toBe(1);
    expect(battle.unit('source').cooldowns?.invocation).toBe(151);
    expect(battle.log()).toContainEqual({
      type: EventType.ActionFailed,
      unitId: 'source',
      reason: 'insufficient-mp',
    });
    expect(
      battle
        .log()
        .some(
          (event) =>
            event.type === EventType.ActionStart &&
            event.unitId === 'source' &&
            event.command.type === CommandType.Attack,
        ),
    ).toBe(false);
  });

  it('rejects an empty learned attack pool in command queries and execution without using cooldown/resources', () => {
    const utility = attack('utility', {
      effects: [{ type: EffectType.RestoreMp, power: 100 }],
    });
    const battle = createBattle(input([utility]));
    const option = battle
      .queryCommands('source')
      .skills.find((skill) => skill.skillId === invocation.id);
    expect(option?.ready).toBe(false);
    expect(option?.reasons).toContain('skill-condition');
    invoke(battle);
    expect(casts(battle)).toEqual([]);
    expect(battle.unit('source').attrs.mp).toBe(100);
    expect(battle.unit('source').cooldowns?.invocation).toBeUndefined();
    expect(battle.unit('source').skillUses?.invocation).toBeUndefined();
    expect(battle.log()).toContainEqual({
      type: EventType.ActionFailed,
      unitId: 'source',
      reason: 'skill-condition',
    });
  });

  it('uses ordinary spell eligibility for the invocation without consuming the first actual spell', () => {
    const battle = createBattle(input([attack('one')]));
    battle.applyStatus('source', 'seal', 5);
    const option = battle
      .queryCommands('source')
      .skills.find((skill) => skill.skillId === invocation.id);
    expect(option?.ready).toBe(false);
    expect(option?.reasons).toContain('sealed');
    invoke(battle);
    expect(casts(battle)).toEqual([]);
    expect(battle.unit('source').cooldowns?.invocation).toBeUndefined();
    expect(battle.unit('source').spellActionsSinceEntry).toBe(0);

    const unsealed = createBattle(input([attack('one')]));
    invoke(unsealed);
    expect(unsealed.unit('source').spellActionsSinceEntry).toBe(1);
  });

  it('stops after becoming spell-sealed or dying during a child skill', () => {
    for (const interrupt of ['seal', 'death']) {
      const battle = createBattle(input([attack('one'), attack('two')]));
      battle.hooks.on(HookName.AfterHit, ({ source }) => {
        if (source?.id !== 'source') return;
        if (interrupt === 'seal') battle.applyStatus('source', 'seal', 5);
        else source.flags.dead = true;
      });
      invoke(battle);
      expect(casts(battle)).toHaveLength(2);
      expect(battle.unit('source').skillUses?.invocation).toBe(1);
      if (interrupt === 'seal')
        expect(battle.log()).toContainEqual({
          type: EventType.ActionFailed,
          unitId: 'source',
          reason: 'sealed',
        });
    }
  });

  it('skips unavailable cooldown/condition skills and restores the parent context after child hooks', () => {
    const locked = attack('locked', { initialCooldownRounds: 10 });
    const conditional = attack('conditional', { requirement: 0 });
    const battle = createBattle(input([locked, conditional, attack('one')]));
    const actions: string[] = [];
    battle.hooks.on(HookName.AfterAction, ({ source, skillId }) => {
      if (source?.id === 'source' && skillId) actions.push(skillId);
    });
    invoke(battle);
    expect(casts(battle)).toEqual(['invocation', 'one']);
    expect(actions).toEqual(['one', 'invocation']);
    expect(battle.unit('source').skillUses).toEqual({ one: 1, invocation: 1 });
  });

  it('retargets after a kill and keeps each child skill kill history independent', () => {
    const battle = createBattle(input([attack('one'), attack('two')]));
    battle.unit('target').attrs.hp = 50;
    const kills: Array<{ id: string; target?: string }> = [];
    battle.hooks.on(HookName.OnDeath, ({ source, target, skillId }) => {
      if (source?.id === 'source' && skillId)
        kills.push({ id: skillId, target: target?.id });
    });
    invoke(battle);
    const hitTargets = battle
      .log()
      .flatMap((event) =>
        event.type === EventType.Hit && event.sourceId === 'source'
          ? [event.targetId]
          : [],
      );
    expect(hitTargets).toEqual(['target', 'other']);
    expect(kills).toEqual([{ id: casts(battle)[1]!, target: 'target' }]);
    expect(battle.log()).toContainEqual({
      type: EventType.Retarget,
      unitId: 'source',
      from: 'target',
      to: 'other',
    });
  });

  it('preserves whole-spell repeat and critical hooks without extra costs or first-spell consumption', () => {
    const repeat = attack('repeat', {
      tags: [SkillTag.Passive],
      effects: [],
      innate: { spellRepeat: { chance: 1, factor: 0.5 } },
    });
    const battle = createBattle(
      input([
        attack('one', { costMp: 3 }),
        attack('two', { costMp: 5 }),
        repeat,
      ]),
    );
    const counts: number[] = [];
    battle.hooks.on(HookName.OnCritRoll, ({ source }) => {
      if (source?.id === 'source')
        counts.push(source.spellActionsSinceEntry ?? -1);
    });
    battle.unit('source').attrs.spellCritRate = 1;
    invoke(battle);
    expect(counts).toEqual([0, 0, 1, 1]);
    expect(battle.unit('source').attrs.mp).toBe(92);
    expect(battle.unit('source').spellActionsSinceEntry).toBe(2);
    expect(
      battle
        .log()
        .filter(
          (event) =>
            event.type === EventType.Hit &&
            event.sourceId === 'source' &&
            event.crit,
        ),
    ).toHaveLength(4);
  });

  it('classifies damage nested in repeat/branches while excluding recursive invocations', () => {
    expect(
      isActiveAttackSkill(
        attack('repeat', {
          effects: [
            {
              type: EffectType.Repeat,
              min: 1,
              max: 3,
              effects: [{ type: EffectType.FixedHit, power: 10 }],
            },
          ],
        }),
      ),
    ).toBe(true);
    expect(
      isActiveAttackSkill(
        attack('recursive', {
          effects: [
            {
              type: EffectType.RandomBranch,
              branchId: 'r',
              chance: 0.5,
              successEffects: [{ type: EffectType.PhysicalHit }],
              failureEffects: [{ type: EffectType.InvokeAttackSkills }],
            },
          ],
        }),
      ),
    ).toBe(false);
    expect(
      isActiveAttackSkill(
        attack('healing-hit', {
          effects: [{ type: EffectType.PhysicalHit, healInstead: true }],
        }),
      ),
    ).toBe(false);
  });

  it('records actual entry rounds and resets first-spell tracking whenever a pet returns to battle', () => {
    const config = input([attack('one')]);
    config.units[0]!.kind = 'player';
    config.units.push({
      id: 'pet',
      name: 'pet',
      side: 0,
      kind: 'pet',
      ownerId: 'source',
      benched: true,
      skills: ['one'],
      attrs: {
        hp: 1000,
        magicAtk: 100,
        speed: 20,
        physicalAtk: 0,
        physicalDef: 0,
      },
    });
    const battle = createBattle(config);
    expect(battle.unit('source').entryRound).toBe(1);
    expect(battle.unit('pet').entryRound).toBeUndefined();
    battle.lockAndResolve();
    battle.submit('source', { type: CommandType.Summon, petId: 'pet' });
    battle.lockAndResolve();
    expect(battle.unit('pet').entryRound).toBe(2);
    battle.submit('pet', {
      type: CommandType.Skill,
      skillId: 'one',
      targets: ['target'],
    });
    battle.lockAndResolve();
    expect(battle.unit('pet').spellActionsSinceEntry).toBe(1);
    battle.submit('source', { type: CommandType.Recall });
    battle.lockAndResolve();
    battle.submit('source', { type: CommandType.Summon, petId: 'pet' });
    battle.lockAndResolve();
    expect(battle.unit('pet').entryRound).toBe(5);
    expect(battle.unit('pet').spellActionsSinceEntry).toBe(0);
    const restored = restoreBattle(config, battle.snapshot(), [
      ...battle.log(),
    ]);
    expect(restored.unit('pet').entryRound).toBe(5);
    expect(restored.unit('pet').spellActionsSinceEntry).toBe(0);
  });
});
