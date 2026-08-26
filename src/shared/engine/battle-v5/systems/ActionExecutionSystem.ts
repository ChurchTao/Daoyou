// engine/battle-v5/systems/ActionExecutionSystem.ts
import { ActiveSkill } from '../abilities/ActiveSkill';
import { EventBus } from '../core/EventBus';
import {
  ActionStateEvent,
  EventPriorityLevel,
  SkillCastEvent,
  SkillInterruptEvent,
  SkillPreCastEvent,
  AbilityCastStartedEvent,
  AbilityCastSettledEvent,
  HitSettledEvent,
} from '../core/events';
import { CombatResultEmitterV3 } from '../v3/CombatResultEmitterV3';
import { combatCarrierFromAbilityV3 } from '../v3/origin';
import {
  consumeDamageSegmentCount,
  createHitResolution,
} from '../core/resolution';

/**
 * ActionExecutionSystem - 行动执行系统
 *
 * EDA 架构设计：
 * - 订阅 SkillPreCastEvent（施法前摇事件）
 * - 检查施法是否被打断
 * - 发布 SkillCastEvent（技能正式释放事件）
 * - 调用 Ability.execute() 执行技能效果
 *
 * 职责边界：
 * - 此系统负责：施法流程控制、打断判定、技能执行
 * - AbilityContainer 负责：技能筛选、发布前摇事件
 * - ActiveSkill.execute 负责：MP消耗、冷却启动、技能效果
 */
export class ActionExecutionSystem {
  private _handlers: Map<string, (event: SkillPreCastEvent) => void> =
    new Map();

  constructor(private readonly eventBus: EventBus = EventBus.instance) {
    this._subscribeToEvents();
  }

  private _subscribeToEvents(): void {
    const preCastHandler = (event: SkillPreCastEvent) =>
      this._onSkillPreCast(event);
    this.eventBus.subscribe<SkillPreCastEvent>(
      'SkillPreCastEvent',
      preCastHandler,
      EventPriorityLevel.SKILL_PRE_CAST,
    );
    this._handlers.set('SkillPreCastEvent', preCastHandler);
  }

  /**
   * 处理施法前摇事件
   * EDA 模式：通过订阅 SkillPreCastEvent 被动触发
   */
  private _onSkillPreCast(event: SkillPreCastEvent): void {
    const eventTrace = event.trace;
    if (!eventTrace) {
      throw new Error('SkillPreCastEvent has no V3 trace');
    }
    // 检查是否被打断
    if (event.isImmune || (event.isInterrupted && event.interruptPolicy !== 'uninterruptible')) {
      event.ability.cancelPreparedCast();
      const interruptedOrigin = {
        kind: 'owned' as const,
        owner: { id: event.caster.id, name: event.caster.name },
        carrier: combatCarrierFromAbilityV3(event.ability),
      };
      this.eventBus.runInCausalContext(
        {
          origin: interruptedOrigin,
          trace: eventTrace,
        },
        () => {
          new CombatResultEmitterV3().commit(
            event.isImmune ? event.target : event.caster,
            {
              type: 'defense',
              defense: event.isImmune ? 'skill_immune' : 'interrupt',
              detail: event.isImmune ? event.immunityReason : undefined,
            },
            { origin: interruptedOrigin, parentTrace: eventTrace },
          );
          this.eventBus.publish<SkillInterruptEvent>({
            type: 'SkillInterruptEvent',
            timestamp: event.caster.runtime.clock.now(),
            caster: event.caster,
            target: event.target,
            ability: event.ability,
            reason: event.isImmune
              ? `${event.immunityReason ?? '技能免疫'}：技能被免疫`
              : '施法被打断',
          });
          if (event.queuedActionState) {
            new CombatResultEmitterV3().commit(
              event.caster,
              {
                type: 'action_state',
                stateType: 'queued_action',
                phase: 'cancelled',
                name: event.queuedActionState.name,
                remainingActions: 0,
                ability: { id: event.ability.id, name: event.ability.name },
              },
              { origin: interruptedOrigin, parentTrace: eventTrace },
            );
            this.eventBus.publish<ActionStateEvent>({
              type: 'ActionStateEvent',
              timestamp: event.caster.runtime.clock.now(),
              unit: event.caster,
              stateType: 'queued_action',
              phase: 'cancelled',
              name: event.queuedActionState.name,
              remainingActions: 0,
              sourceAbility: event.queuedActionState.sourceAbility,
              ability: { id: event.ability.id, name: event.ability.name },
              reason: event.isImmune
                ? `${event.immunityReason ?? '技能免疫'}：技能被免疫`
                : '施法被打断',
            });
          }
        },
      );
      return;
    }

    let ability = event.ability;
    let target = event.target;
    let targets = event.targets?.length ? [...event.targets] : [target];
    if (
      ability instanceof ActiveSkill &&
      !ability.canExecutePreparedCast(event.caster)
    ) {
      ability.cancelPreparedCast();
      const fallbackTarget = event.fallbackTarget;
      if (
        !fallbackTarget ||
        fallbackTarget === event.caster ||
        !fallbackTarget.isAlive()
      ) {
        return;
      }
      const fallback = event.caster.abilities.getFallbackBasicAttack();
      fallback.prepareCast({ caster: event.caster, target: fallbackTarget });
      ability = fallback;
      target = fallbackTarget;
      targets = [fallbackTarget];
    } else if (ability instanceof ActiveSkill && ability.preparedTarget) {
      target = ability.preparedTarget;
      if (!event.targets?.length) targets = [target];
    }

    const origin = {
      kind: 'owned' as const,
      owner: { id: event.caster.id, name: event.caster.name },
      carrier: combatCarrierFromAbilityV3(ability),
    };
    const sequence = this.eventBus.getCurrentSequence();
    if (sequence?.phase === 'action') {
      sequence.ability = { id: ability.id, name: ability.name };
    }
    const castEvents = targets.map((castTarget) => {
      const resolution = createHitResolution({
        actionId: `${event.caster.id}:action:${event.caster.runtime.states.getUnitState(event.caster).actionSequence}`,
        castId: `${event.caster.id}:cast:${eventTrace.eventId}`,
        caster: event.caster,
        target: castTarget,
      });
      const castEvent: SkillCastEvent = {
        type: 'SkillCastEvent',
        timestamp: event.caster.runtime.clock.now(),
        caster: event.caster,
        target: castTarget,
        ability,
        interruptPolicy: event.interruptPolicy,
        hitPolicy: event.hitPolicy,
        resolution,
      };
      this.eventBus.publish<AbilityCastStartedEvent>({
        type: 'AbilityCastStartedEvent',
        timestamp: event.caster.runtime.clock.now(),
        caster: event.caster,
        target: castTarget,
        ability,
        resolution,
      });
      return this.eventBus.runInCausalContext(
        { origin, trace: eventTrace },
        () => this.eventBus.publish(castEvent),
      );
    });
    const castTrace = castEvents[0]?.trace;
    if (!castTrace) throw new Error('SkillCastEvent has no V3 trace');

    this.eventBus.runInCausalContext({ origin, trace: castTrace }, () => {
      if (event.queuedActionState) {
        new CombatResultEmitterV3().commit(
          event.caster,
          {
            type: 'action_state',
            stateType: 'queued_action',
            phase: 'triggered',
            name: event.queuedActionState.name,
            remainingActions: 0,
            ability: { id: ability.id, name: ability.name },
          },
          { origin, parentTrace: castTrace },
        );
        this.eventBus.publish<ActionStateEvent>({
          type: 'ActionStateEvent',
          timestamp: event.caster.runtime.clock.now(),
          unit: event.caster,
          stateType: 'queued_action',
          phase: 'triggered',
          name: event.queuedActionState.name,
          remainingActions: 0,
          sourceAbility: event.queuedActionState.sourceAbility,
          ability: { id: ability.id, name: ability.name },
        });
      }

      if (ability instanceof ActiveSkill) {
        ability.executeMultiple(
          event.caster,
          castEvents.map((castEvent) => ({
            target: castEvent.target,
            shouldApplyEffects: castEvent.isHit !== false,
            resolution: castEvent.resolution,
          })),
        );
        for (const castEvent of castEvents) {
          const resolution = castEvent.resolution;
          if (!resolution) continue;
          this.eventBus.publish<HitSettledEvent>({
            type: 'HitSettledEvent',
            timestamp: event.caster.runtime.clock.now(),
            caster: event.caster,
            target: castEvent.target,
            ability,
            segmentCount: consumeDamageSegmentCount(resolution),
            resolution,
          });
        }
      } else {
        const castEvent = castEvents[0];
        ability.execute({
          caster: event.caster,
          target,
          shouldApplyEffects: castEvent?.isHit !== false,
        });
        const resolution = castEvent?.resolution;
        if (resolution) {
          this.eventBus.publish<HitSettledEvent>({
            type: 'HitSettledEvent',
            timestamp: event.caster.runtime.clock.now(),
            caster: event.caster,
            target: castEvent.target,
            ability,
            segmentCount: consumeDamageSegmentCount(resolution),
            resolution,
          });
        }
      }
      const primaryResolution = castEvents[0]?.resolution;
      if (primaryResolution) {
        this.eventBus.publish<AbilityCastSettledEvent>({
          type: 'AbilityCastSettledEvent',
          timestamp: event.caster.runtime.clock.now(),
          caster: event.caster,
          target: primaryResolution.target,
          ability,
          resolution: primaryResolution,
        });
      }
    });
  }

  /**
   * 销毁系统，取消订阅
   */
  destroy(): void {
    for (const [eventType, handler] of this._handlers) {
      this.eventBus.unsubscribe(eventType, handler);
    }
    this._handlers.clear();
  }
}
