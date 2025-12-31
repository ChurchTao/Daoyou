import { DbTransaction } from '@/lib/drizzle/db';
import { Cultivator, Material } from '@/types/cultivator';
import { z } from 'zod';

export interface CreationContext {
  cultivator: Cultivator;
  materials: Material[];
  userPrompt: string;
}

export interface PromptData {
  system: string;
  user: string;
}

/**
 * 造物策略接口
 *
 * TBlueprint: AI 生成的蓝图类型
 * TResult: 最终产物类型（法宝、丹药等）
 */
export interface CreationStrategy<TBlueprint = unknown, TResult = unknown> {
  /**
   * 标识该策略处理的造物类型 (如 'refine', 'alchemy')
   */
  readonly craftType: string;

  readonly schemaName: string;

  readonly schemaDescription: string;

  /**
   * AI 输出的蓝图 Schema
   */
  readonly schema: z.ZodType<TBlueprint>;

  /**
   * 校验材料和上下文是否有效
   * 无效时应抛出 Error
   */
  validate(context: CreationContext): Promise<void>;

  /**
   * 构建 AI Prompt（只生成蓝图，不含数值）
   */
  constructPrompt(context: CreationContext): PromptData;

  /**
   * 将蓝图转化为实际物品（数值由配置表决定）
   */
  materialize(blueprint: TBlueprint, context: CreationContext): TResult;

  /**
   * 执行数据库持久化逻辑
   * @param tx 数据库事务对象
   * @param context 造物上下文
   * @param resultItem 转化后的实际物品
   */
  persistResult(
    tx: DbTransaction,
    context: CreationContext,
    resultItem: TResult,
  ): Promise<void>;
}
