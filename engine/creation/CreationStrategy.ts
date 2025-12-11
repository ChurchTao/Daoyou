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

export interface CreationStrategy<T = unknown> {
  /**
   * Identifies the craft type this strategy handles (e.g. 'refine', 'alchemy')
   */
  readonly craftType: string;

  readonly schemaName: string;

  readonly schemaDescription: string;

  readonly schema: z.ZodType<T>;

  /**
   * Validate if the materials and context are valid for this strategy.
   * Should throw Error if invalid.
   */
  validate(context: CreationContext): Promise<void>;

  /**
   * Construct the AI prompt and Zod schema for generation.
   */
  constructPrompt(context: CreationContext): PromptData;

  /**
   * Execute the database result persistence logic.
   * @param tx The database transaction object
   * @param context The creation context
   * @param resultItem The JSON object returned by AI
   */
  persistResult(
    tx: DbTransaction,
    context: CreationContext,
    resultItem: T,
  ): Promise<void>;
}
