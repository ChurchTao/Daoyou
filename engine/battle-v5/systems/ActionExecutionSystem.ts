// engine/battle-v5/systems/ActionExecutionSystem.ts
import { EventBus } from '../core/EventBus';
import { SkillPreCastEvent, SkillCastEvent, SkillInterruptEvent, EventPriorityLevel } from '../core/events';

/**
 * 行动执行系统
 * 负责处理施法前摇到技能释放的流程
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
   */
  private _onSkillPreCast(event: SkillPreCastEvent): void {
    // 检查是否被打断
    if (event.isInterrupted) {
      // 发布被打断事件
      EventBus.instance.publish<SkillInterruptEvent>({
        type: 'SkillInterruptEvent',
        priority: EventPriorityLevel.COMBAT_LOG,
        timestamp: Date.now(),
        caster: event.caster,
        ability: event.ability,
        reason: '施法被打断',
      });
      return;
    }

    // 未被打断，发布技能释放事件
    const castEvent: SkillCastEvent = {
      type: 'SkillCastEvent',
      priority: EventPriorityLevel.SKILL_CAST,
      timestamp: Date.now(),
      caster: event.caster,
      target: event.target,
      ability: event.ability,
    };

    EventBus.instance.publish(castEvent);

    // 执行技能的核心逻辑
    event.ability.execute({ caster: event.caster, target: event.target });
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
