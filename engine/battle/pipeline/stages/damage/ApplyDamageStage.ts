import {
  type DamagePipelineContext,
  type PipelineStage,
  StagePriority,
} from '../../types';

/**
 * 应用伤害阶段
 * 将最终伤害应用到目标并生成日志
 */
export class ApplyDamageStage implements PipelineStage {
  readonly name = 'ApplyDamageStage';
  readonly priority = StagePriority.APPLY_DAMAGE;

  process(ctx: DamagePipelineContext): void {
    const { caster, target, skill, isCritical, shieldAbsorbed } = ctx;

    // 计算最终伤害
    const finalDamage = Math.max(0, Math.floor(ctx.damage));

    if (finalDamage > 0) {
      // 应用伤害
      const actualDamage = target.applyDamage(finalDamage);
      ctx.actualDamage = actualDamage;

      // 生成日志
      ctx.logs.push(
        this.formatDamageLog(
          caster.getName(),
          target.getName(),
          skill.name,
          actualDamage,
          isCritical,
          shieldAbsorbed,
        ),
      );
    } else {
      // 无伤害日志
      ctx.actualDamage = 0;
      ctx.logs.push(
        this.formatNoDamageLog(
          caster.getName(),
          target.getName(),
          skill.name,
          shieldAbsorbed,
        ),
      );
    }
  }

  private formatDamageLog(
    casterName: string,
    targetName: string,
    skillName: string,
    damage: number,
    isCritical: boolean,
    shieldAbsorbed?: number,
  ): string {
    const critText = isCritical ? '暴击！' : '';
    const shieldText = shieldAbsorbed
      ? `（护盾吸收 ${shieldAbsorbed} 点伤害）`
      : '';
    return `${casterName} 对 ${targetName} 使用「${skillName}」，${critText}造成 ${damage} 点伤害${shieldText}`;
  }

  private formatNoDamageLog(
    casterName: string,
    targetName: string,
    skillName: string,
    shieldAbsorbed?: number,
  ): string {
    const shieldText = shieldAbsorbed
      ? `（护盾吸收 ${shieldAbsorbed} 点伤害）`
      : '';
    return `${casterName} 对 ${targetName} 使用「${skillName}」，但未能造成伤害${shieldText}`;
  }
}
