import { GameplayTags } from '@shared/engine/shared/tag-domain';
import { ActiveSkill } from '../abilities/ActiveSkill';
import type { TargetPolicy } from '../abilities/TargetPolicy';
import { executeEffectConfigs } from '../core/effectExecutor';
import {
  ActionPostEvent,
  ActionPreEvent,
  ActionStateEvent,
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
  consumeQueuedAction,
  consumeSkippedAction,
  peekQueuedAction,
  setRuntimeRound,
  shouldTickBuffDuration,
} from '../core/runtimeState';
import { EffectExecutionContextV3 } from '../effects/Effect';
import { AbilityFactory } from '../factories/AbilityFactory';
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
import type { Unit } from '../units/Unit';
import { toBattleStateTimelineV3 } from '../v3/BattleRecordV3';
import { CombatMechanicCodeV3 } from '../v3/mechanics';
import { CombatSystemSourceV3 } from '../v3/origin';
import { resolveLegalBasicAttack } from './BasicAttackResolver';
import { recordBattleEnd } from './BattleLifecycleResolver';
import { BattleResolutionContext } from './BattleResolutionContext';
import { resolveLegalQueuedAction } from './QueuedActionResolver';
import type {
  BattleActionIntentV1,
  BattleRoundResolutionV1,
  RoundCommandSetV1,
} from './types';

export function sealRoundCommandSet(
  save: BattleSaveV1,
  commandSet: RoundCommandSetV1,
): Readonly<RoundCommandSetV1> {
  const restored = restoreBattleSave(save);
  try {
    const livingUnits = restored.roster.getLivingUnits();
    validateRoundCommandSet(save, livingUnits, commandSet);
    validateAllIntents(restored.roster.getAllUnits(), livingUnits, commandSet);
    return deepFreeze(
      JSON.parse(JSON.stringify(commandSet)) as RoundCommandSetV1,
    );
  } finally {
    restored.runtime.dispose();
  }
}

/** Validates a partial set of player intents against one immutable checkpoint. */
export function validateBattleIntents(
  save: BattleSaveV1,
  intents: Readonly<Record<string, BattleActionIntentV1>>,
): void {
  const restored = restoreBattleSave(save);
  try {
    const allUnits = restored.roster.getAllUnits();
    const targetSystem = new TargetSelectionSystem();
    for (const [unitId, intent] of Object.entries(intents)) {
      const actor = restored.roster.units.get(unitId);
      if (!actor || !actor.isAlive()) {
        throw new Error(`Intent references unavailable unit ${unitId}`);
      }
      validateUnitIntent(actor, allUnits, intent, targetSystem);
    }
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
  const resolutionContext = new BattleResolutionContext(runtime);
  const actionSystem = new ActionExecutionSystem(eventBus);
  const damageSystem = new DamageSystem(eventBus, runtime.random);
  try {
    const stateRecorder = new BattleStateRecorder();
    const targetSystem = new TargetSelectionSystem();
    const allUnits = roster.getAllUnits();
    const round = commandSet.round;
    for (const unit of allUnits) setRuntimeRound(unit, round);

    let order: Unit[] = [];
    resolutionContext.runFrame({ phase: 'round_start', turn: round }, () => {
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
      order = InitiativeSystem.order(roster.getLivingUnits(), runtime.random);
      eventBus.publish<TurnOrderEvent>({
        type: 'TurnOrderEvent',
        timestamp: runtime.clock.now(),
        turn: round,
        units: order,
      });
    });

    for (const actor of order) {
      if (!actor.isAlive()) {
        clearPendingActionStates(actor);
        continue;
      }
      beginRuntimeAction(actor);
      resolutionContext.runFrame(
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

      if (!actor.isAlive()) {
        clearPendingActionStates(actor);
        continue;
      }

      let controlledSkip = false;
      resolutionContext.runFrame(
        {
          phase: 'action',
          turn: round,
          actor: { id: actor.id, name: actor.name },
        },
        () => {
          if (!actor.isAlive()) return;
          actor.combatResources.beginAction();
          const queued = peekQueuedAction(actor);
          const hasUninterruptibleQueue =
            queued?.interruptPolicy === 'uninterruptible';
          const controlTag = getSkipControlTag(actor);
          if (!hasUninterruptibleQueue) {
            const skipState = consumeSkippedAction(actor);
            if (skipState) emitSkippedAction(actor, skipState);
            if (controlTag) {
              const cancelledQueue = consumeQueuedAction(actor);
              if (cancelledQueue) {
                cancelQueuedAction(actor, cancelledQueue, controlTag);
              }
              emitControlledSkip(actor, controlTag);
              controlledSkip = true;
              return;
            }
            if (skipState) return;
          }
          executePlannedAction(
            actor,
            commandSet.intents[actor.id],
            allUnits,
            targetSystem,
          );
        },
      );

      resolutionContext.runFrame(
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

    let outcome!: ReturnType<typeof TeamVictorySystem.check>;
    resolutionContext.runFrame({ phase: 'round_post', turn: round }, () => {
      eventBus.publish<RoundPostEvent>({
        type: 'RoundPostEvent',
        timestamp: runtime.clock.now(),
        turn: round,
      });
      outcome = TeamVictorySystem.check(roster, runtime.random, round);
      eventBus.publish<VictoryCheckEvent>({
        type: 'VictoryCheckEvent',
        timestamp: runtime.clock.now(),
        turn: round,
        battleEnded: outcome.battleEnded,
        winner: outcome.battleEnded ? outcome.winnerTeamId : null,
      });
    });

    if (outcome.battleEnded) {
      recordBattleEnd({
        context: resolutionContext,
        recorder: stateRecorder,
        roster,
        runtime,
        outcome,
        round,
      });
    }

    const sequences = resolutionContext.getSequences();
    const stateTimeline = toBattleStateTimelineV3(
      stateRecorder.getTimeline(allUnits),
    );
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
      ...(save.lifecycle
        ? {
            lifecycle: {
              ...save.lifecycle,
              ended: outcome.battleEnded,
            },
          }
        : {}),
    };
    return {
      version: 'battle_round_resolution_v1',
      commandSetId: commandSet.commandSetId,
      round,
      outcome,
      sequences,
      stateTimeline,
      checkpoint,
      save: nextSave,
    };
  } finally {
    actionSystem.destroy();
    damageSystem.destroy();
    resolutionContext.destroy();
  }
}

function executePlannedAction(
  actor: Unit,
  intent: BattleActionIntentV1,
  allUnits: Unit[],
  targetSystem: TargetSelectionSystem,
): void {
  const queued = consumeQueuedAction(actor);
  if (queued) {
    if (
      queued.interruptPolicy !== 'uninterruptible' &&
      actor.tags.hasTag(GameplayTags.STATUS.CONTROL.NO_SKILL)
    ) {
      cancelQueuedAction(
        actor,
        queued,
        GameplayTags.STATUS.CONTROL.NO_SKILL,
      );
      executeBasicAttack(actor, intent.targetUnitId, allUnits);
      return;
    }
    const ability = AbilityFactory.create(queued.ability);
    if (!(ability instanceof ActiveSkill)) {
      throw new Error(
        `Queued action ${queued.ability.slug} is not an active skill`,
      );
    }
    const targets = resolveTargets(
      actor,
      ability.targetPolicy,
      intent.targetUnitId,
      allUnits,
      targetSystem,
      true,
    );
    const primary = targets[0];
    if (!primary) return;
    castAbility(actor, ability, primary, targets, {
      interruptPolicy: queued.interruptPolicy,
      hitPolicy: queued.hitPolicy,
      queuedActionState: {
        name: '蓄势',
        sourceAbility: queued.sourceAbility,
      },
    });
    return;
  }
  if (intent.kind === 'basic_attack') {
    executeBasicAttack(actor, intent.targetUnitId, allUnits);
    return;
  }
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
  castAbility(actor, ability, primary, targets);
}

function executeBasicAttack(
  actor: Unit,
  targetUnitId: string | undefined,
  allUnits: Unit[],
): void {
  if (actor.tags.hasTag(GameplayTags.STATUS.CONTROL.NO_BASIC)) return;
  const resolved = resolveLegalBasicAttack(actor, allUnits, targetUnitId);
  if (!resolved) return;
  castAbility(
    actor,
    resolved.ability,
    resolved.target,
    resolved.legalTargets,
  );
}

function emitSkippedAction(
  actor: Unit,
  skipped: NonNullable<ReturnType<typeof consumeSkippedAction>>,
): void {
  const context = actionFlowContext(actor);
  context.commit(actor, {
    type: 'action_state',
    stateType: 'rest',
    phase: 'skipped',
    name: skipped.name,
    remainingActions: 0,
  });
  context.emit<ActionStateEvent>({
    type: 'ActionStateEvent',
    timestamp: actor.runtime.clock.now(),
    unit: actor,
    stateType: 'rest',
    phase: 'skipped',
    name: skipped.name,
    remainingActions: 0,
    sourceAbility: skipped.sourceAbility,
    reason: skipped.reason,
  });
}

function emitControlledSkip(actor: Unit, controlTag: string): void {
  const context = actionFlowContext(actor);
  context.commit(actor, {
    type: 'mechanic',
    code: CombatMechanicCodeV3.CONTROL_SKIP,
    payload: {
      kind: 'control_skip',
      controlName: getControlName(actor, controlTag),
    },
  });
  context.emit<ControlledSkipEvent>({
    type: 'ControlledSkipEvent',
    timestamp: actor.runtime.clock.now(),
    unit: actor,
    controlTag,
  });
}

function actionFlowContext(actor: Unit): EffectExecutionContextV3 {
  return EffectExecutionContextV3.system({
    owner: actor,
    caster: actor,
    target: actor,
    source: CombatSystemSourceV3.ACTION_FLOW,
    trace: actor.runtime.events.reserveTrace(),
  });
}

function getControlName(actor: Unit, controlTag: string): string {
  return actor.buffs
    .getAllBuffs()
    .find((buff) => buff.tags.hasTag(controlTag))?.name ?? '控制效果';
}

function castAbility(
  actor: Unit,
  ability: ActiveSkill,
  primary: Unit,
  targets: Unit[],
  options: {
    interruptPolicy?: 'normal' | 'uninterruptible';
    hitPolicy?: 'normal' | 'guaranteed';
    queuedActionState?: {
      name: string;
      sourceAbility?: { id: string; name: string };
    };
  } = {},
): void {
  ability.prepareCast({ caster: actor, target: primary });
  actor.runtime.events.publish<SkillPreCastEvent>({
    type: 'SkillPreCastEvent',
    timestamp: actor.runtime.clock.now(),
    caster: actor,
    target: primary,
    targets,
    ability,
    isInterrupted: false,
    interruptPolicy: options.interruptPolicy,
    hitPolicy: options.hitPolicy ?? ability.hitPolicy,
    queuedActionState: options.queuedActionState,
  });
}

function cancelQueuedAction(
  actor: Unit,
  queued: NonNullable<ReturnType<typeof consumeQueuedAction>>,
  reason: string,
): void {
  const context = EffectExecutionContextV3.system({
    owner: actor,
    caster: actor,
    target: actor,
    source: CombatSystemSourceV3.ACTION_FLOW,
    trace: actor.runtime.events.reserveTrace(),
  });
  executeEffectConfigs(queued.cancelEffects, context);
  context.commit(actor, {
    type: 'action_state',
    stateType: 'queued_action',
    phase: 'cancelled',
    name: '蓄势',
    remainingActions: 0,
    ability: { id: queued.ability.slug, name: queued.ability.name },
  });
  context.emit<ActionStateEvent>({
    type: 'ActionStateEvent',
    timestamp: actor.runtime.clock.now(),
    unit: actor,
    stateType: 'queued_action',
    phase: 'cancelled',
    name: '蓄势',
    remainingActions: 0,
    sourceAbility: queued.sourceAbility,
    ability: { id: queued.ability.slug, name: queued.ability.name },
    reason,
  });
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
      const target = candidates.find(
        (candidate) => candidate.id === targetUnitId,
      );
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
    validateUnitIntent(actor, allUnits, intent, targetSystem);
  }
}

function validateUnitIntent(
  actor: Unit,
  allUnits: Unit[],
  intent: BattleActionIntentV1,
  targetSystem: TargetSelectionSystem,
): void {
  if (peekQueuedAction(actor)) {
    const queuedAction = resolveLegalQueuedAction(
      actor,
      allUnits,
      intent.targetUnitId,
    );
    if (!queuedAction || intent.kind !== 'basic_attack') {
      throw new Error(
        `Unit ${actor.id} must select a legal target for its queued action`,
      );
    }
    if (queuedAction.target.id !== intent.targetUnitId) {
      throw new Error(`Queued action target is not legal for unit ${actor.id}`);
    }
    return;
  }
  if (intent.kind === 'basic_attack') {
    const resolved = resolveLegalBasicAttack(
      actor,
      allUnits,
      intent.targetUnitId,
    );
    if (!resolved || resolved.target.id !== intent.targetUnitId) {
      throw new Error(`Basic attack is not legal for unit ${actor.id}`);
    }
    return;
  }
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
    throw new Error(
      'Round command set must contain every living unit exactly once',
    );
  }
  for (const intent of Object.values(commandSet.intents)) {
    if (
      !intent ||
      (intent.kind !== 'ability' && intent.kind !== 'basic_attack') ||
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
