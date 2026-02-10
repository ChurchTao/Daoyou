import type { BuffInstanceState } from '@/engine/buff/types';
import { EffectTrigger, type IBaseEffect } from '@/engine/effect/types';
import type { Attributes, Cultivator } from '@/types/cultivator';
import { effectEngine } from '../effect';
import { BaseUnit } from './BaseUnit';

/**
 * 角色单位（展示用）
 * 用于非战斗场景的属性计算，如道身页、游戏主页等
 * 通过 EffectEngine 计算最终属性（包含装备、功法、命格加成）
 */
export class CultivatorUnit extends BaseUnit {
  // ===== 属性缓存 =====
  private cachedAttributes?: Attributes;
  private attributesDirty: boolean = true;

  // ===== 缓存的 maxHp/maxMp =====
  private cachedMaxHp?: number;
  private cachedMaxMp?: number;

  constructor(cultivatorData: Cultivator) {
    super(cultivatorData.id ?? 'cultivator', cultivatorData);
  }

  // ============================================================
  // Entity 接口实现
  // ============================================================

  getAttribute(key: string): number {
    const attrs = this.getFinalAttributes();
    return (attrs as unknown as Record<string, number>)[key] ?? 0;
  }

  // ============================================================
  // 子类扩展点实现
  // ============================================================

  /**
   * CultivatorUnit 没有额外的效果（无 Buff）
   */
  protected collectExtraEffects(): IBaseEffect[] {
    return [];
  }

  // ============================================================
  // 属性计算
  // ============================================================

  /**
   * 获取最终属性（基础 + 装备 + 功法 + 命格 修正）
   * 使用 EffectEngine.process(ON_STAT_CALC) 管道
   */
  getFinalAttributes(): Attributes {
    if (this.attributesDirty || !this.cachedAttributes) {
      const baseAttrs = this.cultivatorData.attributes;

      // 基础五维属性
      const coreStats = [
        'vitality',
        'spirit',
        'wisdom',
        'speed',
        'willpower',
      ] as const;

      // 战斗相关属性（基础值为 0，完全由装备/功法/命格提供）
      const combatStats = [
        'critRate',
        'critDamage',
        'damageReduction',
        'flatDamageReduction',
        'hitRate',
        'dodgeRate',
      ] as const;

      const result: Attributes = { ...baseAttrs };

      // 计算基础五维
      for (const statName of coreStats) {
        const baseValue = baseAttrs[statName];
        const finalValue = effectEngine.process(
          EffectTrigger.ON_STAT_CALC,
          this,
          undefined,
          baseValue,
          { statName },
        );
        result[statName] = Math.floor(finalValue);
      }

      // 计算战斗属性（基础值 0）
      for (const statName of combatStats) {
        const finalValue = effectEngine.process(
          EffectTrigger.ON_STAT_CALC,
          this,
          undefined,
          0,
          { statName },
        );
        (result as unknown as Record<string, number>)[statName] = finalValue;
      }

      this.cachedAttributes = result;
      this.attributesDirty = false;

      // 同时更新 maxHp/maxMp 缓存
      this.cachedMaxHp = 100 + result.vitality * 10;
      this.cachedMaxMp = 100 + result.spirit * 5;
    }

    return this.cachedAttributes;
  }

  /**
   * 获取最大气血
   */
  getMaxHp(): number {
    if (this.cachedMaxHp === undefined) {
      this.getFinalAttributes();
    }
    return this.cachedMaxHp!;
  }

  /**
   * 获取最大灵力
   */
  getMaxMp(): number {
    if (this.cachedMaxMp === undefined) {
      this.getFinalAttributes();
    }
    return this.cachedMaxMp!;
  }

  /**
   * 标记属性为脏（需要重新计算）
   */
  markAttributesDirty(): void {
    this.attributesDirty = true;
    this.cachedMaxHp = undefined;
    this.cachedMaxMp = undefined;
  }

  // ============================================================
  // 持久化状态管理
  // ============================================================

  /**
   * 检查单个持久化状态是否有效
   * @param metadata - Buff 元数据
   * @returns 是否有效
   */
  private isPersistentStatusValid(metadata?: {
    expiresAt?: number;
    usesRemaining?: number;
  }): boolean {
    if (!metadata) return true;

    // 检查过期时间（expiresAt = 0 表示永久）
    if (metadata.expiresAt && metadata.expiresAt > 0) {
      if (Date.now() > metadata.expiresAt) return false;
    }

    // 检查使用次数
    if (metadata.usesRemaining !== undefined && metadata.usesRemaining <= 0) {
      return false;
    }

    return true;
  }

  /**
   * 获取清理后的有效持久化状态列表
   * @returns 有效的持久化状态
   */
  getValidPersistentStatuses(): BuffInstanceState[] {
    const statuses = (this.cultivatorData.persistent_statuses ||
      []) as BuffInstanceState[];

    return statuses.filter((status) => {
      const metadata = status.metadata as
        | {
            expiresAt?: number;
            usesRemaining?: number;
          }
        | undefined;
      return this.isPersistentStatusValid(metadata);
    });
  }

  /**
   * 检查是否有需要清理的过期状态
   * @returns 是否存在过期的持久化状态
   */
  hasDirtyPersistentStatuses(): boolean {
    const originalStatuses = this.cultivatorData.persistent_statuses as
      | BuffInstanceState[]
      | undefined;
    const originalCount = originalStatuses?.length ?? 0;
    const validCount = this.getValidPersistentStatuses().length;
    return originalCount > validCount;
  }
}
