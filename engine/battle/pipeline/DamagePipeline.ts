import type { Skill } from '@/types/cultivator';
import type { BattleUnit } from '../BattleUnit';
import {
  AfterDamageStage,
  ApplyDamageStage,
  BaseDamageStage,
  BeforeDamageStage,
} from './stages/damage';
import {
  createPipelineContext,
  type DamagePipelineContext,
  type PipelineResult,
  type PipelineStage,
} from './types';

/**
 * 伤害管道
 *
 * 阶段顺序:
 * 1. BaseDamageStage    - 计算基础伤害
 * 2. BeforeDamageStage  - 调用 EffectEngine(ON_BEFORE_DAMAGE)
 *                         处理: 暴击/减伤/护盾/斩杀
 * 3. ApplyDamageStage   - 扣血
 * 4. AfterDamageStage   - 调用 EffectEngine(ON_AFTER_DAMAGE + ON_BEING_HIT)
 *                         处理: 吸血/反伤/被击反击
 *
 * 注意：闪避判断在 SkillExecutor 中处理
 */
export class DamagePipeline {
  private stages: PipelineStage<DamagePipelineContext>[] = [];

  addStage(stage: PipelineStage<DamagePipelineContext>): this {
    this.stages.push(stage);
    this.stages.sort((a, b) => a.priority - b.priority);
    return this;
  }

  execute(ctx: DamagePipelineContext): PipelineResult {
    for (const stage of this.stages) {
      if (!ctx.shouldContinue) {
        break;
      }

      try {
        stage.process(ctx);
      } catch (err) {
        console.error(`[DamagePipeline] Stage ${stage.name} 执行失败:`, err);
        ctx.logs.push(`⚠️ ${stage.name} 执行异常`);
      }
    }

    return {
      success: !ctx.isEvaded,
      evaded: ctx.isEvaded,
      actualDamage: ctx.actualDamage,
      isCritical: ctx.isCritical,
      shieldAbsorbed: ctx.shieldAbsorbed,
      logs: ctx.logs,
    };
  }

  static createDefault(): DamagePipeline {
    return new DamagePipeline()
      .addStage(new BaseDamageStage())
      .addStage(new BeforeDamageStage())
      .addStage(new ApplyDamageStage())
      .addStage(new AfterDamageStage());
  }

  static executeForSkill(
    caster: BattleUnit,
    target: BattleUnit,
    skill: Skill,
    currentTurn: number,
  ): PipelineResult {
    const ctx = createPipelineContext(caster, target, skill, currentTurn);
    const pipeline = DamagePipeline.createDefault();
    return pipeline.execute(ctx);
  }
}
