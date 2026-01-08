import { effectEngine } from '@/engine/effect';
import { EffectTrigger } from '@/engine/effect/types';
import {
  StagePriority,
  type DamagePipelineContext,
  type PipelineStage,
} from '../../types';

/**
 * 伤害后处理阶段
 * 调用 EffectEngine 处理后续效果：
 * - ON_AFTER_DAMAGE: 吸血、反伤等
 * - ON_BEING_HIT: 被击反击等
 */
export class AfterDamageStage implements PipelineStage<DamagePipelineContext> {
  readonly name = 'AfterDamageStage';
  readonly priority = StagePriority.AFTER_DAMAGE;

  process(ctx: DamagePipelineContext): void {
    const { caster, target, skill, actualDamage } = ctx;

    if (actualDamage <= 0) {
      return;
    }

    // ON_AFTER_DAMAGE: 吸血、反伤等（从攻击者角度）
    const afterDamageResult = effectEngine.processWithContext(
      EffectTrigger.ON_AFTER_DAMAGE,
      caster,
      target,
      actualDamage,
      {
        skillName: skill.name,
        skillElement: skill.element,
        element: ctx.element,
        isCritical: ctx.isCritical,
      },
    );
    ctx.logs.push(...afterDamageResult.logs);

    // ON_BEING_HIT: 被击反击等（从目标角度）
    const beingHitResult = effectEngine.processWithContext(
      EffectTrigger.ON_BEING_HIT,
      target,
      caster,
      actualDamage,
      {
        skillName: skill.name,
        skillElement: skill.element,
        element: ctx.element,
        isCritical: ctx.isCritical,
      },
    );
    ctx.logs.push(...beingHitResult.logs);
  }
}
