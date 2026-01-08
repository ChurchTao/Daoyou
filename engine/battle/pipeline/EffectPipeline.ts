import type { Skill } from '@/types/cultivator';
import type { BattleUnit } from '../BattleUnit';
import { ExecuteEffectStage } from './stages/effect';
import {
  createEffectPipelineContext,
  type EffectPipelineContext,
  type PipelineResult,
  type PipelineStage,
} from './types';

/**
 * 通用效果管道
 * 处理 AddBuff、ManaDrain、Dispel 等效果
 *
 * 默认阶段顺序:
 * 1. ExecuteEffectStage - 执行效果
 */
export class EffectPipeline {
  private stages: PipelineStage<EffectPipelineContext>[] = [];

  addStage(stage: PipelineStage<EffectPipelineContext>): this {
    this.stages.push(stage);
    this.stages.sort((a, b) => a.priority - b.priority);
    return this;
  }

  execute(ctx: EffectPipelineContext): PipelineResult {
    for (const stage of this.stages) {
      if (!ctx.shouldContinue) break;

      try {
        stage.process(ctx);
      } catch (err) {
        console.error(`[EffectPipeline] Stage ${stage.name} 执行失败:`, err);
      }
    }

    return {
      success: true,
      evaded: false,
      actualDamage: 0,
      isCritical: false,
      shieldAbsorbed: 0,
      logs: ctx.logs,
    };
  }

  static createDefault(): EffectPipeline {
    return new EffectPipeline().addStage(new ExecuteEffectStage());
  }

  static executeForEffect(
    caster: BattleUnit,
    target: BattleUnit,
    skill: Skill,
    effectConfig: NonNullable<Skill['effects']>[number],
    currentTurn: number,
  ): PipelineResult {
    const ctx = createEffectPipelineContext(
      caster,
      target,
      skill,
      effectConfig,
      currentTurn,
    );
    const pipeline = EffectPipeline.createDefault();
    return pipeline.execute(ctx);
  }
}
