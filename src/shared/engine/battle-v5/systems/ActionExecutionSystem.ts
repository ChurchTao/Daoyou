// engine/battle-v5/systems/ActionExecutionSystem.ts
import { EventBus } from '../core/EventBus';
import {
  ActionStateEvent,
  SkillPreCastEvent,
  SkillCastEvent,
  SkillInterruptEvent,
  EventPriorityLevel,
} from '../core/events';

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
  private _handlers: Map<string, (event: SkillPreCastEvent) => void> = new Map();

  constructor() {
    this._subscribeToEvents();
  }

  private _subscribeToEvents(): void {
    const preCastHandler = (event: SkillPreCastEvent) => this._onSkillPreCast(event);
    EventBus.instance.subscribe<SkillPreCastEvent>(
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
    // 检查是否被打断
    if (event.isInterrupted && event.interruptPolicy !== 'uninterruptible') {
      event.ability.cancelPreparedCast();
      // 发布被打断事件
      EventBus.instance.publish<SkillInterruptEvent>({
        type: 'SkillInterruptEvent',
        timestamp: Date.now(),
        caster: event.caster,
        target: event.target,
        ability: event.ability,
        reason: '施法被打断',
      });
      if (event.queuedActionState) {
        EventBus.instance.publish<ActionStateEvent>({
          type: 'ActionStateEvent',
          timestamp: Date.now(),
          unit: event.caster,
          stateType: 'queued_action',
          phase: 'cancelled',
          name: event.queuedActionState.name,
          remainingActions: 0,
          sourceAbility: event.queuedActionState.sourceAbility,
          ability: { id: event.ability.id, name: event.ability.name },
          reason: '施法被打断',
        });
      }
      return;
    }

    // 未被打断，发布技能释放事件
    const castEvent: SkillCastEvent = {
      type: 'SkillCastEvent',
      timestamp: Date.now(),
      caster: event.caster,
      target: event.target,
      ability: event.ability,
      interruptPolicy: event.interruptPolicy,
      hitPolicy: event.hitPolicy,
    };

    EventBus.instance.publish(castEvent);

    if (event.queuedActionState) {
      EventBus.instance.publish<ActionStateEvent>({
        type: 'ActionStateEvent',
        timestamp: Date.now(),
        unit: event.caster,
        stateType: 'queued_action',
        phase: 'triggered',
        name: event.queuedActionState.name,
        remainingActions: 0,
        sourceAbility: event.queuedActionState.sourceAbility,
        ability: { id: event.ability.id, name: event.ability.name },
      });
    }

    // 无论命中与否，技能都需要消耗资源并进入冷却；效果链是否执行由上下文决定。
    event.ability.execute({
      caster: event.caster,
      target: event.target,
      shouldApplyEffects: castEvent.isHit !== false,
    });
  }

  /**
   * 销毁系统，取消订阅
   */
  destroy(): void {
    for (const [eventType, handler] of this._handlers) {
      EventBus.instance.unsubscribe(eventType, handler);
    }
    this._handlers.clear();
  }
}
