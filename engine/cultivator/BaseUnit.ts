import { Entity, type IBaseEffect } from '@/engine/effect/types';
import type { Cultivator } from '@/types/cultivator';
import { EffectFactory } from '../effect';

/**
 * 角色单位基类
 * 实现 Entity 接口，提供公共的效果收集逻辑
 * 子类：CultivatorUnit（展示用）、BattleUnit（战斗用）
 */
export abstract class BaseUnit implements Entity {
  // ===== Entity 接口属性 =====
  readonly id: string;
  readonly name: string;

  // ===== 基础数据 =====
  readonly cultivatorData: Cultivator;

  constructor(id: string, cultivatorData: Cultivator) {
    this.id = id;
    this.name = cultivatorData.name;
    this.cultivatorData = cultivatorData;
  }

  // ============================================================
  // Entity 接口实现
  // ============================================================

  abstract getAttribute(key: string): number;

  setAttribute(_key: string, _value: number): void {
    // 默认不支持直接设置属性
  }

  /**
   * 收集所有生效的效果
   * 包括：装备效果、功法效果、命格效果 + 子类扩展效果
   */
  collectAllEffects(): IBaseEffect[] {
    const effects: IBaseEffect[] = [];

    // 1. 装备效果
    effects.push(...this.getEquipmentEffects());

    // 2. 功法效果
    effects.push(...this.getCultivationEffects());

    // 3. 命格效果
    effects.push(...this.getFateEffects());

    // 4. 子类扩展效果（如 Buff、临时技能效果）
    effects.push(...this.collectExtraEffects());

    return effects;
  }

  // ============================================================
  // 公共效果收集方法
  // ============================================================

  /**
   * 获取装备提供的效果
   */
  protected getEquipmentEffects(): IBaseEffect[] {
    const effects: IBaseEffect[] = [];
    const { equipped, inventory } = this.cultivatorData;

    // 获取已装备的法宝 ID 列表
    const equippedIds = [
      equipped.weapon,
      equipped.armor,
      equipped.accessory,
    ].filter(Boolean) as string[];

    // 创建法宝 ID -> 法宝对象的映射
    const artifactsById = new Map(inventory.artifacts.map((a) => [a.id!, a]));

    // 遍历已装备的法宝，收集效果
    for (const id of equippedIds) {
      const artifact = artifactsById.get(id);
      if (!artifact?.effects) continue;

      // 使用 EffectFactory 创建效果实例
      for (const effectConfig of artifact.effects) {
        try {
          const effect = EffectFactory.create(effectConfig);
          effect.setOwner(this.id);
          effects.push(effect);
        } catch (err) {
          console.warn(`[BaseUnit] 加载装备效果失败: ${artifact.name}`, err);
        }
      }
    }

    return effects;
  }

  /**
   * 获取功法提供的效果
   */
  protected getCultivationEffects(): IBaseEffect[] {
    const effects: IBaseEffect[] = [];
    const { cultivations } = this.cultivatorData;

    for (const technique of cultivations) {
      if (!technique.effects) continue;

      for (const effectConfig of technique.effects) {
        try {
          const effect = EffectFactory.create(effectConfig);
          effect.setOwner(this.id);
          effects.push(effect);
        } catch (err) {
          console.warn(`[BaseUnit] 加载功法效果失败: ${technique.name}`, err);
        }
      }
    }

    return effects;
  }

  /**
   * 获取命格提供的效果
   */
  protected getFateEffects(): IBaseEffect[] {
    const effects: IBaseEffect[] = [];
    const { pre_heaven_fates } = this.cultivatorData;

    for (const fate of pre_heaven_fates) {
      if (!fate.effects) continue;
      for (const effectConfig of fate.effects) {
        try {
          const effect = EffectFactory.create(effectConfig);
          effect.setOwner(this.id);
          effects.push(effect);
        } catch (err) {
          console.warn(`[BaseUnit] 加载命格效果失败: ${fate.name}`, err);
        }
      }
    }

    return effects;
  }

  // ============================================================
  // 子类扩展点
  // ============================================================

  /**
   * 收集子类扩展的效果
   * CultivatorUnit: 返回空数组
   * BattleUnit: 返回 Buff 效果 + 临时技能效果
   */
  protected abstract collectExtraEffects(): IBaseEffect[];
}
