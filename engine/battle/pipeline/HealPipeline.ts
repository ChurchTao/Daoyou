import type { Skill } from '@/types/cultivator';
import type { BattleUnit } from '../BattleUnit';
import { ApplyHealStage, BaseHealStage, BeforeHealStage } from './stages/heal';
import {
  createHealPipelineContext,
  type HealPipelineContext,
  type PipelineResult,
  type PipelineStage,
} from './types';

/**
 * 治疗管道
 *
 * 阶段顺序:
 * 1. BaseHealStage   - 计算基础治疗量
 * 2. BeforeHealStage - 调用 EffectEngine(ON_HEAL)
 *                      处理: HealAmplifyEffect 等
 * 3. ApplyHealStage  - 应用治疗
 */
export class HealPipeline {
  private stages: PipelineStage<HealPipelineContext>[] = [];

  addStage(stage: PipelineStage<HealPipelineContext>): this {
    this.stages.push(stage);
    this.stages.sort((a, b) => a.priority - b.priority);
    return this;
  }

  execute(ctx: HealPipelineContext): PipelineResult {
    for (const stage of this.stages) {
      if (!ctx.shouldContinue) break;

      try {
        stage.process(ctx);
      } catch (err) {
        console.error(`[HealPipeline] Stage ${stage.name} 执行失败:`, err);
      }
    }

    return {
      success: true,
      evaded: false,
      actualDamage: 0,
      isCritical: false,
      shieldAbsorbed: 0,
      healing: ctx.actualHeal,
      logs: ctx.logs,
    };
  }

  static createDefault(): HealPipeline {
    return new HealPipeline()
      .addStage(new BaseHealStage())
      .addStage(new BeforeHealStage())
      .addStage(new ApplyHealStage());
  }

  static executeForSkill(
    caster: BattleUnit,
    target: BattleUnit,
    skill: Skill,
    currentTurn: number,
  ): PipelineResult {
    const ctx = createHealPipelineContext(caster, target, skill, currentTurn);
    const pipeline = HealPipeline.createDefault();
    return pipeline.execute(ctx);
  }
}
