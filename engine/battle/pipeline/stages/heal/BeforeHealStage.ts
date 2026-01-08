import { effectEngine } from '@/engine/effect';
import { EffectTrigger } from '@/engine/effect/types';
import {
  StagePriority,
  type HealPipelineContext,
  type PipelineStage,
} from '../../types';

/**
 * 治疗处理阶段
 * 调用 EffectEngine 处理 ON_HEAL 触发的所有效果：
 * - HealAmplifyEffect: 治疗增幅/减弱
 */
export class BeforeHealStage implements PipelineStage<HealPipelineContext> {
  readonly name = 'BeforeHealStage';
  readonly priority = StagePriority.BEFORE_HEAL;

  process(ctx: HealPipelineContext): void {
    const { caster, target, skill, heal } = ctx;

    if (heal <= 0) {
      ctx.shouldContinue = false;
      return;
    }

    // 调用 EffectEngine 处理所有 ON_HEAL 效果
    const result = effectEngine.processWithContext(
      EffectTrigger.ON_HEAL,
      caster,
      target,
      heal,
      {
        skillName: skill.name,
      },
    );

    // 读取处理后的结果
    ctx.heal = Math.max(0, Math.floor(result.ctx.value ?? 0));

    // 合并日志
    ctx.logs.push(...result.logs);
  }
}
