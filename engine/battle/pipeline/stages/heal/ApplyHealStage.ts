import {
  StagePriority,
  type HealPipelineContext,
  type PipelineStage,
} from '../../types';

/**
 * 应用治疗阶段
 * 将最终治疗量应用到目标并生成日志
 */
export class ApplyHealStage implements PipelineStage {
  readonly name = 'ApplyHealStage';
  readonly priority = StagePriority.APPLY_HEAL;

  process(ctx: HealPipelineContext): void {
    const { caster, target, skill } = ctx;

    const finalHeal = Math.max(0, Math.floor(ctx.heal));

    if (finalHeal > 0) {
      const actualHeal = target.applyHealing(finalHeal);
      ctx.actualHeal = actualHeal;

      const targetText = target === caster ? '' : `为 ${target.getName()} `;
      ctx.logs.push(
        `${caster.getName()} 使用「${skill.name}」，${targetText}恢复 ${actualHeal} 点气血`,
      );
    } else {
      ctx.actualHeal = 0;
      const targetText = target === caster ? '' : `${target.getName()} `;
      ctx.logs.push(
        `${caster.getName()} 使用「${skill.name}」，${targetText}气血充足，未能恢复气血`,
      );
    }
  }
}
