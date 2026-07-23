import { EventBus } from '../../core/EventBus';
import { battleRandom } from '../../core/BattleRandom';
import {
  ActionPreEvent,
  ActionPostEvent,
  ActionStateEvent,
  BattleEndEvent,
  BattleInitEvent,
  BuffAppliedEvent,
  BuffImmuneEvent,
  BuffRemovedEvent,
  ControlResistEvent,
  ControlledSkipEvent,
  CombatResourceChangeEvent,
  CooldownModifyEvent,
  DamageImmuneEvent,
  DamageTakenEvent,
  DeathPreventEvent,
  DispelEvent,
  EventPriorityLevel,
  HealEvent,
  HitCheckEvent,
  ManaShieldAbsorbEvent,
  ManaBurnEvent,
  MechanicLogEvent,
  ResourceDrainEvent,
  RoundStartEvent,
  ShieldEvent,
  SkillCastEvent,
  SkillInterruptEvent,
  TagTriggerEvent,
} from '../../core/events';
import { LogAggregator } from './LogAggregator';
import type { LogCauseRef, LogSourceRef } from './types';

/**
 * LogCollector 职责：监听 EventBus 事件，转换为结构化 LogEntry。
 * 不生成 message，只收集数据。
 */
export class LogCollector {
  private _aggregator: LogAggregator;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _handlers: Map<string, (event: any) => void> = new Map();
  private _unitNames = new Map<string, string>();

  constructor(aggregator: LogAggregator) {
    this._aggregator = aggregator;
  }

  subscribe(eventBus: EventBus): void {
    const highPriority = EventPriorityLevel.ACTION_TRIGGER + 1;

    // ===== Span 管理事件（高优先级，确保在效果事件之前） =====

    this._addHandler(
      eventBus,
      'BattleInitEvent',
      (e: BattleInitEvent) => {
        this._unitNames.set(e.player.id, e.player.name);
        this._unitNames.set(e.opponent.id, e.opponent.name);
        this._aggregator.beginSpan('battle_init', { turn: 0, actor: { id: e.player.id, name: e.player.name } });
        for (const unit of [e.player, e.opponent]) {
          for (const resource of unit.combatResources.snapshots()) {
            if (resource.current <= 0) continue;
            this._aggregator.addEntry({
              id: this._generateId(),
              type: 'resource_change',
              data: {
                targetName: unit.name,
                resourceId: resource.id,
                resourceName: resource.name,
                resourceMax: resource.max,
                operation: 'set',
                requested: resource.current,
                applied: resource.current,
                overflow: 0,
                before: 0,
                after: resource.current,
                isInitial: true,
              },
              timestamp: Date.now(),
            });
          }
        }
      },
      highPriority,
    );

    this._addHandler(
      eventBus,
      'RoundStartEvent',
      (e: RoundStartEvent) => {
        this._aggregator.beginSpan('round_start', { turn: e.turn });
      },
      highPriority,
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
      highPriority,
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
      highPriority,
    );

    this._addHandler(
      eventBus,
      'ActionPostEvent',
      (e: ActionPostEvent) => {
        this._aggregator.beginSpan('action_after', {
          turn: this._aggregator.currentTurn,
          actor: { id: e.caster.id, name: e.caster.name },
        });
      },
      highPriority,
    );

    this._addHandler(
      eventBus,
      'BattleEndEvent',
      (e: BattleEndEvent) => {
        const winnerName = e.winner
          ? this._unitNames.get(e.winner) ?? e.winner
          : undefined;
        this._aggregator.beginSpan('battle_end', {
          turn: e.turns,
          actor: e.winner
            ? { id: e.winner, name: winnerName ?? e.winner }
            : undefined,
        });
      },
      highPriority,
    );

    this._addHandler(
      eventBus,
      'ControlledSkipEvent',
      (e: ControlledSkipEvent) => {
        this._aggregator.addEntry({
          id: this._generateId(),
          type: 'control_skip',
          data: {
            unitName: e.unit.name,
            controlTag: e.controlTag,
          },
          timestamp: Date.now(),
        });
      },
      highPriority,
    );

    // ===== 数据收集事件（默认 COMBAT_LOG 优先级） =====

    this._addHandler(eventBus, 'DamageTakenEvent', (e: DamageTakenEvent) => {
      this._aggregator.addEntry({
        id: this._generateId(),
        type: 'damage',
        data: {
          value: Math.round(e.damageTaken),
          beforeHp: Math.round(e.beforeHp),
          remainHp: Math.round(e.remainHp),
          isCritical: e.isCritical ?? false,
          targetName: e.target.name,
          damageSource: e.damageSource,
          reflectSourceName: e.reflectSourceName,
          shieldAbsorbed: e.shieldAbsorbed,
          remainShield: e.remainShield,
          damageType: e.damageType,
          source: this._sourceRef(e.caster, e.ability, e.buff),
          cause: this._causeRef(e.cause),
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
      const healType = e.healType ?? 'hp';
      this._aggregator.addEntry({
        id: this._generateId(),
        type: 'heal',
        data: {
          value: Math.round(e.appliedAmount ?? e.healAmount),
          remainHp: Math.round(e.target.getCurrentHp()),
          ...(healType === 'mp'
            ? { remainMp: Math.round(e.target.getCurrentMp()) }
            : {}),
          targetName: e.target.name,
          healType,
          source: this._sourceRef(e.caster, e.ability, e.buff),
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
          remainShield: Math.round(e.target.getCurrentShield()),
          targetName: e.target.name,
          source: this._sourceRef(e.caster, e.ability),
        },
        timestamp: Date.now(),
      });
    });

    this._addHandler(
      eventBus,
      'ManaShieldAbsorbEvent',
      (e: ManaShieldAbsorbEvent) => {
        this._aggregator.addEntry({
          id: this._generateId(),
          type: 'mana_shield_absorb',
          data: {
            targetName: e.target.name,
            absorbedDamage: Math.round(e.absorbedDamage),
            mpConsumed: Math.round(e.mpConsumed),
            remainDamage: Math.round(e.remainDamage),
          },
          timestamp: Date.now(),
        });
      },
    );

    this._addHandler(eventBus, 'BuffAppliedEvent', (e: BuffAppliedEvent) => {
      this._aggregator.addEntry({
        id: this._generateId(),
        type: 'buff_apply',
        data: {
          buffId: e.buff.id,
          buffName: e.buff.name,
          buffType: e.buff.type,
          targetId: e.target.id,
          targetName: e.target.name,
          layers: e.buff.getLayer(),
          duration: e.buff.getMaxDuration(),
          durationUnit: 'owner_action',
          visibility: e.buff.logVisibility,
          source: this._sourceRef(e.source, e.ability, e.sourceBuff),
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
          immuneTag: e.immuneTag,
        },
        timestamp: Date.now(),
      });
    });

    this._addHandler(
      eventBus,
      'DamageImmuneEvent',
      (e: DamageImmuneEvent) => {
        this._aggregator.addEntry({
          id: this._generateId(),
          type: 'damage_immune',
          data: {
            targetName: e.target.name,
            blockedDamage: Math.round(e.blockedDamage),
            matchedTag: e.matchedTag,
          },
          timestamp: Date.now(),
        });
      },
    );

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

    this._addHandler(eventBus, 'ControlResistEvent', (e: ControlResistEvent) => {
      this._aggregator.addEntry({
        id: this._generateId(),
        type: 'resist',
        data: { targetName: e.target.name },
        timestamp: Date.now(),
      });
    });

    this._addHandler(
      eventBus,
      'SkillInterruptEvent',
      (e: SkillInterruptEvent) => {
        this._aggregator.addEntry({
          id: this._generateId(),
          type: 'skill_interrupt',
          data: {
            skillName: e.ability.name,
            targetName: e.target.name,
            reason: e.reason,
          },
          timestamp: Date.now(),
        });
      },
    );

    this._addHandler(eventBus, 'ManaBurnEvent', (e: ManaBurnEvent) => {
      this._aggregator.addEntry({
        id: this._generateId(),
        type: 'mana_burn',
        data: {
          value: Math.round(e.burnAmount),
          targetName: e.target.name,
          source: this._sourceRef(e.caster, e.ability),
        },
        timestamp: Date.now(),
      });
    });

    this._addHandler(
      eventBus,
      'CooldownModifyEvent',
      (e: CooldownModifyEvent) => {
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
      },
    );

    this._addHandler(
      eventBus,
      'ResourceDrainEvent',
      (e: ResourceDrainEvent) => {
        this._aggregator.addEntry({
          id: this._generateId(),
          type: 'resource_drain',
          data: {
            value: Math.round(e.amount),
            drainType: e.drainType,
            targetName: e.target.name,
            source: this._sourceRef(e.caster, e.ability),
          },
          timestamp: Date.now(),
        });
      },
    );

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
          displayName: e.displayName,
          targetName: e.target.name,
        },
        timestamp: Date.now(),
      });
    });

    this._addHandler(eventBus, 'DeathPreventEvent', (e: DeathPreventEvent) => {
      this._aggregator.addEntry({
        id: this._generateId(),
        type: 'death_prevent',
        data: {
          targetName: e.target.name,
          sourceKey: e.sourceKey,
          sourceName: e.sourceName,
        },
        timestamp: Date.now(),
      });
    });

    this._addHandler(eventBus, 'MechanicLogEvent', (e: MechanicLogEvent) => {
      this._aggregator.addEntry({
        id: this._generateId(),
        type: 'mechanic',
        data: {
          mechanic: e.mechanic,
          targetName: e.target.name,
          sourceName: e.source?.name,
          name: this._safeDisplayName(e.displayName ?? e.name, '特殊机制'),
          displayName: e.displayName
            ? this._safeDisplayName(e.displayName, '特殊机制')
            : undefined,
          internalKey: e.internalKey ?? e.name,
          value: e.value,
          detail: e.detail,
          operation: e.operation,
          previousDisplayName: e.previousDisplayName
            ? this._safeDisplayName(e.previousDisplayName, '原状态')
            : undefined,
          triggerBasis: e.triggerBasis
            ? {
                left: {
                  id: e.triggerBasis.left.id,
                  displayName: this._safeDisplayName(
                    e.triggerBasis.left.displayName,
                    '原状态',
                  ),
                },
                relation: {
                  id: e.triggerBasis.relation.id,
                  displayName: this._safeDisplayName(
                    e.triggerBasis.relation.displayName,
                    '交互',
                  ),
                },
                right: {
                  id: e.triggerBasis.right.id,
                  displayName: this._safeDisplayName(
                    e.triggerBasis.right.displayName,
                    '新效果',
                  ),
                },
              }
            : undefined,
          visibility: e.visibility ?? (e.displayName ? 'player' : 'debug'),
          source: this._sourceRef(e.source, e.ability, e.sourceBuff),
        },
        timestamp: Date.now(),
      });
    });

    this._addHandler(
      eventBus,
      'CombatResourceChangeEvent',
      (e: CombatResourceChangeEvent) => {
        this._aggregator.addEntry({
          id: this._generateId(),
          type: 'resource_change',
          data: {
            targetName: e.target.name,
            resourceId: e.resourceId,
            resourceName: e.resourceName,
            resourceMax: e.resourceMax,
            operation: e.operation,
            reason: e.reason,
            requested: e.requested,
            applied: e.applied,
            overflow: e.overflow,
            before: e.before,
            after: e.after,
            source: this._sourceRef(e.caster, e.ability),
          },
          timestamp: Date.now(),
        });
      },
    );

    this._addHandler(eventBus, 'ActionStateEvent', (e: ActionStateEvent) => {
      this._aggregator.addEntry({
        id: this._generateId(),
        type: 'action_state',
        data: {
          unitId: e.unit.id,
          unitName: e.unit.name,
          stateType: e.stateType,
          phase: e.phase,
          name: e.name,
          remainingActions: e.remainingActions,
          sourceAbility: e.sourceAbility,
          ability: e.ability,
          reason: e.reason,
        },
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
    priority: number = EventPriorityLevel.COMBAT_LOG,
  ): void {
    eventBus.subscribe(eventType, handler, priority);
    this._handlers.set(eventType, handler);
  }

  private _generateId(): string {
    return `entry_${Date.now()}_${battleRandom().toString(36).substring(2, 11)}`;
  }

  private _safeDisplayName(value: string | undefined, fallback: string): string {
    if (!value) return fallback;
    if (
      value.includes('.') ||
      value.startsWith('sect_') ||
      value.startsWith('sect-') ||
      value.includes('_')
    ) {
      return fallback;
    }
    return value;
  }

  private _sourceRef(
    unit: unknown,
    ability?: { id: string; name: string },
    buff?: { id: string; name: string },
  ): LogSourceRef | undefined {
    const source: LogSourceRef = {};
    if (
      unit &&
      typeof unit === 'object' &&
      'id' in unit &&
      'name' in unit &&
      'getCurrentHp' in unit
    ) {
      const candidate = unit as { id: string; name: string };
      source.unitId = candidate.id;
      source.unitName = candidate.name;
    }
    if (ability) {
      source.abilityId = ability.id;
      source.abilityName = ability.name;
    }
    if (buff) {
      source.buffId = buff.id;
      source.buffName = buff.name;
    }
    return Object.keys(source).length > 0 ? source : undefined;
  }

  private _causeRef(
    cause: { kind: 'ability' | 'buff' | 'mechanic'; id: string; displayName: string } | undefined,
  ): LogCauseRef | undefined {
    if (!cause) return undefined;
    return {
      kind: cause.kind,
      id: cause.id,
      displayName: this._safeDisplayName(cause.displayName, '特殊机制'),
    };
  }
}
