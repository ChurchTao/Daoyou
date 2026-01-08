import { EffectFactory } from '@/engine/effect';
import { EffectLogCollector, EffectTrigger } from '@/engine/effect/types';
import {
  StagePriority,
  type EffectPipelineContext,
  type PipelineStage,
} from '../../types';

/**
 * 执行效果阶段
 * 创建并执行效果实例
 */
export class ExecuteEffectStage implements PipelineStage {
  readonly name = 'ExecuteEffectStage';
  readonly priority = StagePriority.EXECUTE_EFFECT;

  process(ctx: EffectPipelineContext): void {
    const { caster, target, skill, effectConfig } = ctx;

    const effect = EffectFactory.create(effectConfig);
    const effectContext = {
      source: caster,
      target,
      trigger: EffectTrigger.ON_SKILL_HIT,
      value: 0,
      metadata: {
        skillName: skill.name,
        skillElement: skill.element,
      },
      logCollector: new EffectLogCollector(),
    };

    effect.apply(effectContext);

    ctx.value = effectContext.value ?? 0;

    // 收集日志
    if (effectContext.logCollector) {
      ctx.logs.push(...effectContext.logCollector.getLogMessages());
    }
  }
}
