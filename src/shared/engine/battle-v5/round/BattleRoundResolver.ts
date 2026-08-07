import { GameplayTags } from '@shared/engine/shared/tag-domain';
import { ActiveSkill } from '../abilities/ActiveSkill';
import type { TargetPolicy } from '../abilities/TargetPolicy';
import {
  ActionPostEvent,
  ActionPreEvent,
  ControlledSkipEvent,
  RoundPostEvent,
  RoundPreEvent,
  RoundStartEvent,
  SkillPreCastEvent,
  TurnOrderEvent,
  VictoryCheckEvent,
} from '../core/events';
import {
  beginRuntimeAction,
  clearPendingActionStates,
  consumeSkippedAction,
  setRuntimeRound,
  shouldTickBuffDuration,
} from '../core/runtimeState';
import {
  captureBattleCheckpoint,
  restoreBattleSave,
} from '../persistence/BattleStateCodec';
import type { BattleSaveV1 } from '../persistence/types';
import { ActionExecutionSystem } from '../systems/ActionExecutionSystem';
import { DamageSystem } from '../systems/DamageSystem';
import { InitiativeSystem } from '../systems/InitiativeSystem';
import { BattleStateRecorder } from '../systems/state/BattleStateRecorder';
import { TargetSelectionSystem } from '../systems/TargetSelectionSystem';
import { TeamVictorySystem } from '../systems/TeamVictorySystem';
import { CombatRecordBuilderV3 } from '../v3/CombatRecordBuilderV3';
import { toBattleStateTimelineV3 } from '../v3/BattleRecordV3';
import { createBattlePlanningView } from './BattlePlanningView';
import type {
  BattleActionIntentV1,
  BattleRoundResolutionV1,
  RoundCommandSetV1,
} from './types';
import type { Unit } from '../units/Unit';

export function sealRoundCommandSet(
  save: BattleSaveV1,
  commandSet: RoundCommandSetV1,
): Readonly<RoundCommandSetV1> {
  const restored = restoreBattleSave(save);
  try {
    const livingUnits = restored.roster.getLivingUnits();
    validateRoundCommandSet(save, livingUnits, commandSet);
    validateAllIntents(
      restored.roster.getAllUnits(),
      livingUnits,
      commandSet,
    );
    return deepFreeze(
      JSON.parse(JSON.stringify(commandSet)) as RoundCommandSetV1,
    );
  } finally {
    restored.runtime.dispose();
  }
}

export function resolveBattleRound(
  save: BattleSaveV1,
  commandSet: RoundCommandSetV1,
): BattleRoundResolutionV1 {
  const restored = restoreBattleSave(save);
  try {
    return resolveRestoredBattleRound(save, commandSet, restored);
  } finally {
    restored.runtime.dispose();
  }
}

function resolveRestoredBattleRound(
  save: BattleSaveV1,
  commandSet: RoundCommandSetV1,
  restored: ReturnType<typeof restoreBattleSave>,
): BattleRoundResolutionV1 {
  const { runtime, roster } = restored;
  const livingAtPlanning = roster.getLivingUnits();
  validateRoundCommandSet(save, livingAtPlanning, commandSet);
  validateAllIntents(roster.getAllUnits(), livingAtPlanning, commandSet);

  const eventBus = runtime.events;
  const recordBuilder = new CombatRecordBuilderV3(eventBus);
  const actionSystem = new ActionExecutionSystem(eventBus);
  const damageSystem = new DamageSystem(eventBus, runtime.random);
  const stateRecorder = new BattleStateRecorder();
  const targetSystem = new TargetSelectionSystem();
  const allUnits = roster.getAllUnits();
  const round = commandSet.round;
  for (const unit of allUnits) setRuntimeRound(unit, round);

  recordBuilder.runInSequence({ phase: 'round_start', turn: round }, () => {
    eventBus.publish<RoundStartEvent>({
      type: 'RoundStartEvent',
      timestamp: runtime.clock.now(),
      turn: round,
    });
    eventBus.publish<RoundPreEvent>({
      type: 'RoundPreEvent',
      timestamp: runtime.clock.now(),
      turn: round,
    });
  });

  const order = InitiativeSystem.order(roster.getLivingUnits(), runtime.random);
  eventBus.publish<TurnOrderEvent>({
    type: 'TurnOrderEvent',
    timestamp: runtime.clock.now(),
    turn: round,
    units: order,
  });

  for (const actor of order) {
    if (!actor.isAlive()) {
      clearPendingActionStates(actor);
      continue;
    }
    beginRuntimeAction(actor);
    recordBuilder.runInSequence(
      {
        phase: 'action_pre',
        turn: round,
        actor: { id: actor.id, name: actor.name },
      },
      (sequence) => {
        eventBus.publish<ActionPreEvent>({
          type: 'ActionPreEvent',
          timestamp: runtime.clock.now(),
          caster: actor,
        });
        stateRecorder.record(
          'action_pre',
          round,
          allUnits,
          actor.id,
          sequence.id,
        );
      },
    );

    let controlledSkip = false;
    if (actor.isAlive()) {
      actor.combatResources.beginAction();
      const skipState = consumeSkippedAction(actor);
      const controlTag = getSkipControlTag(actor);
      controlledSkip = Boolean(controlTag);
      if (skipState || controlTag) {
        if (controlTag) {
          eventBus.publish<ControlledSkipEvent>({
            type: 'ControlledSkipEvent',
            timestamp: runtime.clock.now(),
            unit: actor,
            controlTag,
          });
        }
      } else {
        executeIntent(
          actor,
          commandSet.intents[actor.id],
          allUnits,
          targetSystem,
          recordBuilder,
          round,
        );
      }
    }

    recordBuilder.runInSequence(
      {
        phase: 'action_after',
        turn: round,
        actor: { id: actor.id, name: actor.name },
      },
      (sequence) => {
        if (actor.isAlive()) {
          eventBus.publish<ActionPostEvent>({
            type: 'ActionPostEvent',
            timestamp: runtime.clock.now(),
            caster: actor,
          });
          actor.combatResources.finishAction(
            controlledSkip,
            actor.getCurrentShield() > 0,
          );
          processBuffDurations(actor);
          actor.abilities.tickAbilitiesCooldown();
        }
        stateRecorder.record(
          'action_post',
          round,
          allUnits,
          actor.id,
          sequence.id,
        );
      },
    );
  }

  recordBuilder.runInSequence({ phase: 'round_post', turn: round }, () => {
    eventBus.publish<RoundPostEvent>({
      type: 'RoundPostEvent',
      timestamp: runtime.clock.now(),
      turn: round,
    });
  });
  const outcome = TeamVictorySystem.check(roster, round);
  eventBus.publish<VictoryCheckEvent>({
    type: 'VictoryCheckEvent',
    timestamp: runtime.clock.now(),
    turn: round,
    battleEnded: outcome.battleEnded,
    winner: outcome.winnerTeamId ?? null,
  });

  const sequences = recordBuilder.getSequences();
  const stateTimeline = toBattleStateTimelineV3(
    stateRecorder.getTimeline(allUnits),
  );
  actionSystem.destroy();
  damageSystem.destroy();
  recordBuilder.destroy();

  const checkpoint = captureBattleCheckpoint({
    blueprint: save.blueprint,
    roster,
    runtime,
    round,
    checkpointRevision: commandSet.checkpointRevision + 1,
  });
  const nextSave: BattleSaveV1 = {
    version: 'battle_save_v1',
    blueprint: save.blueprint,
    checkpoint,
  };
  const nextPlanningView = outcome.battleEnded
    ? undefined
    : createBattlePlanningView({
        roster,
        round: round + 1,
        checkpointRevision: checkpoint.checkpointRevision,
      });
  return {
    version: 'battle_round_resolution_v1',
    commandSetId: commandSet.commandSetId,
    round,
    outcome,
    sequences,
    stateTimeline,
    checkpoint,
    save: nextSave,
    nextPlanningView,
  };
}

function executeIntent(
  actor: Unit,
  intent: BattleActionIntentV1,
  allUnits: Unit[],
  targetSystem: TargetSelectionSystem,
  recordBuilder: CombatRecordBuilderV3,
  round: number,
): void {
  if (intent.kind === 'pass') return;
  const ability = actor.abilities.getAbility(intent.abilityId);
  if (!(ability instanceof ActiveSkill)) {
    throw new Error(`Unit ${actor.id} cannot use ability ${intent.abilityId}`);
  }
  if (actor.tags.hasTag(GameplayTags.STATUS.CONTROL.NO_SKILL)) return;
  const targets = resolveTargets(
    actor,
    ability.targetPolicy,
    intent.targetUnitId,
    allUnits,
    targetSystem,
    true,
  );
  const primary = targets[0];
  if (!primary || !ability.canTrigger({ caster: actor, target: primary })) {
    return;
  }
  ability.prepareCast({ caster: actor, target: primary });
  recordBuilder.runInSequence(
    {
      phase: 'action',
      turn: round,
      actor: { id: actor.id, name: actor.name },
      ability: { id: ability.id, name: ability.name },
    },
    () => {
      actor.runtime.events.publish<SkillPreCastEvent>({
        type: 'SkillPreCastEvent',
        timestamp: actor.runtime.clock.now(),
        caster: actor,
        target: primary,
        targets,
        ability,
        isInterrupted: false,
        hitPolicy: ability.hitPolicy,
      });
    },
  );
}

function resolveTargets(
  actor: Unit,
  policy: TargetPolicy,
  targetUnitId: string | undefined,
  allUnits: Unit[],
  targetSystem: TargetSelectionSystem,
  retargetMissing = false,
): Unit[] {
  const candidates = targetSystem.getTargetCandidates(actor, policy, allUnits);
  if (policy.scope === 'single') {
    if (targetUnitId) {
      const target = candidates.find((candidate) => candidate.id === targetUnitId);
      if (!target) {
        if (retargetMissing) return candidates.slice(0, 1);
        throw new Error(`Illegal target ${targetUnitId} for unit ${actor.id}`);
      }
      return [target];
    }
    if (policy.team !== 'self') {
      throw new Error(`Ability target is required for unit ${actor.id}`);
    }
  }
  return targetSystem.selectTargets(actor, policy, allUnits);
}

function validateAllIntents(
  allUnits: Unit[],
  livingUnits: Unit[],
  commandSet: RoundCommandSetV1,
): void {
  const targetSystem = new TargetSelectionSystem();
  for (const actor of livingUnits) {
    const intent = commandSet.intents[actor.id];
    if (intent.kind === 'pass') continue;
    const ability = actor.abilities.getAbility(intent.abilityId);
    if (!(ability instanceof ActiveSkill)) {
      throw new Error(`Unit ${actor.id} cannot use ability ${intent.abilityId}`);
    }
    const candidates = targetSystem.getTargetCandidates(
      actor,
      ability.targetPolicy,
      allUnits,
    );
    const target = intent.targetUnitId
      ? candidates.find((candidate) => candidate.id === intent.targetUnitId)
      : candidates[0];
    if (
      ability.targetPolicy.scope === 'single' &&
      ability.targetPolicy.team !== 'self' &&
      !intent.targetUnitId
    ) {
      throw new Error(`Ability target is required for unit ${actor.id}`);
    }
    if (
      !target ||
      (intent.targetUnitId && !candidates.includes(target)) ||
      !ability.canTrigger({ caster: actor, target })
    ) {
      throw new Error(`Ability ${ability.id} is not legal for unit ${actor.id}`);
    }
  }
}

function validateRoundCommandSet(
  save: BattleSaveV1,
  livingUnits: Unit[],
  commandSet: RoundCommandSetV1,
): void {
  if (
    !commandSet ||
    commandSet.version !== 'round_command_set_v1' ||
    !commandSet.commandSetId ||
    commandSet.round !== save.checkpoint.round + 1 ||
    commandSet.checkpointRevision !== save.checkpoint.checkpointRevision
  ) {
    throw new Error('Round command set does not match the checkpoint');
  }
  const expected = new Set(livingUnits.map((unit) => unit.id));
  const actual = Object.keys(commandSet.intents);
  if (
    actual.length !== expected.size ||
    actual.some((unitId) => !expected.has(unitId))
  ) {
    throw new Error('Round command set must contain every living unit exactly once');
  }
  for (const intent of Object.values(commandSet.intents)) {
    if (
      !intent ||
      (intent.kind !== 'ability' && intent.kind !== 'pass') ||
      (intent.submittedBy !== 'player' && intent.submittedBy !== 'timeout')
    ) {
      throw new Error('Round command set contains an invalid intent');
    }
  }
}

function processBuffDurations(unit: Unit): void {
  for (const buff of unit.buffs.getAllBuffs()) {
    if (!unit.isAlive()) break;
    if (!shouldTickBuffDuration(unit, buff)) continue;
    buff.tickDuration();
    if (buff.isExpired()) {
      unit.buffs.removeBuffExpired(buff.id, {
        trace: unit.runtime.events.reserveTrace(),
      });
    }
  }
}

function getSkipControlTag(unit: Unit): string | null {
  if (unit.tags.hasTag(GameplayTags.STATUS.CONTROL.STUNNED)) {
    return GameplayTags.STATUS.CONTROL.STUNNED;
  }
  if (unit.tags.hasTag(GameplayTags.STATUS.CONTROL.NO_ACTION)) {
    return GameplayTags.STATUS.CONTROL.NO_ACTION;
  }
  return null;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}
