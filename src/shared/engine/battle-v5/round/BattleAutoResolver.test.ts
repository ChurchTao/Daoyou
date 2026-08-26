import { GameplayTags } from '@shared/engine/shared/tag-domain';
import { describe, expect, it } from 'vitest';
import { BattleRoster } from '../core/BattleRoster';
import { SeededBattleRandomSource } from '../core/BattleRandom';
import { setQueuedAction } from '../core/runtimeState';
import { AbilityType, AttributeType, DamageType } from '../core/types';
import { AbilityFactory } from '../factories/AbilityFactory';
import { restoreBattleSave } from '../persistence/BattleStateCodec';
import { BattleRuntime } from '../runtime/BattleRuntime';
import { Unit } from '../units/Unit';
import { resolveBattleToCompletion } from './BattleAutoResolver';
import { initializeBattle } from './BattleLifecycleResolver';

function createDuel(seed = 'auto-duel') {
  const runtime = new BattleRuntime({
    random: new SeededBattleRandomSource(seed),
  });
  const attacker = new Unit(
    'attacker',
    '攻击者',
    {
      [AttributeType.VITALITY]: 20,
      [AttributeType.STRENGTH]: 40,
      [AttributeType.SPEED]: 30,
    },
    { runtime, teamId: 'alpha', slot: 0 },
  );
  const defender = new Unit(
    'defender',
    '防守者',
    { [AttributeType.VITALITY]: 20 },
    { runtime, teamId: 'beta', slot: 0 },
  );
  attacker.abilities.addAbility(AbilityFactory.create({
    slug: 'auto-strike',
    name: '自动斩击',
    type: AbilityType.ACTIVE_SKILL,
    priority: 100,
    cooldown: 1,
    targetPolicy: { team: 'enemy', scope: 'single' },
    tags: [
      GameplayTags.ABILITY.KIND.SKILL,
      GameplayTags.ABILITY.FUNCTION.DAMAGE,
      GameplayTags.ABILITY.CHANNEL.TRUE,
    ],
    effects: [{
      type: 'damage',
      params: {
        value: { base: 180, coefficient: 0 },
        damageType: DamageType.TRUE,
        canCrit: false,
      },
    }],
  }));
  return { runtime, attacker, defender };
}

describe('BattleAutoResolver', () => {
  it('applies battle-init listeners before the first checkpoint', () => {
    const { runtime, attacker, defender } = createDuel('battle-init');
    attacker.abilities.addAbility(AbilityFactory.create({
      slug: 'opening-shield',
      name: '开场护体',
      type: AbilityType.PASSIVE_SKILL,
      tags: [
        GameplayTags.ABILITY.KIND.SKILL,
        GameplayTags.ABILITY.FUNCTION.BUFF,
      ],
      listeners: [{
        id: 'opening-shield-listener',
        eventType: 'BattleInitEvent',
        scope: GameplayTags.SCOPE.GLOBAL,
        priority: 0,
        mapping: { caster: 'owner', target: 'owner' },
        triggerPolicy: { maxTriggers: 1, granularity: 'battle' },
        effects: [{
          type: 'shield',
          params: { value: { base: 25 }, target: 'caster' },
        }],
      }],
    }));

    const initialized = initializeBattle({
      battleId: 'battle-init',
      roster: BattleRoster.fromDuel(attacker, defender),
      runtime,
    });
    const restored = restoreBattleSave(initialized.save);

    expect(initialized.sequences[0].phase).toBe('battle_init');
    expect(
      initialized.sequences[0].facts.some((fact) => fact.type === 'shield'),
    ).toBe(true);
    expect(restored.roster.getUnit(attacker.id).getCurrentShield()).toBe(25);
    expect(
      initialized.stateTimeline.frames[0].units[attacker.id].shield,
    ).toBe(25);
    restored.runtime.dispose();
  });

  it('uses the Team/Roster round resolver until a duel ends', () => {
    const { runtime, attacker, defender } = createDuel();
    attacker.abilities.addAbility(AbilityFactory.create({
      slug: 'ending-shield',
      name: '收势护体',
      type: AbilityType.PASSIVE_SKILL,
      tags: [
        GameplayTags.ABILITY.KIND.SKILL,
        GameplayTags.ABILITY.FUNCTION.BUFF,
      ],
      listeners: [{
        id: 'ending-shield-listener',
        eventType: 'BattleEndEvent',
        scope: GameplayTags.SCOPE.GLOBAL,
        priority: 0,
        mapping: { caster: 'owner', target: 'owner' },
        triggerPolicy: { maxTriggers: 1, granularity: 'battle' },
        effects: [{
          type: 'shield',
          params: { value: { base: 7 }, target: 'caster' },
        }],
      }],
    }));
    const result = resolveBattleToCompletion({
      battleId: 'auto-duel',
      roster: BattleRoster.fromDuel(attacker, defender),
      runtime,
    });

    expect(result.outcome.winnerTeamId).toBe('alpha');
    expect(result.rounds).toBeGreaterThan(0);
    expect(result.sequences[0].phase).toBe('battle_init');
    expect(result.sequences.at(-1)?.phase).toBe('battle_end');
    expect(result.stateTimeline.frames[0].phase).toBe('battle_init');
    expect(result.stateTimeline.frames.at(-1)?.phase).toBe('battle_end');
    expect(result.finalSave.lifecycle?.ended).toBe(true);
    expect(result.finalSave.checkpoint.units[attacker.id].shield).toBe(7);
    expect(
      result.sequences.at(-1)?.facts.some((fact) => fact.type === 'shield'),
    ).toBe(true);
    expect(
      result.sequences.some((sequence) =>
        sequence.facts.some(
          (fact) =>
            fact.type === 'damage' &&
            fact.origin.kind === 'owned' &&
            fact.origin.carrier.id === 'auto-strike',
        ),
      ),
    ).toBe(true);
  });

  it('is deterministic for the same initial roster and seed', () => {
    const left = createDuel('same-seed');
    const right = createDuel('same-seed');
    const resolve = (duel: ReturnType<typeof createDuel>) =>
      resolveBattleToCompletion({
        battleId: 'deterministic-auto-duel',
        roster: BattleRoster.fromDuel(duel.attacker, duel.defender),
        runtime: duel.runtime,
      });

    expect(resolve(left)).toEqual(resolve(right));
  });

  it('uses the deterministic decider for an equal round-limit result', () => {
    const runtime = new BattleRuntime({
      random: new SeededBattleRandomSource('draw'),
    });
    const player = new Unit('draw-player', '甲', {}, {
      runtime,
      teamId: 'alpha',
      slot: 0,
    });
    const opponent = new Unit('draw-opponent', '乙', {}, {
      runtime,
      teamId: 'beta',
      slot: 0,
    });
    const idleAttack = (slug: string) => AbilityFactory.create({
      slug,
      name: '试探',
      type: AbilityType.ACTIVE_SKILL,
      tags: [GameplayTags.ABILITY.KIND.SKILL],
      targetPolicy: { team: 'enemy', scope: 'single' },
      effects: [],
    });
    player.abilities.setDefaultAttack(idleAttack('player-idle'));
    opponent.abilities.setDefaultAttack(idleAttack('opponent-idle'));

    const result = resolveBattleToCompletion({
      battleId: 'draw-duel',
      roster: BattleRoster.fromDuel(player, opponent),
      runtime,
    });
    expect(result.outcome).toMatchObject({
      battleEnded: true,
      reachedMaxRounds: true,
    });
    expect(result.outcome.winnerTeamId).toMatch(/^(alpha|beta)$/);
    expect(result.outcome.loserTeamId).not.toBe(result.outcome.winnerTeamId);
    expect(result.sequences.at(-1)).toMatchObject({
      phase: 'battle_end',
    });
    expect(result.sequences.at(-1)?.actor).toBeDefined();
  });

  it('forces a queued release through a basic-attack target intent', () => {
    const { runtime, attacker, defender } = createDuel('queued-auto');
    setQueuedAction(attacker, {
      slug: 'queued-release',
      name: '后发一击',
      type: AbilityType.ACTIVE_SKILL,
      targetPolicy: { team: 'enemy', scope: 'single' },
      tags: [
        GameplayTags.ABILITY.KIND.SKILL,
        GameplayTags.ABILITY.FUNCTION.DAMAGE,
        GameplayTags.ABILITY.CHANNEL.TRUE,
      ],
      effects: [{
        type: 'damage',
        params: {
          value: { base: 500, coefficient: 0 },
          damageType: DamageType.TRUE,
          canCrit: false,
        },
      }],
    }, { interruptPolicy: 'uninterruptible', hitPolicy: 'guaranteed' });
    const result = resolveBattleToCompletion({
      battleId: 'queued-auto-duel',
      roster: BattleRoster.fromDuel(attacker, defender),
      runtime,
    });
    const final = restoreBattleSave(result.finalSave);

    expect(
      result.sequences.some((sequence) =>
        sequence.facts.some(
          (fact) =>
            fact.type === 'damage' &&
            fact.origin.kind === 'owned' &&
            fact.origin.carrier.id === 'queued-release',
        ),
      ),
    ).toBe(true);
    expect(final.roster.getUnit(attacker.id).isAlive()).toBe(true);
    final.runtime.dispose();
  });
});
