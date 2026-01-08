import { EffectFactory } from '@/engine/effect';
import {
  EffectContext,
  EffectLogCollector,
  EffectTrigger,
  EffectType,
} from '@/engine/effect/types';
import {
  StagePriority,
  type DamagePipelineContext,
  type PipelineStage,
} from '../../types';

/**
 * 基础伤害阶段
 * 调用 DamageEffect 计算基础伤害
 */
export class BaseDamageStage implements PipelineStage<DamagePipelineContext> {
  readonly name = 'BaseDamageStage';
  readonly priority = StagePriority.BASE_DAMAGE;

  process(ctx: DamagePipelineContext): void {
    const { caster, target, skill } = ctx;
    const effects = skill.effects ?? [];

    // 查找 Damage 效果配置
    const damageEffectConfig = effects.find(
      (e) => e.type === EffectType.Damage || e.type === EffectType.TrueDamage,
    );
    if (!damageEffectConfig) {
      ctx.shouldContinue = false;
      return;
    }

    // 创建 Effect 实例
    const effect = EffectFactory.create(damageEffectConfig);

    // 创建 EffectContext
    const effectContext: EffectContext = {
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

    // 调用 DamageEffect.apply() 计算基础伤害
    effect.apply(effectContext);

    // 读取计算结果
    ctx.baseDamage = effectContext.value ?? 0;
    ctx.damage = ctx.baseDamage;

    // 读取 metadata
    ctx.element = effectContext.metadata?.element as string | undefined;
    ctx.canCrit = (effectContext.metadata?.canCrit as boolean) ?? true;
    ctx.ignoreDefense =
      (effectContext.metadata?.ignoreDefense as boolean) ?? false;
    ctx.ignoreShield =
      (effectContext.metadata?.ignoreShield as boolean) ?? false;
    ctx.critRateBonus = (effectContext.metadata?.critRateBonus as number) ?? 0;
    ctx.critDamageBonus =
      (effectContext.metadata?.critDamageBonus as number) ?? 0;

    // 收集日志
    if (effectContext.logCollector) {
      ctx.logs.push(...effectContext.logCollector.getLogMessages());
    }
  }
}
