/**
 * 闭关/突破效果集成辅助函数
 * 用于在闭关和突破时触发持久化 Buff 的效果
 */

import { buffTemplateRegistry } from '@/engine/buff/BuffTemplateRegistry';
import type { BuffInstanceState } from '@/engine/buff/types';
import { CultivatorAdapter } from '@/engine/effect/CultivatorAdapter';
import { effectEngine } from '@/engine/effect/EffectEngine';
import { EffectFactory } from '@/engine/effect/EffectFactory';
import { EffectTrigger, type IBaseEffect } from '@/engine/effect/types';
import type { Cultivator } from '@/types/cultivator';

/**
 * 从持久化状态加载 Buff 并转换为 Effect
 */
export function loadPersistentBuffEffects(
  cultivator: Cultivator,
): IBaseEffect[] {
  const persistentStatuses = cultivator.persistent_statuses as
    | BuffInstanceState[]
    | undefined;

  if (!persistentStatuses || persistentStatuses.length === 0) {
    return [];
  }

  const effects: IBaseEffect[] = [];
  const materializationContext = {
    casterSpirit: cultivator.attributes.spirit,
    casterWisdom: cultivator.attributes.wisdom,
    casterWillpower: cultivator.attributes.willpower,
    casterVitality: cultivator.attributes.vitality,
    casterRealm: cultivator.realm,
    stacks: 1,
  };

  for (const buffState of persistentStatuses) {
    // 检查 Buff 是否过期
    const metadata = buffState.metadata as
      | { expiresAt?: number; usesRemaining?: number }
      | undefined;

    if (metadata?.expiresAt && Date.now() > metadata.expiresAt) {
      continue; // 跳过已过期的 Buff
    }

    if (metadata?.usesRemaining !== undefined && metadata.usesRemaining <= 0) {
      continue; // 跳过使用次数耗尽的 Buff
    }

    // 获取 Buff 的数值化配置
    const config = buffTemplateRegistry.getMaterializedConfig(
      buffState.configId,
      materializationContext,
    );
    if (!config) {
      console.warn(
        `[loadPersistentBuffEffects] 未找到 Buff 模板: ${buffState.configId}`,
      );
      continue;
    }

    // 创建真实 Effect 实例，确保具备 shouldTrigger/apply 等方法
    for (const effect of EffectFactory.createAll(config.effects)) {
      effects.push(effect.setOwner(cultivator.id!).setParentBuff(config.id));
    }
  }

  return effects;
}

/**
 * 应用闭关修为加成效果
 * @param cultivator 角色
 * @param baseGain 基础修为收益
 * @returns 加成后的修为收益
 */
export function applyRetreatCultivationBonus(
  cultivator: Cultivator,
  baseGain: number,
): number {
  const effects = loadPersistentBuffEffects(cultivator);
  const adapter = new CultivatorAdapter(cultivator, effects);

  return effectEngine.process(
    EffectTrigger.ON_RETREAT,
    adapter,
    adapter,
    baseGain,
  );
}

/**
 * 应用闭关感悟加成效果
 * @param cultivator 角色
 * @param baseGain 基础感悟收益
 * @returns 加成后的感悟收益
 */
export function applyRetreatComprehensionBonus(
  cultivator: Cultivator,
  baseGain: number,
): number {
  const effects = loadPersistentBuffEffects(cultivator);
  const adapter = new CultivatorAdapter(cultivator, effects);

  const result = effectEngine.processWithContext(
    EffectTrigger.ON_RETREAT,
    adapter,
    adapter,
    baseGain,
    { baseComprehensionGain: baseGain },
  );

  return (result.ctx.metadata?.finalComprehensionGain as number) ?? baseGain;
}

/**
 * 应用突破成功率加成效果
 * @param cultivator 角色
 * @param baseChance 基础突破成功率
 * @returns 加成后的突破成功率
 */
export function applyBreakthroughChanceBonus(
  cultivator: Cultivator,
  baseChance: number,
): number {
  const effects = loadPersistentBuffEffects(cultivator);
  const adapter = new CultivatorAdapter(cultivator, effects);

  return effectEngine.process(
    EffectTrigger.ON_BREAKTHROUGH_CHECK,
    adapter,
    adapter,
    baseChance,
  );
}
