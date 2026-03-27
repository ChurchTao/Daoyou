import { EventBus } from '../../core/EventBus';
import {
  ActionPreEvent,
  BattleEndEvent,
  BattleInitEvent,
  BuffAppliedEvent,
  BuffImmuneEvent,
  BuffRemovedEvent,
  CooldownModifyEvent,
  DamageTakenEvent,
  DeathPreventEvent,
  DispelEvent,
  EventPriorityLevel,
  HealEvent,
  HitCheckEvent,
  ManaBurnEvent,
  ReflectEvent,
  ResourceDrainEvent,
  RoundStartEvent,
  ShieldEvent,
  SkillCastEvent,
  SkillInterruptEvent,
  TagTriggerEvent,
} from '../../core/events';
import { LogAggregator } from './LogAggregator';
import { LogEntry } from './types';

/**
 * LogCollector 职责：监听 EventBus 事件，转换为结构化 LogEntry。
 * 不生成 message，只收集数据。
 */
export class LogCollector {
  private _aggregator: LogAggregator;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _handlers: Map<string, (event: any) => void> = new Map();

  /**
   * 获取事件处理器（供测试使用）
   * @internal
   */
  get handlers(): Map<string, (event: unknown) => void> {
    return this._handlers;
  }

  constructor(aggregator: LogAggregator) {
    this._aggregator = aggregator;
  }

  subscribe(eventBus: EventBus): void {
    const highPriority = EventPriorityLevel.ACTION_TRIGGER + 1;

    // ===== Span 管理事件（高优先级，确保在效果事件之前） =====

    this._addHandler(
      eventBus,
      'BattleInitEvent',
      () => {
        this._aggregator.beginSpan('battle_init', { turn: 0 });
      },
      highPriority
    );

    this._addHandler(
      eventBus,
      'RoundStartEvent',
      (e: RoundStartEvent) => {
        this._aggregator.beginSpan('round_start', { turn: e.turn });
      },
      highPriority
    );

    this._addHandler(
      eventBus,
      'ActionPreEvent',
      (e: ActionPreEvent) => {
        this._aggregator.beginSpan('action_pre', {
          turn: this._aggregator.currentTurn,
          actor: { id: e.caster.id, name: e.caster.name },
        });
      },
      highPriority
    );

    this._addHandler(
      eventBus,
      'SkillCastEvent',
      (e: SkillCastEvent) => {
        this._aggregator.beginSpan('action', {
          turn: this._aggregator.currentTurn,
          actor: { id: e.caster.id, name: e.caster.name },
          ability: { id: e.ability.id, name: e.ability.name },
        });
      },
      highPriority
    );

    this._addHandler(
      eventBus,
      'BattleEndEvent',
      (e: BattleEndEvent) => {
        this._aggregator.beginSpan('battle_end', {
          turn: e.turns,
          actor: e.winner ? { id: e.winner, name: e.winner } : undefined,
        });
      },
      highPriority
    );

    // ===== 数据收集事件（默认 COMBAT_LOG 优先级） =====

    this._addHandler(eventBus, 'DamageTakenEvent', (e: DamageTakenEvent) => {
      this._aggregator.addEntry({
        id: this._generateId(),
        type: 'damage',
        data: {
          value: Math.round(e.damageTaken),
          remainHp: Math.round(e.remainHealth),
          isCritical: e.isCritical ?? false,
          targetName: e.target.name,
          sourceBuff: e.buff?.name,
          shieldAbsorbed: e.shieldAbsorbed,
          remainShield: e.remainShield,
        },
        timestamp: Date.now(),
      });

      if (e.isLethal) {
        this._aggregator.addEntry({
          id: this._generateId(),
          type: 'death',
          data: {
            targetName: e.target.name,
            killerName: e.caster?.name,
          },
          timestamp: Date.now(),
        });
      }
    });

    this._addHandler(eventBus, 'HealEvent', (e: HealEvent) => {
      this._aggregator.addEntry({
        id: this._generateId(),
        type: 'heal',
        data: {
          value: Math.round(e.healAmount),
          remainHp: Math.round(e.target.currentHp),
          targetName: e.target.name,
        },
        timestamp: Date.now(),
      });
    });

    this._addHandler(eventBus, 'ShieldEvent', (e: ShieldEvent) => {
      this._aggregator.addEntry({
        id: this._generateId(),
        type: 'shield',
        data: {
          value: Math.round(e.shieldAmount),
          targetName: e.target.name,
        },
        timestamp: Date.now(),
      });
    });

    this._addHandler(eventBus, 'BuffAppliedEvent', (e: BuffAppliedEvent) => {
      this._aggregator.addEntry({
        id: this._generateId(),
        type: 'buff_apply',
        data: {
          buffName: e.buff.name,
          buffType: e.buff.type,
          targetName: e.target.name,
          duration: e.buff.getMaxDuration(),
        },
        timestamp: Date.now(),
      });
    });

    this._addHandler(eventBus, 'BuffRemovedEvent', (e: BuffRemovedEvent) => {
      this._aggregator.addEntry({
        id: this._generateId(),
        type: 'buff_remove',
        data: {
          buffName: e.buff.name,
          targetName: e.target.name,
          reason: e.reason,
        },
        timestamp: Date.now(),
      });
    });

    this._addHandler(eventBus, 'BuffImmuneEvent', (e: BuffImmuneEvent) => {
      this._aggregator.addEntry({
        id: this._generateId(),
        type: 'buff_immune',
        data: {
          buffName: e.buff.name,
          targetName: e.target.name,
        },
        timestamp: Date.now(),
      });
    });

    this._addHandler(eventBus, 'HitCheckEvent', (e: HitCheckEvent) => {
      if (e.isDodged) {
        this._aggregator.addEntry({
          id: this._generateId(),
          type: 'dodge',
          data: { targetName: e.target.name },
          timestamp: Date.now(),
        });
      } else if (e.isResisted) {
        this._aggregator.addEntry({
          id: this._generateId(),
          type: 'resist',
          data: { targetName: e.target.name },
          timestamp: Date.now(),
        });
      }
    });

    this._addHandler(eventBus, 'SkillInterruptEvent', (e: SkillInterruptEvent) => {
      this._aggregator.addEntry({
        id: this._generateId(),
        type: 'skill_interrupt',
        data: {
          skillName: e.ability.name,
          reason: e.reason,
        },
        timestamp: Date.now(),
      });
    });

    this._addHandler(eventBus, 'ManaBurnEvent', (e: ManaBurnEvent) => {
      this._aggregator.addEntry({
        id: this._generateId(),
        type: 'mana_burn',
        data: {
          value: Math.round(e.burnAmount),
          targetName: e.target.name,
        },
        timestamp: Date.now(),
      });
    });

    this._addHandler(eventBus, 'CooldownModifyEvent', (e: CooldownModifyEvent) => {
      this._aggregator.addEntry({
        id: this._generateId(),
        type: 'cooldown_modify',
        data: {
          value: e.cdModifyValue,
          affectedSkillName: e.affectedAbilityName,
          targetName: e.target.name,
        },
        timestamp: Date.now(),
      });
    });

    this._addHandler(eventBus, 'ResourceDrainEvent', (e: ResourceDrainEvent) => {
      this._aggregator.addEntry({
        id: this._generateId(),
        type: 'resource_drain',
        data: {
          value: Math.round(e.amount),
          drainType: e.drainType,
          targetName: e.target.name,
        },
        timestamp: Date.now(),
      });
    });

    this._addHandler(eventBus, 'ReflectEvent', (e: ReflectEvent) => {
      this._aggregator.addEntry({
        id: this._generateId(),
        type: 'reflect',
        data: {
          value: Math.round(e.reflectAmount),
          targetName: e.target.name,
        },
        timestamp: Date.now(),
      });
    });

    this._addHandler(eventBus, 'DispelEvent', (e: DispelEvent) => {
      this._aggregator.addEntry({
        id: this._generateId(),
        type: 'dispel',
        data: {
          buffs: e.removedBuffNames,
          targetName: e.target.name,
        },
        timestamp: Date.now(),
      });
    });

    this._addHandler(eventBus, 'TagTriggerEvent', (e: TagTriggerEvent) => {
      this._aggregator.addEntry({
        id: this._generateId(),
        type: 'tag_trigger',
        data: {
          tag: e.tag,
          targetName: e.target.name,
        },
        timestamp: Date.now(),
      });
    });

    this._addHandler(eventBus, 'DeathPreventEvent', (e: DeathPreventEvent) => {
      this._aggregator.addEntry({
        id: this._generateId(),
        type: 'death_prevent',
        data: { targetName: e.target.name },
        timestamp: Date.now(),
      });
    });
  }

  unsubscribe(eventBus: EventBus): void {
    for (const [type, handler] of this._handlers) {
      eventBus.unsubscribe(type, handler);
    }
    this._handlers.clear();
  }

  private _addHandler(
    eventBus: EventBus,
    eventType: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    handler: (event: any) => void,
    priority: number = EventPriorityLevel.COMBAT_LOG
  ): void {
    eventBus.subscribe(eventType, handler, priority);
    this._handlers.set(eventType, handler);
  }

  private _generateId(): string {
    return `entry_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }
}
