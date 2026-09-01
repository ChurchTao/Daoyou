import type { Ability } from '../abilities/Ability';
import { Buff, StackRule } from '../buffs/Buff';
import {
  BuffAddEvent,
  BuffAppliedEvent,
  BuffLayerChangedEvent,
  type BuffLayerChangeReason,
  BuffRemovedEvent,
} from '../core/events';
import {
  markBuffAppliedAtCurrentAction,
  rememberRemovedBuff,
} from '../core/runtimeState';
import { BuffId } from '../core/types';
import { CombatResultEmitterV3 } from '../v3/CombatResultEmitterV3';
import {
  CombatAttributionV3,
  CombatSystemSourceV3,
  combatCarrierFromAbilityV3,
} from '../v3/origin';
import type {
  CombatStatusApplicationTransitionV3,
  CombatStatusLayerChangeReasonV3,
  CombatStatusRemovalReasonV3,
  CombatTraceV3,
} from '../v3/types';
import type { CombatResolutionContext } from '../core/resolution';
import { Unit } from './Unit';

interface BuffApplicationOriginV3 {
  ability?: Ability;
  buff?: Buff;
  attribution?: CombatAttributionV3;
  trace?: CombatTraceV3;
  layerChangeReason?: CombatStatusLayerChangeReasonV3;
  statusDisplayName?: string;
  statusFactVisibility?: 'player' | 'debug';
  resolution?: CombatResolutionContext;
}

enum BuffApplicationModeV3 {
  RUNTIME = 'runtime',
  INITIALIZATION = 'initialization',
}

interface BuffStackApplicationV3 {
  buff: Buff;
  transition: CombatStatusApplicationTransitionV3;
}

/**
 * BuffContainer - Buff 容器
 *
 * GAS+EDA 架构设计：
 * - 管理 Unit 身上的所有 Buff
 * - 负责调用 Buff 的生命周期方法（setOwner → onActivate → onDeactivate）
 * - 处理标签免疫检查和堆叠规则
 */
export class BuffContainer {
  private _buffs = new Map<BuffId, Buff>();
  private _owner: Unit;

  constructor(owner: Unit) {
    this._owner = owner;
  }

  /**
   * 添加 Buff
   * @param buff 要添加的 Buff
   * @param source Buff 来源（通常是施法者），用于 DOT 伤害归属等
   */
  addBuff(buff: Buff, source?: Unit, origin?: BuffApplicationOriginV3): void {
    this._applyBuff(buff, source, origin, BuffApplicationModeV3.RUNTIME);
  }

  /**
   * 绑定战斗开始前已经存在的 Buff。
   * 初始化状态只进入首帧快照，不产生战斗中的申请、触发或可见事实。
   */
  initializeBuff(
    buff: Buff,
    source?: Unit,
    origin?: BuffApplicationOriginV3,
  ): void {
    this._applyBuff(buff, source, origin, BuffApplicationModeV3.INITIALIZATION);
  }

  private _applyBuff(
    buff: Buff,
    source: Unit | undefined,
    origin: BuffApplicationOriginV3 | undefined,
    mode: BuffApplicationModeV3,
  ): void {
    const attribution = this._resolveAttribution(buff, source, origin);
    const resolutionAwareBuff = buff as Buff & {
      setResolution?: (resolution: CombatResolutionContext | undefined) => void;
    };
    resolutionAwareBuff.setResolution?.(origin?.resolution);
    buff.setCombatAttributionV3(attribution);
    let publishedAddEvent: BuffAddEvent | undefined;
    if (mode === BuffApplicationModeV3.RUNTIME) {
      // 1. 发布拦截事件
      const event: BuffAddEvent = {
        type: 'BuffAddEvent',
        timestamp: this._owner.runtime.clock.now(),
        target: this._owner,
        buff,
        source,
        resolution: origin?.resolution,
        isCancelled: false,
      };
      publishedAddEvent = this._owner.runtime.events.runInCausalContext(
        {
          origin: attribution.origin,
          trace: this._owner.runtime.events.getCurrentTrace(),
          resolution: origin?.resolution,
        },
        () => this._owner.runtime.events.publish(event),
      );
      if (event.isCancelled) return;
    }

    // 2. 堆叠规则处理
    const existing = this._buffs.get(buff.id);
    if (existing) {
      const previousLayer = existing.getLayer();
      const application = this._applyStackRule(
        existing,
        buff,
        source,
        attribution,
      );
      if (application) {
        const appliedBuff = application.buff;
        if (mode === BuffApplicationModeV3.RUNTIME) {
          this._commitAppliedFact(
            appliedBuff,
            attribution,
            publishedAddEvent!.trace!,
            application.transition,
            previousLayer,
          );
          this._publishLayerChanged(
            appliedBuff,
            previousLayer,
            appliedBuff.getLayer(),
            'stack',
            source,
            origin,
          );
          markBuffAppliedAtCurrentAction(this._owner, appliedBuff);
          this._publishAppliedEvent(
            appliedBuff,
            attribution,
            publishedAddEvent!.trace!,
            source,
            origin,
          );
        }
      }
      return;
    }

    // 3. 添加新 BUFF（GAS 模式）
    this._buffs.set(buff.id, buff);

    // 3.1 设置 owner 引用（关键：必须在 onActivate 之前）
    buff.setOwner(this._owner);

    // 3.2 设置 source 引用（如果提供）
    if (source) {
      buff.setSource(source);
    }

    // 3.3 调用激活方法（子类在此订阅事件、添加标签等）
    buff.onActivate();
    if (mode === BuffApplicationModeV3.RUNTIME) {
      this._commitAppliedFact(
        buff,
        attribution,
        publishedAddEvent!.trace!,
        'added',
        0,
      );
      this._publishLayerChanged(
        buff,
        0,
        buff.getLayer(),
        'apply',
        source,
        origin,
      );
      markBuffAppliedAtCurrentAction(this._owner, buff);
    }

    // 3.4 更新派生属性
    this._owner.updateDerivedStats();

    // 4. 发布应用成功事件
    if (mode === BuffApplicationModeV3.RUNTIME) {
      this._publishAppliedEvent(
        buff,
        attribution,
        publishedAddEvent!.trace!,
        source,
        origin,
      );
    }
  }

  /**
   * 移除 BUFF（手动移除，如驱散）
   */
  removeBuff(buffId: BuffId, origin?: BuffApplicationOriginV3): void {
    this._removeBuffWithReason(buffId, 'manual', origin);
  }

  removeBuffDispel(
    buffId: BuffId,
    origin?: BuffApplicationOriginV3 & { source?: Unit },
  ): boolean {
    const buff = this._buffs.get(buffId);
    if (!buff || buff.dispelPolicy !== 'normal') return false;
    if (buff.dispelMode === 'one_layer' && buff.getLayer() > 1) {
      const previousLayer = buff.getLayer();
      buff.setLayer(previousLayer - 1);
      this._commitLayerFact(
        buff,
        previousLayer,
        buff.getLayer(),
        'dispelled',
        origin,
      );
      this._publishLayerChanged(
        buff,
        previousLayer,
        buff.getLayer(),
        'dispel',
        origin?.source,
        origin,
      );
      this._owner.updateDerivedStats();
      return true;
    }
    this._publishLayerChanged(
      buff,
      buff.getLayer(),
      0,
      'dispel',
      origin?.source,
      origin,
    );
    this._removeBuffWithReason(buffId, 'dispel', origin);
    return true;
  }

  modifyBuffLayer(
    buffId: BuffId,
    delta: number,
    origin?: BuffApplicationOriginV3 & { source?: Unit },
  ): number {
    const buff = this._buffs.get(buffId);
    if (!buff) return 0;

    const previousLayer = buff.getLayer();
    const nextLayer = buff.getLayer() + delta;
    if (nextLayer <= 0) {
      this._publishLayerChanged(
        buff,
        previousLayer,
        0,
        'effect',
        origin?.source,
        origin,
      );
      this._removeBuffWithReason(
        buffId,
        origin?.layerChangeReason === 'consumed' ? 'consumed' : 'manual',
        origin,
      );
      return 0;
    }

    buff.setLayer(nextLayer);
    this._commitLayerFact(
      buff,
      previousLayer,
      buff.getLayer(),
      origin?.layerChangeReason ?? 'modified',
      origin,
    );
    this._publishLayerChanged(
      buff,
      previousLayer,
      buff.getLayer(),
      'effect',
      origin?.source,
      origin,
    );
    this._owner.updateDerivedStats();
    return buff.getLayer();
  }

  setBuffLayer(
    buffId: BuffId,
    layer: number,
    origin?: BuffApplicationOriginV3 & { source?: Unit },
  ): number {
    const buff = this._buffs.get(buffId);
    if (!buff) return 0;

    const previousLayer = buff.getLayer();
    if (layer <= 0) {
      this._publishLayerChanged(
        buff,
        previousLayer,
        0,
        'effect',
        origin?.source,
        origin,
      );
      this._removeBuffWithReason(
        buffId,
        origin?.layerChangeReason === 'consumed' ? 'consumed' : 'manual',
        origin,
      );
      return 0;
    }

    buff.setLayer(layer);
    this._commitLayerFact(
      buff,
      previousLayer,
      buff.getLayer(),
      origin?.layerChangeReason ?? 'modified',
      origin,
    );
    this._publishLayerChanged(
      buff,
      previousLayer,
      buff.getLayer(),
      'effect',
      origin?.source,
      origin,
    );
    this._owner.updateDerivedStats();
    return buff.getLayer();
  }

  /**
   * 移除 BUFF（过期）
   */
  removeBuffExpired(
    buffId: BuffId,
    origin?: Pick<BuffApplicationOriginV3, 'trace' | 'resolution'>,
  ): void {
    this._removeBuffWithReason(buffId, 'expired', origin);
  }

  private _removeBuffWithReason(
    buffId: BuffId,
    reason: 'manual' | 'expired' | 'dispel' | 'replace' | 'consumed',
    operation?: BuffApplicationOriginV3,
  ): void {
    const buff = this._buffs.get(buffId);
    if (!buff) return;

    if (reason === 'dispel') {
      rememberRemovedBuff(this._owner, buff);
    }

    // GAS 模式：调用 onDeactivate（取消订阅、移除标签等）
    buff.onDeactivate(reason === 'consumed' ? 'manual' : reason);

    this._buffs.delete(buffId);
    this._owner.updateDerivedStats();

    const attribution = buff.getCombatAttributionV3();
    if (!attribution) {
      throw new Error(`Buff ${buff.id} has no attribution when removed`);
    }
    const resultOrigin = this._resolveFactAttribution(
      operation?.attribution ?? attribution,
    ).origin;
    const causalTrace =
      operation?.trace ?? this._owner.runtime.events.reserveTrace();
    const previousLayers = buff.getLayer();
    let removedEventParentTrace = causalTrace;
    if (
      buff.logVisibility !== 'debug' &&
      operation?.statusFactVisibility !== 'debug'
    ) {
      const statusTrace = this._owner.runtime.events.reserveTrace({
        parentEventId: causalTrace.eventId,
      });
      const statusResult = new CombatResultEmitterV3().commit(
        this._owner,
        {
          type: 'status',
          operation: 'remove',
          statusId: buff.id,
          statusName: operation?.statusDisplayName ?? buff.name,
          statusType: buff.type,
          reason: this._statusRemovalReason(reason),
          beforeLayers: previousLayers,
          afterLayers: 0,
        },
        {
          origin: resultOrigin,
          parentTrace: causalTrace,
          reservedTrace: statusTrace,
        },
      );
      removedEventParentTrace = statusResult.trace!;
    }

    const removedEvent: BuffRemovedEvent = {
      type: 'BuffRemovedEvent',
      timestamp: this._owner.runtime.clock.now(),
      target: this._owner,
      buff,
      resolution: operation?.resolution,
      reason: reason === 'consumed' ? 'manual' : reason,
    };
    this._owner.runtime.events.runInCausalContext(
      {
        origin: resultOrigin,
        trace: removedEventParentTrace,
        resolution: operation?.resolution,
      },
      () => this._owner.runtime.events.publish(removedEvent),
    );
  }

  removeBuffsOnDeath(): void {
    let changed = false;
    for (const [id, buff] of this._buffs) {
      if (!buff.removeOnDeath) continue;
      buff.onDeactivate('death');
      this._buffs.delete(id);
      changed = true;
    }
    if (changed) this._owner.updateDerivedStats();
  }

  getAllBuffs(): Buff[] {
    return Array.from(this._buffs.values());
  }

  getAllBuffIds(): BuffId[] {
    return Array.from(this._buffs.keys());
  }

  clear(): void {
    const buffIds = Array.from(this._buffs.keys());
    for (const id of buffIds) {
      const buff = this._buffs.get(id);
      if (buff) {
        buff.onDeactivate('manual');
      }
    }
    this._buffs.clear();
    this._owner.updateDerivedStats();
  }

  private _applyStackRule(
    existing: Buff,
    newBuff: Buff,
    source: Unit | undefined,
    attribution: CombatAttributionV3,
  ): BuffStackApplicationV3 | null {
    switch (newBuff.stackRule) {
      case StackRule.STACK_LAYER: {
        const previousLayer = existing.getLayer();
        existing.addLayer(newBuff.getLayer());
        existing.refreshToDuration(newBuff.getMaxDuration());
        if (source) {
          existing.setSource(source);
        }
        existing.setCombatAttributionV3(attribution);
        return {
          buff: existing,
          transition:
            existing.getLayer() > previousLayer ? 'stacked' : 'refreshed',
        };
      }

      case StackRule.REFRESH_DURATION:
        if (newBuff.stackPriority > existing.stackPriority) {
          return {
            buff: this._replaceBuff(existing, newBuff, source, attribution),
            transition: 'replaced',
          };
        }
        existing.refreshToDuration(newBuff.getMaxDuration());
        if (source) {
          existing.setSource(source);
        }
        existing.setCombatAttributionV3(attribution);
        return { buff: existing, transition: 'refreshed' };

      case StackRule.OVERRIDE:
        return {
          buff: this._replaceBuff(existing, newBuff, source, attribution),
          transition: 'replaced',
        };

      case StackRule.IGNORE:
        return null;
    }

    return null;
  }

  private _replaceBuff(
    existing: Buff,
    newBuff: Buff,
    source: Unit | undefined,
    attribution: CombatAttributionV3,
  ): Buff {
    existing.onDeactivate('replace');
    this._buffs.set(existing.id, newBuff);
    newBuff.setOwner(this._owner);
    newBuff.setCombatAttributionV3(attribution);
    if (source) {
      newBuff.setSource(source);
    }
    newBuff.onActivate();
    this._owner.updateDerivedStats();
    return newBuff;
  }

  private _publishAppliedEvent(
    buff: Buff,
    attribution: CombatAttributionV3,
    parentTrace: NonNullable<BuffAppliedEvent['trace']>,
    source?: Unit,
    origin?: BuffApplicationOriginV3,
  ): void {
    const appliedEvent: BuffAppliedEvent = {
      type: 'BuffAppliedEvent',
      timestamp: this._owner.runtime.clock.now(),
      target: this._owner,
      buff,
      source,
      ability: origin?.ability,
      resolution: origin?.resolution,
      sourceBuff: origin?.buff,
    };
    this._owner.runtime.events.runInCausalContext(
      {
        origin: attribution.origin,
        trace: parentTrace,
        resolution: origin?.resolution,
      },
      () => this._owner.runtime.events.publish(appliedEvent),
    );
  }

  private _commitAppliedFact(
    buff: Buff,
    attribution: CombatAttributionV3,
    parentTrace: NonNullable<BuffAppliedEvent['trace']>,
    transition: CombatStatusApplicationTransitionV3,
    beforeLayers: number,
  ): void {
    if (buff.logVisibility !== 'debug') {
      new CombatResultEmitterV3().commit(
        this._owner,
        {
          type: 'status',
          operation: 'apply',
          transition,
          statusId: buff.id,
          statusName: buff.name,
          statusType: buff.type,
          beforeLayers,
          afterLayers: buff.getLayer(),
          duration: buff.getMaxDuration(),
        },
        {
          origin: this._resolveFactAttribution(attribution).origin,
          parentTrace,
        },
      );
    }
  }

  private _statusRemovalReason(
    reason: 'manual' | 'expired' | 'dispel' | 'replace' | 'consumed',
  ): CombatStatusRemovalReasonV3 {
    if (reason === 'dispel') return 'dispelled';
    if (reason === 'replace') return 'replaced';
    return reason;
  }

  private _commitLayerFact(
    buff: Buff,
    beforeLayers: number,
    afterLayers: number,
    reason: CombatStatusLayerChangeReasonV3,
    operation?: BuffApplicationOriginV3,
  ): void {
    if (
      buff.logVisibility === 'debug' ||
      operation?.statusFactVisibility === 'debug' ||
      beforeLayers === afterLayers
    ) {
      return;
    }
    const attribution = buff.getCombatAttributionV3();
    if (!attribution) {
      throw new Error(`Buff ${buff.id} has no attribution when layers change`);
    }
    const parentTrace =
      operation?.trace ??
      this._owner.runtime.events.getCurrentTrace() ??
      this._owner.runtime.events.reserveTrace();
    new CombatResultEmitterV3().commit(
      this._owner,
      {
        type: 'status',
        operation: 'layers',
        reason,
        statusId: buff.id,
        statusName: operation?.statusDisplayName ?? buff.name,
        statusType: buff.type,
        beforeLayers,
        afterLayers,
      },
      {
        origin: this._resolveFactAttribution(
          operation?.attribution ?? attribution,
        ).origin,
        parentTrace,
      },
    );
  }

  private _resolveFactAttribution(
    attribution: CombatAttributionV3,
  ): CombatAttributionV3 {
    // Self-owned facts can still be legal inside the lethal reaction window,
    // before DamageSystem commits the unit_died fact.
    if (
      attribution.origin.kind === 'system' ||
      attribution.owner === this._owner ||
      attribution.owner.isAlive()
    ) {
      return attribution;
    }
    return CombatAttributionV3.system(
      this._owner,
      CombatSystemSourceV3.ACTION_FLOW,
    );
  }

  private _resolveAttribution(
    buff: Buff,
    source: Unit | undefined,
    origin: BuffApplicationOriginV3 | undefined,
  ): CombatAttributionV3 {
    if (origin?.attribution) return origin.attribution;
    if (origin?.ability) {
      return CombatAttributionV3.owned(
        source ?? this._owner,
        combatCarrierFromAbilityV3(origin.ability),
      );
    }
    const sourceAttribution = origin?.buff?.getCombatAttributionV3();
    if (sourceAttribution) {
      return CombatAttributionV3.rebind(
        sourceAttribution.owner,
        sourceAttribution.origin,
      );
    }
    const carrier = {
      kind: 'buff' as const,
      id: buff.id,
      name: buff.name,
    };
    return CombatAttributionV3.owned(source ?? this._owner, carrier);
  }

  private _publishLayerChanged(
    buff: Buff,
    previousLayer: number,
    currentLayer: number,
    reason: BuffLayerChangeReason,
    source?: Unit,
    origin?: BuffApplicationOriginV3,
  ): void {
    if (previousLayer === currentLayer) return;
    this._owner.runtime.events.publish<BuffLayerChangedEvent>({
      type: 'BuffLayerChangedEvent',
      timestamp: this._owner.runtime.clock.now(),
      target: this._owner,
      buff,
      source,
      ability: origin?.ability,
      resolution: origin?.resolution,
      previousLayer,
      currentLayer,
      delta: currentLayer - previousLayer,
      reason,
    });
  }

  clone(owner: Unit): BuffContainer {
    const clone = new BuffContainer(owner);
    for (const buff of this._buffs.values()) {
      const clonedBuff = buff.clone();
      clone._buffs.set(clonedBuff.id, clonedBuff);
      // 使用新的生命周期方法
      clonedBuff.setOwner(owner);
      const attribution = buff.getCombatAttributionV3();
      if (attribution) {
        clonedBuff.setCombatAttributionV3(
          CombatAttributionV3.rebind(
            attribution.owner === this._owner ? owner : attribution.owner,
            attribution.origin.kind === 'owned' &&
              attribution.origin.owner.id === this._owner.id
              ? {
                  ...attribution.origin,
                  owner: { id: owner.id, name: owner.name },
                }
              : attribution.origin,
          ),
        );
      }
      clonedBuff.onActivate();
    }
    return clone;
  }
}
