import { randomUUID } from 'crypto';
import type { BaseEffect } from '../effect/BaseEffect';
import { EffectFactory } from '../effect/EffectFactory';
import type { Entity } from '../effect/types';
import type { BuffConfig, BuffInstanceState, CasterSnapshot } from './types';
import { BuffStackType } from './types';

/**
 * Buff 实例
 * 运行时对象，管理单个 Buff 的状态
 */
export class BuffInstance {
  /** 实例唯一 ID */
  readonly instanceId: string;
  /** 当前层数 */
  currentStacks: number = 1;
  /** 剩余回合数 */
  remainingTurns: number;
  /** 创建时间 */
  readonly createdAt: number;
  /** 施法者快照 */
  readonly casterSnapshot?: CasterSnapshot;

  constructor(
    /** Buff 配置 */
    public readonly config: BuffConfig,
    /** 施法者 */
    public readonly caster: Entity,
    /** 持有者 */
    public readonly owner: Entity,
    /** 初始层数 */
    initialStacks: number = 1,
    /** 持续时间覆盖 */
    durationOverride?: number,
  ) {
    this.instanceId = randomUUID();
    this.currentStacks = Math.min(initialStacks, config.maxStacks);
    this.remainingTurns = durationOverride ?? config.duration;
    this.createdAt = Date.now();

    // 创建施法者快照 (用于 DOT 等需要施法者属性的效果)
    this.casterSnapshot = this.createCasterSnapshot(caster);
  }

  /**
   * 叠加层数/刷新持续时间
   * @returns 是否成功叠加
   */
  addStack(): boolean {
    if (this.config.stackType === BuffStackType.STACK) {
      if (this.currentStacks < this.config.maxStacks) {
        this.currentStacks++;
        this.remainingTurns = this.config.duration;
        return true;
      }
      // 已达最大层数，只刷新时间
      this.remainingTurns = this.config.duration;
      return false;
    } else if (this.config.stackType === BuffStackType.REFRESH) {
      // 刷新时间
      this.remainingTurns = this.config.duration;
      return true;
    }
    // INDEPENDENT 类型不叠加
    return false;
  }

  /**
   * 回合流逝
   * @returns 是否过期
   */
  tick(): boolean {
    if (this.remainingTurns > 0) {
      this.remainingTurns--;
    }
    return this.remainingTurns <= 0;
  }

  /**
   * 获取该 Buff 所有生效的效果
   */
  getEffects(): BaseEffect[] {
    return this.config.effects.map((effectConfig) => {
      const effect = EffectFactory.create(effectConfig);
      // 将施法者快照注入效果（如有需要）
      return effect;
    });
  }

  /**
   * 导出状态 (用于序列化)
   */
  toState(): BuffInstanceState {
    return {
      instanceId: this.instanceId,
      configId: this.config.id,
      currentStacks: this.currentStacks,
      remainingTurns: this.remainingTurns,
      casterId: this.caster.id,
      ownerId: this.owner.id,
      createdAt: this.createdAt,
      casterSnapshot: this.casterSnapshot,
    };
  }

  /**
   * 创建施法者快照
   */
  private createCasterSnapshot(caster: Entity): CasterSnapshot {
    return {
      name: caster.name,
      attributes: {
        spirit: caster.getAttribute('spirit'),
        vitality: caster.getAttribute('vitality'),
        willpower: caster.getAttribute('willpower'),
      },
    };
  }
}
