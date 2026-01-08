import { EffectFactory } from '@/engine/effect';
import {
  EffectLogCollector,
  EffectTrigger,
  EffectType,
} from '@/engine/effect/types';
import {
  StagePriority,
  type HealPipelineContext,
  type PipelineStage,
} from '../../types';

/**
 * 基础治疗量计算阶段
 * 调用 HealEffect 计算基础治疗量
 */
export class BaseHealStage implements PipelineStage<HealPipelineContext> {
  readonly name = 'BaseHealStage';
  readonly priority = StagePriority.BASE_HEAL;

  process(ctx: HealPipelineContext): void {
    const { caster, target, skill } = ctx;
    const effects = skill.effects ?? [];

    // 查找 Heal 效果配置
    const healEffectConfig = effects.find((e) => e.type === EffectType.Heal);
    if (!healEffectConfig) {
      ctx.shouldContinue = false;
      return;
    }

    // 创建 Effect 实例
    const effect = EffectFactory.create(healEffectConfig);

    // 创建 EffectContext
    const effectContext = {
      source: caster,
      target,
      trigger: EffectTrigger.ON_SKILL_HIT,
      value: 0,
      metadata: {
        skillName: skill.name,
      },
      logCollector: new EffectLogCollector(),
    };

    // 调用 HealEffect.apply() 计算基础治疗量
    effect.apply(effectContext);

    // 读取计算结果
    ctx.baseHeal = effectContext.value ?? 0;
    ctx.heal = ctx.baseHeal;

    // 收集日志
    if (effectContext.logCollector) {
      ctx.logs.push(...effectContext.logCollector.getLogMessages());
    }
  }
}
