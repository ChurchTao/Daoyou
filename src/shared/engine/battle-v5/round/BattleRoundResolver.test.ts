import { GameplayTags } from '@shared/engine/shared/tag-domain';
import { describe, expect, it } from 'vitest';
import { BattleRoster } from '../core/BattleRoster';
import type { AbilityConfig, BuffConfig } from '../core/configs';
import {
  AbilityType,
  AttributeType,
  BuffType,
  DamageType,
} from '../core/types';
import { StackRule } from '../buffs/Buff';
import { EventPriorityLevel } from '../core/events';
import { AbilityFactory } from '../factories/AbilityFactory';
import { BuffFactory } from '../factories/BuffFactory';
import {
  captureBattleCheckpoint,
  createBattleBlueprint,
  restoreBattleSave,
} from '../persistence/BattleStateCodec';
import type { BattleSaveV1 } from '../persistence/types';
import { BattleRuntime } from '../runtime/BattleRuntime';
import { Unit } from '../units/Unit';
import {
  resolveBattleRound,
  sealRoundCommandSet,
} from './BattleRoundResolver';
import type { RoundCommandSetV1 } from './types';
import { createBattlePlanningView } from './BattlePlanningView';
import {
  queueSkippedActions,
  setQueuedAction,
} from '../core/runtimeState';

const aoeAbility: AbilityConfig = {
  slug: 'team-flame',
  name: '焚阵',
  type: AbilityType.ACTIVE_SKILL,
  tags: [
    GameplayTags.ABILITY.KIND.SKILL,
    GameplayTags.ABILITY.FUNCTION.DAMAGE,
    GameplayTags.ABILITY.CHANNEL.TRUE,
  ],
  mpCost: 10,
  hitPolicy: 'guaranteed',
  targetPolicy: { team: 'enemy', scope: 'aoe', maxTargets: 4 },
  effects: [
    {
      type: 'damage',
      params: {
        value: { base: 40, coefficient: 0 },
        damageType: DamageType.TRUE,
        canCrit: false,
      },
    },
  ],
};

function initialSave(configure?: (units: Unit[]) => void): BattleSaveV1 {
  const runtime = new BattleRuntime();
  const units = [
    new Unit(
      'a0',
      'a0',
      { [AttributeType.SPIRIT]: 20 },
      { runtime, teamId: 'alpha', slot: 0 },
    ),
    new Unit('a1', 'a1', {}, { runtime, teamId: 'alpha', slot: 1 }),
    new Unit('b0', 'b0', {}, { runtime, teamId: 'beta', slot: 0 }),
    new Unit('b1', 'b1', {}, { runtime, teamId: 'beta', slot: 1 }),
  ];
  units[0].abilities.addAbility(AbilityFactory.create(aoeAbility));
  configure?.(units);
  const roster = new BattleRoster(units);
  const blueprint = createBattleBlueprint('team-round', roster);
  return {
    version: 'battle_save_v1',
    blueprint,
    checkpoint: captureBattleCheckpoint({
      blueprint,
      roster,
      runtime,
      round: 0,
      checkpointRevision: 0,
    }),
  };
}

function commands(): RoundCommandSetV1 {
  return {
    version: 'round_command_set_v1',
    commandSetId: 'round-1-sealed',
    round: 1,
    checkpointRevision: 0,
    intents: {
      a0: {
        kind: 'ability',
        abilityId: 'team-flame',
        submittedBy: 'player',
      },
      a1: { kind: 'basic_attack', targetUnitId: 'b0', submittedBy: 'timeout' },
      b0: { kind: 'basic_attack', targetUnitId: 'a0', submittedBy: 'player' },
      b1: { kind: 'basic_attack', targetUnitId: 'a0', submittedBy: 'timeout' },
    },
  };
}

describe('BattleRoundResolver', () => {
  it('settles round recovery before periodic damage at round post', () => {
    const save = initialSave((units) => {
      const unit = units[0];
      unit.setHp(unit.getMaxHp() - 10, 'set');
      unit.abilities.addAbility(
        AbilityFactory.create({
          slug: 'round-recovery',
          name: '回合恢复',
          type: AbilityType.PASSIVE_SKILL,
          tags: [
            GameplayTags.ABILITY.FUNCTION.BUFF,
            GameplayTags.ABILITY.FUNCTION.DAMAGE,
            GameplayTags.ABILITY.FUNCTION.HEAL,
            GameplayTags.ABILITY.CHANNEL.TRUE,
          ],
          listeners: [
            {
              eventType: GameplayTags.EVENT.ROUND_POST,
              scope: 'global',
              priority: EventPriorityLevel.ROUND_POST_RECOVERY,
              effects: [
                {
                  type: 'heal',
                  params: { value: { base: 20, coefficient: 0 } },
                },
              ],
            },
            {
              eventType: GameplayTags.EVENT.ROUND_POST,
              scope: 'global',
              priority: EventPriorityLevel.ROUND_POST_DRAIN,
              effects: [
                {
                  type: 'damage',
                  params: {
                    value: { base: 15, coefficient: 0 },
                    damageType: DamageType.TRUE,
                    canCrit: false,
                  },
                },
              ],
            },
          ],
        }),
      );
    });
    const result = resolveBattleRound(save, {
      version: 'round_command_set_v1',
      commandSetId: 'round-post-order',
      round: 1,
      checkpointRevision: 0,
      intents: {
        a0: { kind: 'skip', submittedBy: 'timeout' },
        a1: { kind: 'skip', submittedBy: 'timeout' },
        b0: { kind: 'skip', submittedBy: 'timeout' },
        b1: { kind: 'skip', submittedBy: 'timeout' },
      },
    });

    const restoredA0 = restoreBattleSave(result.save).roster.getUnit('a0');
    expect(restoredA0.getCurrentHp()).toBeLessThan(restoredA0.getMaxHp());
    expect(restoredA0.getCurrentHp()).toBeGreaterThan(restoredA0.getMaxHp() - 30);
    expect(result.stateTimeline.frames.some((frame) => frame.phase === 'round_post')).toBe(true);
  });

  it('ticks round-duration DOT buffs after the round post event', () => {
    const save = initialSave((units) => {
      const dot: BuffConfig = {
        id: 'round-dot-test',
        name: '回合毒伤',
        type: BuffType.DEBUFF,
        duration: 2,
        durationUnit: 'round',
        stackRule: StackRule.REFRESH_DURATION,
        listeners: [
          {
            eventType: GameplayTags.EVENT.ROUND_POST,
            scope: 'global',
            priority: EventPriorityLevel.ROUND_POST_DRAIN,
            effects: [
              {
                type: 'damage',
                params: {
                  value: { base: 5, coefficient: 0 },
                  damageType: DamageType.TRUE,
                  canCrit: false,
                },
              },
            ],
          },
        ],
      };
      units[0].buffs.addBuff(BuffFactory.create(dot), units[0]);
    });

    const result = resolveBattleRound(save, {
      version: 'round_command_set_v1',
      commandSetId: 'round-duration-dot',
      round: 1,
      checkpointRevision: 0,
      intents: {
        a0: { kind: 'skip', submittedBy: 'timeout' },
        a1: { kind: 'skip', submittedBy: 'timeout' },
        b0: { kind: 'skip', submittedBy: 'timeout' },
        b1: { kind: 'skip', submittedBy: 'timeout' },
      },
    });

    const restoredA0 = restoreBattleSave(result.save).roster.getUnit('a0');
    expect(restoredA0.getCurrentHp()).toBeLessThan(restoredA0.getMaxHp());
    expect(
      restoredA0.buffs
        .getAllBuffs()
        .find((buff) => buff.id === 'round-dot-test')
        ?.getDuration(),
    ).toBe(1);
  });

  it('resolves one sealed 2v2 round atomically and charges AOE once', () => {
    const save = initialSave();
    const commandSet = sealRoundCommandSet(save, commands());
    const result = resolveBattleRound(save, commandSet);
    const restored = restoreBattleSave(result.save);
    const a0 = restored.roster.getUnit('a0');

    expect(result.round).toBe(1);
    expect(result.checkpoint.checkpointRevision).toBe(1);
    expect(restored.roster.getUnit('b0').getHpPercent()).toBeLessThan(1);
    expect(restored.roster.getUnit('b1').getHpPercent()).toBeLessThan(1);
    expect(a0.getMaxMp() - a0.getCurrentMp()).toBe(10);
  });

  it('is deterministic for the same checkpoint and sealed command set', () => {
    const save = initialSave();
    const commandSet = commands();
    const left = resolveBattleRound(save, commandSet);
    const right = resolveBattleRound(save, commandSet);

    expect(left.checkpoint).toEqual(right.checkpoint);
    expect(left.sequences).toEqual(right.sequences);
    expect(left.stateTimeline).toEqual(right.stateTimeline);
  });

  it('rejects incomplete command sets without mutating the input save', () => {
    const save = initialSave();
    const before = JSON.stringify(save);
    const incomplete = commands();
    delete incomplete.intents.b1;

    expect(() => resolveBattleRound(save, incomplete)).toThrow(
      'every living unit exactly once',
    );
    expect(JSON.stringify(save)).toBe(before);
  });

  it('accepts a complete 4v4 simultaneous planning set', () => {
    const runtime = new BattleRuntime();
    const units = Array.from({ length: 8 }, (_, index) => {
      const teamIndex = index < 4 ? index : index - 4;
      const teamId = index < 4 ? 'alpha' : 'beta';
      return new Unit(`${teamId}-${teamIndex}`, `${teamId}-${teamIndex}`, {}, {
        runtime,
        teamId,
        slot: teamIndex as 0 | 1 | 2 | 3,
      });
    });
    const roster = new BattleRoster(units);
    const blueprint = createBattleBlueprint('four-v-four', roster);
    const save: BattleSaveV1 = {
      version: 'battle_save_v1',
      blueprint,
      checkpoint: captureBattleCheckpoint({
        blueprint,
        roster,
        runtime,
        round: 0,
        checkpointRevision: 0,
      }),
    };
    const intents = Object.fromEntries(units.map((unit) => [
      unit.id,
      {
        kind: 'basic_attack' as const,
        targetUnitId: unit.teamId === 'alpha' ? 'beta-0' : 'alpha-0',
        submittedBy: 'timeout' as const,
      },
    ]));
    const commandSet: RoundCommandSetV1 = {
      version: 'round_command_set_v1',
      commandSetId: '4v4-round-1',
      round: 1,
      checkpointRevision: 0,
      intents,
    };

    const teamView = createBattlePlanningView({
      roster,
      round: 1,
      checkpointRevision: 0,
      unitIds: ['alpha-0', 'alpha-1', 'alpha-2', 'alpha-3'],
    });
    const result = resolveBattleRound(save, sealRoundCommandSet(save, commandSet));

    expect(teamView.units).toHaveLength(4);
    expect(result.checkpoint.units).toHaveProperty('beta-3');
  });

  it('reports resource shortage separately from other trigger conditions', () => {
    const restored = restoreBattleSave(initialSave());
    try {
      restored.roster.getUnit('a0').setMp(0);
      const view = createBattlePlanningView({
        roster: restored.roster,
        round: 1,
        checkpointRevision: 0,
        unitIds: ['a0'],
      });

      expect(view.units[0].abilities[0]).toMatchObject({
        abilityId: 'team-flame',
        ready: false,
        unavailableReason: 'resource',
      });
    } finally {
      restored.runtime.dispose();
    }
  });

  it('falls back to the engine basic attack when the configured attack is unavailable', () => {
    const runtime = new BattleRuntime();
    const actor = new Unit('fallback-actor', '攻击者', {}, {
      runtime,
      teamId: 'alpha',
      slot: 0,
    });
    const target = new Unit('fallback-target', '目标', {}, {
      runtime,
      teamId: 'beta',
      slot: 0,
    });
    actor.abilities.setDefaultAttack(AbilityFactory.create({
      slug: 'unavailable-basic',
      name: '耗尽的招式',
      type: AbilityType.ACTIVE_SKILL,
      mpCost: 999,
      tags: [
        GameplayTags.ABILITY.KIND.SKILL,
        GameplayTags.ABILITY.FUNCTION.DAMAGE,
        GameplayTags.ABILITY.CHANNEL.TRUE,
      ],
      targetPolicy: { team: 'enemy', scope: 'single' },
      effects: [],
    }));
    const roster = BattleRoster.fromDuel(actor, target);
    const blueprint = createBattleBlueprint('fallback-round', roster);
    const save: BattleSaveV1 = {
      version: 'battle_save_v1',
      blueprint,
      checkpoint: captureBattleCheckpoint({
        blueprint,
        roster,
        runtime,
        round: 0,
        checkpointRevision: 0,
      }),
    };
    const result = resolveBattleRound(save, {
      version: 'round_command_set_v1',
      commandSetId: 'fallback-round:1:0',
      round: 1,
      checkpointRevision: 0,
      intents: {
        'fallback-actor': {
          kind: 'basic_attack',
          targetUnitId: 'fallback-target',
          submittedBy: 'timeout',
        },
        'fallback-target': {
          kind: 'basic_attack',
          targetUnitId: 'fallback-actor',
          submittedBy: 'timeout',
        },
      },
    });

    expect(result.checkpoint.units['fallback-target'].hp).toBeLessThan(
      target.getMaxHp(),
    );
  });

  it('forces a queued action to use the selected basic-attack target next round', () => {
    const runtime = new BattleRuntime();
    const actor = new Unit(
      'queued-actor',
      '蓄势者',
      { [AttributeType.STRENGTH]: 30, [AttributeType.SPEED]: 30 },
      { runtime, teamId: 'alpha', slot: 0 },
    );
    const target = new Unit(
      'queued-target',
      '目标',
      { [AttributeType.VITALITY]: 30 },
      { runtime, teamId: 'beta', slot: 0 },
    );
    setQueuedAction(actor, {
      slug: 'thunder-release',
      name: '听雷',
      type: AbilityType.ACTIVE_SKILL,
      tags: [
        GameplayTags.ABILITY.KIND.SKILL,
        GameplayTags.ABILITY.FUNCTION.DAMAGE,
        GameplayTags.ABILITY.CHANNEL.TRUE,
      ],
      targetPolicy: { team: 'enemy', scope: 'single' },
      effects: [{
        type: 'damage',
        params: {
          value: { base: 60, coefficient: 0 },
          damageType: DamageType.TRUE,
          canCrit: false,
        },
      }],
    }, { interruptPolicy: 'uninterruptible', hitPolicy: 'guaranteed' });
    queueSkippedActions(actor, 1, 'test-rest', '调息');
    actor.tags.addTags([GameplayTags.STATUS.CONTROL.NO_ACTION]);
    const roster = BattleRoster.fromDuel(actor, target);
    const blueprint = createBattleBlueprint('queued-round', roster);
    const save: BattleSaveV1 = {
      version: 'battle_save_v1',
      blueprint,
      checkpoint: captureBattleCheckpoint({
        blueprint,
        roster,
        runtime,
        round: 1,
        checkpointRevision: 1,
      }),
    };
    const restored = restoreBattleSave(save);
    const planning = createBattlePlanningView({
      roster: restored.roster,
      round: 2,
      checkpointRevision: 1,
      unitIds: ['queued-actor'],
    });
    restored.runtime.dispose();

    expect(planning.units[0]).toMatchObject({
      abilities: [],
      forcedAction: {
        kind: 'queued_action_target',
        abilityId: 'thunder-release',
        legalTargetIds: ['queued-target'],
      },
    });

    const result = resolveBattleRound(save, {
      version: 'round_command_set_v1',
      commandSetId: 'queued-round:2:1',
      round: 2,
      checkpointRevision: 1,
      intents: {
        'queued-actor': {
          kind: 'basic_attack',
          targetUnitId: 'queued-target',
          submittedBy: 'player',
        },
        'queued-target': {
          kind: 'basic_attack',
          targetUnitId: 'queued-actor',
          submittedBy: 'player',
        },
      },
    });
    const after = restoreBattleSave(result.save);
    expect(after.roster.getUnit('queued-target').getCurrentHp()).toBeLessThan(
      after.roster.getUnit('queued-target').getMaxHp(),
    );
    expect(result.checkpoint.units['queued-actor'].runtimeState.queuedAction).toBeUndefined();
    expect(result.checkpoint.units['queued-actor'].runtimeState.skippedActions).toHaveLength(1);
    after.runtime.dispose();
  });

  it('records controlled-skip reactions inside the actor action sequence', () => {
    const runtime = new BattleRuntime();
    const actor = new Unit(
      'controlled-actor',
      '受控者',
      { [AttributeType.SPEED]: 10 },
      { runtime, teamId: 'alpha', slot: 0 },
    );
    const opponent = new Unit(
      'controller',
      '施控者',
      { [AttributeType.SPEED]: 20 },
      { runtime, teamId: 'beta', slot: 0 },
    );
    const erosion = BuffFactory.create({
      id: 'test.erosion',
      name: '蚀魂',
      type: 'debuff',
      duration: 3,
      stackRule: 'stack_layer',
      maxLayers: 5,
      tags: ['Buff.Test.Erosion'],
    });
    erosion.setLayer(5);
    actor.buffs.addBuff(erosion, opponent);
    actor.buffs.addBuff(BuffFactory.create({
      id: 'test.control-skip',
      name: '失魂',
      type: 'control',
      duration: 1,
      stackRule: 'ignore',
      tags: [GameplayTags.STATUS.CONTROL.NO_ACTION],
      statusTags: [GameplayTags.STATUS.CONTROL.NO_ACTION],
      listeners: [{
        id: 'test.control-skip-converge',
        eventType: 'ControlledSkipEvent',
        scope: 'owner_as_actor',
        mapping: { caster: 'owner', target: 'owner' },
        effects: [{
          type: 'buff_layer_modify',
          params: {
            match: { id: 'test.erosion' },
            operation: 'set',
            layers: 3,
          },
        }],
      }],
    }), opponent);
    queueSkippedActions(actor, 1, 'test-rest', '调息');
    const roster = BattleRoster.fromDuel(actor, opponent);
    const blueprint = createBattleBlueprint('controlled-skip-round', roster);
    const save: BattleSaveV1 = {
      version: 'battle_save_v1',
      blueprint,
      checkpoint: captureBattleCheckpoint({
        blueprint,
        roster,
        runtime,
        round: 0,
        checkpointRevision: 0,
      }),
    };

    const result = resolveBattleRound(save, {
      version: 'round_command_set_v1',
      commandSetId: 'controlled-skip-round:1:0',
      round: 1,
      checkpointRevision: 0,
      intents: {
        'controlled-actor': {
          kind: 'basic_attack',
          targetUnitId: 'controller',
          submittedBy: 'timeout',
        },
        controller: {
          kind: 'basic_attack',
          targetUnitId: 'controlled-actor',
          submittedBy: 'player',
        },
      },
    });
    const sequenceIds = new Set(result.sequences.map((sequence) => sequence.id));
    const layerFact = result.sequences
      .flatMap((sequence) => sequence.facts)
      .find((fact) => fact.type === 'status' && fact.statusId === 'test.erosion');

    expect(layerFact).toMatchObject({
      type: 'status',
      operation: 'layers',
      beforeLayers: 5,
      afterLayers: 3,
    });
    expect(layerFact?.trace.sequenceId).not.toBe('sequence_v3_unscoped');
    expect(sequenceIds.has(layerFact?.trace.sequenceId ?? '')).toBe(true);
    expect(
      result.sequences
        .flatMap((sequence) => sequence.facts)
        .some(
          (fact) =>
            fact.type === 'action_state' &&
            fact.stateType === 'rest' &&
            fact.phase === 'skipped',
        ),
    ).toBe(true);
    expect(
      result.sequences
        .flatMap((sequence) => sequence.facts)
        .some(
          (fact) =>
            fact.type === 'mechanic' &&
            fact.payload.kind === 'control_skip',
        ),
    ).toBe(true);
  });

  it('records queued-action cancellation inside the actor action sequence', () => {
    const runtime = new BattleRuntime();
    const actor = new Unit(
      'queued-cancel-actor',
      '蓄势者',
      { [AttributeType.SPEED]: 20 },
      { runtime, teamId: 'alpha', slot: 0 },
    );
    const target = new Unit(
      'queued-cancel-target',
      '目标',
      {},
      { runtime, teamId: 'beta', slot: 0 },
    );
    actor.tags.addTags([GameplayTags.STATUS.CONTROL.NO_SKILL]);
    setQueuedAction(actor, {
      slug: 'cancelled-release',
      name: '后发一击',
      type: AbilityType.ACTIVE_SKILL,
      tags: [
        GameplayTags.ABILITY.KIND.SKILL,
        GameplayTags.ABILITY.FUNCTION.DAMAGE,
        GameplayTags.ABILITY.CHANNEL.TRUE,
      ],
      targetPolicy: { team: 'enemy', scope: 'single' },
      effects: [],
    }, { interruptPolicy: 'normal', hitPolicy: 'guaranteed' });
    const roster = BattleRoster.fromDuel(actor, target);
    const blueprint = createBattleBlueprint('queued-cancel-round', roster);
    const save: BattleSaveV1 = {
      version: 'battle_save_v1',
      blueprint,
      checkpoint: captureBattleCheckpoint({
        blueprint,
        roster,
        runtime,
        round: 0,
        checkpointRevision: 0,
      }),
    };

    const result = resolveBattleRound(save, {
      version: 'round_command_set_v1',
      commandSetId: 'queued-cancel-round:1:0',
      round: 1,
      checkpointRevision: 0,
      intents: {
        'queued-cancel-actor': {
          kind: 'basic_attack',
          targetUnitId: 'queued-cancel-target',
          submittedBy: 'player',
        },
        'queued-cancel-target': {
          kind: 'basic_attack',
          targetUnitId: 'queued-cancel-actor',
          submittedBy: 'player',
        },
      },
    });
    const fact = result.sequences
      .flatMap((sequence) => sequence.facts)
      .find((entry) => entry.type === 'action_state');

    expect(fact).toMatchObject({
      type: 'action_state',
      stateType: 'queued_action',
      phase: 'cancelled',
    });
    expect(fact?.trace.sequenceId).not.toBe('sequence_v3_unscoped');
    expect(result.sequences.some((sequence) => sequence.id === fact?.trace.sequenceId)).toBe(true);
    const after = restoreBattleSave(result.save);
    expect(after.roster.getUnit('queued-cancel-target').getHpPercent()).toBeLessThan(1);
    after.runtime.dispose();
  });
});
