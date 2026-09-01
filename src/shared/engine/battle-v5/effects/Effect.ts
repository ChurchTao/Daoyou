import { Ability, type AbilityCastSnapshot } from '../abilities/Ability';
import { Buff } from '../buffs/Buff';
import type { DamageSegmentAppliedEvent } from '../core/events';
import type { CombatResolutionContext } from '../core/resolution';
import { CombatEvent, type LogCauseRef } from '../core/types';
import { Unit } from '../units/Unit';
import { CombatResultEmitterV3 } from '../v3/CombatResultEmitterV3';
import type { CombatMechanicCuePayloadV3 } from '../v3/mechanics';
import {
  CombatAttributionV3,
  type CombatSystemSourceV3,
  combatAttributionFromBuffV3,
} from '../v3/origin';
import type {
  CombatFactDraftV3,
  CombatOriginV3,
  CombatTraceV3,
} from '../v3/types';

/**
 * 效果执行上下文
 */
export class EffectExecutionContextV3 {
  readonly attribution: CombatAttributionV3;
  readonly owner: Unit;
  readonly caster: Unit;
  readonly target: Unit;
  readonly origin: CombatOriginV3;
  readonly trace: CombatTraceV3;
  readonly ability?: Ability;
  readonly buff?: Buff;
  readonly castSnapshot?: AbilityCastSnapshot;
  readonly damageCause?: LogCauseRef;
  readonly resolution?: CombatResolutionContext;
  /**
   * 触发此效果的事件（可选）
   * 用于支持吸血、反伤、根据受击伤害触发的效果等
   */
  readonly triggerEvent?: CombatEvent;
  private readonly ownerLivenessPolicy: EffectOwnerLivenessPolicyV3;

  private constructor(
    input: EffectExecutionContextInputV3,
    attribution: CombatAttributionV3,
    ownerLivenessPolicy: EffectOwnerLivenessPolicyV3,
  ) {
    const trace =
      input.trace ??
      input.triggerEvent?.trace ??
      input.owner.runtime.events.getCurrentTrace();
    if (!trace) {
      throw new Error('EffectExecutionContextV3 requires an explicit trace');
    }
    this.attribution = attribution;
    this.owner = attribution.owner;
    this.caster = input.caster;
    this.target = input.target;
    this.origin = attribution.origin;
    this.trace = Object.freeze({
      ...trace,
      narrativeCauseId: trace.narrativeCauseId ?? trace.eventId,
    });
    this.ability = input.ability;
    this.buff = input.buff;
    this.castSnapshot = input.castSnapshot;
    this.damageCause = input.damageCause;
    this.resolution = input.resolution;
    this.triggerEvent = input.triggerEvent;
    this.ownerLivenessPolicy = ownerLivenessPolicy;
    Object.freeze(this);
  }

  static activeAbility(
    input: AbilityEffectExecutionContextInputV3,
  ): EffectExecutionContextV3 {
    return new EffectExecutionContextV3(
      input,
      CombatAttributionV3.fromAbility(input.owner, input.ability),
      EffectOwnerLivenessPolicyV3.REQUIRE_ALIVE,
    );
  }

  static passiveAbility(
    input: AbilityEffectExecutionContextInputV3,
  ): EffectExecutionContextV3 {
    return new EffectExecutionContextV3(
      input,
      CombatAttributionV3.fromAbility(input.owner, input.ability),
      resolveOwnedEffectLivenessPolicy(input),
    );
  }

  static buff(
    input: BuffEffectExecutionContextInputV3,
  ): EffectExecutionContextV3 {
    const attribution = combatAttributionFromBuffV3(input.buff);
    if (attribution.owner !== input.owner) {
      throw new Error(`Buff ${input.buff.id} execution owner mismatch`);
    }
    return new EffectExecutionContextV3(
      input,
      attribution,
      resolveOwnedEffectLivenessPolicy(input),
    );
  }

  static system(
    input: SystemEffectExecutionContextInputV3,
  ): EffectExecutionContextV3 {
    return new EffectExecutionContextV3(
      input,
      CombatAttributionV3.system(input.owner, input.source),
      EffectOwnerLivenessPolicyV3.ALLOW_LETHAL_REACTION,
    );
  }

  canExecuteEffect(): boolean {
    return (
      this.ownerLivenessPolicy ===
        EffectOwnerLivenessPolicyV3.ALLOW_LETHAL_REACTION ||
      this.owner.isAlive()
    );
  }

  emit<T extends CombatEvent>(event: T): T {
    const eventWithResolution = event.resolution || this.resolution
      ? Object.assign(event, {
          resolution: event.resolution ?? this.resolution,
        }) as T
      : event;
    return this.owner.runtime.events.runInCausalContext(
      {
        origin: this.origin,
        trace: this.trace,
        resolution: this.resolution ?? this.triggerEvent?.resolution,
      },
      () => this.triggerEvent
        ? this.owner.runtime.events.enqueueReaction(eventWithResolution, 50)
        : this.owner.runtime.events.publish(eventWithResolution),
    );
  }

  commit(target: Unit, result: CombatFactDraftV3): void {
    new CombatResultEmitterV3().commit(target, result, {
      origin: this.origin,
      parentTrace: this.trace,
    });
  }

  commitCue(
    target: Unit,
    result: Extract<CombatFactDraftV3, { type: 'mechanic' }> & {
      payload: CombatMechanicCuePayloadV3;
    },
  ): void {
    new CombatResultEmitterV3().commit(target, result, {
      origin: this.origin,
      parentTrace: this.trace,
      narrativeRole: 'cue',
    });
  }

  withNarrativeCause(): EffectExecutionContextV3 {
    return new EffectExecutionContextV3(
      {
        owner: this.owner,
        caster: this.caster,
        target: this.target,
        trace: {
          ...this.trace,
          narrativeCauseId: this.owner.runtime.events.nextNarrativeCauseId(),
        },
        ability: this.ability,
        buff: this.buff,
        castSnapshot: this.castSnapshot,
        damageCause: this.damageCause,
        resolution: this.resolution,
        triggerEvent: this.triggerEvent,
      },
      this.attribution,
      this.ownerLivenessPolicy,
    );
  }
}

interface EffectExecutionContextInputV3 {
  owner: Unit;
  caster: Unit;
  target: Unit;
  trace?: CombatTraceV3;
  ability?: Ability;
  buff?: Buff;
  castSnapshot?: AbilityCastSnapshot;
  damageCause?: LogCauseRef;
  resolution?: CombatResolutionContext;
  triggerEvent?: CombatEvent;
}

export interface AbilityEffectExecutionContextInputV3 extends EffectExecutionContextInputV3 {
  ability: Ability;
}

export interface BuffEffectExecutionContextInputV3 extends EffectExecutionContextInputV3 {
  buff: Buff;
}

export interface SystemEffectExecutionContextInputV3 extends EffectExecutionContextInputV3 {
  source: CombatSystemSourceV3;
}

export function executeGameplayEffectV3(
  effect: GameplayEffect,
  context: EffectExecutionContextV3,
): void {
  if (!context.canExecuteEffect()) return;
  context.owner.runtime.events.runInCausalContext(
    {
      origin: context.origin,
      trace: context.trace,
      resolution: context.resolution ?? context.triggerEvent?.resolution,
    },
    () => effect.execute(context),
  );
}

enum EffectOwnerLivenessPolicyV3 {
  REQUIRE_ALIVE = 'require_alive',
  ALLOW_LETHAL_REACTION = 'allow_lethal_reaction',
}

function resolveOwnedEffectLivenessPolicy(
  input: EffectExecutionContextInputV3,
): EffectOwnerLivenessPolicyV3 {
  const trigger = input.triggerEvent;
  if (trigger?.type !== 'DamageSegmentAppliedEvent') {
    return EffectOwnerLivenessPolicyV3.REQUIRE_ALIVE;
  }
  const damageTaken = trigger as DamageSegmentAppliedEvent;
  if (
    damageTaken.target === input.owner &&
    damageTaken.hpReachedZeroBeforeReactions
  ) {
    return EffectOwnerLivenessPolicyV3.ALLOW_LETHAL_REACTION;
  }
  return EffectOwnerLivenessPolicyV3.REQUIRE_ALIVE;
}

/**
 * 原子效果基类 (Atomic Gameplay Effect)
 *
 * 职责：
 * - 定义原子操作（伤害、治疗、加Buff等）
 * - 在特定的上下文中执行
 */
export abstract class GameplayEffect {
  /**
   * 执行效果
   * @param context 包含施法者、目标、所属技能的上下文
   */
  abstract execute(context: EffectExecutionContextV3): void;
}
