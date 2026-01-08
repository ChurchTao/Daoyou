import { effectEngine, EffectFactory } from '@/engine/effect';
import { EffectTrigger } from '@/engine/effect/types';
import {
  StagePriority,
  type DamagePipelineContext,
  type PipelineStage,
} from '../../types';

/**
 * 伤害前处理阶段
 * 调用 EffectEngine 处理 ON_BEFORE_DAMAGE 触发的所有效果：
 * - CriticalEffect: 暴击判定
 * - DamageReductionEffect: 减伤计算
 * - ShieldEffect: 护盾吸收
 * - ExecuteDamageEffect: 斩杀伤害（技能/装备）
 */
export class BeforeDamageStage implements PipelineStage<DamagePipelineContext> {
  readonly name = 'BeforeDamageStage';
  readonly priority = StagePriority.BEFORE_DAMAGE;

  process(ctx: DamagePipelineContext): void {
    const { caster, target, skill, damage } = ctx;

    if (damage <= 0) {
      ctx.shouldContinue = false;
      return;
    }

    // 从技能配置中提取 ON_BEFORE_DAMAGE 效果（如斩杀）
    const skillEffects = (skill.effects ?? [])
      .filter(
        (e) =>
          (e.trigger ?? EffectTrigger.ON_SKILL_HIT) ===
          EffectTrigger.ON_BEFORE_DAMAGE,
      )
      .map((config) => {
        const effect = EffectFactory.create(config);
        effect.setOwner(caster.id);
        return effect;
      });

    // 调用 EffectEngine 处理所有 ON_BEFORE_DAMAGE 效果
    // skillEffects 作为 extraEffects 与装备/Buff 效果一起处理
    const result = effectEngine.processWithContext(
      EffectTrigger.ON_BEFORE_DAMAGE,
      caster,
      target,
      damage,
      {
        skillName: skill.name,
        skillElement: skill.element,
        element: ctx.element,
        canCrit: ctx.canCrit,
        ignoreDefense: ctx.ignoreDefense,
        ignoreShield: ctx.ignoreShield,
        critRateBonus: ctx.critRateBonus,
        critDamageBonus: ctx.critDamageBonus,
      },
      skillEffects,
    );

    // 读取处理后的结果
    ctx.damage = Math.max(0, Math.floor(result.ctx.value ?? 0));
    ctx.isCritical = result.ctx.metadata?.isCritical === true;
    ctx.shieldAbsorbed = (result.ctx.metadata?.shieldAbsorbed as number) ?? 0;

    if (result.logs?.length > 0) {
      ctx.deferredLogs.push(...result.logs);
    }
  }
}
